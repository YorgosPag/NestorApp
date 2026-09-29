/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΕΠΕΞΕΡΓΑΣΤΗ ΧΩΡΩΝ** — εργαλείο, πόρτα, προτάσεις, επιλογή, κορυφές σε επεξεργασία, πένα
 * (ADR-884 Φ2στ-γ Γ3γ-2β · §4.14 · §12 Δ9).
 * @related `lib/state/createExternalStore.ts` · `lib/spatial-tour/space-edit/tour-space-proposals.ts` (τι είναι μια πρόταση)
 * @module components/spatial-tour/editor/spaces/space-editor-store
 *
 * 🔑 **Εξωτερικό store, όχι React state** (ADR-040): το σύρσιμο κορυφής γράφει εδώ στα 60 fps και ξαναζωγραφίζεται **μόνο** ό,τι
 *   διαβάζει τις κορυφές (το σχήμα + οι λαβές) — όχι το πάνελ, η λίστα ή η εικόνα της κάτοψης.
 * 🔑 **Οι μεταβάσεις είναι καθαρές συναρτήσεις** `(state, …) ⇒ state` — ελέγχονται χωρίς React.
 * 🔑 **Πρόταση = τοπική** ως την «Έγκριση» (Δ9.3): οι κορυφές της αλλάζουν κατευθείαν μέσα της. **Εγκεκριμένος χώρος** = οι
 *   κορυφές σε επεξεργασία ζουν στο `edit` ως την απελευθέρωση/Enter, και τότε γίνεται **μία** εγγραφή.
 */

import { useCallback, useSyncExternalStore } from 'react';

import { DEFAULT_SPACE_DETECT } from '@/lib/spatial-tour/space-detect/space-detect-types';
import type { SpaceProposal } from '@/lib/spatial-tour/space-edit/tour-space-proposals';
import type { TourPlanXY } from '@/lib/spatial-tour/tour-graph-edit';
import { createExternalStore, type ExternalStore } from '@/lib/state/createExternalStore';

import type { SpaceDetectNotice } from './tour-space-editor-labels';

export type SpaceEditorTool = 'select' | 'pen';

export type SpaceSelection =
  | { readonly kind: 'proposal'; readonly key: string }
  | { readonly kind: 'space'; readonly id: string }
  | { readonly kind: 'separation'; readonly id: string }
  | null;

export interface SpaceEditorState {
  readonly tool: SpaceEditorTool;
  readonly doorWidthM: number;
  readonly proposals: readonly SpaceProposal[];
  /** Ανιχνεύσεις σε πτήση — «Αναζήτηση χώρων…». */
  readonly detecting: number;
  /** Η τελευταία άρνηση/αποτυχία ανίχνευσης — σβήνει με την επόμενη επιτυχία. */
  readonly notice: SpaceDetectNotice | null;
  readonly selection: SpaceSelection;
  /** Κορυφές **εγκεκριμένου** χώρου σε επεξεργασία — `null` ⇒ όπως είναι αποθηκευμένες. */
  readonly edit: { readonly spaceId: string; readonly points: readonly TourPlanXY[] } | null;
  /** Οι γωνίες της πένας ως τώρα (Δ9.5). */
  readonly pen: readonly TourPlanXY[];
  /** Πού θα πέσει η επόμενη γωνία της πένας (με έλξη/Shift) — `null` εκτός κάτοψης. */
  readonly penHover: TourPlanXY | null;
}

export const INITIAL_SPACE_EDITOR: SpaceEditorState = {
  tool: 'select',
  doorWidthM: DEFAULT_SPACE_DETECT.doorWidthM,
  proposals: [],
  detecting: 0,
  notice: null,
  selection: null,
  edit: null,
  pen: [],
  penHover: null,
};

export type SpaceEditorStore = ExternalStore<SpaceEditorState>;

