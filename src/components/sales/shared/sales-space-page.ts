/**
 * =============================================================================
 * SALES SPACE PAGE — SSoT για ό,τι μοιράζονται οι σελίδες βοηθητικών χώρων
 * =============================================================================
 *
 * Οι σελίδες στάθμευσης και αποθηκών δεν είναι απλώς «παρόμοιες»: τρέχουν πάνω
 * στο ΙΔΙΟ generic `useSalesSpaceViewerState` και ταΐζουν το ΙΔΙΟ
 * `SalesSpaceSidebar`. Άρα το πέρασμα κατάστασης→sidebar, η τιμολόγηση της
 * κάρτας και η αντιστοίχιση των κοινών φίλτρων είναι μία απόφαση, όχι δύο.
 *
 * Εδώ ζει ΜΟΝΟ αυτό το κοινό. Ό,τι ανήκει σε έναν χώρο (η ζώνη του parking, το
 * εμβαδόν της αποθήκης) μένει στη σελίδα του.
 *
 * @module components/sales/shared/sales-space-page
 * @see @/hooks/sales/useSalesSpaceViewerState — η κοινή κατάσταση (ADR-199)
 * @see SalesSpaceSidebar.tsx — το κοινό sidebar που δέχεται αυτά τα props
 */

import type { SalesSpaceItem } from '@/types/sales-shared';

/** Το κομμάτι της κατάστασης που ταΐζει το sidebar ενός βοηθητικού χώρου. */
export interface SalesSpaceSidebarState<TItem extends SalesSpaceItem> {
  filteredItems: TItem[];
  selectedItem: TItem | null;
  selectedItemId: string | null;
  handleSelectItem: (itemId: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
}

/** Το props contract που μοιράζονται `SalesParkingSidebar` και `SalesStorageSidebar`. */
export interface SalesSpaceSidebarProps<TItem extends SalesSpaceItem> {
  items: TItem[];
  selectedItem: TItem | null;
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
}

/** Κατάσταση → props sidebar. Μία μετονομασία, όχι δύο αντίγραφα. */
export function salesSpaceSidebarProps<TItem extends SalesSpaceItem>(
  state: SalesSpaceSidebarState<TItem>
): SalesSpaceSidebarProps<TItem> {
  return {
    items: state.filteredItems,
    selectedItem: state.selectedItem,
    onSelectItem: state.handleSelectItem,
    selectedItemId: state.selectedItemId,
    selectedStatus: state.selectedStatus,
    onStatusChange: state.setSelectedStatus,
    selectedType: state.selectedType,
    onTypeChange: state.setSelectedType,
  };
}

/** Οι τιμές που δείχνει η κάρτα ενός βοηθητικού χώρου. */
export interface SalesSpaceCardPricing {
  price: number | null;
  pricePerSqm: number | null;
}

/**
 * Η εμπορική τιμή κατισχύει της βασικής· η τιμή/τ.μ. υπάρχει μόνο όταν υπάρχουν
 * ΚΑΙ τιμή ΚΑΙ θετικό εμβαδόν (αλλιώς θα ήταν διαίρεση με το μηδέν ή ψέμα).
 */
export function salesSpaceCardPricing(item: SalesSpaceItem): SalesSpaceCardPricing {
  const price = item.commercial?.askingPrice ?? item.price ?? null;
  const hasArea = typeof item.area === 'number' && item.area > 0;

  return {
    price,
    pricePerSqm: hasArea && price ? price / (item.area as number) : null,
  };
}

/** Η μορφή των φίλτρων του `AdvancedFiltersPanel` που διαβάζουν και οι δύο χώροι. */
export interface SalesSpaceAdvancedFilters {
  searchTerm?: string;
  building?: string[];
  floor?: string[];
  type?: string[];
}

/** Τα φίλτρα του panel (πολλαπλή επιλογή) → η κατάσταση της σελίδας (μονή τιμή). */
export function mapCommonSpaceFilters(adv: SalesSpaceAdvancedFilters) {
  return {
    searchTerm: adv.searchTerm || '',
    building: adv.building?.[0] || 'all',
    floor: adv.floor?.[0] || 'all',
    type: adv.type?.[0] || 'all',
  };
}
