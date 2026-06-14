/**
 * ADR-455 — axis-cut composition helpers (PURE, no stores → unit-testable).
 *
 * Extracted from {@link SectionSceneController} so that file stays under the 500-line
 * limit (N.7.1). These functions own the bookkeeping for composing up to three
 * simultaneous axis cut planes (Z horizontal + X + Y vertical) with the section
 * box / crop planes, the fast-path "only the constant moved" detection, and the
 * 6-plane clip composition (cuts first, so they survive the Three.js hard limit).
 */

import * as THREE from 'three';
import { buildAxisCutPlane, type CutAxis } from './cut-plane-3d-math';
import type { ResolvedAxisCut } from './cut-plane-3d';

/** Three.js hard limit on simultaneous clipping planes per material. */
const MAX_CLIP_PLANES = 6;

/**
 * One active axis cut held by the controller. `plane` is MUTABLE: the fast path
 * mutates `plane.constant` in place so the materials (which reference this exact
 * instance) follow a slider drag without a per-mesh `needsUpdate`.
 */
export interface AxisCutEntry {
  readonly axis: CutAxis;
  readonly sign: 1 | -1;
  plane: THREE.Plane;
}

/** The clip-plane constant for a resolved cut (uniform across axes: `sign·coord`). */
export function axisCutConstant(cut: ResolvedAxisCut): number {
  return cut.sign * cut.worldCoordM;
}

/**
 * Reconcile resolved cuts against the existing entries: REUSE an entry's plane
 * instance when axis+sign are unchanged (mutate its constant in place so the
 * material reference stays valid), create a fresh plane only when the composition
 * changes. Returns the new ordered entry list (matching `resolved` order).
 */
export function composeCutEntries(
  resolved: ResolvedAxisCut[],
  existing: AxisCutEntry[],
): AxisCutEntry[] {
  return resolved.map((cut) => {
    const reuse = existing.find((e) => e.axis === cut.axis && e.sign === cut.sign);
    if (reuse) {
      reuse.plane.constant = axisCutConstant(cut);
      return reuse;
    }
    return { axis: cut.axis, sign: cut.sign, plane: buildAxisCutPlane(cut.axis, cut.worldCoordM, cut.sign) };
  });
}

/**
 * Composition key fragment for the active cuts — axes + signs ONLY, deliberately
 * excluding the positions (constants). Identical across a pure slider drag ⇒ the
 * controller takes the fast path (mutate constants in place).
 */
export function axisCutCompositionKey(resolved: ResolvedAxisCut[]): string {
  return resolved.map((c) => `${c.axis}${c.sign > 0 ? '+' : '-'}`).join(',');
}

/**
 * Per-frame motion detector: did the set OR any constant of the active cuts change
 * since the last rendered frame? A length change (an axis toggled) counts as moved.
 */
export function detectCutMoving(constants: number[], last: number[]): boolean {
  if (constants.length !== last.length) return true;
  for (let i = 0; i < constants.length; i++) {
    if (constants[i] !== last[i]) return true;
  }
  return false;
}

/**
 * Compose the final clip-plane list: axis CUTS FIRST, then section-box, then crop —
 * capped at the Three.js 6-plane limit. Cuts-first guarantees every active cut
 * survives even when a full 6-plane section box is also present (rare combo). When
 * the total exceeds 6 the surplus (box/crop) planes are dropped; the caller warns.
 */
export function composeClipPlanes(
  cutPlanes: THREE.Plane[],
  sectionPlanes: THREE.Plane[],
  cropPlanes: THREE.Plane[],
): THREE.Plane[] {
  return [...cutPlanes, ...sectionPlanes, ...cropPlanes].slice(0, MAX_CLIP_PLANES);
}

export { MAX_CLIP_PLANES };
