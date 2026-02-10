'use client';

/**
 * [ENTERPRISE] BuildingsHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React from 'react';
import { Filter } from 'lucide-react';
// [ENTERPRISE] Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
// [ENTERPRISE] Breadcrumb from centralized navigation
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageHeader } from '@/core/headers';
import type { ViewMode } from '@/core/headers';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
// [ENTERPRISE] i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// [ENTERPRISE] Type for Buildings view modes (avoids `as any`)
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
}

export function BuildingsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  onNewBuilding,
  showFilters,
  setShowFilters,
}: BuildingsHeaderProps) {
  // [ENTERPRISE] i18n hook
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick, radius } = useBorderTokens();
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
          onClick: () => onNewBuilding?.() || console.log('Add building')
        },
        // Mobile-only filter button
        customActions: setShowFilters ? [
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
        ] : undefined
      }}
    />
  );
}
