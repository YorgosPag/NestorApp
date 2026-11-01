/**
 * Το **σύρμα** ανάμεσα στον πελάτη και στους δρόμους τιμής προμηθευτή για το BOQ (ADR-923 §5.12 Δ7 · Δ9): κοινό, χωρίς `server-only`.
 * @module subapps/catalog/types/supply-boq
 */

import type { BoqSupplierPriceSource } from '@/types/boq';

import type { ForeignPrice } from '../pricing/foreign-quote';
import type { SupplierDrift } from '../pricing/supplier-drift';

export type BoqSupplierPriceOutcome =
  /** Το στιγμιότυπο που γράφτηκε: η φόρμα το παίρνει αυτούσιο, αλλιώς η επόμενη αποθήκευσή της θα έγραφε παλιές τιμές. */
  | { readonly kind: 'applied'; readonly source: BoqSupplierPriceSource }
  /** Η ίδια απάντηση για ανύπαρκτη, κρυφή, ανακλημένη πηγή (Σ7). */
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'requestQuote' }
  | { readonly kind: 'unitMismatch' }
  /** Η τιμή δεν είναι πια αυτή που είδε ο άνθρωπος· τίποτα δεν γράφτηκε. */
  | { readonly kind: 'priceMoved'; readonly price: ForeignPrice }
  /** Ανανέωση πάνω από τον φράχτη χωρίς ρητή επιβεβαίωση· τίποτα δεν γράφτηκε. */
  | { readonly kind: 'fenceRequired'; readonly changeBp: number | null }
  /** Η γραμμή δεν παίρνει τιμή: δόθηκε, είναι σύνοψη, ή δεν υπάρχει σε αυτόν τον χώρο. */
  | { readonly kind: 'notApplicable' };

export interface BoqSupplierDriftRow {
  readonly boqItemId: string;
  readonly relationshipId: string;
  readonly variantId: string;
  readonly drift: SupplierDrift;
}

export interface BoqSupplierDriftReview {
  readonly rows: readonly BoqSupplierDriftRow[];
}
