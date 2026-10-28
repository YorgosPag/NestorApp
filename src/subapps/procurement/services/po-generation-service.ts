import 'server-only';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { createPO } from '@/services/procurement/procurement-service';
import { createModuleLogger } from '@/lib/telemetry';
import type { AuthContext } from '@/lib/auth';
import type { Quote, QuoteLine } from '../types/quote';
import { quoteChangeStamp } from './quote-change-stamp';
import type { POVatRate } from '@/types/procurement';
import { toStoredUom, type UomCode } from '@/lib/uom/uom-registry';

const LUMP_SUM_UOM: UomCode = 'lump';

const logger = createModuleLogger('PO_GENERATION_SERVICE');

const DEFAULT_CATEGORY_CODE = 'OIK-1';

function mapLine(line: QuoteLine) {
  return {
    description: line.description || '-',
    quantity: line.quantity || 1,
    unit: toStoredUom(line.unit),
    unitPrice: line.unitPrice || 0,
    total: line.lineTotal || 0,
    boqItemId: null as string | null,
    categoryCode: line.categoryCode ?? DEFAULT_CATEGORY_CODE,
  };
}

function dominantVatRate(quote: Quote): POVatRate {
  const r = quote.totals.vatRate;
  return (r === 0 || r === 6 || r === 13 || r === 24) ? r : 24;
}

export async function generatePoFromAwardedQuote(
  ctx: AuthContext,
  winner: Quote
): Promise<{ poId: string; poNumber: string }> {
  const items = winner.lines.length > 0
    ? winner.lines.map(mapLine)
    : [{
        description: winner.displayNumber,
        quantity: 1,
        // ολόκληρη η προσφορά σε μία γραμμή = τίμημα κατ' αποκοπή (UN/ECE `LS`), όχι «ένα τεμάχιο»
        unit: LUMP_SUM_UOM,
        unitPrice: winner.totals.total,
        total: winner.totals.total,
        boqItemId: null as string | null,
        categoryCode: DEFAULT_CATEGORY_CODE,
      }];

  const { id: poId, poNumber } = await createPO(ctx, {
    projectId: winner.projectId,
    buildingId: winner.buildingId ?? null,
    supplierId: winner.vendorContactId,
    items,
    taxRate: dominantVatRate(winner),
    supplierNotes: winner.notes ?? null,
    internalNotes: null,
    sourceQuoteId: winner.id,
  });

  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.QUOTES).doc(winner.id).update(
      sanitizeForFirestore({
        linkedPoId: poId,
        ...quoteChangeStamp(ctx.uid),
      })
    );
  }, undefined);

  logger.info('PO auto-generated from awarded quote', {
    quoteId: winner.id,
    quoteNumber: winner.displayNumber,
    poId,
    poNumber,
    projectId: winner.projectId,
  });

  return { poId, poNumber };
}
