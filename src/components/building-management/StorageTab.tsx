/**
 * StorageTab — Building Storage Management Tab (Storage-only, no parking)
 *
 * Lists, creates, edits and deletes storage units for a building.
 * Uses API routes (/api/storages) for proper tenant isolation.
 *
 * ARCHITECTURE FIX (2026-02-17):
 * - Removed parking (now in separate ParkingTabContent — ADR-184)
 * - Replaced Client SDK with API-based approach for tenant isolation
 * - CRUD operations now persist to Firestore via API endpoints
 *
 * @module components/building-management/StorageTab
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Warehouse, Plus, Layers, Table as TableIcon, Link2 } from 'lucide-react';

const logger = createModuleLogger('StorageTab');

import { StorageForm } from './StorageForm/index';
import { StorageTabStats } from './StorageTab/StorageTabStats';
import { StorageTabFilters } from './StorageTab/StorageTabFilters';
import { Spinner } from '@/components/ui/spinner';
import {
  getStatusLabel,
  getTypeLabel,
  filterUnits,
  calculateStats,
} from './StorageTab/utils';
import { BuildingSpaceTable, BuildingSpaceCardGrid, BuildingSpaceConfirmDialog, BuildingSpaceLinkDialog, SpaceFloorplanInline } from './shared';
import type { SpaceColumn, SpaceCardField, LinkableItem } from './shared';

// ============================================================================
// TYPES
// ============================================================================

interface StorageTabProps {
  building: {
    id: string;
    name: string;
    project: string;
    company: string;
  };
}

interface StoragesApiResponse {
  storages: StorageUnit[];
  count: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StorageTab({ building }: StorageTabProps) {
  const { t } = useTranslation('building');

  const [units, setUnits] = useState<StorageUnit[]>([]);
  const [loading, setLoading] = useState(true);

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
        // Map API Storage type to StorageUnit (compatibility layer)
        const storageUnits: StorageUnit[] = result.storages.map(s => ({
          id: s.id,
          code: s.code || `S-${s.id.substring(0, 6)}`,
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

  // ============================================================================
  // STATE
  // ============================================================================

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<StorageType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<StorageStatus | 'all'>('all');
  const filterFloor = 'all';
  const [editingUnit, setEditingUnit] = useState<StorageUnit | null>(null);
  const [showForm, setShowForm] = useState(false);
  const formType: StorageType = 'storage';
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback(
    (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    []
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StorageUnit | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const filteredUnits = useMemo(() =>
    filterUnits(units, searchTerm, filterType, filterStatus, filterFloor),
    [units, searchTerm, filterType, filterStatus, filterFloor]
  );

  const stats = useMemo(() => calculateStats(filteredUnits), [filteredUnits]);

  // ============================================================================
  // CRUD HANDLERS — API-based (persist to Firestore)
  // ============================================================================

  const handleAddNew = () => {
    setEditingUnit(null);
    setShowForm(true);
  };

  const handleEdit = (unit: StorageUnit) => {
    setEditingUnit(unit);
    setShowForm(true);
  };

  const handleSave = async (unit: StorageUnit) => {
    try {
      if (editingUnit) {
        // UPDATE — PATCH /api/storages/[id]
        await apiClient.patch(`/api/storages/${editingUnit.id}`, {
          name: unit.code,
          type: unit.type,
          status: unit.status,
          floor: unit.floor || null,
          area: unit.area || null,
          price: unit.price || null,
          description: unit.description || null,
        });
        logger.info('Storage unit updated via API', { id: editingUnit.id });
      } else {
        // CREATE — POST /api/storages
        await apiClient.post('/api/storages', {
          name: unit.code,
          buildingId: building.id,
          projectId: building.project || undefined,
          type: unit.type || 'small',
          status: unit.status || 'available',
          floor: unit.floor || undefined,
          area: unit.area || undefined,
          price: unit.price || undefined,
          description: unit.description || undefined,
          building: building.name,
        });
        logger.info('Storage unit created via API', { buildingId: building.id });
      }

      // Re-fetch to get fresh data from server
      await fetchStorageUnits();
    } catch (error) {
      logger.error('Error saving storage unit', { error });
    }

    setShowForm(false);
    setEditingUnit(null);
  };

  const handleDeleteClick = (unit: StorageUnit) => {
    setConfirmDelete(unit);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;

    setConfirmLoading(true);
    setDeletingId(confirmDelete.id);
    try {
      await apiClient.delete(`/api/storages/${confirmDelete.id}`);
      logger.info('Storage unit deleted via API', { id: confirmDelete.id });
      await fetchStorageUnits();
    } catch (error) {
      logger.error('Error deleting storage unit', { error });
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
    // Fetch all storages (no buildingId filter) then client-filter for unlinked
    const result = await apiClient.get<StoragesApiResponse>('/api/storages');
    if (!result?.storages) return [];
    return result.storages
      .filter((s) => !s.buildingId)
      .map((s) => ({
        id: s.id,
        label: s.code,
        sublabel: `${translatedGetTypeLabel(s.type)} · ${s.floor || '—'}`,
      }));
  }, [translatedGetTypeLabel]);

  const handleLinkStorage = useCallback(async (itemId: string) => {
    await apiClient.patch(`/api/storages/${itemId}`, { buildingId: building.id });
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
    { key: 'price', label: t('storageTable.columns.price'), width: 'w-24', sortValue: (u) => u.price || 0, render: (u) => <span className="font-mono text-xs">{u.price ? `€${u.price.toLocaleString()}` : '—'}</span> },
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
    { label: t('storageTable.columns.price'), render: (u) => u.price ? `€${u.price.toLocaleString()}` : '—' },
  ], [t, translatedGetTypeLabel]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <section className="flex items-center justify-center py-12" role="status" aria-live="polite">
        <article className="text-center">
          <Spinner size="large" className="mx-auto mb-4" />
          <p className="text-muted-foreground">{t('tabs.storageTab.loading')}</p>
        </article>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Warehouse className="h-5 w-5 text-primary" />
          {t('tabs.labels.storages')}
          <span className="text-sm font-normal text-muted-foreground">({units.length})</span>
        </h2>
        <nav className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowLinkDialog(true)}>
            <Link2 className="mr-1 h-4 w-4" />
            {t('spaceLink.linkExisting')}
          </Button>
          <Button variant="default" size="sm" onClick={handleAddNew}>
            <Plus className="mr-1 h-4 w-4" />
            {t('tabs.labels.storages')}
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
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('tabs.labels.storages')} — 0
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
              onView: () => {},
              onEdit: handleEdit,
              onDelete: handleDeleteClick,
            }}
            actionState={{ deletingId }}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
            renderExpandedContent={(u) => (
              <SpaceFloorplanInline
                entityType="storage_unit"
                entityId={u.id}
                entityLabel={u.code}
                projectId={building.project}
              />
            )}
          />
          <footer className="text-xs text-muted-foreground">
            {filteredUnits.length} {t('tabs.labels.storages')}
          </footer>
        </>
      ) : (
        <>
          <BuildingSpaceTable<StorageUnit>
            items={filteredUnits}
            columns={storageColumns}
            getKey={(u) => u.id}
            actions={{
              onView: () => {},
              onEdit: handleEdit,
              onDelete: handleDeleteClick,
            }}
            actionState={{ deletingId }}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
            renderExpandedContent={(u) => (
              <SpaceFloorplanInline
                entityType="storage_unit"
                entityId={u.id}
                entityLabel={u.code}
                projectId={building.project}
              />
            )}
          />
          <footer className="text-xs text-muted-foreground">
            {filteredUnits.length} {t('tabs.labels.storages')}
            {filteredUnits.length !== units.length && (
              <span className="ml-1">({units.length} σύνολο)</span>
            )}
          </footer>
        </>
      )}

      {showForm && (
        <StorageForm
          unit={editingUnit}
          building={building}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingUnit(null);
          }}
          formType={formType}
        />
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
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
}
