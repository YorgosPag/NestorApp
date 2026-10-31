'use client';

/**
 * 🏢 Η ΚΕΦΑΛΙΔΑ της ενιαίας οθόνης ακινήτων (ADR-840 Σ3).
 *
 * - **Τρεις όψεις** (πλέγμα · λίστα · κάτοψη) — η τιμή ζει στη διεύθυνση (`?view=`, `usePropertiesView`), όχι εδώ.
 * - **Αναζήτηση** = το φίλτρο `searchTerm` (`?q=`). Ήταν δεύτερο, τοπικό `useState` της παλιάς λίστας, που έψαχνε
 *   **άλλα** πεδία από το πάνελ φίλτρων: δύο κουτιά αναζήτησης στην ίδια οθόνη, με διαφορετικές απαντήσεις.
 * - Τα κουμπιά φίλτρων/κάδου/αρχείου έρχονται από το `buildHeaderCustomActions` (SSoT, ADR-584 / N.18) — ΜΗΝ τα
 *   ξαναγράψεις inline εδώ.
 */

import React from 'react';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { PageHeader, buildHeaderCustomActions } from '@/core/headers';
import type { ListPageHeaderProps } from '@/core/headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PROPERTIES_VIEW, PROPERTIES_VIEWS, type PropertiesView } from '@/lib/properties/property-filters-url';
import '@/lib/design-system';

/** Οι τρεις όψεις + κάδος + αρχείο (ADR-329 §3.9) — το κοινό contract, χωρίς επανάληψη. */
interface PropertiesHeaderProps extends ListPageHeaderProps<PropertiesView> {
  /** Πόσα ακίνητα δείχνει η οθόνη τώρα (μετά τα φίλτρα) — ο υπότιτλος. */
  visibleCount: number;
}

const HEADER_VIEW_MODES: PropertiesView[] = [...PROPERTIES_VIEWS];

export function PropertiesHeader({
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
  trashCount,
  showArchive,
  onToggleArchive,
  archiveCount,
  visibleCount,
}: PropertiesHeaderProps) {
  const { t } = useTranslation('properties');
  const { t: tViewer } = useTranslation('properties-viewer');
  const { t: tCommon } = useTranslation(COMMON_NAMESPACES);
  // Το «Αρχείο» λέγεται ίδια σε κάθε οντότητα ⇒ γενικό namespace `trash`, όχι κλειδί ανά σελίδα.
  const { t: tTrash } = useTranslation('trash');

  const retiredViewOpen = Boolean(showTrash || showArchive);

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: NAVIGATION_ENTITIES.property.icon,
        title: t('header.title'),
        subtitle: t('grid.header.found', { count: visibleCount }),
      }}
      breadcrumb={<NavigationBreadcrumb />}
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: t('grid.search.placeholder'),
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode,
        // Κάδος/αρχείο σκεπάζουν την οθόνη: καμία όψη δεν δείχνει πατημένη, και το κλικ σε όψη γυρίζει πίσω.
        viewModeSuspended: retiredViewOpen,
        onViewModeChange: (mode) => {
          if (!PROPERTIES_VIEW.is(mode)) return;
          if (showTrash) onToggleTrash?.();
          if (showArchive) onToggleArchive?.();
          setViewMode(mode);
        },
        viewModes: HEADER_VIEW_MODES,
        customActions: buildHeaderCustomActions({
          showFilters,
          setShowFilters,
          filtersAriaLabel: tCommon('actions.toggleFilters'),
          showTrash,
          onToggleTrash,
          trashCount,
          trashAriaLabel: tViewer('trash.viewTrash'),
          showArchive,
          onToggleArchive,
          archiveCount,
          archiveAriaLabel: tTrash('archiveView'),
        }),
      }}
    />
  );
}
