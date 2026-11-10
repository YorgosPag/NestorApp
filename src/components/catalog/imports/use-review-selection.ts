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
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { reviewTargetKey, type ReviewBox, type ReviewTarget } from './review-overlay-model';

type ReviewSelectionOrigin = 'list' | 'pdf' | 'cycle';

interface SelectionState {
  readonly target: ReviewTarget | null;
  readonly origin: ReviewSelectionOrigin;
  /** Το πλαίσιο πολλών στόχων από το οποίο ήρθε η επιλογή, και η θέση μέσα σε αυτό. */
  readonly cycle: { readonly boxId: string; readonly index: number } | null;
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
  readonly selectFromList: (target: ReviewTarget) => void;
  readonly selectFromBox: (box: ReviewBox) => void;
  readonly nextInBox: () => void;
}

const EMPTY: SelectionState = { target: null, origin: 'list', cycle: null };

export function useReviewSelection(boxes: readonly ReviewBox[]): ReviewSelection {
  const [state, setState] = useState<SelectionState>(EMPTY);
  const key = state.target === null ? null : reviewTargetKey(state.target);

  const cycle = useMemo<ReviewBoxCycle | null>(() => {
    if (state.cycle === null) return null;
    const box = boxes.find((candidate) => candidate.id === state.cycle?.boxId);
    // Ο στόχος πρέπει να είναι ακόμη μέσα στο πλαίσιο: ξαναχτισμένος πίνακας ⇒ κανένα ψεύτικο «2 από 4».
    return box && box.targets[state.cycle.index]?.key === key ? { box, index: state.cycle.index } : null;
  }, [boxes, state.cycle, key]);

  const selectFromList = useCallback((target: ReviewTarget) => setState({ target, origin: 'list', cycle: null }), []);

  const selectFromBox = useCallback((box: ReviewBox) => {
    const first = box.targets[0];
    if (!first) return;
    setState({ target: first.target, origin: 'pdf', cycle: box.targets.length > 1 ? { boxId: box.id, index: 0 } : null });
  }, []);

  const nextInBox = useCallback(() => {
    if (cycle === null) return;
    const index = (cycle.index + 1) % cycle.box.targets.length;
    setState({ target: cycle.box.targets[index].target, origin: 'cycle', cycle: { boxId: cycle.box.id, index } });
  }, [cycle]);

  return { target: state.target, key, origin: state.origin, cycle, selectFromList, selectFromBox, nextInBox };
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
