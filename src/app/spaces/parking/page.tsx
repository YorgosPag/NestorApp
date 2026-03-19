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

import React, { Suspense, useCallback, useEffect, useState } from 'react';

import { ParkingsHeader } from '@/components/space-management/ParkingPage/ParkingsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ParkingsList } from '@/components/space-management/ParkingPage/ParkingsList';
import { ParkingDetails } from '@/components/space-management/ParkingPage/ParkingDetails';
import { ParkingGridView } from '@/components/space-management/ParkingPage/ParkingGridView';
import {
  Car,
  TrendingUp,
  BarChart3,
  MapPin,
  CheckCircle,
  Euro
} from 'lucide-react';
// 🏢 ENTERPRISE: Navigation context for breadcrumb sync
import { useNavigation } from '@/components/navigation/core/NavigationContext';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { useParkingPageState } from '@/hooks/useParkingPageState';
import { useParkingStats } from '@/hooks/useParkingStats';
import { useFirestoreParkingSpots } from '@/hooks/useFirestoreParkingSpots';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageLoadingState, PageErrorState, StaticPageLoading } from '@/core/states';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters';
import { parkingFiltersConfig } from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';
import { ListContainer, PageContainer } from '@/core/containers';
import {
  PARKING_TYPE_LABELS,
  PARKING_STATUS_LABELS
} from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyCompact } from '@/lib/intl-utils';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createModuleLogger } from '@/lib/telemetry';
import { toggleSelect } from '@/lib/toggle-select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Check } from 'lucide-react';
import {
  PARKING_TYPES,
  PARKING_STATUSES,
} from '@/types/parking';
import type {
  ParkingSpotType,
  ParkingSpotStatus,
} from '@/types/parking';
import { useEntityCodeSuggestion } from '@/hooks/useEntityCodeSuggestion';

const logger = createModuleLogger('ParkingPage');

interface ParkingDeleteResult {
  id: string;
}

