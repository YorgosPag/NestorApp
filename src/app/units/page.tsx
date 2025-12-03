'use client';

import React, { useCallback, Suspense } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useUnitsViewerState } from '@/hooks/useUnitsViewerState';
import { HeaderControls } from '@/components/units/HeaderControls';
import { UnifiedDashboard, type DashboardStat } from '@/core/dashboards/UnifiedDashboard';
import {
  Home,
  TrendingUp,
  BarChart3,
  MapPin,
  Package,
  Building2,
} from 'lucide-react';
import { StatusCard } from '@/components/property-management/dashboard/StatusCard';
import { DetailsCard } from '@/components/property-management/dashboard/DetailsCard';
import { AdvancedFiltersPanel, unitFiltersConfig, defaultUnitFilters, type UnitFilterState } from '@/components/core/AdvancedFilters';
import { UnitsSidebar } from '@/components/units/UnitsSidebar';
import { PropertyGridView } from '@/features/property-grid/PropertyGridView';

// Helper functions for labels (from original PropertyDashboard)
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'sold': return 'Πουλημένες';
    case 'available': return 'Διαθέσιμες';
    case 'reserved': return 'Κρατημένες';
    case 'owner': return 'Οικοπεδούχου';
    case 'for-sale': return 'Προς πώληση';
    case 'for-rent': return 'Προς ενοικίαση';
    case 'rented': return 'Ενοικιασμένες';
    default: return status;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'apartment': return 'Διαμερίσματα';
    case 'studio': return 'Στούντιο';
    case 'maisonette': return 'Μεζονέτες';
    case 'shop': return 'Καταστήματα';
    case 'office': return 'Γραφεία';
    case 'storage': return 'Αποθήκες';
    default: return type;
  }
};

function UnitsPageContent() {
  const {
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

  // 🔥 NEW: Dashboard card filtering state
  const [activeCardFilter, setActiveCardFilter] = React.useState<string | null>(null);

  const safeFloors = Array.isArray(floors) ? floors : [];
  const safeFilteredProperties = Array.isArray(filteredProperties) ? filteredProperties : [];

  // Transform dashboardStats object to DashboardStat array
  const unifiedDashboardStats: DashboardStat[] = [
    {
      title: "Σύνολο Μονάδων",
      value: dashboardStats.totalProperties,
      icon: Home,
      color: "blue"
    },
    {
      title: "Διαθέσιμες",
      value: dashboardStats.availableProperties,
      icon: TrendingUp,
      color: "green"
    },
    {
      title: "Πωληθείσες",
      value: dashboardStats.soldProperties,
      icon: BarChart3,
      color: "purple"
    },
    {
      title: "Συνολική Αξία",
      value: `€${(dashboardStats.totalValue / 1000000).toFixed(1)}M`,
      icon: MapPin,
      color: "orange"
    },
    {
      title: "Συνολική Επιφάνεια",
      value: `${(dashboardStats.totalArea / 1000).toFixed(1)}K m²`,
      icon: Package,
      color: "cyan"
    },
    {
      title: "Μοναδικά Κτίρια",
      value: dashboardStats.uniqueBuildings,
      icon: Building2,
      color: "pink"
    }
  ];

  // 🔥 NEW: Handle dashboard card clicks για filtering
  const handleCardClick = (stat: DashboardStat, index: number) => {
    const cardTitle = stat.title;

    // Toggle filter: αν κλικάρουμε την ίδια κάρτα, αφαιρούμε το φίλτρο
    if (activeCardFilter === cardTitle) {
      setActiveCardFilter(null);
      // Reset filters to show all units
      handleFiltersChange({ ...filters, status: [] });
    } else {
      setActiveCardFilter(cardTitle);

      // Apply filter based on card type
      switch (cardTitle) {
        case 'Σύνολο Μονάδων':
          // Show all units - reset filters
          handleFiltersChange({ ...filters, status: [] });
          break;
        case 'Διαθέσιμες':
          // Filter only available units
          handleFiltersChange({ ...filters, status: ['available'] });
          break;
        case 'Πωληθείσες':
          // Filter only sold units
          handleFiltersChange({ ...filters, status: ['sold'] });
          break;
        // Note: Other cards (Συνολική Αξία, Συνολική Επιφάνεια, Μοναδικά Κτίρια)
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
    <TooltipProvider>
      <div className="h-full flex flex-col bg-background">
        <HeaderControls
          viewMode={viewMode as 'list' | 'grid' | 'byType' | 'byStatus'}
          setViewMode={setViewMode}
          showDashboard={showDashboard}
          setShowDashboard={setShowDashboard}
        />

        {showDashboard && (
          <UnifiedDashboard
            stats={unifiedDashboardStats}
            columns={6}
            onCardClick={handleCardClick}
            additionalContainers={
              <>
                <StatusCard statsByStatus={dashboardStats.propertiesByStatus} getStatusLabel={getStatusLabel} />
                <DetailsCard title="Τύποι Μονάδων" icon={Building2} data={dashboardStats.propertiesByType} labelFormatter={getTypeLabel} />
                <DetailsCard title="Κατανομή ανά Όροφο" icon={MapPin} data={dashboardStats.propertiesByFloor} isFloorData={true} />
                <DetailsCard
                  title="Αποθήκες"
                  icon={Package}
                  data={{
                    'Σύνολο': dashboardStats.totalStorageUnits,
                    'Διαθέσιμες': dashboardStats.availableStorageUnits,
                    'Πουλημένες': dashboardStats.soldStorageUnits,
                  }}
                  isThreeColumnGrid={true}
                />
              </>
            }
          />
        )}
        
        <AdvancedFiltersPanel
          config={unitFiltersConfig}
          filters={filters as UnitFilterState}
          onFiltersChange={handleFiltersChange}
        />

        <main className="flex-1 flex overflow-hidden p-4 gap-4">
          {viewMode === 'list' ? (
            <UnitsSidebar
              units={safeFilteredProperties as any}
              selectedUnit={selectedUnit || null}
              onSelectUnit={handlePolygonSelect}
              selectedUnitIds={selectedPropertyIds}
              viewerProps={viewerProps}
              floors={safeFloors} 
              setShowHistoryPanel={setShowHistoryPanel}
              onAssignmentSuccess={handleAssignmentSuccess}
            />
          ) : (
            <PropertyGridView />
          )}
        </main>
        
        {showHistoryPanel && (
          <div className="fixed inset-0 z-50">
            {/* Placeholder for VersionHistoryPanel */}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function UnitsPageFallback() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-muted-foreground">Φόρτωση μονάδων...</p>
      </div>
    </div>
  );
}

export default function UnitsPage() {
  return (
    <Suspense fallback={<UnitsPageFallback />}>
      <UnitsPageContent />
    </Suspense>
  );
}
