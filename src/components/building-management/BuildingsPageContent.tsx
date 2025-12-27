
'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';
import { BuildingsList } from './BuildingsList';
import { BuildingDetails } from './BuildingDetails';
import { BuildingsHeader } from './BuildingsPage/BuildingsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Building,
  TrendingUp,
  BarChart3,
  MapPin,
  Calendar,
  Home,
  Edit,
  Trash2
} from 'lucide-react';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { BuildingsGroupedView } from './BuildingsPage/BuildingsGroupedView';
import { useBuildingsPageState } from '@/hooks/useBuildingsPageState';
import { useBuildingStats } from '@/hooks/useBuildingStats';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { getCompanies, getProjectsList } from './building-services';
import { AdvancedFiltersPanel, buildingFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer } from '@/core/containers';

// Re-export Building type for backward compatibility
export type { Building } from '@/types/building/contracts';

export function BuildingsPageContent() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

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
        <main className={`h-full flex flex-col ${colors.bg.primary}`} role="main" aria-label="Φόρτωση Κτιρίων">
          <section className="flex-1 flex items-center justify-center" role="status" aria-live="polite">
            <div className="text-center">
              <AnimatedSpinner size="large" className="mx-auto mb-4" />
              <p>Φόρτωση κτιρίων από Firestore...</p>
            </div>
          </section>
        </main>
      </TooltipProvider>
    );
  }

  // Show error state
  if (buildingsError) {
    return (
      <TooltipProvider>
        <main className={`h-full flex flex-col ${colors.bg.primary}`} role="main" aria-label="Σφάλμα Κτιρίων">
          <section className="flex-1 flex items-center justify-center" role="alert" aria-label="Σφάλμα Φόρτωσης">
            <div className="text-center text-red-500">
              <p className="mb-4">❌ Σφάλμα φόρτωσης κτιρίων:</p>
              <p className="text-sm">{buildingsError}</p>
            </div>
          </section>
        </main>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <main className={`h-full flex flex-col ${colors.bg.primary}`} role="main" aria-label="Διαχείριση Κτιρίων">
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

        {showDashboard && (
          <section role="region" aria-label="Στατιστικά Κτιρίων">
            <UnifiedDashboard stats={dashboardStats} columns={6} onCardClick={handleCardClick} />
          </section>
        )}

        {/* Advanced Filters Panel - Desktop */}
        <aside className="hidden md:block" role="complementary" aria-label="Φίλτρα Κτιρίων">
          <AdvancedFiltersPanel
            config={buildingFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Advanced Filters Panel - Mobile (conditional) */}
        {showFilters && (
          <aside className="md:hidden" role="complementary" aria-label="Φίλτρα Κτιρίων Mobile">
            <AdvancedFiltersPanel
              config={buildingFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen={true}
            />
          </aside>
        )}

        <ListContainer>
          {viewMode === 'list' ? (
            <>
              {/* 🖥️ DESKTOP: Standard split layout */}
              <section className="hidden md:flex flex-1 gap-4 min-h-0" role="region" aria-label="Προβολή Κτιρίων Desktop">
                <BuildingsList
                  buildings={finalFilteredBuildings}
                  selectedBuilding={selectedBuilding!}
                  onSelectBuilding={setSelectedBuilding}
                />
                <BuildingDetails building={selectedBuilding!} />
              </section>

              {/* 📱 MOBILE: Show only BuildingsList when no building is selected */}
              <section className={`md:hidden w-full ${selectedBuilding ? 'hidden' : 'block'}`} role="region" aria-label="Λίστα Κτιρίων Mobile">
                <BuildingsList
                  buildings={finalFilteredBuildings}
                  selectedBuilding={selectedBuilding!}
                  onSelectBuilding={setSelectedBuilding}
                />
              </section>

              {/* 📱 MOBILE: Slide-in BuildingDetails when building is selected */}
              <MobileDetailsSlideIn
                isOpen={!!selectedBuilding}
                onClose={() => setSelectedBuilding(null)}
                title={selectedBuilding?.name || 'Λεπτομέρειες Κτιρίου'}
                actionButtons={
                  <>
                    <button
                      onClick={() => {/* TODO: Edit building handler */}}
                      className={cn(
                        `p-2 rounded-md border ${colors.bg.primary} border-border`,
                        INTERACTIVE_PATTERNS.ACCENT_HOVER,
                        TRANSITION_PRESETS.STANDARD_COLORS
                      )}
                      aria-label="Επεξεργασία Κτιρίου"
                    >
                      <Edit className={iconSizes.sm} />
                    </button>
                    <button
                      onClick={() => {/* TODO: Delete building handler */}}
                      className={cn(
                        `p-2 rounded-md border ${colors.bg.primary} border-border text-destructive`,
                        INTERACTIVE_PATTERNS.ACCENT_HOVER,
                        TRANSITION_PRESETS.STANDARD_COLORS
                      )}
                      aria-label="Διαγραφή Κτιρίου"
                    >
                      <Trash2 className={iconSizes.sm} />
                    </button>
                  </>
                }
              >
                {selectedBuilding && <BuildingDetails building={selectedBuilding} />}
              </MobileDetailsSlideIn>
            </>
          ) : (
            <BuildingsGroupedView
              viewMode={viewMode}
              filteredBuildings={finalFilteredBuildings}
              selectedBuilding={selectedBuilding}
              setSelectedBuilding={setSelectedBuilding}
            />
          )}
        </ListContainer>
      </main>
    </TooltipProvider>
  );
}

export default BuildingsPageContent;
