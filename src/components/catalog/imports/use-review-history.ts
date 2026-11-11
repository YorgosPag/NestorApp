'use client';

/**
 * @fileoverview **Αναίρεση / επανάληψη στην οθόνη ελέγχου εισαγωγής** (ADR-923 §5.5.2 Β9β · Β9δ).
 * @module components/catalog/imports/use-review-history
 *
 * 🔑 **Μία στοίβα ανά άνθρωπο και οθόνη** (Figma · Revit): η γενική `grid-history` (όριο 100, §5.10.4 Β1), με βήματα
 *    `review-history`. Ζει στη μνήμη της καρτέλας — όπως σε κάθε επεξεργαστή, η επαναφόρτωση ξεκινά καθαρή στοίβα.
 * 🔑 **Καταγραφή σε ΔΥΟ σημεία, ένα ανά πόρτα**: τυλίγει το `change` της ουράς (πεδία · κωδικός μοντέλου) και το `decideLine`
 *    (απόφαση γραμμής, Β9δ). Κάθε δρόμος (κουμπιά λίστας · popover του PDF · «Αποδοχή γραμμής» · διορθωτικές ενέργειες) γράφεται
 *    χωρίς να το ξέρει. Η αναίρεση στέλνει από την **ίδια** πόρτα, χωρίς καταγραφή.
 * 🔑 **Η αναίρεση κρίνει την πιο φρέσκια εικόνα.** Όσο αλλαγές ταξιδεύουν προς τον διακομιστή, το αίτημα περιμένει: μια
 *    διόρθωση που δεν έχει επιστρέψει ακόμη θα έμοιαζε «αλλαγμένη από άλλον». Τα αιτήματα εκτελούνται με τη σειρά, ένα-ένα — και
 *    η αναίρεση γραμμής κρατά την ουρά μέχρι να μάθει τις συνέπειές της (Δ), που μπαίνουν **πρώτες**.
 * 🔑 **Πληκτρολόγιο**: `Ctrl/Cmd+Z` · `Ctrl/Cmd+Shift+Z` · `Ctrl/Cmd+Y` από τη μία ερμηνεία (`historyDirectionOf`, φυσική θέση —
 *    ελληνική διάταξη). Ποιος δικαιούται το πλήκτρο το λέει η μία πύλη (`shouldGlobalShortcutYield`, ADR-711): σε πεδίο κειμένου
 *    ή ανοιχτό διάλογο το `Ctrl+Z` μένει εκεί.
 * 🔑 **Β9γ**: η ομαδική πράξη («Αποδοχή γραμμής») ανακοινώνεται με toast «Αναίρεση» (`useReviewUndoToast`), που αναιρεί από
 *    την ΙΔΙΑ ουρά — και μόνο αν το βήμα του είναι ακόμη στην κορυφή (`expected`).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { shouldGlobalShortcutYield } from '@/lib/a11y/keyboard-scope';
import {
  canRedo,
  canUndo,
  emptyHistory,
  recordHistory,
  redoHistory,
  replaceHistoryEntry,
  undoHistory,
  type History,
} from '@/lib/spreadsheet/grid-history';
import { historyDirectionOf, type HistoryDirection } from '@/lib/spreadsheet/grid-key-intent';
import { useNotifications } from '@/providers/NotificationProvider';
import type { ImportBatchDetailView, ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { useImportText } from './import-text';
import type { ProposalChange } from './proposal-change-queue';
import { isGroupStep, planFieldMarks, reviewStepOf, type FieldFollowUp, type ReviewSend, type ReviewStep, type ReviewStepLabel, type ReviewStepPlan } from './review-history';
import { lineStepOf, settledLineStep } from './review-history-line';
import { planReviewStep } from './review-history-plan';
import type { SendLine } from './use-line-decisions';
import { useReviewUndoToast, type ReviewEntry } from './use-review-undo-toast';

type Change = (proposal: ImportProposalWire, input: ProposalChange) => Promise<void>;

/** Οι δύο πόρτες προς τον διακομιστή — οι ίδιες για την πράξη και για την αναίρεσή της. */
interface Doors {
  readonly change: Change;
  readonly decideLine: SendLine;
}

/**
 * Ένα αίτημα της ουράς. `travel`: αναίρεση/επανάληψη — `expected` (Β9γ, κουμπί του toast) ⇒ εκτελείται ΜΟΝΟ αν αυτό το βήμα είναι
 * ακόμη στην κορυφή. `follow` (Β9δ Δ): οι αποφάσεις πεδίων που επαναφέρονται **μετά** την ξαναερμηνεία ενός πίνακα.
 */
