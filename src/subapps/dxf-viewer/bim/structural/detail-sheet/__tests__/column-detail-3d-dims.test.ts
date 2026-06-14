/**
 * ADR-457 Slice 3 — 3D dimension annotations builder tests.
 *
 * The offscreen WebGL render is not runnable in jsdom, but the annotation GROUP
 * (dimension lines + label sprites) is plain three.js geometry → unit-testable:
 * a rectangular reinforced column yields W/D/H leaders (3 sprites + a line set),
 * unsupported kinds / degenerate height yield null.
 */

import * as THREE from 'three';
import { buildColumnDimAnnotations } from '../render/column-detail-3d-dims';
import type { ColumnParams, ColumnEntity } from '../../../types/column-types';

function column(params: ColumnParams): ColumnEntity {
  return { id: 'c1', type: 'column', ifcType: 'IfcColumn', params } as ColumnEntity;
}

const RECT: ColumnParams = {
  kind: 'rectangular',
  position: { x: 0, y: 0, z: 0 },
  anchor: 'center',
  width: 400,
  depth: 600,
  height: 3000,
  rotation: 0,
  reinforcement: {
    longitudinal: { diameterMm: 16, count: 8 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
    coverMm: 25,
  },
};

function countSprites(group: THREE.Object3D): number {
  let n = 0;
  group.traverse((o) => { if (o instanceof THREE.Sprite) n += 1; });
  return n;
}

describe('buildColumnDimAnnotations (ADR-457 Slice 3)', () => {
  it('builds W/D/H leaders (3 labels + a line set) for a rectangular column', () => {
    const group = buildColumnDimAnnotations(column(RECT));
    expect(group).not.toBeNull();
    expect(countSprites(group!)).toBe(3);
    let lineSets = 0;
    group!.traverse((o) => { if (o instanceof THREE.LineSegments) lineSets += 1; });
    expect(lineSets).toBe(1);
  });

  it('returns null for a non-rectangular column', () => {
    expect(buildColumnDimAnnotations(column({ ...RECT, kind: 'circular' }))).toBeNull();
  });

  it('returns null for a degenerate (zero) height', () => {
    expect(buildColumnDimAnnotations(column({ ...RECT, height: 0 }))).toBeNull();
  });
});
