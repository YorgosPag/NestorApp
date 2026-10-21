'use client';

/**
 * useExpenseCostAllocations — the ONE client of `…/cost-allocations` (ADR-917 Φ4)
 *
 * - Reads the stored lines + `revision` + coverage + the proposal from a PO (never stored by the read).
 * - `save(lines)` sends the revision the human SAW (compare-and-set): 409 ⇒ re-read, the human's draft is kept
 *   by the caller and the conflict is said — nobody's allocation is silently overwritten.
 * - Success ⇒ the ledger of every affected project (before ∪ after) is invalidated, so an open card re-reads.
 * - `Idempotency-Key` is added by `apiClient` (ADR-872): a retried PUT runs once.
 *
 * @module subapps/accounting/hooks/useExpenseCostAllocations
 * @see ADR-917 §4 Γ1
 */

import { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { invalidateProjectCostLedger } from '@/hooks/useProjectCostLedger';
import { allocatedProjectIdsOf, type AllocationCoverage } from '@/services/project-cost/expense-allocation';
import type { PurchaseOrderStatus } from '@/types/procurement';
import type { ExpenseCostAllocation } from '../types/documents';

export interface AllocationProposal {
  purchaseOrder: { id: string; poNumber: string; projectId: string; status: PurchaseOrderStatus };
  lines: ExpenseCostAllocation[];
}

interface ExpenseCostAllocationState {
  lines: ExpenseCostAllocation[];
  revision: number;
  netAmount: number | null;
  coverage: AllocationCoverage;
  proposal: AllocationProposal | null;
  /** `poId → poNumber` for the POs the stored lines name */
  purchaseOrderNumbers: Record<string, string>;
}

type AllocationSaveResult = 'saved' | 'conflict' | 'invalid' | 'failed';

interface WriteResponse { outcome: 'changed' | 'unchanged'; lines: ExpenseCostAllocation[]; revision: number }

function classifySaveFailure(error: unknown): Exclude<AllocationSaveResult, 'saved'> {
  if (!ApiClientError.isApiClientError(error)) return 'failed';
  if (error.statusCode === 409) return 'conflict';
  if (error.statusCode === 400) return 'invalid';
  return 'failed';
}

export function useExpenseCostAllocations(documentId: string | null) {
  const [state, setState] = useState<ExpenseCostAllocationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (purchaseOrderId?: string) => {
    if (!documentId) return;
    setLoading(true);
    try {
      const query = purchaseOrderId ? `?purchaseOrderId=${encodeURIComponent(purchaseOrderId)}` : '';
      setState(await apiClient.get<ExpenseCostAllocationState>(`${API_ROUTES.ACCOUNTING.DOCUMENTS.COST_ALLOCATIONS(documentId)}${query}`));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (lines: ExpenseCostAllocation[]): Promise<AllocationSaveResult> => {
    if (!documentId || state === null) return 'failed';
    setSaving(true);
    try {
      const url = API_ROUTES.ACCOUNTING.DOCUMENTS.COST_ALLOCATIONS(documentId);
      const written = await apiClient.put<WriteResponse>(url, { lines, expectedRevision: state.revision });
      allocatedProjectIdsOf([...state.lines, ...written.lines]).forEach(invalidateProjectCostLedger);
      await load(state.proposal?.purchaseOrder.id);
      return 'saved';
    } catch (error) {
      const result = classifySaveFailure(error);
      if (result === 'conflict') await load(state.proposal?.purchaseOrder.id);
      return result;
    } finally {
      setSaving(false);
    }
  }, [documentId, state, load]);

  return { state, loading, loadFailed, saving, save, proposeFrom: load };
}
