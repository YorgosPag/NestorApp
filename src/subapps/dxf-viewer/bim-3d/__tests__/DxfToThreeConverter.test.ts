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

  it('legacy name-only entity (no layerId) → DEFAULT white (id-only resolution, ADR-358 9D-5a)', () => {
    // `resolveLayer` is id-only — the legacy `entity.layer` name backref was removed
    // (ADR-358 Phase 9D-5a). A name-only entity no longer resolves to a layer color and
    // falls through to DEFAULT (white). The id-based path is covered by the test above.
    const entity = makeLine({ colorMode: 'ByLayer', layer: 'TEST' });
    const layer = makeLayer({ color: '#00FFFF' });
    expect(resolveEntityColor(entity, { TEST: layer })).toBe(0xFFFFFF);
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
    // 48 segments × 6 = 288 numbers. The LAST segment (idx 47) occupies buf[282..287]:
    // its start = buf[282..284] (angle 47/48·360°), its END = buf[285..287] (angle 360°).
    // The ring closes when the last segment's END equals the first segment's START.
    expect(buf[285]).toBeCloseTo(buf[0], 4);
    expect(buf[287]).toBeCloseTo(buf[2], 4);
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

// ── syncMultiFloor (ADR-399 Phase B — stacked per-floor overlay) ──────────────

describe('DxfToThreeConverter.syncMultiFloor', () => {
  let scene: THREE.Scene;
  let converter: DxfToThreeConverter;

  const findRoot = () =>
    scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe-multifloor') as
      | { children: { position: { y: number } }[] }
      | undefined;

  beforeEach(() => {
    scene = new THREE.Scene();
    converter = new DxfToThreeConverter(scene);
  });
  afterEach(() => converter.dispose());

  it('builds one positioned floor group per entry at floorElevationMm × 0.001', () => {
    converter.syncMultiFloor([
      { scene: makeScene([makeLine({ color: '#ff0000' })]), floorElevationMm: 0 },
      { scene: makeScene([makeLine({ color: '#00ff00' })]), floorElevationMm: 3000 },
    ]);
    const root = findRoot();
    expect(root).toBeDefined();
    expect(root!.children.length).toBe(2);
    expect(root!.children.map((g) => g.position.y)).toEqual([0, 3]);
  });

  it('skips floors whose scene has no drawable entities', () => {
    converter.syncMultiFloor([
      { scene: makeScene([makeLine({ color: '#ff0000' })]), floorElevationMm: 0 },
      { scene: makeScene([]), floorElevationMm: 3000 },
    ]);
    expect(findRoot()!.children.length).toBe(1);
  });

  it('empty entries → no group added', () => {
    converter.syncMultiFloor([]);
    expect(findRoot()).toBeUndefined();
  });

  it('switching single → multi-floor disposes the prior overlay', () => {
    converter.sync(makeScene([makeLine({ color: '#ffffff' })]));
    converter.syncMultiFloor([{ scene: makeScene([makeLine({ color: '#ff0000' })]), floorElevationMm: 0 }]);
    expect(scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe')).toBeUndefined();
    expect(findRoot()).toBeDefined();
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

  it('default (mm) units: getBounds returns metre-scale world coords', () => {
    // 1000 mm line → 1 m in Three.js world space
    const scene1000mm: DxfScene = {
      entities: [makeLine({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, color: '#ffffff' })],
      layers: [], bounds: null,
    };
    converter.sync(scene1000mm);
    const box = converter.getBounds();
    expect(box).not.toBeNull();
    expect(box!.max.x).toBeCloseTo(1.0, 5);
  });

  it('explicit m units: getBounds returns unchanged metre coords', () => {
    const sceneMetres: DxfScene = {
      entities: [makeLine({ start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, color: '#ffffff' })],
      layers: [], bounds: null,
      units: 'm',
    };
    converter.sync(sceneMetres);
    const box = converter.getBounds();
    expect(box).not.toBeNull();
    expect(box!.max.x).toBeCloseTo(5.0, 5);
  });

  it('cm units: getBounds returns metre-scale world coords', () => {
    // 100 cm → 1 m
    const sceneCm: DxfScene = {
      entities: [makeLine({ start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, color: '#ffffff' })],
      layers: [], bounds: null,
      units: 'cm',
    };
    converter.sync(sceneCm);
    const box = converter.getBounds();
    expect(box).not.toBeNull();
    expect(box!.max.x).toBeCloseTo(1.0, 5);
  });
});
