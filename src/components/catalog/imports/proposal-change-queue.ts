'use client';

/**
 * @fileoverview **Αισιόδοξες αποφάσεις, σειριακά στον διακομιστή** (ADR-923 §5.5.2 Α5).
 * @module components/catalog/imports/proposal-change-queue
 *
 * 🔑 **Η οθόνη αλλάζει αμέσως, ο διακομιστής κρίνει με τη σειρά.** Κάθε αλλαγή πρότασης κουβαλά CAS (`expectedRevision`):
 *    δύο γρήγορα κλικ με την ίδια αναθεώρηση έδιναν 409 στο δεύτερο. Εδώ οι αλλαγές μιας πρότασης μπαίνουν σε **ουρά** και η
 *    καθεμία στέλνεται με την αναθεώρηση που επέστρεψε η προηγούμενη. Η απόφαση είναι κατάσταση, όχι εναλλαγή, άρα η
 *    επανάληψη είναι ιδεμπότητη.
 * 🔑 **Επικάλυψη, όχι μαντεψιά.** Ό,τι περιμένει στην ουρά ζωγραφίζεται πάνω από την τελευταία απάντηση του διακομιστή
 *    (`overlayDecisions`), ώστε μια απάντηση ή μια επαναφόρτωση να μη σβήνει απόφαση που δεν έχει φτάσει ακόμη.
 * 🔑 **Αποτυχία ⇒ επαναφορά.** Οι υπόλοιπες αλλαγές της πρότασης πατούσαν πάνω σε κατάσταση που δεν ισχύει: πετιούνται, και
 *    η οθόνη ξαναδιαβάζει την αλήθεια του διακομιστή.
 * 🔑 Η έγκριση και η απόρριψη μπαίνουν στην **ίδια** ουρά: «Έγκριση» αμέσως μετά από απόφαση περιμένει να αποθηκευτεί εκείνη.
 * 🔑 Και η **απόφαση γραμμής** (§5.5.2 Β3 Γ6): η ξαναερμηνεία του πίνακα αλλάζει την αναθεώρηση της πρότασης, άρα απόφαση πεδίου
 *    που περιμένει πίσω της στέλνεται με τη **νέα**. Η απάντηση φέρνει όλη την όψη (και την παρτίδα, με τις γραμμές της).
 */

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import {
  applyImportProposal,
  rejectImportProposal,
  setImportLine,
  updateImportProposal,
} from '@/services/catalog/catalog-import-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type {
  ImportBatchDetailView,
  ImportFieldDecisionInput,
  ImportFieldEditInput,
  ImportLineOutcome,
  ImportProposalWire,
  SetImportLineRequest,
} from '@/subapps/catalog/types/catalog-import-requests';

export interface ProposalChange {
  readonly decisions?: readonly ImportFieldDecisionInput[];
  readonly edits?: readonly ImportFieldEditInput[];
  readonly modelCode?: string | null;
}

/** Η διόρθωση ενός πεδίου (§5.5.2 Β6) — **ένα** σχήμα για την κάρτα του πεδίου και το «Κράτα» του popover του PDF (Β8 βήμα Β). */
export const fieldEditChange = (
  row: Pick<ImportProposalWire['rows'][number], 'rowKey'>,
  field: Pick<ImportProposalWire['rows'][number]['fields'][number], 'target'>,
  text: string,
): ProposalChange => ({ edits: [{ rowKey: row.rowKey, targetKey: importTargetKey(field.target), text }] });

type QueuedWork = (expectedRevision: number) => Promise<ImportProposalWire>;

/** Οι αποφάσεις που περιμένουν, ανά πρόταση: ό,τι ζωγραφίζεται πάνω από την απάντηση του διακομιστή. */
export type QueuedDecisions = ReadonlyMap<string, readonly ImportFieldDecisionInput[]>;

const fieldAddress = (rowKey: string, targetKey: string): string => `${rowKey}\u0000${targetKey}`;

/**
 * Η πρόταση όπως θα είναι όταν φτάσουν οι αποφάσεις. Ίδιος κανόνας με τον γραφέα: τιμή που δεν διαβάστηκε δεν γίνεται αποδεκτή.
 */
export function overlayDecisions(proposal: ImportProposalWire, decisions: readonly ImportFieldDecisionInput[]): ImportProposalWire {
  if (decisions.length === 0) return proposal;
  const wanted = new Map(decisions.map((input) => [fieldAddress(input.rowKey, input.targetKey), input.decision]));
  const rows = proposal.rows.map((row) => ({
    ...row,
    fields: row.fields.map((field) => {
      const decision = wanted.get(fieldAddress(row.rowKey, importTargetKey(field.target)));
      if (decision === undefined || (decision === 'accept' && field.incoming === null)) return field;
      return { ...field, decision, decisionBy: 'human' as const };
    }),
  }));
  return { ...proposal, rows };
}

/** Κάθε πρόταση της όψης με τις αποφάσεις της ουράς από πάνω. */
export function overlayView(view: ImportBatchDetailView, queued: QueuedDecisions): ImportBatchDetailView {
  if (queued.size === 0) return view;
  return { ...view, proposals: view.proposals.map((proposal) => overlayDecisions(proposal, queued.get(proposal.id) ?? [])) };
}

