/**
 * ADR-396 v2 Phase 5 — Tests για envelope-shell.ts (footprint-driven ETICS κέλυφος).
 *
 * Robust σενάρια (δομικές/σχεσιακές βεβαιώσεις, ΟΧΙ εύθραυστα ακριβή μεγέθη, αφού
 * η ένωση παράγει notched γωνίες): outward/inward offset, αίθριο vs δωμάτιο,
 * per-element override (κενό στη γραμμή / orphan wrap), beamIds, primaryChain,
 * opening-cut compatibility. Repo = jest (ΟΧΙ vitest) — τρέξε από REPO ROOT.
 */

import { computeEnvelopeShell, collectEnvelopeOverrides } from '../envelope-shell';
import { computeEnvelopeOpeningCuts, type OpeningForCut } from '../envelope-opening-cuts';
import type { WallForEnvelope, ColumnForEnvelope } from '../envelope-perimeter';
import type { BeamForFootprint } from '../building-footprint';
import type { SlabRegionFootprint } from '../footprint-region-classifier';
import type { Point3D, Polyline3D } from '../../types/bim-base';
import type { WallParams } from '../../types/wall-types';
import type { ColumnParams } from '../../types/column-types';
import type { BeamParams } from '../../types/beam-types';
import type { EnvelopeFunction, ThermalEnvelopeSpec } from '../../types/thermal-envelope-types';
import { createExterior25EpsDna } from '../../types/wall-dna-types';

// ─── Builders ────────────────────────────────────────────────────────────────

const p = (x: number, y: number): Point3D => ({ x, y, z: 0 });

function wallParams(start: Point3D, end: Point3D, thickness = 200): WallParams {
  return {
    category: 'exterior', start, end, height: 3000, thickness, flip: false,
    sceneUnits: 'mm', baseBinding: 'storey-floor', topBinding: 'storey-ceiling',
    baseOffset: 0, topOffset: 0,
  };
}

function wall(id: string, start: Point3D, end: Point3D, thickness = 200): WallForEnvelope {
  return { id, kind: 'straight', params: wallParams(start, end, thickness) };
}

/** Κλειστό τετράγωνο `size`×`size` με origin (ox,oy). 4 τοίχοι. */
function square(prefix: string, ox: number, oy: number, size: number): WallForEnvelope[] {
  const q = (x: number, y: number): Point3D => ({ x: ox + x, y: oy + y, z: 0 });
  return [
    wall(`${prefix}1`, q(0, 0), q(size, 0)),
    wall(`${prefix}2`, q(size, 0), q(size, size)),
    wall(`${prefix}3`, q(size, size), q(0, size)),
    wall(`${prefix}4`, q(0, size), q(0, 0)),
  ];
}

function column(id: string, x: number, y: number, size = 200): ColumnForEnvelope {
  return {
    id,
    params: {
      kind: 'rectangular', position: { x, y, z: 0 }, anchor: 'center',
      width: size, depth: size, height: 3000, rotation: 0, sceneUnits: 'mm',
      baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    } as ColumnParams,
  };
}

function beam(id: string, start: Point3D, end: Point3D, width = 400): BeamForFootprint {
  return {
    id,
    params: {
      kind: 'straight', startPoint: start, endPoint: end, width, depth: 500,
      topElevation: 3000, sceneUnits: 'mm',
    } as BeamParams,
  };
}

function spec(thickness_m = 0.1): ThermalEnvelopeSpec {
  return {
    materialId: 'mat-eps-graphite', thickness_m, revealThickness_m: 0.05,
    zones: { Z1: true, Z2: true, Z3: true, Z4: true },
  };
}

/** Πλάκα-από-πάνω που σκεπάζει το τετράγωνο [ox,oy]..[ox+size] (→ δωμάτιο). */
function coverSlab(ox: number, oy: number, size: number): SlabRegionFootprint {
  return { polygon: [p(ox, oy), p(ox + size, oy), p(ox + size, oy + size), p(ox, oy + size)] };
}

const NO_OVERRIDES: ReadonlyMap<string, EnvelopeFunction> = new Map();
const overrides = (e: Array<[string, EnvelopeFunction]>): ReadonlyMap<string, EnvelopeFunction> =>
  new Map(e);

