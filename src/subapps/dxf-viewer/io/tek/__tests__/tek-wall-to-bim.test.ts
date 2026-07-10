/**
 * ADR-531 Φ5b.2 — tests για τον BIM mapper `TekWallRecord` → `WallEntity` + `OpeningEntity[]`
 * και για το round-trip των inverse matrix helpers (`decodeWallXMatrix`/`decodeOpeningXMatrix`).
 */

import { tekWallToBimEntities } from '../tek-wall-to-bim';
import { wallPlanLineSegments } from '../../../bim/walls/wall-plan-line-segments';
import {
  buildWallXMatrix, buildOpeningXMatrix, decodeWallXMatrix, decodeOpeningXMatrix,
} from '../../../export/core/tek/tek-geometry';
import type { TekWallRecord, TekXMatrix, TekOpeningRecord } from '../tek-import-types';

const mat = (x00: number, x11: number, x20: number, x21: number): TekXMatrix =>
  ({ x00, x01: 0, x10: 0, x11, x20, x21 });

const opening = (x00: number, x20: number, style: number, side: number): TekOpeningRecord => ({
  matrix: mat(x00, -1, x20, 0.73),
  elevationM: style === 1 ? 0 : 0.9, topM: 2.2, style, side,
  frameWidthM: 0.15, frameThicknessM: 0.03, jambWidthM: 0.05, jambThicknessM: 0.05,
  ledgeHeightM: 0.03, color: '50A490',
});

// Τοίχος 5.03m μήκος, 0.25m πάχος, με πόρτα (style 1) + παράθυρο (style 0).
const WALL: TekWallRecord = {
  matrix: mat(5.03, 0.25, -8.25, 0.58),
  heightM: 3, elevationM: 0, innerWidthM: 0.09, color: '80BCFC',
  openings: [opening(1.4, -7.86, 1, 3), opening(-1.4, -4.16, 0, 2)],
};

describe('inverse matrix helpers — round-trip (ADR-531 Φ5b.2)', () => {
  it('decodeWallXMatrix ∘ buildWallXMatrix = identity (λοξός τοίχος)', () => {
    const m = buildWallXMatrix(1, 2, 5, 4, 0.3); // dy≠0 → λοξός (πιάνει transpose/Y-flip)
    const d = decodeWallXMatrix(m);
    expect(d.thicknessM).toBeCloseTo(0.3, 6);
    expect(d.start.x).toBeCloseTo(1, 6);
    expect(d.start.y).toBeCloseTo(-2, 6); // Y-flip: matrix-frame = −canvasY
    expect(d.end.x).toBeCloseTo(5, 6);
    expect(d.end.y).toBeCloseTo(-4, 6);
  });

  it('decodeOpeningXMatrix ∘ buildOpeningXMatrix = identity (περιστραμμένο)', () => {
    const om = buildOpeningXMatrix(3, 1, Math.PI / 6, 0.9);
    const od = decodeOpeningXMatrix(om);
    expect(od.widthM).toBeCloseTo(0.9, 6);
    expect(od.center.x).toBeCloseTo(3, 6);
    expect(od.center.y).toBeCloseTo(-1, 6);
  });
});

describe('tekWallToBimEntities (ADR-531 Φ5b.2)', () => {
  const { wall, openings, warnings } = tekWallToBimEntities(WALL, 'level-0', 'mm');

  it('παράγει BIM WallEntity με σωστό μήκος/πάχος/χρώμα', () => {
    expect(wall).not.toBeNull();
    expect(wall?.type).toBe('wall');
    expect(wall?.geometry.length).toBeCloseTo(5.03, 2); // μέτρα
    expect(wall?.params.thickness).toBeCloseTo(250, 1); // mm
    expect(wall?.params.height).toBeCloseTo(3000, 1); // mm
    expect(wall?.color).toBe('#80BCFC');
    expect(warnings).toHaveLength(0);
  });

  it('παράγει 2 κουφώματα: πόρτα (style 1) + παράθυρο (style 0)', () => {
    expect(openings).toHaveLength(2);
    expect(openings[0]?.type).toBe('opening');
    expect(openings[0]?.kind).toBe('door');
    expect(openings[1]?.kind).toBe('window');
  });

  it('τα κουφώματα είναι hosted στον τοίχο (wallId + hostedOpeningIds mirror)', () => {
    expect(openings.every((o) => o.params.wallId === wall?.id)).toBe(true);
    expect(wall?.hostedOpeningIds).toEqual(openings.map((o) => o.id));
  });

  it('χαρτογραφεί elevation→baseOffset + top/sill του κουφώματος (mm)', () => {
    expect(wall?.params.baseOffset).toBeCloseTo(0, 3);
    // παράθυρο: sill 0.9m → 900mm, height (2.2−0.9)m → 1300mm
    const win = openings[1];
    expect(win?.params.sillHeight).toBeCloseTo(900, 1);
    expect(win?.params.height).toBeCloseTo(1300, 1);
  });

  it('plan-lines: παρειές κομμένες στα ανοίγματα + jamb returns (πάνω από απλό ορθογώνιο)', () => {
    expect(wall).not.toBeNull();
    if (!wall) return;
    const segs = wallPlanLineSegments(wall, openings);
    // Χωρίς ανοίγματα = 4 (2 παρειές + 2 caps)· με 2 ανοίγματα → +jamb returns & σπασμένες παρειές.
    expect(segs.length).toBeGreaterThan(4);
    expect(segs.every((s) => Number.isFinite(s.a.x) && Number.isFinite(s.b.y))).toBe(true);
  });
});
