/**
 * =============================================================================
 * useAddressReconciliation — Pattern B hook (ADR-332 Phase 2, Layer 4)
 * =============================================================================
 *
 * Wraps `diffAddressFields` and tracks per-field "apply resolved" / "keep user"
 * decisions for the Reconciliation Panel (Phase 4).
 *
 * The hook is purely state-management. It produces:
 *   - the original conflict snapshot (stable until inputs change)
 *   - the still-pending conflicts (those without a decision yet)
 *   - the merged `ResolvedAddressFields` after applying the decisions
 *
 * Decisions auto-clear when either `userInput` or `resolved` reference changes,
 * so a fresh geocoding round starts from a clean slate.
 *
 * @module components/shared/addresses/editor/hooks/useAddressReconciliation
 * @see ADR-332 §3.5 Reconciliation logic
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { diffAddressFields } from '../helpers/diffAddressFields';
import type { AddressFieldConflict, ResolvedAddressFields } from '../types';

export type ReconciliationDecision = 'apply' | 'keep';

export type ReconciliationDecisionMap = Partial<
  Record<keyof ResolvedAddressFields, ReconciliationDecision>
>;

export interface UseAddressReconciliationResult {
  /** Stable snapshot of all conflicts produced by the diff. */
  conflicts: AddressFieldConflict[];
  /** Conflicts not yet decided. */
  pending: AddressFieldConflict[];
  decisions: ReconciliationDecisionMap;
  /** True once every conflict has a decision. */
  resolved: boolean;
  /** User input merged with `apply` decisions; `keep` and undecided fields retain user value. */
  merged: ResolvedAddressFields;
  applyField: (field: keyof ResolvedAddressFields) => void;
  keepField: (field: keyof ResolvedAddressFields) => void;
  applyAll: () => void;
  keepAll: () => void;
  reset: () => void;
}

function fieldsKey(input: ResolvedAddressFields): string {
  return [
    input.street,
    input.number,
    input.postalCode,
    input.neighborhood,
    input.city,
    input.county,
    input.region,
    input.country,
  ].join('|');
}

export function useAddressReconciliation(
  userInput: ResolvedAddressFields,
  resolved: ResolvedAddressFields,
): UseAddressReconciliationResult {
  const inputsKey = `${fieldsKey(userInput)}::${fieldsKey(resolved)}`;
  const lastKeyRef = useRef<string>(inputsKey);

  const conflicts = useMemo(
    () => diffAddressFields(userInput, resolved),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputsKey],
  );

  const [decisions, setDecisions] = useState<ReconciliationDecisionMap>({});

  // Auto-reset decisions when inputs change.
  useEffect(() => {
    if (lastKeyRef.current !== inputsKey) {
      lastKeyRef.current = inputsKey;
      setDecisions({});
    }
  }, [inputsKey]);

  const applyField = useCallback((field: keyof ResolvedAddressFields) => {
    setDecisions((prev) => ({ ...prev, [field]: 'apply' }));
  }, []);

  const keepField = useCallback((field: keyof ResolvedAddressFields) => {
    setDecisions((prev) => ({ ...prev, [field]: 'keep' }));
  }, []);

  const applyAll = useCallback(() => {
    setDecisions(() => {
      const next: ReconciliationDecisionMap = {};
      for (const c of conflicts) next[c.field] = 'apply';
      return next;
    });
  }, [conflicts]);

  const keepAll = useCallback(() => {
    setDecisions(() => {
      const next: ReconciliationDecisionMap = {};
      for (const c of conflicts) next[c.field] = 'keep';
      return next;
    });
  }, [conflicts]);

  const reset = useCallback(() => setDecisions({}), []);

  const pending = useMemo(
    () => conflicts.filter((c) => !decisions[c.field]),
    [conflicts, decisions],
  );

  const merged = useMemo<ResolvedAddressFields>(() => {
    const out: ResolvedAddressFields = { ...userInput };
    for (const conflict of conflicts) {
      if (decisions[conflict.field] === 'apply') {
        out[conflict.field] = conflict.resolvedValue;
      }
    }
    return out;
  }, [userInput, conflicts, decisions]);

  const resolved_ = pending.length === 0 && conflicts.length > 0;

  return {
    conflicts,
    pending,
    decisions,
    resolved: resolved_,
    merged,
    applyField,
    keepField,
    applyAll,
    keepAll,
    reset,
  };
}
