import 'server-only';

/**
 * **SKU ξένου προμηθευτή σε γραμμή BOQ** (ADR-923 §5.12 Δ7 · Δ8 · Δ9): ο ΕΝΑΣ γραφέας του κλάδου `supplier`.
 *
 * 🔴 Από τον πελάτη το ποσό θα ήταν πλαστογραφήσιμο, γι' αυτό οι κανόνες `boq_items` αρνούνται αυτόν τον κλάδο και η τιμή
 *    ξαναϋπολογίζεται εδώ: ο πελάτης στέλνει **ποια γραμμή** και **ποιο SKU**, ποτέ ποσό που θα γραφτεί.
 * 🔑 **Ό,τι είδε ο άνθρωπος, αυτό γράφεται.** Ο πελάτης δηλώνει ποσό και ποσότητα που διάβασε (`acknowledged`), μόνο για σύγκριση.
 *    Αν η τιμή ή η ποσότητα κινήθηκε στο μεταξύ, δεν γράφεται τίποτα και η νέα τιμή γυρίζει για ρητή απόφαση.
 * 🔑 **Ο φράχτης κρίνεται εδώ**, όχι μόνο στην οθόνη: ανανέωση του ίδιου SKU πάνω από το όριο θέλει ρητή επιβεβαίωση (Δ9).
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
import { canApplyPrice, priceFieldsFromSupplierSource, supplierLineQuantity, supplierSourceOf } from '@/services/measurements/boq-price-source';
import type { ForeignPrice } from '@/subapps/catalog/pricing/foreign-quote';
import { judgeSupplierDrift } from '@/subapps/catalog/pricing/supplier-drift';
import type { BoqSupplierPriceOutcome } from '@/subapps/catalog/types/supply-boq';
import type { BOQItem } from '@/types/boq';

import { quoteForeignLine } from './supply-foreign-quote.server';
import { readActiveSupplyRelationshipInTx } from './supply-relationship-store.server';

export interface BoqSupplierPriceRequest {
  readonly boqItemId: string;
  readonly relationshipId: string;
  readonly variantId: string;
  /** Ό,τι διάβασε ο άνθρωπος. Συγκρίνεται, ποτέ δεν γράφεται. */
  readonly acknowledged: { readonly netAmount: number; readonly quantity: number };
  readonly confirmFence: boolean;
}

const items = () => getAdminFirestore().collection(COLLECTIONS.BOQ_ITEMS);

/**
 * Η γραμμή, αν ανήκει σε αυτόν τον χώρο. 🔑 Το `id` έρχεται από το **έγγραφο**: το σώμα δεν το περιέχει, και χωρίς αυτό το `BOQItem`
 * δήλωνε πεδίο που δεν υπήρχε, οπότε ο έλεγχος τιμών έστελνε γραμμές χωρίς ταυτότητα και το πάνελ έμενε κενό (§5.12).
 */
export function ownedBoqItem(snap: { readonly id: string; data(): unknown }, companyId: string): BOQItem | null {
  const data = snap.data();
  if (data === undefined || !isPayloadOwnedByCompany(data as Readonly<Record<string, unknown>>, companyId)) return null;
  return { ...(data as Omit<BOQItem, 'id'>), id: snap.id };
}

/** Ανανέωση του **ίδιου** SKU πάνω από τον φράχτη. Άλλο SKU είναι νέα επιλογή, όχι αλλαγή τιμής. */
function fenceRefusal(item: BOQItem, price: ForeignPrice, request: BoqSupplierPriceRequest): BoqSupplierPriceOutcome | null {
  const source = item.priceSource;
  if (request.confirmFence || source?.authority !== 'supplier' || source.variantId !== request.variantId) return null;
  const drift = judgeSupplierDrift(source, { kind: 'priced', price });
  return drift.kind === 'changed' && drift.exceedsFence ? { kind: 'fenceRequired', changeBp: drift.changeBp } : null;
}

/** Γιατί δεν γράφεται αυτή η τιμή σε αυτή τη γραμμή· `null` ⇒ γράφεται. Τρέχει πάνω στη γραμμή **της συναλλαγής**. */
function refusalOf(item: BOQItem, price: ForeignPrice, request: BoqSupplierPriceRequest): BoqSupplierPriceOutcome | null {
  if (price.unitCode !== item.unit) return { kind: 'unitMismatch' };
  const { netAmount, quantity } = request.acknowledged;
  const seen = price.netAmount === netAmount && price.quantity === quantity && price.quantity === supplierLineQuantity(item);
  return seen ? fenceRefusal(item, price, request) : { kind: 'priceMoved', price };
}

export async function applySupplierPrice(ctx: AuthContext, request: BoqSupplierPriceRequest): Promise<BoqSupplierPriceOutcome> {
  const current = ownedBoqItem(await items().doc(request.boqItemId).get(), ctx.companyId);
  if (current === null || !canApplyPrice(current)) return { kind: 'notApplicable' };
  const quoted = await quoteForeignLine(ctx, { relationshipId: request.relationshipId, variantId: request.variantId, quantity: supplierLineQuantity(current) });
  if (quoted.kind !== 'priced') return quoted;
  const db = getAdminFirestore();
  return db.runTransaction<BoqSupplierPriceOutcome>(async (tx) => {
    const ref = items().doc(request.boqItemId);
    const item = ownedBoqItem(await tx.get(ref), ctx.companyId);
    if (item === null || !canApplyPrice(item)) return { kind: 'notApplicable' };
    const ends = { supplierCompanyId: quoted.relationship.companyId, buyerCompanyId: ctx.companyId };
    if ((await readActiveSupplyRelationshipInTx(tx, db, ends)) === null) return { kind: 'unavailable' };
    const refusal = refusalOf(item, quoted.price, request);
    if (refusal !== null) return refusal;
    const now = nowISO();
    const source = supplierSourceOf({
      unit: item.unit, supplierCompanyId: ends.supplierCompanyId, variantId: request.variantId, versionNumber: quoted.versionNumber, price: quoted.price,
    }, { appliedAt: now, appliedBy: ctx.uid });
    tx.update(ref, { ...priceFieldsFromSupplierSource(source), updatedAt: now });
    return { kind: 'applied', source };
  });
}
