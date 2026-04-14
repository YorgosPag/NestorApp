'use client';

/**
 * @fileoverview Sales Available Storage — ADR-199
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 * @pattern Mirrors /sales/available-properties with storage-specific data
 */

import React, { Suspense } from 'react';
import { useSalesStorageViewerState } from '@/hooks/sales/useSalesStorageViewerState';
import { SalesAvailableHeader } from '@/components/sales/page/SalesAvailableHeader';
import { SalesStorageSidebar } from '@/components/sales/SalesStorageSidebar';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel, storageFiltersConfig, type StorageFilterState } from '@/components/core/AdvancedFilters';
import {
  Package,
  DollarSign,
  TrendingUp,
  Maximize2,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { ListContainer, PageContainer } from '@/core/containers';
import { PageLoadingState, StaticPageLoading } from '@/core/states';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyCompact, formatCurrencyWhole } from '@/lib/intl-utils';
import { SalesGridCard, SalesGridEmpty } from '@/components/sales/shared/SalesGridCard';
import '@/lib/design-system';

function SalesStorageContent() {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);

  const {
    filteredItems,
    loading,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    showFilters,
    setShowFilters,
    selectedItem,
    selectedItemId,
    handleSelectItem,
    filters,
    handleFiltersChange,
    selectedStatus,
    setSelectedStatus,
    selectedType,
    setSelectedType,
    dashboardStats,
  } = useSalesStorageViewerState();

  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    handleFiltersChange({ searchTerm });
  }, [searchTerm, handleFiltersChange]);

  const handleAdvancedFiltersChange = React.useCallback((adv: StorageFilterState) => {
    handleFiltersChange({
      searchTerm: adv.searchTerm || '',
      building: adv.building?.[0] || 'all',
      floor: adv.floor?.[0] || 'all',
      type: adv.type?.[0] || 'all',
      areaRange: {
        min: adv.ranges?.areaRange?.min ?? null,
        max: adv.ranges?.areaRange?.max ?? null,
      },
    });
  }, [handleFiltersChange]);

  if (loading) {
    return (
      <PageContainer ariaLabel={t('salesStorage.pageTitle')}>
        <PageLoadingState icon={NAVIGATION_ENTITIES.storage.icon} message={t('salesStorage.loading')} layout="contained" />
      </PageContainer>
    );
  }

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
      value: dashboardStats.averagePrice > 0 ? formatCurrencyCompact(dashboardStats.averagePrice) : '—',
      description: t('salesStorage.stats.avgPriceDesc'),
      icon: DollarSign,
      color: 'green',
    },
    {
      title: t('salesStorage.stats.totalValue'),
      value: dashboardStats.totalValue > 0 ? formatCurrencyCompact(dashboardStats.totalValue) : '—',
      description: t('salesStorage.stats.totalValueDesc'),
      icon: TrendingUp,
      color: 'purple',
    },
    {
      title: t('salesStorage.stats.avgPricePerSqm'),
      value: dashboardStats.averagePricePerSqm > 0
        ? formatCurrencyWhole(Math.round(dashboardStats.averagePricePerSqm))
        : '—',
      description: t('salesStorage.stats.avgPricePerSqmDesc'),
      icon: Maximize2,
      color: 'blue',
    },
  ];

  return (
    <PageContainer ariaLabel={t('salesStorage.pageTitle')}>
      <SalesAvailableHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        showDashboard={showDashboard}
        setShowDashboard={setShowDashboard}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        titleOverride={t('salesStorage.pageTitle')}
        subtitleOverride={t('salesStorage.pageSubtitle')}
        searchPlaceholderOverride={t('salesStorage.searchPlaceholder')}
      />

      {showDashboard && (
        <UnifiedDashboard
          stats={unifiedDashboardStats}
          columns={6}
        />
      )}

      <div className="hidden md:block -mt-1">
        <AdvancedFiltersPanel
          config={storageFiltersConfig}
          filters={filters as unknown as StorageFilterState}
          onFiltersChange={handleAdvancedFiltersChange}
        />
      </div>

      {showFilters && (
        <div className="md:hidden"> {/* eslint-disable-line custom/no-hardcoded-strings */}
          <AdvancedFiltersPanel
            config={storageFiltersConfig}
            filters={filters as unknown as StorageFilterState}
            onFiltersChange={handleAdvancedFiltersChange}
            defaultOpen
          />
        </div>
      )}

      <ListContainer>
        {viewMode === 'list' ? (
          <SalesStorageSidebar
            items={filteredItems}
            selectedItem={selectedItem}
            onSelectItem={handleSelectItem}
            selectedItemId={selectedItemId}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            selectedType={selectedType}
            onTypeChange={setSelectedType}
          />
        ) : (
          <section
            className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2 overflow-y-auto"
            aria-label={t('salesStorage.gridLabel')}
          >
            {filteredItems.map(item => {
              const price = item.commercial?.askingPrice ?? item.price ?? null;
              return (
                <SalesGridCard
                  key={item.id}
                  id={item.id}
                  icon={Package}
                  title={item.name || item.id}
                  statusKey={item.status ?? 'available'}
                  statusLabel={t(`storage:status.${item.status}`)}
                  description={`${t(`storage:types.${item.type}`)} · ${item.area ?? '—'} m²`}
                  price={price}
                  pricePerSqm={item.area && item.area > 0 && price ? price / item.area : null}
                  onClick={handleSelectItem}
                />
              );
            })}

            {filteredItems.length === 0 && (
              <SalesGridEmpty message={t('salesStorage.noResults')} />
            )}
          </section>
        )}
      </ListContainer>
    </PageContainer>
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