type HistoryRequest =
  | { readonly kind: 'travel'; readonly direction: HistoryDirection; readonly expected?: ReviewEntry }
  | { readonly kind: 'follow'; readonly followUp: FieldFollowUp };

export interface ReviewHistory {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Το όνομα του βήματος που θα αναιρεθεί / επαναληφθεί (λίστα αναίρεσης του Revit) — `null` = κανένα. */
  readonly nextUndo: ReviewStepLabel | null;
  readonly nextRedo: ReviewStepLabel | null;
  readonly undo: () => void;
  readonly redo: () => void;
}

/** Η κίνηση της γενικής στοίβας, ειπωμένη ως «από ποια πλευρά φεύγουμε, σε ποια πάμε». */
function travelOf(history: History<ReviewStep>, direction: HistoryDirection) {
  const step = direction === 'undo' ? undoHistory(history) : redoHistory(history);
  if (!step.entry) return null;
  const [from, to] = direction === 'undo' ? [step.entry.after, step.entry.before] : [step.entry.before, step.entry.after];
  return { from, to, next: step.history };
}

/** Το κείμενο της παράλειψης, ανά είδος: «πεδίο», «κωδικός μοντέλου», «γραμμή». */
const SKIPPED_KEYS: Readonly<Record<ReviewStep['kind'], string>> = {
  fields: 'review.history.skipped',
  modelCode: 'review.history.skippedModelCode',
  line: 'review.history.skippedLine',
};

interface Planned {
  readonly plan: ReviewStepPlan;
  readonly kind: ReviewStep['kind'];
  /** Η στοίβα μετά την κίνηση · `null` = το αίτημα δεν κινεί τη στοίβα (συνέπεια Δ). */
  readonly history: History<ReviewStep> | null;
}

function planRequest(request: HistoryRequest, history: History<ReviewStep>, view: ImportBatchDetailView): Planned | null {
  if (request.kind === 'follow') {
    const { proposalId, from, to } = request.followUp;
    return { plan: planFieldMarks(view.proposals, proposalId, from, to), kind: 'fields', history: null };
  }
  if (request.expected && history.past[history.past.length - 1] !== request.expected) return null;
  const travel = travelOf(history, request.direction);
  if (!travel) return null;
  return { plan: planReviewStep(view, travel.from, travel.to), kind: travel.to.kind, history: travel.next };
}

/** `Ctrl+Z` σε επίπεδο παραθύρου, όσο ζει η οθόνη — εκτός αν το πλήκτρο ανήκει σε κάποιον άλλον. */
function useHistoryKeys(request: (direction: HistoryDirection) => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = historyDirectionOf(event);
      if (!direction || event.defaultPrevented || shouldGlobalShortcutYield(event)) return;
      event.preventDefault();
      request(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request]);
}

type Enqueue = (requests: readonly HistoryRequest[], first?: boolean) => void;

/**
 * Η αποστολή ενός σχεδίου από την πόρτα του. Η αναίρεση γραμμής κρατά την ουρά (`hold`) ώσπου να απαντήσει ο διακομιστής: οι
 * συνέπειές της (Δ) μπαίνουν **πρώτες**, πριν από το επόμενο Ctrl+Z.
 */
function useDispatch(doors: Doors, enqueue: Enqueue, setHolding: (holding: boolean) => void) {
  const { t } = useImportText();
  const notifications = useNotifications();
  return useCallback((send: ReviewSend) => {
    if (send.door === 'change') {
      void doors.change(send.proposal, send.change);
      return;
    }
    setHolding(true);
    void doors.decideLine(send.proposal, send.request).then((result) => {
      if (result?.outcome.kind !== 'settled') notifications.notify(t('review.history.skippedLine', { count: 1 }), { type: 'info' });
      else {
        // Απόφαση Α: η γραμμή επέστρεψε, η νέα ιδιότητα μένει στο σχήμα της οικογένειας — το λέμε, δεν το κρύβουμε.
        if (send.bindKept) notifications.notify(t('review.history.bindKept'), { type: 'info' });
        enqueue(send.then.map((followUp): HistoryRequest => ({ kind: 'follow', followUp })), true);
      }
      setHolding(false);
    });
  }, [doors, enqueue, notifications, setHolding, t]);
}

interface RequestQueueInput {
  readonly view: ImportBatchDetailView | null;
  readonly doors: Doors;
  readonly saving: number;
  readonly history: History<ReviewStep>;
  readonly setHistory: (next: History<ReviewStep>) => void;
}

