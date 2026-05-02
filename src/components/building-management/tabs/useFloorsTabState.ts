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
import { createStaleCache } from '@/lib/stale-cache';
import { deleteFloorWithPolicy, updateFloorWithPolicy } from '@/services/floor-mutation-gateway';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import { useNotifications } from '@/providers/NotificationProvider';
import { formatFloorLabel } from '@/lib/intl-domain';

// ============================================================================
// TYPES
// ============================================================================

export interface FloorRecord {
  id: string;
  number: number;
  name: string;
  elevation?: number | null;
  height?: number | null;
  buildingId: string;
  units?: number;
  hasFloorplan?: boolean;
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

// ADR-300: Module-level cache — keyed by buildingId, survives re-navigation
const floorsCache = createStaleCache<FloorRecord[]>('building-floors');

// ============================================================================
// HOOK
// ============================================================================

export function useFloorsTabState(buildingId: string, projectId?: string) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const { success, error: notifyError } = useNotifications();
  const { confirm, dialogProps } = useConfirmDialog();
  const { checkBeforeDelete, BlockedDialog } = useDeletionGuard('floor');

  // Data state — ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [floors, setFloors] = useState<FloorRecord[]>(floorsCache.get(buildingId) ?? []);
  const [loading, setLoading] = useState(!floorsCache.hasLoaded(buildingId));
  const [error, setError] = useState<string | null>(null);

  // Expand/collapse
  const [expandedFloorId, setExpandedFloorId] = useState<string | null>(null);

  // Inline create: SSoT moved to FloorInlineCreateForm (ADR-284 Batch 7)
  // Only toggle state remains here — form state lives in the extracted component.
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [editNameManuallyEdited, setEditNameManuallyEdited] = useState(false);
  const [editElevation, setEditElevation] = useState('');
  const [editElevationManuallyEdited, setEditElevationManuallyEdited] = useState(false);
  const [editHeight, setEditHeight] = useState('');
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

  const handleEditHeightChange = useCallback((value: string) => {
    setEditHeight(value);
  }, []);

  // =========================================================================
  // WARNINGS: Mismatch + Gap Detection
  // =========================================================================

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
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!floorsCache.hasLoaded(buildingId)) setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<FloorsApiResponse>(
        `${API_ROUTES.FLOORS.LIST}?buildingId=${buildingId}`
      );
      if (result?.floors) {
        const sorted = [...result.floors].sort((a, b) => a.number - b.number);
        // ADR-300: Write to module-level cache so next remount skips spinner
        floorsCache.set(sorted, buildingId);
        setFloors(sorted);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load floors');
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => { fetchFloors(); }, [fetchFloors]);

  // handleCreate extracted to FloorInlineCreateForm (SSoT, ADR-284 Batch 7)

  const startEdit = (floor: FloorRecord) => {
    setEditingId(floor.id);
    setEditNumber(String(floor.number));
    setEditName(floor.name);
    setEditNameManuallyEdited(false);
    setEditElevation(floor.elevation != null ? String(floor.elevation) : '');
    setEditElevationManuallyEdited(floor.elevation != null);
    setEditHeight(floor.height != null ? String(floor.height) : '');
    setEditVersion(floor._v);
  };

  const cancelEdit = () => { setEditingId(null); };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    const editedFloor = floors.find((f) => f.id === editingId);
    const oldElevation = editedFloor?.elevation ?? null;
    const newElevation = editElevation ? parseFloat(editElevation) : null;

    const elevationDelta =
      newElevation != null && oldElevation != null && Math.abs(newElevation - oldElevation) > 0.001
        ? newElevation - oldElevation
        : null;

    type FloorWithElevation = FloorRecord & { elevation: number };
    const floorsToShift: FloorWithElevation[] = elevationDelta != null
      ? (floors.filter((f) => f.id !== editingId && f.elevation != null) as FloorWithElevation[])
      : [];

    if (floorsToShift.length > 0 && elevationDelta != null) {
      const sign = elevationDelta > 0 ? '+' : '';
      const confirmed = await confirm({
        title: t('tabs.floors.cascadeElevationTitle'),
        description: t('tabs.floors.cascadeElevationDescription', {
          delta: `${sign}${elevationDelta.toFixed(2)}`,
          count: floorsToShift.length,
        }),
        confirmText: t('tabs.floors.cascadeElevationConfirm'),
        variant: 'warning',
      });
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        floorId: editingId,
        number: parseInt(editNumber, 10),
        name: editName.trim(),
        elevation: newElevation,
        height: editHeight ? parseFloat(editHeight) : null,
      };
      if (editVersion !== undefined) payload._v = editVersion;
      const result = await updateFloorWithPolicy<FloorMutationResponse>({ payload });
      if (!result?.success) {
        notifyError(result?.error ?? t('tabs.floors.editError'));
        return;
      }

      if (floorsToShift.length > 0 && elevationDelta != null) {
        await Promise.all(
          floorsToShift.map((f) =>
            updateFloorWithPolicy<FloorMutationResponse>({
              payload: {
                floorId: f.id,
                elevation: f.elevation + elevationDelta,
                ...(f._v !== undefined ? { _v: f._v } : {}),
              },
            })
          )
        );
      }

      setEditingId(null);
      success(
        floorsToShift.length > 0
          ? t('tabs.floors.editSuccessCascade', { count: floorsToShift.length })
          : t('tabs.floors.editSuccess')
      );
      await fetchFloors();
    } catch (err) {
      if (ApiClientError.isApiClientError(err) && err.statusCode === 409) {
        notifyError(t('tabs.floors.versionConflict'));
        setEditingId(null);
        await fetchFloors();
        return;
      }
      notifyError(t('tabs.floors.editError'));
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
      notifyError(t('tabs.floors.deleteGuardError'));
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
        success(t('tabs.floors.deleteSuccess'));
        await fetchFloors();
      } else {
        notifyError(result?.error ?? t('tabs.floors.deleteError'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      notifyError(t('tabs.floors.deleteError') + (msg ? `: ${msg}` : ''));
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
    // ADR-284 Batch 7 SSoT: create state extracted to FloorInlineCreateForm component
    showCreateForm, setShowCreateForm,
    editingId, editNumber, handleEditNumberChange, editName, handleEditNameChange,
    editElevation, handleEditElevationChange, editHeight, handleEditHeightChange, saving,
    editNameMismatch,
    startEdit, cancelEdit, handleSaveEdit,
    deletingId, handleDelete, fetchFloors, formatElevation,
    floorGaps,
    dialogProps, BlockedDialog, confirm,
  };
}
