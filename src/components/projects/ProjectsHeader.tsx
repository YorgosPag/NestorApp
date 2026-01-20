'use client';

/**
 * 🏢 ENTERPRISE ProjectsHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React from 'react';
import { Filter } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageHeader } from '@/core/headers';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import type { ViewMode } from '@/core/headers';
// 🏢 ENTERPRISE: Breadcrumb navigation
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ProjectsHeaderProps {
  viewMode: 'list' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'byType' | 'byStatus') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  onNewProject?: () => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  // 🏢 ENTERPRISE COUNT DISPLAY
  projectCount?: number;
}

// 🏢 ENTERPRISE: Type for Projects view modes (avoids `as any`)
type ProjectsViewMode = 'list' | 'byType' | 'byStatus';

export function ProjectsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  onNewProject,
  showFilters,
  setShowFilters,
  projectCount,
}: ProjectsHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Dynamic title with optional count
  const headerTitle = projectCount !== undefined
    ? t('header.titleWithCount', { count: projectCount })
    : t('header.title');

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: NAVIGATION_ENTITIES.building.icon,
        title: headerTitle,
        subtitle: t('header.subtitle')
      }}
      breadcrumb={<NavigationBreadcrumb />}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as ProjectsViewMode),
        viewModes: ['list', 'byType', 'byStatus'] as ViewMode[],
        addButton: {
          label: t('header.newProject'),
          onClick: () => onNewProject?.() || console.log('Add project')
        },
        // Mobile-only filter button
        customActions: setShowFilters ? [
          <button
            key="mobile-filter"
            onClick={() => setShowFilters(!showFilters)}
            className={`md:hidden p-2 ${quick.button} transition-colors ${
              showFilters
                ? `bg-primary text-primary-foreground ${getStatusBorder('default')}`
                : `${colors.bg.primary} ${quick.card} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`
            }`}
            aria-label={t('filters.toggleFilters')}
          >
            <Filter className={iconSizes.sm} />
          </button>
        ] : undefined
      }}
    />
  );
}