// ─── Geometry assertion helpers ────────────────────────────────────────────────

function centroidOf(pts: readonly Point3D[]): { x: number; y: number } {
  let sx = 0, sy = 0;
  for (const v of pts) { sx += v.x; sy += v.y; }
  return { x: sx / pts.length, y: sy / pts.length };
}

function meanDist(pts: readonly Point3D[], c: { x: number; y: number }): number {
  let s = 0;
  for (const v of pts) s += Math.hypot(v.x - c.x, v.y - c.y);
  return s / pts.length;
}

/** >0 = το offset «μεγαλώνει» (έξω)· <0 = «μικραίνει» (μέσα), ως προς το ίδιο κέντρο. */
function expansion(face: Polyline3D, offset: Polyline3D): number {
  const c = centroidOf(face.points);
  return meanDist(offset.points, c) - meanDist(face.points, c);
}

const allFinite = (pts: readonly Point3D[]): boolean =>
  pts.every((v) => Number.isFinite(v.x) && Number.isFinite(v.y));

// ─── 1. Empty input ─────────────────────────────────────────────────────────

describe('computeEnvelopeShell — degenerate', () => {
  it('empty input → no chains', () => {
    const r = computeEnvelopeShell([], [], [], spec(), NO_OVERRIDES, []);
    expect(r.chains).toHaveLength(0);
    expect(r.primaryChain).toBeNull();
  });
});

// ─── 2. Rectangle + slab above → 1 closed chain, outward ──────────────────────

describe('computeEnvelopeShell — closed building (slab above → room interior)', () => {
  const walls = square('w', 0, 0, 10000);
  const slabs = [coverSlab(0, 0, 10000)];

  it('1 closed chain, encloses, offset outward, perimeter > 0', () => {
    const r = computeEnvelopeShell(walls, [], [], spec(), NO_OVERRIDES, slabs);
    expect(r.chains).toHaveLength(1);
    const c = r.chains[0];
    expect(c.closed).toBe(true);
    expect(c.enclosesRegion).toBe(true);
    expect(c.perimeterM).toBeGreaterThan(0);
    expect(expansion(c.exteriorFaceLoop, c.insulationOuterLoop)).toBeGreaterThan(0);
    expect(allFinite(c.insulationOuterLoop.points)).toBe(true);
  });

  it('wallIds ⊆ {w1..w4}, beamIds empty', () => {
    const r = computeEnvelopeShell(walls, [], [], spec(), NO_OVERRIDES, slabs);
    const ids = new Set(['w1', 'w2', 'w3', 'w4']);
    expect(r.chains[0].wallIds.length).toBeGreaterThan(0);
    expect(r.chains[0].wallIds.every((id) => ids.has(id))).toBe(true);
    expect(r.chains[0].beamIds).toEqual([]);
  });
});

// ─── 3. Hole default (Φ5B): no slab data → room · non-covering data → atrium ───

describe('computeEnvelopeShell — hole default vs atrium', () => {
  const walls = square('w', 0, 0, 10000);

  it('NO slab data → hole=room (Φ5B safe default) → 1 outer chain only', () => {
    const r = computeEnvelopeShell(walls, [], [], spec(), NO_OVERRIDES, []);
    expect(r.chains).toHaveLength(1);
    expect(r.chains[0].closed).toBe(true);
    expect(expansion(r.chains[0].exteriorFaceLoop, r.chains[0].insulationOuterLoop)).toBeGreaterThan(0);
  });

  it('slab data present but NOT covering → atrium → 2 chains (outer out + hole in)', () => {
    const farSlab = coverSlab(500000, 500000, 1000); // δεδομένα υπάρχουν, δεν καλύπτουν
    const r = computeEnvelopeShell(walls, [], [], spec(), NO_OVERRIDES, [farSlab]);
    expect(r.chains).toHaveLength(2);
    expect(r.chains.every((c) => c.closed)).toBe(true);
    const exps = r.chains.map((c) => expansion(c.exteriorFaceLoop, c.insulationOuterLoop));
    expect(exps.some((e) => e > 0)).toBe(true); // outer → έξω
    expect(exps.some((e) => e < 0)).toBe(true); // αίθριο → μέσα (winding-normalized hole)
  });
});

