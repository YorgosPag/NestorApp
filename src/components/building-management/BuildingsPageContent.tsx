
'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BuildingsList } from './BuildingsList';
import { BuildingDetails } from './BuildingDetails';
import { BuildingsHeader } from './BuildingsPage/BuildingsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/core/dashboards/UnifiedDashboard';
import {
  Building,
  TrendingUp,
  BarChart3,
  MapPin,
  Calendar,
  Home
} from 'lucide-react';
import { BuildingsGroupedView } from './BuildingsPage/BuildingsGroupedView';
import { useBuildingsPageState } from '@/hooks/useBuildingsPageState';
import { useBuildingStats } from '@/hooks/useBuildingStats';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { companies, projects } from './mockData';
import { AdvancedFiltersPanel, buildingFiltersConfig } from '@/components/core/AdvancedFilters';

// Re-export Building type for backward compatibility
export type { Building } from '@/types/building/contracts';

export function BuildingsPageContent() {
  // Load buildings from Firestore
  const { buildings: buildingsData, loading: buildingsLoading, error: buildingsError } = useFirestoreBuildings();

  const {
    selectedBuilding,
    setSelectedBuilding,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredBuildings: baseFilteredBuildings,
    filters,
    setFilters,
  } = useBuildingsPageState(buildingsData);

  // Search state (for header search)
  const [searchTerm, setSearchTerm] = React.useState('');

  // Mobile-only filter toggle state
  const [showFilters, setShowFilters] = React.useState(false);

  // Apply search to the already filtered buildings from hook
  const finalFilteredBuildings = React.useMemo(() => {
    if (!searchTerm.trim()) return baseFilteredBuildings;

    return baseFilteredBuildings.filter(building =>
      building.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      building.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      building.type?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [baseFilteredBuildings, searchTerm]);

  const buildingsStats = useBuildingStats(finalFilteredBuildings);

  // 🔥 NEW: Dashboard card filtering state
  const [activeCardFilter, setActiveCardFilter] = React.useState<string | null>(null);

  // Transform stats to UnifiedDashboard format
  const dashboardStats: DashboardStat[] = [
    {
      title: "Σύνολο Κτιρίων",
      value: buildingsStats.totalBuildings,
      icon: Building,
      color: "blue"
    },
    {
      title: "Ενεργά Έργα",
      value: buildingsStats.activeProjects,
      icon: TrendingUp,
      color: "green"
    },
    {
      title: "Συνολική Αξία",
      value: `€${(buildingsStats.totalValue / 1000000).toFixed(1)}M`,
      icon: BarChart3,
      color: "purple"
    },
    {
      title: "Συνολική Επιφάνεια",
      value: `${(buildingsStats.totalArea / 1000).toFixed(1)}K m²`,
      icon: MapPin,
      color: "orange"
    },
    {
      title: "Μέση Πρόοδος",
      value: `${buildingsStats.averageProgress}%`,
      icon: Calendar,
      color: "cyan"
    },
    {
      title: "Σύνολο Μονάδων",
      value: buildingsStats.totalUnits,
      icon: Home,
      color: "pink"
    }
  ];

  // 🔥 NEW: Handle dashboard card clicks για filtering
  const handleCardClick = (stat: DashboardStat, index: number) => {
    const cardTitle = stat.title;

    // Toggle filter: αν κλικάρουμε την ίδια κάρτα, αφαιρούμε το φίλτρο
    if (activeCardFilter === cardTitle) {
      setActiveCardFilter(null);
      // Reset filters to show all buildings
      setFilters({ ...filters, status: [] });
    } else {
      setActiveCardFilter(cardTitle);

      // Apply filter based on card type
      switch (cardTitle) {
        case 'Σύνολο Κτιρίων':
          // Show all buildings - reset filters
          setFilters({ ...filters, status: [] });
          break;
        case 'Ενεργά Έργα':
          // Filter only active buildings
          setFilters({ ...filters, status: ['active'] });
          break;
        // Note: Other cards (Συνολική Αξία, Συνολική Επιφάνεια, Μέση Πρόοδος, Σύνολο Μονάδων)
        // are informational and don't apply specific filters
        default:
          // For other stats, just clear active filter without changing data
          setActiveCardFilter(null);
          break;
      }

      // Clear selected building when filtering changes
      setSelectedBuilding(null);
    }
  };

  // Show loading state
  if (buildingsLoading) {
    return (
      <TooltipProvider>
        <div className="h-full flex flex-col bg-background">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Φόρτωση κτιρίων από Firestore...</p>
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Show error state
  if (buildingsError) {
    return (
      <TooltipProvider>
        <div className="h-full flex flex-col bg-background">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-red-500">
              <p className="mb-4">❌ Σφάλμα φόρτωσης κτιρίων:</p>
              <p className="text-sm">{buildingsError}</p>
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-background">
        <BuildingsHeader
          viewMode={viewMode}
          setViewMode={setViewMode}
          showDashboard={showDashboard}
          setShowDashboard={setShowDashboard}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
        />

        {showDashboard && <UnifiedDashboard stats={dashboardStats} columns={6} onCardClick={handleCardClick} />}

        {/* Advanced Filters Panel */}
        <div className="hidden md:block">
          {/* Desktop: Always visible */}
          <AdvancedFiltersPanel
            config={buildingFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Mobile: Show only when showFilters is true */}
        {showFilters && (
          <div className="md:hidden">
            <AdvancedFiltersPanel
              config={buildingFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen={true}
            />
          </div>
        )}

        <div className="flex-1 flex overflow-hidden p-4 gap-4">
          {viewMode === 'list' ? (
            <>
              <BuildingsList
                buildings={finalFilteredBuildings}
                selectedBuilding={selectedBuilding!}
                onSelectBuilding={setSelectedBuilding}
              />
              <BuildingDetails building={selectedBuilding!} />
            </>
          ) : (
            <BuildingsGroupedView
              viewMode={viewMode}
              filteredBuildings={finalFilteredBuildings}
              selectedBuilding={selectedBuilding}
              setSelectedBuilding={setSelectedBuilding}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