/** Η ουρά αιτημάτων: ένα τη φορά, και μόνο όταν η εικόνα έχει ηρεμήσει (καμία αλλαγή στον δρόμο, καμία αναίρεση γραμμής ανοιχτή). */
function useRequestQueue({ view, doors, saving, history, setHistory }: RequestQueueInput) {
  const { t } = useImportText();
  const notifications = useNotifications();
  const [requests, setRequests] = useState<readonly HistoryRequest[]>([]);
  const [holding, setHolding] = useState(false);
  const enqueue = useCallback<Enqueue>((added, first = false) =>
    setRequests((current) => (first ? [...added, ...current] : [...current, ...added])), []);
  const request = useCallback((direction: HistoryDirection) => enqueue([{ kind: 'travel', direction }]), [enqueue]);
  const undoStep = useCallback((expected: ReviewEntry) => enqueue([{ kind: 'travel', direction: 'undo', expected }]), [enqueue]);
  const dispatch = useDispatch(doors, enqueue, setHolding);

  useEffect(() => {
    if (saving > 0 || holding || requests.length === 0 || !view) return;
    const [next, ...rest] = requests;
    setRequests(rest);
    const planned = planRequest(next, history, view);
    if (!planned) return;
    if (planned.history) setHistory(planned.history);
    const { plan } = planned;
    if (plan.skipped > 0) notifications.notify(t(SKIPPED_KEYS[planned.kind], { count: plan.skipped }), { type: 'info' });
    // Η αποστολή σηκώνει αμέσως το `saving` (ή το `holding`): το επόμενο αίτημα περιμένει να γυρίσει αυτό.
    if (plan.send) dispatch(plan.send);
  }, [dispatch, history, holding, notifications, requests, saving, setHistory, t, view]);
  return { request, undoStep };
}

/** Οι δύο καταγραφείς: τυλίγουν τις πόρτες, γράφουν το βήμα, και στέλνουν. */
function useRecorders(view: ImportBatchDetailView | null, doors: Doors, setHistory: (update: (current: History<ReviewStep>) => History<ReviewStep>) => void) {
  const [announce, setAnnounce] = useState<ReviewEntry | null>(null);

  const change = useCallback<Change>((proposal, input) => {
    const step = reviewStepOf(proposal, input);
    if (step) {
      setHistory((current) => recordHistory(current, step));
      // §5.5.2 Β9γ: μόνο η ομαδική πράξη ανακοινώνεται με toast «Αναίρεση».
      if (isGroupStep(step.after.label)) setAnnounce(step);
    }
    return doors.change(proposal, input);
  }, [doors, setHistory]);

  // §5.5.2 Β9δ: γράφεται ΤΩΡΑ (η σειρά της στοίβας = η σειρά των πράξεων) και εμπλουτίζεται με ό,τι έγινε — ή φεύγει, αν αρνήθηκε.
  const decideLine = useCallback<SendLine>(async (proposal, request) => {
    const step = view ? lineStepOf(view, proposal, request) : null;
    if (step) setHistory((current) => recordHistory(current, step));
    const result = await doors.decideLine(proposal, request);
    if (step && view) {
      const settled = settledLineStep(step, view, result);
      setHistory((current) => replaceHistoryEntry(current, step, settled));
    }
    return result;
  }, [doors, setHistory, view]);

  return { change, decideLine, announce };
}

/**
 * @param view        η όψη της παρτίδας (με τις αισιόδοξες αποφάσεις από πάνω).
 * @param change      η πόρτα των αλλαγών πρότασης (`useProposalChangeQueue`).
 * @param decideLine  η πόρτα της απόφασης γραμμής (`useLineDecisions`).
 * @param saving      πόσες προτάσεις έχουν αλλαγές στον δρόμο.
 */
export function useReviewHistory(view: ImportBatchDetailView | null, change: Change, decideLine: SendLine, saving: number) {
  const [history, setHistory] = useState(() => emptyHistory<ReviewStep>());
  // Σταθερό αντικείμενο πορτών: αλλάζει μόνο όταν αλλάξει κάποια πόρτα.
  const doors = useMemo<Doors>(() => ({ change, decideLine }), [change, decideLine]);
  const recorders = useRecorders(view, doors, setHistory);
  const { request, undoStep } = useRequestQueue({ view, doors, saving, history, setHistory });
  useHistoryKeys(request);
  useReviewUndoToast(view?.batch.id ?? '', history, recorders.announce, undoStep);

  const reviewHistory: ReviewHistory = {
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    nextUndo: history.past[history.past.length - 1]?.after.label ?? null,
    nextRedo: history.future[0]?.after.label ?? null,
    undo: () => request('undo'),
    redo: () => request('redo'),
  };
  return { change: recorders.change, decideLine: recorders.decideLine, history: reviewHistory };
}
