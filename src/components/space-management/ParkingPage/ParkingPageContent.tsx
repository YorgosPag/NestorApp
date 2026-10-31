'use client';

/**
 * ParkingPageContent
 *
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 */

import React, { useCallback, useState } from 'react';

import { ParkingsHeader } from '@/components/space-management/ParkingPage/ParkingsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { DistributionCard } from '@/components/property-management/dashboard/DistributionCard';
import { ParkingsList } from '@/components/space-management/ParkingPage/ParkingsList';
import { SpaceCatalogPreamble } from '@/components/space-management/shared/SpaceCatalogPreamble';
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
import { ListDetailsSplit, MobileDetailsSlideIn } from '@/core/layouts';
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
import { PARKING_TYPE_LABELS } from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';
import { useFloorFilterConfig } from '@/components/core/AdvancedFilters/hooks/useFloorFilterConfig';
import { spaceAvailabilityLabelKey } from '@/components/shared/unit-status/useSpaceAvailabilityOptions';
import { isSpaceAvailabilityBucket } from '@/lib/spaces/space-availability';
import { NEW_SPACE_STATUSES } from '@/lib/spaces/space-status-split';
// ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { priceTotalsView } from '@/lib/listings/listing-price-label';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createModuleLogger } from '@/lib/telemetry';
import { toggleSelect } from '@/lib/toggle-select';
import { guardLeave, settledLeave } from '@/lib/unsaved-edits/leave-guard';
import type { ParkingSpot } from '@/types/parking';
import { useParkingTrashState } from '@/hooks/useParkingTrashState';
import { useEntityCreateForm } from '@/hooks/useEntityCreateForm';
import { useListPageHeaderState } from '@/hooks/useListPageHeaderState';
import { EntityTrashDialogs } from '@/components/shared/trash/EntityTrashDialogs';
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
  ...NEW_SPACE_STATUSES,
};