// ─── 4. thickness = 0 → degenerate band (no throw) ────────────────────────────

describe('computeEnvelopeShell — zero thickness', () => {
  it('insulation loop coincides with face, no NaN', () => {
    const r = computeEnvelopeShell(square('w', 0, 0, 10000), [], [], spec(0), NO_OVERRIDES, [coverSlab(0, 0, 10000)]);
    expect(r.chains).toHaveLength(1);
    const c = r.chains[0];
    expect(c.insulationOuterLoop.points).toEqual(c.exteriorFaceLoop.points);
    expect(allFinite(c.insulationOuterLoop.points)).toBe(true);
  });
});

// ─── 5. One wall 'interior' → gap in the band ─────────────────────────────────

describe('computeEnvelopeShell — override interior breaks the band', () => {
  const walls = square('w', 0, 0, 10000);
  const slabs = [coverSlab(0, 0, 10000)];

  it('outer ring splits into OPEN runs; flagged wall excluded', () => {
    const r = computeEnvelopeShell(walls, [], [], spec(), overrides([['w1', 'interior']]), slabs);
    expect(r.chains.length).toBeGreaterThanOrEqual(1);
    expect(r.chains.every((c) => c.closed === false)).toBe(true); // πλέον ανοιχτά runs
    const wallIds = new Set(r.chains.flatMap((c) => c.wallIds));
    expect(wallIds.has('w1')).toBe(false); // ο σημαδεμένος δεν μονώνεται
    expect(r.primaryChain).toBeNull(); // κανένα κλειστό
  });

  it('two non-adjacent walls interior → two separate gaps (≥2 open runs)', () => {
    const r = computeEnvelopeShell(walls, [], [], spec(), overrides([['w1', 'interior'], ['w3', 'interior']]), slabs);
    expect(r.chains.length).toBeGreaterThanOrEqual(2);
    expect(r.chains.every((c) => !c.closed)).toBe(true);
  });
});

// ─── 5b. ADR-447 — wall with DNA exterior insulation → excluded (dedup) ────────

describe('computeEnvelopeShell — ADR-447 self-insulated wall (DNA-EPS) dedup', () => {
  const slabs = [coverSlab(0, 0, 10000)];

  /** A square whose wall `w1` carries the «25cm με θερμοπρόσοψη» EPS DNA. */
  function squareWithInsulatedW1(): WallForEnvelope[] {
    const walls = square('w', 0, 0, 10000);
    const epsDna = createExterior25EpsDna();
    return walls.map((w) =>
      w.id === 'w1' ? { ...w, params: { ...w.params, dna: epsDna } } : w,
    );
  }

  it('the DNA-insulated wall is force-off (like an "interior" override) — no double insulation', () => {
    // No envelopeFunction overrides at all: the dedup is driven purely by the DNA.
    const r = computeEnvelopeShell(squareWithInsulatedW1(), [], [], spec(), NO_OVERRIDES, slabs);
    const wallIds = new Set(r.chains.flatMap((c) => c.wallIds));
    expect(wallIds.has('w1')).toBe(false); // already insulated via its type → shell skips it
    expect(r.chains.every((c) => c.closed === false)).toBe(true); // ring split into open runs
    expect(r.primaryChain).toBeNull();
  });

  it('a plain (non-insulated) square still wraps fully (control)', () => {
    const r = computeEnvelopeShell(square('w', 0, 0, 10000), [], [], spec(), NO_OVERRIDES, slabs);
    expect(r.chains).toHaveLength(1);
    expect(r.chains[0].closed).toBe(true);
  });
});

// ─── 6. All walls 'interior' → wall shell not insulated ────────────────────────

describe('computeEnvelopeShell — entire ring interior', () => {
  it('no closed wall chain emitted', () => {
    const ov = overrides([['w1', 'interior'], ['w2', 'interior'], ['w3', 'interior'], ['w4', 'interior']]);
    const r = computeEnvelopeShell(square('w', 0, 0, 10000), [], [], spec(), ov, [coverSlab(0, 0, 10000)]);
    expect(r.chains.some((c) => c.closed && c.wallIds.length > 0)).toBe(false);
    expect(r.chains.every((c) => c.wallIds.length === 0)).toBe(true);
  });
});

