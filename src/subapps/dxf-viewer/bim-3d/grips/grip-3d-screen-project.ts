/**
 * grip-3d-screen-project.ts — PURE plan(mm) → canvas-local(px) projector for the 3D
 * reshape-grip OVERLAY (ADR-535 Φ5).
 *
 * Φ5 replaces the in-scene grip cubes (WebGL meshes) with a Canvas2D overlay that draws
 * the SAME 2D `UnifiedGripRenderer` — one render code, identical size/shape/colour, and
 * continuous (per-frame) zoom. This is the ONE projection SSoT shared by the overlay's
 * draw loop AND the controller's screen-space hit-test, so a grip is drawn and picked at
 * the exact same pixel.
 *
 * Reuses the `dxfPlanToWorld` + `createWorldToScreenProjector` coordinate SSoT. The projector
 * returns CLIENT px (it adds the canvas `rect.left/top`); the overlay canvas covers the viewport,
 * so we subtract its rect to land in CANVAS-LOCAL px (the renderer's draw space). Behind
 * the near plane (projector → null) we return an off-canvas sentinel so the batched draw
 * simply paints that grip out of view (the renderer can't skip a null position).
 *
 * **Δύο συμβάσεις για το ΙΔΙΟ ερώτημα, και γιατί ΔΕΝ ενοποιούνται** (ADR-717 Φ Γ): το
 * `screen-projection-clip` απαντά `null`, εδώ απαντάμε {@link GRIP_OFFSCREEN}. Το ερώτημα και το
 * κατώφλι είναι πλέον **κυριολεκτικά τα ίδια** (μία πηγή, `createScreenClipper`) — αυτό που
 * διαφέρει είναι το ΣΧΗΜΑ της απάντησης, γιατί ο `UnifiedGripRenderer` είναι κοινός με το 2D και
 * το συμβόλαιό του δέχεται `Point2D`, όχι `Point2D | null`. Ένωση των δύο θα σήμαινε είτε
 * `null`-checks μέσα στον κοινό renderer (μολύνει το 2D για ανάγκη του 3D) είτε sentinel στο
 * hit-test (όπου το «μακριά εκτός οθόνης» θα περνούσε για έγκυρη θέση). Ίδια απόφαση, δύο
 * κωδικοποιήσεις — τεκμηριωμένο, όχι τυχαίο.
 *
 * Pure Three.js + the coordinate SSoT — no React, no store, no scene mutation. Jest-friendly.
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import { dxfPlanToWorld, createWorldToScreenProjector } from '../viewport/coordinate-transforms';
import { addPoint3D } from '../../rendering/entities/shared/geometry-vector-utils';

/** Off-canvas sentinel for points behind the near plane (drawn out of view, never visible). */
export const GRIP_OFFSCREEN: Point2D = { x: -100000, y: -100000 };

/**
 * Per-grip top-surface elevation (mm) resolver keyed on a plan point. ADR-535 Φ5 — a
 * TILTED footprint has a different top-Z per vertex (slope plane), so each grip rides its
 * own elevation. Keyed on `Point2D` (not `GripInfo`) so the projector can lift any plan
 * point — vertices, edge-midpoints, and the live-dragged position alike.
 */
export type PlanElevationMmFor = (p: Point2D) => number;

/**
 * ADR-535 Φ10 / ADR-516 — a live RIGID-move world translation (THREE units) added to every
 * grip's world point before projection. During a gizmo MOVE drag the mesh is shifted by this
 * exact vector; applying the SAME shift to the grips keeps the squares glued to the moving
 * entity (ghost === grips, the big-player «handles follow the element» behaviour). `null` /
 * omitted on the static, hit-test, and per-vertex-reshape paths (no rigid offset there).
 */
export interface GripWorldOffset {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Sum two grip world-offsets (either may be null). Used to stack the live move-drag offset
 * (ADR-535 Φ10) onto the static TOP-surface tilt shear of a battered wall (ADR-535 Φ11), so the
 * top grips ride `base + tilt + move` while the bottom grips ride `base + move`. Returns null
 * when both are absent (the common vertical, static case → no offset work).
 */
export function addGripWorldOffsets(
  a: GripWorldOffset | null | undefined,
  b: GripWorldOffset | null | undefined,
): GripWorldOffset | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return addPoint3D(a, b);
}

/**
 * Lift a grip plan point (mm) + its surface elevation (mm) to a WORLD point, optionally
 * shifted by a live rigid-move `worldOffset` (ADR-535 Φ10). This is the ONE place that maps a
 * grip to world space — shared by BOTH the draw projector ({@link makeGripPlanToCanvas}) AND
 * the GPU occluder's visibility probe (use-grip-pass), so a grip is drawn, picked, and
 * occlusion-tested at the SAME world point during a move drag (no ghost/occlusion drift).
 */
export function liftGripPlanToWorld(
  p: Point2D,
  elevMm: number,
  worldOffset?: GripWorldOffset | null,
): THREE.Vector3 {
  const world = dxfPlanToWorld(p.x, p.y, elevMm);
  if (worldOffset) {
    // Fresh Vector3 from `dxfPlanToWorld` → safe to translate in place (ghost === grips).
    world.x += worldOffset.x;
    world.y += worldOffset.y;
    world.z += worldOffset.z;
  }
  return world;
}

/**
 * Build a plan(mm) → canvas-local(px) projector for the given camera + overlay canvas.
 * The returned closure is what the `UnifiedGripRenderer` calls as its `worldToScreen`
 * (it maps each grip's plan point to the overlay pixel). Lifts each point to its own
 * top-surface elevation via `elevFor` (+ optional rigid `worldOffset`, see
 * {@link liftGripPlanToWorld}), projects through the camera, and rebases to canvas-local px.
 * Behind-camera → {@link GRIP_OFFSCREEN}.
 */
export function makeGripPlanToCanvas(
  camera: THREE.Camera,
  canvas: HTMLElement,
  elevFor: PlanElevationMmFor,
  worldOffset?: GripWorldOffset | null,
): (p: Point2D) => Point2D {
  const rect = canvas.getBoundingClientRect();
  // ADR-717 Φ Γ — ο projector χτίζεται ΜΙΑ φορά, όχι ανά σημείο. Πριν, το closure καλούσε το
  // μονοδρομικό `worldToScreen`, δηλαδή `getBoundingClientRect()` **ανά λαβή ανά frame** — forced
  // layout flush μέσα στο overlay RAF (ADR-040: με τις twin λαβές είναι 2N flushes στα 60fps).
  const project = createWorldToScreenProjector(camera, canvas);
  return (p) => {
    const screen = project(liftGripPlanToWorld(p, elevFor(p), worldOffset));
    if (!screen) return GRIP_OFFSCREEN;
    return { x: screen.x - rect.left, y: screen.y - rect.top };
  };
}
