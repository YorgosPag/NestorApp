'use client';

/**
 * 🏢 ENTERPRISE ProjectsHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React from 'react';
import { Filter, Trash2 } from 'lucide-react';
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
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const _logger = createModuleLogger('ProjectsHeader');

// 🏢 ENTERPRISE: Added 'grid' view mode for card grid layout (PR: Projects Grid View)
type ProjectsViewMode = 'list' | 'grid' | 'byType' | 'byStatus';

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

// 🏢 ENTERPRISE: Type moved to interface section above

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
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

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
        viewModes: ['list', 'grid', 'byType', 'byStatus'] as ViewMode[],
        // addButton removed — project creation is not available from this page
        // Mobile-only filter button
        customActions: [
          ...(setShowFilters ? [
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
          ] : []),
          ...(onToggleTrash ? [
            <button
              key="trash-toggle"
              onClick={onToggleTrash}
              className={`relative p-2 ${quick.button} transition-colors ${
                showTrash
                  ? `bg-destructive/10 text-destructive ${getStatusBorder('default')}`
                  : `${colors.bg.primary} ${quick.card} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`
              }`}
              aria-label={t('trashView', { ns: 'trash' })}
              aria-pressed={showTrash}
            >
              <Trash2 className={iconSizes.sm} />
              {trashCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground leading-none">
                  {trashCount > 99 ? '99+' : trashCount}
                </span>
              )}
            </button>
          ] : []),
        ].filter(Boolean)
      }}
    />
  );
}
