/**
 * 📄 USE STORAGE TAB STATE — All state + CRUD handlers for StorageTab
 *
 * Extracted from StorageTab.tsx (Google SRP).
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import type { Building } from '@/types/building/contracts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createStaleCache } from '@/lib/stale-cache';
import { API_ROUTES } from '@/config/domain-constants';
import { createStorageWithPolicy, deleteStorageWithPolicy, updateStorageWithPolicy } from '@/services/storage-mutation-gateway';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import { RealtimeService } from '@/services/realtime';
import type { LinkableItem } from '../shared';
import { getStatusLabel } from '@/lib/status-helpers';
import { getTypeLabel, filterUnits, calculateStats } from './utils';

const logger = createModuleLogger('StorageTab');

// ADR-300: Module-level cache — keyed by buildingId, survives re-navigation
const buildingStorageCache = createStaleCache<StorageUnit[]>('building-storage-tab');

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

export function useStorageTabState(building: Building) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const { success, error: notifyError } = useNotifications();

  // ── Data state — ADR-300: Seed from module-level cache → zero flash on re-navigation ──
  const [units, setUnits] = useState<StorageUnit[]>(buildingStorageCache.get(building.id) ?? []);
  const [loading, setLoading] = useState(!buildingStorageCache.hasLoaded(building.id));

  // ── Create form state ──
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createType, setCreateType] = useState<StorageType>('storage');
  const [createStatus, setCreateStatus] = useState<StorageStatus>('available');
  const [createFloor, setCreateFloor] = useState('');
  const [createArea, setCreateArea] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Edit state ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editType, setEditType] = useState<StorageType>('storage');
  const [editStatus, setEditStatus] = useState<StorageStatus>('available');
  const [editFloor, setEditFloor] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Delete state ──
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StorageUnit | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ── Unlink state ──
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<StorageUnit | null>(null);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  // ── Deletion Guard (ADR-226 Phase 3) ──
  const { checkBeforeDelete, BlockedDialog } = useDeletionGuard('storage');

  // ── Link dialog state ──
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // ── Filter & view state ──
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<StorageType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<StorageStatus | 'all'>('all');
  const filterFloor = 'all';
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // ── Label translators ──

  const translatedGetStatusLabel = useCallback(
    (status: StorageStatus) => getStatusLabel('storage', status, { t }),
    [t],
  );

  const translatedGetTypeLabel = useCallback(
    (type: StorageType) => getTypeLabel(type, t),
    [t],
  );

  // ── Fetch ──

  const fetchStorageUnits = useCallback(async () => {
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!buildingStorageCache.hasLoaded(building.id)) setLoading(true);
    try {
      const result = await apiClient.get<StoragesApiResponse>(
        `${API_ROUTES.STORAGES.LIST}?buildingId=${building.id}`,
      );

      if (result?.storages) {
        const storageUnits: StorageUnit[] = result.storages.map((s) => ({
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
        // ADR-300: Write to module-level cache so next remount skips spinner
        buildingStorageCache.set(storageUnits, building.id);
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

  // ── Real-time sync ──

  useEffect(() => {
    const unsubCreated = RealtimeService.subscribe('STORAGE_CREATED', () => {
      logger.debug('STORAGE_CREATED event — refetching');
      fetchStorageUnits();
    });
    const unsubUpdated = RealtimeService.subscribe('STORAGE_UPDATED', () => {
      logger.debug('STORAGE_UPDATED event — refetching');
      fetchStorageUnits();
    });
    const unsubDeleted = RealtimeService.subscribe('STORAGE_DELETED', () => {
      logger.debug('STORAGE_DELETED event — refetching');
      fetchStorageUnits();
    });
    return () => { unsubCreated(); unsubUpdated(); unsubDeleted(); };
  }, [fetchStorageUnits]);

  // ── Derived data ──

  const filteredUnits = useMemo(
    () => filterUnits(units, searchTerm, filterType, filterStatus, filterFloor),
    [units, searchTerm, filterType, filterStatus, filterFloor],
  );

  const stats = useMemo(() => calculateStats(filteredUnits), [filteredUnits]);

  // ── Create handlers ──

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
      const storageName = createCode.trim() || `${t('storageView.autoNamePrefix')}-${Date.now().toString(36).toUpperCase()}`;
      await createStorageWithPolicy<StorageCreateResult>({ payload: {
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
      }});
      success(t('storageNotifications.created'));
      resetCreateForm();
      await fetchStorageUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('storageNotifications.createError');
      logger.error('Create storage error', { error: msg });
      notifyError(`${t('storageNotifications.failurePrefix')} ${msg}`);
    } finally {
      setCreating(false);
    }
  };

  // ── Edit handlers ──

  const startEdit = (unit: StorageUnit) => {
    setEditingId(unit.id);
    setEditCode(unit.code || '');
    setEditType(unit.type || 'storage');
    setEditStatus(unit.status || 'available');
    setEditFloor(unit.floor || '');
    setEditArea(unit.area ? String(unit.area) : '');
    setEditPrice(unit.price ? String(unit.price) : '');
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await updateStorageWithPolicy<StorageMutationResult>({ storageId: editingId, payload: {
        name: editCode.trim() || undefined,
        type: editType,
        status: editStatus,
        floor: editFloor.trim() || null,
        area: editArea ? parseFloat(editArea) : null,
        price: editPrice ? parseFloat(editPrice) : null,
      }});
      success(t('storageNotifications.updated'));
      setEditingId(null);
      await fetchStorageUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('storageNotifications.updateError');
      logger.error('Edit storage error', { error: msg });
      notifyError(`${t('storageNotifications.failurePrefix')} ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete handlers ──

  const handleDeleteClick = async (unit: StorageUnit) => {
    const allowed = await checkBeforeDelete(unit.id);
    if (allowed) setConfirmDelete(unit);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setConfirmLoading(true);
    setDeletingId(confirmDelete.id);
    try {
      await deleteStorageWithPolicy({ storageId: confirmDelete.id });
      success(t('storageNotifications.deleted'));
      await fetchStorageUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('storageNotifications.deleteError');
      logger.error('Delete storage error', { error: msg });
      notifyError(`${t('storageNotifications.failurePrefix')} ${msg}`);
    } finally {
      setConfirmLoading(false);
      setConfirmDelete(null);
      setDeletingId(null);
    }
  };

  // ── Unlink handlers ──

  const handleUnlinkClick = (unit: StorageUnit) => setConfirmUnlink(unit);

  const handleUnlinkConfirm = async () => {
    if (!confirmUnlink) return;
    setUnlinkLoading(true);
    setUnlinkingId(confirmUnlink.id);
    try {
      const result = await updateStorageWithPolicy<StorageMutationResult>({
        storageId: confirmUnlink.id,
        payload: { buildingId: null },
      });
      if (result?.id) {
        RealtimeService.dispatch('STORAGE_UPDATED', {
          storageId: confirmUnlink.id,
          updates: { buildingId: null },
          timestamp: Date.now(),
        });
      }
      success(t('storageNotifications.unlinked'));
      await fetchStorageUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('storageNotifications.unlinkError');
      logger.error('Unlink storage error', { error: msg });
      notifyError(`${t('storageNotifications.failurePrefix')} ${msg}`);
    } finally {
      setUnlinkLoading(false);
      setConfirmUnlink(null);
      setUnlinkingId(null);
    }
  };

  // ── Link handlers ──

  const fetchUnlinkedStorages = useCallback(async (): Promise<LinkableItem[]> => {
    const result = await apiClient.get<StoragesApiResponse>(API_ROUTES.STORAGES.LIST);
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
    await updateStorageWithPolicy({
      storageId: itemId,
      payload: { buildingId: building.id },
    });
    success(t('storageNotifications.linked'));
    await fetchStorageUnits();
  }, [building.id, fetchStorageUnits, success, t]);

  return {
    t,
    // Data
    units, loading, filteredUnits, stats,
    // Create
    showCreateForm, setShowCreateForm,
    createCode, setCreateCode,
    createType, setCreateType,
    createStatus, setCreateStatus,
    createFloor, setCreateFloor,
    createArea, setCreateArea,
    createPrice, setCreatePrice,
    createDescription, setCreateDescription,
    creating, handleCreate, resetCreateForm,
    // Edit
    editingId, editCode, setEditCode,
    editType, setEditType, editStatus, setEditStatus,
    editFloor, setEditFloor, editArea, setEditArea,
    editPrice, setEditPrice, saving,
    startEdit, cancelEdit, handleSaveEdit,
    // Delete
    deletingId, confirmDelete, setConfirmDelete, confirmLoading, handleDeleteClick, handleDeleteConfirm,
    // Unlink
    unlinkingId, confirmUnlink, setConfirmUnlink, unlinkLoading, handleUnlinkClick, handleUnlinkConfirm,
    // Link
    showLinkDialog, setShowLinkDialog, fetchUnlinkedStorages, handleLinkStorage,
    // Deletion guard
    BlockedDialog,
    // Filters & view
    searchTerm, setSearchTerm,
    filterType, setFilterType,
    filterStatus, setFilterStatus,
    viewMode, setViewMode,
    // Label translators
    translatedGetStatusLabel, translatedGetTypeLabel,
  };
}
