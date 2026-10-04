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
import { createStaleCache } from '@/lib/stale-cache';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { useMutationFailureFeedback } from '@/hooks/useMutationFailureFeedback';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { deleteParkingWithPolicy, updateParkingWithPolicy } from '@/services/parking-mutation-gateway';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import { Car, CheckCircle, Euro, Ruler } from 'lucide-react';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { ParkingSpot, ParkingSpotType } from '@/types/parking';
import {
  NEW_SPACE_OPERATIONAL_STATUS,
  operationalDraftOf,
  operationalPatchOf,
  type OperationalStatusDraft,
} from '@/lib/spaces/space-operational-draft';
import {
  ALL_SPACE_AVAILABILITY,
  countSpaceStatuses,
  matchesSpaceAvailability,
  type SpaceAvailabilityFilter,
} from '@/lib/spaces/space-availability';
import { totalPriceByRole } from '@/lib/properties/price-totals';
import { priceTotalsView } from '@/lib/listings/listing-price-label';
import { useCommercialDraft } from '@/components/shared/commercial/useCommercialDraft';
import type { LinkableItem } from '../shared';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { hostedFloorRef } from '@/lib/floor/hosted-floor';
import type {
  ParkingApiData,
  ParkingMutationResult,
  ParkingConfirmAction,
} from './parking-tab-config';
import { useParkingCreateForm } from './useParkingCreateForm';

// ============================================================================
// HOOK INTERFACE
// ============================================================================

interface UseParkingTabStateParams {
  buildingId: string;
  projectId: string;
}

// ADR-300: Module-level cache — keyed by buildingId, survives re-navigation
const buildingParkingCache = createStaleCache<ParkingSpot[]>('building-parking-tab');

// ============================================================================
// HOOK
// ============================================================================

