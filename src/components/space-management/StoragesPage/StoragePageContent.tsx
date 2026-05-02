'use client';

/**
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 */

import React, { useCallback, useRef, useState } from 'react';

import { StoragesHeader } from '@/components/space-management/StoragesPage/StoragesHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { StoragesList } from '@/components/space-management/StoragesPage/StoragesList';
import { StorageDetails } from '@/components/space-management/StoragesPage/StorageDetails';
import { StorageGridView } from '@/components/space-management/StoragesPage/StorageGridView';
import { StorageGeneralTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab';
import {
  Warehouse,
  TrendingUp,
  BarChart3,
  MapPin,
  PackageCheck
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { UNIFIED_STATUS_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
import { useBreadcrumbSync } from '@/components/navigation/core/hooks/useBreadcrumbSync';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { useStoragesPageState } from '@/hooks/useStoragesPageState';
import { useStorageStats } from '@/hooks/useStorageStats';
import { useFirestoreStorages } from '@/hooks/useFirestoreStorages';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageLoadingState, PageErrorState } from '@/core/states';
import { AdvancedFiltersPanel, storageFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer, DetailsContainer } from '@/core/containers';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createModuleLogger } from '@/lib/telemetry';
import { toggleSelect } from '@/lib/toggle-select';
import { useStoragesTrashState } from '@/hooks/useStoragesTrashState';
import { TrashActionsBar } from '@/components/shared/trash/TrashActionsBar';
import { useNotifications } from '@/providers/NotificationProvider';
import '@/lib/design-system';

const logger = createModuleLogger('StoragePage');

// Re-export Storage type for backward compatibility
export type { Storage } from '@/types/storage/contracts';

/** Empty storage for create mode — GeneralTab initializes all fields from this */
const EMPTY_STORAGE: import('@/types/storage/contracts').Storage = {
  id: '',
  name: 'Αποθήκη',
  type: 'storage',
  status: 'available',
  building: '',
  floor: '',
  area: 0,
};

export function StoragePageContent() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline', 'trash', 'storage']);
  const { success } = useNotifications();
  // 🏢 ENTERPRISE: Centralized icon sizes
  const iconSizes = useIconSizes();
  const _colors = useSemanticColors();

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

  // 🗑️ ADR-281: Trash view state
  const {
    showTrash,
    trashCount,
    trashedStorages,
    loadingTrash,
    showPermanentDeleteDialog,
    pendingPermanentDeleteIds,
    handleToggleTrash,
    handleRestoreStorages,
    handlePermanentDeleteStorages,
    handleConfirmPermanentDelete,
    handleCancelPermanentDelete,
  } = useStoragesTrashState({ forceDataRefresh: refetch, onItemDeleted: () => setSelectedStorage(null) });

  // Clear selection whenever entering or exiting trash view — prevents cross-contamination
  const handleToggleTrashAndClear = useCallback(async () => {
    setSelectedStorage(null);
    await handleToggleTrash();
  }, [handleToggleTrash, setSelectedStorage]);

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create form state — reuses StorageGeneralTab in create mode (single source of truth)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const createSaveRef = useRef<(() => Promise<boolean>) | null>(null);

  const { t: tStorage } = useTranslation('storage');

  const resetCreateForm = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  const handleDeleteStorage = useCallback(async () => {
    if (!selectedStorage) return;
    setIsDeleting(true);
    try {
      const result = await apiClient.delete<{ id: string }>(
        API_ROUTES.STORAGES.BY_ID(selectedStorage.id)
      );
      if (result?.id) {
        RealtimeService.dispatch('STORAGE_DELETED', {
          storageId: selectedStorage.id,
          timestamp: Date.now(),
        });
        setSelectedStorage(null);
        success(t('deleteSuccess', { ns: 'trash' }));
      }
    } catch (err) {
      logger.error('Failed to delete storage', { error: err });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }, [selectedStorage, setSelectedStorage]);

  useBreadcrumbSync(
    selectedStorage
      ? {
          type: 'space',
          id: selectedStorage.id,
          name: selectedStorage.name,
          spaceType: 'storage',
          buildingId: selectedStorage.buildingId,
          projectId: selectedStorage.projectId,
        }
      : null,
    { buildings }
  );

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
    return (
      <PageContainer ariaLabel={t('pages.storage.pageLabel')}>
        <PageLoadingState icon={Warehouse} message={t('pages.storage.loading')} layout="contained" />
      </PageContainer>
    );
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
            showTrash={showTrash}
            onToggleTrash={handleToggleTrashAndClear}
            trashCount={trashCount}
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

        {/* 🗑️ ADR-281: Trash actions bar — shown only in trash view */}
        {showTrash && !loadingTrash && (
          <TrashActionsBar
            selectedIds={selectedStorage ? [selectedStorage.id] : []}
            onBack={handleToggleTrashAndClear}
            onRestore={handleRestoreStorages}
            onPermanentDelete={handlePermanentDeleteStorages}
            trashCount={trashCount}
          />
        )}

        {/* Content */}
        <ListContainer>
          {viewMode === 'grid' ? (
            /* 🏢 ENTERPRISE: Full-width Grid View */
            <StorageGridView
              storages={showTrash ? trashedStorages : filteredStorages}
              selectedStorage={selectedStorage}
              onSelectStorage={(s) => {
                setSelectedStorage(toggleSelect(selectedStorage, s));
                setShowCreateForm(false);
              }}
            />
          ) : (
            /* 🏢 ENTERPRISE: List View with Details Panel */
            <>
              <StoragesList
                storages={showTrash ? trashedStorages : filteredStorages}
                selectedStorage={selectedStorage}
                onSelectStorage={(s) => {
                  setSelectedStorage(toggleSelect(selectedStorage, s));
                  setShowCreateForm(false);
                }}
                onNewItem={showTrash ? undefined : () => {
                  setShowCreateForm(true);
                  setSelectedStorage(null);
                }}
              />
              {showCreateForm && !showTrash ? (
                <DetailsContainer
                  selectedItem={{ id: 'create' }}
                  header={
                    <div className="hidden md:block">
                      <EntityDetailsHeader
                        icon={Warehouse}
                        title={tStorage('header.newStorage')}
                        actions={[
                          createEntityAction('save', tStorage('storages.form.create'), () => createSaveRef.current?.()),
                          createEntityAction('cancel', tStorage('storages.form.cancel'), resetCreateForm),
                        ]}
                        variant="detailed"
                      />
                    </div>
                  }
                  tabsRenderer={
                    <StorageGeneralTab
                      storage={EMPTY_STORAGE}
                      isEditing
                      createMode
                      onSaveRef={createSaveRef}
                      onCreated={() => { success(tStorage('storages.notifications.created')); resetCreateForm(); }}
                    />
                  }
                />
              ) : (
                <StorageDetails
                  storage={selectedStorage}
                  onNewStorage={showTrash ? undefined : () => {
                    setShowCreateForm(true);
                    setSelectedStorage(null);
                  }}
                  onDelete={showTrash ? undefined : () => setShowDeleteDialog(true)}
                  isInTrash={showTrash}
                />
              )}
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

        {/* Delete Storage Confirmation (move to trash) */}
        <DeleteConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title={tStorage('pages.storage.deleteDialog.title')}
          description={tStorage('pages.storage.deleteDialog.description', { name: selectedStorage?.name ?? '' })}
          onConfirm={handleDeleteStorage}
          loading={isDeleting}
        />

        {/* 🗑️ ADR-281: Permanent delete confirmation */}
        <DeleteConfirmDialog
          open={showPermanentDeleteDialog}
          onOpenChange={(open) => { if (!open) handleCancelPermanentDelete(); }}
          title={t('permanentDeleteDialog.title', { ns: 'trash' })}
          description={t('permanentDeleteDialog.body', { ns: 'trash' })}
          onConfirm={handleConfirmPermanentDelete}
          loading={false}
          disabled={pendingPermanentDeleteIds.length === 0}
        />
      </PageContainer>
  );
}

export default StoragePageContent;
