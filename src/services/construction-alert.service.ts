/**
 * Construction Alert Service — ADR-266 §5.8 / Phase D.3
 *
 * Server-side Firestore CRUD for the construction_alerts collection.
 * Used by the schedule-check API route.
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateConstructionAlertId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { nowISO } from '@/lib/date-local';
import type {
  ConstructionAlert,
  AlertRuleType,
  AlertStatus,
  ScheduleCheckResult,
} from '@/types/building/construction';
import type { AlertCandidate } from './construction-alert-rules';

const logger = createModuleLogger('construction-alert.service');

// ─── Deduplication key ───────────────────────────────────────────────────

function dedupKey(
  buildingId: string,
  ruleType: AlertRuleType,
  entityId?: string | null,
): string {
  return entityId ? `${buildingId}:${ruleType}:${entityId}` : `${buildingId}:${ruleType}`;
}

// ─── Fetch active alerts for a building ──────────────────────────────────

export async function getActiveAlerts(
  buildingId: string,
  companyId: string,
): Promise<ConstructionAlert[]> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.CONSTRUCTION_ALERTS)
    .where('buildingId', '==', buildingId)
    .where('companyId', '==', companyId)
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map(d => d.data() as ConstructionAlert);
}

// ─── Dismiss a single alert ───────────────────────────────────────────────

export async function dismissAlert(
  alertId: string,
  dismissedBy: string,
): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(COLLECTIONS.CONSTRUCTION_ALERTS).doc(alertId).update({
    status: 'dismissed' satisfies AlertStatus,
    dismissedAt: nowISO(),
    dismissedBy,
  });
}

// ─── Resolve all alerts for a building (cleanup) ─────────────────────────

export async function resolveAlertsForBuilding(
  buildingId: string,
  companyId: string,
): Promise<void> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.CONSTRUCTION_ALERTS)
    .where('buildingId', '==', buildingId)
    .where('companyId', '==', companyId)
    .where('status', '==', 'active')
    .get();

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { status: 'resolved' satisfies AlertStatus });
  }
  await batch.commit();
}

// ─── Save new alerts (skip duplicates) ───────────────────────────────────

export async function saveNewAlerts(
  buildingId: string,
  companyId: string,
  candidates: AlertCandidate[],
): Promise<ScheduleCheckResult> {
  const db = getAdminFirestore();

  const existing = await getActiveAlerts(buildingId, companyId);
  const existingKeys = new Set(
    existing.map(a => dedupKey(buildingId, a.ruleType, a.taskId ?? a.phaseId)),
  );

  const alertIds: string[] = [];

  for (const candidate of candidates) {
    const key = dedupKey(
      buildingId,
      candidate.ruleType,
      candidate.taskId ?? candidate.phaseId,
    );

    if (existingKeys.has(key)) continue;

    const id = generateConstructionAlertId();
    const alert: ConstructionAlert = {
      id,
      buildingId,
      companyId,
      ruleType: candidate.ruleType,
      severity: candidate.severity,
      title: candidate.title,
      message: candidate.message,
      phaseId: candidate.phaseId ?? null,
      taskId: candidate.taskId ?? null,
      data: candidate.data,
      status: 'active',
      notifiedVia: ['dashboard'],
      createdAt: nowISO(),
      dismissedAt: null,
      dismissedBy: null,
    };

    try {
      await db.collection(COLLECTIONS.CONSTRUCTION_ALERTS).doc(id).set(alert);
      alertIds.push(id);
      existingKeys.add(key);
    } catch (err) {
      logger.error(`Failed to save alert ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { buildingId, alertsGenerated: alertIds.length, alertIds };
}
