/**
 * ADR-449 Slice X3/X4 — Ο τοίχος ως finish-member της ενιαίας σιλουέτας σοβά.
 *
 * X4 σημασιολογία: ο σοβάς = additive finish skin (`WallParams.finish`), ΟΧΙ DNA layer.
 * Επαληθεύει: (1) `wallDnaHasPlaster` (legacy DNA με `mat-plaster` → true· νέο brick-only /
 * EPS / parapet → false), (2) `wallToSilhouetteMembers` (member όταν finish active + όχι legacy
 * plaster· core = **πλήρες** footprint χωρίς inset· legacy/parapet → []), (3) integration:
 * `computeStructuralFinishSilhouette` με ΜΟΝΟ νέους τοίχους, (4) contact subtraction.
 */

import { wallDnaHasPlaster, wallToSilhouetteMembers } from '../wall-finish-source';
import { computeStructuralFinishSilhouette } from '../structural-finish-scene-silhouette';
import { wallFootprintPolygon, type WallFinishObstacle } from '../structural-finish-scene';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';
import {
  createDefaultExteriorDna,
  createExterior25EpsDna,
  createDefaultParapetDna,
  computeTotalThickness,
  type WallDna,
} from '../../types/wall-dna-types';
import type { WallCategory } from '../../types/wall-types';

/** Legacy (pre-X4) exterior DNA: σοβάς ext 25 + τούβλο 210 + Knauf 15 = 250. */
function legacyPlasterDna(): WallDna {
  const layers = [
    { id: 'ext-plaster-out', name: 'Exterior Plaster', thickness: 25, materialId: 'mat-plaster-ext', side: 'exterior' as const },
    { id: 'ext-core', name: 'Brick Masonry', thickness: 210, materialId: 'mat-brick-masonry', side: 'core' as const },
    { id: 'ext-plaster-in', name: 'Interior Plaster', thickness: 15, materialId: 'mat-plaster-int', side: 'interior' as const },
  ];
  return { layers, totalThickness: computeTotalThickness(layers) };
}

function wall(
  start: { x: number; y: number },
  end: { x: number; y: number },
  opts: { dna?: WallDna; id?: string; category?: WallCategory; stripFinish?: boolean } = {},
): WallFinishObstacle {
  let params = buildDefaultWallParams(start, end, { height: 3000, category: opts.category });
  if (opts.dna) params = { ...params, dna: opts.dna, thickness: opts.dna.totalThickness };
  if (opts.stripFinish) {
    const { finish: _drop, ...rest } = params;
    params = rest;
  }
  return { id: opts.id ?? 'w1', kind: 'straight', params };
}

const fullZ = { zBotMm: 0, zTopMm: 3000 };
const totalLength = (segs: readonly { lengthM: number }[]): number =>
  segs.reduce((s, seg) => s + seg.lengthM, 0);

