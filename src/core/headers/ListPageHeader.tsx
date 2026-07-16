'use client';

/**
 * 🏢 LIST PAGE HEADER — SSoT (ADR-584 / N.18)
 *
 * Το πλήρες header μιας σελίδας-λίστας οντοτήτων: τίτλος + εικονίδιο,
 * breadcrumb, αναζήτηση, εναλλαγή προβολής/dashboard και τα κουμπιά
 * φίλτρων/κάδου.
 *
 * `ParkingsHeader` και `StoragesHeader` ήταν ΤΟ ΙΔΙΟ component γραμμένο δύο
 * φορές — διέφεραν μόνο σε εικονίδιο, i18n namespaces και prefix κλειδιών.
 * Πλέον είναι λεπτά wrappers που δίνουν εικονίδιο + έτοιμα labels.
 *
 * ⚠️ Ο καλών κάνει το i18n resolve, ΟΧΙ αυτό το component: κάθε οντότητα έχει
 * δικά της namespaces (`storage` vs `building*`) και το CHECK 3.8 πρέπει να
 * βλέπει τα `t()` calls στο αρχείο που τα κατέχει.
 *
 * ℹ️ Το `BuildingsHeader` ΔΕΝ το χρησιμοποιεί: έχει `addButton` και δεν έχει
 * αναζήτηση → άλλο contract. Μοιράζεται μόνο το `buildHeaderCustomActions`.
 *
 * @see list-page-header-props.ts — το props contract
 * @see header-custom-actions.tsx — τα κουμπιά φίλτρων/κάδου
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
// Απευθείας relative imports — μέσω του barrel (`@/core/headers`) θα γινόταν κύκλος.
import { PageHeader } from './enterprise-system';
import type { ViewMode } from './enterprise-system';
import { buildHeaderCustomActions } from './header-custom-actions';
import type { ListPageHeaderProps } from './list-page-header-props';

/** Τα έτοιμα (ήδη μεταφρασμένα) κείμενα του header. */
export interface ListPageHeaderLabels {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  filtersAriaLabel: string;
  trashAriaLabel: string;
}

export interface ListPageHeaderComponentProps extends ListPageHeaderProps {
  icon: LucideIcon;
  labels: ListPageHeaderLabels;
}

const LIST_PAGE_VIEW_MODES: ViewMode[] = ['list', 'grid', 'byType', 'byStatus'];

export function ListPageHeader({
  icon,
  labels,
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  showFilters,
  setShowFilters,
  showTrash,
  onToggleTrash,
  trashCount = 0,
}: ListPageHeaderComponentProps) {
  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{ icon, title: labels.title, subtitle: labels.subtitle }}
      breadcrumb={<NavigationBreadcrumb />}
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: labels.searchPlaceholder,
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode,
        onViewModeChange: setViewMode,
        viewModes: LIST_PAGE_VIEW_MODES,
        customActions: buildHeaderCustomActions({
          showFilters,
          setShowFilters,
          filtersAriaLabel: labels.filtersAriaLabel,
          showTrash,
          onToggleTrash,
          trashCount,
          trashAriaLabel: labels.trashAriaLabel,
        }),
      }}
    />
  );
}
