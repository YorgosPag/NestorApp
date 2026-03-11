'use client';

/**
 * @fileoverview Sales Available Storage Page — ADR-199
 * @description Full enterprise page: header, dashboard, filters, list+details
 * @pattern Mirrors /sales/available-apartments with storage-specific data
 * @replaces Previous mock implementation with real Firestore data
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
import { ListContainer, PageContainer } from '@/core/containers';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// =============================================================================
// 🏢 CURRENCY FORMATTER
// =============================================================================

function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value}`;
}

// =============================================================================
// 🏢 MAIN CONTENT
// =============================================================================

function SalesStorageContent() {
  const { t } = useTranslation('common');

  const {
    filteredItems,
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

  // Search state
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    handleFiltersChange({ searchTerm });
  }, [searchTerm, handleFiltersChange]);

  // Adapter: AdvancedFiltersPanel → SalesSpaceFilterState
  const handleAdvancedFiltersChange = React.useCallback((adv: StorageFilterState) => {
    handleFiltersChange({
      searchTerm: adv.searchTerm || '',
      building: adv.building?.[0] || 'all',
      floor: adv.floor?.[0] || 'all',
      type: adv.type?.[0] || 'all',
      areaRange: {
        min: adv.areaRange?.min ?? null,
        max: adv.areaRange?.max ?? null,
      },
    });
  }, [handleFiltersChange]);

  // =========================================================================
  // Dashboard Stats
  // =========================================================================
  const unifiedDashboardStats: DashboardStat[] = [
    {
      title: t('salesStorage.stats.available', { defaultValue: 'Διαθέσιμες Αποθήκες' }),
      value: dashboardStats.availableCount,
      description: t('salesStorage.stats.forSaleNow', { defaultValue: 'Προς πώληση τώρα' }),
      icon: Package,
      color: 'orange',
    },
    {
      title: t('salesStorage.stats.avgPrice', { defaultValue: 'Μέση Τιμή' }),
      value: dashboardStats.averagePrice > 0 ? formatCurrencyCompact(dashboardStats.averagePrice) : '—',
      description: t('salesStorage.stats.avgPriceDesc', { defaultValue: 'Μέση ζητούμενη τιμή' }),
      icon: DollarSign,
      color: 'green',
    },
    {
      title: t('salesStorage.stats.totalValue', { defaultValue: 'Συνολική Αξία' }),
      value: dashboardStats.totalValue > 0 ? formatCurrencyCompact(dashboardStats.totalValue) : '—',
      description: t('salesStorage.stats.totalValueDesc', { defaultValue: 'Αξία χαρτοφυλακίου' }),
      icon: TrendingUp,
      color: 'purple',
    },
    {
      title: t('salesStorage.stats.avgPricePerSqm', { defaultValue: 'Μ.Ο. €/m²' }),
      value: dashboardStats.averagePricePerSqm > 0
        ? `€${Math.round(dashboardStats.averagePricePerSqm).toLocaleString('el-GR')}`
        : '—',
      description: t('salesStorage.stats.avgPricePerSqmDesc', { defaultValue: 'Μέση τιμή ανά τ.μ.' }),
      icon: Maximize2,
      color: 'blue',
    },
  ];

  return (
    <PageContainer ariaLabel={t('salesStorage.pageTitle', { defaultValue: 'Διαθέσιμες Αποθήκες' })}>
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
        titleOverride={t('salesStorage.pageTitle', { defaultValue: 'Διαθέσιμες Αποθήκες' })}
        subtitleOverride={t('salesStorage.pageSubtitle', { defaultValue: 'Αποθήκες προς πώληση - Ενεργές καταχωρήσεις' })}
        searchPlaceholderOverride={t('salesStorage.searchPlaceholder', { defaultValue: 'Αναζήτηση αποθήκης...' })}
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
          config={storageFiltersConfig}
          filters={filters as unknown as StorageFilterState}
          onFiltersChange={handleAdvancedFiltersChange}
        />
      </div>

      {showFilters && (
        <div className="md:hidden">
          <AdvancedFiltersPanel
            config={storageFiltersConfig}
            filters={filters as unknown as StorageFilterState}
            onFiltersChange={handleAdvancedFiltersChange}
            defaultOpen
          />
        </div>
      )}

      {/* LAYER 4: List + Details */}
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
            aria-label={t('salesStorage.gridLabel', { defaultValue: 'Grid αποθηκών' })}
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
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold truncate">{item.name || item.id}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      item.status === 'available' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                      item.status === 'reserved' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                      item.status === 'sold' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                      {t(`storage:status.${item.status}`, { defaultValue: item.status })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(`storage:types.${item.type}`, { defaultValue: item.type })} · {item.area ?? '—'} m²
                  </p>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {(item.commercial?.askingPrice ?? item.price)
                      ? formatCurrencyCompact(item.commercial?.askingPrice ?? item.price ?? 0)
                      : '—'}
                  </p>
                  {item.area && item.area > 0 && (item.commercial?.askingPrice ?? item.price) ? (
                    <p className="text-xs text-muted-foreground">
                      €{Math.round((item.commercial?.askingPrice ?? item.price ?? 0) / item.area).toLocaleString('el-GR')}/m²
                    </p>
                  ) : null}
                </div>
              </article>
            ))}

            {filteredItems.length === 0 && (
              <div className="col-span-full p-6 text-center text-sm text-muted-foreground">
                {t('salesStorage.noResults', { defaultValue: 'Δεν βρέθηκαν αποθήκες.' })}
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

function SalesStorageFallback() {
  const { t } = useTranslation('common');
  const colors = useSemanticColors();

  return (
    <div className={`min-h-screen ${colors.bg.secondary} flex items-center justify-center`}>
      <div className="text-center">
        <AnimatedSpinner size="large" className="mx-auto mb-4" />
        <p className={colors.text.muted}>
          {t('salesStorage.loading', { defaultValue: 'Φόρτωση διαθέσιμων αποθηκών...' })}
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// 🏢 PAGE EXPORT
// =============================================================================

export default function AvailableStoragePage() {
  return (
    <Suspense fallback={<SalesStorageFallback />}>
      <SalesStorageContent />
    </Suspense>
  );
}
