'use client';

/**
 * @fileoverview Sales Sold Properties — ADR-197 (sold scope)
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 * @pattern Mirrors /sales/available-properties with `viewScope: 'sold'`.
 *          Same layout primitives (PageHeader, UnifiedDashboard,
 *          AdvancedFiltersPanel, SalesSidebar) so the agent workflow
 *          (payment plans, legal docs) stays consistent post-sale.
 */

import React, { Suspense } from 'react';
import { formatCurrencyCompact, formatCurrencyWhole } from '@/lib/intl-utils';
import { useSalesPropertiesViewerState } from '@/hooks/useSalesPropertiesViewerState';
import { SalesAvailableHeader } from '@/components/sales/page/SalesAvailableHeader';
import { SalesSidebar } from '@/components/sales/sidebar/SalesSidebar';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel, propertyListFiltersConfig, type UnitFilterState } from '@/components/core/AdvancedFilters';
import {
  CheckCircle,
  DollarSign,
  TrendingUp,
  Maximize2,
} from 'lucide-react';
import { ListContainer, PageContainer } from '@/core/containers';
import { PageLoadingState, StaticPageLoading } from '@/core/states';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SalesGridCard, SalesGridEmpty } from '@/components/sales/shared/SalesGridCard';
import type { Property } from '@/types/property';
import '@/lib/design-system';

function SalesSoldContent() {
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
  } = useSalesPropertiesViewerState({ viewScope: 'sold' });

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
      <PageContainer ariaLabel={t('sales.sold.title')}>
        <PageLoadingState icon={CheckCircle} message={t('sales.sold.loading')} layout="contained" />
      </PageContainer>
    );
  }

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
      value: dashboardStats.totalValue > 0 ? formatCurrencyCompact(dashboardStats.totalValue) : '—',
      description: t('sales.sold.stats.totalSalesValue'),
      icon: DollarSign,
      color: 'blue',
    },
    {
      title: t('sales.sold.stats.avgSalePrice'),
      value: dashboardStats.averagePrice > 0 ? formatCurrencyCompact(dashboardStats.averagePrice) : '—',
      description: t('sales.sold.stats.avgSalePriceDesc'),
      icon: TrendingUp,
      color: 'purple',
    },
    {
      title: t('sales.sold.stats.avgPricePerSqm'),
      value: dashboardStats.averagePricePerSqm > 0
        ? formatCurrencyWhole(Math.round(dashboardStats.averagePricePerSqm))
        : '—',
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
    <PageContainer ariaLabel={t('sales.sold.title')}>
      <SalesAvailableHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        showDashboard={showDashboard}
        setShowDashboard={setShowDashboard}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        titleOverride={t('sales.sold.title')}
        subtitleOverride={t('sales.sold.subtitle')}
        searchPlaceholderOverride={t('sales.sold.searchPlaceholder')}
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
            labels={sidebarLabels}
            hideCommercialStatusFilter
          />
        ) : (
          <section
            className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2 overflow-y-auto"
            aria-label={t('sales.sold.gridLabel')}
          >
            {(filteredUnits as Property[]).map(unit => {
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
            })}

            {filteredUnits.length === 0 && (
              <SalesGridEmpty message={t('sales.sold.noResults')} />
            )}
          </section>
        )}
      </ListContainer>
    </PageContainer>
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
