/**
 * Material Price Sync — ADR-330 Phase 4.5
 *
 * Auto-updates Material avgPrice / lastPrice / lastPurchaseDate
 * when a PO reaches status = delivered.
 *
 * Trigger contract:
 *   - Called exclusively from recordPODelivery when newStatus === 'delivered'
 *   - Only items with an explicit materialId are updated (no ambiguous matching)
 *   - avgPrice = simple rolling mean: (oldAvg + newPrice) / 2
 *   - Idempotent: each item write is self-contained; retrying is safe
 *
 * @module services/procurement/material-price-sync
 * @see ADR-330 §Phase 4.5
 */

import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToDate } from '@/lib/date-local';
import type { PurchaseOrderItem } from '@/types/procurement';
import type { Material } from '@/subapps/procurement/types/material';

const logger = createModuleLogger('MATERIAL_PRICE_SYNC');

export async function syncMaterialPricesOnDelivery(
  companyId: string,
  poId: string,
  items: PurchaseOrderItem[],
  dateDelivered: string,
): Promise<void> {
  const linked = items.filter((i) => i.materialId != null);
  if (linked.length === 0) return;

  await safeFirestoreOperation(async (db) => {
    const deliveredAt = admin.firestore.Timestamp.fromDate(
      normalizeToDate(dateDelivered) ?? new Date(),
    );

    for (const item of linked) {
      const materialId = item.materialId!;
      const ref = db.collection(COLLECTIONS.MATERIALS).doc(materialId);
      const snap = await ref.get();

      if (!snap.exists) {
        logger.warn('Material not found during price sync', { materialId, poId });
        continue;
      }

      const mat = { id: snap.id, ...snap.data() } as Material;
      if (mat.companyId !== companyId || mat.isDeleted) {
        logger.warn('Material skip — tenant mismatch or soft-deleted', { materialId, poId });
        continue;
      }

      const newAvg = mat.avgPrice != null
        ? Math.round(((mat.avgPrice + item.unitPrice) / 2) * 100) / 100
        : item.unitPrice;

      await ref.update({
        avgPrice: newAvg,
        lastPrice: item.unitPrice,
        lastPurchaseDate: deliveredAt,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      logger.info('Material prices synced from PO delivery', {
        materialId,
        poId,
        avgPrice: newAvg,
        lastPrice: item.unitPrice,
      });
    }
  }, undefined);
}
