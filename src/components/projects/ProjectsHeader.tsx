'use client';

/**
 * 🏢 ENTERPRISE ProjectsHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 *
 * Τα κουμπιά φίλτρων/κάδου έρχονται από το `buildHeaderCustomActions`
 * (SSoT, ADR-584 / N.18) — ΜΗΝ τα ξαναγράψεις inline εδώ.
 */

import React from 'react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { PageHeader, buildHeaderCustomActions } from '@/core/headers';
import type { ViewMode } from '@/core/headers';
// 🏢 ENTERPRISE: Breadcrumb navigation
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const _logger = createModuleLogger('ProjectsHeader');

// 🏢 ENTERPRISE: Added 'grid' view mode for card grid layout (PR: Projects Grid View)
type ProjectsViewMode = 'list' | 'grid' | 'byType' | 'byStatus';

const PROJECTS_VIEW_MODES: ViewMode[] = ['list', 'grid', 'byType', 'byStatus'];

interface ProjectsHeaderProps {
  viewMode: ProjectsViewMode;
  setViewMode: (mode: ProjectsViewMode) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  onNewProject?: () => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  // Trash view toggle (ADR-308)
  showTrash?: boolean;
  onToggleTrash?: () => void;
  trashCount?: number;
}

export function ProjectsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  onNewProject: _onNewProject,
  showFilters,
  setShowFilters,
  showTrash,
  onToggleTrash,
  trashCount = 0,
}: ProjectsHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika', 'trash']);

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
      breadcrumb={<NavigationBreadcrumb />}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as ProjectsViewMode),
        // 🏢 ENTERPRISE: Added 'grid' for card grid layout (PR: Projects Grid View)
        viewModes: PROJECTS_VIEW_MODES,
        // addButton removed — project creation is not available from this page
        customActions: buildHeaderCustomActions({
          showFilters,
          setShowFilters,
          filtersAriaLabel: t('filters.toggleFilters'),
          showTrash,
          onToggleTrash,
          trashCount,
          trashAriaLabel: t('trashView', { ns: 'trash' }),
          // Το κουμπί εναλλάσσει νόημα → ρητό tooltip
          trashTooltip: showTrash
            ? t('backToList', { ns: 'trash' })
            : t('trashView', { ns: 'trash' }),
        }),
      }}
    />
  );
}
