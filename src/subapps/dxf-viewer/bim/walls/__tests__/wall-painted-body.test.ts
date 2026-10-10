/**
 * ADR-458 / ADR-911 Φ3α-4 — το σώμα του τοίχου ΟΠΩΣ ΖΩΓΡΑΦΙΖΕΤΑΙ (`wall-painted-body`).
 *
 * Το module το καλούν και οι δύο περάσεις σκηνής και η προεπισκόπηση πλήρωσης, άρα μια σύγκριση
 * «προεπισκόπηση ≡ απόδοση» ΔΕΝ μπορεί να δει σφάλμα μέσα του. Γι' αυτό εδώ οι ισχυρισμοί είναι
 * ΑΠΟΛΥΤΟΙ: πλήθος κομματιών και εμβαδά υπολογισμένα με το χέρι.
 */

import type { Pair } from 'polygon-clipping';
import type { Point2D } from '../../../rendering/types/Types';
import type { WallEntity } from '../../types/wall-types';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { multiPolygonArea } from '../../geometry/shared/polygon-utils';
import {
  collectWallCrossCutters,
  cutWallBodyByColumns,
  cutWallBodyByCross,
  largestBodyPieceIndex,
  resolveWallPaintedBodies,
  wallBodyRing,
} from '../wall-painted-body';

function wall(id: string, ax: number, ay: number, bx: number, by: number): WallEntity {
  const r = buildWallEntity(buildDefaultWallParams({ x: ax, y: ay }, { x: bx, y: by }), 'lvl', 'straight', 'mm');
  if (!r.ok) throw new Error(`fixture wall invalid: ${r.hardErrors.join(',')}`);
  return { ...r.entity, id };
}

