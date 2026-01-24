'use client';

/**
 * 🏢 ENTERPRISE PropertiesHeader
 * Centralized header component for Properties page
 * Uses PageHeader from @/core/headers - ZERO hardcoded values
 *
 * @author Claude (Anthropic AI)
 * @date 2026-01-24
 * @compliance Fortune 500 standards - CLAUDE.md compliant
 */

import React from 'react';
import { Filter } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ViewMode as CoreViewMode } from '@/core/headers';

export type PropertiesViewMode = 'list' | 'grid';

interface PropertiesHeaderProps {
  /** Current view mode */
  viewMode: PropertiesViewMode;
  /** View mode change handler */
  setViewMode: (mode: PropertiesViewMode) => void;
  /** Dashboard visibility state */
  showDashboard: boolean;
  /** Dashboard toggle handler */
  setShowDashboard: (show: boolean) => void;
  /** Search term */
  searchTerm: string;
  /** Search term change handler */
  setSearchTerm: (term: string) => void;
  /** Available properties count for subtitle */
  availableCount?: number;
  /** Mobile filter toggle state */
  showFilters?: boolean;
  /** Mobile filter toggle handler */
  setShowFilters?: (show: boolean) => void;
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
  const { t } = useTranslation('properties');
  const { t: tCommon } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();

  // Dynamic subtitle with count
  const subtitle = availableCount !== undefined
    ? t('grid.header.found', { count: availableCount })
    : t('header.subtitle');

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: NAVIGATION_ENTITIES.unit.icon,
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
        viewMode: viewMode as CoreViewMode,
        onViewModeChange: (mode) => setViewMode(mode as PropertiesViewMode),
        viewModes: ['list', 'grid'] as CoreViewMode[],
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
            aria-label={tCommon('actions.toggleFilters')}
          >
            <Filter className={iconSizes.sm} />
          </button>
        ] : undefined
      }}
    />
  );
}
