'use client';

/**
 * @fileoverview Sales Available Properties — ADR-197
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 * @pattern Ο σκελετός ζει στο `sales-list-page-shell.tsx` και ο controller στο
 *          `use-sales-properties-list-page.ts` (SSoT, ADR-584/N.18). Εδώ μένει
 *          ΜΟΝΟ ό,τι διαφοροποιεί τα διαθέσιμα ακίνητα: τα στατιστικά της
 *          αγοράς και η κάρτα με τη «Sales Lens».
 */

import React, { Suspense } from 'react';
import { SalesSidebar } from '@/components/sales/sidebar/SalesSidebar';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { propertyListFiltersConfig, type UnitFilterState } from '@/components/core/AdvancedFilters';
import { ShoppingBag, DollarSign, TrendingUp, Maximize2 } from 'lucide-react';
import { StaticPageLoading } from '@/core/states';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  SalesCardGrid,
  SalesListPageShell,
  salesMoneyValue,
  salesPerSqmValue,
} from '@/components/sales/shared';
import { useSalesPropertiesListPage } from '@/components/sales/shared/use-sales-properties-list-page';
import { PropertyGridCard } from '@/domain/cards/property/PropertyGridCard';
import type { Property as ViewerProperty } from '@/types/property-viewer';
import '@/lib/design-system';

function SalesAvailableContent() {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation', 'properties-enums']);

  const { state, onAdvancedFiltersChange, sidebarProps } = useSalesPropertiesListPage();
  const { dashboardStats, filters, handleFiltersChange, handleSelectProperty } = state;

  const unifiedDashboardStats: DashboardStat[] = [
    {
      title: t('sales.available.stats.availableApartments'),
      value: dashboardStats.availableCount,
      description: t('sales.available.stats.forSaleNow'),
      icon: ShoppingBag,
      color: 'blue',
    },
    {
      title: t('sales.available.stats.avgPrice'),
      value: salesMoneyValue(dashboardStats.averagePrice),
      description: t('sales.available.stats.avgPriceDesc'),
      icon: DollarSign,
      color: 'green',
    },
    {
      title: t('sales.available.stats.totalValue'),
      value: salesMoneyValue(dashboardStats.totalValue),
      description: t('sales.available.stats.totalValueDesc'),
      icon: TrendingUp,
      color: 'purple',
    },
    {
      title: t('sales.available.stats.avgPricePerSqm'),
      value: salesPerSqmValue(dashboardStats.averagePricePerSqm),
      description: t('sales.available.stats.avgPricePerSqmDesc'),
      icon: Maximize2,
      color: 'orange',
    },
  ];

  return (
    <SalesListPageShell
      labels={{
        title: t('sales.available.title'),
        subtitle: t('sales.available.subtitle'),
        searchPlaceholder: t('sales.available.searchPlaceholder'),
      }}
      loading={state.loading}
      loadingIcon={ShoppingBag}
      loadingMessage={t('sales.available.loading')}
      chrome={state}
      stats={unifiedDashboardStats}
      onSearchChange={searchTerm => handleFiltersChange({ searchTerm })}
      filtersConfig={propertyListFiltersConfig}
      filters={filters as unknown as UnitFilterState}
      onFiltersChange={onAdvancedFiltersChange}
      renderList={() => <SalesSidebar {...sidebarProps} />}
      renderGrid={() => (
        <SalesCardGrid
          items={sidebarProps.units}
          ariaLabel={t('sales.available.gridLabel')}
          emptyMessage={t('sales.available.noResults')}
          renderCard={unit => (
            <PropertyGridCard
              key={unit.id}
              property={unit as unknown as ViewerProperty}
              onSelect={() => handleSelectProperty(unit.id)}
              showCommercialPrices
            />
          )}
        />
      )}
    />
  );
}

export function SalesAvailablePropertiesPageContent() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <SalesAvailableContent />
    </Suspense>
  );
}

export default SalesAvailablePropertiesPageContent;
