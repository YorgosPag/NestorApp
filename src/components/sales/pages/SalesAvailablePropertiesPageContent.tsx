'use client';

/**
 * @fileoverview Sales Available Properties — ADR-197
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 * @pattern Mirrors /units page with "Sales Lens" (commercial data prominent)
 */

import React, { Suspense } from 'react';
import { formatCurrencyCompact, formatCurrencyWhole } from '@/lib/intl-utils';
import { useSalesPropertiesViewerState } from '@/hooks/useSalesPropertiesViewerState';
import { SalesAvailableHeader } from '@/components/sales/page/SalesAvailableHeader';
import { SalesSidebar } from '@/components/sales/sidebar/SalesSidebar';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel, propertyListFiltersConfig, type UnitFilterState } from '@/components/core/AdvancedFilters';
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Maximize2,
} from 'lucide-react';
import { ListContainer, PageContainer } from '@/core/containers';
import { PageLoadingState, StaticPageLoading } from '@/core/states';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SalesGridEmpty } from '@/components/sales/shared/SalesGridCard';
import { PropertyGridCard } from '@/domain/cards/property/PropertyGridCard';
import type { Property } from '@/types/property';
import type { Property as ViewerProperty } from '@/types/property-viewer';
import '@/lib/design-system';

function SalesAvailableContent() {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation', 'properties-enums']);

  const {
    filteredUnits,
    loading,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    showFilters,
    setShowFilters,
    selectedProperty,
    selectedPropertyId,
    handleSelectProperty,
    filters,
    handleFiltersChange,
    selectedCommercialStatus,
    setSelectedCommercialStatus,
    selectedPropertyType,
    setSelectedPropertyType,
    dashboardStats,
    refetch,
  } = useSalesPropertiesViewerState();

  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    handleFiltersChange({ searchTerm });
  }, [searchTerm, handleFiltersChange]);

  const handleAdvancedFiltersChange = React.useCallback((unitFilters: UnitFilterState) => {
    handleFiltersChange({
      searchTerm: unitFilters.searchTerm || '',
      building: unitFilters.building?.[0] || 'all',
      floor: unitFilters.floor?.[0] || 'all',
      propertyType: unitFilters.type?.[0] || 'all',
      areaRange: {
        min: unitFilters.areaRange?.min ?? null,
        max: unitFilters.areaRange?.max ?? null,
      },
    });
  }, [handleFiltersChange]);

  if (loading) {
    return (
      <PageContainer ariaLabel={t('sales.available.title')}>
        <PageLoadingState icon={ShoppingBag} message={t('sales.available.loading')} layout="contained" />
      </PageContainer>
    );
  }

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
      value: dashboardStats.averagePrice > 0 ? formatCurrencyCompact(dashboardStats.averagePrice) : '—',
      description: t('sales.available.stats.avgPriceDesc'),
      icon: DollarSign,
      color: 'green',
    },
    {
      title: t('sales.available.stats.totalValue'),
      value: dashboardStats.totalValue > 0 ? formatCurrencyCompact(dashboardStats.totalValue) : '—',
      description: t('sales.available.stats.totalValueDesc'),
      icon: TrendingUp,
      color: 'purple',
    },
    {
      title: t('sales.available.stats.avgPricePerSqm'),
      value: dashboardStats.averagePricePerSqm > 0
        ? formatCurrencyWhole(Math.round(dashboardStats.averagePricePerSqm))
        : '—',
      description: t('sales.available.stats.avgPricePerSqmDesc'),
      icon: Maximize2,
      color: 'orange',
    },
  ];

  return (
    <PageContainer ariaLabel={t('sales.available.title')}>
      <SalesAvailableHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        showDashboard={showDashboard}
        setShowDashboard={setShowDashboard}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
      />

      {showDashboard && (
        <UnifiedDashboard
          stats={unifiedDashboardStats}
          columns={6}
        />
      )}

      <div className="hidden md:block -mt-1">
        <AdvancedFiltersPanel
          config={propertyListFiltersConfig}
          filters={filters as unknown as UnitFilterState}
          onFiltersChange={handleAdvancedFiltersChange}
        />
      </div>

      {showFilters && (
        <div className="md:hidden"> {/* eslint-disable-line custom/no-hardcoded-strings */}
          <AdvancedFiltersPanel
            config={propertyListFiltersConfig}
            filters={filters as unknown as UnitFilterState}
            onFiltersChange={handleAdvancedFiltersChange}
            defaultOpen
          />
        </div>
      )}

      <ListContainer>
        {viewMode === 'list' ? (
          <SalesSidebar
            units={filteredUnits as Property[]}
            selectedProperty={selectedProperty as Property | null}
            onSelectProperty={handleSelectProperty}
            selectedPropertyId={selectedPropertyId}
            selectedCommercialStatus={selectedCommercialStatus}
            onCommercialStatusChange={setSelectedCommercialStatus}
            selectedPropertyType={selectedPropertyType}
            onPropertyTypeChange={setSelectedPropertyType}
            onDataMutated={refetch}
          />
        ) : (
          <div className="w-full p-2 overflow-y-auto flex-1">
            <section
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2"
              aria-label={t('sales.available.gridLabel')}
            >
              {(filteredUnits as Property[]).map(unit => (
                <PropertyGridCard
                  key={unit.id}
                  property={unit as unknown as ViewerProperty}
                  onSelect={() => handleSelectProperty(unit.id)}
                  showCommercialPrices
                />
              ))}

              {filteredUnits.length === 0 && (
                <SalesGridEmpty message={t('sales.available.noResults')} />
              )}
            </section>
          </div>
        )}
      </ListContainer>
    </PageContainer>
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
