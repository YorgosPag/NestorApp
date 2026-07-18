/**
 * ADR-676 ΒΗΜΑ 2 — swept frame cross-section geometry.
 *
 * Verifies the κάσα skeleton SSoT (`frameBarLayout`) and the swept-extrude of an
 * arbitrary closed outline for both member orientations, in frame-LOCAL metres:
 *   +X = host axis · +Y = up · +Z = perp/depth.
 * The section outline is mm with origin at the member centerline (x = FACE, y = depth).
 */

import * as THREE from 'three';
import {
  frameBarLayout,
  buildFrameMemberGeometry,
  buildFrameProfileMembers,
  type FrameBarLayout,
} from '../opening-frame-section-geometry';
import type { ResolvedOpeningThreshold } from '../../../bim/types/opening-types';
import type { FrameSectionPoint } from '../../../bim/types/opening-frame-profile';

/** Closed 70×70 mm rectangle centred on the member centerline. */
const RECT_70: readonly FrameSectionPoint[] = [
  { x: -35, y: -35 }, { x: 35, y: -35 }, { x: 35, y: 35 }, { x: -35, y: 35 },
];

function bbox(geo: THREE.BufferGeometry): THREE.Box3 {
  geo.computeBoundingBox();
  return geo.boundingBox!;
}

describe('frameBarLayout — κάσα skeleton SSoT', () => {
  const render: ResolvedOpeningThreshold = { render: true, bottomOffsetMm: 0 };
  const noRender: ResolvedOpeningThreshold = { render: false, bottomOffsetMm: 0 };

  it('door (no sill, threshold render) → 2 jambs + head + κατώφλι = 4 bars', () => {
    const bars = frameBarLayout(0.9, 2.1, 0, 0.07, false, render);
    expect(bars).toHaveLength(4);
    expect(bars.filter((b) => b.orientation === 'vertical')).toHaveLength(2);
  });

  it('window (hasSill) → 2 jambs + head + sill = 4 bars', () => {
    expect(frameBarLayout(1.2, 1.4, 0.9, 0.07, true, noRender)).toHaveLength(4);
  });

  it('no sill AND threshold render:false → 3 bars (no bottom member)', () => {
    expect(frameBarLayout(0.9, 2.1, 0, 0.07, false, noRender)).toHaveLength(3);
  });

  it('jamb length tracks height, head length tracks width', () => {
    const bars = frameBarLayout(0.9, 2.1, 0, 0.07, false, noRender);
    expect(bars[0].orientation).toBe('vertical');
    expect(bars[0].length).toBeCloseTo(2.1, 6);
    expect(bars[2].orientation).toBe('horizontal');
    expect(bars[2].length).toBeCloseTo(0.9, 6);
  });
});

describe('buildFrameMemberGeometry — swept extrude', () => {
  it('vertical (jamb): face→X, depth→Z, sweep→Y, centred on center.cy', () => {
    const bar: FrameBarLayout = { center: { cx: 0, cy: 1.05, cz: 0 }, orientation: 'vertical', length: 2.1 };
    const bb = bbox(buildFrameMemberGeometry(RECT_70, bar)!);
    expect(bb.min.x).toBeCloseTo(-0.035, 4);
    expect(bb.max.x).toBeCloseTo(0.035, 4); // faceWidth 70mm along X
    expect(bb.min.z).toBeCloseTo(-0.035, 4);
    expect(bb.max.z).toBeCloseTo(0.035, 4); // depth 70mm along Z
    expect(bb.min.y).toBeCloseTo(0, 4);
    expect(bb.max.y).toBeCloseTo(2.1, 4); // length along Y, base at 0
  });

  it('horizontal (head): face→Y, depth→Z, sweep→X, centred on cx=0', () => {
    const bar: FrameBarLayout = { center: { cx: 0, cy: 2.05, cz: 0 }, orientation: 'horizontal', length: 0.9 };
    const bb = bbox(buildFrameMemberGeometry(RECT_70, bar)!);
    expect(bb.min.x).toBeCloseTo(-0.45, 4);
    expect(bb.max.x).toBeCloseTo(0.45, 4); // length 0.9m along X, centred on 0
    expect(bb.max.y - bb.min.y).toBeCloseTo(0.07, 4); // faceWidth 70mm along Y
    expect(bb.max.z - bb.min.z).toBeCloseTo(0.07, 4); // depth 70mm along Z
  });

  it('degenerate outline (<3 vertices) → null', () => {
    const bar: FrameBarLayout = { center: { cx: 0, cy: 0, cz: 0 }, orientation: 'vertical', length: 1 };
    expect(buildFrameMemberGeometry([{ x: 0, y: 0 }, { x: 1, y: 0 }], bar)).toBeNull();
  });
});

describe('buildFrameProfileMembers — one geometry per layout bar', () => {
  it('produces a geometry for every bar in the layout', () => {
    const layout = frameBarLayout(0.9, 2.1, 0, 0.07, false, { render: true, bottomOffsetMm: 0 });
    const geos = buildFrameProfileMembers(RECT_70, layout);
    expect(geos).toHaveLength(layout.length);
    expect(geos.every((g) => g.type === 'ExtrudeGeometry')).toBe(true);
  });
});
