import 'server-only';

/**
 * **SKU ξένου προμηθευτή σε γραμμή BOQ** (ADR-923 §5.12 Δ7 · Δ8): ο ΕΝΑΣ γραφέας του κλάδου `supplier`.
 *
 * 🔴 Από τον πελάτη το ποσό θα ήταν πλαστογραφήσιμο, γι' αυτό οι κανόνες `boq_items` αρνούνται αυτόν τον κλάδο και η τιμή
 *    ξαναϋπολογίζεται εδώ: ο πελάτης στέλνει **ποια γραμμή** και **ποιο SKU**, ποτέ ποσό.
 * 🔑 Η ποσότητα της γραμμής πάει στον επιλυτή, ώστε να πιάσει η κλίμακα. Το στιγμιότυπο κρατά το σύνολο σε λεπτά ανά εκείνη την
 *    ποσότητα, άρα καμία στρογγύλευση ανά μονάδα δεν αλλοιώνει το ποσό.
 * 🔑 Μόνο η πρόχειρη γραμμή παίρνει τιμή, και αυτό ξαναρωτιέται **μέσα** στη συναλλαγή, μαζί με τη σχέση.
 * ⛔ Μετατροπή μονάδας δεν γίνεται ποτέ σιωπηλά: διαφορετική μονάδα ⇒ ονομασμένη άρνηση.
 * @module server/supply-relationships/boq-supplier-price.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { canApplyPrice, priceFieldsFromQuote } from '@/services/measurements/boq-price-source';
import type { BOQItem } from '@/types/boq';

import { quoteForeignLine } from './supply-foreign-quote.server';
import { readActiveSupplyRelationshipInTx } from './supply-relationship-store.server';

export type BoqSupplierPriceOutcome =
  | { readonly kind: 'applied' }
  /** Η ίδια απάντηση για ανύπαρκτη, κρυφή, ανακλημένη πηγή (Σ7). */
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'requestQuote' }
  | { readonly kind: 'unitMismatch' }
  /** Η γραμμή δεν παίρνει τιμή: δόθηκε, είναι σύνοψη, ή δεν υπάρχει σε αυτόν τον χώρο. */
  | { readonly kind: 'notApplicable' };

export interface BoqSupplierPriceRequest {
  readonly boqItemId: string;
  readonly relationshipId: string;
  readonly variantId: string;
}

const items = () => getAdminFirestore().collection(COLLECTIONS.BOQ_ITEMS);

const ownedItem = (data: unknown, companyId: string): BOQItem | null =>
  (data !== undefined && isPayloadOwnedByCompany(data as Readonly<Record<string, unknown>>, companyId) ? (data as BOQItem) : null);

/** Η κλίμακα θέλει ποσότητα· γραμμή χωρίς μετρημένη ποσότητα τιμολογείται για μία μονάδα. */
const quantityOf = (item: Pick<BOQItem, 'estimatedQuantity'>): number => (item.estimatedQuantity > 0 ? item.estimatedQuantity : 1);

export async function applySupplierPrice(ctx: AuthContext, request: BoqSupplierPriceRequest): Promise<BoqSupplierPriceOutcome> {
  const current = ownedItem((await items().doc(request.boqItemId).get()).data(), ctx.companyId);
  if (current === null || !canApplyPrice(current)) return { kind: 'notApplicable' };
  const quoted = await quoteForeignLine(ctx, { relationshipId: request.relationshipId, variantId: request.variantId, quantity: quantityOf(current) });
  if (quoted.kind !== 'priced') return quoted;
  if (quoted.price.unitCode !== current.unit) return { kind: 'unitMismatch' };
  const db = getAdminFirestore();
  return db.runTransaction<BoqSupplierPriceOutcome>(async (tx) => {
    const ref = items().doc(request.boqItemId);
    const item = ownedItem((await tx.get(ref)).data(), ctx.companyId);
    if (item === null || !canApplyPrice(item)) return { kind: 'notApplicable' };
    const ends = { supplierCompanyId: quoted.relationship.companyId, buyerCompanyId: ctx.companyId };
    if ((await readActiveSupplyRelationshipInTx(tx, db, ends)) === null) return { kind: 'unavailable' };
    const now = nowISO();
    const fields = priceFieldsFromQuote({
      unit: item.unit, supplierCompanyId: ends.supplierCompanyId, variantId: request.variantId, versionNumber: quoted.versionNumber, price: quoted.price,
    }, { appliedAt: now, appliedBy: ctx.uid });
    tx.update(ref, { ...fields, updatedAt: now });
    return { kind: 'applied' };
  });
}
