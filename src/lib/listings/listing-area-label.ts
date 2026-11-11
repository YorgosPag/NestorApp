/**
 * @fileoverview **Το εμβαδόν της δημόσιας αγγελίας → ΚΕΙΜΕΝΟ, με το είδος του** (ADR-777 §8.100).
 * @module lib/listings/listing-area-label
 * @related lib/properties/display-area-label.ts (ο ΕΝΑΣ προσδιορισμός είδους)
 *
 * «95 τ.μ. μικτά» · «108 τ.μ. καθαρά» · «95 τ.μ.» — η κάρτα αποτελεσμάτων και η γραμμή χαρακτηριστικών γράφουν «τ.μ.»
 * όπως οι υπόλοιπες γραμμές εμβαδού της σελίδας (`search-results:listing.areaSqm`).
 *
 * ⚠️ **Χωριστό module, επίτηδες** (ADR-744, CHECK 3.34 F): το κλειδί `search-results:` δεν μπαίνει στο
 * `display-area-label.ts`, γιατί εκείνο το εισάγουν και οι σελίδες πωλήσεων — θα κατέβαζαν ολόκληρο το namespace.
 */

import type { PriceLabelT } from '@/lib/listings/listing-price-label';
import { qualifiedAreaText } from '@/lib/properties/display-area-label';
import type { DisplayArea } from '@/lib/properties/property-display-area';

export function listingAreaLabel(t: PriceLabelT, area: DisplayArea): string {
  return qualifiedAreaText(t, t('search-results:listing.areaSqm', { value: area.value }), area.kind);
}
