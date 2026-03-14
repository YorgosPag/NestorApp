'use client';

/**
 * 🔧 Next.js 15: useStoragesPageState uses useSearchParams, requires Suspense
 */

import React, { Suspense, useCallback, useState } from 'react';

import { StoragesHeader } from '@/components/space-management/StoragesPage/StoragesHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { StoragesList } from '@/components/space-management/StoragesPage/StoragesList';
import { StorageDetails } from '@/components/space-management/StoragesPage/StorageDetails';
import { StorageGridView } from '@/components/space-management/StoragesPage/StorageGridView';
import {
  Warehouse,
  TrendingUp,
  BarChart3,
  MapPin,
  PackageCheck
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { UNIFIED_STATUS_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: Navigation context for breadcrumb sync
import { useNavigation } from '@/components/navigation/core/NavigationContext';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { useStoragesPageState } from '@/hooks/useStoragesPageState';
import { useStorageStats } from '@/hooks/useStorageStats';
import { useFirestoreStorages } from '@/hooks/useFirestoreStorages';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageLoadingState, PageErrorState, StaticPageLoading } from '@/core/states';
import { AdvancedFiltersPanel, storageFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer } from '@/core/containers';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AddStorageDialog } from '@/components/space-management/StoragesPage/AddStorageDialog';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createModuleLogger } from '@/lib/telemetry';
import { toggleSelect } from '@/lib/toggle-select';

const logger = createModuleLogger('StoragePage');

// Re-export Storage type for backward compatibility
export type { Storage } from '@/types/storage/contracts';

