/**
 * Ομάδα ιδιοτήτων (ADR-923 §5.2) — σε επίπεδο **βιβλιοθήκης**: κάθε ιδιότητα ανήκει σε
 * **ακριβώς μία** ομάδα, με καθολική σειρά (Akeneo attribute groups · Revit «Group parameter
 * under»). Έτσι «Ψύξη» είναι η ίδια ενότητα σε κάθε οικογένεια που τη χρησιμοποιεί, και ο
 * εκδότης (§5.6) μπορεί να ζητήσει «όλες οι ιδιότητες της ομάδας Ψύξη» χωρίς αντιστοίχιση
 * ανά οικογένεια.
 * @module subapps/catalog/types/attribute-group
 */

import type { LocalizedText } from '@/i18n/localized-text';

export interface CatalogAttributeGroupDefinition {
  readonly code: string;
  readonly labels: LocalizedText;
  /** Κλειδί σειράς (fractional index). */
  readonly orderKey: string;
}
