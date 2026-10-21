'use client';

/**
 * useProjectBudgetLines — the ONE client of `/api/projects/[projectId]/budget-lines` (ADR-917 Φ3γ).
 *
 * - **Optimistic**: what the human types shows at once (`budget-lines-optimistic` overlay); the server's
 *   `line` replaces it on answer; a failure drops it (rollback).
 * - **Compare-and-set**: `expectedRevision` comes ONLY from the confirmed layer — never guessed.
 * - **One write per code at a time**: a second edit waits for the first, so it sends the revision the first
 *   one produced (an editor never conflicts with itself).
 * - **409** ⇒ re-read + the human's version kept as a conflict to resolve · **403** ⇒ read-only.
 * - `Idempotency-Key` is added by `apiClient` (ADR-872): a retried PUT/DELETE runs once.
 * - Every confirmed change invalidates the project's cost ledger (the card never shows the old budget).
 *
 * @module hooks/useProjectBudgetLines
 * @see ADR-917 Φ3β (routes) · Φ3γ (editor)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import {
  budgetLineConflicts,
  confirm,
  dismissConflict,
  displayedBudgetLines,
  EMPTY_BUDGET_LINES,
  expectedRevisionOf,
  markConflict,
  replaceConfirmed,
  rollback,
  withOverlay,
  type BudgetLineValues,
  type BudgetLinesSnapshot,
  type ConfirmedBudgetLine,
  type OverlayEntry,
} from '@/services/project-cost/budget-lines-optimistic';
import { invalidateProjectCostLedger } from '@/hooks/useProjectCostLedger';

export type BudgetLineWriteResult = 'saved' | 'conflict' | 'forbidden' | 'invalid' | 'failed';

interface LinesResponse { lines: ConfirmedBudgetLine[] }
interface WriteResponse { outcome: 'changed' | 'unchanged'; line: ConfirmedBudgetLine | null }

function classifyFailure(error: unknown): Exclude<BudgetLineWriteResult, 'saved'> {
  if (!ApiClientError.isApiClientError(error)) return 'failed';
  if (error.statusCode === 409) return 'conflict';
  if (error.statusCode === 403) return 'forbidden';
  if (error.statusCode === 400) return 'invalid';
  return 'failed';
}

function sendWrite(projectId: string, costCode: string, next: OverlayEntry, expectedRevision: number) {
  const url = API_ROUTES.PROJECTS.BUDGET_LINE(projectId, costCode);
  return next === null
    ? apiClient.delete<WriteResponse>(`${url}?expectedRevision=${expectedRevision}`)
    : apiClient.put<WriteResponse>(url, { amount: next.amount, note: next.note, expectedRevision });
}

/** Snapshot in state AND in a ref: writes read the latest confirmed revision at SEND time, not at render. */
function useSnapshot() {
  const [snapshot, setSnapshot] = useState<BudgetLinesSnapshot>(EMPTY_BUDGET_LINES);
  const ref = useRef(snapshot);
  const update = useCallback((change: (current: BudgetLinesSnapshot) => BudgetLinesSnapshot) => {
    ref.current = change(ref.current);
    setSnapshot(ref.current);
  }, []);
  return { snapshot, ref, update };
}

function useLinesLoader(projectId: string | null, update: ReturnType<typeof useSnapshot>['update']) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const generation = useRef(0);

  const reload = useCallback(async (): Promise<boolean> => {
    if (!projectId) return false;
    const mine = ++generation.current;
    try {
      const { lines } = await apiClient.get<LinesResponse>(API_ROUTES.PROJECTS.BUDGET_LINES(projectId));
      if (mine !== generation.current) return false;
      update(current => replaceConfirmed(current, lines));
      setLoadError(false);
      return true;
    } catch {
      if (mine === generation.current) setLoadError(true);
      return false;
    }
  }, [projectId, update]);

  useEffect(() => {
    update(() => EMPTY_BUDGET_LINES);
    if (!projectId) return;
    setLoading(true);
    void reload().finally(() => setLoading(false));
  }, [projectId, reload, update]);

  return { loading, loadError, reload };
}

type SnapshotHandle = ReturnType<typeof useSnapshot>;

/** The write path: overlay → per-code queue → CAS request → confirm / conflict / rollback. */
function useBudgetLineWriter(projectId: string | null, { ref, update }: SnapshotHandle, reload: () => Promise<boolean>) {
  const [readOnly, setReadOnly] = useState(false);
  const queues = useRef(new Map<string, Promise<unknown>>());

  const commit = useCallback(async (id: string, costCode: string, next: OverlayEntry): Promise<BudgetLineWriteResult> => {
    try {
      const { line } = await sendWrite(id, costCode, next, expectedRevisionOf(ref.current, costCode));
      update(current => confirm(current, costCode, line));
      invalidateProjectCostLedger(id);
      return 'saved';
    } catch (error) {
      const failure = classifyFailure(error);
      update(current => (failure === 'conflict' ? markConflict(current, costCode) : rollback(current, costCode)));
      if (failure === 'conflict') await reload();
      if (failure === 'forbidden') setReadOnly(true);
      return failure;
    }
  }, [ref, update, reload]);

  const write = useCallback((costCode: string, next: OverlayEntry): Promise<BudgetLineWriteResult> => {
    if (!projectId) return Promise.resolve('failed');
    update(current => withOverlay(current, costCode, next));
    const previous = queues.current.get(costCode) ?? Promise.resolve();
    const run = previous.then(() => commit(projectId, costCode, next));
    queues.current.set(costCode, run.catch(() => undefined));
    return run;
  }, [projectId, update, commit]);

  return { write, readOnly };
}

export function useProjectBudgetLines(projectId: string | null) {
  const handle = useSnapshot();
  const { snapshot, ref, update } = handle;
  const { loading, loadError, reload } = useLinesLoader(projectId, update);
  const { write, readOnly } = useBudgetLineWriter(projectId, handle, reload);

  const setLine = useCallback((costCode: string, values: BudgetLineValues) => write(costCode, values), [write]);
  const archiveLine = useCallback((costCode: string) => write(costCode, null), [write]);

  /** Conflict: «keep mine» re-sends the human's values on the revision just read; «keep theirs» closes it. */
  const resolveConflict = useCallback((costCode: string, keep: 'mine' | 'theirs') => {
    const mine = ref.current.conflicts.get(costCode);
    update(current => dismissConflict(current, costCode));
    if (keep === 'mine' && mine !== undefined) void write(costCode, mine);
  }, [ref, update, write]);

  const lines = useMemo(() => displayedBudgetLines(snapshot), [snapshot]);
  const conflicts = useMemo(() => budgetLineConflicts(snapshot), [snapshot]);
  const usedCodes = useMemo(() => new Set(lines.map(line => line.costCode)), [lines]);

  return { lines, conflicts, usedCodes, loading, loadError, readOnly, setLine, archiveLine, resolveConflict, reload };
}
