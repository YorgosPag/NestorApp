/**
 * =============================================================================
 * SALES SHARED — barrel για τη σύνθεση των σελίδων πωλήσεων
 * =============================================================================
 *
 * Οι σελίδες πωλήσεων χτίζονται πάνω στα ίδια λίγα κομμάτια. Χωρίς barrel κάθε
 * σελίδα επαναλάμβανε την ΙΔΙΑ πεντάδα από `import` — το jscpd τα μετρούσε
 * (σωστά) ως δίδυμα μπλοκ, ενώ είναι απλώς το τίμημα του να έχουν κοινό SSoT.
 *
 * ⚠️ ADR-294 (lazy routes): εδώ μπαίνει ΜΟΝΟ ό,τι χρειάζεται ΚΑΘΕ σελίδα
 * πωλήσεων. ΜΗΝ προσθέσεις εδώ βαριά ή ειδικά ανά σελίδα modules —
 * `SalesSpaceSidebar` (μόνο parking/storage) και `use-sales-properties-list-page`
 * (μόνο ακίνητα, σέρνει το Firestore state των ακινήτων) μένουν εκτός επίτηδες:
 * ένα barrel τα θα τα έσερνε στο chunk κάθε σελίδας.
 *
 * @module components/sales/shared
 */

export { SalesListPageShell } from './sales-list-page-shell';
export type {
  SalesListPageChrome,
  SalesListPageLabels,
  SalesListPageShellProps,
} from './sales-list-page-shell';

export { SalesCardGrid } from './SalesCardGrid';

export { SALES_STAT_EMPTY, salesMoneyValue, salesPerSqmValue } from './sales-stat-values';

export {
  mapCommonSpaceFilters,
  salesSpaceCardPricing,
  salesSpaceSidebarProps,
} from './sales-space-page';
export type {
  SalesSpaceAdvancedFilters,
  SalesSpaceCardPricing,
  SalesSpaceSidebarProps,
  SalesSpaceSidebarState,
} from './sales-space-page';
