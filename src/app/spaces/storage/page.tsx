'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { StoragesHeader } from '@/components/space-management/StoragesPage/StoragesHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { StoragesList } from '@/components/space-management/StoragesPage/StoragesList';
import { StorageDetails } from '@/components/space-management/StoragesPage/StorageDetails';
import {
  Warehouse,
  TrendingUp,
  BarChart3,
  MapPin,
  Calendar,
  Home,
  Edit,
  Trash2
} from 'lucide-react';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { useStoragesPageState } from '@/hooks/useStoragesPageState';
import { useStorageStats } from '@/hooks/useStorageStats';
import { useFirestoreStorages } from '@/hooks/useFirestoreStorages';
import { AdvancedFiltersPanel, storageFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer } from '@/core/containers';

// Re-export Storage type for backward compatibility
export type { Storage } from '@/types/storage/contracts';

function StoragePageContent() {
  // Firestore data connection - πραγματικά δεδομένα αντί για mock data
  const { storages, loading, error, refetch } = useFirestoreStorages();

  const {
    selectedStorage,
    setSelectedStorage,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredStorages,
    filters,
    setFilters,
  } = useStoragesPageState(storages);

  const stats = useStorageStats(filteredStorages);

  // Search state (for header search)
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  // Dashboard stats from real data
  const dashboardStats: DashboardStat[] = [
    {
      title: "Σύνολο Αποθηκών",
      value: stats.totalStorages,
      icon: Warehouse,
      color: "blue"
    },
    {
      title: "Διαθέσιμες",
      value: stats.availableStorages,
      icon: TrendingUp,
      color: "green"
    },
    {
      title: "Κατειλημμένες",
      value: stats.occupiedStorages,
      icon: Home,
      color: "purple"
    },
    {
      title: "Συνολική Επιφάνεια",
      value: `${(stats.totalArea / 1000).toFixed(1)}K m²`,
      icon: MapPin,
      color: "orange"
    },
    {
      title: "Ποσοστό Χρήσης",
      value: `${stats.utilizationRate}%`,
      icon: BarChart3,
      color: "cyan"
    },
    {
      title: "Μοναδικά Κτίρια",
      value: stats.uniqueBuildings,
      icon: Home,
      color: "pink"
    }
  ];

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Warehouse className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Φόρτωση αποθηκών...</p>
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
      <div className="flex h-screen bg-background">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <StoragesHeader
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
            <UnifiedDashboard
              stats={dashboardStats}
              columns={6}
              additionalContainers={
                <>
                  <div className="bg-card rounded-lg border p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Κατανομή Κατάστασης
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(stats.storagesByStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between text-sm">
                          <span>{status === 'available' ? 'Διαθέσιμες' :
                                status === 'occupied' ? 'Κατειλημμένες' :
                                status === 'maintenance' ? 'Συντήρηση' : 'Κρατημένες'}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-card rounded-lg border p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Κατανομή Τύπων
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(stats.storagesByType).map(([type, count]) => (
                        <div key={type} className="flex justify-between text-sm">
                          <span>{type === 'large' ? 'Μεγάλες' :
                                type === 'small' ? 'Μικρές' :
                                type === 'basement' ? 'Υπόγειες' :
                                type === 'ground' ? 'Ισόγειες' : 'Ειδικές'}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              }
            />
          )}

          {/* Desktop: Filters */}
          <div className="hidden md:block px-6">
            <AdvancedFiltersPanel
              config={storageFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>

          {/* Content */}
          <ListContainer>
            {/* Professional StoragesList component */}
            <StoragesList
              storages={filteredStorages}
              selectedStorage={selectedStorage}
              onSelectStorage={setSelectedStorage}
            />

            {/* Professional StorageDetails component */}
            <StorageDetails storage={selectedStorage} />
          </ListContainer>
        </div>

        {/* Mobile: Filters Slide-in */}
        <MobileDetailsSlideIn
          isOpen={showMobileFilters}
          onClose={() => setShowMobileFilters(false)}
          title="Φίλτρα Αποθηκών"
        >
          <AdvancedFiltersPanel
            config={storageFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </MobileDetailsSlideIn>
      </div>
    </TooltipProvider>
  );
}

export default function StoragePage() {
  return <StoragePageContent />;
}