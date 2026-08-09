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

import { priceSortKey } from '@/lib/properties/price-resolver';
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
 * Ποια τιμή δείχνεται είναι κανόνας του `price-resolver` (ADR-777 Α6) — εδώ
 * μόνο συνδυάζεται με το εμβαδόν. Η τιμή/τ.μ. υπάρχει μόνο όταν υπάρχουν ΚΑΙ
 * τιμή ΚΑΙ θετικό εμβαδόν (αλλιώς θα ήταν διαίρεση με το μηδέν ή ψέμα).
 *
 * @see lib/properties/price-resolver — ο ΕΝΑΣ κανόνας τιμής
 */
export function salesSpaceCardPricing(item: SalesSpaceItem): SalesSpaceCardPricing {
  const price = priceSortKey(item);
  const hasArea = typeof item.area === 'number' && item.area > 0;

  return {
    price,
    pricePerSqm: hasArea && price ? price / (item.area as number) : null,
  };
}

// =============================================================================
// ΚΑΤΑΣΤΑΣΗ → ΣΗΜΑΝΣΗ
// =============================================================================

export type SalesSpaceBadgeVariant =
  | 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

/**
 * Το variant κάθε κατάστασης — ΚΟΙΝΟ, ό,τι κι αν είναι ο χώρος.
 *
 * «Πουλημένο» δεν βάφεται αλλιώς επειδή τυχαίνει να είναι αποθήκη αντί για
 * θέση στάθμευσης. Ζούσε δύο φορές (μία σε κάθε κάρτα) και μπορούσε να
 * αποκλίνει σιωπηλά — ο χρήστης θα έβλεπε το ίδιο νόημα με δύο χρώματα.
 */
const STATUS_VARIANT: Record<string, SalesSpaceBadgeVariant> = {
  available: 'success',
  occupied: 'info',
  reserved: 'warning',
  sold: 'destructive',
  maintenance: 'secondary',
  unavailable: 'default',
};

export interface SalesSpaceBadge {
  label: string;
  variant: SalesSpaceBadgeVariant;
}

/**
 * Η σήμανση κατάστασης μιας κάρτας βοηθητικού χώρου.
 *
 * @param namespace — το i18n namespace του χώρου (`'parking'` | `'storage'`)
 * @param status — η κατάσταση· άγνωστη πέφτει στη «διαθέσιμη», όπως πριν
 * @param t — ο μεταφραστής του καλούντος
 */
export function salesSpaceStatusBadge(
  namespace: string,
  status: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): SalesSpaceBadge {
  return {
    label: t(`${namespace}:status.${status}`, { defaultValue: status }),
    variant: STATUS_VARIANT[status] ?? STATUS_VARIANT.available,
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
