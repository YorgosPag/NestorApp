/**
 * useParkingTabState — State management hook for ParkingTabContent
 *
 * Encapsulates all useState declarations, CRUD handlers, fetch functions,
 * form reset, realtime dispatch, and computed values (filteredSpots, dashboardStats).
 *
 * @module components/building-management/tabs/useParkingTabState
 * @see ADR-184 (Building Spaces Tabs)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createParkingWithPolicy, deleteParkingWithPolicy, updateParkingWithPolicy } from '@/services/parking-mutation-gateway';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import { Car, CheckCircle, Euro, Ruler } from 'lucide-react';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { ParkingSpot, ParkingSpotType, ParkingSpotStatus, ParkingLocationZone } from '@/types/parking';
import type { LinkableItem } from '../shared';
import type {
  ParkingApiResponse,
  ParkingCreateResult,
  ParkingMutationResult,
  ParkingConfirmAction,
} from './parking-tab-config';

// ============================================================================
// HOOK INTERFACE
// ============================================================================

interface UseParkingTabStateParams {
  buildingId: string;
  projectId: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useParkingTabState({ buildingId, projectId }: UseParkingTabStateParams) {
  const { t } = useTranslation('parking');
  const { t: tBuilding } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);

  // ---------------------------------------------------------------------------
  // Data state
  // ---------------------------------------------------------------------------
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Create form state
  // ---------------------------------------------------------------------------
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createNumber, setCreateNumber] = useState('');
  const [createType, setCreateType] = useState<ParkingSpotType>('standard');
  const [createStatus, setCreateStatus] = useState<ParkingSpotStatus>('available');
  const [createFloor, setCreateFloor] = useState('');
  const [createLocation, setCreateLocation] = useState('');
  const [createArea, setCreateArea] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createLocationZone, setCreateLocationZone] = useState<ParkingLocationZone | ''>('');
  const [creating, setCreating] = useState(false);

  // ---------------------------------------------------------------------------
  // Edit state
  // ---------------------------------------------------------------------------
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editType, setEditType] = useState<ParkingSpotType>('standard');
  const [editStatus, setEditStatus] = useState<ParkingSpotStatus>('available');
  const [editFloor, setEditFloor] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  // ---------------------------------------------------------------------------
  // Delete, Unlink & Confirm state
  // ---------------------------------------------------------------------------
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ParkingConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ADR-226 Phase 3: Deletion Guard
  const { checkBeforeDelete, BlockedDialog } = useDeletionGuard('parking');

  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // ---------------------------------------------------------------------------
  // Filter & view state
  // ---------------------------------------------------------------------------
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ParkingSpotType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ParkingSpotStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // ===========================================================================
  // FETCH
  // ===========================================================================

  const fetchParkingSpots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<ParkingApiResponse>(
        `${API_ROUTES.PARKING.LIST}?buildingId=${buildingId}`
      );
      if (result?.parkingSpots) {
        setParkingSpots(result.parkingSpots);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parking spots');
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    fetchParkingSpots();
  }, [fetchParkingSpots]);

  // ===========================================================================
  // CREATE
  // ===========================================================================

  const resetCreateForm = useCallback(() => {
    setShowCreateForm(false);
    setCreateNumber('');
    setCreateType('standard');
    setCreateStatus('available');
    setCreateFloor('');
    setCreateLocation('');
    setCreateArea('');
    setCreatePrice('');
    setCreateNotes('');
    setCreateLocationZone('');
  }, []);

  const handleCreate = useCallback(async () => {
    if (!createNumber.trim()) return;
    setCreating(true);
    try {
      const result = await createParkingWithPolicy<ParkingCreateResult>({ payload: {
        number: createNumber.trim(),
        type: createType,
        status: createStatus,
        floor: createFloor.trim() || undefined,
        location: createLocation.trim() || undefined,
        area: createArea ? parseFloat(createArea) : undefined,
        price: createPrice ? parseFloat(createPrice) : undefined,
        notes: createNotes.trim() || undefined,
        locationZone: createLocationZone || undefined,
        buildingId,
        projectId,
      }});
      if (result?.parkingSpotId) {
        RealtimeService.dispatch('PARKING_CREATED', {
          parkingSpotId: result.parkingSpotId,
          parkingSpot: {
            number: createNumber.trim(),
            buildingId,
            type: createType,
            status: createStatus,
          },
          timestamp: Date.now(),
        });
        resetCreateForm();
        await fetchParkingSpots();
      }
    } catch (err) {
      console.error('[ParkingTab] Create error:', err);
    } finally {
      setCreating(false);
    }
  }, [
    createNumber, createType, createStatus, createFloor, createLocation,
    createArea, createPrice, createNotes, createLocationZone,
    buildingId, projectId, resetCreateForm, fetchParkingSpots,
  ]);

  // ===========================================================================
  // EDIT
  // ===========================================================================

  const startEdit = useCallback((spot: ParkingSpot) => {
    setEditingId(spot.id);
    setEditNumber(spot.number);
    setEditType(spot.type || 'standard');
    setEditStatus(spot.status || 'available');
    setEditFloor(spot.floor || '');
    setEditArea(spot.area ? String(spot.area) : '');
    setEditPrice(spot.price ? String(spot.price) : '');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editNumber.trim()) return;
    setSaving(true);
    try {
      const result = await updateParkingWithPolicy<ParkingMutationResult>({
        parkingSpotId: editingId,
        payload: {
          number: editNumber.trim(),
          type: editType,
          status: editStatus,
          floor: editFloor.trim() || undefined,
          area: editArea ? parseFloat(editArea) : undefined,
          price: editPrice ? parseFloat(editPrice) : undefined,
        },
      });
      if (result?.id) {
        RealtimeService.dispatch('PARKING_UPDATED', {
          parkingSpotId: editingId,
          updates: {
            number: editNumber.trim(),
            type: editType,
            status: editStatus,
            floor: editFloor.trim() || undefined,
            area: editArea ? parseFloat(editArea) : undefined,
            price: editPrice ? parseFloat(editPrice) : undefined,
          },
          timestamp: Date.now(),
        });
        setEditingId(null);
        await fetchParkingSpots();
      }
    } catch (err) {
      console.error('[ParkingTab] Edit error:', err);
    } finally {
      setSaving(false);
    }
  }, [editingId, editNumber, editType, editStatus, editFloor, editArea, editPrice, fetchParkingSpots]);

  // ===========================================================================
  // DELETE & UNLINK
  // ===========================================================================

  const handleDeleteClick = useCallback(async (spot: ParkingSpot) => {
    const allowed = await checkBeforeDelete(spot.id);
    if (allowed) {
      setConfirmAction({ type: 'delete', item: spot });
    }
  }, [checkBeforeDelete]);

  const handleUnlinkClick = useCallback((spot: ParkingSpot) => {
    setConfirmAction({ type: 'unlink', item: spot });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    const { type, item } = confirmAction;

    try {
      if (type === 'delete') {
        setDeletingId(item.id);
        const result = await deleteParkingWithPolicy<ParkingMutationResult>({ parkingSpotId: item.id });
        if (result?.id) {
          RealtimeService.dispatch('PARKING_DELETED', {
            parkingSpotId: item.id,
            timestamp: Date.now(),
          });
        }
      } else {
        setUnlinkingId(item.id);
        const result = await updateParkingWithPolicy<ParkingMutationResult>({
          parkingSpotId: item.id,
          payload: { buildingId: null },
        });
        if (result?.id) {
          RealtimeService.dispatch('PARKING_UPDATED', {
            parkingSpotId: item.id,
            updates: { buildingId: null },
            timestamp: Date.now(),
          });
        }
      }
      await fetchParkingSpots();
    } catch (err) {
      console.error(`[ParkingTab] ${type} error:`, err);
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
      setDeletingId(null);
      setUnlinkingId(null);
    }
  }, [confirmAction, fetchParkingSpots]);

  // ===========================================================================
  // LINK — Fetch unlinked parking spots + link to this building
  // ===========================================================================

  const fetchUnlinkedParking = useCallback(async (): Promise<LinkableItem[]> => {
    const result = await apiClient.get<ParkingApiResponse>(API_ROUTES.PARKING.LIST);
    if (!result?.parkingSpots) return [];
    return result.parkingSpots
      .filter((s) => !s.buildingId)
      .map((s) => ({
        id: s.id,
        label: s.number,
        sublabel: `${t(`types.${s.type || 'standard'}`)} · ${s.floor || '—'}`,
      }));
  }, [t]);

  const handleLinkParking = useCallback(async (itemId: string) => {
    await updateParkingWithPolicy<ParkingMutationResult>({
      parkingSpotId: itemId,
      payload: { buildingId },
    });
    RealtimeService.dispatch('PARKING_UPDATED', {
      parkingSpotId: itemId,
      updates: { buildingId },
      timestamp: Date.now(),
    });
    await fetchParkingSpots();
  }, [buildingId, fetchParkingSpots]);

  // ===========================================================================
  // COMPUTED: Stats & Filtered Data
  // ===========================================================================

  const stats = useMemo(() => ({
    total: parkingSpots.length,
    available: parkingSpots.filter(s => s.status === 'available').length,
    totalValue: parkingSpots.reduce((sum, s) => sum + (s.price || 0), 0),
    totalArea: parkingSpots.reduce((sum, s) => sum + (s.area || 0), 0),
  }), [parkingSpots]);

  const filteredSpots = useMemo(() => {
    return parkingSpots.filter(spot => {
      const matchesSearch = !searchTerm ||
        spot.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (spot.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (spot.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || spot.type === filterType;
      const matchesStatus = filterStatus === 'all' || spot.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [parkingSpots, searchTerm, filterType, filterStatus]);

  const dashboardStats: DashboardStat[] = useMemo(() => [
    { title: tBuilding('parkingStats.total'), value: stats.total, icon: Car, color: 'blue' },
    { title: tBuilding('parkingStats.available'), value: stats.available, icon: CheckCircle, color: 'green' },
    { title: tBuilding('parkingStats.totalValue'), value: `€${(stats.totalValue / 1000).toFixed(0)}K`, icon: Euro, color: 'gray' },
    { title: tBuilding('parkingStats.totalArea'), value: `${stats.totalArea.toFixed(1)} m²`, icon: Ruler, color: 'blue' },
  ], [stats, tBuilding]);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    // Translation helpers
    t,
    tBuilding,

    // Data
    parkingSpots,
    loading,
    error,
    fetchParkingSpots,

    // Create form
    showCreateForm,
    setShowCreateForm,
    createNumber, setCreateNumber,
    createType, setCreateType,
    createStatus, setCreateStatus,
    createFloor, setCreateFloor,
    createLocation, setCreateLocation,
    createArea, setCreateArea,
    createPrice, setCreatePrice,
    createNotes, setCreateNotes,
    createLocationZone, setCreateLocationZone,
    creating,
    resetCreateForm,
    handleCreate,

    // Edit
    editingId,
    editNumber, setEditNumber,
    editType, setEditType,
    editStatus, setEditStatus,
    editFloor, setEditFloor,
    editArea, setEditArea,
    editPrice, setEditPrice,
    saving,
    startEdit,
    cancelEdit,
    handleSaveEdit,

    // Delete & Unlink
    deletingId,
    unlinkingId,
    confirmAction, setConfirmAction,
    confirmLoading,
    handleDeleteClick,
    handleUnlinkClick,
    handleConfirm,
    BlockedDialog,

    // Link dialog
    showLinkDialog, setShowLinkDialog,
    fetchUnlinkedParking,
    handleLinkParking,

    // Filters & view
    searchTerm, setSearchTerm,
    filterType, setFilterType,
    filterStatus, setFilterStatus,
    viewMode, setViewMode,

    // Computed
    stats,
    filteredSpots,
    dashboardStats,
  } as const;
}
