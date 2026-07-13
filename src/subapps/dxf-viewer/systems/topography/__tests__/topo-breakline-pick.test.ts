/**
 * ADR-650 M2 μέρος Β — breakline z-resolution ground truth.
 *
 * Η κρίσιμη διάκριση του Civil 3D: **standard** breakline (η γραμμή κουβαλά `elevation`)
 * vs **proximity** breakline (2D γραμμή → z από το πλησιέστερο μετρημένο σημείο). Αν οι δύο
 * δρόμοι μπερδευτούν, η επιφάνεια βγαίνει «σωστή στην όψη» αλλά λάθος στα υψόμετρα — ακριβώς
 * το είδος σφάλματος που φεύγει σε παραγωγή. Γι' αυτό ελέγχεται με νούμερα, όχι με shape.
 */

import { buildBreaklineFromEntity, isBreaklineCandidate } from '../topo-breakline-pick';
import type { TopoPoint } from '../topo-types';
import type { Entity, LineEntity, LWPolylineEntity, PolylineEntity } from '../../../types/entities';

const line = (v: Partial<LineEntity> = {}): LineEntity => ({
  id: 'l1', type: 'line', layerId: '0',
  start: { x: 0, y: 0 }, end: { x: 100, y: 0 },
  ...v,
});

const lwpolyline = (v: Partial<LWPolylineEntity> = {}): LWPolylineEntity => ({
  id: 'lw1', type: 'lwpolyline', layerId: '0',
  vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
  ...v,
});

const polyline = (v: Partial<PolylineEntity> = {}): PolylineEntity => ({
  id: 'p1', type: 'polyline', layerId: '0',
  vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  ...v,
});

/** Δύο σημεία με ΞΕΚΑΘΑΡΑ διαφορετικά z, ώστε η «πλησιέστερη» επιλογή να είναι ελέγξιμη. */
const POINTS: readonly TopoPoint[] = [
  { x: 0, y: 0, z: 10 },
  { x: 100, y: 0, z: 90 },
];

describe('isBreaklineCandidate', () => {
  it('accepts the linear entities and nothing else', () => {
    expect(isBreaklineCandidate(line())).toBe(true);
    expect(isBreaklineCandidate(polyline())).toBe(true);
    expect(isBreaklineCandidate(lwpolyline())).toBe(true);
    const text = { id: 't1', type: 'text', layerId: '0', position: { x: 0, y: 0 }, content: 'x', height: 2 } as unknown as Entity;
    expect(isBreaklineCandidate(text)).toBe(false);
  });
});

describe('buildBreaklineFromEntity — standard (elevation) breakline', () => {
  it('lwpolyline.elevation puts EVERY vertex at that same z', () => {
    const built = buildBreaklineFromEntity(lwpolyline({ elevation: 42.5, closed: true }), POINTS);
    expect(built).not.toBeNull();
    expect(built!.source).toBe('elevation');
    expect(built!.closed).toBe(true);
    expect(built!.vertices.map((v) => v.z)).toEqual([42.5, 42.5, 42.5]);
    // Το elevation ΝΙΚΑΕΙ τα σημεία — δεν αναμειγνύεται με proximity z (10 / 90).
    expect(built!.vertices[0]).toEqual({ x: 0, y: 0, z: 42.5 });
  });

  it('elevation = 0 is a real elevation, not "missing" (falsy trap)', () => {
    const built = buildBreaklineFromEntity(lwpolyline({ elevation: 0 }), POINTS);
    expect(built!.source).toBe('elevation');
    expect(built!.vertices.every((v) => v.z === 0)).toBe(true);
  });
});

describe('buildBreaklineFromEntity — proximity breakline', () => {
  it('a 2D line takes each vertex z from the NEAREST survey point', () => {
    const built = buildBreaklineFromEntity(line(), POINTS);
    expect(built).not.toBeNull();
    expect(built!.source).toBe('proximity');
    expect(built!.vertices).toEqual([
      { x: 0, y: 0, z: 10 },    // κοντύτερα στο (0,0,10)
      { x: 100, y: 0, z: 90 },  // κοντύτερα στο (100,0,90)
    ]);
  });

  it('an lwpolyline WITHOUT elevation falls back to proximity (not silently z=0)', () => {
    const built = buildBreaklineFromEntity(lwpolyline(), POINTS);
    expect(built!.source).toBe('proximity');
    expect(built!.vertices[0].z).toBe(10);
    expect(built!.vertices[2].z).toBe(90); // (100,100) → πλησιέστερο το (100,0,90)
  });

  it('a plain 2D polyline is a proximity breakline too', () => {
    const built = buildBreaklineFromEntity(polyline(), POINTS);
    expect(built!.source).toBe('proximity');
    expect(built!.vertices.map((v) => v.z)).toEqual([10, 90]);
  });
});

describe('buildBreaklineFromEntity — refusals (ΠΟΤΕ σιωπηλά)', () => {
  it('returns null for a 2D line when no survey points are loaded', () => {
    expect(buildBreaklineFromEntity(line(), [])).toBeNull();
  });

  it('BUT an elevation-carrying lwpolyline works with zero points (it needs none)', () => {
    const built = buildBreaklineFromEntity(lwpolyline({ elevation: 7 }), []);
    expect(built!.source).toBe('elevation');
    expect(built!.vertices.every((v) => v.z === 7)).toBe(true);
  });

  it('returns null for fewer than 2 vertices', () => {
    expect(buildBreaklineFromEntity(polyline({ vertices: [{ x: 0, y: 0 }] }), POINTS)).toBeNull();
    expect(buildBreaklineFromEntity(lwpolyline({ vertices: [], elevation: 5 }), POINTS)).toBeNull();
  });

  it('returns null for a non-linear entity', () => {
    const circle = { id: 'c1', type: 'circle', layerId: '0', center: { x: 0, y: 0 }, radius: 5 } as unknown as Entity;
    expect(buildBreaklineFromEntity(circle, POINTS)).toBeNull();
  });
});