const box = (x: number, y: number, w: number, h: number): Point2D[] =>
  [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const area = (ring: readonly Point2D[]): number => multiPolygonArea([[ring.map((p): Pair => [p.x, p.y])]]);
const total = (pieces: readonly (readonly Point2D[])[]): number => pieces.reduce((s, p) => s + area(p), 0);

// Οριζόντιος τοίχος 4000 mm στον άξονα y=0· το πάχος του είναι η προεπιλογή του εργοστασίου.
const A = wall('a', 0, 0, 4000, 0);
const T = A.params.thickness;

describe('wallBodyRing', () => {
  it('ο άκοπος δακτύλιος: 4 κορυφές, εμβαδό μήκος × πάχος', () => {
    const ring = wallBodyRing(A);
    expect(ring).toHaveLength(4);
    expect(area(ring)).toBeCloseTo(4000 * T, 6);
  });
});

describe('cutWallBodyByColumns — «η κολόνα νικάει»', () => {
  it('χωρίς κολώνες ή χωρίς τομή → null (ζωγραφίζεται ο άκοπος δακτύλιος)', () => {
    expect(cutWallBodyByColumns(A, [])).toBeNull();
    expect(cutWallBodyByColumns(A, [box(0, 5000, 400, 400)])).toBeNull();
  });

  it('κολώνα στη μέση → δύο κομμάτια, χωρίς το κομμάτι της κολώνας', () => {
    const pieces = cutWallBodyByColumns(A, [box(1800, -200, 400, 400)]);
    expect(pieces).toHaveLength(2);
    expect(total(pieces as Point2D[][])).toBeCloseTo((4000 - 400) * T, 6);
  });

  it('κολώνα πάνω στο άκρο → ένα κομμάτι, κοντύτερο', () => {
    const pieces = cutWallBodyByColumns(A, [box(-200, -200, 400, 400)]);
    expect(pieces).toHaveLength(1);
    expect(total(pieces as Point2D[][])).toBeCloseTo((4000 - 200) * T, 6);
  });

  it('τοίχος ολόκληρος μέσα σε κολώνα → [] (δεν ζωγραφίζεται)', () => {
    expect(cutWallBodyByColumns(A, [box(-500, -500, 5000, 1000)])).toEqual([]);
  });
});

describe('collectWallCrossCutters — ποιος κόβει ποιον σε διασταύρωση Χ', () => {
  const B = wall('b', 2000, -2000, 2000, 2000);

  it('γνήσιο Χ: ο ηττημένος (μεγαλύτερο id σε ισοπαλία) παίρνει τον δακτύλιο του νικητή', () => {
    const cutters = collectWallCrossCutters([A, B]);
    expect([...cutters.keys()]).toEqual(['b']);
    expect(cutters.get('b')).toEqual([wallBodyRing(A)]);
  });

  it('γωνία ή Τ δεν είναι διασταύρωση· ούτε ένας τοίχος μόνος', () => {
    expect(collectWallCrossCutters([A]).size).toBe(0);
    expect(collectWallCrossCutters([A, wall('c', 0, 0, 0, 3000)]).size).toBe(0);
    expect(collectWallCrossCutters([A, wall('d', 2000, 0, 2000, 3000)]).size).toBe(0);
  });

  it('μη ευθύγραμμος τοίχος δεν συμμετέχει', () => {
    const curved = { ...B, kind: 'curved' } as WallEntity;
    expect(collectWallCrossCutters([A, curved]).size).toBe(0);
  });
});

describe('cutWallBodyByCross', () => {
  const B = wall('b', 2000, -2000, 2000, 2000);
  const cutters = [wallBodyRing(A)];

  it('κόβει τον άκοπο δακτύλιο του ηττημένου στο τετράγωνο της διασταύρωσης', () => {
    const pieces = cutWallBodyByCross(B, undefined, cutters);
    expect(pieces).toHaveLength(2);
    expect(total(pieces as Point2D[][])).toBeCloseTo(4000 * T - T * T, 6);
  });

  it('συνθέτει πάνω στα κομμάτια του βήματος κολώνας, δεν ξεκινά από τον δακτύλιο', () => {
    // Το βήμα κολώνας άφησε ΜΟΝΟ το κάτω μισό του Β· η διασταύρωση το κόβει περαιτέρω.
    const lowerHalf = [box(2000 - T / 2, -2000, T, 2000)];
    const pieces = cutWallBodyByCross(B, lowerHalf, cutters);
    expect(pieces).toHaveLength(1);
    expect(total(pieces as Point2D[][])).toBeCloseTo(T * (2000 - T / 2), 6);
  });

  it('κόπτες που δεν αφαιρούν τίποτα → null (μένει ό,τι έδωσε το βήμα κολώνας)', () => {
    expect(cutWallBodyByCross(B, undefined, [])).toBeNull();
    expect(cutWallBodyByCross(B, undefined, [box(9000, 9000, 100, 100)])).toBeNull();
  });
});

describe('resolveWallPaintedBodies — η σύνθεση που καλεί η προεπισκόπηση', () => {
  it('άκοπος τοίχος → ένα κομμάτι, ο δακτύλιός του', () => {
    expect(resolveWallPaintedBodies([A], []).get('a')).toEqual([wallBodyRing(A)]);
  });

  it('κολώνα ΚΑΙ διασταύρωση μαζί: και τα δύο κοψίματα εφαρμόζονται, ο νικητής μένει ακέραιος', () => {
    const B = wall('b', 2000, -2000, 2000, 2000);
    // Κολώνα πάνω στο κάτω άκρο του Β (μακριά από τη διασταύρωση): του αφαιρεί 200 mm μήκος.
    const column = box(2000 - 200, -2200, 400, 400);
    const bodies = resolveWallPaintedBodies([A, B], [column]);

    expect(bodies.get('a')).toEqual([wallBodyRing(A)]);
    const b = bodies.get('b') as Point2D[][];
    expect(b).toHaveLength(2);
    expect(total(b)).toBeCloseTo(4000 * T - 200 * T - T * T, 6);
  });
});

describe('largestBodyPieceIndex', () => {
  it('το μεγαλύτερο κομμάτι· ισοπαλία → το πρώτο· κανένα → -1', () => {
    expect(largestBodyPieceIndex([box(0, 0, 10, 10), box(0, 0, 30, 10), box(0, 0, 20, 10)])).toBe(1);
    expect(largestBodyPieceIndex([box(0, 0, 10, 10), box(50, 0, 10, 10)])).toBe(0);
    expect(largestBodyPieceIndex([])).toBe(-1);
  });
});
