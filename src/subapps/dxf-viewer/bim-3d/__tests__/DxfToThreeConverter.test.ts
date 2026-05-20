/**
 * DxfToThreeConverter — unit tests (SPEC-3D-001, ADR-366 Phase 3).
 *
 * Tests cover:
 *  1. resolveEntityColor — full color cascade
 *  2. appendEntitySegments — geometry generation per entity type
 *  3. DxfToThreeConverter.sync() — integration (group lifecycle, visibility filter)
 *  4. getBounds() — bounding box semantics
 */

import * as THREE from 'three';
import {
  DxfToThreeConverter,
  resolveEntityColor,
  appendEntitySegments,
} from '../converters/DxfToThreeConverter';
import type { DxfEntityUnion, DxfLine, DxfCircle, DxfArc, DxfPolyline, DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneLayer } from '../../types/entities';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLine(opts: Partial<DxfLine> = {}): DxfLine {
  return {
    id: 'e_line',
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    visible: true,
    ...opts,
  };
}

function makeCircle(opts: Partial<DxfCircle> = {}): DxfCircle {
  return {
    id: 'e_circle',
    type: 'circle',
    center: { x: 0, y: 0 },
    radius: 5,
    visible: true,
    ...opts,
  };
}

function makeArc(opts: Partial<DxfArc> = {}): DxfArc {
  return {
    id: 'e_arc',
    type: 'arc',
    center: { x: 0, y: 0 },
    radius: 5,
    startAngle: 0,
    endAngle: 360,
    counterclockwise: true,
    visible: true,
    ...opts,
  };
}

function makePolyline(vertices: { x: number; y: number }[], closed = false): DxfPolyline {
  return {
    id: 'e_poly',
    type: 'polyline',
    vertices,
    closed,
    visible: true,
  };
}

function makeLayer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: 'lyr_test',
    name: 'TEST',
    color: '#ff0000',
    visible: true,
    locked: false,
    ...overrides,
  };
}

function makeScene(entities: DxfEntityUnion[], layersById?: Record<string, SceneLayer>): DxfScene {
  return {
    entities,
    layers: [],
    bounds: null,
    ...(layersById ? { layersById } : {}),
  };
}

// ── resolveEntityColor ────────────────────────────────────────────────────────

describe('resolveEntityColor', () => {
  it('TrueColor takes highest priority', () => {
    const entity = makeLine({ colorTrueColor: 0xABCDEF, color: '#ff0000' });
    expect(resolveEntityColor(entity, undefined)).toBe(0xABCDEF);
  });

  it('masks TrueColor to 24-bit', () => {
    const entity = makeLine({ colorTrueColor: 0xFF_FF0000 });
    expect(resolveEntityColor(entity, undefined)).toBe(0xFF0000);
  });

  it('ACI explicit color used when no TrueColor and concrete mode', () => {
    // ACI 1 = Red (#FF0000 = 0xFF0000)
    const entity = makeLine({ colorAci: 1 });
    expect(resolveEntityColor(entity, undefined)).toBe(0xFF0000);
  });

  it('concrete hex color used when no TrueColor / ACI', () => {
    const entity = makeLine({ color: '#00FF00' });
    expect(resolveEntityColor(entity, undefined)).toBe(0x00FF00);
  });

  it('ByLayer mode falls back to layer TrueColor', () => {
    const entity = makeLine({ colorMode: 'ByLayer', layerId: 'lyr_test' });
    const layer = makeLayer({ colorTrueColor: 0x123456 });
    expect(resolveEntityColor(entity, { lyr_test: layer })).toBe(0x123456);
  });

  it('ByLayer mode falls back to layer ACI (ACI wins over hex when both present)', () => {
    // ACI checked before color in layerColorToInt — ACI 3 = 0x00FF00 wins over color '#0000FF'.
    const entity = makeLine({ colorMode: 'ByLayer', layerId: 'lyr_test' });
    const layer = makeLayer({ colorAci: 3, color: '#0000FF' });
    expect(resolveEntityColor(entity, { lyr_test: layer })).toBe(0x00FF00);
  });

  it('ByLayer mode falls back to layer hex color', () => {
    const entity = makeLine({ colorMode: 'ByLayer', layerId: 'lyr_test' });
    const layer = makeLayer({ color: '#0000FF' });
    expect(resolveEntityColor(entity, { lyr_test: layer })).toBe(0x0000FF);
  });

  it('name-keyed layer lookup (legacy scenes)', () => {
    const entity = makeLine({ colorMode: 'ByLayer', layer: 'TEST' });
    const layer = makeLayer({ color: '#00FFFF' });
    expect(resolveEntityColor(entity, { TEST: layer })).toBe(0x00FFFF);
  });

  it('no layersById → white fallback', () => {
    const entity = makeLine({ colorMode: 'ByLayer' });
    expect(resolveEntityColor(entity, undefined)).toBe(0xffffff);
  });

  it('no color fields at all → white fallback', () => {
    const entity = makeLine();
    expect(resolveEntityColor(entity, undefined)).toBe(0xffffff);
  });

  it('ByBlock treated same as ByLayer', () => {
    const entity = makeLine({ colorMode: 'ByBlock', layerId: 'lyr_test' });
    const layer = makeLayer({ color: '#AABBCC' });
    expect(resolveEntityColor(entity, { lyr_test: layer })).toBe(0xAABBCC);
  });
});

