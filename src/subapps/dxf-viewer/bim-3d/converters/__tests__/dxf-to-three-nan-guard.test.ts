/**
 * ADR-537 — DXF underlay NaN-guard (regression: empty 3D canvas).
 *
 * A single DXF entity with a non-finite coordinate used to poison the whole overlay `Box3`
 * (`getBounds` → `setFromObject`). Because `Box3.isEmpty()` is NaN-blind (`max < min` is `false`
 * when either side is NaN), the NaN box slipped into `viewport.frameBounds`, which NaN-framed the
 * SHARED camera → BOTH the DXF underlay AND the lit BIM scene vanished (blank 3D viewport).
 *
 * These tests lock the two source guards (`pushSeg` segment filter + finite-`getBounds`) so one
 * corrupt entity can never again nuke the camera. `frameBounds`'s own finite-guard is the third
 * (sink) layer, exercised by the viewport-camera path.
 */

import * as THREE from 'three';
import type { DxfScene, DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { appendEntitySegments, DxfToThreeConverter } from '../DxfToThreeConverter';
import { finiteBox3FromObject } from '../../scene/finite-bounds';

const meshFromPositions = (positions: number[]): THREE.Mesh => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
};

const line = (sx: number, sy: number, ex: number, ey: number): DxfEntityUnion =>
  ({ id: `l-${sx}-${sy}`, type: 'line', visible: true, start: { x: sx, y: sy }, end: { x: ex, y: ey } }) as unknown as DxfEntityUnion;

const scene = (entities: DxfEntityUnion[]): DxfScene =>
  ({ entities, layers: [], layersById: undefined, bounds: null, units: 'mm' }) as DxfScene;

const bufHasNaN = (buf: number[]): boolean => buf.some((n) => !Number.isFinite(n));

describe('appendEntitySegments — NaN source filter (pushSeg)', () => {
  it('drops a line whose coordinate is NaN', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, line(NaN, 0, 1000, 1000));
    expect(buf).toEqual([]);
  });

  it('drops a line whose coordinate is Infinity', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, line(0, 0, Infinity, 1000));
    expect(buf).toEqual([]);
  });

  it('keeps a fully-finite line', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, line(10, 20, 1000, 500));
    // DXF (x,y) → Three (x, 0, -y): [10,0,-20, 1000,0,-500]
    expect(buf).toEqual([10, 0, -20, 1000, 0, -500]);
    expect(bufHasNaN(buf)).toBe(false);
  });
});

describe('DxfToThreeConverter.getBounds — never returns a NaN box', () => {
  it('a valid line beside a NaN line → FINITE bounds (camera stays safe)', () => {
    const converter = new DxfToThreeConverter(new THREE.Scene());
    converter.sync(scene([line(NaN, 0, 1, 1), line(0, 0, 1000, 1000)]));
    const box = converter.getBounds();
    expect(box).not.toBeNull();
    for (const c of [box!.min.x, box!.min.y, box!.min.z, box!.max.x, box!.max.y, box!.max.z]) {
      expect(Number.isFinite(c)).toBe(true);
    }
  });

  it('a scene of ONLY NaN lines → null (no usable bounds), not a NaN box', () => {
    const converter = new DxfToThreeConverter(new THREE.Scene());
    converter.sync(scene([line(NaN, NaN, NaN, NaN)]));
    expect(converter.getBounds()).toBeNull();
  });
});

describe('finiteBox3FromObject — shared NaN-safe bounds SSoT (BIM + DXF sites)', () => {
  it('a mesh with a NaN vertex → null (would otherwise blank the viewport)', () => {
    expect(finiteBox3FromObject(meshFromPositions([0, 0, 0, NaN, 1, 1, 2, 2, 2]))).toBeNull();
  });

  it('a finite mesh → a finite box', () => {
    const box = finiteBox3FromObject(meshFromPositions([0, 0, 0, 1, 2, 3]));
    expect(box).not.toBeNull();
    expect(box!.max.y).toBe(2);
  });

  it('an empty object (no geometry) → null', () => {
    expect(finiteBox3FromObject(new THREE.Group())).toBeNull();
  });
});