const polyAreaAbs = (fp: readonly { x: number; y: number }[]): number => {
  let s = 0;
  for (let i = 0; i < fp.length; i++) { const a = fp[i]; const b = fp[(i + 1) % fp.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s / 2);
};

describe('wallFootprintPolygon — ΕΝΩΣΗ raw + mitered (ADR-449 §angled-wall-miter-close)', () => {
  it('ελεύθερος τοίχος (κανένα trim) → ΑΚΡΙΒΩΣ raw footprint (fast-path, μηδέν union)', () => {
    const base = wall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    // Ίδια αναφορά συνάρτησης → deterministic raw ring (μηδέν αλλαγή για ελεύθερους τοίχους).
    expect(wallFootprintPolygon(base)).toEqual(wallFootprintPolygon(base));
    expect(polyAreaAbs(wallFootprintPolygon(base))).toBeCloseTo(3000 * 210, 0);
  });

  it('flush-cut miter (mitered ⊂ raw) → union ≡ raw γεωμετρικά (robust wall↔column διατηρείται)', () => {
    // Το column-miter κόβει τον τοίχο flush ΜΕΣΑ στο raw rect → union(raw, mitered) = raw
    // (υπερσύνολο) → ο σοβάς βλέπει το raw που ΕΠΙΚΑΛΥΠΤΕΤΑΙ την κολόνα (μηδέν degenerate).
    const base = wall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    const mitered: WallFinishObstacle = {
      ...base,
      params: {
        ...base.params,
        startMiter: { outer: { x: 300, y: 105 }, inner: { x: 300, y: -105 } },
        startBevel: 45,
      } as WallFinishObstacle['params'],
    };
    // Superset του raw → ίδιο εμβαδό (mitered flush cut ⊂ raw) + ≥ raw πάντα.
    expect(polyAreaAbs(wallFootprintPolygon(mitered))).toBeGreaterThanOrEqual(polyAreaAbs(wallFootprintPolygon(base)) - 1);
    expect(polyAreaAbs(wallFootprintPolygon(mitered))).toBeCloseTo(polyAreaAbs(wallFootprintPolygon(base)), 0);
  });

  it('miter που ΠΡΟΕΞΕΧΕΙ του raw (γωνία 2 τοίχων) → union > raw (γεμίζει το inner reflex notch)', () => {
    // Inner miter σημείο πέρα από την άκρη του raw (x<0) → το mitered footprint προεξέχει →
    // η ένωση μεγαλώνει το footprint ώστε ο σοβάς να κλείσει την εσωτερική γωνία (μηδέν notch).
    const base = wall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    const extended: WallFinishObstacle = {
      ...base,
      params: {
        ...base.params,
        startMiter: { outer: { x: 0, y: 105 }, inner: { x: -200, y: -105 } },
      } as WallFinishObstacle['params'],
    };
    expect(polyAreaAbs(wallFootprintPolygon(extended))).toBeGreaterThan(polyAreaAbs(wallFootprintPolygon(base)));
  });
});

describe('wallDnaHasPlaster (X4 legacy detection)', () => {
  it('legacy DNA με mat-plaster layer → true', () => {
    expect(wallDnaHasPlaster(legacyPlasterDna())).toBe(true);
  });
  it('νέο exterior DNA (brick-only, X4) → false', () => {
    expect(wallDnaHasPlaster(createDefaultExteriorDna())).toBe(false);
  });
  it('EPS DNA (μόνωση + τούβλο) → false (η μόνωση δεν είναι σοβάς)', () => {
    expect(wallDnaHasPlaster(createExterior25EpsDna())).toBe(false);
  });
  it('parapet DNA (μονόστρωτο RC core) → false', () => {
    expect(wallDnaHasPlaster(createDefaultParapetDna())).toBe(false);
  });
  it('undefined DNA → false', () => {
    expect(wallDnaHasPlaster(undefined)).toBe(false);
  });
});

describe('wallToSilhouetteMembers (X4 — full footprint, gate σε finish spec)', () => {
  it('νέος τοίχος (finish active, brick-only DNA) → ΕΝΑ member με ΠΛΗΡΕΣ footprint (χωρίς inset)', () => {
    const w = wall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    // ADR-449 §opening-bands — χωρίς ανοίγματα ο πληθυντικός δίνει ΑΚΡΙΒΩΣ 1 member (byte-for-byte
    // η προ-opening-bands συμπεριφορά· αυτό το test είναι ο guard της).
    const ms = wallToSilhouetteMembers(w, fullZ);
    expect(ms).toHaveLength(1);
    // Core = full δομικό footprint (όχι inset) → ο σοβάς προεξέχει.
    expect(ms[0].footprint).toEqual(wallFootprintPolygon(w));
    expect(ms[0].zBotMm).toBe(0);
    expect(ms[0].zTopMm).toBe(3000);
  });

  it('τοίχος ΧΩΡΙΣ finish spec (legacy/bare) → [] (μένει obstacle)', () => {
    const ms = wallToSilhouetteMembers(wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { stripFinish: true }), fullZ);
    expect(ms).toEqual([]);
  });

  it('finish spec ΑΛΛΑ legacy plaster DNA → [] (legacy guard, μηδέν διπλός σοβάς)', () => {
    const ms = wallToSilhouetteMembers(
      wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { dna: legacyPlasterDna() }),
      fullZ,
    );
    expect(ms).toEqual([]);
  });

  it('parapet (category parapet → χωρίς finish) → []', () => {
    const ms = wallToSilhouetteMembers(
      wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { category: 'parapet', dna: createDefaultParapetDna() }),
      fullZ,
    );
    expect(ms).toEqual([]);
  });
});

describe('computeStructuralFinishSilhouette — ο τοίχος ως member (ADR-449 Slice X3/X4)', () => {
  it('όροφος με ΜΟΝΟ νέο τοίχο → παράγει band σοβά', () => {
    const bands = computeStructuralFinishSilhouette({ columns: [], beams: [], walls: [wall({ x: 0, y: 0 }, { x: 3000, y: 0 })], floorElevationMm: 0 });
    expect(bands.length).toBeGreaterThanOrEqual(1);
    expect(bands[0].faces.segments.length).toBeGreaterThan(0);
  });

  it('parapet-only όροφος → καμία band (χωρίς finish)', () => {
    const bands = computeStructuralFinishSilhouette({
      columns: [],
      beams: [],
      walls: [wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { category: 'parapet', dna: createDefaultParapetDna() })],
      floorElevationMm: 0,
    });
    expect(bands).toHaveLength(0);
  });

  it('2 επικαλυπτόμενοι collinear τοίχοι → ενιαία σιλουέτα (σοβάς σβήνει στην επαφή)', () => {
    const joined = computeStructuralFinishSilhouette({
      columns: [],
      beams: [],
      walls: [
        wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { id: 'a' }),
        wall({ x: 2900, y: 0 }, { x: 6000, y: 0 }, { id: 'b' }),
      ],
      floorElevationMm: 0,
    });
    const separate = computeStructuralFinishSilhouette({
      columns: [],
      beams: [],
      walls: [
        wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { id: 'a' }),
        wall({ x: 20000, y: 0 }, { x: 23000, y: 0 }, { id: 'b' }),
      ],
      floorElevationMm: 0,
    });
    const joinedLen = joined.reduce((s, b) => s + totalLength(b.faces.segments), 0);
    const separateLen = separate.reduce((s, b) => s + totalLength(b.faces.segments), 0);
    expect(joinedLen).toBeLessThan(separateLen);
  });
});
