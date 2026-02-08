'use client';

/**
 * 🏢 ENTERPRISE PropertyGridView
 * Public property grid/list view for customers
 *
 * @author Claude (Anthropic AI)
 * @date 2026-01-24
 * @compliance Fortune 500 standards - CLAUDE.md compliant
 *
 * Uses centralized systems:
 * - PageHeader from @/core/headers
 * - AdvancedFiltersPanel from @/components/core/AdvancedFilters
 * - propertyFiltersConfig for filter configuration
 * - PropertyListCard from @/domain
 */

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Building2, Home, DollarSign, Maximize } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { usePublicPropertyViewer } from '@/hooks/usePublicPropertyViewer';
import { PageHeader } from '@/core/headers';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ADR-051: Use centralized usePropertyGridFilters from Enterprise Filter System
import { usePropertyGridFilters } from '@/components/core/AdvancedFilters';
import { PropertyCard } from './components/PropertyCard';
import { PropertyListCard } from '@/domain';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  AdvancedFiltersPanel,
  propertyFiltersConfig,
  defaultPropertyFilters
} from '@/components/core/AdvancedFilters';
import type { PropertyFilterState } from '@/components/core/AdvancedFilters';
import type { ViewMode as CoreViewMode } from '@/core/headers';
import type { Property } from '@/types/property-viewer';

