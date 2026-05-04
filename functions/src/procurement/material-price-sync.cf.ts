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
 * IDEMPOTENCY:
 *   - Trigger fires only on transition `before.status !== 'delivered' &&
 *     after.status === 'delivered'`. Subsequent updates to a PO that is already
 *     delivered (e.g. status → closed) do NOT retrigger.
 *   - Material updates are unconditional writes (avgPrice / lastPrice /
 *     lastPurchaseDate / updatedAt), safe to retry on the same input.
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

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { COLLECTIONS } from '../config/firestore-collections';
import {
  shouldTriggerSync,
  computeNewAvgPrice,
  type POStatus,
} from './material-price-sync-pure';

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

interface MaterialDoc {
  companyId: string;
  isDeleted: boolean;
  avgPrice: number | null;
}

// ============================================================================
// CLOUD FUNCTION
// ============================================================================

export const materialPriceSyncOnPODelivery = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .firestore.document('purchase_orders/{poId}')
  .onUpdate(async (change, context) => {
    const before = change.before.exists ? (change.before.data() as PODoc) : null;
    const after = change.after.exists ? (change.after.data() as PODoc) : null;
    if (!before || !after) return null;

    if (!shouldTriggerSync(before.status, after.status)) return null;

    const poId = context.params.poId as string;
    const items = Array.isArray(after.items) ? after.items : [];
    const linked = items.filter((i) => i.materialId != null);
    if (linked.length === 0) {
      functions.logger.info('Material price sync skipped — no linked items', { poId });
      return null;
    }

    const db = admin.firestore();
    const deliveredAt = after.dateDelivered
      ? admin.firestore.Timestamp.fromDate(new Date(after.dateDelivered))
      : admin.firestore.Timestamp.now();

    let updated = 0;
    let skipped = 0;

    for (const item of linked) {
      const materialId = item.materialId!;
      try {
        const ref = db.collection(COLLECTIONS.MATERIALS).doc(materialId);
        const snap = await ref.get();

        if (!snap.exists) {
          functions.logger.warn('Material not found during price sync', { materialId, poId });
          skipped++;
          continue;
        }

        const mat = snap.data() as MaterialDoc;
        if (mat.companyId !== after.companyId) {
          functions.logger.warn('Material skip — tenant mismatch', {
            materialId, poId, materialCompany: mat.companyId, poCompany: after.companyId,
          });
          skipped++;
          continue;
        }
        if (mat.isDeleted) {
          functions.logger.warn('Material skip — soft-deleted', { materialId, poId });
          skipped++;
          continue;
        }

        const newAvg = computeNewAvgPrice(mat.avgPrice ?? null, item.unitPrice);

        await ref.update({
          avgPrice: newAvg,
          lastPrice: item.unitPrice,
          lastPurchaseDate: deliveredAt,
          updatedAt: admin.firestore.Timestamp.now(),
        });

        updated++;
        functions.logger.info('Material prices synced from PO delivery (CF)', {
          materialId, poId, avgPrice: newAvg, lastPrice: item.unitPrice,
        });
      } catch (err) {
        functions.logger.error('Material price sync failed for item', {
          materialId: item.materialId, poId,
          error: err instanceof Error ? err.message : String(err),
        });
        skipped++;
      }
    }

    functions.logger.info('Material price sync complete', {
      poId, totalLinked: linked.length, updated, skipped,
    });

    return null;
  });
