/**
 * ParkingTabContent — Building Parking Spots Management Tab
 *
 * Lists, creates and manages parking spots for a building.
 * Reads from the same Firestore collection as /spaces/parking (bidirectional sync).
 *
 * State logic: useParkingTabState.ts
 * Types & config: parking-tab-config.ts
 *
 * @module components/building-management/tabs/ParkingTabContent
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import { useMemo } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { Button } from '@/components/ui/button';
import { Car, Plus, Link2 } from 'lucide-react';
import { BuildingSpaceTabLoading, BuildingSpaceTabError } from '../shared/BuildingSpaceTabStatus';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { Building } from '@/types/building/contracts';
import { formatBuildingLabel } from '@/lib/entity-formatters';
import type { ParkingSpot } from '@/types/parking';
import { PARKING_TYPES } from '@/types/parking';
import { SpaceStatusBadges } from '@/components/shared/unit-status/SpaceStatusBadges';
import { useSpaceAvailabilityOptions } from '@/components/shared/unit-status/useSpaceAvailabilityOptions';
import { BuildingSpaceTable, BuildingSpaceCardGrid, BuildingSpaceConfirmDialog, BuildingSpaceLinkDialog, BuildingSpaceWarningBanner, BuildingSpaceFilterBar, buildTypeCodeField, buildFloorField, buildAreaField, buildPriceField, buildPriceColumns, buildAreaColumn, buildFloorColumn, useSpaceAvailabilityColumn, useSpaceTableExport, BuildingSpaceViewSwitch } from '../shared';
import type { SpaceColumn, SpaceCardField } from '../shared';
import { ENTITY_ROUTES } from '@/lib/routes';
import { BuildingSpaceRelationsPanel } from '../shared/BuildingSpaceRelationsPanel';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

import { useParkingTabState } from './useParkingTabState';
import { ParkingQuickCreateSheet } from '../dialogs/ParkingQuickCreateSheet';
import { ParkingEditRow } from './parking-tab-forms';
import { useHasAnyParking } from '@/hooks/useHasAnyUnits';
import { useFloorLabel } from '@/hooks/useFloorLabel';

// Re-export types for backward compatibility
export type { ParkingTabContentProps } from './parking-tab-config';

// ============================================================================
// COMPONENT
// ============================================================================
export function ParkingTabContent({ building }: { building: Building }) {
  const router = useRouter();
  const colors = useSemanticColors();

  const state = useParkingTabState({
    buildingId: building.id,
    projectId: building.projectId,
  });

  const { t, tBuilding } = state;
  const hasAnyParking = useHasAnyParking();
  const floorLabel = useFloorLabel();
  const availability = useSpaceAvailabilityOptions();

  // Ένας ορισμός στηλών για οθόνη ΚΑΙ εξαγωγή XLSX (ADR-898 Φ4β) — όροφος/επιφάνεια/τιμή/διάθεση από τα κοινά.
  const availabilityColumn = useSpaceAvailabilityColumn<ParkingSpot>();
  const parkingColumns: SpaceColumn<ParkingSpot>[] = useMemo(() => [
    { key: 'number', label: t('general.fields.spotCode'), sortValue: (s) => s.number, render: (s) => <span className="font-mono font-medium">{s.number}</span>, exportCell: (s) => s.number || null },
    { key: 'type', label: t('general.fields.type'), width: 'w-28', sortValue: (s) => s.type || 'standard', render: (s) => <span className={colors.text.muted}>{t(`types.${s.type || 'standard'}`)}</span>, exportCell: (s) => t(`types.${s.type || 'standard'}`) },
    buildFloorColumn<ParkingSpot>(t('general.fields.floor'), colors.text.muted, floorLabel),
    buildAreaColumn<ParkingSpot>(tBuilding('spaceColumns.area'), (s) => s.area || null),
    // ADR-777 §8.60.14.14 — κελί ΜΕ μονάδα, σειρά ΣΕ ΟΜΑΔΕΣ ανά μονάδα (ποτέ €/μήνα δίπλα σε € πώλησης)· στο αρχείο ποσό + μονάδα.
    ...buildPriceColumns<ParkingSpot>({ price: t('general.fields.price'), unit: tBuilding('spaceColumns.priceUnit') }, t, (s) => s.number),
    // ADR-777 §8.60.20 — διάθεση (από το `commercialStatus`) + λειτουργική εξαίρεση· ποτέ το παλιό `status`.
    availabilityColumn,
  ], [t, tBuilding, colors.text.muted, availabilityColumn, floorLabel]);

  const parkingCardFields: SpaceCardField<ParkingSpot>[] = useMemo(() => [
    buildTypeCodeField(t('general.fields.type'), (s) => t(`types.${s.type || 'standard'}`), (s) => s.code),
    buildFloorField<ParkingSpot>(t('general.fields.floor'), floorLabel),
    buildAreaField((s) => s.area),
    buildPriceField(t('general.fields.price'), t),
  ], [t, floorLabel]);

  // Ίδιες ενέργειες σε κάρτες ΚΑΙ πίνακα — γραμμένες μία φορά, ώστε οι δύο όψεις
  // της ίδιας καρτέλας να μη μπορούν να προσφέρουν διαφορετικές.
  const spaceActions = useMemo(() => ({
    onView: (s: ParkingSpot) => router.push(ENTITY_ROUTES.spaces.parking(s.id)),
    onEdit: state.startEdit,
    onUnlink: state.handleUnlinkClick,
    onDelete: state.handleDeleteClick,
  }), [router, state.startEdit, state.handleUnlinkClick, state.handleDeleteClick]);

  const spaceActionState = { unlinkingId: state.unlinkingId, deletingId: state.deletingId };

  // Μία περιγραφή φίλτρων για την μπάρα ΚΑΙ για τις «Παραδοχές» της εξαγωγής (ADR-898 Φ4β).
  const typeFilter = {
    value: state.filterType,
    onChange: state.setFilterType,
    options: PARKING_TYPES.map((pt) => ({ value: pt, label: t(`types.${pt}`) })),
    allLabel: t('allTypes', { ns: 'filters' }),
  };
  const statusFilter = { value: state.filterStatus, onChange: state.setFilterStatus, options: availability.options, allLabel: availability.allLabel };
  const tableExport = useSpaceTableExport({
    buildingName: formatBuildingLabel(building.code, building.name),
    tabLabel: tBuilding('tabs.labels.parking'),
    columns: parkingColumns,
    items: state.filteredSpots,
    totalCount: state.parkingSpots.length,
    viewMode: state.viewMode,
    searchTerm: state.searchTerm,
    typeFilter,
    statusFilter,
  });

  if (state.loading) {
    return <BuildingSpaceTabLoading />;
  }

  if (state.error) {
    return <BuildingSpaceTabError message={state.error} retryLabel={tBuilding('unitStats.retry')} onRetry={state.fetchParkingSpots} />;
  }

  return (
    <section className="flex flex-col gap-2 p-2">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Car className="h-5 w-5 text-primary" />
          {tBuilding('tabs.labels.parking')}
          <span className={cn("text-sm font-normal", colors.text.muted)}>({state.parkingSpots.length})</span>
        </h2>
        <nav className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => state.setShowLinkDialog(true)} disabled={!hasAnyParking}>
            <Link2 className="mr-1 h-4 w-4" />
            {tBuilding('spaceLink.linkExisting')}
          </Button>
          <Button variant="default" size="sm" onClick={() => state.setShowCreateForm(true)} disabled={state.showCreateForm}>
            <Plus className="mr-1 h-4 w-4" />
            {tBuilding('tabs.labels.parking')}
          </Button>
        </nav>
      </header>

      {/* Stats Cards */}
      <UnifiedDashboard stats={state.dashboardStats} columns={4} className="" />

      {/* Filters */}
      <BuildingSpaceFilterBar
        searchPlaceholder={tBuilding('parkingStats.searchPlaceholder')}
        searchTerm={state.searchTerm}
        onSearchChange={state.setSearchTerm}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        exportAction={tableExport.exportAction}
      />

      <ParkingQuickCreateSheet
        open={state.showCreateForm}
        onOpenChange={(v) => {
          if (!v) {
            state.setShowCreateForm(false);
            state.fetchParkingSpots();
          }
        }}
        buildingId={building.id}
        projectId={building.projectId ?? ''}
      />

      {/* View Toggle */}
      <nav className="flex items-center justify-between">
        <span className={cn("text-sm", colors.text.muted)}>
          {state.filteredSpots.length} {tBuilding('parkingStats.results')}
        </span>
        <BuildingSpaceViewSwitch value={state.viewMode} onChange={state.setViewMode} cardsLabel={tBuilding('parkingStats.cards')} tableLabel={tBuilding('parkingStats.table')} />
      </nav>

      {/* Content */}
      {state.filteredSpots.length === 0 ? (
        state.parkingSpots.length === 0 && (building.floors ?? 0) > 0 ? (
          <BuildingSpaceWarningBanner
            title={tBuilding('parkingStats.warningEmpty')}
            hint={tBuilding('parkingStats.warningEmptyHint')}
            addLabel={tBuilding('tabs.labels.parking')}
            onAdd={() => state.setShowCreateForm(true)}
          />
        ) : (
          <p className={cn("py-2 text-center text-sm", colors.text.muted)}>
            {tBuilding('tabs.labels.parking')} — 0
          </p>
        )
      ) : state.viewMode === 'cards' ? (
        <>
          <BuildingSpaceCardGrid<ParkingSpot>
            items={state.filteredSpots}
            getKey={(s) => s.id}
            getName={(s) => s.number || s.code || s.id}
            renderStatus={(s) => <SpaceStatusBadges space={s} />}
            fields={parkingCardFields}
            actions={spaceActions}
            actionState={spaceActionState}
          />
          <footer className={cn("text-xs", colors.text.muted)}>
            {state.filteredSpots.length} {tBuilding('tabs.labels.parking')}
          </footer>
        </>
      ) : (
        <>
          <BuildingSpaceTable<ParkingSpot>
            items={state.filteredSpots}
            columns={parkingColumns}
            {...tableExport.tableSort}
            getKey={(s) => s.id}
            actions={spaceActions}
            actionState={spaceActionState}
            editingId={state.editingId}
            renderEditRow={() => (
              <ParkingEditRow state={state} t={t} />
            )}
          />
          <footer className={cn("text-xs", colors.text.muted)}>
            {state.filteredSpots.length} {tBuilding('tabs.labels.parking')}
            {state.filteredSpots.length !== state.parkingSpots.length && (
              <span className="ml-1">({state.parkingSpots.length} {tBuilding('parkingStats.total_summary')})</span>
            )}
          </footer>
        </>
      )}

      {/* ADR-898 §20 — παρακολουθήματα σε άλλο κτίριο (αναφορές) · χωρίς κτίριο (επιδιόρθωση ενός κλικ) */}
      <BuildingSpaceRelationsPanel buildingId={building.id} kind="parking" onPlace={state.handleLinkParking} />

      {/* Link Existing Dialog */}
      <BuildingSpaceLinkDialog
        open={state.showLinkDialog}
        onOpenChange={state.setShowLinkDialog}
        title={tBuilding('spaceLink.linkParking')}
        description={tBuilding('spaceLink.linkParkingDesc')}
        fetchUnlinked={state.fetchUnlinkedParking}
        onLink={state.handleLinkParking}
      />

      {/* ADR-226: Deletion Guard blocked dialog */}
      {state.BlockedDialog}

      {/* Centralized Confirm Dialog (delete / unlink) */}
      <BuildingSpaceConfirmDialog
        open={!!state.confirmAction}
        onOpenChange={(open) => { if (!open) state.setConfirmAction(null); }}
        title={
          state.confirmAction?.type === 'delete'
            ? tBuilding('spaceConfirm.deleteParking')
            : tBuilding('spaceConfirm.unlinkParking')
        }
        description={
          state.confirmAction?.type === 'delete' ? (
            <>
              {tBuilding('spaceConfirm.deleteParkingDesc')}{' '}
              <strong>&quot;{state.confirmAction.item.number}&quot;</strong>;
              <br /><br />
              {tBuilding('spaceConfirm.irreversible')}
            </>
          ) : (
            <>
              {tBuilding('spaceConfirm.unlinkParkingDesc')}
              <br /><br />
              <strong>{state.confirmAction?.item.number}</strong>
            </>
          )
        }
        confirmLabel={
          state.confirmAction?.type === 'delete'
            ? tBuilding('spaceActions.delete')
            : tBuilding('spaceActions.unlink')
        }
        onConfirm={state.handleConfirm}
        loading={state.confirmLoading}
        variant={state.confirmAction?.type === 'delete' ? 'destructive' : 'warning'}
      />
    </section>
  );
}

export default ParkingTabContent;
