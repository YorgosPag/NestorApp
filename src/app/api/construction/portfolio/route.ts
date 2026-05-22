/**
 * GET /api/construction/portfolio
 *
 * Cross-building portfolio summary — ADR-266 §5.9 / Phase D.5
 *
 * Returns EVM metrics, alert counts, and next milestone for every
 * active building in the authenticated user's company.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { computeEVM } from '@/services/report-engine/evm-calculator';
import { compareByLocale } from '@/lib/intl-formatting';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import type { BuildingMilestone } from '@/types/building/milestone';
import type { BOQItem } from '@/types/boq';
import type { Building } from '@/types/building/contracts';

export const maxDuration = 30;

const logger = createModuleLogger('PortfolioRoute');

const TODAY = () => nowISO().slice(0, 10);

// ─── Response shape ───────────────────────────────────────────────────────

export interface BuildingPortfolioItem {
  buildingId: string;
  buildingName: string;
  status: string;
  progress: number;
  spi: number;
  cpi: number;
  delayedTasksCount: number;
  activeAlertsCount: number;
  nextMilestone: { title: string; date: string } | null;
}

export interface PortfolioTotals {
  totalBuildings: number;
  avgSPI: number;
  totalActiveAlerts: number;
  buildingsAtRisk: number;
}

interface PortfolioResponse {
  items: BuildingPortfolioItem[];
  totals: PortfolioTotals;
}

// ─── Per-building aggregation ─────────────────────────────────────────────

async function aggregateBuilding(
  db: ReturnType<typeof getAdminFirestore>,
  building: Building & { id: string },
  companyId: string,
): Promise<BuildingPortfolioItem> {
  const today = TODAY();

  const [phasesSnap, tasksSnap, milestonesSnap, boqSnap, alertsSnap] = await Promise.all([
    db
      .collection(COLLECTIONS.CONSTRUCTION_PHASES)
      .where(FIELDS.BUILDING_ID, '==', building.id)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .get(),
    db
      .collection(COLLECTIONS.CONSTRUCTION_TASKS)
      .where(FIELDS.BUILDING_ID, '==', building.id)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .get(),
    db
      .collection(COLLECTIONS.BUILDING_MILESTONES)
      .where(FIELDS.BUILDING_ID, '==', building.id)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .get(),
    db
      .collection(COLLECTIONS.BOQ_ITEMS)
      .where(FIELDS.BUILDING_ID, '==', building.id)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .get(),
    db
      .collection(COLLECTIONS.CONSTRUCTION_ALERTS)
      .where(FIELDS.BUILDING_ID, '==', building.id)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .where('status', '==', 'active')
      .get(),
  ]);

  const phases = phasesSnap.docs.map(d => d.data() as ConstructionPhase);
  const tasks = tasksSnap.docs.map(d => d.data() as ConstructionTask);
  const milestones = milestonesSnap.docs.map(d => d.data() as BuildingMilestone);
  const boqItems = boqSnap.docs.map(d => d.data() as BOQItem);

  const evm = computeEVM(boqItems, phases, milestones);

  const delayedTasksCount = tasks.filter(
    t => t.status !== 'completed' && t.plannedEndDate < today,
  ).length;

  const activeAlertsCount = alertsSnap.size;

  const upcomingMilestones = milestones
    .filter(m => m.status !== 'completed' && m.date >= today)
    .sort((a, b) => compareByLocale(a.date, b.date));

  const nextMilestone = upcomingMilestones[0]
    ? { title: upcomingMilestones[0].title, date: upcomingMilestones[0].date }
    : null;

  return {
    buildingId: building.id,
    buildingName: building.name,
    status: building.status,
    progress: building.progress ?? 0,
    spi: evm.spi,
    cpi: evm.cpi,
    delayedTasksCount,
    activeAlertsCount,
    nextMilestone,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const handler = withStandardRateLimit(
    withAuth<PortfolioResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        const db = getAdminFirestore();
        const companyId = ctx.companyId;

        const buildingsSnap = await db
          .collection(COLLECTIONS.BUILDINGS)
          .where(FIELDS.COMPANY_ID, '==', companyId)
          .get();

        const activeBuildings = buildingsSnap.docs
          .map(d => ({ ...(d.data() as Building), id: d.id }))
          .filter(b => b.status !== 'completed');

        const items = await Promise.all(
          activeBuildings.map(b => {
            return aggregateBuilding(db, b, companyId).catch(err => {
              logger.error(`portfolio aggregate failed for ${b.id}: ${err instanceof Error ? err.message : String(err)}`);
              return {
                buildingId: b.id,
                buildingName: b.name,
                status: b.status,
                progress: b.progress ?? 0,
                spi: 1,
                cpi: 1,
                delayedTasksCount: 0,
                activeAlertsCount: 0,
                nextMilestone: null,
              } satisfies BuildingPortfolioItem;
            });
          }),
        );

        const totalBuildings = items.length;
        const avgSPI = totalBuildings > 0
          ? items.reduce((sum, i) => sum + i.spi, 0) / totalBuildings
          : 0;
        const totalActiveAlerts = items.reduce((sum, i) => sum + i.activeAlertsCount, 0);
        const buildingsAtRisk = items.filter(i => i.spi < 0.85 || i.cpi < 0.85).length;

        logger.info(`portfolio: ${totalBuildings} buildings, ${totalActiveAlerts} alerts`);

        return NextResponse.json({
          items,
          totals: { totalBuildings, avgSPI, totalActiveAlerts, buildingsAtRisk },
        });
      },
    ),
  );

  return handler(request);
}
