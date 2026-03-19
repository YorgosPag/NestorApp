'use client';

import React, { useCallback, useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { useUnitsViewerState } from '@/hooks/useUnitsViewerState';
import { UnitsHeader } from '@/components/units/page/UnitsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  TrendingUp,
  MapPin,
  Package,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// 🏢 ENTERPRISE: Navigation context for breadcrumb sync
import { useNavigation } from '@/components/navigation/core/NavigationContext';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { UnitHierarchyResponse } from '@/app/api/units/[id]/hierarchy/route';
import { StatusCard } from '@/components/property-management/dashboard/StatusCard';
import { DetailsCard } from '@/components/property-management/dashboard/DetailsCard';
import { CoverageCard } from '@/components/property-management/dashboard/CoverageCard';
import { AdvancedFiltersPanel, unitFiltersConfig, type UnitFilterState } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer } from '@/core/containers';
import { UnitsSidebar } from '@/components/units/UnitsSidebar';
import { PropertyGridViewCompatible as PropertyGridView } from '@/components/property-viewer/PropertyGrid';
// 🏢 ENTERPRISE: Import from canonical location
import { PageLoadingState, StaticPageLoading } from '@/core/states';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Property } from '@/types/property-viewer';

// 🏢 ENTERPRISE: Translation key type for OPERATIONAL status labels (Physical Truth - No Sales!)
type OperationalStatusKey = 'ready' | 'underConstruction' | 'inspection' | 'maintenance' | 'draft';
// 🏢 ENTERPRISE: Translation key type for type labels
type TypeKey = 'apartment' | 'studio' | 'maisonette' | 'shop' | 'office' | 'storage';

// ✅ ENTERPRISE: Factory function that creates an OPERATIONAL status label getter
// 🎯 DOMAIN SEPARATION: Units = Physical Truth, NO sales statuses!
const createStatusLabelGetter = (t: (key: string) => string) => (status: string): string => {
  const operationalStatuses: OperationalStatusKey[] = ['ready', 'underConstruction', 'inspection', 'maintenance', 'draft'];
  if (operationalStatuses.includes(status as OperationalStatusKey)) {
    return t(`operationalStatus.${status}`);
  }
  return status;
};

// ✅ ENTERPRISE: Factory function that creates a type label getter with translation support
const createTypeLabelGetter = (t: (key: string) => string) => (type: string): string => {
  const knownTypes: TypeKey[] = ['apartment', 'studio', 'maisonette', 'shop', 'office', 'storage'];
  if (knownTypes.includes(type as TypeKey)) {
    return t(`page.typeLabels.${type}`);
  }
  return type;
};

