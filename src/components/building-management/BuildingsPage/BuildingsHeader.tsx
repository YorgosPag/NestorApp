'use client';

/**
 * [ENTERPRISE] BuildingsHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React from 'react';
// [ENTERPRISE] Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
// [ENTERPRISE] Breadcrumb from centralized navigation
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { PageHeader, buildHeaderCustomActions } from '@/core/headers';
import type { ViewMode } from '@/core/headers';
// [ENTERPRISE] i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('BuildingsHeader');

// [ENTERPRISE] Type for Buildings view modes (avoids `any`)
type BuildingsViewMode = 'list' | 'grid' | 'byType' | 'byStatus';

interface BuildingsHeaderProps {
  viewMode: BuildingsViewMode;
  setViewMode: (mode: BuildingsViewMode) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  onNewBuilding?: () => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  // Trash view toggle (ADR-308)
  showTrash?: boolean;
  onToggleTrash?: () => void;
  trashCount?: number;
}

export function BuildingsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  onNewBuilding,
  showFilters,
  setShowFilters,
  showTrash,
  onToggleTrash,
  trashCount = 0,
}: BuildingsHeaderProps) {
  // [ENTERPRISE] i18n hook
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline', 'trash']);

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: NAVIGATION_ENTITIES.building.icon,
        title: t('header.title'),
        subtitle: t('header.subtitle')
      }}
      // [ENTERPRISE] Breadcrumb for hierarchical navigation
      breadcrumb={<NavigationBreadcrumb />}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as BuildingsViewMode),
        viewModes: ['list', 'grid', 'byType', 'byStatus'] as ViewMode[],
        addButton: {
          label: t('header.newBuilding'),
          onClick: () => onNewBuilding?.() || logger.info('Add building')
        },
        customActions: buildHeaderCustomActions({
          showFilters,
          setShowFilters,
          // N.11: ήταν hardcoded «Toggle filters» — τώρα από τα locales.
          filtersAriaLabel: t('accessibility.toggleFilters', { ns: 'building' }),
          showTrash,
          onToggleTrash,
          trashCount,
          trashAriaLabel: t('trashView', { ns: 'trash' }),
        })
      }}
    />
  );
}
