'use client';

/**
 * 🏢 ENTERPRISE UnitsHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React from 'react';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { Filter } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// 🏢 ENTERPRISE: Breadcrumb from centralized navigation
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ViewMode as CoreViewMode } from '@/core/headers';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

export type UnitsViewMode = 'list' | 'grid';

interface UnitsHeaderProps {
  viewMode: UnitsViewMode;
  setViewMode: (mode: UnitsViewMode) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onNewUnit?: () => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
}

export function UnitsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  onNewUnit,
  showFilters,
  setShowFilters,
}: UnitsHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('units');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  return (
    <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        title={{
          icon: NAVIGATION_ENTITIES.unit.icon,
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
          viewMode: viewMode as CoreViewMode,
          onViewModeChange: (mode) => setViewMode(mode as UnitsViewMode),
          viewModes: ['list', 'grid'] as CoreViewMode[],
          addButton: {
            label: t('header.newUnit'),
            onClick: () => onNewUnit?.()
          },
          // Mobile-only filter button
          customActions: setShowFilters ? [
            <button
              key="mobile-filter"
              onClick={() => setShowFilters(!showFilters)}
              className={`md:hidden ${spacing.padding.sm} rounded-md ${TRANSITION_PRESETS.STANDARD_COLORS} ${
                showFilters
                  ? `bg-primary text-primary-foreground ${quick.focus}`
                  : `${colors.bg.primary} ${quick.input} ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`
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