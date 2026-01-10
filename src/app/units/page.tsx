'use client';

import React, { useCallback, Suspense } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useUnitsViewerState } from '@/hooks/useUnitsViewerState';
import { UnitsHeader } from '@/components/units/page/UnitsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  TrendingUp,
  BarChart3,
  MapPin,
  Package,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// 🏢 ENTERPRISE: Navigation context for breadcrumb sync
import { useNavigation } from '@/components/navigation/core/NavigationContext';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { StatusCard } from '@/components/property-management/dashboard/StatusCard';
import { DetailsCard } from '@/components/property-management/dashboard/DetailsCard';
import { AdvancedFiltersPanel, unitFiltersConfig, defaultUnitFilters, type UnitFilterState } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer } from '@/core/containers';
import { UnitsSidebar } from '@/components/units/UnitsSidebar';
import { PropertyGridViewCompatible as PropertyGridView } from '@/components/property-viewer/PropertyGrid';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UNIFIED_STATUS_FILTER_LABELS } from '@/constants/property-statuses-enterprise';

// ✅ ENTERPRISE: Helper function using centralized status labels
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'sold': return 'Πουλημένες';
    case 'available': return UNIFIED_STATUS_FILTER_LABELS.AVAILABLE;
    case 'reserved': return UNIFIED_STATUS_FILTER_LABELS.RESERVED;
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
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Navigation context for breadcrumb sync
  const { companies, projects, syncBreadcrumb } = useNavigation();
  const { buildings } = useFirestoreBuildings();

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

  // Search state (for header search)
  const [searchTerm, setSearchTerm] = React.useState('');

  // Mobile-only filter toggle state
  const [showFilters, setShowFilters] = React.useState(false);

  // 🔥 NEW: Dashboard card filtering state
  const [activeCardFilter, setActiveCardFilter] = React.useState<string | null>(null);

  // 🏢 ENTERPRISE: Sync selectedUnit with NavigationContext for breadcrumb display
  React.useEffect(() => {
    if (selectedUnit && buildings.length > 0 && companies.length > 0 && projects.length > 0) {
      // Find the building this unit belongs to
      const building = buildings.find(b => b.id === selectedUnit.buildingId);
      if (building && building.projectId) {
        // Find the project and company
        const project = projects.find(p => p.id === building.projectId);
        if (project && project.companyId) {
          const company = companies.find(c => c.id === project.companyId);
          if (company) {
            // Use atomic sync with names - enterprise pattern
            syncBreadcrumb({
              company: { id: company.id, name: company.companyName },
              project: { id: project.id, name: project.name },
              building: { id: building.id, name: building.name },
              unit: { id: selectedUnit.id, name: selectedUnit.name || selectedUnit.title || selectedUnit.id },
              currentLevel: 'units'
            });
          }
        }
      }
    }
  }, [selectedUnit?.id, buildings.length, companies.length, projects.length, syncBreadcrumb]);

  const safeFloors = Array.isArray(floors) ? floors : [];
  const safeFilteredProperties = Array.isArray(filteredProperties) ? filteredProperties : [];

  // Apply search to filtered properties
  const searchFilteredProperties = React.useMemo(() => {
    if (!searchTerm.trim()) return safeFilteredProperties;

    return safeFilteredProperties.filter(property =>
      property.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.propertyType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.status?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [safeFilteredProperties, searchTerm]);

  // Transform dashboardStats object to DashboardStat array
  const unifiedDashboardStats: DashboardStat[] = [
    {
      title: "Σύνολο Μονάδων",
      value: dashboardStats.totalProperties,
      icon: NAVIGATION_ENTITIES.unit.icon,
      color: "blue"
    },
    {
      title: UNIFIED_STATUS_FILTER_LABELS.AVAILABLE,
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
      icon: NAVIGATION_ENTITIES.building.icon,
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
        case UNIFIED_STATUS_FILTER_LABELS.AVAILABLE:
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
      <PageContainer ariaLabel="Διαχείριση Μονάδων">
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
                <DetailsCard title="Τύποι Μονάδων" icon={Building2} data={dashboardStats.propertiesByType} labelFormatter={getTypeLabel} />
                <DetailsCard title="Κατανομή ανά Όροφο" icon={MapPin} data={dashboardStats.propertiesByFloor} isFloorData={true} />
                <DetailsCard
                  title="Αποθήκες"
                  icon={Package}
                  data={{
                    'Σύνολο': dashboardStats.totalStorageUnits,
                    [UNIFIED_STATUS_FILTER_LABELS.AVAILABLE]: dashboardStats.availableStorageUnits,
                    'Πουλημένες': dashboardStats.soldStorageUnits,
                  }}
                  isThreeColumnGrid={true}
                />
              </>
            }
          />
        )}

        {/* Desktop: Always visible filters */}
        <div className="hidden md:block">
          <AdvancedFiltersPanel
            config={unitFiltersConfig}
            filters={filters as UnitFilterState}
            onFiltersChange={handleFiltersChange}
          />
        </div>

        {/* Mobile: Show only when showFilters is true */}
        {showFilters && (
          <div className="md:hidden">
            <AdvancedFiltersPanel
              config={unitFiltersConfig}
              filters={filters as UnitFilterState}
              onFiltersChange={handleFiltersChange}
              defaultOpen={true}
            />
          </div>
        )}

        <ListContainer>
          {viewMode === 'list' ? (
            <UnitsSidebar
              units={searchFilteredProperties as any}
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
        </ListContainer>

        {showHistoryPanel && (
          <div className="fixed inset-0 z-50">
            {/* Placeholder for VersionHistoryPanel */}
          </div>
        )}
      </PageContainer>
    </TooltipProvider>
  );
}

function UnitsPageFallback() {
  const colors = useSemanticColors();

  return (
    <div className={`min-h-screen ${colors.bg.secondary} dark:${colors.bg.primary} flex items-center justify-center`}>
      <div className="text-center">
        <AnimatedSpinner size="large" className="mx-auto mb-4" />
        <p className={`${colors.text.muted}`}>Φόρτωση μονάδων...</p>
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