export function ParkingPageContent() {
  // ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['building', 'trash', 'filters']);
  const iconSizes = useIconSizes();
  const _colors = useSemanticColors();

  const { buildings } = useFirestoreBuildings();

  // Firestore data connection
  const { parkingSpots, loading, error, refetch } = useFirestoreParkingSpots();
  // ADR-903 §6 — οι όροφοι του φίλτρου προκύπτουν από τις θέσεις που υπάρχουν.
  const filtersConfig = useFloorFilterConfig(parkingFiltersConfig, parkingSpots);

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
    selection,
  } = useParkingPageState(parkingSpots, { hasAnswered: !loading });

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
    permanentDelete,
    handleToggleTrash,
    handleRestoreParkingSpots,
    handlePermanentDeleteParkingSpots,
  } = useParkingTrashState({
    forceDataRefresh: refetch,
    clearSelection: () => setSelectedParking(null),
  });

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

  // Delete parking state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create form state — reuses ParkingGeneralTab in create mode (single source of truth)
  const { showCreateForm, openCreateForm, resetCreateForm, createSaveRef } = useEntityCreateForm();

  const { t: tParking } = useTranslation('parking');

  // Μία δήλωση για λίστα και πλέγμα: η ίδια επιλογή, το ίδιο «Νέα», τα ίδια δεδομένα.
  const isCreating = showCreateForm && !showTrash;
  const visibleParkingSpots = showTrash ? trashedParkingSpots : filteredParkingSpots;
  // Όλη η πράξη πίσω από ΜΙΑ ερώτηση (ADR-912 §12.12): η φόρμα δημιουργίας δεν κλείνει πριν απαντήσει ο άνθρωπος.
  const handleSelectParking = (parking: ParkingSpot) => guardLeave(() => {
    setSelectedParking(toggleSelect(selectedParking, parking));
    resetCreateForm();
  });
  const handleNewParking = showTrash ? undefined : () => guardLeave(() => {
    openCreateForm();
    setSelectedParking(null);
  });

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
        // Η εγγραφή διαγράφηκε: δεν υπάρχει πια τίποτα να χαθεί.
        settledLeave(() => setSelectedParking(null));
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
      // ADR-777 §8.60.20 — «στην αγορά», από το `commercialStatus` (ίδιος κουβάς με φίλτρα και πίνακες).
      title: t(spaceAvailabilityLabelKey('listed'), { ns: 'filters' }),
      value: stats.availableParkingSpots,
      icon: CheckCircle,
      color: "green"
    },
    {
      title: t(spaceAvailabilityLabelKey('sold'), { ns: 'filters' }),
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
      ...priceTotalsView(t, stats.priceTotals, 'total'),
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
        <ParkingsHeader {...headerProps} />

        {/* Dashboard */}
        {showDashboard && (
          <section role="region" aria-label={t('pages.parking.dashboard.label')}>
            <UnifiedDashboard
              stats={dashboardStats}
              columns={6}
              additionalContainers={
                <>
                  <DistributionCard
                    title={t('pages.parking.dashboard.statusDistribution')}
                    icon={BarChart3}
                    distribution={stats.parkingByAvailability}
                    labelFor={(bucket) =>
                      isSpaceAvailabilityBucket(bucket) ? t(spaceAvailabilityLabelKey(bucket), { ns: 'filters' }) : bucket
                    }
                  />
                  <DistributionCard
                    title={t('pages.parking.dashboard.typeDistribution')}
                    icon={Car}
                    distribution={stats.parkingByType}
                    labelFor={(type) =>
                      PARKING_TYPE_LABELS[type as keyof typeof PARKING_TYPE_LABELS] || type
                    }
                  />
                </>
              }
            />
          </section>
        )}

        {/* Φίλτρα desktop · 🗑️ ADR-281 μπάρα κάδου · ADR-777 §8.31 ειδοποίηση συνδέσμου */}
        <SpaceCatalogPreamble
          selection={selection}
          filters={{
            label: t('pages.parking.filters.label'),
            config: filtersConfig,
            value: filters,
            onChange: setFilters,
          }}
          trash={{
            visible: showTrash && !loadingTrash,
            activeId: selectedParking?.id,
            count: trashCount,
            onBack: handleToggleTrash,
            onRestore: handleRestoreParkingSpots,
            onPermanentDelete: handlePermanentDeleteParkingSpots,
          }}
        />

        <ListContainer>
          {/* ADR-912 §12.11 — λίστα + λεπτομέρειες στο desktop, λίστα ή φύλλο στο κινητό (και για τη φόρμα δημιουργίας). */}
          <ListDetailsSplit
            peek={viewMode === 'grid'}
            list={viewMode === 'grid' ? (
              <ParkingGridView
                parkingSpots={visibleParkingSpots}
                selectedParking={selectedParking}
                onSelectParking={handleSelectParking}
              />
            ) : (
              <ParkingsList
                parkingSpots={visibleParkingSpots}
                selectedParking={selectedParking}
                onSelectParking={handleSelectParking}
                onNewItem={handleNewParking}
              />
            )}
            details={isCreating ? (
              <DetailsContainer
                selectedItem={{ id: 'create' }}
                header={
                  <EntityDetailsHeader
                    icon={Car}
                    title={tParking('header.newParking')}
                    actions={[
                      createEntityAction('save', tParking('form.create'), () => createSaveRef.current?.()),
                      createEntityAction('cancel', tParking('form.cancel'), resetCreateForm),
                    ]}
                    variant="detailed"
                  />
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
                onNewParking={handleNewParking}
                onDelete={showTrash ? undefined : () => setShowDeleteDialog(true)}
              />
            )}
            sheetOpen={isCreating || !!selectedParking}
            sheetTitle={isCreating ? tParking('header.newParking') : selectedParking?.number ?? ''}
            onCloseSheet={() => guardLeave(() => {
              setSelectedParking(null);
              resetCreateForm();
            })}
          />
        </ListContainer>

        {/* Mobile: Filters Slide-in */}
        <MobileDetailsSlideIn
          isOpen={showMobileFilters}
          onClose={() => setShowMobileFilters(false)}
          title={t('pages.parking.filters.mobileTitle')}
        >
          <AdvancedFiltersPanel
            config={filtersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </MobileDetailsSlideIn>

        {/* 🗑️ ADR-281: Soft-delete (move to trash) + permanent-delete confirmations */}
        <EntityTrashDialogs
          softDelete={{
            open: showDeleteDialog,
            title: t('pages.parking.deleteDialog.title'),
            description: t('pages.parking.deleteDialog.description', { number: selectedParking?.number ?? '' }),
            onConfirm: handleDeleteParking,
            onCancel: () => setShowDeleteDialog(false),
            deleting: isDeleting,
          }}
          permanentDelete={permanentDelete}
        />
      </PageContainer>
  );
}

export default ParkingPageContent;
