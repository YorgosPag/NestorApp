'use client';

/**
 * ExpenseCostAllocationSection — which project + cost code an expense document pays for (ADR-917 Φ4 · §4 Γ1).
 *
 * - Coverage ALWAYS stated: «not allocated» / «X of Y» / «fully» / «more than the net» / «net unknown» — never
 *   an implied 0 €.
 * - Proposal from the order (suggested, or found here) → draft → the human saves. Direct costs by hand.
 * - Save = compare-and-set: on a conflict the current allocation is re-read and the human's draft STAYS in the
 *   form (Gmail-style «your version is kept»), never silently replaced.
 *
 * @module subapps/accounting/components/documents/ExpenseCostAllocationSection
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/intl-utils';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import type { AllocationCoverage } from '@/services/project-cost/expense-allocation';
import type { ReceivedExpenseDocument } from '../../types/documents';
import { useExpenseCostAllocations, type AllocationProposal } from '../../hooks/useExpenseCostAllocations';
import {
  addDirectDraftLine,
  editDraftAmount,
  removeDraftLine,
  resolveDraft,
  toDraftLines,
  type AllocationDraftLine,
  type AllocationDraftProblem,
  type DirectLineInput,
} from './expense-allocation-draft';
import { ExpenseAllocationAddForm } from './ExpenseAllocationAddForm';
import { ExpenseAllocationLinesTable } from './ExpenseAllocationLinesTable';
import { ExpenseAllocationProposal } from './ExpenseAllocationProposal';

type Translate = (key: string, options?: Record<string, unknown>) => string;

type Notice =
  | { kind: 'saved' } | { kind: 'conflict' } | { kind: 'invalid' } | { kind: 'failed' }
  | { kind: 'problem'; problem: AllocationDraftProblem } | { kind: 'add'; error: 'missingFields' | 'duplicate' };

function coverageText(coverage: AllocationCoverage, net: number | null, t: Translate): string {
  return t(`documents.allocation.coverage.${coverage.state}`, {
    allocated: formatCurrency(coverage.allocated),
    net: net === null ? '' : formatCurrency(net),
    remaining: coverage.unallocated === null ? '' : formatCurrency(coverage.unallocated),
  });
}

function noticeText(notice: Notice, t: Translate): string {
  if (notice.kind === 'saved') return t('documents.allocation.saved');
  if (notice.kind === 'add') return t(`documents.allocation.errors.${notice.error}`);
  if (notice.kind !== 'problem') return t(`documents.allocation.errors.${notice.kind}`);
  const { problem } = notice;
  if (problem.kind === 'exceeds') {
    return t('documents.allocation.errors.exceeds', { allocated: formatCurrency(problem.allocated), net: formatCurrency(problem.net) });
  }
  return t(`documents.allocation.errors.${problem.kind === 'duplicate' ? 'duplicate' : problem.kind === 'amount' ? 'amount' : 'invalid'}`);
}

/**
 * The draft follows the STORED lines when their revision changes (first read, a save) — not on every re-read
 * (asking another order for a proposal must not wipe what the human typed), and not right after a conflict,
 * when the human's version is kept.
 */
function useAllocationEditor(documentId: string) {
  const allocations = useExpenseCostAllocations(documentId);
  const { state, save } = allocations;
  const [draft, setDraft] = useState<AllocationDraftLine[]>([]);
  const [keepDraft, setKeepDraft] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const syncedRevision = useRef<number | null>(null);
  useEffect(() => {
    if (state === null || keepDraft || syncedRevision.current === state.revision) return;
    syncedRevision.current = state.revision;
    setDraft(toDraftLines(state.lines));
  }, [state, keepDraft]);

  const change = (next: AllocationDraftLine[]) => { setDraft(next); setNotice(null); };
  const addLine = (input: DirectLineInput) => {
    const result = addDirectDraftLine(draft, input);
    if ('error' in result) { setNotice({ kind: 'add', error: result.error }); return false; }
    change(result.draft);
    return true;
  };
  const submit = async () => {
    if (state === null) return;
    const resolved = resolveDraft(draft, state.netAmount);
    if (!resolved.ok) { setNotice({ kind: 'problem', problem: resolved.problem }); return; }
    const result = await save(resolved.lines);
    setKeepDraft(result === 'conflict');
    setNotice({ kind: result });
  };
  return { ...allocations, draft, notice, change, addLine, submit };
}

function useProjectNames(): ReadonlyMap<string, string> {
  const { projects } = useFirestoreProjects();
  return useMemo(() => new Map(projects.map((project) => [project.id, project.name || project.title || project.id])), [projects]);
}

/** Stored lines' orders + the proposal's order — the table never shows a raw id */
function orderNumbersOf(stored: Readonly<Record<string, string>>, proposal: AllocationProposal | null): Record<string, string> {
  return proposal ? { ...stored, [proposal.purchaseOrder.id]: proposal.purchaseOrder.poNumber } : { ...stored };
}

export function ExpenseCostAllocationSection({ document, t }: { document: ReceivedExpenseDocument; t: Translate }) {
  const editor = useAllocationEditor(document.documentId);
  const projectNames = useProjectNames();
  const { state, saving, draft, notice, change } = editor;
  const headingId = `allocation-${document.documentId}`;

  if (editor.loadFailed) return <p role="alert" className="text-sm text-destructive">{t('documents.allocation.loadFailed')}</p>;
  if (state === null) return null;

  return (
    <section className="space-y-3 border-t border-border pt-4" aria-labelledby={headingId}>
      <header>
        <h3 id={headingId} className="text-sm font-semibold text-foreground">{t('documents.allocation.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('documents.allocation.intro')}</p>
        <p className="text-sm">{coverageText(state.coverage, state.netAmount, t)}</p>
      </header>
      <ExpenseAllocationProposal documentId={document.documentId} proposal={state.proposal} disabled={saving}
        onAccept={(proposal) => change(toDraftLines(proposal.lines))} onChoosePurchaseOrder={(poId) => void editor.proposeFrom(poId)} t={t} />
      <ExpenseAllocationLinesTable lines={draft} projectNames={projectNames} purchaseOrderNumbers={orderNumbersOf(state.purchaseOrderNumbers, state.proposal)}
        disabled={saving} onAmountChange={(index, text) => change(editDraftAmount(draft, index, text))} onRemove={(index) => change(removeDraftLine(draft, index))} t={t} />
      <ExpenseAllocationAddForm disabled={saving} onAdd={editor.addLine} t={t} />
      <footer className="flex items-center justify-end gap-3">
        {notice ? <p role={notice.kind === 'saved' ? 'status' : 'alert'} className="text-sm">{noticeText(notice, t)}</p> : null}
        <Button onClick={() => void editor.submit()} disabled={saving}>{t(saving ? 'documents.allocation.saving' : 'documents.allocation.save')}</Button>
      </footer>
    </section>
  );
}