function UnitsPageContent() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('units');
  const colors = useSemanticColors();
  const searchParams = useSearchParams();
  const urlUnitId = searchParams.get('unitId');
  const urlTab = searchParams.get('tab');

  // 🏢 ENTERPRISE: Create label getters with translation support
  const getStatusLabel = React.useMemo(() => createStatusLabelGetter(t), [t]);
  const getTypeLabel = React.useMemo(() => createTypeLabelGetter(t), [t]);

  // 🏢 ENTERPRISE: Navigation context for breadcrumb sync
  const { syncBreadcrumb } = useNavigation();

  const {
    properties,
    loading,
    setProperties,
    selectedPropertyIds,
    hoveredPropertyId,
    selectedFloorId,
    onHoverProperty,
    onSelectFloor,
    undo,
    redo,
    canUndo,
    canRedo,
    setSelectedProperties,
    floors,
    activeTool,
    setActiveTool,
    viewMode,
    setViewMode,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    gridSize,
    setGridSize,
    showMeasurements,
    setShowMeasurements,
    scale,
    setScale,
    showHistoryPanel,
    setShowHistoryPanel,
    showDashboard,
    setShowDashboard,
    suggestionToDisplay,
    setSuggestionToDisplay,
    connections,
    setConnections,
    groups,
    setGroups,
    isConnecting,
    setIsConnecting,
    firstConnectionPoint,
    setFirstConnectionPoint,
    filters,
    handleFiltersChange,
    filteredProperties,
    dashboardStats,
    selectedUnit,
    handleSelectUnit,
    handlePolygonSelect,
    handlePolygonCreated,
    handlePolygonUpdated,
    handleDuplicate,
    handleDelete,
    forceDataRefresh,
  } = useUnitsViewerState();

  // 🏢 ENTERPRISE: Inline new unit creation state (replaces AddUnitDialog modal)
  const [isCreatingNewUnit, setIsCreatingNewUnit] = useState(false);
  const [newUnitTemplate, setNewUnitTemplate] = useState<Property | null>(null);

  // 🏢 ENTERPRISE: Start inline new unit creation
  const handleNewUnitInline = useCallback(() => {
    const blankUnit: Property = {
      id: '__new__',
      name: '',
      type: '',
      status: 'reserved',
      operationalStatus: 'draft',
      floor: 0,
      area: 0,
      layout: { bedrooms: 0, bathrooms: 0, wc: 0 },
      areas: { gross: 0 },
      orientations: [],
      buildingId: '',
      floorId: '',
      vertices: [],
      building: '',
      project: '',
    };
    setNewUnitTemplate(blankUnit);
    setIsCreatingNewUnit(true);
    // Select the template so it shows in the details panel
    handlePolygonSelect('__new__', false);
  }, [handlePolygonSelect]);

  // 🏢 ENTERPRISE: Callback when new unit is successfully created
  const handleUnitCreated = useCallback((unitId: string) => {
    setIsCreatingNewUnit(false);
    setNewUnitTemplate(null);
    forceDataRefresh();
    // Select the newly created unit
    handlePolygonSelect(unitId, false);
  }, [forceDataRefresh, handlePolygonSelect]);

  // 🏢 ENTERPRISE: Cancel new unit creation
  const handleCancelCreate = useCallback(() => {
    setIsCreatingNewUnit(false);
    setNewUnitTemplate(null);
    handlePolygonSelect('__none__', false);
  }, [handlePolygonSelect]);

  // 🏢 ENTERPRISE: Delete unit handler — Firestore + local state sync
  const handleDeleteUnit = useCallback(async (unitId: string) => {
    try {
      const { deleteUnit } = await import('@/services/units.service');
      await deleteUnit(unitId);
      handleDelete(unitId);
      // Deselect the deleted unit
      handlePolygonSelect('__none__', false);
    } catch {
      // Error is logged in the service
    }
  }, [handleDelete, handlePolygonSelect]);

  // Search state (for header search)
  const [searchTerm, setSearchTerm] = React.useState('');

  // Mobile-only filter toggle state
  const [showFilters, setShowFilters] = React.useState(false);

  // 🔥 NEW: Dashboard card filtering state
  const [activeCardFilter, setActiveCardFilter] = React.useState<string | null>(null);

  // 🏢 ENTERPRISE: Auto-select unit from URL query param (?unitId=xxx&tab=yyy)
  useEffect(() => {
    if (urlUnitId && properties.length > 0 && !selectedUnit) {
      const found = properties.find(p => p.id === urlUnitId);
      if (found) {
        handlePolygonSelect(urlUnitId, false);
      }
    }
  }, [urlUnitId, properties, selectedUnit, handlePolygonSelect]);

  // 🏢 ENTERPRISE: Sync breadcrumb via hierarchy API (robust — no multi-source chain lookup)
  React.useEffect(() => {
    if (!selectedUnit) return;
    let cancelled = false;

    async function syncFromHierarchy() {
      try {
        const data = await apiClient.get<UnitHierarchyResponse>(
          API_ROUTES.UNITS.HIERARCHY(encodeURIComponent(selectedUnit!.id))
        );
        if (cancelled || !data.company || !data.project) return;
        syncBreadcrumb({
          company: { id: data.company.id, name: data.company.name },
          project: { id: data.project.id, name: data.project.name },
          building: data.building
            ? { id: data.building.id, name: data.building.name }
            : undefined,
          unit: { id: data.unit.id, name: data.unit.name },
          currentLevel: 'units',
        });
      } catch {
        // Graceful — breadcrumb won't sync but page still works
      }
    }

    syncFromHierarchy();
    return () => { cancelled = true; };
  }, [selectedUnit?.id, syncBreadcrumb]);

  const safeFloors = Array.isArray(floors) ? floors : [];
  const safeFilteredProperties = Array.isArray(filteredProperties) ? filteredProperties : [];

  // Apply search to filtered properties
  const searchFilteredProperties = React.useMemo(() => {
    if (!searchTerm.trim()) return safeFilteredProperties;

    return safeFilteredProperties.filter(property =>
      // 🏢 ENTERPRISE: Use correct Property fields for search
      property.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.building?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.status?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [safeFilteredProperties, searchTerm]);

  // Transform dashboardStats object to DashboardStat array
  // 🎯 DOMAIN SEPARATION: Units = Physical Truth - NO SALES METRICS!
  const unifiedDashboardStats: DashboardStat[] = [
    {
      title: t('page.dashboard.totalUnits'),
      value: dashboardStats.totalProperties,
      icon: NAVIGATION_ENTITIES.unit.icon,
      color: "blue"
    },
    // 🏢 ENTERPRISE: Operational status "Ready" instead of sales "Available"
    {
      title: t('operationalStatus.ready'),
      value: dashboardStats.availableProperties, // Ready units (physical status)
      icon: TrendingUp,
      color: "green"
    },
    // ❌ REMOVED: "Sold Units" card - SALES DATA (moved to /sales dashboard)
    // ❌ REMOVED: Total Value card - SALES DATA (moved to /sales dashboard)
    {
      title: t('page.dashboard.totalArea'),
      value: `${(dashboardStats.totalArea / 1000).toFixed(1)}K m²`,
      icon: Package,
      color: "cyan"
    },
    {
      title: t('page.dashboard.uniqueBuildings'),
      value: dashboardStats.uniqueBuildings,
      icon: NAVIGATION_ENTITIES.building.icon,
      color: "pink"
    }
  ];

  // ✅ ENTERPRISE: Coverage filter handlers for CoverageCard click-to-filter
  const handleMissingPhotosClick = useCallback(() => {
    handleFiltersChange({
      ...filters,
      coverage: { missingPhotos: true }
    });
  }, [filters, handleFiltersChange]);

  const handleMissingFloorplansClick = useCallback(() => {
    handleFiltersChange({
      ...filters,
      coverage: { missingFloorplans: true }
    });
  }, [filters, handleFiltersChange]);

  const handleMissingDocumentsClick = useCallback(() => {
    handleFiltersChange({
      ...filters,
      coverage: { missingDocuments: true }
    });
  }, [filters, handleFiltersChange]);

  // 🔥 NEW: Handle dashboard card clicks για filtering
  // 🎯 DOMAIN SEPARATION: Units = Physical Truth - Operational status filters only!
  const handleCardClick = (stat: DashboardStat, index: number) => {
    const cardTitle = stat.title;
    const totalUnitsTitle = t('page.dashboard.totalUnits');
    const readyTitle = t('operationalStatus.ready');

    // Toggle filter: αν κλικάρουμε την ίδια κάρτα, αφαιρούμε το φίλτρο
    if (activeCardFilter === cardTitle) {
      setActiveCardFilter(null);
      // Reset filters to show all units
      handleFiltersChange({ ...filters, status: [] });
    } else {
      setActiveCardFilter(cardTitle);

      // Apply filter based on card type - OPERATIONAL STATUS ONLY
      switch (cardTitle) {
        case totalUnitsTitle:
          // Show all units - reset filters
          handleFiltersChange({ ...filters, status: [] });
          break;
        case readyTitle:
          // Filter only "ready" units (operational status)
          handleFiltersChange({ ...filters, status: ['ready'] });
          break;
        // ❌ REMOVED: soldUnitsTitle filter - SALES DATA (moved to /sales)
        // Note: Other cards (Total Area, Unique Buildings)
        // are informational and don't apply specific filters
        default:
          // For other stats, just clear active filter without changing data
          setActiveCardFilter(null);
          break;
      }

      // Clear selected unit when filtering changes
      if (setSelectedProperties) {
        setSelectedProperties([]);
      }
    }
  };

  const handleAssignmentSuccess = useCallback(() => {
    forceDataRefresh();
    if (setSelectedProperties) {
      setSelectedProperties([]);
    }
  }, [forceDataRefresh, setSelectedProperties]);

  // ADR-229 Phase 2: Data-level loading guard (after all hooks)
  if (loading) {
    return (
      <PageContainer ariaLabel={t('page.pageLabel')}>
        <PageLoadingState icon={NAVIGATION_ENTITIES.unit.icon} message={t('page.loading', { defaultValue: 'Φόρτωση μονάδων...' })} layout="contained" />
      </PageContainer>
    );
  }

  const viewerProps = {
    properties,
    setProperties,
    selectedPropertyIds,
    hoveredPropertyId,
    selectedFloorId,
    onHoverProperty,
    onSelectFloor,
    undo,
    redo,
    canUndo,
    canRedo,
    setSelectedProperties,
    floors: safeFloors,
    activeTool,
    setActiveTool,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    gridSize,
    setGridSize,
    showMeasurements,
    setShowMeasurements,
    scale,
    setScale,
    handlePolygonSelect,
    handlePolygonCreated,
    handlePolygonUpdated,
    handleDuplicate,
    handleDelete,
    suggestionToDisplay,
    connections,
    setConnections,
    groups,
    setGroups,
    isConnecting,
    setIsConnecting,
    firstConnectionPoint,
    setFirstConnectionPoint,
  };

  return (
    <PageContainer ariaLabel={t('page.pageLabel')}>
        <UnitsHeader
          viewMode={viewMode as 'list' | 'grid'}
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
            onCardClick={handleCardClick}
            additionalContainers={
              <>
                <StatusCard statsByStatus={dashboardStats.propertiesByStatus} getStatusLabel={getStatusLabel} />
                <DetailsCard title={t('page.dashboard.unitTypes')} icon={NAVIGATION_ENTITIES.unit.icon} data={dashboardStats.propertiesByType} labelFormatter={getTypeLabel} />
                <DetailsCard title={t('page.dashboard.floorDistribution')} icon={MapPin} data={dashboardStats.propertiesByFloor} isFloorData />
                {/* ✅ ENTERPRISE: Coverage card for documentation completeness (PR1.2) */}
                <CoverageCard
                  coverage={dashboardStats.coverage}
                  onMissingPhotosClick={handleMissingPhotosClick}
                  onMissingFloorplansClick={handleMissingFloorplansClick}
                  onMissingDocumentsClick={handleMissingDocumentsClick}
                />
                {/* 🎯 DOMAIN SEPARATION: Storages card removed (separate entity, not Unit subtype) */}
                {/* Storage units have their own module at /spaces/storage */}
              </>
            }
          />
        )}

        {/* Desktop: Always visible filters */}
        <div className="hidden md:block -mt-1">
          <AdvancedFiltersPanel
            config={unitFiltersConfig}
            filters={filters as unknown as UnitFilterState}
            onFiltersChange={handleFiltersChange}
          />
        </div>

        {/* Mobile: Show only when showFilters is true */}
        {showFilters && (
          <div className="md:hidden">
            <AdvancedFiltersPanel
              config={unitFiltersConfig}
              filters={filters as unknown as UnitFilterState}
              onFiltersChange={handleFiltersChange}
              defaultOpen
            />
          </div>
        )}

        <ListContainer>
          {viewMode === 'list' ? (
            <UnitsSidebar
              units={searchFilteredProperties}
              selectedUnit={isCreatingNewUnit ? newUnitTemplate : (selectedUnit || null)}
              onSelectUnit={handlePolygonSelect}
              selectedUnitIds={selectedPropertyIds}
              viewerProps={viewerProps}
              floors={safeFloors}
              setShowHistoryPanel={setShowHistoryPanel}
              onAssignmentSuccess={handleAssignmentSuccess}
              onNewUnit={handleNewUnitInline}
              onDeleteUnit={handleDeleteUnit}
              isCreatingNewUnit={isCreatingNewUnit}
              onUnitCreated={handleUnitCreated}
              onCancelCreate={handleCancelCreate}
              defaultTab={urlTab || undefined}
            />
          ) : (
            // ✅ ENTERPRISE: Pass filtered properties + selection to grid (Single Source of Truth)
            // 🏢 PR: Grid Selection Styling - Blue border + blue background on selected cards
            <PropertyGridView
              properties={searchFilteredProperties}
              selectedPropertyIds={selectedPropertyIds}
              onSelect={handlePolygonSelect}
            />
          )}
        </ListContainer>

        {showHistoryPanel && (
          <div className="fixed inset-0 z-50">
            {/* Placeholder for VersionHistoryPanel */}
          </div>
        )}
      </PageContainer>
  );
}

export default function UnitsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <UnitsPageContent />
    </Suspense>
  );
}
