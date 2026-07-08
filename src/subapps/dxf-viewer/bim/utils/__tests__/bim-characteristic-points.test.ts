/**
 * ADR-597 — `getBimCharacteristicPoints` SSoT dispatcher tests (Φ1).
 *
 * Verifies, per BIM entity family:
 *   - corners / midpoints / center delegate to the existing geometry SSoT,
 *   - linear entities (wall / beam) expose center = null,
 *   - area entities (slab / opening) expose a centroid center,
 *   - `labelRoot` is the noun-root for clean orthogonal footprints, and `null`
 *     for «περίεργα σχήματα» (curved / polyline / L / circular) → snap w/o label,
 *   - non-wired / non-BIM entities return the EMPTY shape.
 */

import {
  getBimCharacteristicPoints,
  getBimCharacteristicPointsOfCategory,
} from '../bim-characteristic-points';
import type { Entity } from '../../../types/entities';
import type { WallEntity, WallParams, WallKind } from '../../types/wall-types';
import type { BeamEntity, BeamParams } from '../../types/beam-types';
import type { SlabEntity } from '../../types/slab-types';
import type { OpeningEntity } from '../../types/opening-types';
import type { Polygon3D } from '../../types/bim-base';
import type { ColumnEntity, ColumnParams, ColumnKind } from '../../types/column-types';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';

// ─── Fixtures (mirror the per-anchor test factories) ─────────────────────────

function makeWall(overrides: Partial<WallParams> = {}, kind: WallKind = 'straight'): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0 },
    end: { x: 1000, y: 0 },
    height: 3000,
    thickness: 200,
    flip: false,
    ...overrides,
  } as WallParams;
  return {
    id: 'wall_1', type: 'wall', kind, layerId: '0', params,
    geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as WallEntity;
}

function makeBeam(overrides: Partial<BeamParams> = {}): BeamEntity {
  const params: BeamParams = {
    kind: 'straight',
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1000, y: 0 },
    width: 250, depth: 500, topElevation: 3000,
    ...overrides,
  };
  return {
    id: 'beam_1', type: 'beam', kind: params.kind, layerId: '0', params,
    geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as BeamEntity;
}

const SQUARE = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];

function makeSlab(vertices = SQUARE, type: 'slab' | 'slab-opening' = 'slab'): SlabEntity {
  const polygon: Polygon3D = { vertices: vertices.map(v => ({ x: v.x, y: v.y })) };
  return {
    id: 'slab_1', type, kind: 'floor', layerId: '0',
    params: { outline: { vertices: vertices.map(v => ({ x: v.x, y: v.y })) } } as never,
    geometry: { polygon, bbox: undefined as never, area: 0, netArea: 0, volume: 0, perimeter: 0 },
    validation: undefined as never, visible: true,
  } as unknown as SlabEntity;
}

const OPENING_RECT = [
  { x: 500, y: -125 }, { x: 1400, y: -125 }, { x: 1400, y: 125 }, { x: 500, y: 125 },
];

function makeOpening(vertices = OPENING_RECT): OpeningEntity {
  const outline: Polygon3D = { vertices: vertices.map(v => ({ x: v.x, y: v.y })) };
  return {
    id: 'opening_1', type: 'opening', kind: 'door', ifcType: 'IfcDoor', layerId: '0',
    params: { kind: 'door', wallId: 'wall_1', offsetFromStart: 500, width: 900, height: 2100, sillHeight: 0 },
    geometry: { position: { x: 950, y: 0 }, rotation: 0, outline, bbox: undefined as never, area: 1.89, perimeter: 6 },
    validation: undefined as never, visible: true,
  } as unknown as OpeningEntity;
}