// ─── 7. Single-edge run (3 of 4 interior) ─────────────────────────────────────

describe('computeEnvelopeShell — single-edge insulated run', () => {
  it('one open run survives, finite offset', () => {
    const ov = overrides([['w2', 'interior'], ['w3', 'interior'], ['w4', 'interior']]);
    const r = computeEnvelopeShell(square('w', 0, 0, 10000), [], [], spec(), ov, [coverSlab(0, 0, 10000)]);
    const wallChains = r.chains.filter((c) => c.wallIds.includes('w1'));
    expect(wallChains.length).toBeGreaterThanOrEqual(1);
    for (const c of wallChains) {
      expect(c.closed).toBe(false);
      expect(allFinite(c.insulationOuterLoop.points)).toBe(true);
      expect(c.insulationOuterLoop.points.length).toBe(c.exteriorFaceLoop.points.length);
    }
  });
});

// ─── 8. Orphan exterior wrap (column embedded in wall) ─────────────────────────

describe('computeEnvelopeShell — orphan exterior wrap', () => {
  const w = wall('w', p(0, 0), p(6000, 0), 600); // πάχος 600
  const col = column('c', 3000, 0, 200);          // εντός τοίχου → καμία ακμή εξόδου

  it('embedded column flagged exterior → own wrap chain with columnIds=[id]', () => {
    const r = computeEnvelopeShell([w], [col], [], spec(), overrides([['c', 'exterior']]), [coverSlab(-500, -500, 7000)]);
    const wrap = r.chains.filter((c) => c.columnIds.includes('c'));
    expect(wrap.length).toBe(1);
    expect(wrap[0].closed).toBe(true);
    expect(allFinite(wrap[0].insulationOuterLoop.points)).toBe(true);
  });

  it('without override → no column wrap', () => {
    const r = computeEnvelopeShell([w], [col], [], spec(), NO_OVERRIDES, [coverSlab(-500, -500, 7000)]);
    expect(r.chains.some((c) => c.columnIds.includes('c'))).toBe(false);
  });
});

// ─── 9. exterior override on a wall already on the ring → no extra chain ───────

describe('computeEnvelopeShell — redundant exterior override', () => {
  it('chain count unchanged vs auto', () => {
    const walls = square('w', 0, 0, 10000);
    const slabs = [coverSlab(0, 0, 10000)];
    const auto = computeEnvelopeShell(walls, [], [], spec(), NO_OVERRIDES, slabs);
    const forced = computeEnvelopeShell(walls, [], [], spec(), overrides([['w1', 'exterior']]), slabs);
    expect(forced.chains).toHaveLength(auto.chains.length);
  });
});

// ─── 10. Beam protruding → wrapped, beamIds populated ─────────────────────────

describe('computeEnvelopeShell — beam contributes to shell', () => {
  it('beam protruding έξω από κλειστό τετράγωνο → μπαίνει στα beamIds', () => {
    // Το τετράγωνο περικλείει χώρο (hole-gate ✓)· το δοκάρι προεξέχει πάνω από τον
    // top τοίχο → η ένωση το τυλίγει στο εξωτ. όριο → attribution → beamIds.
    const walls = square('w', 0, 0, 10000);
    const b = beam('b', p(5000, 10000), p(5000, 13000), 400);
    const r = computeEnvelopeShell(walls, [], [b], spec(), NO_OVERRIDES, [coverSlab(0, 0, 10000)]);
    const beamIds = new Set(r.chains.flatMap((c) => c.beamIds ?? []));
    expect(beamIds.has('b')).toBe(true);
  });
});

// ─── 11. primaryChain = largest closed by perimeter ───────────────────────────

