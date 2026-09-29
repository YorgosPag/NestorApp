'use client';

/**
 * @fileoverview **Η ΠΕΝΑ** — σχεδίαση χώρου με το χέρι, γωνία-γωνία (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ9.5 · πρότυπο Figma pen /
 * Revit sketch · η σύμβαση του `components/geo/outline-draft`).
 * @related `lib/spatial-tour/space-edit/space-edit-point.ts` (ο ΕΝΑΣ κανόνας θέσης γωνίας — ίδιος με τις λαβές) ·
 *   `lib/spatial-tour/space-edit/tour-space-proposals.ts` (`penProposal`) · `space-editor-store.ts`
 * @module components/spatial-tour/editor/spaces/useSpacePen
 *
 * 🔑 **Κλικ = γωνία · κλικ στην ΠΡΩΤΗ (ή Enter) = κλείσιμο · Backspace = πίσω μία · Esc = ακύρωση (`cancel`, από το
 *   `onEscapeKeyDown` του διαλόγου) · Shift = ορθή γωνία** ως προς
 *   την προηγούμενη. Το κλειστό σχήμα γίνεται **πρόταση** — «Έγκριση» όπως κάθε άλλη (Δ8.1).
 * 🔑 **Η επόμενη γωνία φαίνεται πριν πατηθεί** (`penHover`, με έλξη/Shift ήδη εφαρμοσμένα): ο άνθρωπος βλέπει πού θα πέσει.
 */

import { useMemo, useRef } from 'react';

import { RING_MIN_VERTICES } from '@/lib/geometry/ring-edit';
import { SPACE_SNAP_PX, resolveSpacePoint } from '@/lib/spatial-tour/space-edit/space-edit-point';
import { penProposal } from '@/lib/spatial-tour/space-edit/tour-space-proposals';
import type { TourPlanXY } from '@/lib/spatial-tour/tour-graph-edit';
import type { TourViewerSpace } from '@/lib/spatial-tour/viewer/tour-viewer-shapes';

import { putProposal, setTool, updateSpaceEditor, type SpaceEditorStore } from './space-editor-store';
import { snapRings } from './useShapeEdit';
import type { SpaceMapReader } from './useSpaceMapReader';

export interface SpacePenContext {
  readonly store: SpaceEditorStore;
  readonly reader: SpaceMapReader;
  readonly spaces: readonly TourViewerSpace[];
  readonly planSize: { readonly width: number; readonly height: number };
  /** Οριστικό id του χώρου που θα γίνει (N.6). */
  readonly mintId: () => string;
}

export interface SpacePen {
  readonly hover: (clientX: number, clientY: number, shiftKey: boolean) => void;
  readonly leave: () => void;
  readonly click: (clientX: number, clientY: number, shiftKey: boolean) => void;
  /** Enter (κλείσιμο) · Backspace (πίσω μία) — `true` όταν το πλήκτρο ανήκε στην πένα (ο καλών κάνει `preventDefault`). */
  readonly key: (key: string) => boolean;
  /**
   * Ακύρωση (Esc): γωνίες ⇒ άδειασμα · άδεια ⇒ έξοδος από την πένα. Την καλεί ο **ένας** ιδιοκτήτης του Esc, το `onEscapeKeyDown`
   * του διαλόγου — καμία σύγκριση με ωμό πλήκτρο εδώ (CHECK 3.7 `escape-command-bus`).
   */
  readonly cancel: () => void;
}

interface Placed {
  readonly point: TourPlanXY;
  readonly metresPerPx: number;
}

function place(ctx: SpacePenContext, clientX: number, clientY: number, shiftKey: boolean): Placed | null {
  const reading = ctx.reader.read(clientX, clientY);
  if (reading === null) return null;
  const state = ctx.store.get();
  const shiftFrom = state.pen.at(-1) ?? null;
  const rings = [...snapRings(state, ctx.spaces), ...(state.pen.length > 0 ? [[...state.pen]] : [])];
  const { point } = resolveSpacePoint(reading.point, { rings, shiftFrom, shiftKey, metresPerPx: reading.metresPerPx, planSize: ctx.planSize });
  return { point, metresPerPx: reading.metresPerPx };
}

function close(ctx: SpacePenContext): boolean {
  const pen = ctx.store.get().pen;
  if (pen.length < RING_MIN_VERTICES) return false;
  updateSpaceEditor(ctx.store, (s) => setTool(putProposal(s, penProposal(pen, ctx.mintId()), true), 'select'));
  return true;
}

/** Κλικ κοντά στην πρώτη γωνία ⇒ κλείσιμο (σύμβαση Figma/Funda) — στην ίδια ανοχή οθόνης με την έλξη. */
function closesAtFirst(pen: readonly TourPlanXY[], at: Placed): boolean {
  const first = pen[0];
  return pen.length >= RING_MIN_VERTICES && first !== undefined
    && Math.hypot(at.point.x - first.x, at.point.y - first.y) <= SPACE_SNAP_PX * at.metresPerPx;
}

export function useSpacePen(ctx: SpacePenContext): SpacePen {
  const latest = useRef(ctx);
  latest.current = ctx;
  return useMemo<SpacePen>(() => ({
    hover: (clientX, clientY, shiftKey) => {
      const at = place(latest.current, clientX, clientY, shiftKey);
      updateSpaceEditor(latest.current.store, (s) => ({ ...s, penHover: at?.point ?? null }));
    },
    leave: () => updateSpaceEditor(latest.current.store, (s) => (s.penHover === null ? s : { ...s, penHover: null })),
    click: (clientX, clientY, shiftKey) => {
      const c = latest.current;
      const at = place(c, clientX, clientY, shiftKey);
      if (at === null) return;
      if (closesAtFirst(c.store.get().pen, at)) { close(c); return; }
      updateSpaceEditor(c.store, (s) => ({ ...s, pen: [...s.pen, at.point] }));
    },
    key: (key) => {
      const c = latest.current;
      if (key === 'Enter') return close(c);
      if (key === 'Backspace') {
        updateSpaceEditor(c.store, (s) => ({ ...s, pen: s.pen.slice(0, -1) }));
        return true;
      }
      return false;
    },
    cancel: () => updateSpaceEditor(latest.current.store, (s) => (s.pen.length > 0 ? { ...s, pen: [], penHover: null } : setTool(s, 'select'))),
  }), []);
}
