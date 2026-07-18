/**
 * Opening frame — swept realistic cross-section geometry (ADR-676 ΒΗΜΑ 2).
 *
 * The κάσα is 2 jambs + πρέκι + (ποδιά Ή κατώφλι). Each member is a constant
 * cross-section swept along its length. Historically that cross-section was a
 * plain `faceWidth × depth` rectangle → `BoxGeometry`. This module adds the
 * **realistic** path: an OPTIONAL closed 2D outline (`FrameSectionPoint[]`, mm,
 * origin at the member centerline, x = across the FACE, y = through the depth)
 * that is extruded along the member length — the Revit *Profile Family* /
 * ArchiCAD *Complex Profile* / C4D constant-cross-section model.
 *
 * SSoT split:
 *   - `frameBarLayout()` — the ONE source for jamb/head/sill CENTER + ORIENTATION
 *     + LENGTH. Consumed BOTH by the legacy box path (`opening-mesh.ts` maps it to
 *     `BoxSpec`) AND by the extrude path here, so the two can never diverge.
 *   - `buildFrameProfileMembers()` — extrudes the section for each layout bar,
 *     returning frame-LOCAL `BufferGeometry[]` (the caller applies the opening
 *     basis + placement, exactly like the box path).
 *
 * Units: outline is mm → world metres via `MM_TO_M` (parity with every converter).
 * Frame-local coords match `opening-mesh.ts`: +X = host axis, +Y = up, +Z = perp.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-676-opening-component-library-parametric.md §2.4
 * @see bim-3d/converters/beam-ishape-geometry.ts — sibling swept-profile builder
 */

import * as THREE from 'three';
import type { FrameSectionPoint } from '../../bim/types/opening-frame-profile';
import type { ResolvedOpeningThreshold } from '../../bim/types/opening-types';
import { buildClosedShape } from './bim-three-shape-helpers';

/** mm → world metres (same factor as `opening-mesh.ts` / every converter). */
const MM_TO_M = 0.001;

export type FrameBarOrientation = 'vertical' | 'horizontal';

/** Frame-local center of a κάσα member (metres). */
export interface FrameBarCenter {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
}

/**
 * A single κάσα member's placement skeleton — the SSoT both representations
 * (box + swept extrude) derive from. `length` is metres along the member's
 * length axis (jamb → vertical/+Y, head/sill → horizontal/+X).
 */
export interface FrameBarLayout {
  readonly center: FrameBarCenter;
  readonly orientation: FrameBarOrientation;
  readonly length: number;
}

/**
 * The κάσα skeleton: 2 jambs (vertical, span `heightM`) + head (horizontal, span
 * `widthW`) + ONE bottom member (sill Ή κατώφλι, mutually exclusive — ADR-673).
 * Mirrors the pre-ADR-676 `frameBars()` positions EXACTLY so the box path output
 * is byte-identical.
 */
export function frameBarLayout(
  widthW: number,
  heightM: number,
  sillM: number,
  faceWidthW: number,
  hasSill: boolean,
  threshold: ResolvedOpeningThreshold,
): FrameBarLayout[] {
  const cyMid = sillM + heightM / 2;
  const halfW = widthW / 2;
  const bars: FrameBarLayout[] = [
    { center: { cx: -(halfW - faceWidthW / 2), cy: cyMid, cz: 0 }, orientation: 'vertical', length: heightM },
    { center: { cx: halfW - faceWidthW / 2, cy: cyMid, cz: 0 }, orientation: 'vertical', length: heightM },
    { center: { cx: 0, cy: sillM + heightM - faceWidthW / 2, cz: 0 }, orientation: 'horizontal', length: widthW },
  ];
  if (hasSill) {
    bars.push({ center: { cx: 0, cy: sillM + faceWidthW / 2, cz: 0 }, orientation: 'horizontal', length: widthW });
  } else if (threshold.render) {
    const cy = threshold.bottomOffsetMm * MM_TO_M + faceWidthW / 2;
    bars.push({ center: { cx: 0, cy, cz: 0 }, orientation: 'horizontal', length: widthW });
  }
  return bars;
}

// Per-orientation local basis: which frame-local axis the section's face (x) and
// depth (y) coords map to, and which axis the profile sweeps along.
//   vertical (jamb):   face→+X, depth→+Z, sweep→+Y (height)
//   horizontal (head): face→+Y, depth→+Z, sweep→+X (width)
const ORIENTATION_AXES: Record<
  FrameBarOrientation,
  { readonly face: THREE.Vector3; readonly depth: THREE.Vector3; readonly length: THREE.Vector3 }
> = {
  vertical: { face: new THREE.Vector3(1, 0, 0), depth: new THREE.Vector3(0, 0, 1), length: new THREE.Vector3(0, 1, 0) },
  horizontal: { face: new THREE.Vector3(0, 1, 0), depth: new THREE.Vector3(0, 0, 1), length: new THREE.Vector3(1, 0, 0) },
};

/**
 * Extrude the section outline along one member and return frame-LOCAL geometry
 * (the caller applies the opening basis). Returns `null` for a degenerate outline.
 */
export function buildFrameMemberGeometry(
  section: readonly FrameSectionPoint[],
  bar: FrameBarLayout,
): THREE.BufferGeometry | null {
  const shape = buildClosedShape(section.map((p) => ({ x: p.x * MM_TO_M, y: p.y * MM_TO_M })));
  if (!shape) return null;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: bar.length, bevelEnabled: false });
  geo.translate(0, 0, -bar.length / 2); // centre the sweep on the member midpoint
  const ax = ORIENTATION_AXES[bar.orientation];
  const m = new THREE.Matrix4().makeBasis(ax.face, ax.depth, ax.length);
  m.setPosition(bar.center.cx, bar.center.cy, bar.center.cz);
  geo.applyMatrix4(m);
  return geo;
}

/**
 * Build the swept frame members for a whole κάσα skeleton. Frame-local geometry;
 * degenerate members are skipped. Empty when the outline is degenerate everywhere.
 */
export function buildFrameProfileMembers(
  section: readonly FrameSectionPoint[],
  layout: readonly FrameBarLayout[],
): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  for (const bar of layout) {
    const geo = buildFrameMemberGeometry(section, bar);
    if (geo) geos.push(geo);
  }
  return geos;
}
