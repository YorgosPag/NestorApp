'use client';

/**
 * 🏢 ENTERPRISE PropertiesHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 *
 * Τα κουμπιά φίλτρων/κάδου έρχονται από το `buildHeaderCustomActions`
 * (SSoT, ADR-584 / N.18) — ΜΗΝ τα ξαναγράψεις inline εδώ.
 */

import React from 'react';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { PageHeader, buildHeaderCustomActions, LIST_GRID_VIEW_MODES } from '@/core/headers';
import type { ListGridViewMode, ListPageHeaderProps } from '@/core/headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// 🏢 ENTERPRISE: Breadcrumb from centralized navigation
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

/** Λίστα/πλέγμα + κάδος — το κοινό contract, χωρίς επανάληψη. */
type PropertiesHeaderProps = ListPageHeaderProps<ListGridViewMode>;

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
}: PropertiesHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const { t: tViewer } = useTranslation('properties-viewer');
  const { t: tCommon } = useTranslation(COMMON_NAMESPACES);

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: NAVIGATION_ENTITIES.property.icon,
        title: t('header.title'),
        subtitle: t('header.subtitle')
      }}
      // 🏢 ENTERPRISE: Breadcrumb για ιεραρχική πλοήγηση
      breadcrumb={<NavigationBreadcrumb />}
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: t('header.searchPlaceholder')
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode,
        onViewModeChange: (mode) => setViewMode(mode as ListGridViewMode),
        viewModes: LIST_GRID_VIEW_MODES,
        customActions: buildHeaderCustomActions({
          showFilters,
          setShowFilters,
          filtersAriaLabel: tCommon('actions.toggleFilters'),
          showTrash,
          onToggleTrash,
          trashCount,
          trashAriaLabel: tViewer('trash.viewTrash'),
        }),
      }}
    />
  );
}
