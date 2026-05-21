/**
 * POST /api/alerts/schedule-check
 *
 * Alert Rules Engine endpoint — ADR-266 §5.8 / Phase D.3
 *
 * Fetches phases + tasks + BOQ for a building, runs 6 alert rules,
 * persists new alerts to construction_alerts, and optionally sends
 * a Telegram digest.
 *
 * Trigger modes:
 *   1. Cron (Netcup VPS, daily 07:30): x-cron-secret header bypasses auth.
 *      buildingId="all" → runs across every active building in the system.
 *   2. Manual from Dashboard: authenticated POST with specific buildingId.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withAuth, requireBuildingInTenant } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { sendTelegramMessage } from '@/app/api/communications/webhooks/telegram/telegram-service';
import { computeEVM } from '@/services/report-engine/evm-calculator';
import { runAlertRules } from '@/services/construction-alert-rules';
import { saveNewAlerts } from '@/services/construction-alert.service';
import { fetchWeatherForecast } from '@/services/weather/open-meteo.service';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import type { BuildingMilestone } from '@/types/building/milestone';
import type { BOQItem } from '@/types/boq';
import type { Firestore } from 'firebase-admin/firestore';

export const maxDuration = 60;

const logger = createModuleLogger('ScheduleCheckRoute');

const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID ?? '5618410820';

// ─── Severity ordering for Telegram digest ───────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🚨',
  high: '🔴',
  medium: '🟡',
  low: '🔵',
};

function buildTelegramDigest(
  buildingName: string,
  buildingId: string,
  alerts: { severity: string; title: string; message: string }[],
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestor-app.vercel.app';
  const dashboardUrl = `${appUrl}/buildings/${buildingId}?tab=timeline&view=dashboard`;

  const lines = [
    `🚨 <b>SCHEDULE ALERT — ${buildingName}</b>`,
    '',
    ...alerts
      .slice(0, 5)
      .map(a => `${SEVERITY_EMOJI[a.severity] ?? '⚠️'} <b>${a.title}</b>\n   ${a.message}`),
    '',
    `📊 <a href="${dashboardUrl}">Dashboard</a>`,
  ];

  return lines.join('\n');
}

// ─── Core: single-building check ─────────────────────────────────────────

interface SingleBuildingResult {
  alertsGenerated: number;
  alertIds: string[];
  candidates: { severity: string; title: string; message: string }[];
}

interface BuildingCoords {
  latitude: number;
  longitude: number;
}

async function checkOneBuilding(
  db: Firestore,
  buildingId: string,
  companyId: string,
  coords?: BuildingCoords | null,
): Promise<SingleBuildingResult> {
  const [phasesSnap, tasksSnap, milestonesSnap, boqSnap, weather] = await Promise.all([
    db
      .collection(COLLECTIONS.CONSTRUCTION_PHASES)
      .where(FIELDS.BUILDING_ID, '==', buildingId)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .get(),
    db
      .collection(COLLECTIONS.CONSTRUCTION_TASKS)
      .where(FIELDS.BUILDING_ID, '==', buildingId)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .get(),
    db
      .collection(COLLECTIONS.BUILDING_MILESTONES)
      .where(FIELDS.BUILDING_ID, '==', buildingId)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .get(),
    db
      .collection(COLLECTIONS.BOQ_ITEMS)
      .where(FIELDS.BUILDING_ID, '==', buildingId)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .get(),
    coords ? fetchWeatherForecast(coords.latitude, coords.longitude) : Promise.resolve(null),
  ]);

  const phases = phasesSnap.docs.map(d => d.data() as ConstructionPhase);
  const tasks = tasksSnap.docs.map(d => d.data() as ConstructionTask);
  const milestones = milestonesSnap.docs.map(d => d.data() as BuildingMilestone);
  const boqItems = boqSnap.docs.map(d => d.data() as BOQItem);

  const evm = computeEVM(boqItems, phases, milestones);
  const candidates = runAlertRules(phases, tasks, milestones, evm, weather);
  const result = await saveNewAlerts(buildingId, companyId, candidates);

  return { alertsGenerated: result.alertsGenerated, alertIds: result.alertIds, candidates };
}

// ─── Cron path: all active buildings ─────────────────────────────────────

interface BuildingDoc {
  id: string;
  name: string;
  companyId: string;
  status: string;
  latitude?: number;
  longitude?: number;
}

async function handleCronAllBuildings(): Promise<NextResponse> {
  const db = getAdminFirestore();

  const buildingsSnap = await db.collection(COLLECTIONS.BUILDINGS).get();
  const buildings = buildingsSnap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<BuildingDoc, 'id'>) }))
    .filter((b): b is BuildingDoc => Boolean(b.companyId) && b.status !== 'completed');

  let totalAlertsGenerated = 0;
  const summaryLines: string[] = [];

  for (const building of buildings) {
    try {
      const coords =
        typeof building.latitude === 'number' && typeof building.longitude === 'number'
          ? { latitude: building.latitude, longitude: building.longitude }
          : null;
      const result = await checkOneBuilding(db, building.id, building.companyId, coords);
      if (result.alertsGenerated > 0) {
        totalAlertsGenerated += result.alertsGenerated;
        const topSeverity =
          result.candidates[0]?.severity
            ? (SEVERITY_EMOJI[result.candidates[0].severity] ?? '⚠️')
            : '⚠️';
        summaryLines.push(`${topSeverity} <b>${building.name}</b>: ${result.alertsGenerated} νέα alert${result.alertsGenerated !== 1 ? 's' : ''}`);
      }
    } catch (err) {
      logger.error(`cron check failed for ${building.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (summaryLines.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestor-app.vercel.app';
    const text = [
      `🚨 <b>DAILY ALERT CHECK</b>`,
      `${buildings.length} κτήρια ελέγχθηκαν`,
      '',
      ...summaryLines,
      '',
      `📊 Σύνολο: ${totalAlertsGenerated} νέα alerts`,
      `<a href="${appUrl}/construction/portfolio">Portfolio Dashboard</a>`,
    ].join('\n');

    try {
      await sendTelegramMessage({ chat_id: TELEGRAM_ADMIN_CHAT_ID, text, parse_mode: 'HTML' });
    } catch (err) {
      logger.error(`Telegram digest failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  logger.info(`cron all-buildings: ${buildings.length} checked, ${totalAlertsGenerated} new alerts`);

  return NextResponse.json({
    success: true,
    buildingsChecked: buildings.length,
    totalAlertsGenerated,
  });
}

// ─── Types ────────────────────────────────────────────────────────────────

type RequestBody = {
  buildingId: string;
  buildingName?: string;
  sendTelegram?: boolean;
};

type ScheduleCheckResponse = {
  success: boolean;
  buildingId?: string;
  alertsGenerated?: number;
  alertIds?: string[];
  buildingsChecked?: number;
  totalAlertsGenerated?: number;
  error?: string;
};

// ─── POST handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Cron bypass — Netcup VPS daily 07:30 (no Firebase auth available)
  if (verifyCronAuthorization(request)) {
    return handleCronAllBuildings();
  }

  // Authenticated path — Dashboard manual refresh
  const handler = withStandardRateLimit(
    withAuth<ScheduleCheckResponse>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        let body: RequestBody;
        try {
          body = (await req.json()) as RequestBody;
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid request body' },
            { status: 400 },
          );
        }

        const { buildingId, buildingName = 'Building', sendTelegram = false } = body;

        if (!buildingId) {
          return NextResponse.json(
            { success: false, error: 'buildingId required' },
            { status: 400 },
          );
        }

        await requireBuildingInTenant({
          ctx,
          buildingId,
          path: '/api/alerts/schedule-check',
        });

        const db = getAdminFirestore();
        const buildingDoc = await db.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
        const buildingData = buildingDoc.data() as { latitude?: number; longitude?: number } | undefined;
        const coords =
          typeof buildingData?.latitude === 'number' && typeof buildingData?.longitude === 'number'
            ? { latitude: buildingData.latitude, longitude: buildingData.longitude }
            : null;

        const result = await checkOneBuilding(db, buildingId, ctx.companyId, coords);

        if (sendTelegram && result.alertsGenerated > 0) {
          try {
            const text = buildTelegramDigest(buildingName, buildingId, result.candidates);
            await sendTelegramMessage({
              chat_id: TELEGRAM_ADMIN_CHAT_ID,
              text,
              parse_mode: 'HTML',
            });
          } catch (telegramErr) {
            logger.error(`Telegram digest failed: ${telegramErr instanceof Error ? telegramErr.message : String(telegramErr)}`);
          }
        }

        logger.info(`schedule-check ${buildingId}: ${result.alertsGenerated} new alerts`);

        return NextResponse.json({
          success: true,
          buildingId,
          alertsGenerated: result.alertsGenerated,
          alertIds: result.alertIds,
        });
      },
    ),
  );

  return handler(request);
}
