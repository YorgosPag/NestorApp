/**
 * StorageTab — Building Storage Management Tab (Storage-only, no parking)
 *
 * Lists, creates, edits and deletes storage units for a building.
 * Uses API routes (/api/storages) for proper tenant isolation.
 *
 * Split: useStorageTabState (hook), StorageCreateForm (Google SRP).
 * @module components/building-management/StorageTab
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import type { Building } from '@/types/building/contracts';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell } from '@/components/ui/table';
import { Warehouse, Plus, Layers, Table as TableIcon, Link2, Check, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { StorageTabStats } from './StorageTab/StorageTabStats';
import { StorageTabFilters } from './StorageTab/StorageTabFilters';
import { StorageQuickCreateSheet } from './dialogs/StorageQuickCreateSheet';
import { useStorageTabState } from './StorageTab/useStorageTabState';
import { BuildingSpaceTable, BuildingSpaceCardGrid, BuildingSpaceConfirmDialog, BuildingSpaceLinkDialog, buildTypeCodeField, buildFloorField, buildAreaField, buildPriceField } from './shared';
import type { SpaceColumn, SpaceCardField } from './shared';
import { ENTITY_ROUTES } from '@/lib/routes';
import { getStatusColor } from '@/lib/design-system';

const STORAGE_TYPES: StorageType[] = ['storage', 'large', 'small', 'basement', 'ground', 'special', 'garage', 'warehouse'];
const STORAGE_STATUSES: StorageStatus[] = ['available', 'occupied', 'maintenance', 'reserved', 'sold', 'unavailable'];

interface StorageTabProps {
  building: Building;
}

export function StorageTab({ building }: StorageTabProps) {
  const colors = useSemanticColors();
  const router = useRouter();
  const s = useStorageTabState(building);

  // ── Column & card definitions ──

  const storageColumns: SpaceColumn<StorageUnit>[] = useMemo(() => [
    { key: 'code', label: s.t('storageTable.columns.code'), sortValue: (u) => u.code, render: (u) => <span className="font-medium">{u.code}</span> },
    { key: 'type', label: s.t('storageTable.columns.type'), width: 'w-28', sortValue: (u) => u.type, render: (u) => <span className={colors.text.muted}>{s.translatedGetTypeLabel(u.type)}</span> },
    { key: 'floor', label: s.t('storageTable.columns.floor'), width: 'w-20', sortValue: (u) => u.floor || '', render: (u) => <span className={colors.text.muted}>{u.floor || '—'}</span> },
    { key: 'area', label: s.t('storageTable.columns.area'), width: 'w-20', sortValue: (u) => u.area || 0, render: (u) => <span className="font-mono text-xs">{u.area ? `${u.area}` : '—'}</span> },
    { key: 'price', label: s.t('storageTable.columns.price'), width: 'w-24', sortValue: (u) => u.price || 0, render: (u) => <span className="font-mono text-xs">{formatCurrencyWhole(u.price)}</span> },
    { key: 'status', label: s.t('storageTable.columns.status'), width: 'w-28', sortValue: (u) => u.status, render: (u) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStorageBadgeClass(u.status)}`}>
        {s.translatedGetStatusLabel(u.status)}
      </span>
    )},
  ], [s.t, s.translatedGetTypeLabel, s.translatedGetStatusLabel, colors.text.muted]);

  const storageCardFields: SpaceCardField<StorageUnit>[] = useMemo(() => [
    buildTypeCodeField(s.t('storageTable.columns.type'), (u) => s.translatedGetTypeLabel(u.type), (u) => u.code),
    buildFloorField(s.t('storageTable.columns.floor'), (u) => u.floor),
    buildAreaField((u) => u.area),
    buildPriceField(s.t('storageTable.columns.price'), (u) => u.price),
  ], [s.t, s.translatedGetTypeLabel]);

  // ── Loading ──

  if (s.loading) {
    return (
      <section className="flex items-center justify-center py-2" role="status" aria-live="polite">
        <article className="text-center">
          <Spinner size="large" className="mx-auto mb-2" />
          <p className={colors.text.muted}>{s.t('tabs.storageTab.loading')}</p>
        </article>
      </section>
    );
  }

  // ── Main render ──

  return (
    <section className="flex flex-col gap-2 p-2">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Warehouse className="h-5 w-5 text-primary" />
          {s.t('tabs.labels.storage')}
          <span className={cn('text-sm font-normal', colors.text.muted)}>({s.units.length})</span>
        </h2>
        <nav className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => s.setShowLinkDialog(true)}>
            <Link2 className="mr-1 h-4 w-4" />
            {s.t('spaceLink.linkExisting')}
          </Button>
          <Button variant="default" size="sm" onClick={() => s.setShowCreateForm(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {s.t('tabs.labels.storage')}
          </Button>
        </nav>
      </header>

      {/* Stats Cards */}
      <StorageTabStats
        storageCount={s.stats.storageCount}
        available={s.stats.available}
        totalValue={s.stats.totalValue}
        totalArea={s.stats.totalArea}
      />

      {/* Filters */}
      <StorageTabFilters
        searchTerm={s.searchTerm}
        onSearchChange={s.setSearchTerm}
        filterType={s.filterType}
        onFilterTypeChange={s.setFilterType}
        filterStatus={s.filterStatus}
        onFilterStatusChange={s.setFilterStatus}
      />

      <StorageQuickCreateSheet
        open={s.showCreateForm}
        onOpenChange={(v) => { if (!v) s.setShowCreateForm(false); }}
        building={building}
      />

      {/* View Toggle */}
      <nav className="flex items-center justify-between">
        <span className={cn('text-sm', colors.text.muted)}>
          {s.filteredUnits.length} {s.t('storageView.results')}
        </span>
        <fieldset className="flex items-center gap-2">
          <Button variant={s.viewMode === 'cards' ? 'default' : 'outline'} size="sm" onClick={() => s.setViewMode('cards')}>
            <Layers className="mr-1 h-4 w-4" /> {s.t('storageView.cards')}
          </Button>
          <Button variant={s.viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => s.setViewMode('table')}>
            <TableIcon className="mr-1 h-4 w-4" /> {s.t('storageView.table')}
          </Button>
        </fieldset>
      </nav>

      {/* Content */}
      {s.filteredUnits.length === 0 ? (
        <p className={cn('py-2 text-center text-sm', colors.text.muted)}>
          {s.t('tabs.labels.storage')} — 0
        </p>
      ) : s.viewMode === 'cards' ? (
        <>
          <BuildingSpaceCardGrid<StorageUnit>
            items={s.filteredUnits}
            getKey={(u) => u.id}
            getName={(u) => u.name || u.code}
            renderStatus={(u) => (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStorageBadgeClass(u.status)}`}>
                {s.translatedGetStatusLabel(u.status)}
              </span>
            )}
            fields={storageCardFields}
            actions={{
              onView: (u) => router.push(ENTITY_ROUTES.spaces.storage(u.id)),
              onEdit: s.startEdit,
              onUnlink: s.handleUnlinkClick,
              onDelete: s.handleDeleteClick,
            }}
            actionState={{ deletingId: s.deletingId, unlinkingId: s.unlinkingId }}
          />
          <footer className={cn('text-xs', colors.text.muted)}>
            {s.filteredUnits.length} {s.t('tabs.labels.storage')}
          </footer>
        </>
      ) : (
        <>
          <BuildingSpaceTable<StorageUnit>
            items={s.filteredUnits}
            columns={storageColumns}
            getKey={(u) => u.id}
            actions={{
              onView: (u) => router.push(ENTITY_ROUTES.spaces.storage(u.id)),
              onEdit: s.startEdit,
              onUnlink: s.handleUnlinkClick,
              onDelete: s.handleDeleteClick,
            }}
            actionState={{ deletingId: s.deletingId, unlinkingId: s.unlinkingId }}
            editingId={s.editingId}
            renderEditRow={() => (
              <>
                <TableCell>
                  <Input value={s.editCode} onChange={(e) => s.setEditCode(e.target.value)} className="h-8" disabled={s.saving} />
                </TableCell>
                <TableCell>
                  <Select value={s.editType} onValueChange={(v) => s.setEditType(v as StorageType)} disabled={s.saving}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STORAGE_TYPES.map((st) => (<SelectItem key={st} value={st}>{s.translatedGetTypeLabel(st)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input value={s.editFloor} onChange={(e) => s.setEditFloor(e.target.value)} className="h-8 w-16" disabled={s.saving} />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.01" value={s.editArea} onChange={(e) => s.setEditArea(e.target.value)} className="h-8 w-16" disabled={s.saving} />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.01" value={s.editPrice} onChange={(e) => s.setEditPrice(e.target.value)} className="h-8 w-20" disabled={s.saving} />
                </TableCell>
                <TableCell>
                  <Select value={s.editStatus} onValueChange={(v) => s.setEditStatus(v as StorageStatus)} disabled={s.saving}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STORAGE_STATUSES.map((ss) => (<SelectItem key={ss} value={ss}>{s.translatedGetStatusLabel(ss)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <nav className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={s.handleSaveEdit} disabled={s.saving}>
                      {s.saving ? <Spinner size="small" color="inherit" /> : <Check className={`h-3.5 w-3.5 ${getStatusColor('available', 'text')}`} />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={s.cancelEdit} disabled={s.saving}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </nav>
                </TableCell>
              </>
            )}
          />
          <footer className={cn('text-xs', colors.text.muted)}>
            {s.filteredUnits.length} {s.t('tabs.labels.storage')}
            {s.filteredUnits.length !== s.units.length && (
              <span className="ml-1">({s.units.length} {s.t('storageView.total')})</span>
            )}
          </footer>
        </>
      )}

      {/* Link Existing Dialog */}
      <BuildingSpaceLinkDialog
        open={s.showLinkDialog}
        onOpenChange={s.setShowLinkDialog}
        title={s.t('spaceLink.linkStorage')}
        description={s.t('spaceLink.linkStorageDesc')}
        fetchUnlinked={s.fetchUnlinkedStorages}
        onLink={s.handleLinkStorage}
      />

      {/* ADR-226: Deletion Guard blocked dialog */}
      {s.BlockedDialog}

      {/* Confirm Dialog (unlink) */}
      <BuildingSpaceConfirmDialog
        open={!!s.confirmUnlink}
        onOpenChange={(open) => { if (!open) s.setConfirmUnlink(null); }}
        title={s.t('spaceConfirm.unlinkStorage')}
        description={
          <>
            {s.t('spaceConfirm.unlinkStorageDesc')}{' '}
            <strong>&quot;{s.confirmUnlink?.code}&quot;</strong>
          </>
        }
        confirmLabel={s.t('spaceActions.unlink')}
        onConfirm={s.handleUnlinkConfirm}
        loading={s.unlinkLoading}
        variant="default"
      />

      {/* Confirm Dialog (delete) */}
      <BuildingSpaceConfirmDialog
        open={!!s.confirmDelete}
        onOpenChange={(open) => { if (!open) s.setConfirmDelete(null); }}
        title={s.t('spaceConfirm.deleteStorage')}
        description={
          <>
            {s.t('spaceConfirm.deleteStorageDesc')}{' '}
            <strong>&quot;{s.confirmDelete?.code}&quot;</strong>;
            <br /><br />
            {s.t('spaceConfirm.irreversible')}
          </>
        }
        confirmLabel={s.t('spaceActions.delete')}
        onConfirm={s.handleDeleteConfirm}
        loading={s.confirmLoading}
        variant="destructive"
      />
    </section>
  );
}

// ── Status badge class mapping ──

function getStorageBadgeClass(status: StorageStatus): string {
  const statusMap: Record<string, string> = {
    available: 'available',
    occupied: 'pending',      // info/blue
    maintenance: 'error',     // red
    reserved: 'reserved',     // warning/amber
    sold: 'sold',             // purple
    unavailable: 'cancelled', // neutral/error
  };
  const mapped = statusMap[status] || 'cancelled';
  return `${getStatusColor(mapped, 'bg')}/10 ${getStatusColor(mapped, 'text')}`;
}
