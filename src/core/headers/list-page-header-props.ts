/**
 * 🏢 LIST PAGE HEADER PROPS — SSoT (ADR-584 / N.18)
 *
 * Το κοινό props contract των headers που οδηγούν μια σελίδα-λίστα οντοτήτων:
 * εναλλαγή προβολής, αναζήτηση, dashboard toggle και κάδος (ADR-281/ADR-308).
 *
 * Ήταν αντιγραμμένο αυτούσιο σε `ParkingsHeader` / `StoragesHeader`. Δεν έχει
 * τίποτα ειδικό ανά οντότητα — γι' αυτό ζει εδώ και όχι σε κάποιο domain folder.
 *
 * ⚠️ Το view mode είναι το `ViewMode` του enterprise-system, ΟΧΙ δικός μας
 * τύπος: τα inline `'list' | 'grid' | 'byType' | 'byStatus'` των παλιών headers
 * ήταν αντίγραφο του ίδιου union, γι' αυτό χρειάζονταν `as ViewMode` casts.
 *
 * @see header-custom-actions.tsx — τα κουμπιά φίλτρων/κάδου του ίδιου contract
 * @see ListPageHeader.tsx — το component που καταναλώνει αυτό το contract
 */

import type { ViewMode } from './enterprise-system';

export interface ListPageHeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
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
