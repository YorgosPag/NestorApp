'use client';

/**
 * ADR-363 — Draft («προεπιλογές νέου τοίχου») bridge για το αριστερό property
 * panel όταν το εργαλείο «Τοίχος» είναι ενεργό ΧΩΡΙΣ επιλεγμένη οντότητα.
 *
 * Revit-grade «set the type, then draw»: το πλήρες property panel (ΣΥΝΘΕΣΗ
 * ΣΤΡΩΣΕΩΝ / Πυρήνας / Πάχος) δουλεύει πάνω σε έναν **εικονικό** `WallEntity`
 * φτιαγμένο από τα draw-defaults (`wallToolBridgeStore.overrides`) — ΠΟΤΕ δεν
 * μπαίνει στη scene. Κάθε αλλαγή γράφεται πίσω στα overrides μέσω
 * `setParamOverrides`, ώστε ο **επόμενος** σχεδιασμένος τοίχος να γεννιέται με
 * αυτή τη σύνθεση (`buildDefaultWallParams` τιμά πλέον το `overrides.dna`).
 *
 * FULL SSoT — μηδέν νέο store, μηδέν νέα param-resolution:
 *   - reuse `wallToolBridgeStore` (το ΙΔΙΟ draw-defaults SSoT που οδηγεί ήδη το
 *     πάνω contextual ribbon tab μέσω `useRibbonWallBridge`),
 *   - reuse `buildDefaultWallParams` + `buildWallEntity` για τον draft entity,
 *   - ο draft `dispatchPatch` map-άρει `WallParamsPatch` → `WallParamOverrides`
 *     (merge-semantics του `setParamOverrides`) αντί για `UpdateWallParamsCommand`.
 *
 * Low-freq subscription (user-driven) — αριστερό panel, ΟΧΙ canvas micro-leaf →
 * ADR-040-safe (`useSyncExternalStore` επιτρέπεται εκτός high-freq path).
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { DXF_DEFAULT_LAYER } from '../../../config/layer-config';
import type { Point2D } from '../../../rendering/types/Types';
import type { WallEntity } from '../../../bim/types/wall-types';
import {
  buildDefaultWallParams,
  buildWallEntity,
  type WallParamOverrides,
} from '../../../hooks/drawing/wall-completion';
import { wallToolBridgeStore } from '../../ribbon/hooks/bridge/wall-tool-bridge-store';
import type {
  DispatchWallParamPatch,
  WallParamsPatch,
} from '../commands/dispatchWallParamPatch';

// Εικονικό 1m οριζόντιο τμήμα (mm) — γεωμετρικά έγκυρο ώστε το `buildWallEntity`
// να μην απορρίπτει τον draft (zero-length → hard error). Τα σημεία δεν φαίνονται
// πουθενά· μόνο τα params (dna/category/thickness) τροφοδοτούν το panel UI.
const DRAFT_START: Readonly<Point2D> = { x: 0, y: 0 };
const DRAFT_END: Readonly<Point2D> = { x: 1000, y: 0 };

export interface WallDraftBinding {
  /** Εικονικός τοίχος-προεπιλογή (rebuilt σε κάθε αλλαγή των draw-defaults). */
  readonly wall: WallEntity;
  /** Γράφει τις αλλαγές του panel πίσω στα draw-defaults (overrides). */
  readonly dispatchPatch: DispatchWallParamPatch;
}

/**
 * Μετάφραση ενός `WallParamsPatch` (από τον DNA editor / sections) στα μόνο πεδία
 * που κατέχει το draw-defaults SSoT (`WallParamOverrides`). `'dna' in patch`
 * διακρίνει το «detach» (`dna: undefined`) από «απών κλειδί».
 */
function patchToOverrides(patch: WallParamsPatch): WallParamOverrides {
  return {
    ...('dna' in patch ? { dna: patch.dna ?? undefined } : {}),
    ...(patch.thickness !== undefined ? { thickness: patch.thickness } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.height !== undefined ? { height: patch.height } : {}),
    ...(patch.flip !== undefined ? { flip: patch.flip } : {}),
    ...('tilt' in patch ? { tilt: patch.tilt } : {}),
  };
}

/**
 * Επιστρέφει το draft binding όταν υπάρχει δημοσιευμένο wall-tool handle (το
 * εργαλείο τοίχου είναι mounted), αλλιώς `null` (ο router πέφτει σε empty state).
 */
export function useWallDraftFromBridge(): WallDraftBinding | null {
  const handle = useSyncExternalStore(
    wallToolBridgeStore.subscribe,
    wallToolBridgeStore.get,
    wallToolBridgeStore.get,
  );

  const wall = useMemo<WallEntity | null>(() => {
    if (!handle) return null;
    const params = buildDefaultWallParams(DRAFT_START, DRAFT_END, handle.overrides, 'mm');
    const result = buildWallEntity(params, DXF_DEFAULT_LAYER, 'straight', 'mm');
    return result.ok ? result.entity : null;
  }, [handle]);

  const dispatchPatch = useCallback<DispatchWallParamPatch>((_wall, patch) => {
    const h = wallToolBridgeStore.get();
    if (!h) return;
    h.setParamOverrides(patchToOverrides(patch));
  }, []);

  return wall ? { wall, dispatchPatch } : null;
}
