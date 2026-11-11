'use client';

/**
 * @fileoverview **Αναίρεση / επανάληψη στην οθόνη ελέγχου εισαγωγής** (ADR-923 §5.5.2 Β9β).
 * @module components/catalog/imports/use-review-history
 *
 * 🔑 **Μία στοίβα ανά άνθρωπο και οθόνη** (Figma · Revit): η γενική `grid-history` (όριο 100, §5.10.4 Β1), με βήματα
 *    `review-history`. Ζει στη μνήμη της καρτέλας — όπως σε κάθε επεξεργαστή, η επαναφόρτωση ξεκινά καθαρή στοίβα.
 * 🔑 **Καταγραφή σε ΕΝΑ σημείο**: τυλίγει το `change` της ουράς, άρα κάθε δρόμος (κουμπιά λίστας · popover του PDF · «Αποδοχή
 *    γραμμής») γράφεται χωρίς να το ξέρει. Η αναίρεση στέλνει από το **ίδιο** `change`, χωρίς καταγραφή.
 * 🔑 **Η αναίρεση κρίνει την πιο φρέσκια εικόνα.** Όσο αλλαγές ταξιδεύουν προς τον διακομιστή, το αίτημα περιμένει: μια
 *    διόρθωση που δεν έχει επιστρέψει ακόμη θα έμοιαζε «αλλαγμένη από άλλον». Τα αιτήματα εκτελούνται με τη σειρά, ένα-ένα.
 * 🔑 **Πληκτρολόγιο**: `Ctrl/Cmd+Z` · `Ctrl/Cmd+Shift+Z` · `Ctrl/Cmd+Y` από τη μία ερμηνεία (`historyDirectionOf`, φυσική θέση —
 *    ελληνική διάταξη). Ποιος δικαιούται το πλήκτρο το λέει η μία πύλη (`shouldGlobalShortcutYield`, ADR-711): σε πεδίο κειμένου
 *    ή ανοιχτό διάλογο το `Ctrl+Z` μένει εκεί.
 * 🔑 **Β9γ**: η ομαδική πράξη («Αποδοχή γραμμής») ανακοινώνεται με toast «Αναίρεση» (`useReviewUndoToast`), που αναιρεί από
 *    την ΙΔΙΑ ουρά — και μόνο αν το βήμα του είναι ακόμη στην κορυφή (`expected`).
 */

import { useCallback, useEffect, useState } from 'react';

import { shouldGlobalShortcutYield } from '@/lib/a11y/keyboard-scope';
import { canRedo, canUndo, emptyHistory, recordHistory, redoHistory, undoHistory, type History } from '@/lib/spreadsheet/grid-history';
import { historyDirectionOf, type HistoryDirection } from '@/lib/spreadsheet/grid-key-intent';
import { useNotifications } from '@/providers/NotificationProvider';
import type { ImportBatchDetailView, ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { useImportText } from './import-text';
import type { ProposalChange } from './proposal-change-queue';
import { isGroupStep, planReviewStep, reviewStepOf, type ReviewStep, type ReviewStepLabel } from './review-history';
import { useReviewUndoToast, type ReviewEntry } from './use-review-undo-toast';

type Change = (proposal: ImportProposalWire, input: ProposalChange) => Promise<void>;

/** Ένα αίτημα της ουράς. `expected` (Β9γ, κουμπί του toast): εκτελείται ΜΟΝΟ αν αυτό το βήμα είναι ακόμη στην κορυφή. */
interface HistoryRequest {
  readonly direction: HistoryDirection;
  readonly expected?: ReviewEntry;
}

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

interface RequestQueueInput {
  readonly view: ImportBatchDetailView | null;
  readonly change: Change;
  readonly saving: number;
  readonly history: History<ReviewStep>;
  readonly setHistory: (next: History<ReviewStep>) => void;
}

/** Η ουρά αιτημάτων: ένα τη φορά, και μόνο όταν η εικόνα έχει ηρεμήσει (καμία αλλαγή στον δρόμο). */
function useRequestQueue({ view, change, saving, history, setHistory }: RequestQueueInput) {
  const { t } = useImportText();
  const notifications = useNotifications();
  const [requests, setRequests] = useState<readonly HistoryRequest[]>([]);
  const request = useCallback((direction: HistoryDirection) => setRequests((current) => [...current, { direction }]), []);
  const undoStep = useCallback((expected: ReviewEntry) => setRequests((current) => [...current, { direction: 'undo', expected }]), []);

  useEffect(() => {
    if (saving > 0 || requests.length === 0 || !view) return;
    const [{ direction, expected }, ...rest] = requests;
    setRequests(rest);
    if (expected && history.past[history.past.length - 1] !== expected) return;
    const travel = travelOf(history, direction);
    if (!travel) return;
    setHistory(travel.next);
    const plan = planReviewStep(view.proposals, travel.from, travel.to);
    if (plan.skipped > 0) notifications.notify(t('review.history.skipped', { count: plan.skipped }), { type: 'info' });
    if (!plan.proposal || !plan.change) return;
    // Η ουρά σηκώνει αμέσως το `saving`: το επόμενο αίτημα περιμένει να γυρίσει αυτό.
    void change(plan.proposal, plan.change);
  }, [change, history, notifications, requests, saving, setHistory, t, view]);
  return { request, undoStep };
}

export function useReviewHistory(view: ImportBatchDetailView | null, change: Change, saving: number) {
  const [history, setHistory] = useState(() => emptyHistory<ReviewStep>());
  const [announce, setAnnounce] = useState<ReviewEntry | null>(null);

  const record = useCallback<Change>((proposal, input) => {
    const step = reviewStepOf(proposal, input);
    if (step) {
      setHistory((current) => recordHistory(current, step));
      // §5.5.2 Β9γ: μόνο η ομαδική πράξη ανακοινώνεται με toast «Αναίρεση».
      if (isGroupStep(step.after.label)) setAnnounce(step);
    }
    return change(proposal, input);
  }, [change]);

  const { request, undoStep } = useRequestQueue({ view, change, saving, history, setHistory });
  useHistoryKeys(request);
  useReviewUndoToast(view?.batch.id ?? '', history, announce, undoStep);

  const reviewHistory: ReviewHistory = {
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    nextUndo: history.past[history.past.length - 1]?.after.label ?? null,
    nextRedo: history.future[0]?.after.label ?? null,
    undo: () => request('undo'),
    redo: () => request('redo'),
  };
  return { change: record, history: reviewHistory };
}
