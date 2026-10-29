/**
 * Οι **όψεις τιμών** όπως τις παραδίδει ο διακομιστής (ADR-923 §5.11 «3δ» Ζ) — η ΜΟΝΗ πόρτα των τιμών προς τον πελάτη.
 * Κάθε όψη κουβαλά τη φρεσκάδα της (ADR-905 §4.3): ο πελάτης ξαναρωτά μόνο όταν το σήμα της ξεπεράσει την `revision`,
 * ή όταν φτάσει το `freshUntil` (μια μελλοντική έκδοση/συνθήκη αρχίζει ή λήγει — η όψη αλλάζει **χωρίς** εγγραφή).
 *
 * @module subapps/catalog/types/pricing-views
 */

import type { ViewFreshness } from '@/types/server-view';
import type { CatalogWire } from './catalog-record';
import type {
  CustomerAssignmentDefinition,
  CustomerGroupDefinition,
  DiscountConditionDefinition,
  DiscountGroupDefinition,
  PriceListDefinition,
  StoredPriceListLineDefinition,
  StoredPriceListVersionDefinition,
} from './price-list';

export type PriceListWire = CatalogWire<PriceListDefinition>;
export type PriceListVersionWire = CatalogWire<StoredPriceListVersionDefinition>;
export type PriceListLineWire = CatalogWire<StoredPriceListLineDefinition>;
export type DiscountGroupWire = CatalogWire<DiscountGroupDefinition>;
export type CustomerGroupWire = CatalogWire<CustomerGroupDefinition>;
export type CustomerAssignmentWire = CatalogWire<CustomerAssignmentDefinition>;
export type DiscountConditionWire = CatalogWire<DiscountConditionDefinition>;

/** `GET /api/catalog/price-lists` — οι τιμοκατάλογοι του χώρου και **όλες** οι ενεργές εκδόσεις τους (χρονογραμμή). */
export interface PriceListsView {
  readonly freshness: ViewFreshness;
  readonly asOf: string;
  readonly lists: readonly PriceListWire[];
  readonly versions: readonly PriceListVersionWire[];
}

/** `GET /api/catalog/price-list-versions/[id]/lines` — μία σελίδα γραμμών μιας έκδοσης (δρομέας = id εγγράφου). */
export interface PriceLinesPageView {
  readonly freshness: ViewFreshness;
  readonly version: PriceListVersionWire;
  readonly lines: readonly PriceListLineWire[];
  /**
   * Το αναγνωριστικό (κωδικός SKU) κάθε **ζωντανής** παραλλαγής της σελίδας, κατά `variantId` — από την **ίδια** συναλλαγή
   * (commercetools: `expand`). Χωρίς αυτό ο πελάτης θα διάβαζε ένα έγγραφο ανά γραμμή (4.000 γραμμές = 4.000 αναγνώσεις).
   * Απουσία κλειδιού ⇒ η παραλλαγή **δεν ζει πια** (διαγράφηκε μετά τη γραμμή) — η οθόνη το λέει, δεν το κρύβει.
   */
  readonly skuIdentifiers: Readonly<Record<string, string>>;
  /** `null` ⇒ τελευταία σελίδα. */
  readonly nextCursor: string | null;
}

/** `GET /api/catalog/discounts` — ομάδες έκπτωσης · ομάδες πελατών · αναθέσεις · συνθήκες. */
export interface DiscountsView {
  readonly freshness: ViewFreshness;
  readonly asOf: string;
  readonly discountGroups: readonly DiscountGroupWire[];
  readonly customerGroups: readonly CustomerGroupWire[];
  readonly assignments: readonly CustomerAssignmentWire[];
  readonly conditions: readonly DiscountConditionWire[];
}
