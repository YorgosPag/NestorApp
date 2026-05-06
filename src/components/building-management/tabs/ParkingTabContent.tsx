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
import { useRouter } from 'next/navigation';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Car, Plus, Search, BarChart3, Layers, Table as TableIcon, Link2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { Building } from '@/types/building/contracts';
import type { ParkingSpot, ParkingSpotType, ParkingSpotStatus } from '@/types/parking';
import { PARKING_TYPES, PARKING_STATUSES } from '@/types/parking';
import { BuildingSpaceTable, BuildingSpaceCardGrid, BuildingSpaceConfirmDialog, BuildingSpaceLinkDialog, BuildingSpaceWarningBanner, buildTypeCodeField, buildFloorField, buildAreaField, buildPriceField } from '../shared';
import type { SpaceColumn, SpaceCardField } from '../shared';
import { ENTITY_ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

import { useParkingTabState } from './useParkingTabState';
import { getStatusBadgeClasses } from './parking-tab-config';
import { ParkingQuickCreateSheet } from '../dialogs/ParkingQuickCreateSheet';
import { ParkingEditRow } from './parking-tab-forms';
import { useHasAnyParking } from '@/hooks/useHasAnyUnits';

// Re-export types for backward compatibility
export type { ParkingTabContentProps } from './parking-tab-config';

// ============================================================================
// COMPONENT
// ============================================================================
export function ParkingTabContent({ building }: { building: Building }) {
  const router = useRouter();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const state = useParkingTabState({
    buildingId: building.id,
    projectId: building.projectId,
  });

  const { t, tBuilding } = state;
  const hasAnyParking = useHasAnyParking();

  /** Renders a colored status badge for a parking spot. */
  const getStatusBadge = (status: ParkingSpotStatus | undefined) => {
    const s = status || 'available';
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClasses(status)}`}>
        {t(`status.${s}`)}
      </span>
    );
  };

  const parkingColumns: SpaceColumn<ParkingSpot>[] = useMemo(() => [
    { key: 'number', label: t('general.fields.spotCode'), sortValue: (s) => s.number, render: (s) => <span className="font-mono font-medium">{s.number}</span> },
    { key: 'type', label: t('general.fields.type'), width: 'w-28', sortValue: (s) => s.type || 'standard', render: (s) => <span className={colors.text.muted}>{t(`types.${s.type || 'standard'}`)}</span> },
    { key: 'floor', label: t('general.fields.floor'), width: 'w-20', sortValue: (s) => s.floor || '', render: (s) => <span className={colors.text.muted}>{s.floor || '—'}</span> },
    { key: 'area', label: 'm²', width: 'w-20', sortValue: (s) => s.area || 0, render: (s) => <span className="font-mono text-xs">{s.area ? `${s.area}` : '—'}</span> },
    { key: 'price', label: t('general.fields.price'), width: 'w-24', sortValue: (s) => s.price || 0, render: (s) => <span className="font-mono text-xs">{formatCurrencyWhole(s.price)}</span> },
    { key: 'status', label: t('general.fields.status'), width: 'w-28', sortValue: (s) => s.status || '', render: (s) => getStatusBadge(s.status) },
  ], [t, colors.text.muted]);

  const parkingCardFields: SpaceCardField<ParkingSpot>[] = useMemo(() => [
    buildTypeCodeField(t('general.fields.type'), (s) => t(`types.${s.type || 'standard'}`), (s) => s.code),
    buildFloorField(t('general.fields.floor'), (s) => s.floor),
    buildAreaField((s) => s.area),
    buildPriceField(t('general.fields.price'), (s) => s.price),
  ], [t]);

  if (state.loading) {
    return (
      <section className="flex items-center justify-center py-2">
        <Spinner size="large" />
      </section>
    );
  }

  if (state.error) {
    return (
      <section className="flex flex-col items-center gap-2 py-2">
        <p className="text-sm text-destructive">{state.error}</p>
        {/* eslint-disable-next-line custom/no-hardcoded-strings */}
        <Button variant="outline" size="sm" onClick={state.fetchParkingSpots}>
          Retry
        </Button>
      </section>
    );
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
      <Card>
        <CardContent className="p-2">
          <fieldset className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <label className="relative md:col-span-2">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.text.muted} ${iconSizes.sm}`} />
              <Input
                placeholder={tBuilding('parkingStats.searchPlaceholder')}
                value={state.searchTerm}
                onChange={(e) => state.setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </label>

            <Select value={state.filterType} onValueChange={(val) => state.setFilterType(val as ParkingSpotType | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder={t('allTypes', { ns: 'filters' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes', { ns: 'filters' })}</SelectItem>
                {PARKING_TYPES.map(pt => (
                  <SelectItem key={pt} value={pt}>{t(`types.${pt}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={state.filterStatus} onValueChange={(val) => state.setFilterStatus(val as ParkingSpotStatus | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder={t('allStatuses', { ns: 'filters' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses', { ns: 'filters' })}</SelectItem>
                {PARKING_STATUSES.map(ps => (
                  <SelectItem key={ps} value={ps}>{t(`status.${ps}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center gap-2">
              <BarChart3 className={iconSizes.sm} />
              {tBuilding('parkingStats.exportReport')}
            </Button>
          </fieldset>
        </CardContent>
      </Card>

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
        <fieldset className="flex items-center gap-2">
          <Button variant={state.viewMode === 'cards' ? 'default' : 'outline'} size="sm" onClick={() => state.setViewMode('cards')}>
            <Layers className="mr-1 h-4 w-4" /> {tBuilding('parkingStats.cards')}
          </Button>
          <Button variant={state.viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => state.setViewMode('table')}>
            <TableIcon className="mr-1 h-4 w-4" /> {tBuilding('parkingStats.table')}
          </Button>
        </fieldset>
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
            renderStatus={(s) => getStatusBadge(s.status)}
            fields={parkingCardFields}
            actions={{
              onView: (s) => router.push(ENTITY_ROUTES.spaces.parking(s.id)),
              onEdit: state.startEdit,
              onUnlink: state.handleUnlinkClick,
              onDelete: state.handleDeleteClick,
            }}
            actionState={{ unlinkingId: state.unlinkingId, deletingId: state.deletingId }}
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
            getKey={(s) => s.id}
            actions={{
              onView: (s) => router.push(ENTITY_ROUTES.spaces.parking(s.id)),
              onEdit: state.startEdit,
              onUnlink: state.handleUnlinkClick,
              onDelete: state.handleDeleteClick,
            }}
            actionState={{ unlinkingId: state.unlinkingId, deletingId: state.deletingId }}
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
