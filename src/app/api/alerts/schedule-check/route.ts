/**
 * POST /api/alerts/schedule-check
 *
 * Alert Rules Engine endpoint — ADR-266 §5.8 / Phase D.3
 *
 * Fetches phases + tasks + BOQ for a building, runs 6 alert rules,
 * persists new alerts to construction_alerts, and optionally sends
 * a Telegram digest.
 *
 * Trigger: Vercel Cron (daily 07:30) OR manual call from Dashboard "Refresh".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withAuth, requireBuildingInTenant } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { sendTelegramMessage } from '@/app/api/communications/webhooks/telegram/telegram-service';
import { computeEVM } from '@/services/report-engine/evm-calculator';
import { runAlertRules } from '@/services/construction-alert-rules';
import { saveNewAlerts } from '@/services/construction-alert.service';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import type { BuildingMilestone } from '@/types/building/milestone';
import type { BOQItem } from '@/types/boq';

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

// ─── Main handler ─────────────────────────────────────────────────────────

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
  error?: string;
};

export async function POST(request: NextRequest) {
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
        const companyId = ctx.companyId;

        // ── Parallel fetch ────────────────────────────────────────────────
        const [phasesSnap, tasksSnap, milestonesSnap, boqSnap] = await Promise.all([
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
        ]);

        const phases = phasesSnap.docs.map(d => d.data() as ConstructionPhase);
        const tasks = tasksSnap.docs.map(d => d.data() as ConstructionTask);
        const milestones = milestonesSnap.docs.map(d => d.data() as BuildingMilestone);
        const boqItems = boqSnap.docs.map(d => d.data() as BOQItem);

        // ── Compute EVM ───────────────────────────────────────────────────
        const evm = computeEVM(boqItems, phases, milestones);

        // ── Run rules ─────────────────────────────────────────────────────
        const candidates = runAlertRules(phases, tasks, milestones, evm);

        // ── Persist new alerts ────────────────────────────────────────────
        const result = await saveNewAlerts(buildingId, companyId, candidates);

        // ── Optional Telegram digest ──────────────────────────────────────
        if (sendTelegram && result.alertsGenerated > 0) {
          try {
            const freshAlerts = candidates.slice(0, result.alertsGenerated);
            const text = buildTelegramDigest(buildingName, buildingId, freshAlerts);
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
