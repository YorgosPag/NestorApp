'use client';

/**
 * ParkingPageContent
 *
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 */

import React, { useCallback, useRef, useState } from 'react';

import { ParkingsHeader } from '@/components/space-management/ParkingPage/ParkingsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ParkingsList } from '@/components/space-management/ParkingPage/ParkingsList';
import { ParkingDetails } from '@/components/space-management/ParkingPage/ParkingDetails';
import { ParkingGridView } from '@/components/space-management/ParkingPage/ParkingGridView';
import { ParkingGeneralTab } from '@/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingGeneralTab';
import {
  Car,
  TrendingUp,
  BarChart3,
  MapPin,
  CheckCircle,
  Euro
} from 'lucide-react';
import { useBreadcrumbSync } from '@/components/navigation/core/hooks/useBreadcrumbSync';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { useParkingPageState } from '@/hooks/useParkingPageState';
import { useParkingStats } from '@/hooks/useParkingStats';
import { useFirestoreParkingSpots } from '@/hooks/useFirestoreParkingSpots';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageLoadingState, PageErrorState } from '@/core/states';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters';
import { parkingFiltersConfig } from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';
import { ListContainer, PageContainer, DetailsContainer } from '@/core/containers';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import {
  PARKING_TYPE_LABELS,
  PARKING_STATUS_LABELS
} from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';
// ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyCompact } from '@/lib/intl-utils';
import { DeleteConfirmDialog, SoftDeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createModuleLogger } from '@/lib/telemetry';
import { toggleSelect } from '@/lib/toggle-select';
import type { ParkingSpot } from '@/types/parking';
import { useParkingTrashState } from '@/hooks/useParkingTrashState';
import { TrashActionsBar } from '@/components/shared/trash/TrashActionsBar';
import '@/lib/design-system';

const logger = createModuleLogger('ParkingPage');

interface ParkingDeleteResult {
  id: string;
}

/** Empty parking spot for create mode — GeneralTab initializes all fields from this */
const EMPTY_PARKING: ParkingSpot = {
  id: '',
  number: '',
  type: 'standard',
  status: 'available',
  floor: '',
};

