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
