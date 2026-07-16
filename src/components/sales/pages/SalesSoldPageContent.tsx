'use client';

/**
 * @fileoverview Sales Sold Properties — ADR-197 (sold scope)
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 * @pattern Είναι η σελίδα διαθέσιμων ακινήτων με `viewScope: 'sold'` — ίδιος
 *          controller (`use-sales-properties-list-page.ts`) και ίδιος σκελετός
 *          (`sales-list-page-shell.tsx`), ώστε η ροή του agent (προγράμματα
 *          αποπληρωμής, νομικά έγγραφα) να μένει συνεπής μετά την πώληση.
 *          Εδώ ζει ΜΟΝΟ η διαφορά: στατιστικά πωλήσεων, κάρτα πωλημένου και οι
 *          ετικέτες του sidebar.
 */

import React, { Suspense } from 'react';
import { SalesSidebar } from '@/components/sales/sidebar/SalesSidebar';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { propertyListFiltersConfig, type UnitFilterState } from '@/components/core/AdvancedFilters';
import { CheckCircle, DollarSign, TrendingUp, Maximize2 } from 'lucide-react';
import { StaticPageLoading } from '@/core/states';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SalesGridCard } from '@/components/sales/shared/SalesGridCard';
import {
  SalesCardGrid,
  SalesListPageShell,
  salesMoneyValue,
  salesPerSqmValue,
} from '@/components/sales/shared';
import { useSalesPropertiesListPage } from '@/components/sales/shared/use-sales-properties-list-page';
import '@/lib/design-system';

function SalesSoldContent() {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation', 'properties-enums']);

  const { state, onAdvancedFiltersChange, sidebarProps } = useSalesPropertiesListPage({ viewScope: 'sold' });
  const { dashboardStats, filters, handleFiltersChange, handleSelectProperty } = state;

  const unifiedDashboardStats: DashboardStat[] = [
    {
      title: t('sales.sold.stats.totalSales'),
      value: dashboardStats.availableCount,
      description: t('sales.sold.stats.completedSales'),
      icon: CheckCircle,
      color: 'green',
    },
    {
      title: t('sales.sold.stats.totalRevenue'),
      value: salesMoneyValue(dashboardStats.totalValue),
      description: t('sales.sold.stats.totalSalesValue'),
      icon: DollarSign,
      color: 'blue',
    },
    {
      title: t('sales.sold.stats.avgSalePrice'),
      value: salesMoneyValue(dashboardStats.averagePrice),
      description: t('sales.sold.stats.avgSalePriceDesc'),
      icon: TrendingUp,
      color: 'purple',
    },
    {
      title: t('sales.sold.stats.avgPricePerSqm'),
      value: salesPerSqmValue(dashboardStats.averagePricePerSqm),
      description: t('sales.sold.stats.avgPricePerSqmDesc'),
      icon: Maximize2,
      color: 'orange',
    },
  ];

  const sidebarLabels = {
    listTitle: t('sales.sold.listTitle'),
    listLabel: t('sales.sold.listLabel'),
    noResults: t('sales.sold.noResults'),
    unitDetails: t('sales.sold.unitDetails'),
  };

  return (
    <SalesListPageShell
      labels={{
        title: t('sales.sold.title'),
        subtitle: t('sales.sold.subtitle'),
        searchPlaceholder: t('sales.sold.searchPlaceholder'),
      }}
      loading={state.loading}
      loadingIcon={CheckCircle}
      loadingMessage={t('sales.sold.loading')}
      chrome={state}
      stats={unifiedDashboardStats}
      onSearchChange={searchTerm => handleFiltersChange({ searchTerm })}
      filtersConfig={propertyListFiltersConfig}
      filters={filters as unknown as UnitFilterState}
      onFiltersChange={onAdvancedFiltersChange}
      renderList={() => (
        <SalesSidebar {...sidebarProps} labels={sidebarLabels} hideCommercialStatusFilter />
      )}
      renderGrid={() => (
        <SalesCardGrid
          items={sidebarProps.units}
          ariaLabel={t('sales.sold.gridLabel')}
          emptyMessage={t('sales.sold.noResults')}
          renderCard={unit => {
            const area = unit.areas?.gross ?? unit.area ?? 0;
            const price = unit.commercial?.finalPrice ?? unit.commercial?.askingPrice ?? null;
            return (
              <SalesGridCard
                key={unit.id}
                id={unit.id}
                icon={CheckCircle}
                title={unit.name || unit.code || unit.id}
                statusKey={unit.commercialStatus ?? 'sold'}
                statusLabel={unit.commercialStatus
                  ? t(`sales.commercialStatus.${unit.commercialStatus}`)
                  : t('sales.commercialStatus.sold')}
                description={`${t(`properties-enums:types.${unit.type}`, { defaultValue: unit.type })} · ${area || '—'} m²`}
                price={price}
                pricePerSqm={price && area ? price / area : null}
                onClick={handleSelectProperty}
              />
            );
          }}
        />
      )}
    />
  );
}

export function SalesSoldPageContent() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <SalesSoldContent />
    </Suspense>
  );
}

export default SalesSoldPageContent;
