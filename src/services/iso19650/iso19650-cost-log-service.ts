/**
 * ISO 19650 Enrichment Cost Log Service — ADR-373 P2.5
 *
 * Writes a per-file cost record to Firestore after a successful AI enrichment
 * call. Used by `file-record-post-finalize-hooks.ts` (normal upload flow) and
 * the backfill admin route.
 *
 * Admin SDK only — Firestore rule: `allow read, write: if false`.
 * Never throws — all errors are caught and logged.
 *
 * @module services/iso19650/iso19650-cost-log-service
 * @see ADR-373 §P2.5 — Cost Dashboard
 */

// 🚨 ADR-373 hotfix pattern — dynamic import keeps Admin SDK off client bundle.
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('Iso19650CostLog');

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface Iso19650CostLogRecord {
  id: string;
  companyId: string;
  fileId: string;
  costUsd: number;
  model: string;
  disciplineCode: string | null;
  filledBy: 'ai';
}

// ============================================================================
// INTERNAL
// ============================================================================

async function getDb() {
  const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
  return getAdminFirestore();
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Write a cost log record for a successful AI enrichment.
 * Only call when `filledBy === 'ai'` and `costUsd > 0`.
 * Fire-and-forget safe — never throws.
 */
export async function logIso19650EnrichmentCost(params: {
  companyId: string;
  fileId: string;
  costUsd: number;
  model: string;
  disciplineCode?: string;
}): Promise<void> {
  // Runtime server-only guard (ADR-373 §D9). Mirrors triggerPostFinalizeHooks
  // and enrichment-slot-service.ts — never run client-side even though all
  // firebaseAdmin imports below are already dynamic.
  if (typeof window !== 'undefined') return;
  try {
    const { generateIso19650CostLogId } = await import('@/services/enterprise-id.service');
    const { FieldValue } = await import('@/lib/firebaseAdmin');
    const db = await getDb();
    const id = generateIso19650CostLogId();

    await db.collection(COLLECTIONS.ISO19650_COST_LOG).doc(id).set({
      id,
      companyId: params.companyId,
      fileId: params.fileId,
      costUsd: params.costUsd,
      model: params.model,
      disciplineCode: params.disciplineCode ?? null,
      filledBy: 'ai' as const,
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info('ISO19650 cost logged', {
      id,
      companyId: params.companyId,
      fileId: params.fileId,
      costUsd: params.costUsd,
    });
  } catch (err) {
    const { getErrorMessage } = await import('@/lib/error-utils');
    logger.warn('ISO19650 cost log failed (non-blocking)', {
      fileId: params.fileId,
      error: getErrorMessage(err),
    });
  }
}