export function ParkingPageContent() {
  // ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline', 'trash']);
  const iconSizes = useIconSizes();
  const _colors = useSemanticColors();

  const { buildings } = useFirestoreBuildings();

  // Firestore data connection
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

  useBreadcrumbSync(
    selectedParking
      ? {
          type: 'space',
          id: selectedParking.id,
          name: selectedParking.number,
          spaceType: 'parking',
          buildingId: selectedParking.buildingId ?? undefined,
          projectId: selectedParking.projectId ? String(selectedParking.projectId) : undefined,
        }
      : null,
    { buildings }
  );

  // 🗑️ ADR-281: Trash view state
  const {
    showTrash,
    trashCount,
    trashedParkingSpots,
    loadingTrash,
    showPermanentDeleteDialog,
    pendingPermanentDeleteIds,
    handleToggleTrash,
    handleRestoreParkingSpots,
    handlePermanentDeleteParkingSpots,
    handleConfirmPermanentDelete,
    handleCancelPermanentDelete,
  } = useParkingTrashState({
    forceDataRefresh: refetch,
    onBeforeToggle: () => setSelectedParking(null),
  });

  // Search state (for header search)
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  // Delete parking state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create form state — reuses ParkingGeneralTab in create mode (single source of truth)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const createSaveRef = useRef<(() => Promise<boolean>) | null>(null);

  const { t: tParking } = useTranslation('parking');

  const resetCreateForm = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  const handleDeleteParking = useCallback(async () => {
    if (!selectedParking) return;
    setIsDeleting(true);
    try {
      const result = await apiClient.delete<ParkingDeleteResult>(
        API_ROUTES.PARKING.BY_ID(selectedParking.id)
      );
      if (result?.id) {
        RealtimeService.dispatch('PARKING_DELETED', {
          parkingSpotId: selectedParking.id,
          timestamp: Date.now(),
        });
        setSelectedParking(null);
      }
    } catch (err) {
      logger.error('Failed to delete parking spot', { error: err });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }, [selectedParking, setSelectedParking]);

  // Dashboard stats from real data
  const dashboardStats: DashboardStat[] = [
    {
      title: t('pages.parking.dashboard.totalSpots'),
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
      title: t('pages.parking.dashboard.totalArea'),
      value: `${stats.totalArea.toFixed(1)} m²`,
      icon: MapPin,
      color: "orange"
    },
    {
      title: t('pages.parking.dashboard.totalValue'),
      value: formatCurrencyCompact(stats.totalValue),
      icon: TrendingUp,
      color: "cyan"
    },
    {
      title: t('pages.parking.dashboard.salesRate'),
      value: `${stats.salesRate}%`,
      icon: BarChart3,
      color: "pink"
    }
  ];

  // Loading state
  if (loading) {
    return (
      <PageContainer ariaLabel={t('pages.parking.pageLabel')}>
        <PageLoadingState icon={Car} message={t('pages.parking.loading')} layout="contained" />
      </PageContainer>
    );
  }

  // Error state
  if (error) {
    return (
      <PageErrorState
        title={t('pages.parking.error.title')}
        message={error}
        onRetry={refetch}
        retryLabel={t('pages.parking.error.retry')}
      />
    );
  }

  return (
    <PageContainer ariaLabel={t('pages.parking.pageLabel')}>
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
            showTrash={showTrash}
            onToggleTrash={handleToggleTrash}
            trashCount={trashCount}
          />

        {/* Dashboard */}
        {showDashboard && (
          <section role="region" aria-label={t('pages.parking.dashboard.label')}>
            <UnifiedDashboard
              stats={dashboardStats}
              columns={6}
              additionalContainers={
                <>
                  <div className="bg-card rounded-lg border p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <BarChart3 className={iconSizes.sm} />
                      {t('pages.parking.dashboard.statusDistribution')}
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
                      {t('pages.parking.dashboard.typeDistribution')}
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
        <aside className="hidden md:block" role="complementary" aria-label={t('pages.parking.filters.label')}>
          <AdvancedFiltersPanel
            config={parkingFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* 🗑️ ADR-281: Trash actions bar — shown only in trash view */}
        {showTrash && !loadingTrash && (
          <TrashActionsBar
            selectedIds={selectedParking ? [selectedParking.id] : []}
            onBack={handleToggleTrash}
            onRestore={handleRestoreParkingSpots}
            onPermanentDelete={handlePermanentDeleteParkingSpots}
            trashCount={trashCount}
          />
        )}

        {/* Content */}
        <ListContainer>
          {viewMode === 'grid' ? (
            /* ENTERPRISE: Full-width Grid View */
            <ParkingGridView
              parkingSpots={showTrash ? trashedParkingSpots : filteredParkingSpots}
              selectedParking={selectedParking}
              onSelectParking={(p) => {
                setSelectedParking(toggleSelect(selectedParking, p));
                setShowCreateForm(false);
              }}
            />
          ) : (
            /* ENTERPRISE: List View with Details Panel */
            <>
              <ParkingsList
                parkingSpots={showTrash ? trashedParkingSpots : filteredParkingSpots}
                selectedParking={selectedParking}
                onSelectParking={(p) => {
                  setSelectedParking(toggleSelect(selectedParking, p));
                  setShowCreateForm(false);
                }}
                onNewItem={showTrash ? undefined : () => {
                  setShowCreateForm(true);
                  setSelectedParking(null);
                }}
              />
              {showCreateForm && !showTrash ? (
                <DetailsContainer
                  selectedItem={{ id: 'create' }}
                  header={
                    <div className="hidden md:block">
                      <EntityDetailsHeader
                        icon={Car}
                        title={tParking('header.newParking')}
                        actions={[
                          createEntityAction('save', tParking('form.create'), () => createSaveRef.current?.()),
                          createEntityAction('cancel', tParking('form.cancel'), resetCreateForm),
                        ]}
                        variant="detailed"
                      />
                    </div>
                  }
                  tabsRenderer={
                    <ParkingGeneralTab
                      parking={EMPTY_PARKING}
                      isEditing
                      createMode
                      onSaveRef={createSaveRef}
                      onCreated={() => resetCreateForm()}
                    />
                  }
                />
              ) : (
                <ParkingDetails
                  parking={selectedParking}
                  onNewParking={showTrash ? undefined : () => {
                    setShowCreateForm(true);
                    setSelectedParking(null);
                  }}
                  onDelete={showTrash ? undefined : () => setShowDeleteDialog(true)}
                />
              )}
            </>
          )}
        </ListContainer>

        {/* Mobile: Filters Slide-in */}
        <MobileDetailsSlideIn
          isOpen={showMobileFilters}
          onClose={() => setShowMobileFilters(false)}
          title={t('pages.parking.filters.mobileTitle')}
        >
          <AdvancedFiltersPanel
            config={parkingFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </MobileDetailsSlideIn>

        {/* Delete Parking Confirmation (move to trash) */}
        <SoftDeleteConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title={t('pages.parking.deleteDialog.title')}
          description={t('pages.parking.deleteDialog.description', { number: selectedParking?.number ?? '' })}
          onConfirm={handleDeleteParking}
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

export default ParkingPageContent;