// ── appendEntitySegments ──────────────────────────────────────────────────────

describe('appendEntitySegments', () => {
  it('line → 6 numbers (1 segment, 3 coords each endpoint)', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, makeLine({ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }));
    expect(buf).toHaveLength(6);
    // DXF y=0 → Z=0 (negated); DXF x=1 → X=1
    expect(buf).toEqual([0, 0, -0, 1, 0, -0]);
  });

  it('line maps DXF Y to negative Z', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, makeLine({ start: { x: 0, y: 3 }, end: { x: 0, y: 5 } }));
    // start: (0, 0, -3), end: (0, 0, -5)
    expect(buf[2]).toBeCloseTo(-3);
    expect(buf[5]).toBeCloseTo(-5);
  });

  it('circle → 48 segments = 288 numbers', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, makeCircle({ center: { x: 0, y: 0 }, radius: 1 }));
    expect(buf).toHaveLength(48 * 6);
  });

  it('circle segments form a closed ring (last end = first start)', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, makeCircle({ center: { x: 0, y: 0 }, radius: 1 }));
    // Last end point (buf[282], buf[283], buf[284]) = first start (buf[0], buf[1], buf[2])
    expect(buf[282]).toBeCloseTo(buf[0], 4);
    expect(buf[284]).toBeCloseTo(buf[2], 4);
  });

  it('full-circle arc → 48 segments (same as circle)', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, makeArc({ startAngle: 0, endAngle: 360, counterclockwise: true }));
    expect(buf).toHaveLength(48 * 6);
  });

  it('half arc (180°) → 24 segments', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, makeArc({ startAngle: 0, endAngle: 180, counterclockwise: true }));
    expect(buf).toHaveLength(24 * 6);
  });

  it('tiny arc → minimum 4 segments', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, makeArc({ startAngle: 0, endAngle: 1, counterclockwise: true }));
    expect(buf.length).toBeGreaterThanOrEqual(4 * 6);
  });

  it('open polyline (3 verts) → 2 segments = 12 numbers', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, makePolyline([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], false));
    expect(buf).toHaveLength(12);
  });

  it('closed polyline (3 verts) → 3 segments = 18 numbers', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, makePolyline([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], true));
    expect(buf).toHaveLength(18);
  });

  it('polyline with < 2 vertices → empty buffer', () => {
    const buf: number[] = [];
    appendEntitySegments(buf, makePolyline([{ x: 0, y: 0 }], false));
    expect(buf).toHaveLength(0);
  });

  it('wall entity (BIM) → skipped, no segments', () => {
    // DxfWall hits the default case — no geometry emitted.
    // Use unknown intermediate cast (not as any — TypeScript-sanctioned bypass for test stubs).
    const wall = { id: 'w1', type: 'wall', visible: true } as unknown as DxfEntityUnion;
    const buf: number[] = [];
    appendEntitySegments(buf, wall);
    expect(buf).toHaveLength(0);
  });
});

