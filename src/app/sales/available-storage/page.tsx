/* eslint-disable design-system/enforce-semantic-colors */
'use client';

/**
 * @fileoverview Sales Available Storage Page — ADR-199
 * @description Full enterprise page: header, dashboard, filters, list+details
 * @pattern Mirrors /sales/available-properties with storage-specific data
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
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { ListContainer, PageContainer } from '@/core/containers';
import { PageLoadingState, StaticPageLoading } from '@/core/states';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { formatCurrencyCompact, formatCurrencyWhole } from '@/lib/intl-utils';
import '@/lib/design-system';

// =============================================================================
// 🏢 MAIN CONTENT
// =============================================================================

function SalesStorageContent() {
  const { t } = useTranslation('common');
  const colors = useSemanticColors();

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
        min: adv.ranges?.areaRange?.min ?? null,
        max: adv.ranges?.areaRange?.max ?? null,
      },
    });
  }, [handleFiltersChange]);

  // ADR-229 Phase 2: Data-level loading guard (after all hooks)
  if (loading) {
    return (
      <PageContainer ariaLabel={t('salesStorage.pageTitle')}>
        <PageLoadingState icon={NAVIGATION_ENTITIES.storage.icon} message={t('salesStorage.loading')} layout="contained" />
      </PageContainer>
    );
  }

  // =========================================================================
  // Dashboard Stats
  // =========================================================================
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
        titleOverride={t('salesStorage.pageTitle')}
        subtitleOverride={t('salesStorage.pageSubtitle')}
        searchPlaceholderOverride={t('salesStorage.searchPlaceholder')}
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
        <div className="md:hidden"> {/* eslint-disable-line custom/no-hardcoded-strings */}
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
            aria-label={t('salesStorage.gridLabel')}
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
                  <Package className={cn("h-8 w-8", colors.text.muted)} />
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
                      {t(`storage:status.${item.status}`)}
                    </span>
                  </div>
                  <p className={cn("text-xs", colors.text.muted)}>
                    {t(`storage:types.${item.type}`)} · {item.area ?? '—'} m²
                  </p>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {(item.commercial?.askingPrice ?? item.price)
                      ? formatCurrencyCompact(item.commercial?.askingPrice ?? item.price ?? 0)
                      : '—'}
                  </p>
                  {item.area && item.area > 0 && (item.commercial?.askingPrice ?? item.price) ? (
                    <p className={cn("text-xs", colors.text.muted)}>
                      {formatCurrencyWhole(Math.round((item.commercial?.askingPrice ?? item.price ?? 0) / item.area))}/m²
                    </p>
                  ) : null}
                </div>
              </article>
            ))}

            {filteredItems.length === 0 && (
              <div className={cn("col-span-full p-6 text-center text-sm", colors.text.muted)}>
                {t('salesStorage.noResults')}
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

export default function AvailableStoragePage() {
  return (
    <Suspense fallback={<StaticPageLoading icon={NAVIGATION_ENTITIES.storage.icon} message="Φόρτωση διαθέσιμων αποθηκών..." />}> {/* eslint-disable-line custom/no-hardcoded-strings */}
      <SalesStorageContent />
    </Suspense>
  );
}
