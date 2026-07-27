'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * useCameraProjectedMarkers (ADR-435 / ADR-650 M5α.2) — the SHARED «project these world points onto
 * the screen, and keep doing it while the camera moves» engine behind every 3D DOM marker overlay.
 *
 * It is the 3D half of what {@link ClashMarkerLayer} already centralised for the DOM half: the
 * layer owns rendering + imperative positioning, this hook owns the projection + the tick. What is
 * left in a marker overlay after both is only what actually differs — which store it reads and how
 * its domain converts to world coordinates.
 *
 * Extracted when the topography-QA markers landed (M5α.2): written as a mirror of the clash overlay
 * they reproduced its `project` and `subscribe` almost verbatim, and `jscpd --diff` flagged both
 * blocks inside the same commit (N.18). Two copies of a camera-signature comparison is exactly the
 * kind of twin that rots apart silently — one gets a fix for ortho zoom, the other does not.
 *
 * ### The two behaviours it owns
 *  - **Projection**: world (metres, Y-up) → client px through the LIVE camera, read at call time.
 *    `null` for a point behind the camera, and for a `null` slot — a marker whose world position
 *    could not be resolved is HIDDEN, never parked at the origin.
 *  - **The tick**: a LOW-priority `UnifiedFrameScheduler` subsystem that runs AFTER `bim-3d-scene`
 *    (so the camera is already updated this frame → zero-lag) and ONLY when the camera actually
 *    moved. Idle orbit-free frames cost nothing; zero React state, zero re-render on camera move.
 *
 * @see ../../components/dxf-layout/clash-markers/ClashMarkerLayer.tsx — the DOM half
 */

import { useCallback, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import type { WorldTriple } from '../viewport/plan-to-world-math';
import { UnifiedFrameScheduler, RENDER_PRIORITIES } from '../../rendering/core/UnifiedFrameScheduler';

/** Scratch — the projection never allocates per point (it runs per marker, per camera frame). */
const _tmp = new THREE.Vector3();

/** The two callbacks {@link ClashMarkerLayer} needs, ready to spread into it. */
export interface CameraProjectedMarkers {
  readonly project: (index: number) => { x: number; y: number } | null;
  readonly subscribe: (reproject: () => void) => () => void;
}

/** Camera zoom factor (perspective + ortho both expose `.zoom`); 1 otherwise. */
function cameraZoom(cam: THREE.Camera): number {
  return cam instanceof THREE.PerspectiveCamera || cam instanceof THREE.OrthographicCamera ? cam.zoom : 1;
}

/** Everything about the camera that can move a marker on screen, as a comparable string. */
function cameraSignature(cam: THREE.Camera): string {
  const p = cam.position;
  const q = cam.quaternion;
  return `${p.x},${p.y},${p.z},${q.x},${q.y},${q.z},${q.w},${cameraZoom(cam)}`;
}

/**
 * ADR-344 Φ-3D — ΤΟ tick «η κάμερα κουνήθηκε → ξαναπροβάλε», ως αυτόνομο SSoT.
 *
 * Ήταν inline μέσα στο {@link useCameraProjectedMarkers}. Εξάχθηκε όταν ο in-place text
 * editor χρειάστηκε ΑΚΡΙΒΩΣ αυτό το tick αλλά με δική του `project` (λύνει την οντότητα από
 * id τη στιγμή του tick, αντί να προβάλλει προϋπολογισμένο πίνακα σημείων). Χωρίς την
 * εξαγωγή, ο editor θα ξανάγραφε το camera-signature diffing + την εγγραφή στον scheduler —
 * το κλασικό δίδυμο που το ένα αντίγραφο μαθαίνει το ortho zoom και το άλλο όχι (N.18).
 *
 * LOW priority: τρέχει ΜΕΤΑ το `bim-3d-scene`, οπότε η κάμερα είναι ήδη ενημερωμένη αυτό το
 * frame → μηδέν καθυστέρηση. Καρέ χωρίς κίνηση κάμερας δεν κοστίζουν τίποτα.
 *
 * `subsystemId` πρέπει να είναι μοναδικό ανά καταναλωτή — ονομάζει το subsystem του scheduler.
 */
export function subscribeToCameraMoves(
  getCamera: () => THREE.Camera | null,
  subsystemId: string,
  subsystemLabel: string,
): (reproject: () => void) => () => void {
  return (reproject) => {
    let lastSig = '';
    const unregister = UnifiedFrameScheduler.register(
      subsystemId,
      subsystemLabel,
      RENDER_PRIORITIES.LOW,
      () => reproject(),
      () => {
        const camera = getCamera();
        if (!camera) return false;
        const sig = cameraSignature(camera);
        if (sig === lastSig) return false;
        lastSig = sig;
        return true;
      },
    );
    reproject();
    return unregister;
  };
}

/**
 * Project `worlds` through the live camera and reproject them whenever it moves.
 *
 * `worlds` must be a stable reference (memoise it on the report), and `subsystemId` /
 * `subsystemLabel` must be unique per overlay — they name the scheduler subsystem.
 */
export function useCameraProjectedMarkers(
  managerRef: MutableRefObject<ThreeJsSceneManager | null>,
  worlds: readonly (WorldTriple | null)[],
  subsystemId: string,
  subsystemLabel: string,
): CameraProjectedMarkers {
  const project = useCallback((index: number): { x: number; y: number } | null => {
    const world = worlds[index];
    const manager = managerRef.current;
    if (!world || !manager) return null;
    const rect = manager.getRendererCanvas().getBoundingClientRect();
    _tmp.set(world.x, world.y, world.z).project(manager.getCamera());
    if (_tmp.z > 1) return null; // behind the camera
    return {
      x: rect.left + (_tmp.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-_tmp.y * 0.5 + 0.5) * rect.height,
    };
  }, [worlds, managerRef]);

  const subscribe = useMemo(
    () => subscribeToCameraMoves(
      () => managerRef.current?.getCamera() ?? null,
      subsystemId,
      subsystemLabel,
    ),
    [managerRef, subsystemId, subsystemLabel],
  );

  return { project, subscribe };
}
