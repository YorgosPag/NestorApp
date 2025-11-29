
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
    filteredBuildings,
    filters,
    setFilters,
  } = useBuildingsPageState(buildingsData);

  const buildingsStats = useBuildingStats(buildingsData);

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

  // Debug logging
  console.log('🏗️ BuildingsPageContent Debug:', {
    buildingsCount: buildingsData.length,
    buildingsLoading,
    buildingsError,
    filteredCount: filteredBuildings.length
  });
  
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
        />

        {showDashboard && <UnifiedDashboard stats={dashboardStats} columns={6} />}

        {/* Advanced Filters Panel */}
        <AdvancedFiltersPanel
          config={buildingFiltersConfig}
          filters={filters}
          onFiltersChange={setFilters}
        />

        <div className="flex-1 flex overflow-hidden p-4 gap-4">
          {viewMode === 'list' ? (
            <>
              <BuildingsList
                buildings={filteredBuildings}
                selectedBuilding={selectedBuilding!}
                onSelectBuilding={setSelectedBuilding}
              />
              <BuildingDetails building={selectedBuilding!} />
            </>
          ) : (
            <BuildingsGroupedView
              viewMode={viewMode}
              filteredBuildings={filteredBuildings}
              selectedBuilding={selectedBuilding}
              setSelectedBuilding={setSelectedBuilding}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