export function useParkingTabState({ buildingId, projectId }: UseParkingTabStateParams) {
  const { t } = useTranslation(['parking', 'properties-enums']);
  const { t: tBuilding } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  // ADR-898 §21.6 Ε3 — ΕΝΑΣ βοηθός για κάθε αποτυχία: άρνηση πολιτικής ⇒ info + toast, άλλο ⇒ error + toast.
  const reportFailure = useMutationFailureFeedback('ParkingTab');
  const floorLabel = useFloorLabel();

  // ---------------------------------------------------------------------------
  // Data state — ADR-300: Seed from module-level cache → zero flash on re-navigation
  // ---------------------------------------------------------------------------
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>(buildingParkingCache.get(buildingId) ?? []);
  const [loading, setLoading] = useState(!buildingParkingCache.hasLoaded(buildingId));
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Edit state
  // ---------------------------------------------------------------------------
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editType, setEditType] = useState<ParkingSpotType>('standard');
  const [editStatus, setEditStatus] = useState<OperationalStatusDraft>(NEW_SPACE_OPERATIONAL_STATUS);
  const [editFloorId, setEditFloorId] = useState('');
  const [editArea, setEditArea] = useState('');
  // ADR-777 §8.60.18 — διάθεση + τιμή ανά ρόλο (ήταν `editPrice` → @deprecated `price`, πάντα «πώληση»).
  const commercial = useCommercialDraft();
  const resetCommercial = commercial.reset;
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
  const [filterStatus, setFilterStatus] = useState<SpaceAvailabilityFilter>(ALL_SPACE_AVAILABILITY);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // ===========================================================================
  // FETCH
  // ===========================================================================

  const fetchParkingSpots = useCallback(async () => {
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!buildingParkingCache.hasLoaded(buildingId)) setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<ParkingApiData>(
        `${API_ROUTES.PARKING.LIST}?buildingId=${buildingId}`
      );
      if (result?.parkingSpots) {
        // ADR-300: Write to module-level cache so next remount skips spinner
        buildingParkingCache.set(result.parkingSpots, buildingId);
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
  // CREATE — η φόρμα «νέα θέση» ζει στο δικό της hook (N.7.1)
  // ===========================================================================

  const createForm = useParkingCreateForm({ buildingId, projectId, t, onCreated: fetchParkingSpots, reportFailure });

  // ===========================================================================
  // EDIT
  // ===========================================================================

  const startEdit = useCallback((spot: ParkingSpot) => {
    setEditingId(spot.id);
    setEditNumber(spot.number);
    setEditType(spot.type || 'standard');
    setEditStatus(operationalDraftOf(spot));
    setEditFloorId(spot.floorId || '');
    setEditArea(spot.area ? String(spot.area) : '');
    resetCommercial(spot);
  }, [resetCommercial]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  // Θέση πριν τη μετανάστευση: ο παλιός όροφος (κείμενο) δείχνεται ως ανενεργή επιλογή (ADR-903 §6).
  const editLegacyFloor = useMemo(() => {
    const spot = parkingSpots.find((s) => s.id === editingId);
    return spot ? hostedFloorRef(spot) : null;
  }, [parkingSpots, editingId]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editNumber.trim()) return;
    setSaving(true);

    // ΕΝΑ αντικείμενο, δύο παραλήπτες: η εγγραφή και η ειδοποίηση realtime. Ήταν
    // γραμμένο δύο φορές, κι έτσι ένα πεδίο μπορούσε να γραφτεί στη βάση και να
    // ΜΗΝ ταξιδέψει στην οθόνη — μια απόκλιση που φαίνεται σαν «δεν αποθηκεύτηκε».
    // Διάθεση ΚΑΙ λειτουργία ταξιδεύουν ΜΟΝΟ όταν άλλαξαν — κρίνονται απέναντι στην αποθηκευμένη θέση.
    const stored = parkingSpots.find((spot) => spot.id === editingId);
    const updates = {
      number: editNumber.trim(),
      type: editType,
      ...(stored ? operationalPatchOf(editStatus, stored) : {}),
      // Μόνο αν άλλαξε: έγγραφο χωρίς `floorId` (πριν τη μετανάστευση) δεν χάνει σιωπηλά τον παλιό όροφο.
      ...(editFloorId !== (stored?.floorId ?? '') ? { floorId: editFloorId || null } : {}),
      area: editArea ? parseFloat(editArea) : undefined,
    };
    const commercialPatch = stored ? commercial.patchAgainst(stored) : {};

    try {
      const result = await updateParkingWithPolicy<ParkingMutationResult>({
        parkingSpotId: editingId,
        payload: { ...updates, ...commercialPatch },
      });
      if (result?.id) {
        RealtimeService.dispatch('PARKING_UPDATED', {
          parkingSpotId: editingId,
          updates,
          timestamp: Date.now(),
        });
        setEditingId(null);
        await fetchParkingSpots();
      }
    } catch (err) {
      reportFailure(err, 'update', t('messages.updateError'));
    } finally {
      setSaving(false);
    }
  }, [editingId, editNumber, editType, editStatus, editFloorId, editArea, parkingSpots, commercial, fetchParkingSpots, reportFailure, t]);

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
      // ADR-898 §20: παρακολούθημα μονάδας ⇒ 409 με κωδικό πολιτικής. Η διαγραφή δεν έχει πια σιωπηλή αποτυχία.
      reportFailure(err, type, type === 'delete' ? t('messages.deleteError') : t('messages.updateError'));
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
      setDeletingId(null);
      setUnlinkingId(null);
    }
  }, [confirmAction, fetchParkingSpots, reportFailure, t]);

  // ===========================================================================
  // LINK — Fetch unlinked parking spots + link to this building
  // ===========================================================================

  const fetchUnlinkedParking = useCallback(async (): Promise<LinkableItem[]> => {
    const result = await apiClient.get<ParkingApiData>(API_ROUTES.PARKING.LIST);
    if (!result?.parkingSpots) return [];
    return result.parkingSpots
      .filter((s) => !s.buildingId)
      .map((s) => ({
        id: s.id,
        label: s.number,
        sublabel: `${t(`types.${s.type || 'standard'}`)} · ${floorLabel(hostedFloorRef(s)) || '—'}`,
      }));
  }, [t, floorLabel]);

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
    // ADR-777 §8.60.20 — «διαθέσιμη» = στην αγορά, από το `commercialStatus` (όχι το παλιό `status`).
    available: countSpaceStatuses(parkingSpots).byAvailability.listed,
    // ADR-777 Α5/Α6 + §8.60.14.13 — the price SSoT, PER ROLE.
    priceTotals: totalPriceByRole(parkingSpots),
    totalArea: parkingSpots.reduce((sum, s) => sum + (s.area || 0), 0),
  }), [parkingSpots]);

  const filteredSpots = useMemo(() => {
    return parkingSpots.filter(spot => {
      const matchesSearch = !searchTerm ||
        spot.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (spot.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (spot.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || spot.type === filterType;
      const matchesStatus = matchesSpaceAvailability(spot, filterStatus);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [parkingSpots, searchTerm, filterType, filterStatus]);

  const dashboardStats: DashboardStat[] = useMemo(() => [
    { title: tBuilding('parkingStats.total'), value: stats.total, icon: Car, color: 'blue' },
    { title: tBuilding('parkingStats.available'), value: stats.available, icon: CheckCircle, color: 'green' },
    { title: tBuilding('parkingStats.totalValue'), ...priceTotalsView(tBuilding, stats.priceTotals, 'total'), icon: Euro, color: 'gray' },
    { title: tBuilding('parkingStats.totalArea'), value: `${stats.totalArea.toFixed(1)} m²`, icon: Ruler, color: 'blue' },
  ], [stats, tBuilding]);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    // ADR-903 §6 — το κτίριο της καρτέλας: ο επιλογέας ορόφου δείχνει τους ορόφους του.
    buildingId,
    // Translation helpers
    t,
    tBuilding,

    // Data
    parkingSpots,
    loading,
    error,
    fetchParkingSpots,

    // Create form (useParkingCreateForm)
    ...createForm,

    // Edit
    editingId,
    editNumber, setEditNumber,
    editType, setEditType,
    editStatus, setEditStatus,
    editFloorId, setEditFloorId, editLegacyFloor,
    editArea, setEditArea,
    commercial,
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
