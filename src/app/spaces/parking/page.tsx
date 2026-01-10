'use client';

/**
 * 🅿️ ENTERPRISE PARKING PAGE
 *
 * Σελίδα διαχείρισης θέσεων στάθμευσης
 * Ακολουθεί το exact pattern από storage/page.tsx
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΗ (REAL_ESTATE_HIERARCHY_DOCUMENTATION.md):
 * - Parking είναι παράλληλη κατηγορία με Units/Storage μέσα στο Building
 * - ΟΧΙ children των Units
 * - Ισότιμη οντότητα στην πλοήγηση
 *
 * 🔧 Next.js 15: useParkingPageState uses useSearchParams, requires Suspense
 */

import React, { Suspense } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ParkingsHeader } from '@/components/space-management/ParkingPage/ParkingsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ParkingsList } from '@/components/space-management/ParkingPage/ParkingsList';
import { ParkingDetails } from '@/components/space-management/ParkingPage/ParkingDetails';
import {
  Car,
  TrendingUp,
  BarChart3,
  MapPin,
  Home,
  CheckCircle,
  Euro
} from 'lucide-react';
import { UNIFIED_STATUS_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: Navigation context for breadcrumb sync
import { useNavigation } from '@/components/navigation/core/NavigationContext';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { useParkingPageState } from '@/hooks/useParkingPageState';
import { useParkingStats } from '@/hooks/useParkingStats';
import { useFirestoreParkingSpots } from '@/hooks/useFirestoreParkingSpots';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters';
import { parkingFiltersConfig } from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';
import { ListContainer, PageContainer } from '@/core/containers';
import {
  PARKING_TYPE_LABELS,
  PARKING_STATUS_LABELS
} from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';

function ParkingPageContent() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Navigation context for breadcrumb sync
  const { companies, projects, syncBreadcrumb } = useNavigation();
  const { buildings } = useFirestoreBuildings();

  // Firestore data connection - πραγματικά δεδομένα
  const { parkingSpots, loading, error, refetch } = useFirestoreParkingSpots();

  const {
    selectedParking,
    setSelectedParking,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredParkingSpots,
    filters,
    setFilters,
  } = useParkingPageState(parkingSpots);

  const stats = useParkingStats(filteredParkingSpots);

  // 🏢 ENTERPRISE: Sync selectedParking with NavigationContext for breadcrumb display
  React.useEffect(() => {
    if (selectedParking && buildings.length > 0 && companies.length > 0 && projects.length > 0) {
      // Find the building this parking spot belongs to (by buildingId or projectId)
      const building = selectedParking.buildingId
        ? buildings.find(b => b.id === selectedParking.buildingId)
        : buildings.find(b => b.projectId === String(selectedParking.projectId));

      if (building && building.projectId) {
        // Find the project and company
        const project = projects.find(p => p.id === building.projectId);
        if (project && project.companyId) {
          const company = companies.find(c => c.id === project.companyId);
          if (company) {
            // Use atomic sync with names - enterprise pattern
            // 🏢 ENTERPRISE: Use 'number' property (API returns 'number', not 'code')
            syncBreadcrumb({
              company: { id: company.id, name: company.companyName },
              project: { id: project.id, name: project.name },
              building: { id: building.id, name: building.name },
              space: { id: selectedParking.id, name: selectedParking.number, type: 'parking' },
              currentLevel: 'spaces'
            });
          }
        }
      }
    }
  }, [selectedParking?.id, buildings.length, companies.length, projects.length, syncBreadcrumb]);

  // Search state (for header search)
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  // Dashboard stats from real data
  const dashboardStats: DashboardStat[] = [
    {
      title: "Σύνολο Θέσεων",
      value: stats.totalParkingSpots,
      icon: Car,
      color: "blue"
    },
    {
      title: PARKING_STATUS_LABELS.available,
      value: stats.availableParkingSpots,
      icon: CheckCircle,
      color: "green"
    },
    {
      title: PARKING_STATUS_LABELS.sold,
      value: stats.soldParkingSpots,
      icon: Euro,
      color: "purple"
    },
    {
      title: "Συνολική Επιφάνεια",
      value: `${stats.totalArea.toFixed(1)} m²`,
      icon: MapPin,
      color: "orange"
    },
    {
      title: "Συνολική Αξία",
      value: `${(stats.totalValue / 1000).toFixed(0)}K€`,
      icon: TrendingUp,
      color: "cyan"
    },
    {
      title: "Ποσοστό Πωλήσεων",
      value: `${stats.salesRate}%`,
      icon: BarChart3,
      color: "pink"
    }
  ];

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Car className={`${iconSizes.xl} animate-spin mx-auto mb-4 text-muted-foreground`} />
          <p className="text-muted-foreground">Φόρτωση θέσεων στάθμευσης...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-lg font-medium mb-2">Σφάλμα φόρτωσης</div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Επανάληψη
          </button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <PageContainer ariaLabel="Διαχείριση Parking">
        {/* Header */}
        <ParkingsHeader
            viewMode={viewMode}
            setViewMode={setViewMode}
            showDashboard={showDashboard}
            setShowDashboard={setShowDashboard}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            showFilters={showMobileFilters}
            setShowFilters={setShowMobileFilters}
          />

        {/* Dashboard */}
        {showDashboard && (
          <section role="region" aria-label="Στατιστικά Parking">
            <UnifiedDashboard
              stats={dashboardStats}
              columns={6}
              additionalContainers={
                <>
                  <div className="bg-card rounded-lg border p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <BarChart3 className={iconSizes.sm} />
                      Κατανομή Κατάστασης
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(stats.parkingByStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between text-sm">
                          <span>{PARKING_STATUS_LABELS[status as keyof typeof PARKING_STATUS_LABELS] || status}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-card rounded-lg border p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Car className={iconSizes.sm} />
                      Κατανομή Τύπων
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(stats.parkingByType).map(([type, count]) => (
                        <div key={type} className="flex justify-between text-sm">
                          <span>{PARKING_TYPE_LABELS[type as keyof typeof PARKING_TYPE_LABELS] || type}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              }
            />
          </section>
        )}

        {/* Desktop: Filters */}
        <aside className="hidden md:block" role="complementary" aria-label="Φίλτρα Parking">
          <AdvancedFiltersPanel
            config={parkingFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Content */}
        <ListContainer>
          {/* Professional ParkingsList component */}
          <ParkingsList
            parkingSpots={filteredParkingSpots}
            selectedParking={selectedParking}
            onSelectParking={setSelectedParking}
          />

          {/* Professional ParkingDetails component */}
          <ParkingDetails parking={selectedParking} />
        </ListContainer>

        {/* Mobile: Filters Slide-in */}
        <MobileDetailsSlideIn
          isOpen={showMobileFilters}
          onClose={() => setShowMobileFilters(false)}
          title="Φίλτρα Θέσεων Στάθμευσης"
        >
          <AdvancedFiltersPanel
            config={parkingFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </MobileDetailsSlideIn>
      </PageContainer>
    </TooltipProvider>
  );
}

/**
 * 🔧 Next.js 15: Page with Suspense boundary for useSearchParams
 */
export default function ParkingPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Car className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Φόρτωση θέσεων στάθμευσης...</p>
        </div>
      </div>
    }>
      <ParkingPageContent />
    </Suspense>
  );
}
