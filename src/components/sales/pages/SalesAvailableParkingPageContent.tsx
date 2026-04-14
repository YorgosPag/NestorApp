'use client';

/**
 * @fileoverview Sales Available Parking — ADR-199
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 * @pattern Mirrors /sales/available-properties with parking-specific data
 */

import React, { Suspense } from 'react';
import { useSalesParkingViewerState } from '@/hooks/sales/useSalesParkingViewerState';
import { SalesAvailableHeader } from '@/components/sales/page/SalesAvailableHeader';
import { SalesParkingSidebar } from '@/components/sales/SalesParkingSidebar';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel, parkingFiltersConfig, type ParkingFilterState } from '@/components/core/AdvancedFilters';
import {
  Car,
  DollarSign,
  TrendingUp,
  Maximize2,
} from 'lucide-react';
import { ListContainer, PageContainer } from '@/core/containers';
import { PageLoadingState, StaticPageLoading } from '@/core/states';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyCompact, formatCurrencyWhole } from '@/lib/intl-utils';
import { SalesGridCard, SalesGridEmpty } from '@/components/sales/shared/SalesGridCard';
import '@/lib/design-system';

function SalesParkingContent() {
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
  } = useSalesParkingViewerState();

  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    handleFiltersChange({ searchTerm });
  }, [searchTerm, handleFiltersChange]);

  const handleAdvancedFiltersChange = React.useCallback((adv: ParkingFilterState) => {
    handleFiltersChange({
      searchTerm: adv.searchTerm || '',
      building: adv.building?.[0] || 'all',
      floor: adv.floor?.[0] || 'all',
      type: adv.type?.[0] || 'all',
      status: adv.status?.[0] || 'all',
    });
  }, [handleFiltersChange]);

  if (loading) {
    return (
      <PageContainer ariaLabel={t('salesParking.pageTitle')}>
        <PageLoadingState icon={Car} message={t('salesParking.loading')} layout="contained" />
      </PageContainer>
    );
  }

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
      value: dashboardStats.averagePrice > 0 ? formatCurrencyCompact(dashboardStats.averagePrice) : '—',
      description: t('salesParking.stats.avgPriceDesc'),
      icon: DollarSign,
      color: 'green',
    },
    {
      title: t('salesParking.stats.totalValue'),
      value: dashboardStats.totalValue > 0 ? formatCurrencyCompact(dashboardStats.totalValue) : '—',
      description: t('salesParking.stats.totalValueDesc'),
      icon: TrendingUp,
      color: 'purple',
    },
    {
      title: t('salesParking.stats.avgPricePerSqm'),
      value: dashboardStats.averagePricePerSqm > 0
        ? formatCurrencyWhole(Math.round(dashboardStats.averagePricePerSqm))
        : '—',
      description: t('salesParking.stats.avgPricePerSqmDesc'),
      icon: Maximize2,
      color: 'orange',
    },
  ];

  return (
    <PageContainer ariaLabel={t('salesParking.pageTitle')}>
      <SalesAvailableHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        showDashboard={showDashboard}
        setShowDashboard={setShowDashboard}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        titleOverride={t('salesParking.pageTitle')}
        subtitleOverride={t('salesParking.pageSubtitle')}
        searchPlaceholderOverride={t('salesParking.searchPlaceholder')}
      />

      {showDashboard && (
        <UnifiedDashboard
          stats={unifiedDashboardStats}
          columns={6}
        />
      )}

      <div className="hidden md:block -mt-1">
        <AdvancedFiltersPanel
          config={parkingFiltersConfig}
          filters={filters as unknown as ParkingFilterState}
          onFiltersChange={handleAdvancedFiltersChange}
        />
      </div>

      {showFilters && (
        <div className="md:hidden"> {/* eslint-disable-line custom/no-hardcoded-strings */}
          <AdvancedFiltersPanel
            config={parkingFiltersConfig}
            filters={filters as unknown as ParkingFilterState}
            onFiltersChange={handleAdvancedFiltersChange}
            defaultOpen
          />
        </div>
      )}

      <ListContainer>
        {viewMode === 'list' ? (
          <SalesParkingSidebar
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
            aria-label={t('salesParking.gridLabel')}
          >
            {filteredItems.map(item => {
              const price = item.commercial?.askingPrice ?? item.price ?? null;
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
                  price={price}
                  pricePerSqm={item.area && item.area > 0 && price ? price / item.area : null}
                  onClick={handleSelectItem}
                />
              );
            })}

            {filteredItems.length === 0 && (
              <SalesGridEmpty message={t('salesParking.noResults')} />
            )}
          </section>
        )}
      </ListContainer>
    </PageContainer>
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
