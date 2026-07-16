'use client';

/**
 * @fileoverview Sales Available Units Header — ADR-197
 * @description PageHeader for "Διαθέσιμες Μονάδες" sales page
 * @pattern Reuses centralized PageHeader (same as UnitsHeader)
 *
 * Το κουμπί φίλτρων έρχεται από το `buildHeaderCustomActions`
 * (SSoT, ADR-584 / N.18) — ΜΗΝ το ξαναγράψεις inline εδώ.
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { PageHeader, buildHeaderCustomActions, LIST_GRID_VIEW_MODES } from '@/core/headers';
import type { ListGridHeaderProps, ListGridViewMode } from '@/core/headers';
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

/** Λίστα/πλέγμα χωρίς κάδο + τα overrides αυτής της σελίδας. */
interface SalesAvailableHeaderProps extends ListGridHeaderProps {
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
  const { t } = useTranslation(COMMON_NAMESPACES);

  const customActions = buildHeaderCustomActions({
    showFilters,
    setShowFilters,
    filtersAriaLabel: t('sales.available.filters.toggle'),
    // Αυτή η σελίδα δεν έχει κάδο — χωρίς `onToggleTrash` το κουμπί δεν αποδίδεται.
  });

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
        placeholder: searchPlaceholderOverride ?? t('sales.available.searchPlaceholder'),
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode,
        onViewModeChange: (mode) => setViewMode(mode as ListGridViewMode),
        viewModes: LIST_GRID_VIEW_MODES,
        addButton: onAddToMarket
          ? { label: t('sales.available.addToMarket'), onClick: onAddToMarket }
          : undefined,
        customActions: customActions.length > 0 ? customActions : undefined,
      }}
    />
  );
}
