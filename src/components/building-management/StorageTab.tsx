/**
 * StorageTab — Building Storage Management Tab (Storage-only, no parking)
 *
 * Lists, creates, edits and deletes storage units for a building.
 * Uses API routes (/api/storages) for proper tenant isolation.
 * Inline create/edit forms — same pattern as ParkingTabContent.
 *
 * @module components/building-management/StorageTab
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import type { Building } from '@/types/building/contracts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell } from '@/components/ui/table';
import { Warehouse, Plus, Layers, Table as TableIcon, Link2, Check, X, Loader2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { StorageTabStats } from './StorageTab/StorageTabStats';
import { StorageTabFilters } from './StorageTab/StorageTabFilters';
import {
  getStatusLabel,
  getTypeLabel,
  filterUnits,
  calculateStats,
} from './StorageTab/utils';
import { BuildingSpaceTable, BuildingSpaceCardGrid, BuildingSpaceConfirmDialog, BuildingSpaceLinkDialog } from './shared';
import type { SpaceColumn, SpaceCardField, LinkableItem } from './shared';
import { ENTITY_ROUTES } from '@/lib/routes';

const logger = createModuleLogger('StorageTab');

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_TYPES: StorageType[] = ['storage', 'large', 'small', 'basement', 'ground', 'special', 'garage', 'warehouse'];
const STORAGE_STATUSES: StorageStatus[] = ['available', 'occupied', 'maintenance', 'reserved', 'sold', 'unavailable'];

// ============================================================================
// TYPES
// ============================================================================

interface StorageTabProps {
  building: Building;
}

interface StoragesApiResponse {
  storages: StorageUnit[];
  count: number;
}

interface StorageCreateResult {
  storageId: string;
}

interface StorageMutationResult {
  id: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StorageTab({ building }: StorageTabProps) {
  const { t } = useTranslation('building');
  const router = useRouter();

  // Data state
  const [units, setUnits] = useState<StorageUnit[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createType, setCreateType] = useState<StorageType>('storage');
  const [createStatus, setCreateStatus] = useState<StorageStatus>('available');
  const [createFloor, setCreateFloor] = useState('');
  const [createArea, setCreateArea] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editType, setEditType] = useState<StorageType>('storage');
  const [editStatus, setEditStatus] = useState<StorageStatus>('available');
  const [editFloor, setEditFloor] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StorageUnit | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Filter & view state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<StorageType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<StorageStatus | 'all'>('all');
  const filterFloor = 'all';
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const translatedGetStatusLabel = useCallback(
    (status: StorageStatus) => getStatusLabel(status, t),
    [t]
  );

  const translatedGetTypeLabel = useCallback(
    (type: StorageType) => getTypeLabel(type, t),
    [t]
  );

  // ============================================================================
  // FETCH — API-based with tenant isolation
  // ============================================================================

  const fetchStorageUnits = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiClient.get<StoragesApiResponse>(
        `/api/storages?buildingId=${building.id}`
      );

      if (result?.storages) {
        // Map API Storage → StorageUnit (compatibility layer)
        const storageUnits: StorageUnit[] = result.storages.map(s => ({
          id: s.id,
          code: s.name || s.code || `S-${s.id.substring(0, 6)}`,
          type: (s.type || 'small') as StorageType,
          status: (s.status || 'available') as StorageStatus,
          floor: s.floor || '',
          area: typeof s.area === 'number' ? s.area : 0,
          price: typeof s.price === 'number' ? s.price : 0,
          description: s.description || '',
          building: s.building || building.name,
          project: s.project || '',
          company: s.company || '',
          linkedProperty: s.linkedProperty ?? null,
          features: s.features || [],
          coordinates: s.coordinates || { x: 0, y: 0 },
        }));

        setUnits(storageUnits);
        logger.info('Loaded storage units via API', { count: storageUnits.length, buildingId: building.id });
      }
    } catch (error) {
      logger.error('Error fetching storage units', { error });
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [building.id, building.name]);

  useEffect(() => {
    fetchStorageUnits();
  }, [fetchStorageUnits]);

  const filteredUnits = useMemo(() =>
    filterUnits(units, searchTerm, filterType, filterStatus, filterFloor),
    [units, searchTerm, filterType, filterStatus, filterFloor]
  );

  const stats = useMemo(() => calculateStats(filteredUnits), [filteredUnits]);

  // ============================================================================
  // CREATE — Inline form
  // ============================================================================

  const resetCreateForm = () => {
    setShowCreateForm(false);
    setCreateCode('');
    setCreateType('storage');
    setCreateStatus('available');
    setCreateFloor('');
    setCreateArea('');
    setCreatePrice('');
    setCreateDescription('');
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const storageName = createCode.trim() || `Αποθήκη-${Date.now().toString(36).toUpperCase()}`;

      await apiClient.post<StorageCreateResult>('/api/storages', {
        name: storageName,
        buildingId: building.id,
        projectId: building.projectId || null,
        type: createType,
        status: createStatus,
        floor: createFloor.trim() || null,
        area: createArea ? parseFloat(createArea) : null,
        price: createPrice ? parseFloat(createPrice) : null,
        description: createDescription.trim() || null,
        building: building.name,
      });

      toast.success('Η αποθήκη δημιουργήθηκε');
      resetCreateForm();
      await fetchStorageUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Σφάλμα δημιουργίας';
      logger.error('Create storage error', { error: msg });
      toast.error(`Αποτυχία: ${msg}`);
    } finally {
      setCreating(false);
    }
  };

  // ============================================================================
  // EDIT — Inline table row editing
  // ============================================================================

  const startEdit = (unit: StorageUnit) => {
    setEditingId(unit.id);
    setEditCode(unit.code || '');
    setEditType(unit.type || 'storage');
    setEditStatus(unit.status || 'available');
    setEditFloor(unit.floor || '');
    setEditArea(unit.area ? String(unit.area) : '');
    setEditPrice(unit.price ? String(unit.price) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await apiClient.patch<StorageMutationResult>(`/api/storages/${editingId}`, {
        name: editCode.trim() || undefined,
        type: editType,
        status: editStatus,
        floor: editFloor.trim() || null,
        area: editArea ? parseFloat(editArea) : null,
        price: editPrice ? parseFloat(editPrice) : null,
      });
      toast.success('Η αποθήκη ενημερώθηκε');
      setEditingId(null);
      await fetchStorageUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Σφάλμα ενημέρωσης';
      logger.error('Edit storage error', { error: msg });
      toast.error(`Αποτυχία: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // DELETE
  // ============================================================================

  const handleDeleteClick = (unit: StorageUnit) => {
    setConfirmDelete(unit);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setConfirmLoading(true);
    setDeletingId(confirmDelete.id);
    try {
      await apiClient.delete(`/api/storages/${confirmDelete.id}`);
      toast.success('Η αποθήκη διαγράφηκε');
      await fetchStorageUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Σφάλμα διαγραφής';
      logger.error('Delete storage error', { error: msg });
      toast.error(`Αποτυχία: ${msg}`);
    } finally {
      setConfirmLoading(false);
      setConfirmDelete(null);
      setDeletingId(null);
    }
  };

  // ============================================================================
  // LINK — Fetch unlinked storages + link to this building
  // ============================================================================

  const fetchUnlinkedStorages = useCallback(async (): Promise<LinkableItem[]> => {
    const result = await apiClient.get<StoragesApiResponse>('/api/storages');
    if (!result?.storages) return [];
    return result.storages
      .filter((s) => !s.buildingId)
      .map((s) => ({
        id: s.id,
        label: s.name || s.code || s.id,
        sublabel: `${translatedGetTypeLabel(s.type)} · ${s.floor || '—'}`,
      }));
  }, [translatedGetTypeLabel]);

  const handleLinkStorage = useCallback(async (itemId: string) => {
    await apiClient.patch(`/api/storages/${itemId}`, { buildingId: building.id });
    toast.success('Η αποθήκη συνδέθηκε');
    await fetchStorageUnits();
  }, [building.id, fetchStorageUnits]);

  // ============================================================================
  // CENTRALIZED: Column & Card Field Definitions
  // ============================================================================

  const storageColumns: SpaceColumn<StorageUnit>[] = useMemo(() => [
    { key: 'code', label: t('storageTable.columns.code'), sortValue: (u) => u.code, render: (u) => <span className="font-medium">{u.code}</span> },
    { key: 'type', label: t('storageTable.columns.type'), width: 'w-28', sortValue: (u) => u.type, render: (u) => <span className="text-muted-foreground">{translatedGetTypeLabel(u.type)}</span> },
    { key: 'floor', label: t('storageTable.columns.floor'), width: 'w-20', sortValue: (u) => u.floor || '', render: (u) => <span className="text-muted-foreground">{u.floor || '—'}</span> },
    { key: 'area', label: t('storageTable.columns.area'), width: 'w-20', sortValue: (u) => u.area || 0, render: (u) => <span className="font-mono text-xs">{u.area ? `${u.area}` : '—'}</span> },
    { key: 'price', label: t('storageTable.columns.price'), width: 'w-24', sortValue: (u) => u.price || 0, render: (u) => <span className="font-mono text-xs">{formatCurrencyWhole(u.price)}</span> },
    { key: 'status', label: t('storageTable.columns.status'), width: 'w-28', sortValue: (u) => u.status, render: (u) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(u.status)}`}>
        {translatedGetStatusLabel(u.status)}
      </span>
    )},
  ], [t, translatedGetTypeLabel, translatedGetStatusLabel]);

  const storageCardFields: SpaceCardField<StorageUnit>[] = useMemo(() => [
    { label: t('storageTable.columns.type'), render: (u) => translatedGetTypeLabel(u.type) },
    { label: t('storageTable.columns.floor'), render: (u) => u.floor || '—' },
    { label: 'm²', render: (u) => u.area || '—' },
    { label: t('storageTable.columns.price'), render: (u) => formatCurrencyWhole(u.price) },
  ], [t, translatedGetTypeLabel]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <section className="flex items-center justify-center py-2" role="status" aria-live="polite">
        <article className="text-center">
          <Spinner size="large" className="mx-auto mb-2" />
          <p className="text-muted-foreground">{t('tabs.storageTab.loading')}</p>
        </article>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2 p-2">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Warehouse className="h-5 w-5 text-primary" />
          {t('tabs.labels.storage')}
          <span className="text-sm font-normal text-muted-foreground">({units.length})</span>
        </h2>
        <nav className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowLinkDialog(true)}>
            <Link2 className="mr-1 h-4 w-4" />
            {t('spaceLink.linkExisting')}
          </Button>
          <Button variant="default" size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('tabs.labels.storage')}
          </Button>
        </nav>
      </header>

      {/* Stats Cards */}
      <StorageTabStats
        storageCount={stats.storageCount}
        available={stats.available}
        totalValue={stats.totalValue}
        totalArea={stats.totalArea}
      />

      {/* Filters */}
      <StorageTabFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
      />

      {/* Inline Create Form */}
      {showCreateForm && (
        <form
          className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2"
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
        >
          {/* Row 1: Code, Type, Status */}
          <fieldset className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('storageTable.columns.code')}
              </span>
              <Input
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value)}
                placeholder="A-001"
                className="h-9"
                disabled={creating}
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('storageTable.columns.type')}
              </span>
              <Select value={createType} onValueChange={(v) => setCreateType(v as StorageType)} disabled={creating}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_TYPES.map(st => (
                    <SelectItem key={st} value={st}>{translatedGetTypeLabel(st)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('storageTable.columns.status')}
              </span>
              <Select value={createStatus} onValueChange={(v) => setCreateStatus(v as StorageStatus)} disabled={creating}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_STATUSES.map(ss => (
                    <SelectItem key={ss} value={ss}>{translatedGetStatusLabel(ss)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </fieldset>

          {/* Row 2: Floor, Area, Price */}
          <fieldset className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('storageTable.columns.floor')}
              </span>
              <Input
                value={createFloor}
                onChange={(e) => setCreateFloor(e.target.value)}
                placeholder="-1"
                className="h-9"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                m²
              </span>
              <Input
                type="number"
                step="0.01"
                value={createArea}
                onChange={(e) => setCreateArea(e.target.value)}
                placeholder="12"
                className="h-9"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('storageTable.columns.price')} (€)
              </span>
              <Input
                type="number"
                step="0.01"
                value={createPrice}
                onChange={(e) => setCreatePrice(e.target.value)}
                placeholder="5000"
                className="h-9"
                disabled={creating}
              />
            </label>
          </fieldset>

          {/* Row 3: Description */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Περιγραφή
            </span>
            <Textarea
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Περιγραφή αποθήκης..."
              className="h-16 resize-none"
              disabled={creating}
            />
          </label>

          {/* Actions */}
          <nav className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetCreateForm}
              disabled={creating}
            >
              <X className="mr-1 h-4 w-4" />
              Ακύρωση
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={creating}
            >
              {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Αποθήκευση
            </Button>
          </nav>
        </form>
      )}

      {/* View Toggle */}
      <nav className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {filteredUnits.length} αποτελέσματα
        </span>
        <fieldset className="flex items-center gap-2">
          <Button variant={viewMode === 'cards' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('cards')}>
            <Layers className="mr-1 h-4 w-4" /> Κάρτες
          </Button>
          <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}>
            <TableIcon className="mr-1 h-4 w-4" /> Πίνακας
          </Button>
        </fieldset>
      </nav>

      {/* Content — Centralized shared components */}
      {filteredUnits.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          {t('tabs.labels.storage')} — 0
        </p>
      ) : viewMode === 'cards' ? (
        <>
          <BuildingSpaceCardGrid<StorageUnit>
            items={filteredUnits}
            getKey={(u) => u.id}
            getName={(u) => u.code}
            renderStatus={(u) => (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(u.status)}`}>
                {translatedGetStatusLabel(u.status)}
              </span>
            )}
            fields={storageCardFields}
            actions={{
              onView: (u) => router.push(ENTITY_ROUTES.spaces.storage(u.id)),
              onEdit: startEdit,
              onDelete: handleDeleteClick,
            }}
            actionState={{ deletingId }}
          />
          <footer className="text-xs text-muted-foreground">
            {filteredUnits.length} {t('tabs.labels.storage')}
          </footer>
        </>
      ) : (
        <>
          <BuildingSpaceTable<StorageUnit>
            items={filteredUnits}
            columns={storageColumns}
            getKey={(u) => u.id}
            actions={{
              onView: (u) => router.push(ENTITY_ROUTES.spaces.storage(u.id)),
              onEdit: startEdit,
              onDelete: handleDeleteClick,
            }}
            actionState={{ deletingId }}
            editingId={editingId}
            renderEditRow={() => (
              <>
                <TableCell>
                  <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} className="h-8" disabled={saving} />
                </TableCell>
                <TableCell>
                  <Select value={editType} onValueChange={(v) => setEditType(v as StorageType)} disabled={saving}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STORAGE_TYPES.map(st => (<SelectItem key={st} value={st}>{translatedGetTypeLabel(st)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input value={editFloor} onChange={(e) => setEditFloor(e.target.value)} className="h-8 w-16" disabled={saving} />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.01" value={editArea} onChange={(e) => setEditArea(e.target.value)} className="h-8 w-16" disabled={saving} />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="h-8 w-20" disabled={saving} />
                </TableCell>
                <TableCell>
                  <Select value={editStatus} onValueChange={(v) => setEditStatus(v as StorageStatus)} disabled={saving}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STORAGE_STATUSES.map(ss => (<SelectItem key={ss} value={ss}>{translatedGetStatusLabel(ss)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <nav className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit} disabled={saving}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-500" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit} disabled={saving}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </nav>
                </TableCell>
              </>
            )}
          />
          <footer className="text-xs text-muted-foreground">
            {filteredUnits.length} {t('tabs.labels.storage')}
            {filteredUnits.length !== units.length && (
              <span className="ml-1">({units.length} σύνολο)</span>
            )}
          </footer>
        </>
      )}

      {/* Link Existing Dialog */}
      <BuildingSpaceLinkDialog
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
        title={t('spaceLink.linkStorage')}
        description={t('spaceLink.linkStorageDesc')}
        fetchUnlinked={fetchUnlinkedStorages}
        onLink={handleLinkStorage}
      />

      {/* Centralized Confirm Dialog (delete) */}
      <BuildingSpaceConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={t('spaceConfirm.deleteStorage')}
        description={
          <>
            {t('spaceConfirm.deleteStorageDesc')}{' '}
            <strong>&quot;{confirmDelete?.code}&quot;</strong>;
            <br /><br />
            {t('spaceConfirm.irreversible')}
          </>
        }
        confirmLabel={t('spaceActions.delete')}
        onConfirm={handleDeleteConfirm}
        loading={confirmLoading}
        variant="destructive"
      />
    </section>
  );
}

// ============================================================================
// HELPER: Status badge class mapping
// ============================================================================

function getStatusBadgeClass(status: StorageStatus): string {
  const colorMap: Record<string, string> = {
    available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    occupied: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    maintenance: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    reserved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    sold: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    unavailable: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
}
