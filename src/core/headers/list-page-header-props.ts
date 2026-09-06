/**
 * 🏢 LIST PAGE HEADER PROPS — SSoT (ADR-584 / N.18)
 *
 * Το κοινό props contract των headers που οδηγούν μια σελίδα-λίστα οντοτήτων:
 * εναλλαγή προβολής, αναζήτηση, dashboard toggle και κάδος (ADR-281/ADR-308).
 *
 * Ήταν αντιγραμμένο αυτούσιο σε `ParkingsHeader` / `StoragesHeader` και — μετά
 * το πέρασμα της Ομάδας Β — σε `properties/page` / `property-management/page` /
 * `sales/page`. Δεν έχει τίποτα ειδικό ανά οντότητα, γι' αυτό ζει εδώ και όχι
 * σε κάποιο domain folder.
 *
 * ⚠️ Το view mode είναι το `ViewMode` του enterprise-system, ΟΧΙ δικός μας
 * τύπος: τα inline `'list' | 'grid' | 'byType' | 'byStatus'` των παλιών headers
 * ήταν αντίγραφο του ίδιου union, γι' αυτό χρειάζονταν `as ViewMode` casts.
 *
 * @see header-custom-actions.tsx — τα κουμπιά φίλτρων/κάδου του ίδιου contract
 * @see ListPageHeader.tsx — το component που καταναλώνει αυτό το contract
 */

import type { ViewMode } from './enterprise-system';

/**
 * Οι σελίδες που προσφέρουν μόνο λίστα/πλέγμα (properties, property-management,
 * sales). Ορίζεται ως `Extract` του `ViewMode` — ΟΧΙ ως ξεχωριστό
 * `'list' | 'grid'` union: έτσι είναι αποδεδειγμένα υποσύνολο του `ViewMode`,
 * περνά χωρίς cast στο `PageHeader`, και αν κάποτε μετονομαστεί ένα mode ο
 * compiler θα δείξει εδώ.
 */
export type ListGridViewMode = Extract<ViewMode, 'list' | 'grid'>;

/** Τα view modes μιας σελίδας λίστας/πλέγματος — SSoT για το `viewModes` prop. */
export const LIST_GRID_VIEW_MODES: ListGridViewMode[] = ['list', 'grid'];

/** Παράγεται από τον SSoT παραπάνω — ποτέ δεύτερη χειρόγραφη λίστα. */
const LIST_GRID_VIEW_MODE_SET: ReadonlySet<ViewMode> = new Set(LIST_GRID_VIEW_MODES);

/**
 * **Στενεύει ένα `ViewMode` στα δύο που προσφέρει μια σελίδα λίστας/πλέγματος.**
 *
 * 🔴 **Γιατί υπάρχει, και είναι μετρημένο** (ADR-842 §7.6.13): το σχόλιο αυτού του
 * αρχείου υποσχόταν ότι το {@link ListGridViewMode} *«περνά **χωρίς cast** στο
 * `PageHeader`»* — και **ισχύει μόνο κατά τη μία φορά**. Το `viewMode` και το
 * `viewModes` πηγαίνουν **προς τα έξω** (υποσύνολο ⇒ δεκτό), αλλά το
 * `onViewModeChange` έρχεται **προς τα μέσα**: ζητά χειριστή που δέχεται **και τα
 * τέσσερα** modes. Είναι η ανάστροφη κατεύθυνση, και εκεί ο υποτύπος **δεν** αρκεί.
 *
 * ⚠️ Το αποτέλεσμα ήταν ένα `as ListGridViewMode` αντιγραμμένο σε **τέσσερις**
 * headers — και το `as` δεν είναι απλώς άσχημο, **λέει ψέματα**: αν το `PageHeader`
 * έστελνε ποτέ `'byType'`, ο ισχυρισμός θα έβαζε τη σελίδα σε κατάσταση που η ίδια
 * **δεν προσφέρει**. Ο φρουρός ρωτά αντί να ισχυρίζεται.
 *
 * @example
 * onViewModeChange: (mode) => { if (isListGridViewMode(mode)) setViewMode(mode); }
 */
export function isListGridViewMode(mode: ViewMode): mode is ListGridViewMode {
  return LIST_GRID_VIEW_MODE_SET.has(mode);
}

/** Τα view modes μιας πλήρους σελίδας-λίστας (με ομαδοποιήσεις). */
export const LIST_PAGE_VIEW_MODES: ViewMode[] = ['list', 'grid', 'byType', 'byStatus'];

/**
 * @template TViewMode Στένεψέ το όταν η σελίδα δεν προσφέρει όλα τα modes
 *   (π.χ. `ListPageHeaderProps<ListGridViewMode>`). Το default καλύπτει τις
 *   σελίδες με πλήρη εναλλαγή.
 */
export interface ListPageHeaderProps<TViewMode extends ViewMode = ViewMode> {
  viewMode: TViewMode;
  setViewMode: (mode: TViewMode) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  /** Mobile-only filter toggle — το κουμπί αποδίδεται μόνο αν δοθεί setter. */
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  /** Trash view toggle (ADR-281) — το κουμπί αποδίδεται μόνο αν δοθεί handler. */
  showTrash?: boolean;
  onToggleTrash?: () => void;
  trashCount?: number;
}

/** Το contract μιας σελίδας λίστας/πλέγματος χωρίς κάδο. */
export type ListGridHeaderProps = Omit<
  ListPageHeaderProps<ListGridViewMode>,
  'showTrash' | 'onToggleTrash' | 'trashCount'
>;
