'use client';

import React, { useCallback, Suspense } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useUnitsViewerState } from '@/hooks/useUnitsViewerState';
import { HeaderControls } from '@/components/units/HeaderControls';
import { DashboardSection } from '@/components/units/DashboardSection';
import { FiltersPanel } from '@/components/units/FiltersPanel';
import { UnitsSidebar } from '@/components/units/UnitsSidebar';
import { PropertyGridView } from '@/features/property-grid/PropertyGridView';

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

  const safeFloors = Array.isArray(floors) ? floors : [];
  const safeFilteredProperties = Array.isArray(filteredProperties) ? filteredProperties : [];
  
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

        {showDashboard && <DashboardSection stats={dashboardStats} />}
        
        <FiltersPanel filters={filters} onFiltersChange={handleFiltersChange} />

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
