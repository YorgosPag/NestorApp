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
import { priceTotalsView } from '@/lib/listings/listing-price-label';
import { SalesSpaceGridCard } from '@/components/sales/shared/SalesSpaceGridCard';
import {
  SalesCardGrid,
  SalesListPageShell,
  salesSpaceSidebarProps,
  useSalesSpacePanelFilters,
} from '@/components/sales/shared';
import '@/lib/design-system';

function SalesParkingContent() {
  const { t } = useTranslation(COMMON_NAMESPACES);

  const parkingState = useSalesParkingViewerState();
  const { filteredItems, dashboardStats, filters, handleFiltersChange, handleSelectItem } = parkingState;

  // Panel ⇄ σελίδα: ο ΚΟΙΝΟΣ μεταφραστής (εύρη τιμής ΜΕ μονάδα · εμβαδόν · κατάσταση).
  const { panelFilters, onPanelFiltersChange } = useSalesSpacePanelFilters(filters, handleFiltersChange);

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
      ...priceTotalsView(t, dashboardStats.priceTotals, 'average'),
      description: t('salesParking.stats.avgPriceDesc'),
      icon: DollarSign,
      color: 'green',
    },
    {
      title: t('salesParking.stats.totalValue'),
      ...priceTotalsView(t, dashboardStats.priceTotals, 'total'),
      description: t('salesParking.stats.totalValueDesc'),
      icon: TrendingUp,
      color: 'purple',
    },
    {
      title: t('salesParking.stats.avgPricePerSqm'),
      ...priceTotalsView(t, dashboardStats.priceTotals, 'perArea'),
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
      filters={panelFilters as unknown as ParkingFilterState}
      onFiltersChange={onPanelFiltersChange}
      renderList={() => <SalesParkingSidebar {...salesSpaceSidebarProps(parkingState)} />}
      renderGrid={() => (
        <SalesCardGrid
          items={filteredItems}
          ariaLabel={t('salesParking.gridLabel')}
          emptyMessage={t('salesParking.noResults')}
          renderCard={item => {
            const zone = item.locationZone ? ` · ${t(`parking:locationZone.${item.locationZone}`)}` : '';
            return (
              <SalesSpaceGridCard
                key={item.id}
                item={item}
                icon={Car}
                title={item.number || item.id}
                description={`${t(`parking:types.${item.type ?? 'standard'}`)}${zone}`}
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
