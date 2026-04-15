
'use client';

import React, { useState, useCallback, useTransition, useEffect } from 'react';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { toggleSelect } from '@/lib/toggle-select';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// [ENTERPRISE] Import from canonical location
import { PageLoadingState, PageErrorState } from '@/core/states';
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
  Trash2
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// [ENTERPRISE] Navigation context for breadcrumb sync
import { useNavigation } from '@/components/navigation/core/NavigationContext';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { BuildingsGroupedView } from './BuildingsPage/BuildingsGroupedView';
import { useBuildingsPageState } from '@/hooks/useBuildingsPageState';
import { useBuildingStats } from '@/hooks/useBuildingStats';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { deleteBuildingWithPolicy } from '@/services/building/building-mutation-gateway';
import { AdvancedFiltersPanel, buildingFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer } from '@/core/containers';
// [ENTERPRISE] i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Building as BuildingType } from '@/types/building/contracts';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import { useBuildingsTrashState } from '@/hooks/useBuildingsTrashState';
import { TrashActionsBar } from '@/components/shared/trash/TrashActionsBar';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('BuildingsPageContent');

// Re-export Building type for backward compatibility
export type { Building } from '@/types/building/contracts';

export function BuildingsPageContent() {
  // [ENTERPRISE] i18n hook for translations
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline', 'trash']);
  const { t: tCommon } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // [ENTERPRISE] Navigation context for breadcrumb sync
  const { companies, projects, syncBreadcrumb } = useNavigation();

  // Load buildings from Firestore
  const { buildings: buildingsData, loading: buildingsLoading, error: buildingsError, refetch: refetchBuildings } = useFirestoreBuildings();

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

  // Mobile-only filter toggle state
  const [showFilters, setShowFilters] = React.useState(false);

  // ✅ PERF: startTransition defers the expensive details panel re-render
  const [, startTransition] = useTransition();

  // 🏢 ENTERPRISE: Lifted edit state for CompactToolbar ↔ BuildingDetails sync
  const [isEditingBuilding, setIsEditingBuilding] = useState(false);

  const handleEditBuilding = useCallback(() => {
    setIsEditingBuilding(true);
  }, []);

  // 🏢 ENTERPRISE: "Fill then Create" pattern (Salesforce/Procore/SAP)
  // No API call on "New" — open empty form, create on Save
  const TEMP_BUILDING_ID = '__new__';
  const [startInEditMode, setStartInEditMode] = useState(false);
  const isCreateMode = selectedBuilding?.id === TEMP_BUILDING_ID;

  const handleNewBuilding = useCallback(() => {
    const defaultCompanyId = companies[0]?.id || '';
    const tempBuilding: BuildingType = {
      id: TEMP_BUILDING_ID,
      name: '',
      description: '',
      status: 'planning',
      companyId: defaultCompanyId,
      company: '',
      address: '',
      city: '',
      location: '',
      totalArea: 0,
      builtArea: 0,
      floors: 0,
      units: 0,
      totalValue: 0,
      progress: 0,
      projectId: '',
      createdAt: new Date().toISOString(),
    };
    setSelectedBuilding(tempBuilding);
    setStartInEditMode(true);
    logger.info('New building form opened (Fill then Create)');
  }, [companies, setSelectedBuilding]);

  // 🏢 ENTERPRISE: After successful creation, sync selectedBuilding with real data.
  // Fast path: if onSnapshot already delivered the document, use it directly.
  // Slow path: set the real ID on the temp building; useEntityPageState's sync
  // effect (deps: [items, selectedItem?.id]) will replace it with the full
  // Firestore document as soon as the onSnapshot callback fires.
  const handleBuildingCreated = useCallback((realBuildingId: string) => {
    if (selectedBuilding && selectedBuilding.id === TEMP_BUILDING_ID) {
      const realBuilding = buildingsData.find(b => b.id === realBuildingId);
      setSelectedBuilding(
        (realBuilding ?? { ...selectedBuilding, id: realBuildingId }) as BuildingType,
      );
      setStartInEditMode(false);
    }
  }, [selectedBuilding, setSelectedBuilding, buildingsData]);

  // 🏢 ENTERPRISE: Cancel create mode — deselect building
  const handleCancelCreate = useCallback(() => {
    if (isCreateMode) {
      setSelectedBuilding(null);
    }
  }, [isCreateMode, setSelectedBuilding]);

  // 🗑️ ADR-308: Trash view state
  const {
    showTrash,
    trashCount,
    trashedBuildings,
    loadingTrash,
    showPermanentDeleteDialog,
    pendingPermanentDeleteIds,
    handleToggleTrash,
    handleRestoreBuildings,
    handlePermanentDeleteBuildings,
    handleConfirmPermanentDelete,
    handleCancelPermanentDelete,
  } = useBuildingsTrashState({ forceDataRefresh: refetchBuildings });

  // 🛡️ ADR-226 Phase 3: Deletion Guard — replaces cascade preview
  const { checking: checkingDeletion, checkBeforeDelete, BlockedDialog } = useDeletionGuard('building');
  const [buildingToDelete, setBuildingToDelete] = useState<BuildingType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBuilding = useCallback(async () => {
    if (!selectedBuilding) return;
    const allowed = await checkBeforeDelete(selectedBuilding.id);
    if (allowed) {
      setBuildingToDelete(selectedBuilding as BuildingType);
    }
  }, [selectedBuilding, checkBeforeDelete]);

  const handleConfirmDelete = useCallback(async () => {
    if (!buildingToDelete) return;
    setIsDeleting(true);
    const result = await deleteBuildingWithPolicy({ buildingId: buildingToDelete.id });
    if (result.success) {
      logger.info('Building deleted', { buildingId: buildingToDelete.id });
      setSelectedBuilding(null);
    } else {
      logger.error('Failed to delete building', { buildingId: buildingToDelete.id, error: result.error });
    }
    // Always close dialog — on error user can retry
    setBuildingToDelete(null);
    setIsDeleting(false);
  }, [buildingToDelete, setSelectedBuilding]);

  // [PERF] Stable callback refs to prevent child re-renders
  const handleCloseMobileDetails = useCallback(() => setSelectedBuilding(null), [setSelectedBuilding]);

  // [ENTERPRISE] Sync selectedBuilding with NavigationContext for breadcrumb display
  React.useEffect(() => {
    if (selectedBuilding && companies.length > 0 && projects.length > 0) {
      // Find the project and company this building belongs to
      const project = projects.find(p => p.id === selectedBuilding.projectId);
      if (project) {
        const company = companies.find(c => c.id === project.linkedCompanyId);
        if (company) {
          // Use atomic sync with names (not just IDs) - enterprise pattern
          syncBreadcrumb({
            company: { id: company.id, name: company.companyName },
            project: { id: project.id, name: project.name },
            building: { id: selectedBuilding.id, name: selectedBuilding.name },
            currentLevel: 'buildings'
          });
        }
      }
    }
  }, [selectedBuilding?.id, companies.length, projects.length, syncBreadcrumb]);

  const buildingsStats = useBuildingStats(baseFilteredBuildings);

  // [NEW] Dashboard card filtering state
  const [activeCardFilter, setActiveCardFilter] = React.useState<string | null>(null);

  // Transform stats to UnifiedDashboard format
  const dashboardStats: DashboardStat[] = [
    {
      title: t('pages.buildings.dashboard.totalBuildings'),
      value: buildingsStats.totalBuildings,
      icon: Building,
      color: "blue"
    },
    {
      title: t('pages.buildings.dashboard.activeProjects'),
      value: buildingsStats.activeProjects,
      icon: TrendingUp,
      color: "green"
    },
    {
      title: t('pages.buildings.dashboard.totalValue'),
      value: `\u20AC${(buildingsStats.totalValue / 1000000).toFixed(1)}M`,
      icon: BarChart3,
      color: "purple"
    },
    {
      title: t('pages.buildings.dashboard.totalArea'),
      value: `${(buildingsStats.totalArea / 1000).toFixed(1)}K m\u00B2`,
      icon: MapPin,
      color: "orange"
    },
    {
      title: t('pages.buildings.dashboard.averageProgress'),
      value: `${buildingsStats.averageProgress}%`,
      icon: Calendar,
      color: "cyan"
    },
    {
      title: t('pages.buildings.dashboard.totalProperties'),
      value: buildingsStats.totalProperties,
      icon: NAVIGATION_ENTITIES.property.icon,
      color: "pink"
    }
  ];

  // [NEW] Handle dashboard card clicks for filtering
  const handleCardClick = (stat: DashboardStat) => {
    const cardTitle = stat.title;
    const totalBuildingsTitle = t('pages.buildings.dashboard.totalBuildings');
    const activeProjectsTitle = t('pages.buildings.dashboard.activeProjects');

    // Toggle filter: if we click the same card, remove the filter
    if (activeCardFilter === cardTitle) {
      setActiveCardFilter(null);
      // Reset filters to show all buildings
      setFilters({ ...filters, status: [] });
    } else {
      setActiveCardFilter(cardTitle);

      // Apply filter based on card type
      switch (cardTitle) {
        case totalBuildingsTitle:
          // Show all buildings - reset filters
          setFilters({ ...filters, status: [] });
          break;
        case activeProjectsTitle:
          // Filter only active buildings
          setFilters({ ...filters, status: ['active'] });
          break;
        // Note: Other cards (Total Value, Total Area, Average Progress, Total Units)
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
        <PageContainer ariaLabel={t('pages.buildings.loading')}>
          <PageLoadingState icon={Building} message={t('pages.buildings.loadingMessage')} layout="contained" />
        </PageContainer>
    );
  }

  // Show error state
  if (buildingsError) {
    return (
        <PageContainer ariaLabel={t('pages.buildings.error.pageLabel')}>
          <PageErrorState
            title={t('pages.buildings.error.title')}
            message={buildingsError}
            layout="contained"
          />
        </PageContainer>
    );
  }

  return (
      <PageContainer ariaLabel={t('pages.buildings.pageLabel')}>
        <BuildingsHeader
          viewMode={viewMode}
          setViewMode={setViewMode}
          showDashboard={showDashboard}
          setShowDashboard={setShowDashboard}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          onNewBuilding={showTrash ? undefined : handleNewBuilding}
          showTrash={showTrash}
          onToggleTrash={handleToggleTrash}
          trashCount={trashCount}
        />

        {showDashboard && (
          <section role="region" aria-label={t('pages.buildings.dashboard.label')}>
            <UnifiedDashboard stats={dashboardStats} columns={6} onCardClick={handleCardClick} />
          </section>
        )}

        {/* Advanced Filters Panel - Desktop */}
        <aside className="hidden md:block" role="complementary" aria-label={t('pages.buildings.filters.desktop')}>
          <AdvancedFiltersPanel
            config={buildingFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Advanced Filters Panel - Mobile (conditional) */}
        {showFilters && (
          <aside className="md:hidden" role="complementary" aria-label={t('pages.buildings.filters.mobile')}>
            <AdvancedFiltersPanel
              config={buildingFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen
            />
          </aside>
        )}

        {/* 🗑️ ADR-308: Trash actions bar — shown only in trash view, outside ListContainer so it spans full width */}
        {showTrash && !loadingTrash && (
          <TrashActionsBar
            selectedIds={selectedBuilding ? [selectedBuilding.id] : []}
            onBack={handleToggleTrash}
            onRestore={handleRestoreBuildings}
            onPermanentDelete={handlePermanentDeleteBuildings}
            trashCount={trashCount}
          />
        )}

        <ListContainer>
          {viewMode === 'list' ? (
            <>
              {/* [DESKTOP] Standard split layout */}
              <section className="hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden" role="region" aria-label={t('pages.buildings.views.desktopView')}>
                <BuildingsList
                  buildings={showTrash ? trashedBuildings : baseFilteredBuildings}
                  selectedBuilding={selectedBuilding!}
                  onSelectBuilding={(building) => {
                    startTransition(() => {
                      setSelectedBuilding(toggleSelect(selectedBuilding, building));
                      setStartInEditMode(false);
                    });
                  }}
                  onNewBuilding={showTrash ? undefined : handleNewBuilding}
                  onEditBuilding={selectedBuilding && !showTrash ? handleEditBuilding : undefined}
                  onDeleteBuilding={selectedBuilding && !showTrash ? handleDeleteBuilding : undefined}
                />
                <BuildingDetails
                  building={selectedBuilding!}
                  onNewBuilding={showTrash ? undefined : handleNewBuilding}
                  onDeleteBuilding={showTrash ? undefined : handleDeleteBuilding}
                  startInEditMode={showTrash ? false : startInEditMode}
                  isEditing={showTrash ? false : isEditingBuilding}
                  isTrashMode={showTrash}
                  onSetEditing={showTrash ? undefined : setIsEditingBuilding}
                  isCreateMode={showTrash ? false : isCreateMode}
                  onBuildingCreated={showTrash ? undefined : handleBuildingCreated}
                  onCancelCreate={showTrash ? undefined : handleCancelCreate}
                />
              </section>

              {/* [MOBILE] Show only BuildingsList when no building is selected */}
              <section className={`md:hidden w-full ${selectedBuilding ? 'hidden' : 'block'}`} role="region" aria-label={t('pages.buildings.views.mobileList')}>
                <BuildingsList
                  buildings={showTrash ? trashedBuildings : baseFilteredBuildings}
                  selectedBuilding={selectedBuilding!}
                  onSelectBuilding={(building) => {
                    startTransition(() => {
                      setSelectedBuilding(toggleSelect(selectedBuilding, building));
                      setStartInEditMode(false);
                    });
                  }}
                  onNewBuilding={showTrash ? undefined : handleNewBuilding}
                  onEditBuilding={selectedBuilding && !showTrash ? handleEditBuilding : undefined}
                  onDeleteBuilding={selectedBuilding && !showTrash ? handleDeleteBuilding : undefined}
                />
              </section>

              {/* [MOBILE] Slide-in BuildingDetails when building is selected */}
              <MobileDetailsSlideIn
                isOpen={!!selectedBuilding}
                onClose={handleCloseMobileDetails}
                title={selectedBuilding?.name || t('pages.buildings.details.title')}
                actionButtons={
                  <button
                    onClick={handleDeleteBuilding}
                    className={cn(
                      "p-2 rounded-md border border-border text-destructive",
                      colors.bg.primary,
                      INTERACTIVE_PATTERNS.ACCENT_HOVER,
                      TRANSITION_PRESETS.STANDARD_COLORS
                    )}
                    aria-label={t('details.deleteBuilding')}
                  >
                    <Trash2 className={iconSizes.sm} />
                  </button>
                }
              >
                {selectedBuilding && (
                  <BuildingDetails
                    building={selectedBuilding}
                    onNewBuilding={showTrash ? undefined : handleNewBuilding}
                    onDeleteBuilding={showTrash ? undefined : handleDeleteBuilding}
                    startInEditMode={showTrash ? false : startInEditMode}
                    isEditing={showTrash ? false : isEditingBuilding}
                    onSetEditing={showTrash ? undefined : setIsEditingBuilding}
                    isCreateMode={showTrash ? false : isCreateMode}
                    onBuildingCreated={showTrash ? undefined : handleBuildingCreated}
                    onCancelCreate={showTrash ? undefined : handleCancelCreate}
                    isTrashMode={showTrash}
                  />
                )}
              </MobileDetailsSlideIn>
            </>
          ) : (
            <BuildingsGroupedView
              viewMode={viewMode}
              filteredBuildings={baseFilteredBuildings}
              selectedBuilding={selectedBuilding}
              setSelectedBuilding={setSelectedBuilding}
            />
          )}
        </ListContainer>

        {/* 🛡️ ADR-226 Phase 3: Deletion Guard — blocked dialog */}
        {BlockedDialog}

        {/* 🏢 ENTERPRISE: Delete confirmation (shown only when guard allows) */}
        <DeleteConfirmDialog
          open={!!buildingToDelete}
          onOpenChange={(open) => { if (!open) setBuildingToDelete(null); }}
          title={t('details.deleteBuilding')}
          description={t('details.confirmDelete', { name: buildingToDelete?.name ?? '' })}
          confirmText={tCommon('buttons.moveToTrash')}
          onConfirm={handleConfirmDelete}
          loading={isDeleting}
          disabled={checkingDeletion}
        />

        {/* 🗑️ ADR-308: Permanent delete confirmation */}
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

export default BuildingsPageContent;
