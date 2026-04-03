/**
 * useFloorsTabState — State + CRUD handlers for FloorsTabContent
 * Extracted for file-size compliance (<500 lines).
 *
 * @module components/building-management/tabs/useFloorsTabState
 * @see ADR-180 (IFC Floor Management System)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createFloorWithPolicy, deleteFloorWithPolicy, updateFloorWithPolicy } from '@/services/floor-mutation-gateway';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import { toast } from 'sonner';
import { formatFloorLabel } from '@/lib/intl-domain';

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
  const [createNameManuallyEdited, setCreateNameManuallyEdited] = useState(false);
  const [createElevation, setCreateElevation] = useState('');
  const [createElevationManuallyEdited, setCreateElevationManuallyEdited] = useState(false);
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [editNameManuallyEdited, setEditNameManuallyEdited] = useState(false);
  const [editElevation, setEditElevation] = useState('');
  const [editElevationManuallyEdited, setEditElevationManuallyEdited] = useState(false);
  const [editVersion, setEditVersion] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleFloorExpand = (floorId: string) => {
    setExpandedFloorId((prev) => (prev === floorId ? null : floorId));
  };

  // =========================================================================
  // AUTO-SUGGEST: Number → Name + Elevation (Revit/ArchiCAD Pattern)
  // Default storey height: 3.0m (residential standard)
  // =========================================================================

  const DEFAULT_STOREY_HEIGHT = 3.0;

  /** Compute default elevation for a floor number (0=ground=0m, 1=+3m, -1=-3m) */
  const computeDefaultElevation = useCallback((floorNumber: number): string => {
    return (floorNumber * DEFAULT_STOREY_HEIGHT).toFixed(2);
  }, []);

  /** Update create number and auto-suggest name + elevation if user hasn't manually edited them */
  const handleCreateNumberChange = useCallback((value: string) => {
    setCreateNumber(value);
    const num = parseInt(value, 10);
    if (!createNameManuallyEdited) {
      setCreateName(isNaN(num) ? '' : formatFloorLabel(num));
    }
    if (!createElevationManuallyEdited) {
      setCreateElevation(isNaN(num) ? '' : computeDefaultElevation(num));
    }
  }, [createNameManuallyEdited, createElevationManuallyEdited, computeDefaultElevation]);

  /** Mark name as manually edited when user types in the name field */
  const handleCreateNameChange = useCallback((value: string) => {
    setCreateName(value);
    setCreateNameManuallyEdited(true);
  }, []);

  /** Mark elevation as manually edited when user types in the elevation field */
  const handleCreateElevationChange = useCallback((value: string) => {
    setCreateElevation(value);
    setCreateElevationManuallyEdited(true);
  }, []);

  /** Update edit number and auto-suggest name + elevation if user hasn't manually edited them */
  const handleEditNumberChange = useCallback((value: string) => {
    setEditNumber(value);
    const num = parseInt(value, 10);
    if (!editNameManuallyEdited) {
      setEditName(isNaN(num) ? '' : formatFloorLabel(num));
    }
    if (!editElevationManuallyEdited) {
      setEditElevation(isNaN(num) ? '' : computeDefaultElevation(num));
    }
  }, [editNameManuallyEdited, editElevationManuallyEdited, computeDefaultElevation]);

  /** Mark edit name as manually edited */
  const handleEditNameChange = useCallback((value: string) => {
    setEditName(value);
    setEditNameManuallyEdited(true);
  }, []);

  /** Mark edit elevation as manually edited */
  const handleEditElevationChange = useCallback((value: string) => {
    setEditElevation(value);
    setEditElevationManuallyEdited(true);
  }, []);

  // =========================================================================
  // WARNINGS: Mismatch + Gap Detection
  // =========================================================================

  /** Check if manually-entered name mismatches the auto-suggested name */
  const createNameMismatch = useMemo((): boolean => {
    if (!createNameManuallyEdited || !createName.trim()) return false;
    const num = parseInt(createNumber, 10);
    if (isNaN(num)) return false;
    return createName.trim() !== formatFloorLabel(num);
  }, [createNumber, createName, createNameManuallyEdited]);

  const editNameMismatch = useMemo((): boolean => {
    if (!editNameManuallyEdited || !editName.trim()) return false;
    const num = parseInt(editNumber, 10);
    if (isNaN(num)) return false;
    return editName.trim() !== formatFloorLabel(num);
  }, [editNumber, editName, editNameManuallyEdited]);

  /** Detect gaps in floor numbering sequence */
  const floorGaps = useMemo((): number[] => {
    if (floors.length < 2) return [];
    const numbers = floors.map((f) => f.number).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 0; i < numbers.length - 1; i++) {
      const diff = numbers[i + 1] - numbers[i];
      if (diff > 1) {
        for (let g = numbers[i] + 1; g < numbers[i + 1]; g++) {
          gaps.push(g);
        }
      }
    }
    return gaps;
  }, [floors]);

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
    if (!createName.trim()) {
      toast.error(t('tabs.floors.validationNameRequired'));
      return;
    }
    setCreating(true);
    try {
      await createFloorWithPolicy<FloorMutationResponse>({ payload: {
        number: parseInt(createNumber, 10) || 0,
        name: createName.trim(),
        elevation: createElevation ? parseFloat(createElevation) : null,
        buildingId,
        ...(projectId ? { projectId } : {}),
      }});
      setShowCreateForm(false);
      setCreateNumber('0');
      setCreateName('');
      setCreateNameManuallyEdited(false);
      setCreateElevation('');
      setCreateElevationManuallyEdited(false);
      toast.success(t('tabs.floors.createSuccess'));
      await fetchFloors();
    } catch (err) {
      if (ApiClientError.isApiClientError(err) && err.statusCode === 409) {
        toast.error(t('tabs.floors.duplicateNumber'));
      } else {
        const msg = err instanceof Error ? err.message : '';
        toast.error(t('tabs.floors.createError') + (msg ? `: ${msg}` : ''));
      }
      console.error('[FloorsTab] Create error:', err);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (floor: FloorRecord) => {
    setEditingId(floor.id);
    setEditNumber(String(floor.number));
    setEditName(floor.name);
    setEditNameManuallyEdited(false);
    setEditElevation(floor.elevation != null ? String(floor.elevation) : '');
    setEditElevationManuallyEdited(floor.elevation != null);
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
      const result = await updateFloorWithPolicy<FloorMutationResponse>({ payload });
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
    try {
      const allowed = await checkBeforeDelete(floor.id);
      if (!allowed) return;
    } catch (guardErr) {
      console.error('[FloorsTab] Deletion guard error:', guardErr);
      toast.error(t('tabs.floors.deleteGuardError'));
      return;
    }

    const confirmed = await confirm({
      title: t('tabs.floors.deleteConfirmTitle'),
      description: t('tabs.floors.deleteConfirm', { name: floor.name }),
      variant: 'destructive',
    });
    if (!confirmed) return;

    setDeletingId(floor.id);
    try {
      const result = await deleteFloorWithPolicy<FloorMutationResponse>({ floorId: floor.id });
      if (result?.success) {
        toast.success(t('tabs.floors.deleteSuccess'));
        await fetchFloors();
      } else {
        toast.error(result?.error ?? t('tabs.floors.deleteError'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(t('tabs.floors.deleteError') + (msg ? `: ${msg}` : ''));
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
    createNumber, handleCreateNumberChange, createName, handleCreateNameChange,
    createElevation, handleCreateElevationChange, creating, handleCreate,
    createNameMismatch,
    editingId, editNumber, handleEditNumberChange, editName, handleEditNameChange,
    editElevation, handleEditElevationChange, saving,
    editNameMismatch,
    startEdit, cancelEdit, handleSaveEdit,
    deletingId, handleDelete, fetchFloors, formatElevation,
    floorGaps,
    dialogProps, BlockedDialog, confirm,
  };
}