export function PropertyGridView() {
  const router = useRouter();
  const { properties, filters, handleFiltersChange, dashboardStats } = usePublicPropertyViewer();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { radius } = useBorderTokens();
  const { t } = useTranslation('properties');

  // Local state
  const [showDashboard, setShowDashboard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [enterpriseFilters, setEnterpriseFilters] = useState<PropertyFilterState>(defaultPropertyFilters);

  const {
    viewMode, setViewMode,
    availableProperties,
    filteredProperties,
  } = usePropertyGridFilters(properties, filters);

  // Handle enterprise filter changes
  const handleEnterpriseFilterChange = (newFilters: Partial<PropertyFilterState>) => {
    const updated = { ...enterpriseFilters, ...newFilters };
    setEnterpriseFilters(updated);

    // Map to hook's filter format
    handleFiltersChange({
      searchTerm: updated.searchTerm || '',
      propertyType: updated.propertyType || [],
      status: updated.status || [],
      priceRange: {
        min: updated.priceRange?.min ?? undefined,
        max: updated.priceRange?.max ?? undefined,
      },
      areaRange: {
        min: updated.areaRange?.min ?? undefined,
        max: updated.areaRange?.max ?? undefined,
      },
      floor: updated.floor || [],
      features: updated.features || [],
    });
  };

  // 🏢 ENTERPRISE: Dashboard stats
  const dashboardStatsFormatted: DashboardStat[] = useMemo(() => [
    {
      title: t('dashboard.stats.totalUnits'),
      value: dashboardStats?.totalProperties ?? availableProperties.length,
      icon: Building2,
      color: 'blue' as const,
    },
    {
      title: t('dashboard.stats.totalValue'),
      value: `€${((dashboardStats?.totalValue ?? 0) / 1000).toFixed(0)}K`,
      icon: DollarSign,
      color: 'green' as const,
    },
    {
      title: t('dashboard.stats.totalArea'),
      value: `${(dashboardStats?.totalArea ?? 0).toFixed(0)} m²`,
      icon: Maximize,
      color: 'purple' as const,
    },
    {
      title: t('dashboard.stats.averagePrice'),
      value: `€${((dashboardStats?.averagePrice ?? 0) / 1000).toFixed(0)}K`,
      icon: Home,
      color: 'orange' as const,
    },
  ], [dashboardStats, availableProperties.length, t]);

  const handleViewFloorPlan = (propertyId: string) => {
    router.push(`/properties?view=floorplan&selected=${propertyId}`);
  };

  const handleViewAllFloorPlan = () => {
    router.push('/properties?view=floorplan');
  };

  return (
    <section className={`min-h-screen ${colors.bg.secondary} dark:${colors.bg.primary} overflow-x-hidden`} aria-label={t('grid.header.title')}>
      {/* 🏢 ENTERPRISE: Header with breadcrumb */}
      <header className="sticky top-0 z-10">
        <PageHeader
          variant="sticky-rounded"
          layout="compact"
          spacing="compact"
          title={{
            icon: NAVIGATION_ENTITIES.unit.icon,
            title: t('grid.header.title'),
            subtitle: t('grid.header.found', { count: filteredProperties.length })
          }}
          breadcrumb={<NavigationBreadcrumb />}
          search={{
            value: enterpriseFilters.searchTerm || '',
            onChange: (term) => handleEnterpriseFilterChange({ searchTerm: term }),
            placeholder: t('grid.search.placeholder')
          }}
          actions={{
            showDashboard,
            onDashboardToggle: () => setShowDashboard(!showDashboard),
            viewMode: viewMode as CoreViewMode,
            onViewModeChange: (mode) => setViewMode(mode as 'list' | 'grid'),
            viewModes: ['list', 'grid'] as CoreViewMode[],
            customActions: [
              <button
                key="floorplan"
                onClick={handleViewAllFloorPlan}
                className={`px-4 py-2 ${colors.bg.gradient} ${colors.text.inverse} ${radius.lg} transition-all flex items-center gap-2 font-medium h-8 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
              >
                <MapPin className={iconSizes.sm} />
                {t('grid.actions.viewFloorPlan')}
              </button>
            ]
          }}
        />
      </header>

      {/* 🏢 ENTERPRISE: Dashboard (toggleable) */}
      {showDashboard && (
        <UnifiedDashboard
          stats={dashboardStatsFormatted}
          columns={4}
        />
      )}

      {/* 🏢 ENTERPRISE: Advanced Filters Panel - Desktop: Always visible */}
      {/* Same structure as Units page - separate container below Dashboard */}
      <div className="hidden md:block">
        <AdvancedFiltersPanel
          config={propertyFiltersConfig}
          filters={enterpriseFilters}
          onFiltersChange={(updated) => handleEnterpriseFilterChange(updated)}
        />
      </div>

      {/* 🏢 ENTERPRISE: Advanced Filters Panel - Mobile: Show only when toggled */}
      {showFilters && (
        <div className="md:hidden">
          <AdvancedFiltersPanel
            config={propertyFiltersConfig}
            filters={enterpriseFilters}
            onFiltersChange={(updated) => handleEnterpriseFilterChange(updated)}
            defaultOpen={true}
          />
        </div>
      )}

      {/* Properties Grid/List */}
      <main className="w-full px-4 py-8 overflow-x-hidden">
        <div className="w-full max-w-screen-sm mx-auto overflow-hidden">
          {filteredProperties.length > 0 ? (
            <ul className="flex flex-col gap-4" role="list" aria-label={t('grid.header.title')}>
              {filteredProperties.map((property) => (
                <li key={property.id} className="w-full min-w-0 overflow-hidden">
                  {viewMode === 'grid'
                    ? <PropertyCard property={property} onViewFloorPlan={handleViewFloorPlan} />
                    : <PropertyListCard property={property} onViewFloorPlan={handleViewFloorPlan} />
                  }
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12 px-4 sm:px-0" role="status" aria-live="polite">
              {React.createElement(NAVIGATION_ENTITIES.unit.icon, { className: `${iconSizes.xl} ${colors.text.muted} mx-auto mb-4`, 'aria-hidden': true })}
              <h3 className={`text-lg font-medium ${colors.text.primary} mb-2`}>{t('grid.emptyState.title')}</h3>
              <p className={colors.text.muted}>{t('grid.emptyState.subtitle')}</p>
            </div>
          )}
        </div>
      </main>

      {/* Bottom CTA */}
      <aside className="dark:bg-muted/30 py-12 mt-12">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className={`text-2xl font-bold ${colors.text.primary} mb-4`}>
            {t('grid.cta.title')}
          </h2>
          <p className={`${colors.text.muted} mb-6`}>
            {t('grid.cta.subtitle')}
          </p>
          <button
            onClick={handleViewAllFloorPlan}
            className={`px-8 py-3 ${colors.bg.gradient} ${colors.text.inverse} ${radius.lg} transition-all font-medium inline-flex items-center gap-2 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
          >
            <MapPin className={iconSizes.md} />
            {t('grid.cta.button')}
          </button>
        </div>
      </aside>
    </section>
  );
}
