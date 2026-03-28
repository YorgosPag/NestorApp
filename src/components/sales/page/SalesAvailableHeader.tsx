'use client';

/**
 * @fileoverview Sales Available Units Header — ADR-197
 * @description PageHeader for "Διαθέσιμες Μονάδες" sales page
 * @pattern Reuses centralized PageHeader (same as UnitsHeader)
 */

import React from 'react';
import { Filter, ShoppingBag } from 'lucide-react';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { PageHeader } from '@/core/headers';
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import type { ViewMode as CoreViewMode } from '@/core/headers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export type SalesViewMode = 'list' | 'grid';

interface SalesAvailableHeaderProps {
  viewMode: SalesViewMode;
  setViewMode: (mode: SalesViewMode) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  onAddToMarket?: () => void;
  /** Override the default "Διαθέσιμες Μονάδες" title */
  titleOverride?: string;
  /** Override the default subtitle */
  subtitleOverride?: string;
  /** Override search placeholder */
  searchPlaceholderOverride?: string;
}

export function SalesAvailableHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  showFilters,
  setShowFilters,
  onAddToMarket,
  titleOverride,
  subtitleOverride,
  searchPlaceholderOverride,
}: SalesAvailableHeaderProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();

  // Build custom actions: mobile filter + add to market
  const customActions: React.ReactNode[] = [];

  // Mobile filter toggle
  if (setShowFilters) {
    customActions.push(
      <button
        key="mobile-filter"
        onClick={() => setShowFilters(!showFilters)}
        className={`md:hidden ${spacing.padding.sm} rounded-md ${TRANSITION_PRESETS.STANDARD_COLORS} ${
          showFilters
            ? `bg-primary text-primary-foreground ${quick.focus}`
            : `${colors.bg.primary} ${quick.input} ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`
        }`}
        aria-label={t('sales.available.filters.toggle')}
      >
        <Filter className={iconSizes.sm} />
      </button>
    );
  }

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: ShoppingBag,
        title: titleOverride ?? t('sales.available.title'),
        subtitle: subtitleOverride ?? t('sales.available.subtitle'),
      }}
      breadcrumb={<NavigationBreadcrumb />}
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: searchPlaceholderOverride ?? t('sales.available.searchPlaceholder', { defaultValue: 'Αναζήτηση μονάδας...' }),
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as CoreViewMode,
        onViewModeChange: (mode) => setViewMode(mode as SalesViewMode),
        viewModes: ['list', 'grid'] as CoreViewMode[],
        addButton: onAddToMarket
          ? { label: t('sales.available.addToMarket', { defaultValue: 'Προσθήκη στην αγορά' }), onClick: onAddToMarket }
          : undefined,
        customActions: customActions.length > 0 ? customActions : undefined,
      }}
    />
  );
}
