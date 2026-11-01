import 'server-only';

/**
 * **Ο έλεγχος τιμών προμηθευτή** (ADR-923 §5.12 Δ9): νέο `price-quote` για κάθε δεμένη γραμμή, με τον ίδιο επιλυτή και την ίδια
 * ποσότητα. Μόνο διαβάζει: η ανανέωση περνά από τον έναν γραφέα, με ρητή πράξη.
 *
 * 🔑 Ο πελάτης στέλνει **ποιες γραμμές**. Προμηθευτή, SKU και ποσότητα τα παίρνει από το αποθηκευμένο στιγμιότυπο, άρα δεν γίνεται
 *    όργανο τιμών για ό,τι δεν είναι ήδη στο BOQ του.
 * 🔒 Κάθε απάντηση είναι η κλειστή `SupplierDrift`. Ξένη γραμμή απλώς λείπει.
 * @module server/supply-relationships/boq-supplier-drift.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { supplierLineQuantity } from '@/services/measurements/boq-price-source';
import { judgeSupplierDrift } from '@/subapps/catalog/pricing/supplier-drift';
import type { BoqSupplierDriftReview, BoqSupplierDriftRow } from '@/subapps/catalog/types/supply-boq';
import type { BOQItem, BoqSupplierPriceSource } from '@/types/boq';

import { ownedBoqItem } from './boq-supplier-price.server';
import { quoteForeignLine } from './supply-foreign-quote.server';
import { supplyRelationshipId } from './supply-relationship-store.server';

/** Ταυτόχρονες τιμολογήσεις: κάθε μία είναι δική της συναλλαγή ανάγνωσης με περίπου δέκα αναγνώσεις. */
const CONCURRENT_QUOTES = 6;

type SupplierLine = BOQItem & { readonly priceSource: BoqSupplierPriceSource };

const isSupplierLine = (item: BOQItem | null): item is SupplierLine => item?.priceSource?.authority === 'supplier';

async function driftOf(ctx: AuthContext, line: SupplierLine): Promise<BoqSupplierDriftRow> {
  const { supplierCompanyId, variantId } = line.priceSource;
  const relationshipId = supplyRelationshipId({ supplierCompanyId, buyerCompanyId: ctx.companyId });
  const quoted = await quoteForeignLine(ctx, { relationshipId, variantId, quantity: supplierLineQuantity(line) });
  return { boqItemId: line.id, relationshipId, variantId, drift: judgeSupplierDrift(line.priceSource, quoted) };
}

export async function reviewSupplierPrices(ctx: AuthContext, boqItemIds: readonly string[]): Promise<BoqSupplierDriftReview> {
  const db = getAdminFirestore();
  const snaps = await db.getAll(...boqItemIds.map((id) => db.collection(COLLECTIONS.BOQ_ITEMS).doc(id)));
  const lines = snaps.map((snap) => ownedBoqItem(snap.data(), ctx.companyId)).filter(isSupplierLine);
  const rows: BoqSupplierDriftRow[] = [];
  for (let start = 0; start < lines.length; start += CONCURRENT_QUOTES) {
    rows.push(...await Promise.all(lines.slice(start, start + CONCURRENT_QUOTES).map((line) => driftOf(ctx, line))));
  }
  return { rows };
}
