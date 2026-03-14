'use client';

/**
 * @fileoverview Sales Available Parking Page — ADR-199
 * @description Full enterprise page: header, dashboard, filters, list+details
 * @pattern Mirrors /sales/available-apartments with parking-specific data
 * @replaces Previous mock implementation with real Firestore data
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

// =============================================================================
// 🏢 MAIN CONTENT
// =============================================================================

function SalesParkingContent() {
  const { t } = useTranslation('common');

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

  // Search state
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    handleFiltersChange({ searchTerm });
  }, [searchTerm, handleFiltersChange]);

  // Adapter: AdvancedFiltersPanel → SalesParkingFilterState
  const handleAdvancedFiltersChange = React.useCallback((adv: ParkingFilterState) => {
    handleFiltersChange({
      searchTerm: adv.searchTerm || '',
      building: adv.building?.[0] || 'all',
      floor: adv.floor?.[0] || 'all',
      type: adv.type?.[0] || 'all',
      status: adv.status?.[0] || 'all',
    });
  }, [handleFiltersChange]);

  // ADR-229 Phase 2: Data-level loading guard (after all hooks)
  if (loading) {
    return (
      <PageContainer ariaLabel={t('salesParking.pageTitle', { defaultValue: 'Διαθέσιμες Θέσεις Στάθμευσης' })}>
        <PageLoadingState icon={Car} message={t('salesParking.loading', { defaultValue: 'Φόρτωση θέσεων στάθμευσης...' })} layout="contained" />
      </PageContainer>
    );
  }

  // =========================================================================
  // Dashboard Stats
  // =========================================================================
  const unifiedDashboardStats: DashboardStat[] = [
    {
      title: t('salesParking.stats.available', { defaultValue: 'Διαθέσιμες Θέσεις' }),
      value: dashboardStats.availableCount,
      description: t('salesParking.stats.forSaleNow', { defaultValue: 'Προς πώληση τώρα' }),
      icon: Car,
      color: 'blue',
    },
    {
      title: t('salesParking.stats.avgPrice', { defaultValue: 'Μέση Τιμή' }),
      value: dashboardStats.averagePrice > 0 ? formatCurrencyCompact(dashboardStats.averagePrice) : '—',
      description: t('salesParking.stats.avgPriceDesc', { defaultValue: 'Μέση ζητούμενη τιμή' }),
      icon: DollarSign,
      color: 'green',
    },
    {
      title: t('salesParking.stats.totalValue', { defaultValue: 'Συνολική Αξία' }),
      value: dashboardStats.totalValue > 0 ? formatCurrencyCompact(dashboardStats.totalValue) : '—',
      description: t('salesParking.stats.totalValueDesc', { defaultValue: 'Αξία χαρτοφυλακίου' }),
      icon: TrendingUp,
      color: 'purple',
    },
    {
      title: t('salesParking.stats.avgPricePerSqm', { defaultValue: 'Μ.Ο. €/m²' }),
      value: dashboardStats.averagePricePerSqm > 0
        ? formatCurrencyWhole(Math.round(dashboardStats.averagePricePerSqm))
        : '—',
      description: t('salesParking.stats.avgPricePerSqmDesc', { defaultValue: 'Μέση τιμή ανά τ.μ.' }),
      icon: Maximize2,
      color: 'orange',
    },
  ];

  return (
    <PageContainer ariaLabel={t('salesParking.pageTitle', { defaultValue: 'Διαθέσιμες Θέσεις Στάθμευσης' })}>
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
        titleOverride={t('salesParking.pageTitle', { defaultValue: 'Διαθέσιμες Θέσεις Στάθμευσης' })}
        subtitleOverride={t('salesParking.pageSubtitle', { defaultValue: 'Θέσεις στάθμευσης προς πώληση - Ενεργές καταχωρήσεις' })}
        searchPlaceholderOverride={t('salesParking.searchPlaceholder', { defaultValue: 'Αναζήτηση θέσης...' })}
      />

      {/* LAYER 2: Dashboard */}
      {showDashboard && (
        <UnifiedDashboard
          stats={unifiedDashboardStats}
          columns={6}
        />
      )}

      {/* LAYER 3: Advanced Filters */}
      <div className="hidden md:block -mt-1">
        <AdvancedFiltersPanel
          config={parkingFiltersConfig}
          filters={filters as unknown as ParkingFilterState}
          onFiltersChange={handleAdvancedFiltersChange}
        />
      </div>

      {showFilters && (
        <div className="md:hidden">
          <AdvancedFiltersPanel
            config={parkingFiltersConfig}
            filters={filters as unknown as ParkingFilterState}
            onFiltersChange={handleAdvancedFiltersChange}
            defaultOpen
          />
        </div>
      )}

      {/* LAYER 4: List + Details */}
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
            aria-label={t('salesParking.gridLabel', { defaultValue: 'Grid θέσεων στάθμευσης' })}
          >
            {filteredItems.map(item => (
              <article
                key={item.id}
                onClick={() => handleSelectItem(item.id)}
                className="border border-border rounded-lg shadow-sm bg-card overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectItem(item.id); }}
              >
                <div className="aspect-[16/10] bg-muted flex items-center justify-center">
                  <Car className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold truncate">{item.number || item.id}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      item.status === 'available' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                      item.status === 'reserved' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                      item.status === 'sold' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                      {t(`parking:status.${item.status ?? 'available'}`, { defaultValue: item.status ?? 'available' })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(`parking:types.${item.type ?? 'standard'}`, { defaultValue: item.type ?? 'standard' })}
                    {item.locationZone ? ` · ${t(`parking:locationZone.${item.locationZone}`, { defaultValue: item.locationZone })}` : ''}
                  </p>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {(item.commercial?.askingPrice ?? item.price)
                      ? formatCurrencyCompact(item.commercial?.askingPrice ?? item.price ?? 0)
                      : '—'}
                  </p>
                  {item.area && item.area > 0 && (item.commercial?.askingPrice ?? item.price) ? (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrencyWhole(Math.round((item.commercial?.askingPrice ?? item.price ?? 0) / item.area))}/m²
                    </p>
                  ) : null}
                </div>
              </article>
            ))}

            {filteredItems.length === 0 && (
              <div className="col-span-full p-6 text-center text-sm text-muted-foreground">
                {t('salesParking.noResults', { defaultValue: 'Δεν βρέθηκαν θέσεις στάθμευσης.' })}
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

export default function AvailableParkingPage() {
  return (
    <Suspense fallback={<StaticPageLoading icon={Car} message="Φόρτωση διαθέσιμων θέσεων..." />}>
      <SalesParkingContent />
    </Suspense>
  );
}
