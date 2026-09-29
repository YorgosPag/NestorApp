'use client';

/**
 * @fileoverview **ΤΙ ΚΑΝΟΥΝ ΟΙ ΛΑΒΕΣ** — σύρσιμο/προσθήκη/αφαίρεση γωνίας πάνω στο επιλεγμένο σχήμα, με έλξη και Shift, και
 * **μία** εγγραφή όταν τελειώσει η χειρονομία σε εγκεκριμένο χώρο (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ9.3 · Δ9.5 · Δ9.6).
 * @related `TourSpaceHandles.tsx` (ο καταναλωτής) · `lib/geometry/ring-edit.ts` · `lib/spatial-tour/space-edit/space-edit-point.ts`
 *   · `lib/spatial-tour/tour-editor-optimistic.ts` (`judgeShapeCommand` — ο ΙΔΙΟΣ κριτής) · `space-editor-store.ts`
 * @module components/spatial-tour/editor/spaces/useShapeEdit
 *
 * 🔑 **Πρόταση ⇒ τοπικά · εγκεκριμένος χώρος ⇒ `edit` ως την απελευθέρωση/Enter, μετά ΜΙΑ εντολή `replace`** (Figma/Revit:
 *   άμεση επεξεργασία, «Αναίρεση» στο μήνυμα). Όχι μία εγγραφή ανά pixel συρσίματος.
 * 🔑 **Ο προέλεγχος πριν την εγγραφή** (Δ9.6): σχήμα που ο γραφέας θα αρνιόταν (π.χ. μπαίνει στην κουζίνα) **μένει** πρόχειρο με
 *   τον λόγο στο πάνελ — ποτέ εγγραφή που θα γύριζε πίσω με σφάλμα. Esc ⇒ πίσω στο αποθηκευμένο.
 * 🔑 **Κορυφές από το store τη στιγμή του γεγονότος** (ADR-040) — ποτέ από το render· δύο γρήγορα πατήματα βελακιού δεν χάνουν
 *   το ένα.
 */

import { useMemo, useRef } from 'react';

import { insertRingVertex, moveRingVertex, removeRingVertex } from '@/lib/geometry/ring-edit';
import { resolveSpacePoint } from '@/lib/spatial-tour/space-edit/space-edit-point';
import { judgeShapeCommand } from '@/lib/spatial-tour/tour-editor-optimistic';
import type { TourGraphCommand, TourPlanXY } from '@/lib/spatial-tour/tour-graph-edit';
import { draftOf } from '@/lib/spatial-tour/tour-space-edit';
import type { TourViewerSpace } from '@/lib/spatial-tour/viewer/tour-viewer-shapes';
import type { SpatialTour, TourLevelKey } from '@/types/spatial-tour';

import type { TourEditorActions } from '../useTourEditorActions';
import {
  setSelectedPoints,
  updateSpaceEditor,
  useSpaceEditor,
  type SpaceEditorState,
  type SpaceEditorStore,
} from './space-editor-store';
import type { ShapeEditController } from './TourSpaceHandles';
import type { SpaceMapReader } from './useSpaceMapReader';

export interface ShapeEditContext {
  readonly store: SpaceEditorStore;
  readonly levelKey: TourLevelKey;
  readonly spaces: readonly TourViewerSpace[];
  /** Ο γράφος της οθόνης — ο κριτής του προελέγχου. */
  readonly graph: Pick<SpatialTour, 'levels' | 'nodes'>;
  readonly reader: SpaceMapReader;
  readonly planSize: { readonly width: number; readonly height: number };
  readonly actions: Pick<TourEditorActions, 'space'>;
}

/** Οι κορυφές του επιλεγμένου σχήματος, όπως είναι **τώρα** (πρόταση · πρόχειρο · αποθηκευμένο). */
export function selectedPoints(state: SpaceEditorState, spaces: readonly TourViewerSpace[]): readonly TourPlanXY[] | null {
  const selection = state.selection;
  if (selection?.kind === 'proposal') return state.proposals.find((p) => p.key === selection.key)?.outline ?? null;
  if (selection?.kind !== 'space') return null;
  if (state.edit?.spaceId === selection.id) return state.edit.points;
  return spaces.find((s) => s.id === selection.id)?.points ?? null;
}

