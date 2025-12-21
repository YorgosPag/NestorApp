'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { StoragesHeader } from '@/components/space-management/StoragesPage/StoragesHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
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
import { AdvancedFiltersPanel, storageFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer } from '@/core/containers';

// Re-export Storage type for backward compatibility
export type { Storage } from '@/types/storage/contracts';

function StoragePageContent() {
  // TODO: Replace with real Firestore hook - useFirestoreStorages()
  const mockStorages = [
    {
      id: 'stor-001',
      name: 'Αποθήκη A01',
      type: 'large' as const,
      status: 'available' as const,
      building: 'Κτίριο Α',
      floor: 'Υπόγειο -1',
      area: 45.5,
      description: 'Μεγάλη αποθήκη με εύκολη πρόσβαση',
      price: 25000,
      lastUpdated: new Date('2024-12-20')
    },
    {
      id: 'stor-002',
      name: 'Αποθήκη B12',
      type: 'small' as const,
      status: 'occupied' as const,
      building: 'Κτίριο Β',
      floor: 'Υπόγειο -2',
      area: 12.3,
      description: 'Μικρή αποθήκη για προσωπικά είδη',
      price: 8500,
      lastUpdated: new Date('2024-12-19')
    },
    {
      id: 'stor-003',
      name: 'Αποθήκη C07',
      type: 'basement' as const,
      status: 'available' as const,
      building: 'Κτίριο Γ',
      floor: 'Υπόγειο -1',
      area: 32.1,
      description: 'Υπόγεια αποθήκη με ελεγχόμενη υγρασία',
      price: 18000,
      lastUpdated: new Date('2024-12-20')
    }
  ];

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
  } = useStoragesPageState(mockStorages);

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
            {/* Storage List - TODO: Extract to separate component */}
            <div className="min-w-[300px] max-w-[420px] w-full">
              <div className="text-sm text-muted-foreground mb-4">
                Αποθήκες: {filteredStorages.length} αποτελέσματα
              </div>
              <div className="space-y-2">
                {filteredStorages.map((storage) => (
                  <div
                    key={storage.id}
                    className={cn(
                      "p-4 rounded-lg border cursor-pointer transition-all",
                      INTERACTIVE_PATTERNS.SUBTLE_HOVER,
                      selectedStorage?.id === storage.id
                        ? 'bg-accent border-primary'
                        : 'bg-card hover:bg-accent/50'
                    )}
                    onClick={() => setSelectedStorage(
                      selectedStorage?.id === storage.id ? null : storage
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{storage.name}</span>
                          <span className={cn(
                            "px-2 py-1 text-xs rounded-full",
                            storage.status === 'available' ? 'bg-green-100 text-green-700' :
                            storage.status === 'occupied' ? 'bg-blue-100 text-blue-700' :
                            storage.status === 'maintenance' ? 'bg-orange-100 text-orange-700' :
                            'bg-purple-100 text-purple-700'
                          )}>
                            {storage.status === 'available' ? 'Διαθέσιμη' :
                             storage.status === 'occupied' ? 'Κατειλημμένη' :
                             storage.status === 'maintenance' ? 'Συντήρηση' : 'Κρατημένη'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {storage.building} • {storage.floor}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{storage.area} m²</span>
                          <span>€{storage.price?.toLocaleString()}</span>
                        </div>
                        {storage.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {storage.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Storage Details Panel */}
            {selectedStorage && (
              <div className="flex-1">
                <div className="bg-card rounded-lg border p-6 h-full overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Warehouse className="h-5 w-5" />
                      {selectedStorage.name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        className={cn(
                          "p-2 rounded-md border",
                          TRANSITION_PRESETS.STANDARD_COLORS,
                          INTERACTIVE_PATTERNS.ACCENT_HOVER
                        )}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        className={cn(
                          "p-2 rounded-md border border-destructive/20 text-destructive",
                          TRANSITION_PRESETS.STANDARD_COLORS,
                          "hover:bg-destructive/10"
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Κτίριο</label>
                        <p className="mt-1">{selectedStorage.building}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Όροφος</label>
                        <p className="mt-1">{selectedStorage.floor}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Τύπος</label>
                        <p className="mt-1">
                          {selectedStorage.type === 'large' ? 'Μεγάλη' :
                           selectedStorage.type === 'small' ? 'Μικρή' :
                           selectedStorage.type === 'basement' ? 'Υπόγεια' :
                           selectedStorage.type === 'ground' ? 'Ισόγεια' : 'Ειδική'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Κατάσταση</label>
                        <p className="mt-1">
                          {selectedStorage.status === 'available' ? 'Διαθέσιμη' :
                           selectedStorage.status === 'occupied' ? 'Κατειλημμένη' :
                           selectedStorage.status === 'maintenance' ? 'Συντήρηση' : 'Κρατημένη'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Εμβαδόν</label>
                        <p className="mt-1">{selectedStorage.area} m²</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Τιμή</label>
                        <p className="mt-1">€{selectedStorage.price?.toLocaleString()}</p>
                      </div>
                    </div>

                    {selectedStorage.description && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Περιγραφή</label>
                        <p className="mt-1">{selectedStorage.description}</p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Τελευταία ενημέρωση</label>
                      <p className="mt-1">
                        {selectedStorage.lastUpdated ?
                          new Date(selectedStorage.lastUpdated).toLocaleDateString('el-GR') :
                          'Δεν είναι διαθέσιμη'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
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