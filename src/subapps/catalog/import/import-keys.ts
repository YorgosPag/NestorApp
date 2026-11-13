/**
 * Τα **φυσικά κλειδιά** του αγωγού εισαγωγής (ADR-923 §5.5.1) — ίδιο μοτίβο με το `pricing/pricing-keys.ts`: η ταυτότητα
 * παράγεται από το κλειδί (`byCode`), άρα ίδια είσοδος ⇒ ίδιο έγγραφο **δομικά**, χωρίς ερώτημα «υπάρχει ήδη;» με race.
 *
 * | Κλειδί | Τι σημαίνει |
 * |---|---|
 * | παρτίδα | ίδιο αρχείο + ίδιος στόχος + ίδια **έκδοση** προφίλ + ίδιο **εύρος σελίδων** + ίδια επανεκτέλεση ⇒ ίδια παρτίδα |
 * | πρόταση | παρτίδα + σύνολο ⇒ η επανάληψη ανάγνωσης μιας σελίδας ξαναγράφει την ίδια πρόταση |
 *
 * Το προφίλ μπαίνει **με την αναθεώρησή του**: ίδιο αρχείο με διορθωμένο προφίλ είναι **νέα** εκτέλεση, αλλιώς δεν θα
 * μπορούσε ποτέ να ξαναπεράσει. Το ίδιο και το εύρος σελίδων: άλλο κεφάλαιο του ίδιου PDF είναι άλλη δουλειά, αλλιώς θα
 * ξανάνοιγε η παλιά παρτίδα και το νέο εύρος θα αγνοούνταν σιωπηλά.
 * @module subapps/catalog/import/import-keys
 */

import type { ImportBatchTarget, ImportLineIdentity } from '../types/catalog-import';

const SEPARATOR = '|';

function targetKeyOf(target: ImportBatchTarget): string {
  return target.purpose === 'priceLines'
    ? `prices:${target.priceListVersionId}`
    : `attrs:${target.familyId}:${target.variantSchemeCode ?? ''}`;
}

export interface ImportBatchKeyInput {
  readonly contentSha256: string;
  readonly target: ImportBatchTarget;
  readonly profileId: string | null;
  readonly profileRevision: number | null;
  readonly pageRange: { readonly from: number; readonly to: number } | null;
  readonly run: number;
}

export function importBatchKey(input: ImportBatchKeyInput): string {
  const profile = input.profileId === null ? 'none' : `${input.profileId}@${input.profileRevision ?? 0}`;
  const pages = input.pageRange === null ? 'all' : `${input.pageRange.from}-${input.pageRange.to}`;
  return [input.contentSha256, targetKeyOf(input.target), profile, pages, String(input.run)].join(SEPARATOR);
}

export function importProposalKey(batchId: string, groupKey: string): string {
  return `${batchId}${SEPARATOR}${groupKey}`;
}

const PAGE_TABLE_PREFIX = 'page:';

/** Η πρόταση (ιδιοτήτων) ενός πίνακα σελίδας PDF: κάθε γραμμή του πίνακα ανήκει σε **ακριβώς μία** (§5.5.2 Μ9). */
export const pageTableGroupKey = (page: number, table: string): string => `${PAGE_TABLE_PREFIX}${page}:${table}`;

/** Το αντίστροφο του `pageTableGroupKey`: σελίδα + πίνακας, ή `null` αν το κλειδί δεν είναι πρόταση ιδιοτήτων πίνακα. */
export function pageTableAddressOf(groupKey: string): { readonly page: number; readonly table: string } | null {
  if (!groupKey.startsWith(PAGE_TABLE_PREFIX) || attributesGroupKeyOf(groupKey) !== null) return null;
  const rest = groupKey.slice(PAGE_TABLE_PREFIX.length);
  const split = rest.indexOf(':');
  const page = Number(rest.slice(0, split));
  return split > 0 && Number.isInteger(page) ? { page, table: rest.slice(split + 1) } : null;
}

/**
 * Η **μνήμη ετικέτας γραμμής** (§5.5.2 Β5): προμηθευτής × οικογένεια × ετικέτα (κανονικοποιημένη, χωρίς μονάδα) × τυπωμένη μονάδα.
 * Όχι θέση γραμμής ή στήλης: ο επόμενος κατάλογος του ίδιου προμηθευτή τυπώνει την ίδια γραμμή αλλού.
 */
export function labelMemoryKey(supplierContactId: string, familyId: string, identity: Pick<ImportLineIdentity, 'label' | 'unitCode'>): string {
  // JSON και όχι `|`: η ετικέτα είναι τυπωμένο κείμενο και μπορεί να περιέχει τον διαχωριστή («a|W» χωρίς μονάδα ≠ «a» σε W).
  return JSON.stringify(['label-memory', supplierContactId, familyId, identity.label, identity.unitCode]);
}

/**
 * Η **μνήμη τιμών** (§5.5.2 Β10): προμηθευτής × ιδιότητα × κείμενο πηγής (κανονικοποιημένο) × μονάδα στήλης. Ανά ιδιότητα και όχι ανά
 * οικογένεια (Akeneo Value Mapping): το «1Ph» του προμηθευτή σημαίνει το ίδιο σε κάθε οικογένεια. Άλλο πρόθεμα από τη μνήμη γραμμών,
 * άρα δύο κλειδιά δεν συμπίπτουν ποτέ στην κοινή συλλογή.
 */
export function valueMemoryKey(supplierContactId: string, attributeId: string, label: string, unitCode: string | null): string {
  return JSON.stringify(['value-memory', supplierContactId, attributeId, label, unitCode]);
}

const PRICE_GROUP_SUFFIX = ':prices';

/**
 * Η πρόταση **τιμών** ενός πίνακα PDF (§5.5.2 Β4): ίδιο κλειδί με την πρόταση ιδιοτήτων του πίνακα, με κατάληξη. Οι γραμμές τους
 * μοιράζονται τα ίδια `rowKey`, άρα η τιμή ξέρει **ποιο** SKU είναι χωρίς δεύτερη αντιστοίχιση.
 */
export const priceGroupKeyOf = (attributesGroupKey: string): string => `${attributesGroupKey}${PRICE_GROUP_SUFFIX}`;

/** Η πρόταση ιδιοτήτων από την οποία παίρνει ταυτότητα μια πρόταση τιμών πίνακα· `null` = δεν είναι τέτοια. */
export const attributesGroupKeyOf = (priceGroupKey: string): string | null =>
  priceGroupKey.endsWith(PRICE_GROUP_SUFFIX) ? priceGroupKey.slice(0, -PRICE_GROUP_SUFFIX.length) : null;

/**
 * Μία λήψη μέσου (ADR-934 §5.2.2 Μ-β3): παρτίδα + **κανονικό** URI. Όσοι ρόλοι ή γραμμές κι αν ζητούν την ίδια διεύθυνση μέσα
 * στην παρτίδα, κατεβαίνει **μία** φορά.
 */
export function importAssetFetchKey(batchId: string, canonicalUri: string): string {
  return [batchId, canonicalUri].join(SEPARATOR);
}

/** Μία απάντηση του μοντέλου: παρτίδα + σελίδα + διαδρομή + προσπάθεια. */
export function importPageReadingKey(batchId: string, page: number, route: string, attempt: number): string {
  return [batchId, String(page), route, String(attempt)].join(SEPARATOR);
}
