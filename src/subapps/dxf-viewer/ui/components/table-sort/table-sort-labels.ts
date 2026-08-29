/**
 * 🔴 ADR-828 Φ4β — **ΤΑ ΚΛΕΙΔΙΑ i18n ΤΟΥ ΔΙΑΛΟΓΟΥ ΤΑΞΙΝΟΜΗΣΗΣ, ΜΙΑ ΦΟΡΑ.**
 *
 * Ίδιο idiom με το `auto-fill-lists-labels.ts` και τα μητρώα εντολών των δύο μενού: η
 * ταυτότητα γεννά το κλειδί, ποτέ δεύτερος χειρόγραφος πίνακας. Το CHECK 3.8 πιάνει το
 * **κλειδί που λείπει**, όχι το πρόθεμα που ξεχάστηκε σε ένα από τα σημεία χρήσης.
 *
 * @module subapps/dxf-viewer/ui/components/table-sort/table-sort-labels
 */

const PREFIX = 'table.sortDialog';

export const TABLE_SORT_KEYS = {
  title: `${PREFIX}.title`,
  description: `${PREFIX}.description`,
  hasHeader: `${PREFIX}.hasHeader`,
  columnLabel: `${PREFIX}.columnLabel`,
  orderLabel: `${PREFIX}.orderLabel`,
  ascending: `${PREFIX}.ascending`,
  descending: `${PREFIX}.descending`,
  byListLabel: `${PREFIX}.byListLabel`,
  naturalOrder: `${PREFIX}.naturalOrder`,
  addLevel: `${PREFIX}.addLevel`,
  removeLevel: `${PREFIX}.removeLevel`,
  apply: `${PREFIX}.apply`,
  cancel: `${PREFIX}.cancel`,
  /** Πρόθεμα· η **ταυτότητα της άρνησης** συμπληρώνει το υπόλοιπο. */
  refusal: `${PREFIX}.refusal`,
} as const;