describe('computeEnvelopeShell — primaryChain', () => {
  it('two detached buildings → primary = larger perimeter', () => {
    const walls = [...square('a', 0, 0, 5000), ...square('b', 50000, 50000, 9000)];
    const slabs = [coverSlab(0, 0, 5000), coverSlab(50000, 50000, 9000)];
    const r = computeEnvelopeShell(walls, [], [], spec(), NO_OVERRIDES, slabs);
    const closed = r.chains.filter((c) => c.closed);
    expect(closed.length).toBe(2);
    expect(r.primaryChain).not.toBeNull();
    const maxP = Math.max(...closed.map((c) => c.perimeterM));
    expect(r.primaryChain?.perimeterM).toBe(maxP);
  });
});

// ─── 12. Opening-cut compatibility (smoke) ────────────────────────────────────

describe('computeEnvelopeShell — opening-cut compatibility', () => {
  it('chain feeds computeEnvelopeOpeningCuts without throwing (1:1 invariant)', () => {
    const walls = square('w', 0, 0, 10000);
    const r = computeEnvelopeShell(walls, [], [], spec(), NO_OVERRIDES, [coverSlab(0, 0, 10000)]);
    const chain = r.chains[0];
    expect(chain.insulationOuterLoop.points.length).toBe(chain.exteriorFaceLoop.points.length);
    const opening: OpeningForCut = {
      params: { wallId: chain.wallIds[0], width: 1200, sillHeight: 0, height: 2100 },
      geometry: { position: chain.exteriorFaceLoop.points[0], rotation: 0 },
    };
    expect(() => computeEnvelopeOpeningCuts(chain, [opening], 'mm')).not.toThrow();
    expect(Array.isArray(computeEnvelopeOpeningCuts(chain, [opening], 'mm'))).toBe(true);
  });
});

// ─── 13. coverageThreshold option plumbing ────────────────────────────────────

describe('computeEnvelopeShell — coverageThreshold option', () => {
  // Πλάκα που σκεπάζει ~36% της τρύπας (6000×6000 πάνω σε ~9800×9800 interior).
  const walls = square('w', 0, 0, 10000);
  const partial = [coverSlab(0, 0, 6000)];

  it('low threshold → room (no atrium chain): 1 chain', () => {
    const r = computeEnvelopeShell(walls, [], [], spec(), NO_OVERRIDES, partial, { coverageThreshold: 0.2 });
    expect(r.chains).toHaveLength(1);
  });

  it('high threshold → atrium (insulated): 2 chains', () => {
    const r = computeEnvelopeShell(walls, [], [], spec(), NO_OVERRIDES, partial, { coverageThreshold: 0.9 });
    expect(r.chains).toHaveLength(2);
  });
});

// ─── 15. collectEnvelopeOverrides helper ───────────────────────────────────────

describe('collectEnvelopeOverrides', () => {
  it('μαζεύει μόνο τα στοιχεία με envelopeFunction (skip undefined = auto)', () => {
    const items = [
      { id: 'a', params: { envelopeFunction: 'exterior' as EnvelopeFunction } },
      { id: 'b', params: {} },
      { id: 'c', params: { envelopeFunction: 'interior' as EnvelopeFunction } },
    ];
    const m = collectEnvelopeOverrides(items);
    expect(m.size).toBe(2);
    expect(m.get('a')).toBe('exterior');
    expect(m.get('c')).toBe('interior');
    expect(m.has('b')).toBe(false);
  });
});

// ─── 14. exterior override on an interior divider → own (closed) wrap ──────────

describe('computeEnvelopeShell — exterior override on interior element', () => {
  it('flagged divider wall (not on any insulated ring) → own closed orphan wrap', () => {
    const walls = [...square('w', 0, 0, 10000), wall('mid', p(5000, 0), p(5000, 10000))];
    const slabs = [coverSlab(0, 0, 10000)]; // δωμάτια → χωρίς auto μόνωση
    const r = computeEnvelopeShell(walls, [], [], spec(), overrides([['mid', 'exterior']]), slabs);
    const midChains = r.chains.filter((c) => c.wallIds.includes('mid'));
    expect(midChains).toHaveLength(1);
    expect(midChains[0].closed).toBe(true); // additive = δικό του τύλιγμα
    expect(allFinite(midChains[0].insulationOuterLoop.points)).toBe(true);
  });
});
