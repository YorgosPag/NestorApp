'use client';

/**
 * useProcurementPageState — Hook master per la pagina Procurement
 *
 * Gestisce: selezione PO, toggles UI, filtri centralizzati, dashboard stats.
 * Segue il pattern di useContactsPageState / useBuildingsPageState.
 *
 * @see ADR-267 Phase E — Procurement Layout Unification
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePurchaseOrders } from '@/hooks/procurement/usePurchaseOrders';
import {
  defaultProcurementFilters,
  type ProcurementFilterState,
} from '@/components/core/AdvancedFilters/configs/procurementFiltersConfig';
import { buildProcurementDashboardStats } from '@/components/procurement/page/procurementDashboardStats';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/procurement';

// =============================================================================
// CONSTANTS
// =============================================================================

const API_PROCUREMENT = '/api/procurement';
const QUERY_ACTION = 'action';

// =============================================================================
// HOOK
// =============================================================================

export function useProcurementPageState() {
  const { t } = useTranslation('procurement');
  const router = useRouter();

  // ── UI State ──────────────────────────────────────────────────────────────
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // ── Filter State (AdvancedFiltersPanel) ───────────────────────────────────
  const [procFilters, setProcFilters] = useState<ProcurementFilterState>(
    defaultProcurementFilters,
  );

  // ── Data (usePurchaseOrders) ───────────────────────────────────────────────
  const {
    purchaseOrders,
    actionRequired,
    loading,
    error,
    refetch,
    setSearch,
    setStatus,
    setProjectId,
    setSupplierId,
  } = usePurchaseOrders();

  // Sync procFilters → usePurchaseOrders ogni volta che i filtri cambiano
  useEffect(() => {
    setSearch(procFilters.searchTerm);
    setStatus((procFilters.status[0] as PurchaseOrderStatus) ?? null);
    setProjectId(procFilters.projectId[0] ?? null);
    setSupplierId(procFilters.supplierId[0] ?? null);
  }, [
    procFilters.searchTerm,
    procFilters.status,
    procFilters.projectId,
    procFilters.supplierId,
    setSearch,
    setStatus,
    setProjectId,
    setSupplierId,
  ]);

  // ── Dashboard Stats ────────────────────────────────────────────────────────
  const dashboardStats = useMemo(
    () => buildProcurementDashboardStats(purchaseOrders, t),
    [purchaseOrders, t],
  );

  // ── Dashboard card click → filtro status ──────────────────────────────────
  const handleCardClick = useCallback(
    (stat: DashboardStat) => {
      const titleToStatus: Partial<Record<string, PurchaseOrderStatus>> = {
        [t('kpi.pendingDelivery')]: 'ordered',
        [t('kpi.partialDelivery')]: 'partially_delivered',
        [t('kpi.awaitingInvoice')]: 'delivered',
      };

      const mapped = titleToStatus[stat.title];
      if (mapped !== undefined) {
        // Toggle: se già attivo rimuovi, altrimenti applica
        const currentStatus = procFilters.status[0];
        const next: ProcurementFilterState = {
          ...procFilters,
          status: currentStatus === mapped ? [] : [mapped],
        };
        setProcFilters(next);
      }
    },
    [procFilters, t],
  );

  // ── Selezione PO (split panel) ─────────────────────────────────────────────
  const handleSelectPO = useCallback((po: PurchaseOrder) => {
    setSelectedPO((prev) => (prev?.id === po.id ? null : po));
    setEditMode(false);
  }, []);

  // ── Crea nuovo PO (form inline nel pannello destro) ────────────────────────
  const handleCreateNew = useCallback(() => {
    setSelectedPO(null);
    setEditMode(true);
  }, []);

  // ── Successo creazione: naviga al dettaglio standalone ─────────────────────
  const handleFormSuccess = useCallback(
    (id: string) => {
      setEditMode(false);
      refetch();
      router.push(`/procurement/${id}`);
    },
    [refetch, router],
  );

  // ── Azioni status (approve, order, etc.) ─────────────────────────────────
  const handleAction = useCallback(
    async (action: string, body?: Record<string, unknown>) => {
      if (!selectedPO) return;
      const params = new URLSearchParams({ [QUERY_ACTION]: action });
      await fetch(
        [API_PROCUREMENT, selectedPO.id].join('/') + '?' + params.toString(),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        },
      );
      await refetch();
    },
    [selectedPO, refetch],
  );

  // ── Duplica PO ────────────────────────────────────────────────────────────
  const handleDuplicate = useCallback(
    async (poId: string) => {
      const params = new URLSearchParams({ [QUERY_ACTION]: 'duplicate' });
      const res = await fetch(
        [API_PROCUREMENT, poId].join('/') + '?' + params.toString(),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      await refetch();
      if (json.success && json.data?.id) {
        router.push(`/procurement/${json.data.id}`);
      }
    },
    [refetch, router],
  );

  // ── Annulla edit/create ───────────────────────────────────────────────────
  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
  }, []);

  return {
    // Data
    purchaseOrders,
    actionRequired,
    loading,
    error,
    refetch,

    // Selection
    selectedPO,
    setSelectedPO,
    handleSelectPO,

    // Edit/Create mode
    editMode,
    setEditMode,
    handleCreateNew,
    handleFormSuccess,
    handleCancelEdit,

    // Actions
    handleAction,
    handleDuplicate,

    // UI toggles
    showDashboard,
    setShowDashboard,
    showFilters,
    setShowFilters,

    // Filters
    procFilters,
    setProcFilters,
    handleFiltersChange: setProcFilters,

    // Dashboard
    dashboardStats,
    handleCardClick,

    // i18n
    t,
  };
}