export interface QueueState {
  readonly chains: Map<string, Promise<void>>;
  readonly revisions: Map<string, number>;
  readonly decisions: Map<string, ImportFieldDecisionInput[]>;
  readonly generations: Map<string, number>;
}

type SetView = Dispatch<SetStateAction<ImportBatchDetailView | null>>;
type SetFailure = (failure: CatalogFailure | null) => void;

interface QueueDeps {
  readonly setView: SetView;
  readonly setFailure: SetFailure;
  readonly reload: () => Promise<void>;
  readonly queued: { current: QueueState };
}

/** Η κατάσταση της ουράς ζει σε ref του γονικού hook: τη διαβάζει και η επαναφόρτωση (`overlayView`). */
export function createQueueState(): QueueState {
  return { chains: new Map(), revisions: new Map(), decisions: new Map(), generations: new Map() };
}

export const queuedDecisionsOf = (state: QueueState): QueuedDecisions => state.decisions;

function useSavingSet() {
  const [saving, setSaving] = useState<ReadonlySet<string>>(() => new Set());
  const counts = useRef(new Map<string, number>());
  const bump = useCallback((id: string, delta: number): number => {
    const next = (counts.current.get(id) ?? 0) + delta;
    if (next <= 0) counts.current.delete(id); else counts.current.set(id, next);
    setSaving(new Set(counts.current.keys()));
    return next;
  }, []);
  return { saving, bump };
}

type Enqueue = (proposal: ImportProposalWire, decisions: readonly ImportFieldDecisionInput[], work: QueuedWork) => Promise<void>;

/** Η απόφαση γραμμής ξαναερμηνεύει τον πίνακα της πρότασης. `null` = απέτυχε η μεταφορά (το μήνυμα το δείχνει η όψη). */
function useQueuedLine(enqueue: Enqueue, setView: SetView, queued: { current: QueueState }) {
  return useCallback(async (proposal: ImportProposalWire, request: SetImportLineRequest): Promise<ImportLineOutcome | null> => {
    const answer: { outcome: ImportLineOutcome | null } = { outcome: null };
    await enqueue(proposal, [], async () => {
      const result = await setImportLine(proposal.batchId, request);
      answer.outcome = result.outcome;
      setView(() => overlayView(result.view, queued.current.decisions));
      return result.view.proposals.find((item) => item.id === proposal.id) ?? proposal;
    });
    return answer.outcome;
  }, [enqueue, queued, setView]);
}

export function useProposalChangeQueue({ setView, setFailure, reload, queued }: QueueDeps) {
  const { saving, bump } = useSavingSet();

  const settle = useCallback((id: string, next: ImportProposalWire, decisions: readonly ImportFieldDecisionInput[]) => {
    const state = queued.current;
    state.revisions.set(id, next.revision);
    const rest = (state.decisions.get(id) ?? []).slice(decisions.length);
    if (rest.length === 0) state.decisions.delete(id); else state.decisions.set(id, rest);
    setView((current) => current && { ...current, proposals: current.proposals.map((proposal) => (proposal.id === id ? overlayDecisions(next, rest) : proposal)) });
  }, [queued, setView]);

  const fail = useCallback((id: string, cause: unknown) => {
    const state = queued.current;
    state.generations.set(id, (state.generations.get(id) ?? 0) + 1);
    state.decisions.delete(id);
    setFailure(catalogFailureOf(cause));
  }, [queued, setFailure]);

  const enqueue = useCallback((proposal: ImportProposalWire, decisions: readonly ImportFieldDecisionInput[], work: QueuedWork): Promise<void> => {
    const state = queued.current;
    const { id } = proposal;
    const generation = state.generations.get(id) ?? 0;
    setFailure(null);
    bump(id, 1);
    const step = async (): Promise<void> => {
      if ((state.generations.get(id) ?? 0) !== generation) return;
      try {
        const revision = Math.max(state.revisions.get(id) ?? 0, proposal.revision);
        settle(id, await work(revision), decisions);
      } catch (cause) {
        fail(id, cause);
      }
    };
    const chain = (state.chains.get(id) ?? Promise.resolve()).then(step).finally(async () => {
      if (bump(id, -1) === 0) await reload();
    });
    state.chains.set(id, chain);
    return chain;
  }, [bump, fail, queued, reload, setFailure, settle]);

  const change = useCallback((proposal: ImportProposalWire, input: ProposalChange): Promise<void> => {
    const decisions = input.decisions ?? [];
    if (decisions.length > 0) {
      const state = queued.current;
      state.decisions.set(proposal.id, [...(state.decisions.get(proposal.id) ?? []), ...decisions]);
      setView((current) => current && { ...current, proposals: current.proposals.map((item) => (item.id === proposal.id ? overlayDecisions(item, decisions) : item)) });
    }
    return enqueue(proposal, decisions, (expectedRevision) =>
      updateImportProposal(proposal.id, { expectedRevision, decisions, edits: input.edits ?? [], modelCode: input.modelCode ?? null }));
  }, [enqueue, queued, setView]);

  const apply = useCallback((proposal: ImportProposalWire) => enqueue(proposal, [], (revision) => applyImportProposal(proposal.id, revision)), [enqueue]);
  const reject = useCallback((proposal: ImportProposalWire) => enqueue(proposal, [], (revision) => rejectImportProposal(proposal.id, revision)), [enqueue]);
  const line = useQueuedLine(enqueue, setView, queued);
  return { change, apply, reject, line, saving };
}
