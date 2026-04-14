'use client';

/**
 * 🏢 ENTERPRISE PropertiesHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React from 'react';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { Filter, Trash2 } from 'lucide-react';
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
import '@/lib/design-system';

export type PropertiesViewMode = 'list' | 'grid';

interface PropertiesHeaderProps {
  viewMode: PropertiesViewMode;
  setViewMode: (mode: PropertiesViewMode) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  // Trash view toggle
  showTrash?: boolean;
  onToggleTrash?: () => void;
  trashCount?: number;
}

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
          viewMode: viewMode as CoreViewMode,
          onViewModeChange: (mode) => setViewMode(mode as PropertiesViewMode),
          viewModes: ['list', 'grid'] as CoreViewMode[],
          // Trash toggle + mobile filter buttons
          customActions: [
            ...(onToggleTrash ? [
              <button
                key="trash-toggle"
                onClick={onToggleTrash}
                className={`relative ${spacing.padding.sm} rounded-md ${TRANSITION_PRESETS.STANDARD_COLORS} ${
                  showTrash
                    ? `bg-destructive/10 text-destructive border border-destructive/30`
                    : `${colors.bg.primary} ${quick.input} ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`
                }`}
                aria-label={tViewer('trash.viewTrash')}
                title={tViewer('trash.viewTrash')}
              >
                <Trash2 className={iconSizes.sm} />
                {(trashCount ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-medium">
                    {trashCount}
                  </span>
                )}
              </button>
            ] : []),
            ...(setShowFilters ? [
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
            ] : []),
          ].filter((x): x is React.ReactElement => Boolean(x)) || undefined
        }}
      />
  );
}

// Backward compatibility
export { PropertiesHeader as UnitsHeader };
export type { PropertiesViewMode as UnitsViewMode };