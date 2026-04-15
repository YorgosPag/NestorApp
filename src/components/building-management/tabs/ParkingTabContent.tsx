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
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell } from '@/components/ui/table';
import { Car, Plus, Check, X, Search, BarChart3, Layers, Table as TableIcon, Link2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { Building } from '@/types/building/contracts';
import type { ParkingSpot, ParkingSpotType, ParkingSpotStatus, ParkingLocationZone } from '@/types/parking';
import { PARKING_TYPES, PARKING_STATUSES, PARKING_LOCATION_ZONES } from '@/types/parking';
import { BuildingSpaceTable, BuildingSpaceCardGrid, BuildingSpaceConfirmDialog, BuildingSpaceLinkDialog, buildTypeCodeField, buildFloorField, buildAreaField, buildPriceField } from '../shared';
import type { SpaceColumn, SpaceCardField } from '../shared';
import { ENTITY_ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

import { useParkingTabState } from './useParkingTabState';
import { getStatusBadgeClasses } from './parking-tab-config';

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
          <Button variant="outline" size="sm" onClick={() => state.setShowLinkDialog(true)}>
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

      {/* Create Form */}
      {state.showCreateForm && (
        <ParkingCreateForm state={state} t={t} colors={colors} />
      )}

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
        <p className={cn("py-2 text-center text-sm", colors.text.muted)}>
          {tBuilding('tabs.labels.parking')} — 0
        </p>
      ) : state.viewMode === 'cards' ? (
        <>
          <BuildingSpaceCardGrid<ParkingSpot>
            items={state.filteredSpots}
            getKey={(s) => s.id}
            getName={(s) => s.number}
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

/** Private sub-components — same file to avoid prop-drilling overhead. */

interface ParkingCreateFormProps {
  state: ReturnType<typeof useParkingTabState>;
  t: (key: string, options?: Record<string, string>) => string;
  colors: ReturnType<typeof useSemanticColors>;
}

function ParkingCreateForm({ state, t, colors }: ParkingCreateFormProps) {
  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2"
      onSubmit={(e) => { e.preventDefault(); state.handleCreate(); }}
    >
      {/* Row 1: Number, Type, Status */}
      <fieldset className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('general.fields.spotCode')} *
          </span>
          <Input
            value={state.createNumber}
            onChange={(e) => state.setCreateNumber(e.target.value)}
            placeholder="P-001"
            className="h-9"
            disabled={state.creating}
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('general.fields.type')}
          </span>
          <Select value={state.createType} onValueChange={(v) => state.setCreateType(v as ParkingSpotType)} disabled={state.creating}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PARKING_TYPES.map(pt => (
                <SelectItem key={pt} value={pt}>{t(`types.${pt}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('general.fields.status')}
          </span>
          <Select value={state.createStatus} onValueChange={(v) => state.setCreateStatus(v as ParkingSpotStatus)} disabled={state.creating}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PARKING_STATUSES.map(ps => (
                <SelectItem key={ps} value={ps}>{t(`status.${ps}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </fieldset>

      {/* Row 2: Location Zone, Floor, Area, Price */}
      <fieldset className="grid grid-cols-4 gap-2">
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('locationZone.label')}
          </span>
          <Select value={state.createLocationZone} onValueChange={(v) => state.setCreateLocationZone(v as ParkingLocationZone)} disabled={state.creating}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t('locationZone.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {PARKING_LOCATION_ZONES.map(lz => (
                <SelectItem key={lz} value={lz}>{t(`locationZone.${lz}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('general.fields.floor')}
          </span>
          <Input
            value={state.createFloor}
            onChange={(e) => state.setCreateFloor(e.target.value)}
            placeholder="-1"
            className="h-9"
            disabled={state.creating}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>m²</span>
          <Input
            type="number" step="0.01"
            value={state.createArea}
            onChange={(e) => state.setCreateArea(e.target.value)}
            placeholder="12"
            className="h-9"
            disabled={state.creating}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('general.fields.price')} (€)
          </span>
          <Input
            type="number" step="0.01"
            value={state.createPrice}
            onChange={(e) => state.setCreatePrice(e.target.value)}
            placeholder="15000"
            className="h-9"
            disabled={state.creating}
          />
        </label>
      </fieldset>

      {/* Row 3: Notes */}
      <label className="flex flex-col gap-1">
        <span className={cn("text-xs font-medium", colors.text.muted)}>
          {t('general.notes')}
        </span>
        <Textarea
          value={state.createNotes}
          onChange={(e) => state.setCreateNotes(e.target.value)}
          placeholder={t('general.notes')}
          className="h-16 resize-none"
          disabled={state.creating}
        />
      </label>

      {/* Actions */}
      <nav className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={state.resetCreateForm} disabled={state.creating}>
          <X className="mr-1 h-4 w-4" />
          {t('header.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={!state.createNumber.trim() || state.creating}>
          {state.creating ? <Spinner size="small" color="inherit" className="mr-1" /> : <Check className="mr-1 h-4 w-4" />}
          {t('header.save')}
        </Button>
      </nav>
    </form>
  );
}

interface ParkingEditRowProps {
  state: ReturnType<typeof useParkingTabState>;
  t: (key: string, options?: Record<string, string>) => string;
}

function ParkingEditRow({ state, t }: ParkingEditRowProps) {
  return (
    <>
      <TableCell>
        <Input value={state.editNumber} onChange={(e) => state.setEditNumber(e.target.value)} className="h-8" disabled={state.saving} />
      </TableCell>
      <TableCell>
        <Select value={state.editType} onValueChange={(v) => state.setEditType(v as ParkingSpotType)} disabled={state.saving}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PARKING_TYPES.map(pt => (<SelectItem key={pt} value={pt}>{t(`types.${pt}`)}</SelectItem>))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input value={state.editFloor} onChange={(e) => state.setEditFloor(e.target.value)} className="h-8 w-16" disabled={state.saving} />
      </TableCell>
      <TableCell>
        <Input type="number" step="0.01" value={state.editArea} onChange={(e) => state.setEditArea(e.target.value)} className="h-8 w-16" disabled={state.saving} />
      </TableCell>
      <TableCell>
        <Input type="number" step="0.01" value={state.editPrice} onChange={(e) => state.setEditPrice(e.target.value)} className="h-8 w-20" disabled={state.saving} />
      </TableCell>
      <TableCell>
        <Select value={state.editStatus} onValueChange={(v) => state.setEditStatus(v as ParkingSpotStatus)} disabled={state.saving}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PARKING_STATUSES.map(ps => (<SelectItem key={ps} value={ps}>{t(`status.${ps}`)}</SelectItem>))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <nav className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={state.handleSaveEdit} disabled={state.saving || !state.editNumber.trim()}>
            {state.saving ? <Spinner size="small" color="inherit" /> : <Check className="h-3.5 w-3.5 text-green-500" />} {/* eslint-disable-line design-system/enforce-semantic-colors */}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={state.cancelEdit} disabled={state.saving}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </nav>
      </TableCell>
    </>
  );
}

export default ParkingTabContent;
