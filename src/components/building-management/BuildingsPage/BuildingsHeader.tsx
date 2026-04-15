'use client';

/**
 * [ENTERPRISE] BuildingsHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React from 'react';
import { Filter, Trash2 } from 'lucide-react';
// [ENTERPRISE] Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
// [ENTERPRISE] Breadcrumb from centralized navigation
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageHeader } from '@/core/headers';
import type { ViewMode } from '@/core/headers';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
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
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick, radius, getStatusBorder } = useBorderTokens();

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
        customActions: [
          ...(setShowFilters ? [
            <button
              key="mobile-filter"
              onClick={() => setShowFilters(!showFilters)}
              className={`md:hidden p-2 ${radius.md} ${TRANSITION_PRESETS.STANDARD_COLORS} ${
                showFilters
                  ? `bg-primary text-primary-foreground ${quick.focus}`
                  : `${colors.bg.primary} ${quick.input} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`
              }`}
              aria-label="Toggle filters"
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
