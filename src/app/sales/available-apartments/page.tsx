'use client';

/**
 * @fileoverview Sales Available Units Page — ADR-197
 * @description Full enterprise page: header, dashboard, filters, dual quick filters, list+details
 * @pattern Mirrors /units page with "Sales Lens" (commercial data prominent)
 * @replaces Previous mock implementation with real Firestore data
 */

import React, { Suspense } from 'react';
import { formatCurrencyCompact, formatCurrencyWhole } from '@/lib/intl-utils';

import { useSalesUnitsViewerState } from '@/hooks/useSalesUnitsViewerState';
import { SalesAvailableHeader } from '@/components/sales/page/SalesAvailableHeader';
import { SalesSidebar } from '@/components/sales/sidebar/SalesSidebar';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel, unitFiltersConfig, type UnitFilterState } from '@/components/core/AdvancedFilters';
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Maximize2,
} from 'lucide-react';
import { ListContainer, PageContainer } from '@/core/containers';
import { PageLoadingState, StaticPageLoading } from '@/core/states';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Unit } from '@/types/unit';

// formatCurrencyCompact() → imported from @/lib/intl-utils (ADR-212)

// =============================================================================
// 🏢 MAIN CONTENT
// =============================================================================

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
    selectedUnit,
    selectedUnitId,
    handleSelectUnit,
    filters,
    handleFiltersChange,
    selectedCommercialStatus,
    setSelectedCommercialStatus,
    selectedUnitType,
    setSelectedUnitType,
    dashboardStats,
    refetch,
  } = useSalesUnitsViewerState();

  // Search state (for header search)
  const [searchTerm, setSearchTerm] = React.useState('');

  // Apply header search on top of hook filters
  React.useEffect(() => {
    handleFiltersChange({ searchTerm });
  }, [searchTerm, handleFiltersChange]);

  // Adapter: AdvancedFiltersPanel (UnitFilterState) → SalesFilterState
  const handleAdvancedFiltersChange = React.useCallback((unitFilters: UnitFilterState) => {
    handleFiltersChange({
      searchTerm: unitFilters.searchTerm || '',
      building: unitFilters.building?.[0] || 'all',
      floor: unitFilters.floor?.[0] || 'all',
      unitType: unitFilters.type?.[0] || 'all',
      areaRange: {
        min: unitFilters.areaRange?.min ?? null,
        max: unitFilters.areaRange?.max ?? null,
      },
    });
  }, [handleFiltersChange]);

  // ADR-229 Phase 2: Data-level loading guard (after all hooks)
  if (loading) {
    return (
      <PageContainer ariaLabel={t('sales.available.title')}>
        <PageLoadingState icon={ShoppingBag} message={t('sales.available.loading')} layout="contained" />
      </PageContainer>
    );
  }

  // =========================================================================
  // Dashboard Stats (ADR-197 §2.5)
  // =========================================================================
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
      {/* LAYER 1: Header */}
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

      {/* LAYER 2: Dashboard (toggle-able) */}
      {showDashboard && (
        <UnifiedDashboard
          stats={unifiedDashboardStats}
          columns={6}
        />
      )}

      {/* LAYER 3: Advanced Filters (mirrors /units page pattern) */}
      <div className="hidden md:block -mt-1">
        <AdvancedFiltersPanel
          config={unitFiltersConfig}
          filters={filters as unknown as UnitFilterState}
          onFiltersChange={handleAdvancedFiltersChange}
        />
      </div>

      {/* Mobile: Show only when showFilters is true */}
      {showFilters && (
        <div className="md:hidden">
          <AdvancedFiltersPanel
            config={unitFiltersConfig}
            filters={filters as unknown as UnitFilterState}
            onFiltersChange={handleAdvancedFiltersChange}
            defaultOpen
          />
        </div>
      )}

      {/* LAYER 4: List + Details */}
      <ListContainer>
        {viewMode === 'list' ? (
          <SalesSidebar
            units={filteredUnits as Unit[]}
            selectedUnit={selectedUnit as Unit | null}
            onSelectUnit={handleSelectUnit}
            selectedUnitId={selectedUnitId}
            selectedCommercialStatus={selectedCommercialStatus}
            onCommercialStatusChange={setSelectedCommercialStatus}
            selectedUnitType={selectedUnitType}
            onUnitTypeChange={setSelectedUnitType}
            onDataMutated={refetch}
          />
        ) : (
          // Grid view — cards in grid layout
          <section
            className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2 overflow-y-auto"
            aria-label={t('sales.available.gridLabel')}
          >
            {(filteredUnits as Unit[]).map(unit => (
              <article
                key={unit.id}
                onClick={() => handleSelectUnit(unit.id)}
                className="border border-border rounded-lg shadow-sm bg-card overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectUnit(unit.id); }}
              >
                {/* Thumbnail placeholder */}
                <div className="aspect-[16/10] bg-muted flex items-center justify-center">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                </div>
                {/* Content */}
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
                  <p className="text-xs text-muted-foreground">
                    {t(`sales.unitTypes.${unit.type}`)} · {unit.areas?.gross ?? unit.area ?? '—'} m²
                  </p>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {unit.commercial?.askingPrice
                      ? formatCurrencyCompact(unit.commercial.askingPrice)
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {unit.commercial?.askingPrice && (unit.areas?.gross ?? unit.area)
                      ? `${formatCurrencyWhole(Math.round(unit.commercial.askingPrice / (unit.areas?.gross ?? unit.area ?? 1)))}/m²`
                      : ''}
                  </p>
                </div>
              </article>
            ))}

            {filteredUnits.length === 0 && (
              <div className="col-span-full p-6 text-center text-sm text-muted-foreground">
                {t('sales.available.noResults')}
              </div>
            )}
          </section>
        )}
      </ListContainer>
    </PageContainer>
  );
}

// =============================================================================
// 🏢 LOADING FALLBACK
// =============================================================================

// =============================================================================
// 🏢 PAGE EXPORT
// =============================================================================

export default function AvailableApartmentsPage() {
  return (
    <Suspense fallback={<StaticPageLoading message="Φόρτωση διαθέσιμων μονάδων..." />}>
      <SalesAvailableContent />
    </Suspense>
  );
}
