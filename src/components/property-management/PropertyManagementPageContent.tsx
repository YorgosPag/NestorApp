'use client';

/**
 * 🏢 ENTERPRISE PropertyManagementPageContent
 * Customer-facing properties page with dashboard and advanced filters
 *
 * @author Claude (Anthropic AI)
 * @date 2026-01-24
 * @compliance Fortune 500 standards - CLAUDE.md compliant
 *
 * Uses centralized systems:
 * - PropertiesHeader (enterprise header with breadcrumb)
 * - UnifiedDashboard (centralized stats dashboard)
 * - AdvancedFiltersPanel (centralized filter system)
 * - propertyFiltersConfig (filter configuration)
 */

import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, Home, DollarSign, Maximize } from 'lucide-react';
import { usePublicPropertyViewer } from '@/hooks/usePublicPropertyViewer';
import { PropertiesHeader } from './page/PropertiesHeader';
import { ReadOnlyPropertyViewerLayout } from '@/features/read-only-viewer';
import { UnifiedDashboard } from './dashboard/UnifiedDashboard';
import type { DashboardStat } from './dashboard/UnifiedDashboard';
import {
  AdvancedFiltersPanel,
  propertyFiltersConfig,
  defaultPropertyFilters
} from '@/components/core/AdvancedFilters';
import type { PropertyFilterState } from '@/components/core/AdvancedFilters';
import { useUrlPreselect } from '@/features/property-management/hooks/useUrlPreselect';
import { useViewerProps } from '@/features/property-management/hooks/useViewerProps';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

export function PropertyManagementPageContent() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('selected');
  const { t } = useTranslation('properties');
  const spacing = useSpacingTokens();

  // Hook with all property data and state
  const hookState = usePublicPropertyViewer();

  // Local state for UI controls
  const [showFilters, setShowFilters] = useState(false);

  // Enterprise filters state (mapped from hook state)
  const [enterpriseFilters, setEnterpriseFilters] = useState<PropertyFilterState>(defaultPropertyFilters);

  // URL preselection
  useUrlPreselect({
    selectedId,
    properties: hookState.properties,
    onSelectFloor: hookState.onSelectFloor,
    setSelectedProperties: hookState.setSelectedProperties,
  });

  // Viewer props builder
  const viewerProps = useViewerProps(hookState);

  // 🏢 ENTERPRISE: Transform dashboard stats to UnifiedDashboard format
  const dashboardStatsFormatted: DashboardStat[] = useMemo(() => [
    {
      title: t('dashboard.stats.totalUnits'),
      value: hookState.dashboardStats.totalProperties,
      icon: Building2,
      color: 'blue' as const,
    },
    {
      title: t('dashboard.stats.totalValue'),
      value: `€${(hookState.dashboardStats.totalValue / 1000).toFixed(0)}K`,
      icon: DollarSign,
      color: 'green' as const,
    },
    {
      title: t('dashboard.stats.totalArea'),
      value: `${hookState.dashboardStats.totalArea.toFixed(0)} m²`,
      icon: Maximize,
      color: 'purple' as const,
    },
    {
      title: t('dashboard.stats.averagePrice'),
      value: `€${(hookState.dashboardStats.averagePrice / 1000).toFixed(0)}K`,
      icon: Home,
      color: 'orange' as const,
    },
  ], [hookState.dashboardStats, t]);

  // Handle enterprise filter changes
  const handleEnterpriseFilterChange = (newFilters: Partial<PropertyFilterState>) => {
    const updated = { ...enterpriseFilters, ...newFilters };
    setEnterpriseFilters(updated);

    // Map to hook's filter format
    hookState.handleFiltersChange({
      searchTerm: updated.searchTerm || '',
      propertyType: updated.propertyType || [],
      status: updated.status || [],
      priceRange: {
        min: updated.priceRange?.min ?? null,
        max: updated.priceRange?.max ?? null,
      },
      areaRange: {
        min: updated.areaRange?.min ?? null,
        max: updated.areaRange?.max ?? null,
      },
      floor: updated.floor || [],
      features: updated.features || [],
    });
  };

  return (
    <section className="h-full flex flex-col bg-muted/30" aria-label={t('header.title')}>
      {/* 🏢 ENTERPRISE: Centralized header with breadcrumb */}
      <PropertiesHeader
        viewMode={hookState.viewMode}
        setViewMode={hookState.setViewMode}
        showDashboard={hookState.showDashboard}
        setShowDashboard={hookState.setShowDashboard}
        searchTerm={enterpriseFilters.searchTerm || ''}
        setSearchTerm={(term) => handleEnterpriseFilterChange({ searchTerm: term })}
        availableCount={hookState.filteredProperties.length}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
      />

      {/* 🏢 ENTERPRISE: Dashboard section (toggleable) */}
      {hookState.showDashboard && (
        <UnifiedDashboard
          stats={dashboardStatsFormatted}
          columns={4}
        />
      )}

      {/* 🏢 ENTERPRISE: Advanced Filters Panel (centralized) */}
      <div className={`${spacing.padding.md} border-b bg-card`}>
        <AdvancedFiltersPanel
          config={propertyFiltersConfig}
          filters={enterpriseFilters}
          onFiltersChange={handleEnterpriseFilterChange}
          className="w-full"
        />
      </div>

      {/* Property viewer layout */}
      <ReadOnlyPropertyViewerLayout
        {...viewerProps}
        isLoading={hookState.isLoading}
        viewMode={hookState.viewMode}
        showDashboard={false}
        stats={hookState.dashboardStats}
        filteredProperties={hookState.filteredProperties}
        handleUpdateProperty={() => {}}
      />
    </section>
  );
}
