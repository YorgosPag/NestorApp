/**
 * **Τι βλέπει ο αγοραστής όταν ψάχνει SKU σε ξένο κατάλογο** (ADR-923 §5.12 τμήμα 4 · Σ7): κλειστή προβολή, καθαρή.
 *
 * 🔒 Κρυφό SKU δεν γίνεται γραμμή, και η απάντηση δεν έχει **κανένα** πεδίο που να μαρτυρά τι έμεινε έξω: ούτε σύνολο, ούτε
 *    `hasMore`, ούτε δρομέας. Ο δρομέας θα ήταν το `sortKey` του τελευταίου εγγράφου που κρίθηκε, δηλαδή ίσως κρυφού: θα έβγαζε
 *    την ετικέτα του από τον χώρο. Γι' αυτό ο επιλογέας είναι «γράψε κι άλλο», όχι σελιδοποίηση.
 *
 * Τα όρια είναι **ανά αναζήτηση**, όχι ανά μέγεθος καταλόγου: η κρίση ορατότητας τρέχει μόνο σε ό,τι ταίριαξε στο κείμενο, σε
 * παράθυρα, και σταματά μόλις γεμίσει η λίστα. Κατάλογος με χιλιάδες SKU δεν κοστίζει περισσότερο από κατάλογο με εκατό.
 *
 * @module subapps/catalog/pricing/foreign-sku-search
 */

import type { CatalogVisibility } from '../vocabulary/pricing';
import { showsPrice, showsProduct } from './visibility';

/** Όσα χωρούν σε έναν επιλογέα: περισσότερα σημαίνουν ότι ο όρος θέλει στένεμα. */
export const FOREIGN_SKU_RESULTS = 20;
/** Υποψήφια ανά παράθυρο. */
export const FOREIGN_SKU_WINDOW = 50;
/** Το πολύ τόσα παράθυρα ανά αναζήτηση: εδώ φράζεται το κόστος κάθε πληκτρολόγησης. */
export const FOREIGN_SKU_WINDOWS = 3;
/** Το μέγιστο μήκος όρου: κωδικός ή λίγες λέξεις. */
export const FOREIGN_SKU_TERM_MAX = 80;

export interface ForeignSkuRow {
  readonly variantId: string;
  readonly code: string | null;
  readonly label: string | null;
  /** `false` ⇒ `visibleNoPrice`: το προϊόν φαίνεται, η τιμή του ζητείται από τον προμηθευτή. */
  readonly priced: boolean;
}

export interface ForeignSkuSearch {
  readonly rows: readonly ForeignSkuRow[];
}

export const FOREIGN_SKU_NONE: ForeignSkuSearch = { rows: [] };

interface SearchedSku {
  readonly id: string;
  readonly derived: { readonly label: string | null; readonly identifier: string | null };
}

/** Χτισμένο πεδίο προς πεδίο: ό,τι δεν γράφεται εδώ δεν ταξιδεύει. */
export function foreignSkuRowOf(sku: SearchedSku, visibility: CatalogVisibility): ForeignSkuRow | null {
  if (!showsProduct(visibility)) return null;
  return { variantId: sku.id, code: sku.derived.identifier, label: sku.derived.label, priced: showsPrice(visibility) };
}
