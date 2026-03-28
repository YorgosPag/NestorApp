'use client';

/**
 * @module useBaselineComparison
 * @enterprise ADR-266 Phase C, Sub-phase 3 — Baseline Snapshots
 *
 * Manages baseline snapshot state for the Schedule Dashboard:
 * - Lists saved baselines (lightweight summaries)
 * - Loads full baseline detail on demand (for comparison)
 * - Provides CRUD operations (create, delete)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getConstructionBaselines,
  getConstructionBaselineDetail,
  createConstructionBaseline,
  deleteConstructionBaseline,
} from '@/components/building-management/construction-services';
import type {
  ConstructionBaseline,
  ConstructionBaselineSummary,
  ConstructionBaselineCreatePayload,
} from '@/types/building/construction';

export interface UseBaselineComparisonReturn {
  /** Lightweight baseline summaries (no embedded phases/tasks) */
  baselines: ConstructionBaselineSummary[];
  /** Currently selected baseline ID (null = no comparison) */
  selectedBaselineId: string | null;
  /** Full baseline data (loaded on demand when selectedBaselineId changes) */
  selectedBaseline: ConstructionBaseline | null;
  /** Whether a baseline is selected for comparison */
  isComparing: boolean;
  /** Loading state for list fetch */
  listLoading: boolean;
  /** Loading state for detail fetch */
  detailLoading: boolean;
  /** Select a baseline for comparison (pass null to clear) */
  setSelectedBaselineId: (id: string | null) => void;
  /** Clear comparison */
  clearComparison: () => void;
  /** Save a new baseline snapshot */
  saveBaseline: (payload: ConstructionBaselineCreatePayload) => Promise<{ success: boolean; error?: string }>;
  /** Delete a baseline snapshot */
  removeBaseline: (baselineId: string) => Promise<{ success: boolean; error?: string }>;
  /** Refresh baseline list */
  refreshList: () => Promise<void>;
}

export function useBaselineComparison(buildingId: string): UseBaselineComparisonReturn {
  const [baselines, setBaselines] = useState<ConstructionBaselineSummary[]>([]);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(null);
  const [selectedBaseline, setSelectedBaseline] = useState<ConstructionBaseline | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // ─── Fetch baseline list on mount ───────────────────────────────────
  const fetchList = useCallback(async () => {
    if (!buildingId) return;
    setListLoading(true);
    try {
      const result = await getConstructionBaselines(buildingId);
      setBaselines(result);
    } finally {
      setListLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  // ─── Fetch full baseline when selection changes ─────────────────────
  useEffect(() => {
    if (!selectedBaselineId || !buildingId) {
      setSelectedBaseline(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    void getConstructionBaselineDetail(buildingId, selectedBaselineId).then((result) => {
      if (!cancelled) {
        setSelectedBaseline(result);
        setDetailLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [selectedBaselineId, buildingId]);

  // ─── Actions ────────────────────────────────────────────────────────
  const clearComparison = useCallback(() => {
    setSelectedBaselineId(null);
    setSelectedBaseline(null);
  }, []);

  const saveBaseline = useCallback(async (payload: ConstructionBaselineCreatePayload) => {
    const result = await createConstructionBaseline(buildingId, payload);
    if (result.success) {
      await fetchList();
    }
    return result;
  }, [buildingId, fetchList]);

  const removeBaseline = useCallback(async (baselineId: string) => {
    const result = await deleteConstructionBaseline(buildingId, baselineId);
    if (result.success) {
      if (selectedBaselineId === baselineId) {
        clearComparison();
      }
      await fetchList();
    }
    return result;
  }, [buildingId, fetchList, selectedBaselineId, clearComparison]);

  return {
    baselines,
    selectedBaselineId,
    selectedBaseline,
    isComparing: selectedBaselineId !== null,
    listLoading,
    detailLoading,
    setSelectedBaselineId,
    clearComparison,
    saveBaseline,
    removeBaseline,
    refreshList: fetchList,
  };
}