// ── DxfToThreeConverter (integration) ────────────────────────────────────────

describe('DxfToThreeConverter', () => {
  let scene: THREE.Scene;
  let converter: DxfToThreeConverter;

  beforeEach(() => {
    scene = new THREE.Scene();
    converter = new DxfToThreeConverter(scene);
  });

  afterEach(() => {
    converter.dispose();
  });

  it('sync(null) → scene has no dxf-wireframe group', () => {
    converter.sync(null);
    expect(scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe')).toBeUndefined();
  });

  it('sync with empty entities → no group added', () => {
    converter.sync(makeScene([]));
    expect(scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe')).toBeUndefined();
  });

  it('sync with line → dxf-wireframe group added to scene', () => {
    converter.sync(makeScene([makeLine({ color: '#ffffff' })]));
    expect(scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe')).toBeDefined();
  });

  it('sync with only invisible entities → no group added', () => {
    converter.sync(makeScene([makeLine({ visible: false })]));
    expect(scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe')).toBeUndefined();
  });

  it('sync twice → old group removed, new one added', () => {
    converter.sync(makeScene([makeLine({ color: '#ff0000' })]));
    const first = scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe');
    converter.sync(makeScene([makeLine({ color: '#00ff00' })]));
    const second = scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe');
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(scene.children.filter((c: { name: string }) => c.name === 'dxf-wireframe')).toHaveLength(1);
  });

  it('entities with different colors → multiple LineSegments children', () => {
    const entities: DxfEntityUnion[] = [
      makeLine({ id: 'e1', color: '#ff0000' }),
      makeLine({ id: 'e2', color: '#00ff00' }),
    ];
    converter.sync(makeScene(entities));
    const group = scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe') as { children: unknown[] };
    expect(group.children.length).toBe(2);
  });

  it('entities with same color → merged into one LineSegments', () => {
    const entities: DxfEntityUnion[] = [
      makeLine({ id: 'e1', color: '#ff0000' }),
      makeLine({ id: 'e2', color: '#ff0000' }),
    ];
    converter.sync(makeScene(entities));
    const group = scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe') as { children: unknown[] };
    expect(group.children.length).toBe(1);
  });

  it('dispose() removes group from scene and clears resources', () => {
    converter.sync(makeScene([makeLine({ color: '#ffffff' })]));
    expect(scene.children.length).toBeGreaterThan(0);
    converter.dispose();
    expect(scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe')).toBeUndefined();
  });
});

// ── getBounds() ───────────────────────────────────────────────────────────────

describe('getBounds', () => {
  let scene: THREE.Scene;
  let converter: DxfToThreeConverter;

  beforeEach(() => {
    scene = new THREE.Scene();
    converter = new DxfToThreeConverter(scene);
  });

  afterEach(() => {
    converter.dispose();
  });

  it('returns null before any sync', () => {
    expect(converter.getBounds()).toBeNull();
  });

  it('returns null after sync(null)', () => {
    converter.sync(null);
    expect(converter.getBounds()).toBeNull();
  });

  it('returns Box3 after syncing a line entity', () => {
    converter.sync(makeScene([makeLine({ start: { x: 0, y: 0 }, end: { x: 2, y: 0 }, color: '#ffffff' })]));
    const box = converter.getBounds();
    expect(box).not.toBeNull();
    expect(box).toBeInstanceOf(THREE.Box3);
  });

  it('bounding box min.x < max.x for a horizontal line', () => {
    converter.sync(makeScene([makeLine({ start: { x: -1, y: 0 }, end: { x: 1, y: 0 }, color: '#ffffff' })]));
    const box = converter.getBounds();
    expect(box!.min.x).toBeLessThan(box!.max.x);
  });

  it('returns null after dispose', () => {
    converter.sync(makeScene([makeLine({ color: '#ffffff' })]));
    converter.dispose();
    expect(converter.getBounds()).toBeNull();
  });
});
