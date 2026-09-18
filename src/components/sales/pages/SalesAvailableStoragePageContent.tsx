'use client';

/**
 * @fileoverview Sales Available Storage — ADR-199
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 * @pattern Σκελετός: `sales-list-page-shell.tsx`· κοινά των βοηθητικών χώρων:
 *          `sales-space-page.ts` (SSoT, ADR-584/N.18). Εδώ ζει ΜΟΝΟ ό,τι είναι
 *          αποθήκη: τα στατιστικά της και το φίλτρο εμβαδού.
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { Suspense } from 'react';
import { useSalesStorageViewerState } from '@/hooks/sales/useSalesStorageViewerState';
import { SalesStorageSidebar } from '@/components/sales/SalesStorageSidebar';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { storageFiltersConfig, type StorageFilterState } from '@/components/core/AdvancedFilters';
import { Package, DollarSign, TrendingUp, Maximize2 } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { StaticPageLoading } from '@/core/states';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { priceTotalsView } from '@/lib/listings/listing-price-label';
import { SalesGridCard } from '@/components/sales/shared/SalesGridCard';
import {
  SalesCardGrid,
  SalesListPageShell,
  salesCardPricing,
  salesSpaceSidebarProps,
  useSalesSpacePanelFilters,
} from '@/components/sales/shared';
import '@/lib/design-system';

function SalesStorageContent() {
  const { t } = useTranslation(COMMON_NAMESPACES);

  const storageState = useSalesStorageViewerState();
  const { filteredItems, dashboardStats, filters, handleFiltersChange, handleSelectItem } = storageState;

  // Panel ⇄ σελίδα: ο ΚΟΙΝΟΣ μεταφραστής (εύρη τιμής ΜΕ μονάδα · εμβαδόν · κατάσταση).
  const { panelFilters, onPanelFiltersChange } = useSalesSpacePanelFilters(filters, handleFiltersChange);

  const unifiedDashboardStats: DashboardStat[] = [
    {
      title: t('salesStorage.stats.available'),
      value: dashboardStats.availableCount,
      description: t('salesStorage.stats.forSaleNow'),
      icon: Package,
      color: 'orange',
    },
    {
      title: t('salesStorage.stats.avgPrice'),
      ...priceTotalsView(t, dashboardStats.priceTotals, 'average'),
      description: t('salesStorage.stats.avgPriceDesc'),
      icon: DollarSign,
      color: 'green',
    },
    {
      title: t('salesStorage.stats.totalValue'),
      ...priceTotalsView(t, dashboardStats.priceTotals, 'total'),
      description: t('salesStorage.stats.totalValueDesc'),
      icon: TrendingUp,
      color: 'purple',
    },
    {
      title: t('salesStorage.stats.avgPricePerSqm'),
      ...priceTotalsView(t, dashboardStats.priceTotals, 'perArea'),
      description: t('salesStorage.stats.avgPricePerSqmDesc'),
      icon: Maximize2,
      color: 'blue',
    },
  ];

  return (
    <SalesListPageShell
      labels={{
        title: t('salesStorage.pageTitle'),
        subtitle: t('salesStorage.pageSubtitle'),
        searchPlaceholder: t('salesStorage.searchPlaceholder'),
      }}
      loading={storageState.loading}
      loadingIcon={NAVIGATION_ENTITIES.storage.icon}
      loadingMessage={t('salesStorage.loading')}
      chrome={storageState}
      stats={unifiedDashboardStats}
      onSearchChange={searchTerm => handleFiltersChange({ searchTerm })}
      filtersConfig={storageFiltersConfig}
      filters={panelFilters as unknown as StorageFilterState}
      onFiltersChange={onPanelFiltersChange}
      renderList={() => <SalesStorageSidebar {...salesSpaceSidebarProps(storageState)} />}
      renderGrid={() => (
        <SalesCardGrid
          items={filteredItems}
          ariaLabel={t('salesStorage.gridLabel')}
          emptyMessage={t('salesStorage.noResults')}
          renderCard={item => (
            <SalesGridCard
              key={item.id}
              id={item.id}
              icon={Package}
              title={item.name || item.id}
              statusKey={item.status ?? 'available'}
              statusLabel={t(`storage:status.${item.status}`)}
              description={`${t(`storage:types.${item.type}`)} · ${item.area ?? '—'} m²`}
              {...salesCardPricing(item, t)}
              onClick={handleSelectItem}
            />
          )}
        />
      )}
    />
  );
}

export function SalesAvailableStoragePageContent() {
  return (
    <Suspense fallback={<StaticPageLoading icon={NAVIGATION_ENTITIES.storage.icon} />}>
      <SalesStorageContent />
    </Suspense>
  );
}

export default SalesAvailableStoragePageContent;
