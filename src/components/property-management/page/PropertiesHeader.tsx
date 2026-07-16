'use client';

/**
 * 🏢 ENTERPRISE PropertiesHeader
 * Centralized header component for Properties page
 * Uses PageHeader from @/core/headers - ZERO hardcoded values
 *
 * Το κουμπί φίλτρων έρχεται από το `buildHeaderCustomActions`
 * (SSoT, ADR-584 / N.18) — ΜΗΝ το ξαναγράψεις inline εδώ.
 *
 * @author Claude (Anthropic AI)
 * @date 2026-01-24
 * @compliance Fortune 500 standards - CLAUDE.md compliant
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React from 'react';
import { PageHeader, buildHeaderCustomActions, LIST_GRID_VIEW_MODES } from '@/core/headers';
import type { ListGridHeaderProps, ListGridViewMode } from '@/core/headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

/** Λίστα/πλέγμα χωρίς κάδο — το κοινό contract + ό,τι είναι όντως δικό της. */
interface PropertiesHeaderProps extends ListGridHeaderProps {
  /** Available properties count for subtitle */
  availableCount?: number;
}

export function PropertiesHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  availableCount,
  showFilters,
  setShowFilters,
}: PropertiesHeaderProps) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const { t: tCommon } = useTranslation(COMMON_NAMESPACES);

  // Dynamic subtitle with count
  const subtitle = availableCount !== undefined
    ? t('grid.header.found', { count: availableCount })
    : t('header.subtitle');

  const customActions = buildHeaderCustomActions({
    showFilters,
    setShowFilters,
    filtersAriaLabel: tCommon('actions.toggleFilters'),
    // Αυτή η σελίδα δεν έχει κάδο — χωρίς `onToggleTrash` το κουμπί δεν αποδίδεται.
  });

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: NAVIGATION_ENTITIES.property.icon,
        title: t('grid.header.title'),
        subtitle
      }}
      breadcrumb={<NavigationBreadcrumb />}
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: t('grid.search.placeholder')
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode,
        onViewModeChange: (mode) => setViewMode(mode as ListGridViewMode),
        viewModes: LIST_GRID_VIEW_MODES,
        customActions: customActions.length > 0 ? customActions : undefined
      }}
    />
  );
}