function makeColumn(kind: ColumnKind, overrides: Partial<ColumnParams> = {}): ColumnEntity {
  const base = buildDefaultColumnParams({ x: 0, y: 0 }, kind);
  return {
    id: 'col_1', type: 'column', kind, layerId: '0',
    params: { ...base, ...overrides },
    geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as ColumnEntity;
}

// ─── Wall ────────────────────────────────────────────────────────────────────

describe('getBimCharacteristicPoints — wall', () => {
  it('straight wall: 4 corners + 4 edge midpoints + centroid + label "wall"', () => {
    const r = getBimCharacteristicPoints(makeWall());
    expect(r.corners).toHaveLength(4);
    expect(r.midpoints).toHaveLength(4);
    expect(r.center).toEqual({ x: 500, y: 0 });
    expect(r.labelRoot).toBe('wall');
  });

  it('curved wall: points present but NO label (περίεργο σχήμα → snap χωρίς κείμενο)', () => {
    const r = getBimCharacteristicPoints(makeWall({}, 'curved'));
    expect(r.corners.length).toBeGreaterThan(0);
    expect(r.labelRoot).toBeNull();
  });

  it('polyline wall: no label', () => {
    expect(getBimCharacteristicPoints(makeWall({}, 'polyline')).labelRoot).toBeNull();
  });
});

// ─── Beam ────────────────────────────────────────────────────────────────────

describe('getBimCharacteristicPoints — beam', () => {
  it('straight beam: 4 corners + 4 edge midpoints + centroid + label "beam"', () => {
    const r = getBimCharacteristicPoints(makeBeam());
    expect(r.corners).toHaveLength(4);
    expect(r.midpoints).toHaveLength(4);
    expect(r.center).toEqual({ x: 500, y: 0 });
    expect(r.labelRoot).toBe('beam');
  });

  it('curved beam: corners present but no label (περίεργο σχήμα)', () => {
    const r = getBimCharacteristicPoints(makeBeam({ kind: 'curved', curveControl: { x: 500, y: 300 } }));
    expect(r.corners).toHaveLength(4);
    expect(r.labelRoot).toBeNull();
  });
});

// ─── Slab ──────────────────────────────────────────────────────────────────

describe('getBimCharacteristicPoints — slab', () => {
  it('square slab: 4 corners + 4 edge midpoints + centroid + label "slab"', () => {
    const r = getBimCharacteristicPoints(makeSlab());
    expect(r.corners).toHaveLength(4);
    expect(r.midpoints).toHaveLength(4);
    // ADR-597 §non-convex-fix: area (shoelace) centroid — για convex ≈ vertex-mean με
    // αμελητέο floating error, άρα toBeCloseTo αντί ακριβούς toEqual.
    expect(r.center!.x).toBeCloseTo(500, 6);
    expect(r.center!.y).toBeCloseTo(500, 6);
    expect(r.labelRoot).toBe('slab');
  });

  it('slab-opening: label root "slabOpening"', () => {
    expect(getBimCharacteristicPoints(makeSlab(SQUARE, 'slab-opening')).labelRoot).toBe('slabOpening');
  });
});

// ─── Opening ─────────────────────────────────────────────────────────────────

describe('getBimCharacteristicPoints — opening', () => {
  it('door opening: 4 corners + edge midpoints + centroid + label "opening"', () => {
    const r = getBimCharacteristicPoints(makeOpening());
    expect(r.corners).toHaveLength(4);
    expect(r.midpoints).toHaveLength(4);
    expect(r.center).toEqual({ x: 950, y: 0 });
    expect(r.labelRoot).toBe('opening');
  });
});

// ─── Column ──────────────────────────────────────────────────────────────────

describe('getBimCharacteristicPoints — column', () => {
  it('rectangular column: 4 corners + 4 edge midpoints + centroid + label "column"', () => {
    const r = getBimCharacteristicPoints(makeColumn('rectangular'));
    expect(r.corners).toHaveLength(4);
    expect(r.midpoints).toHaveLength(4);
    expect(r.center).not.toBeNull();
    expect(r.center).toEqual({ x: 0, y: 0 });
    expect(r.labelRoot).toBe('column');
  });

  it('shear-wall column: labelled', () => {
    expect(getBimCharacteristicPoints(makeColumn('shear-wall')).labelRoot).toBe('column');
  });

  it('circular column: corners but no label (περίεργο σχήμα)', () => {
    const r = getBimCharacteristicPoints(makeColumn('circular'));
    expect(r.corners).toHaveLength(4);
    expect(r.labelRoot).toBeNull();
  });

  it('L-shape column: 6 REAL footprint corners (incl. reentrant) + 6 edge midpoints + centroid + label "column"', () => {
    // ADR-363 Φ1G.5 — the stationary L exposes its ACTUAL vertices (not the 4 bbox
    // corners) so a neighbour can magnet onto the notch/reentrant corner too.
    const r = getBimCharacteristicPoints(makeColumn('L-shape'));
    expect(r.corners).toHaveLength(6);
    expect(r.midpoints).toHaveLength(6);
    expect(r.center).not.toBeNull();
    // The reentrant corner sits strictly INSIDE the bbox on both axes — proof it is a
    // real vertex, not one of the 4 bounding-box corners.
    const xs = r.corners.map((c) => c.x), ys = r.corners.map((c) => c.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    expect(r.corners.some((c) => c.x > minX && c.x < maxX && c.y > minY && c.y < maxY)).toBe(true);
    // ADR-597 §L-label — μια L κολόνα δείχνει πλέον «Γωνία/Μέσο/Κέντρο κολόνας».
    expect(r.labelRoot).toBe('column');
    // ADR-597 §non-convex-fix — REGRESSION GUARD: τα midpoints είναι στις ΠΡΑΓΜΑΤΙΚΕΣ ακμές
    // (mid του κάθε ζεύγους διαδοχικών κορυφών), ΟΧΙ angular-sorted στο κενό/notch. Πριν το
    // fix, το angular sort έδινε διαφορετικά (εκτός σχήματος) midpoints → αυτό θα αποτύγχανε.
    const expectedMids = r.corners.map((c, i) => {
      const next = r.corners[(i + 1) % r.corners.length]!;
      return { x: (c.x + next.x) / 2, y: (c.y + next.y) / 2 };
    });
    expect(r.midpoints).toEqual(expectedMids);
    // §non-convex-fix — το κέντρο (area centroid) μένει ΜΕΣΑ στο bounding box (ο μέσος όρος
    // κορυφών θα μπορούσε να ξεφύγει· εδώ τουλάχιστον εγγυόμαστε εντός-bbox).
    expect(r.center!.x).toBeGreaterThanOrEqual(minX);
    expect(r.center!.x).toBeLessThanOrEqual(maxX);
    expect(r.center!.y).toBeGreaterThanOrEqual(minY);
    expect(r.center!.y).toBeLessThanOrEqual(maxY);
  });
});

// ─── Foundation (kind-aware labels + ALL-sides midpoints) ────────────────────

function makePadFoundation(): Entity {
  return {
    id: 'fnd_pad', type: 'foundation', kind: 'pad', layerId: '0',
    params: {
      kind: 'pad', topElevationMm: -1000, thicknessMm: 500,
      position: { x: 0, y: 0, z: 0 }, width: 1500, length: 2000,
      rotation: 0, anchor: 'center', profile: 'flat', sceneUnits: 'mm',
    },
  } as unknown as Entity;
}

function makeStripFoundation(): Entity {
  return {
    id: 'fnd_strip', type: 'foundation', kind: 'strip', layerId: '0',
    params: {
      kind: 'strip', topElevationMm: -1000, thicknessMm: 400,
      start: { x: 0, y: 0, z: 0 }, end: { x: 2000, y: 0, z: 0 }, width: 600, sceneUnits: 'mm',
    },
  } as unknown as Entity;
}

describe('getBimCharacteristicPoints — foundation', () => {
  it('pad: 4 corners + midpoints on ALL 4 sides + centroid + label "foundationPad"', () => {
    const r = getBimCharacteristicPoints(makePadFoundation());
    expect(r.corners).toHaveLength(4);
    expect(r.midpoints).toHaveLength(4);
    expect(r.center).not.toBeNull();
    expect(r.labelRoot).toBe('foundationPad');
  });

  it('strip (πεδιλοδοκός): 4 corners + midpoints on ALL 4 sides + label "foundationStrip"', () => {
    const r = getBimCharacteristicPoints(makeStripFoundation());
    expect(r.corners).toHaveLength(4);
    expect(r.midpoints).toHaveLength(4); // Giorgio: τα μέσα σε ΟΛΕΣ τις πλευρές, όχι 2
    expect(r.labelRoot).toBe('foundationStrip');
  });
});

// ─── Category accessor + non-wired ───────────────────────────────────────────

describe('getBimCharacteristicPointsOfCategory', () => {
  it('returns each category as a flat Point2D[]', () => {
    const wall = makeWall();
    expect(getBimCharacteristicPointsOfCategory(wall, 'corner')).toHaveLength(4);
    expect(getBimCharacteristicPointsOfCategory(wall, 'midpoint')).toHaveLength(4);
    expect(getBimCharacteristicPointsOfCategory(wall, 'center')).toHaveLength(1);
  });

  it('center category yields [center] for area entities', () => {
    expect(getBimCharacteristicPointsOfCategory(makeSlab(), 'center')).toHaveLength(1);
  });
});

describe('getBimCharacteristicPoints — non-wired / non-BIM', () => {
  it('non-BIM entity (line) → EMPTY shape', () => {
    const line = { id: 'l1', type: 'line', layerId: '0', visible: true } as unknown as Entity;
    const r = getBimCharacteristicPoints(line);
    expect(r.corners).toHaveLength(0);
    expect(r.midpoints).toHaveLength(0);
    expect(r.center).toBeNull();
    expect(r.labelRoot).toBeNull();
  });
});
