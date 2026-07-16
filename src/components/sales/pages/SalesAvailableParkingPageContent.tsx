'use client';

/**
 * @fileoverview Sales Available Parking — ADR-199
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 * @pattern Σκελετός: `sales-list-page-shell.tsx`· κοινά των βοηθητικών χώρων:
 *          `sales-space-page.ts` (SSoT, ADR-584/N.18). Εδώ ζει ΜΟΝΟ ό,τι είναι
 *          στάθμευση: τα στατιστικά της, το φίλτρο κατάστασης και η ζώνη θέσης.
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { Suspense } from 'react';
import { useSalesParkingViewerState } from '@/hooks/sales/useSalesParkingViewerState';
import { SalesParkingSidebar } from '@/components/sales/SalesParkingSidebar';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { parkingFiltersConfig, type ParkingFilterState } from '@/components/core/AdvancedFilters';
import { Car, DollarSign, TrendingUp, Maximize2 } from 'lucide-react';
import { StaticPageLoading } from '@/core/states';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SalesGridCard } from '@/components/sales/shared/SalesGridCard';
import {
  SalesCardGrid,
  SalesListPageShell,
  mapCommonSpaceFilters,
  salesMoneyValue,
  salesPerSqmValue,
  salesSpaceCardPricing,
  salesSpaceSidebarProps,
} from '@/components/sales/shared';
import '@/lib/design-system';

function SalesParkingContent() {
  const { t } = useTranslation(COMMON_NAMESPACES);

  const parkingState = useSalesParkingViewerState();
  const { filteredItems, dashboardStats, filters, handleFiltersChange, handleSelectItem } = parkingState;

  const handleAdvancedFiltersChange = React.useCallback((adv: ParkingFilterState) => {
    handleFiltersChange({
      ...mapCommonSpaceFilters(adv),
      status: adv.status?.[0] || 'all',
    });
  }, [handleFiltersChange]);

  const unifiedDashboardStats: DashboardStat[] = [
    {
      title: t('salesParking.stats.available'),
      value: dashboardStats.availableCount,
      description: t('salesParking.stats.forSaleNow'),
      icon: Car,
      color: 'blue',
    },
    {
      title: t('salesParking.stats.avgPrice'),
      value: salesMoneyValue(dashboardStats.averagePrice),
      description: t('salesParking.stats.avgPriceDesc'),
      icon: DollarSign,
      color: 'green',
    },
    {
      title: t('salesParking.stats.totalValue'),
      value: salesMoneyValue(dashboardStats.totalValue),
      description: t('salesParking.stats.totalValueDesc'),
      icon: TrendingUp,
      color: 'purple',
    },
    {
      title: t('salesParking.stats.avgPricePerSqm'),
      value: salesPerSqmValue(dashboardStats.averagePricePerSqm),
      description: t('salesParking.stats.avgPricePerSqmDesc'),
      icon: Maximize2,
      color: 'orange',
    },
  ];

  return (
    <SalesListPageShell
      labels={{
        title: t('salesParking.pageTitle'),
        subtitle: t('salesParking.pageSubtitle'),
        searchPlaceholder: t('salesParking.searchPlaceholder'),
      }}
      loading={parkingState.loading}
      loadingIcon={Car}
      loadingMessage={t('salesParking.loading')}
      chrome={parkingState}
      stats={unifiedDashboardStats}
      onSearchChange={searchTerm => handleFiltersChange({ searchTerm })}
      filtersConfig={parkingFiltersConfig}
      filters={filters as unknown as ParkingFilterState}
      onFiltersChange={handleAdvancedFiltersChange}
      renderList={() => <SalesParkingSidebar {...salesSpaceSidebarProps(parkingState)} />}
      renderGrid={() => (
        <SalesCardGrid
          items={filteredItems}
          ariaLabel={t('salesParking.gridLabel')}
          emptyMessage={t('salesParking.noResults')}
          renderCard={item => {
            const zone = item.locationZone ? ` · ${t(`parking:locationZone.${item.locationZone}`)}` : '';
            return (
              <SalesGridCard
                key={item.id}
                id={item.id}
                icon={Car}
                title={item.number || item.id}
                statusKey={item.status ?? 'available'}
                statusLabel={t(`parking:status.${item.status ?? 'available'}`)}
                description={`${t(`parking:types.${item.type ?? 'standard'}`)}${zone}`}
                {...salesSpaceCardPricing(item)}
                onClick={handleSelectItem}
              />
            );
          }}
        />
      )}
    />
  );
}

export function SalesAvailableParkingPageContent() {
  return (
    <Suspense fallback={<StaticPageLoading icon={Car} />}>
      <SalesParkingContent />
    </Suspense>
  );
}

export default SalesAvailableParkingPageContent;
