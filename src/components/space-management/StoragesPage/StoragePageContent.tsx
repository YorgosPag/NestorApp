'use client';

/**
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 */

import React, { useCallback, useState } from 'react';

import { StoragesHeader } from '@/components/space-management/StoragesPage/StoragesHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { DistributionCard } from '@/components/property-management/dashboard/DistributionCard';
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
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createModuleLogger } from '@/lib/telemetry';
import { toggleSelect } from '@/lib/toggle-select';
import { useStoragesTrashState } from '@/hooks/useStoragesTrashState';
import { useEntityCreateForm } from '@/hooks/useEntityCreateForm';
import { useListPageHeaderState } from '@/hooks/useListPageHeaderState';
import { TrashActionsBar } from '@/components/shared/trash/TrashActionsBar';
import { EntityTrashDialogs } from '@/components/shared/trash/EntityTrashDialogs';
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
    permanentDelete,
    handleToggleTrash,
    handleRestoreStorages,
    handlePermanentDeleteStorages,
  } = useStoragesTrashState({
    forceDataRefresh: refetch,
    clearSelection: () => setSelectedStorage(null),
  });

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create form state — reuses StorageGeneralTab in create mode (single source of truth)
  const { showCreateForm, openCreateForm, resetCreateForm, createSaveRef } = useEntityCreateForm();

  const { t: tStorage } = useTranslation('storage');

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

  // Header owns its own search + mobile-filter state; the page supplies what it owns.
  const { headerProps, showFilters: showMobileFilters, setShowFilters: setShowMobileFilters } =
    useListPageHeaderState({
      viewMode,
      setViewMode,
      showDashboard,
      setShowDashboard,
      showTrash,
      onToggleTrash: handleToggleTrash,
      trashCount,
    });

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
        <StoragesHeader {...headerProps} />

        {/* Dashboard */}
        {showDashboard && (
          <section role="region" aria-label={t('pages.storage.dashboard.label')}>
            <UnifiedDashboard
              stats={dashboardStats}
              columns={6}
              additionalContainers={
                <>
                  <DistributionCard
                    title={t('pages.storage.dashboard.statusDistribution')}
                    icon={BarChart3}
                    distribution={stats.storagesByStatus}
                    labelFor={(status) => t(`pages.storage.statusLabels.${status}`)}
                  />
                  <DistributionCard
                    title={t('pages.storage.dashboard.typeDistribution')}
                    icon={MapPin}
                    distribution={stats.storagesByType}
                    labelFor={(type) => t(`pages.storage.typeLabels.${type}`)}
                  />
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
            onBack={handleToggleTrash}
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
                resetCreateForm();
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
                  resetCreateForm();
                }}
                onNewItem={showTrash ? undefined : () => {
                  openCreateForm();
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
                    openCreateForm();
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

        {/* 🗑️ ADR-281: Soft-delete (move to trash) + permanent-delete confirmations */}
        <EntityTrashDialogs
          softDelete={{
            open: showDeleteDialog,
            title: tStorage('pages.storage.deleteDialog.title'),
            description: tStorage('pages.storage.deleteDialog.description', { name: selectedStorage?.name ?? '' }),
            onConfirm: handleDeleteStorage,
            onCancel: () => setShowDeleteDialog(false),
            deleting: isDeleting,
          }}
          permanentDelete={permanentDelete}
        />
      </PageContainer>
  );
}

export default StoragePageContent;