function StoragePageContent() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  // 🏢 ENTERPRISE: Centralized icon sizes
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Navigation context for breadcrumb sync
  const { companies, projects, syncBreadcrumb } = useNavigation();
  const { buildings } = useFirestoreBuildings();

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

  // Add/Delete dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteStorage = useCallback(async () => {
    if (!selectedStorage) return;
    setIsDeleting(true);
    try {
      const result = await apiClient.delete<{ id: string }>(
        `/api/storages/${selectedStorage.id}`
      );
      if (result?.id) {
        RealtimeService.dispatch('STORAGE_DELETED', {
          storageId: selectedStorage.id,
          timestamp: Date.now(),
        });
        setSelectedStorage(null);
      }
    } catch (err) {
      logger.error('Failed to delete storage', { error: err });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }, [selectedStorage, setSelectedStorage]);

  // 🏢 ENTERPRISE: Sync selectedStorage with NavigationContext for breadcrumb display
  React.useEffect(() => {
    if (selectedStorage && buildings.length > 0 && companies.length > 0 && projects.length > 0) {
      // Find the building this storage belongs to
      // Try multiple matching strategies for robustness
      const storageBuildingName = selectedStorage.building?.trim() || '';

      let building = buildings.find(b => b.name === storageBuildingName);

      // Fallback 1: Case-insensitive exact match
      if (!building && storageBuildingName) {
        building = buildings.find(b =>
          b.name.toLowerCase() === storageBuildingName.toLowerCase()
        );
      }

      // Fallback 2: Partial match (storage building name contains building name or vice versa)
      if (!building && storageBuildingName) {
        building = buildings.find(b =>
          b.name.toLowerCase().includes(storageBuildingName.toLowerCase()) ||
          storageBuildingName.toLowerCase().includes(b.name.toLowerCase())
        );
      }

      // Fallback 3: Match by projectId if available
      if (!building && selectedStorage.projectId) {
        building = buildings.find(b => b.projectId === selectedStorage.projectId);
      }

      if (building && building.projectId) {
        // Find the project and company
        const project = projects.find(p => p.id === building.projectId);
        if (project) {
          const company = companies.find(c => c.id === project.linkedCompanyId);
          if (company) {
            // Use atomic sync with names - enterprise pattern
            syncBreadcrumb({
              company: { id: company.id, name: company.companyName },
              project: { id: project.id, name: project.name },
              building: { id: building.id, name: building.name },
              space: { id: selectedStorage.id, name: selectedStorage.name, type: 'storage' },
              currentLevel: 'spaces'
            });
          }
        }
      }
    }
  }, [selectedStorage?.id, buildings.length, companies.length, projects.length, syncBreadcrumb]);

  // Search state (for header search)
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  // Dashboard stats from real data
  const dashboardStats: DashboardStat[] = [
    {
      title: t('pages.storage.dashboard.totalStorages'),
      value: stats.totalStorages,
      icon: Warehouse,
      color: "blue"
    },
    {
      title: t(UNIFIED_STATUS_FILTER_LABELS.AVAILABLE, { ns: 'common' }),
      value: stats.availableStorages,
      icon: TrendingUp,
      color: "green"
    },
    {
      title: t(UNIFIED_STATUS_FILTER_LABELS.OCCUPIED, { ns: 'common' }),
      value: stats.occupiedStorages,
      icon: PackageCheck,
      color: "purple"
    },
    {
      title: t('pages.storage.dashboard.totalArea'),
      value: `${(stats.totalArea / 1000).toFixed(1)}K m²`,
      icon: MapPin,
      color: "orange"
    },
    {
      title: t('pages.storage.dashboard.utilizationRate'),
      value: `${stats.utilizationRate}%`,
      icon: BarChart3,
      color: "cyan"
    },
    {
      title: t('pages.storage.dashboard.uniqueBuildings'),
      value: stats.uniqueBuildings,
      icon: NAVIGATION_ENTITIES.building.icon,
      color: "pink"
    }
  ];

  // Loading state
  if (loading) {
    return <PageLoadingState icon={Warehouse} message={t('pages.storage.loading')} />;
  }

  // Error state
  if (error) {
    return (
      <PageErrorState
        title={t('pages.storage.error.title')}
        message={error}
        onRetry={refetch}
        retryLabel={t('pages.storage.error.retry')}
      />
    );
  }

  return (
    <PageContainer ariaLabel={t('pages.storage.pageLabel')}>
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
          <section role="region" aria-label={t('pages.storage.dashboard.label')}>
            <UnifiedDashboard
              stats={dashboardStats}
              columns={6}
              additionalContainers={
                <>
                  <div className="bg-card rounded-lg border p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <BarChart3 className={iconSizes.sm} />
                      {t('pages.storage.dashboard.statusDistribution')}
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(stats.storagesByStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between text-sm">
                          <span>{t(`pages.storage.statusLabels.${status}`)}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-card rounded-lg border p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <MapPin className={iconSizes.sm} />
                      {t('pages.storage.dashboard.typeDistribution')}
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(stats.storagesByType).map(([type, count]) => (
                        <div key={type} className="flex justify-between text-sm">
                          <span>{t(`pages.storage.typeLabels.${type}`)}</span>
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
        <aside className="hidden md:block" role="complementary" aria-label={t('pages.storage.filters.label')}>
          <AdvancedFiltersPanel
            config={storageFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Content */}
        <ListContainer>
          {viewMode === 'grid' ? (
            /* 🏢 ENTERPRISE: Full-width Grid View */
            <StorageGridView
              storages={filteredStorages}
              selectedStorage={selectedStorage}
              onSelectStorage={(s) => setSelectedStorage(toggleSelect(selectedStorage, s))}
            />
          ) : (
            /* 🏢 ENTERPRISE: List View with Details Panel */
            <>
              <StoragesList
                storages={filteredStorages}
                selectedStorage={selectedStorage}
                onSelectStorage={(s) => setSelectedStorage(toggleSelect(selectedStorage, s))}
                onNewItem={() => setShowAddDialog(true)}
              />
              <StorageDetails
                storage={selectedStorage}
                onNewStorage={() => setShowAddDialog(true)}
                onDelete={() => setShowDeleteDialog(true)}
              />
            </>
          )}
        </ListContainer>

        {/* Mobile: Filters Slide-in */}
        <MobileDetailsSlideIn
          isOpen={showMobileFilters}
          onClose={() => setShowMobileFilters(false)}
          title={t('pages.storage.filters.mobileTitle')}
        >
          <AdvancedFiltersPanel
            config={storageFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </MobileDetailsSlideIn>

        {/* Add Storage Dialog */}
        <AddStorageDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
        />

        {/* Delete Storage Confirmation */}
        <DeleteConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title={t('pages.storage.deleteDialog.title', 'Διαγραφή Αποθήκης')}
          description={t('pages.storage.deleteDialog.description', { name: selectedStorage?.name ?? '' })}
          onConfirm={handleDeleteStorage}
          loading={isDeleting}
        />
      </PageContainer>
  );
}

/**
 * 🔧 Next.js 15: Page with Suspense boundary for useSearchParams
 * Note: Suspense fallback uses static Greek text (Server Component constraint)
 */
export default function StoragePage() {
  return (
    <Suspense fallback={<StaticPageLoading icon={Warehouse} />}>
      <StoragePageContent />
    </Suspense>
  );
}