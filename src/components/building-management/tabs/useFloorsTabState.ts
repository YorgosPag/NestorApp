/**
 * useFloorsTabState — State + CRUD handlers for FloorsTabContent
 * Extracted for file-size compliance (<500 lines).
 *
 * @module components/building-management/tabs/useFloorsTabState
 * @see ADR-180 (IFC Floor Management System)
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export interface FloorRecord {
  id: string;
  number: number;
  name: string;
  elevation?: number | null;
  buildingId: string;
  units?: number;
  _v?: number;
}

interface FloorsApiResponse {
  success: boolean;
  floors: FloorRecord[];
  stats: { totalFloors: number };
}

interface FloorMutationResponse {
  success: boolean;
  floorId?: string;
  floor?: FloorRecord;
  message?: string;
  error?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFloorsTabState(buildingId: string, projectId?: string) {
  const { t } = useTranslation('building');
  const { confirm, dialogProps } = useConfirmDialog();
  const { checkBeforeDelete, BlockedDialog } = useDeletionGuard('floor');

  // Data state
  const [floors, setFloors] = useState<FloorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expand/collapse
  const [expandedFloorId, setExpandedFloorId] = useState<string | null>(null);

  // Inline create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createNumber, setCreateNumber] = useState('0');
  const [createName, setCreateName] = useState('');
  const [createElevation, setCreateElevation] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [editElevation, setEditElevation] = useState('');
  const [editVersion, setEditVersion] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleFloorExpand = (floorId: string) => {
    setExpandedFloorId((prev) => (prev === floorId ? null : floorId));
  };

  const fetchFloors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<FloorsApiResponse>(
        `${API_ROUTES.FLOORS.LIST}?buildingId=${buildingId}`
      );
      if (result?.floors) {
        setFloors([...result.floors].sort((a, b) => a.number - b.number));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load floors');
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => { fetchFloors(); }, [fetchFloors]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await apiClient.post<FloorMutationResponse>(API_ROUTES.FLOORS.LIST, {
        number: parseInt(createNumber, 10) || 0,
        name: createName.trim(),
        elevation: createElevation ? parseFloat(createElevation) : null,
        buildingId,
        ...(projectId ? { projectId } : {}),
      });
      setShowCreateForm(false);
      setCreateNumber('0');
      setCreateName('');
      setCreateElevation('');
      toast.success(t('tabs.floors.createSuccess'));
      await fetchFloors();
    } catch (err) {
      toast.error(t('tabs.floors.createError'));
      console.error('[FloorsTab] Create error:', err);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (floor: FloorRecord) => {
    setEditingId(floor.id);
    setEditNumber(String(floor.number));
    setEditName(floor.name);
    setEditElevation(floor.elevation != null ? String(floor.elevation) : '');
    setEditVersion(floor._v);
  };

  const cancelEdit = () => { setEditingId(null); };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        floorId: editingId,
        number: parseInt(editNumber, 10),
        name: editName.trim(),
        elevation: editElevation ? parseFloat(editElevation) : null,
      };
      if (editVersion !== undefined) payload._v = editVersion;
      const result = await apiClient.patch<FloorMutationResponse>(API_ROUTES.FLOORS.LIST, payload);
      if (result?.success) {
        setEditingId(null);
        toast.success(t('tabs.floors.editSuccess'));
        await fetchFloors();
      } else {
        toast.error(result?.error ?? t('tabs.floors.editError'));
      }
    } catch (err) {
      if (ApiClientError.isApiClientError(err) && err.statusCode === 409) {
        toast.error(t('tabs.floors.versionConflict'));
        setEditingId(null);
        await fetchFloors();
        return;
      }
      toast.error(t('tabs.floors.editError'));
      console.error('[FloorsTab] Edit error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (floor: FloorRecord) => {
    const allowed = await checkBeforeDelete(floor.id);
    if (!allowed) return;
    const confirmed = await confirm({
      title: t('tabs.floors.deleteConfirm', { name: floor.name }),
      description: t('tabs.floors.deleteConfirm', { name: floor.name }),
      variant: 'destructive',
    });
    if (!confirmed) return;
    setDeletingId(floor.id);
    try {
      const result = await apiClient.delete<FloorMutationResponse>(
        `${API_ROUTES.FLOORS.LIST}?floorId=${floor.id}`
      );
      if (result?.success) {
        toast.success(t('tabs.floors.deleteSuccess'));
        await fetchFloors();
      } else {
        toast.error(result?.error ?? t('tabs.floors.deleteError'));
      }
    } catch (err) {
      toast.error(t('tabs.floors.deleteError'));
      console.error('[FloorsTab] Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatElevation = (elevation: number | null | undefined): string => {
    if (elevation == null) return '—';
    const prefix = elevation > 0 ? '+' : '';
    return `${prefix}${elevation.toFixed(2)} ${t('tabs.floors.elevationUnit')}`;
  };

  return {
    floors, loading, error, expandedFloorId, toggleFloorExpand,
    showCreateForm, setShowCreateForm,
    createNumber, setCreateNumber, createName, setCreateName,
    createElevation, setCreateElevation, creating, handleCreate,
    editingId, editNumber, setEditNumber, editName, setEditName,
    editElevation, setEditElevation, saving,
    startEdit, cancelEdit, handleSaveEdit,
    deletingId, handleDelete, fetchFloors, formatElevation,
    dialogProps, BlockedDialog, confirm,
  };
}