export function createSpaceEditorStore(): SpaceEditorStore {
  return createExternalStore<SpaceEditorState>(INITIAL_SPACE_EDITOR, { equals: Object.is });
}

/** Εφαρμογή μιας καθαρής μετάβασης. */
export function updateSpaceEditor(store: SpaceEditorStore, change: (state: SpaceEditorState) => SpaceEditorState): void {
  store.set(change(store.get()));
}

/** Συνδρομή σε **ένα** κομμάτι — ο επιλογέας πρέπει να επιστρέφει σταθερή αναφορά (πεδίο του state, όχι νέο αντικείμενο). */
export function useSpaceEditor<T>(store: SpaceEditorStore, select: (state: SpaceEditorState) => T): T {
  const read = useCallback(() => select(store.get()), [store, select]);
  return useSyncExternalStore(store.subscribe, read, read);
}

// ── Μεταβάσεις (καθαρές) ─────────────────────────────────────────────────────────────────────────────────────────────

const sameSelection = (a: SpaceSelection, b: SpaceSelection): boolean =>
  a === b || (a !== null && b !== null && a.kind === b.kind && (a.kind === 'proposal' ? a.key : a.id) === (b.kind === 'proposal' ? b.key : b.id));

/** Επιλογή — άλλος στόχος ⇒ ό,τι ήταν σε επεξεργασία εγκαταλείπεται (ποτέ «κολλημένες» κορυφές σε λάθος χώρο). */
export function selectTarget(state: SpaceEditorState, selection: SpaceSelection): SpaceEditorState {
  if (sameSelection(state.selection, selection)) return state;
  return { ...state, selection, edit: null };
}

/** Νέα/ανανεωμένη πρόταση (ίδιο κλειδί ⇒ αντικατάσταση στη θέση της)· `select` ⇒ γίνεται και η επιλεγμένη. */
export function putProposal(state: SpaceEditorState, proposal: SpaceProposal, select: boolean): SpaceEditorState {
  const index = state.proposals.findIndex((p) => p.key === proposal.key);
  const proposals = index < 0 ? [...state.proposals, proposal]
    : state.proposals.map((p, i) => (i === index ? proposal : p));
  const next = { ...state, proposals, notice: null };
  return select ? selectTarget(next, { kind: 'proposal', key: proposal.key }) : next;
}

/** Η πρόταση φεύγει (εγκρίθηκε ή απορρίφθηκε) — και η επιλογή της, αν ήταν επιλεγμένη. */
export function dropProposal(state: SpaceEditorState, key: string): SpaceEditorState {
  const selected = state.selection?.kind === 'proposal' && state.selection.key === key;
  return { ...state, proposals: state.proposals.filter((p) => p.key !== key), selection: selected ? null : state.selection };
}

/** Νέες κορυφές για την **επιλεγμένη** πρόταση (τοπικά) ή τον επιλεγμένο χώρο (`edit`). */
export function setSelectedPoints(state: SpaceEditorState, points: readonly TourPlanXY[]): SpaceEditorState {
  const selection = state.selection;
  if (selection?.kind === 'proposal') {
    return { ...state, proposals: state.proposals.map((p) => (p.key === selection.key ? { ...p, outline: points } : p)) };
  }
  if (selection?.kind === 'space') return { ...state, edit: { spaceId: selection.id, points } };
  return state;
}

export function setTool(state: SpaceEditorState, tool: SpaceEditorTool): SpaceEditorState {
  return state.tool === tool ? state : { ...state, tool, pen: [], penHover: null };
}

export function setDetecting(state: SpaceEditorState, delta: 1 | -1): SpaceEditorState {
  return { ...state, detecting: Math.max(0, state.detecting + delta) };
}

/** Κλειδί επιλογής (για λίστες/σύγκριση). */
export function selectionKey(selection: SpaceSelection): string | null {
  if (selection === null) return null;
  return selection.kind === 'proposal' ? `proposal:${selection.key}` : `${selection.kind}:${selection.id}`;
}
