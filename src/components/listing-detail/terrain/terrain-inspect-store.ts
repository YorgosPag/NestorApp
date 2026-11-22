/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΕΠΙΘΕΩΡΗΣΗΣ ΕΔΑΦΟΥΣ** — ποιο σημείο δείχνεται, ποιο καρφιτσώθηκε, η γραμμή προφίλ, η σταγόνα
 *   νερού (ADR-920 §14.10).
 * @related lib/terrain/inspect/* (ο καθαρός πυρήνας — εδώ ΜΟΝΟ η κατάσταση) · `@/lib/state/createExternalStore` (SSoT pub/sub) ·
 *   components/catalog/imports/review-hover-store (το ίδιο σχήμα: εξωτερικό store + φύλλα με επιλογέα)
 * @module components/listing-detail/terrain/terrain-inspect-store
 *
 * 🔑 **Εξωτερικό store, όχι React state** (κανόνας ADR-040): μια κίνηση του ποντικιού γράφει εδώ μία φορά ανά καρέ· ξαναζωγραφίζει
 *   ΜΟΝΟ όποιο φύλλο άλλαξε απάντηση (σταυρόνημα, κάρτα, ζώνη υπομνήματος, γραμμή πίνακα, σκηνή 3Δ). Το `TerrainViewStage` και ο
 *   χάρτης **δεν** ξαναποδίδονται ποτέ από hover.
 * 🔑 **Ένα store ανά θεατή**, κοινό σε Κάτοψη και 3Δ: σημείο που δείχνεται στο προφίλ φαίνεται στον χάρτη ΚΑΙ στη σκηνή.
 * 🔑 Κάθε αλλαγή φτιάχνει **νέο** αντικείμενο μόνο για το πεδίο που άλλαξε — οι επιλογείς συγκρίνουν με ταυτότητα.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { createExternalStore } from '@/lib/state/createExternalStore';
import { traceFlowPath, type FlowPath } from '@/lib/terrain/inspect/terrain-flow-path';
import { terrainInspectIndexOf, type TerrainInspectIndex } from '@/lib/terrain/inspect/terrain-inspect-index';
import { readTerrainAt, type TerrainPointReading } from '@/lib/terrain/inspect/terrain-point-reading';
import { profilePointAt, terrainProfileOf, type TerrainProfile } from '@/lib/terrain/inspect/terrain-profile';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';

/** Τα εργαλεία, με τη σειρά του διακόπτη: «δείχνω σημείο» ή «σέρνω γραμμή προφίλ». Το ΕΝΑ λεξιλόγιο. */
export const TERRAIN_INSPECT_TOOLS = ['inspect', 'profile'] as const;
export type TerrainInspectTool = (typeof TERRAIN_INSPECT_TOOLS)[number];

export interface TerrainInspectState {
  readonly tool: TerrainInspectTool;
  /** Το σημείο κάτω από τον δείκτη / το δάχτυλο / το σταυρόνημα — `null` όταν δεν δείχνεται τίποτα. */
  readonly probe: TerrainPointReading | null;
  /** Το καρφιτσωμένο σημείο (κλικ / Enter) — μένει όταν ο δείκτης φύγει. */
  readonly pinned: TerrainPointReading | null;
  /** Η γραμμή προφίλ: τα άκρα της όπως ορίστηκαν, και η τομή (όταν το μήκος φτάνει). */
  readonly profileLine: { readonly a: PlanarPoint; readonly b: PlanarPoint } | null;
  readonly profile: TerrainProfile | null;
  /** Η απόσταση κατά μήκος της τομής που δείχνεται στο διάγραμμα. */
  readonly profileHoverS: number | null;
  /** Η διαδρομή της σταγόνας από το καρφιτσωμένο σημείο. */
  readonly flow: FlowPath | null;
}

export const TERRAIN_INSPECT_IDLE: TerrainInspectState = {
  tool: 'inspect', probe: null, pinned: null, profileLine: null, profile: null, profileHoverS: null, flow: null,
};

export interface TerrainInspectStore {
  /** Το ευρετήριο του snapshot — χτίζεται στην ΠΡΩΤΗ ερώτηση (ποτέ στην απόδοση της σελίδας), μετά είναι το ίδιο. */
  readonly index: () => TerrainInspectIndex;
  readonly get: () => TerrainInspectState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly probeAt: (x: number, y: number) => void;
  readonly clearProbe: () => void;
  /** Καρφιτσώνει το (x, y) — ή ξεκαρφιτσώνει, αν είναι εκτός επιφάνειας. */
  readonly pinAt: (x: number, y: number) => void;
  readonly unpin: () => void;
  readonly setTool: (tool: TerrainInspectTool) => void;
  readonly setProfileLine: (a: PlanarPoint, b: PlanarPoint) => void;
  readonly clearProfile: () => void;
  readonly hoverProfile: (s: number | null) => void;
  /** Ρίχνει σταγόνα από το καρφιτσωμένο σημείο (ή το δεικνυόμενο). */
  readonly dropWater: () => void;
}

/** Η ενεργή ανάγνωση: ό,τι δείχνεται τώρα, αλλιώς ό,τι καρφιτσώθηκε. */
export function activeReading(state: TerrainInspectState): TerrainPointReading | null {
  return state.probe ?? state.pinned;
}

function profileProbe(index: TerrainInspectIndex, profile: TerrainProfile | null, s: number | null): TerrainPointReading | null {
  if (profile === null || s === null) return null;
  const point = profilePointAt(profile, s);
  return readTerrainAt(index, point.x, point.y);
}

export function createTerrainInspectStore(snapshot: ListingTerrainSnapshot): TerrainInspectStore {
  const index = (): TerrainInspectIndex => terrainInspectIndexOf(snapshot);
  const store = createExternalStore<TerrainInspectState>(TERRAIN_INSPECT_IDLE, { equals: Object.is });
  const patch = (next: Partial<TerrainInspectState>): void => store.set({ ...store.get(), ...next });
  const read = (x: number, y: number): TerrainPointReading | null => readTerrainAt(index(), x, y);
  return {
    index,
    get: store.get,
    subscribe: store.subscribe,
    probeAt: (x, y) => patch({ probe: read(x, y) }),
    clearProbe: () => { if (store.get().probe !== null) patch({ probe: null }); },
    pinAt: (x, y) => patch({ pinned: read(x, y), flow: null }),
    unpin: () => patch({ pinned: null, flow: null }),
    setTool: (tool) => patch({ tool, probe: null }),
    setProfileLine: (a, b) => patch({ profileLine: { a, b }, profile: terrainProfileOf(index(), a, b), profileHoverS: null }),
    clearProfile: () => patch({ profileLine: null, profile: null, profileHoverS: null }),
    hoverProfile: (s) => patch({ profileHoverS: s, probe: profileProbe(index(), store.get().profile, s) }),
    dropWater: () => {
      const from = store.get().pinned ?? store.get().probe;
      if (from === null) return;
      patch({ pinned: from, flow: traceFlowPath(index(), from.x, from.y) });
    },
  };
}
