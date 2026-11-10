'use client';

/**
 * @fileoverview **Ο ΕΝΑΣ κάτοχος της επιλογής στην αναθεώρηση** (ADR-923 §5.5.2 Β8): λίστα και PDF είναι δύο **όψεις** του ίδιου
 *   στόχου (Figma καμβάς ↔ layers). Η λίστα γράφει (`selectFromList`), το PDF γράφει (`selectFromBox`), και οι δύο διαβάζουν.
 * @module components/catalog/imports/use-review-selection
 *
 * 🔑 Κρατά **κλειδί** (`ReviewTarget`), ποτέ αντικείμενο: η επιλογή επιβιώνει κάθε ξαναφόρτωμα της πρότασης.
 * 🔑 **Προέλευση**: κλικ στο PDF ⇒ η εστίαση πληκτρολογίου περνά στη λίστα (`pdf`)· «επόμενο» μέσα στο ίδιο πλαίσιο ⇒ μόνο κύλιση
 *    (`cycle`), ώστε το κουμπί «Επόμενο» να μη χάνει την εστίαση σε κάθε πάτημα.
 * 🔑 **Ένα πλαίσιο → πολλοί στόχοι** (ενωμένο κελί): «1 από 4 · Επόμενο». Κανένα από τα Rossum · Azure DI · ABBYY δεν τεκμηριώνει
 *    πρότυπο — δική μας απόφαση, δηλωμένη στο ADR.
 * 🔑 **Πρόθεση** (§5.5.2 Β8 βήμα Β): κουμπί λύσης στο popover του PDF ⇒ `requestRemedy` επιλέγει τον στόχο **και** κρατά τι
 *    ζητήθηκε (διόρθωση · εργαλείο γραμμής · τιμοκατάλογος). Την καταναλώνει το **ίδιο** εργαλείο της λίστας που ανοίγει και το
 *    κουμπί της — καμία δεύτερη υλοποίηση ενέργειας — και τη σβήνει (`clearIntent`). Κάθε νέα επιλογή τη σβήνει επίσης.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { reviewTargetKey, type ReviewBox, type ReviewTarget } from './review-overlay-model';
import type { LineTool } from './review-remedy';

/** `remedy`: κουμπί λύσης στο popover — μόνο κύλιση στη λίστα· την εστίαση την παίρνει το εργαλείο που ανοίγει. */
type ReviewSelectionOrigin = 'list' | 'pdf' | 'cycle' | 'remedy';

/** Τι ζήτησε ο άνθρωπος από το popover, για τον επιλεγμένο στόχο. */
export type ReviewIntent =
  | { readonly kind: 'editField' }
  | { readonly kind: 'lineTool'; readonly mode: LineTool }
  | { readonly kind: 'priceTarget' };

interface SelectionState {
  readonly target: ReviewTarget | null;
  readonly origin: ReviewSelectionOrigin;
  /** Το πλαίσιο πολλών στόχων από το οποίο ήρθε η επιλογή, και η θέση μέσα σε αυτό. */
  readonly cycle: { readonly boxId: string; readonly index: number } | null;
  readonly intent: ReviewIntent | null;
}

export interface ReviewBoxCycle {
  readonly box: ReviewBox;
  readonly index: number;
}

export interface ReviewSelection {
  readonly target: ReviewTarget | null;
  readonly key: string | null;
  readonly origin: ReviewSelectionOrigin;
  readonly cycle: ReviewBoxCycle | null;
  readonly intent: ReviewIntent | null;
  readonly selectFromList: (target: ReviewTarget) => void;
  readonly selectFromBox: (box: ReviewBox) => void;
  readonly nextInBox: () => void;
  /** Επιλογή από κουμπί λύσης· `intent: null` = η ενέργεια έγινε ήδη (π.χ. «Κράτα»), μένει μόνο η επιλογή. */
  readonly requestRemedy: (target: ReviewTarget, intent: ReviewIntent | null) => void;
  readonly clearIntent: () => void;
}

const EMPTY: SelectionState = { target: null, origin: 'list', cycle: null, intent: null };

export function useReviewSelection(boxes: readonly ReviewBox[]): ReviewSelection {
  const [state, setState] = useState<SelectionState>(EMPTY);
  const key = state.target === null ? null : reviewTargetKey(state.target);

  const cycle = useMemo<ReviewBoxCycle | null>(() => {
    if (state.cycle === null) return null;
    const box = boxes.find((candidate) => candidate.id === state.cycle?.boxId);
    // Ο στόχος πρέπει να είναι ακόμη μέσα στο πλαίσιο: ξαναχτισμένος πίνακας ⇒ κανένα ψεύτικο «2 από 4».
    return box && box.targets[state.cycle.index]?.key === key ? { box, index: state.cycle.index } : null;
  }, [boxes, state.cycle, key]);

  const selectFromList = useCallback((target: ReviewTarget) => setState({ target, origin: 'list', cycle: null, intent: null }), []);

  const selectFromBox = useCallback((box: ReviewBox) => {
    const first = box.targets[0];
    if (!first) return;
    setState({ target: first.target, origin: 'pdf', cycle: box.targets.length > 1 ? { boxId: box.id, index: 0 } : null, intent: null });
  }, []);

  const nextInBox = useCallback(() => {
    if (cycle === null) return;
    const index = (cycle.index + 1) % cycle.box.targets.length;
    setState({ target: cycle.box.targets[index].target, origin: 'cycle', cycle: { boxId: cycle.box.id, index }, intent: null });
  }, [cycle]);

  const requestRemedy = useCallback((target: ReviewTarget, intent: ReviewIntent | null) =>
    setState({ target, origin: 'remedy', cycle: null, intent }), []);

  const clearIntent = useCallback(() => setState((current) => (current.intent === null ? current : { ...current, intent: null })), []);

  return { target: state.target, key, origin: state.origin, cycle, intent: state.intent, selectFromList, selectFromBox, nextInBox, requestRemedy, clearIntent };
}

/**
 * Η **όψη λίστας** του επιλεγμένου στόχου (πεδίο · γραμμή χωρίς πεδίο · αποφασισμένη γραμμή): έρχεται σε όψη (Α6: μπορεί να είναι
 * εκτός οθόνης) και, όταν τον διάλεξε κλικ στο PDF, παίρνει την εστίαση πληκτρολογίου — **μετά** την κύλιση, ώστε ο
 * φυλλομετρητής να μην ξανακυλήσει αλλού. Ένα σημείο για τις τρεις λίστες.
 */
export function useActiveReviewItem<TItem extends HTMLElement>(active: boolean, focusRequested: boolean) {
  const itemRef = useRef<TItem>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!active) return;
    itemRef.current?.scrollIntoView?.({ block: 'nearest' });
    if (focusRequested) buttonRef.current?.focus({ preventScroll: true });
  }, [active, focusRequested]);
  return { itemRef, buttonRef };
}
