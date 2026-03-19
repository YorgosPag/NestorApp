/**
 * StorageTab — Building Storages Management Tab
 *
 * Lists, creates and manages storage units for a building.
 * Reads from the same Firestore collection as /spaces/storage (bidirectional sync).
 *
 * @module components/building-management/StorageTab
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Warehouse, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Building } from '@/types/building/contracts';
import type { Storage, StorageType, StorageStatus } from '@/types/storage/contracts';

// ============================================================================
// TYPES
// ============================================================================

interface StoragesApiResponse {
  storages: Storage[];
  count?: number;
}

interface StorageMutationResponse {
  success: boolean;
  storage?: Storage;
  message?: string;
  error?: string;
}

interface StorageTabProps {
  building: Building;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_TYPES: StorageType[] = ['small', 'large', 'basement', 'ground', 'special'];

// ============================================================================
// COMPONENT
// ============================================================================

export function StorageTab({ building }: StorageTabProps) {
  const { t } = useTranslation('storage');
  const { t: tBuilding } = useTranslation('building');
  const { confirm, dialogProps } = useConfirmDialog();

  // Data state
  const [storages, setStorages] = useState<Storage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<StorageType>('small');
  const [createFloor, setCreateFloor] = useState('');
  const [createArea, setCreateArea] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<StorageType>('small');
  const [editFloor, setEditFloor] = useState('');
  const [editArea, setEditArea] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ============================================================================
  // FETCH STORAGES
  // ============================================================================

  const fetchStorages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<StoragesApiResponse>(
        `${API_ROUTES.STORAGES.LIST}?buildingId=${building.id}`
      );
      if (result?.storages) {
        setStorages(result.storages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storages');
    } finally {
      setLoading(false);
    }
  }, [building.id]);

  useEffect(() => {
    fetchStorages();
  }, [fetchStorages]);

  // ============================================================================
  // CREATE STORAGE
  // ============================================================================

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const result = await apiClient.post<StorageMutationResponse>(API_ROUTES.STORAGES.LIST, {
        name: createName.trim(),
        type: createType,
        floor: createFloor.trim(),
        area: createArea ? parseFloat(createArea) : 0,
        buildingId: building.id,
        building: building.name,
        projectId: building.projectId,
        status: 'available' as StorageStatus,
      });
      if (result?.success) {
        setShowCreateForm(false);
        setCreateName('');
        setCreateType('small');
        setCreateFloor('');
        setCreateArea('');
        await fetchStorages();
      }
    } catch (err) {
      console.error('[StorageTab] Create error:', err);
    } finally {
      setCreating(false);
    }
  };

  // ============================================================================
  // EDIT STORAGE
  // ============================================================================

  const startEdit = (storage: Storage) => {
    setEditingId(storage.id);
    setEditName(storage.name);
    setEditType(storage.type);
    setEditFloor(storage.floor);
    setEditArea(storage.area ? String(storage.area) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const result = await apiClient.patch<StorageMutationResponse>(API_ROUTES.STORAGES.BY_ID(editingId), {
        name: editName.trim(),
        type: editType,
        floor: editFloor.trim(),
        area: editArea ? parseFloat(editArea) : 0,
      });
      if (result?.success) {
        setEditingId(null);
        await fetchStorages();
      }
    } catch (err) {
      console.error('[StorageTab] Edit error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // DELETE STORAGE
  // ============================================================================

  const handleDelete = async (storage: Storage) => {
    const confirmed = await confirm({
      title: `${t('storages.header.title')}: ${storage.name}`,
      description: t('storages.header.title'),
      variant: 'destructive',
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    setDeletingId(storage.id);
    try {
      const result = await apiClient.delete<StorageMutationResponse>(
        API_ROUTES.STORAGES.BY_ID(storage.id)
      );
      if (result?.success) {
        await fetchStorages();
      }
    } catch (err) {
      console.error('[StorageTab] Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getStatusBadge = (status: StorageStatus) => {
    const colorMap: Record<StorageStatus, string> = {
      available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      occupied: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      reserved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      maintenance: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      sold: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      unavailable: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] || colorMap.unavailable}`}>
        {t(`status.${status}`)}
      </span>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <section className="flex items-center justify-center py-12">
        <Spinner size="large" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchStorages}>
          Retry
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      <ConfirmDialog {...dialogProps} />
      {/* Header */}
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Warehouse className="h-5 w-5 text-primary" />
          {t('storages.header.title')}
          <span className="text-sm font-normal text-muted-foreground">({storages.length})</span>
        </h2>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          <Plus className="mr-1 h-4 w-4" />
          {t('storages.header.newStorage')}
        </Button>
      </header>

      {/* Inline Create Form */}
      {showCreateForm && (
        <form
          className="grid grid-cols-[1fr_100px_80px_80px_auto] items-end gap-2 rounded-lg border border-border bg-muted/30 p-3"
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
        >
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {tBuilding('tabs.floors.name')}
            </label>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={t('storages.header.newStorage')}
              className="h-9"
              disabled={creating}
              autoFocus
            />
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('types.small')}
            </label>
            <select
              value={createType}
              onChange={(e) => setCreateType(e.target.value as StorageType)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              disabled={creating}
            >
              {STORAGE_TYPES.map(st => (
                <option key={st} value={st}>{t(`types.${st}`)}</option>
              ))}
            </select>
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {tBuilding('tabs.floors.name')}
            </label>
            <Input
              value={createFloor}
              onChange={(e) => setCreateFloor(e.target.value)}
              placeholder="0"
              className="h-9"
              disabled={creating}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              m²
            </label>
            <Input
              type="number"
              step="0.01"
              value={createArea}
              onChange={(e) => setCreateArea(e.target.value)}
              placeholder="0"
              className="h-9"
              disabled={creating}
            />
          </fieldset>
          <nav className="flex gap-1">
            <Button
              type="submit"
              size="sm"
              disabled={!createName.trim() || creating}
              className="h-9"
            >
              {creating ? <Spinner size="small" color="inherit" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateForm(false)}
              disabled={creating}
              className="h-9"
            >
              <X className="h-4 w-4" />
            </Button>
          </nav>
        </form>
      )}

      {/* Table */}
      {storages.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('storages.list.noResults')}
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="px-3 py-2">{tBuilding('tabs.floors.name')}</th>
                <th className="w-24 px-3 py-2">{t('types.small')}</th>
                <th className="w-20 px-3 py-2">{tBuilding('tabs.floors.name')}</th>
                <th className="w-20 px-3 py-2">m²</th>
                <th className="w-28 px-3 py-2">{t('status.available')}</th>
                <th className="w-24 px-3 py-2 text-right">{tBuilding('tabs.floors.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {storages.map((storage) => (
                <tr key={storage.id} className="border-b border-border/50 hover:bg-muted/20">
                  {editingId === storage.id ? (
                    <>
                      <td className="px-3 py-1.5">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8"
                          disabled={saving}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as StorageType)}
                          className="h-8 w-full rounded-md border border-input bg-background px-1 text-sm"
                          disabled={saving}
                        >
                          {STORAGE_TYPES.map(st => (
                            <option key={st} value={st}>{t(`types.${st}`)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          value={editFloor}
                          onChange={(e) => setEditFloor(e.target.value)}
                          className="h-8 w-16"
                          disabled={saving}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          value={editArea}
                          onChange={(e) => setEditArea(e.target.value)}
                          className="h-8 w-16"
                          disabled={saving}
                        />
                      </td>
                      <td className="px-3 py-1.5">{getStatusBadge(storage.status)}</td>
                      <td className="px-3 py-1.5">
                        <nav className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleSaveEdit}
                            disabled={saving || !editName.trim()}
                          >
                            {saving ? <Spinner size="small" color="inherit" /> : <Check className="h-3.5 w-3.5 text-green-500" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </nav>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-medium">{storage.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{t(`types.${storage.type}`)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{storage.floor || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{storage.area > 0 ? `${storage.area}` : '—'}</td>
                      <td className="px-3 py-2">{getStatusBadge(storage.status)}</td>
                      <td className="px-3 py-2">
                        <nav className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(storage)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(storage)}
                            disabled={deletingId === storage.id}
                          >
                            {deletingId === storage.id ? (
                              <Spinner size="small" color="inherit" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </nav>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="text-xs text-muted-foreground">
            {storages.length} {t('storages.header.title')}
          </footer>
        </>
      )}
    </section>
  );
}

export default StorageTab;
