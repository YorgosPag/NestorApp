/**
 * ADR-449 Slice X3/X4 — Ο τοίχος ως finish-member της ενιαίας σιλουέτας σοβά.
 *
 * X4 σημασιολογία: ο σοβάς = additive finish skin (`WallParams.finish`), ΟΧΙ DNA layer.
 * Επαληθεύει: (1) `wallDnaHasPlaster` (legacy DNA με `mat-plaster` → true· νέο brick-only /
 * EPS / parapet → false), (2) `wallToSilhouetteMember` (member όταν finish active + όχι legacy
 * plaster· core = **πλήρες** footprint χωρίς inset· legacy/parapet → null), (3) integration:
 * `computeStructuralFinishSilhouette` με ΜΟΝΟ νέους τοίχους, (4) contact subtraction.
 */

import { wallDnaHasPlaster, wallToSilhouetteMember } from '../wall-finish-source';
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

describe('wallToSilhouetteMember (X4 — full footprint, gate σε finish spec)', () => {
  it('νέος τοίχος (finish active, brick-only DNA) → member με ΠΛΗΡΕΣ footprint (χωρίς inset)', () => {
    const w = wall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    const m = wallToSilhouetteMember(w, fullZ);
    expect(m).not.toBeNull();
    // Core = full δομικό footprint (όχι inset) → ο σοβάς προεξέχει.
    expect(m!.footprint).toEqual(wallFootprintPolygon(w));
    expect(m!.zBotMm).toBe(0);
    expect(m!.zTopMm).toBe(3000);
  });

  it('τοίχος ΧΩΡΙΣ finish spec (legacy/bare) → null (μένει obstacle)', () => {
    const m = wallToSilhouetteMember(wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { stripFinish: true }), fullZ);
    expect(m).toBeNull();
  });

  it('finish spec ΑΛΛΑ legacy plaster DNA → null (legacy guard, μηδέν διπλός σοβάς)', () => {
    const m = wallToSilhouetteMember(
      wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { dna: legacyPlasterDna() }),
      fullZ,
    );
    expect(m).toBeNull();
  });

  it('parapet (category parapet → χωρίς finish) → null', () => {
    const m = wallToSilhouetteMember(
      wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { category: 'parapet', dna: createDefaultParapetDna() }),
      fullZ,
    );
    expect(m).toBeNull();
  });
});

describe('computeStructuralFinishSilhouette — ο τοίχος ως member (ADR-449 Slice X3/X4)', () => {
  it('όροφος με ΜΟΝΟ νέο τοίχο → παράγει band σοβά', () => {
    const bands = computeStructuralFinishSilhouette([], [], [wall({ x: 0, y: 0 }, { x: 3000, y: 0 })], 0);
    expect(bands.length).toBeGreaterThanOrEqual(1);
    expect(bands[0].faces.segments.length).toBeGreaterThan(0);
  });

  it('parapet-only όροφος → καμία band (χωρίς finish)', () => {
    const bands = computeStructuralFinishSilhouette(
      [],
      [],
      [wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { category: 'parapet', dna: createDefaultParapetDna() })],
      0,
    );
    expect(bands).toHaveLength(0);
  });

  it('2 επικαλυπτόμενοι collinear τοίχοι → ενιαία σιλουέτα (σοβάς σβήνει στην επαφή)', () => {
    const joined = computeStructuralFinishSilhouette(
      [],
      [],
      [
        wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { id: 'a' }),
        wall({ x: 2900, y: 0 }, { x: 6000, y: 0 }, { id: 'b' }),
      ],
      0,
    );
    const separate = computeStructuralFinishSilhouette(
      [],
      [],
      [
        wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { id: 'a' }),
        wall({ x: 20000, y: 0 }, { x: 23000, y: 0 }, { id: 'b' }),
      ],
      0,
    );
    const joinedLen = joined.reduce((s, b) => s + totalLength(b.faces.segments), 0);
    const separateLen = separate.reduce((s, b) => s + totalLength(b.faces.segments), 0);
    expect(joinedLen).toBeLessThan(separateLen);
  });
});