/** Οι δακτύλιοι όπου «κολλά» μια γωνία: οι **άλλοι** χώροι και οι **άλλες** προτάσεις (Δ9.6). */
export function snapRings(state: SpaceEditorState, spaces: readonly TourViewerSpace[]): TourPlanXY[][] {
  const sel = state.selection;
  const own = (kind: 'space' | 'proposal', id: string) => sel?.kind === kind && (sel.kind === 'proposal' ? sel.key : sel.id) === id;
  return [
    ...spaces.filter((s) => !own('space', s.id)).map((s) => [...s.points]),
    ...state.proposals.filter((p) => !own('proposal', p.key)).map((p) => [...p.outline]),
  ];
}

/** Η εντολή που θα έστελνε η εγγραφή του προχείρου — `null` όταν δεν υπάρχει πρόχειρο. */
export function pendingReplace(state: SpaceEditorState, spaces: readonly TourViewerSpace[], levelKey: TourLevelKey): TourGraphCommand | null {
  const edit = state.edit;
  const space = edit === null ? undefined : spaces.find((s) => s.id === edit.spaceId);
  if (edit === null || space === undefined) return null;
  return { op: 'space', levelKey, spaceId: space.id, mode: 'replace', space: { ...draftOf(space), points: edit.points } };
}

function controllerOf(ctx: ShapeEditContext, points: readonly TourPlanXY[]): ShapeEditController {
  const { store, spaces } = ctx;
  const current = () => selectedPoints(store.get(), spaces) ?? [];
  const write = (next: TourPlanXY[] | null) => { if (next !== null) updateSpaceEditor(store, (s) => setSelectedPoints(s, next)); };
  const commit = () => {
    const command = pendingReplace(store.get(), spaces, ctx.levelKey);
    if (command === null || command.op !== 'space' || judgeShapeCommand(command, ctx.graph) !== null) return;
    void ctx.actions.space(ctx.levelKey, { mode: 'replace', spaceId: command.spaceId }, command.space);
    updateSpaceEditor(store, (s) => ({ ...s, edit: null }));
  };
  return {
    points,
    resolve: (anchorIndex, clientX, clientY, shiftKey) => {
      const reading = ctx.reader.read(clientX, clientY);
      if (reading === null) return null;
      const now = current();
      const shiftFrom = anchorIndex === null ? null : now[anchorIndex] ?? null;
      const rings = snapRings(store.get(), spaces);
      return resolveSpacePoint(reading.point, { rings, shiftFrom, shiftKey, metresPerPx: reading.metresPerPx, planSize: ctx.planSize }).point;
    },
    move: (index, point) => write(moveRingVertex(current(), index, point)),
    insert: (edgeIndex, point) => write(insertRingVertex(current(), edgeIndex, point)),
    remove: (index) => { write(removeRingVertex(current(), index)); commit(); },
    commit,
  };
}

const readSelection = (s: SpaceEditorState) => s.selection;
const readProposals = (s: SpaceEditorState) => s.proposals;
const readEdit = (s: SpaceEditorState) => s.edit;

/** Ο ελεγκτής των λαβών για το επιλεγμένο σχήμα — `null` όταν δεν είναι επιλεγμένο σχήμα (ή είναι γραμμή). */
export function useShapeEdit(ctx: ShapeEditContext): ShapeEditController | null {
  const selection = useSpaceEditor(ctx.store, readSelection);
  const proposals = useSpaceEditor(ctx.store, readProposals);
  const edit = useSpaceEditor(ctx.store, readEdit);
  const latest = useRef(ctx);
  latest.current = ctx;
  const { spaces } = ctx;
  return useMemo(() => {
    const points = selectedPoints({ ...ctx.store.get(), selection, proposals, edit }, spaces);
    // Getter προς το ΤΡΕΧΟΝ πλαίσιο (actions/graph αλλάζουν ταυτότητα σε κάθε φόρτωση) — ο ελεγκτής μένει σταθερός στο σύρσιμο.
    const live: ShapeEditContext = {
      get store() { return latest.current.store; }, get levelKey() { return latest.current.levelKey; },
      get spaces() { return latest.current.spaces; }, get graph() { return latest.current.graph; },
      get reader() { return latest.current.reader; }, get planSize() { return latest.current.planSize; },
      get actions() { return latest.current.actions; },
    };
    return points === null ? null : controllerOf(live, points);
  }, [ctx.store, selection, proposals, edit, spaces]);
}