function ParkingPageContent() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
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
        if (project) {
          const company = companies.find(c => c.id === project.linkedCompanyId);
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

  // 🅿️ Delete parking state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Inline create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createBuildingId, setCreateBuildingId] = useState('');
  const [createNumber, setCreateNumber] = useState('');
  const [createType, setCreateType] = useState<ParkingSpotType>('standard');
  const [createStatus, setCreateStatus] = useState<ParkingSpotStatus>('available');
  const [createFloor, setCreateFloor] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [codeOverridden, setCodeOverridden] = useState(false);

  const { t: tParking } = useTranslation('parking');

  // ADR-233: Auto-suggest parking code
  const { suggestedCode } = useEntityCodeSuggestion({
    entityType: 'parking',
    buildingId: createBuildingId,
    floorLevel: createFloor ? parseInt(createFloor, 10) || 0 : 0,
    disabled: codeOverridden || !createBuildingId,
  });

  // Auto-populate when suggestion arrives
  useEffect(() => {
    if (suggestedCode && !codeOverridden) {
      setCreateNumber(suggestedCode);
    }
  }, [suggestedCode, codeOverridden]);

  const resetCreateForm = useCallback(() => {
    setShowCreateForm(false);
    setCreateBuildingId('');
    setCreateNumber('');
    setCreateType('standard');
    setCreateStatus('available');
    setCreateFloor('');
    setCreateError(null);
    setCodeOverridden(false);
  }, []);

  const handleCreateParking = useCallback(async () => {
    if (!createNumber.trim()) return;

    setCreating(true);
    setCreateError(null);

    try {
      const selectedBuilding = createBuildingId ? buildings.find(b => b.id === createBuildingId) : null;

      const payload: Record<string, unknown> = {
        number: createNumber.trim(),
        type: createType,
        status: createStatus,
      };
      if (createBuildingId) payload.buildingId = createBuildingId;
      if (createFloor.trim()) payload.floor = createFloor.trim();
      if (selectedBuilding?.projectId) payload.projectId = selectedBuilding.projectId;

      const result = await apiClient.post<{ parkingSpotId: string }>('/api/parking', payload);

      if (result?.parkingSpotId) {
        RealtimeService.dispatch('PARKING_CREATED', {
          parkingSpotId: result.parkingSpotId,
          parkingSpot: { number: createNumber.trim(), type: createType, status: createStatus },
          timestamp: Date.now(),
        });
        resetCreateForm();
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Σφάλμα δημιουργίας');
    } finally {
      setCreating(false);
    }
  }, [createNumber, createType, createStatus, createBuildingId, createFloor, buildings, resetCreateForm]);

  const handleDeleteParking = useCallback(async () => {
    if (!selectedParking) return;
    setIsDeleting(true);
    try {
      const result = await apiClient.delete<ParkingDeleteResult>(
        `/api/parking/${selectedParking.id}`
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
    return <PageLoadingState icon={Car} message={t('pages.parking.loading')} />;
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

        {/* Inline Create Form */}
        {showCreateForm && (
          <form
            className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
            onSubmit={(e) => { e.preventDefault(); handleCreateParking(); }}
          >
            {/* Row 1: Building, Number, Type */}
            <fieldset className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('pages.parking.form.building', 'Κτίριο')}
                </span>
                <Select value={createBuildingId} onValueChange={setCreateBuildingId} disabled={creating}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('pages.parking.form.selectBuilding', 'Προαιρετικό')} />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('pages.parking.form.number', 'Αριθμός')} *
                </span>
                <Input
                  value={createNumber}
                  onChange={(e) => {
                    setCreateNumber(e.target.value);
                    if (!codeOverridden && e.target.value !== suggestedCode) setCodeOverridden(true);
                    if (!e.target.value) setCodeOverridden(false);
                  }}
                  placeholder={suggestedCode || 'P-001'}
                  className="h-9"
                  disabled={creating}
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('pages.parking.form.type', 'Τύπος')}
                </span>
                <Select value={createType} onValueChange={(v) => setCreateType(v as ParkingSpotType)} disabled={creating}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARKING_TYPES.map(pt => (
                      <SelectItem key={pt} value={pt}>{tParking(`types.${pt}`, pt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </fieldset>

            {/* Row 2: Status, Floor */}
            <fieldset className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('pages.parking.form.status', 'Κατάσταση')}
                </span>
                <Select value={createStatus} onValueChange={(v) => setCreateStatus(v as ParkingSpotStatus)} disabled={creating}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARKING_STATUSES.map(ps => (
                      <SelectItem key={ps} value={ps}>{tParking(`status.${ps}`, ps)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('pages.parking.form.floor', 'Όροφος')}
                </span>
                <Input
                  value={createFloor}
                  onChange={(e) => setCreateFloor(e.target.value)}
                  placeholder="-1"
                  className="h-9"
                  disabled={creating}
                />
              </label>
              <nav className="flex items-end justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={resetCreateForm} disabled={creating}>
                  <X className="mr-1 h-4 w-4" />
                  {t('pages.parking.form.cancel', 'Ακύρωση')}
                </Button>
                <Button type="submit" size="sm" disabled={!createNumber.trim() || creating}>
                  {creating ? <Spinner size="small" color="inherit" className="mr-1" /> : <Check className="mr-1 h-4 w-4" />}
                  {t('pages.parking.form.create', 'Δημιουργία')}
                </Button>
              </nav>
            </fieldset>

            {/* Error */}
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </form>
        )}

        {/* Content */}
        <ListContainer>
          {viewMode === 'grid' ? (
            /* 🏢 ENTERPRISE: Full-width Grid View */
            <ParkingGridView
              parkingSpots={filteredParkingSpots}
              selectedParking={selectedParking}
              onSelectParking={(p) => {
                setSelectedParking(toggleSelect(selectedParking, p));
                setShowCreateForm(false);
              }}
            />
          ) : (
            /* 🏢 ENTERPRISE: List View with Details Panel */
            <>
              <ParkingsList
                parkingSpots={filteredParkingSpots}
                selectedParking={selectedParking}
                onSelectParking={(p) => {
                  setSelectedParking(toggleSelect(selectedParking, p));
                  setShowCreateForm(false);
                }}
                onNewItem={() => {
                  setShowCreateForm(true);
                  setSelectedParking(null);
                }}
              />
              <ParkingDetails
                parking={selectedParking}
                onNewParking={() => {
                  setShowCreateForm(true);
                  setSelectedParking(null);
                }}
                onDelete={() => setShowDeleteDialog(true)}
              />
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

        {/* Delete Parking Confirmation */}
        <DeleteConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title={t('pages.parking.deleteDialog.title')}
          description={t('pages.parking.deleteDialog.description', { number: selectedParking?.number ?? '' })}
          onConfirm={handleDeleteParking}
          loading={isDeleting}
        />
      </PageContainer>
  );
}

/**
 * 🔧 Next.js 15: Page with Suspense boundary for useSearchParams
 * Note: Suspense fallback uses static text (Server Component constraint)
 */
export default function ParkingPage() {
  return (
    <Suspense fallback={<StaticPageLoading icon={Car} />}>
      <ParkingPageContent />
    </Suspense>
  );
}
