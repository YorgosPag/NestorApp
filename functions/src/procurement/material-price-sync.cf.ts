/**
 * =============================================================================
 * PROCUREMENT: Material Price Sync on PO Delivery (Cloud Function)
 * =============================================================================
 *
 * Firestore `onUpdate` trigger on `purchase_orders/{poId}`. When a PO transitions
 * to `status: 'delivered'`, recomputes `avgPrice` (rolling mean) + `lastPrice` +
 * `lastPurchaseDate` for every line item that carries an explicit `materialId`.
 *
 * Replaces the previous route-layer fire-and-forget call in `recordPODelivery()`
 * (ADR-330 Phase 4.5 v1). The CF variant is the canonical SSoT — no fallback,
 * no dual code path. If the trigger fails, Firebase retries automatically and
 * failures surface in Functions logs.
 *
 * IDEMPOTENCY (ADR-873 Φ1 Στάδιο 1 — this header used to claim it and was wrong):
 *   - The transition guard is NOT idempotency. Firestore triggers are at-least-once:
 *     the SAME transition can be delivered twice, and the old unconditional
 *     `avgPrice` write blended the same delivery into the average a second time.
 *   - The guard now lives in `material-price-sync-write.ts`: a marker keyed by
 *     (company, PO, material, line) and the new price commit in ONE transaction.
 *     That also closes Ε-873.4 — two concurrent POs for one material no longer
 *     lose an update.
 *   - A failing line no longer gets swallowed. It used to be caught and counted as
 *     "skipped", which meant a price update was lost and nobody ever retried it.
 *     Now it throws, the platform retries the whole PO, and the marker makes that
 *     safe: the lines that already committed skip, only the failed one runs again.
 *     The swallow was only ever tolerable BECAUSE there was no way to retry safely.
 *
 * TENANT SAFETY:
 *   - Skips items whose target material has a different `companyId` than the PO.
 *   - Skips soft-deleted materials.
 *   - Skips items missing `materialId` (no ambiguous matching).
 *
 * Pure helpers `shouldTriggerSync()` and `computeNewAvgPrice()` live in
 * `material-price-sync-pure.ts` so they can be unit-tested without booting the
 * Cloud Functions runtime.
 *
 * @module functions/procurement/material-price-sync.cf
 * @enterprise ADR-330 Phase 4.5 (Cloud Function variant, 2026-05-04)
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { COLLECTIONS } from '../config/firestore-collections';
import { shouldTriggerSync, type POStatus } from './material-price-sync-pure';
import {
  syncMaterialPriceOnce,
  type DeliveredLine,
  type PriceSyncResult,
} from './material-price-sync-write';

// ============================================================================
// MIRRORED DOC SHAPES (subset — only fields the trigger reads/writes)
// ============================================================================

interface POItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  materialId?: string | null;
}

interface PODoc {
  companyId: string;
  status: POStatus;
  items: POItem[];
  dateDelivered: string | null;
}

// ============================================================================
// ONE LINE AT A TIME
// ============================================================================

/**
 * Apply one line and report it.
 *
 * `retry` is re-thrown on purpose: another execution holds this exact line right now, and the
 * only correct answer is to let the platform try again later — by then the holder has either
 * committed (so we skip) or vanished (so we take over). Returning quietly would report
 * "handled" for work that may still fail.
 */
async function syncLine(
  db: admin.firestore.Firestore,
  line: DeliveredLine,
): Promise<PriceSyncResult> {
  const result = await syncMaterialPriceOnce(db, line, Date.now());

  if (result.kind === 'retry') {
    throw new Error(`Material price sync: line held by another execution (${line.lineId})`);
  }
  if (result.kind === 'applied') {
    functions.logger.info('Material prices synced from PO delivery (CF)', {
      materialId: line.materialId, poId: line.poId, avgPrice: result.avgPrice,
      lastPrice: line.unitPrice,
    });
  } else {
    const level = result.reason === 'claim-collision' ? 'error' : 'warn';
    functions.logger[level]('Material price sync skipped', {
      materialId: line.materialId, poId: line.poId, reason: result.reason,
    });
  }
  return result;
}

/** The lines of a delivered PO that carry an explicit material, as this trigger sees them. */
function deliveredLines(po: PODoc, poId: string, deliveredAt: admin.firestore.Timestamp): DeliveredLine[] {
  return (Array.isArray(po.items) ? po.items : [])
    .filter((item): item is POItem & { materialId: string } => item.materialId != null)
    .map((item) => ({
      companyId: po.companyId,
      poId,
      materialId: item.materialId,
      lineId: item.id,
      unitPrice: item.unitPrice,
      deliveredAt,
    }));
}

// ============================================================================
// CLOUD FUNCTION
// ============================================================================

export const materialPriceSyncOnPODelivery = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .firestore.document(`${COLLECTIONS.PURCHASE_ORDERS}/{poId}`)
  .onUpdate(async (change, context) => {
    const before = change.before.exists ? (change.before.data() as PODoc) : null;
    const after = change.after.exists ? (change.after.data() as PODoc) : null;
    if (!before || !after) return null;

    if (!shouldTriggerSync(before.status, after.status)) return null;

    const poId = context.params.poId as string;
    const deliveredAt = after.dateDelivered
      ? admin.firestore.Timestamp.fromDate(new Date(after.dateDelivered))
      : admin.firestore.Timestamp.now();

    const lines = deliveredLines(after, poId, deliveredAt);
    if (lines.length === 0) {
      functions.logger.info('Material price sync skipped — no linked items', { poId });
      return null;
    }

    // Sequential, and one transaction per line: two lines of the same PO may point at the
    // same material, and running them in parallel would put a transaction in contention with
    // its own sibling for no gain — the work is bounded by the PO's line count anyway.
    const db = admin.firestore();
    let updated = 0;
    for (const line of lines) {
      const result = await syncLine(db, line);
      if (result.kind === 'applied') updated++;
    }

    functions.logger.info('Material price sync complete', {
      poId, totalLinked: lines.length, updated, skipped: lines.length - updated,
    });

    return null;
  });
