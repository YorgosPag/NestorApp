/* eslint-disable design-system/enforce-semantic-colors */
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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Property } from '@/types/property';
import '@/lib/design-system';

function SalesAvailableContent() {
  const { t } = useTranslation('common');
  const colors = useSemanticColors();

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
          <section
            className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2 overflow-y-auto"
            aria-label={t('sales.available.gridLabel')}
          >
            {(filteredUnits as Property[]).map(unit => (
              <article
                key={unit.id}
                onClick={() => handleSelectProperty(unit.id)}
                className="border border-border rounded-lg shadow-sm bg-card overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectProperty(unit.id); }}
              >
                <div className="aspect-[16/10] bg-muted flex items-center justify-center">
                  <ShoppingBag className={cn("h-8 w-8", colors.text.muted)} />
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold truncate">{unit.name || unit.code || unit.id}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      unit.commercialStatus === 'for-sale' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                      unit.commercialStatus === 'reserved' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                      {unit.commercialStatus
                        ? t(`sales.commercialStatus.${unit.commercialStatus}`)
                        : t('sales.commercialStatus.new')}
                    </span>
                  </div>
                  <p className={cn("text-xs", colors.text.muted)}>
                    {t(`sales.unitTypes.${unit.type}`)} · {unit.areas?.gross ?? unit.area ?? '—'} m²
                  </p>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {unit.commercial?.askingPrice
                      ? formatCurrencyCompact(unit.commercial.askingPrice)
                      : '—'}
                  </p>
                  <p className={cn("text-xs", colors.text.muted)}>
                    {unit.commercial?.askingPrice && (unit.areas?.gross ?? unit.area)
                      ? `${formatCurrencyWhole(Math.round(unit.commercial.askingPrice / (unit.areas?.gross ?? unit.area ?? 1)))}/m²`
                      : ''}
                  </p>
                </div>
              </article>
            ))}

            {filteredUnits.length === 0 && (
              <div className={cn("col-span-full p-6 text-center text-sm", colors.text.muted)}>
                {t('sales.available.noResults')}
              </div>
            )}
          </section>
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
