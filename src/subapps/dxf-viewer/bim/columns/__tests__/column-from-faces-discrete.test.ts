/**
 * ADR-363 Φάση 3c «Κολώνα από περίγραμμα» — discrete (no-union) classification tests.
 *
 * Καλύπτει: (1) `perimeterColumnKind` + `isWallColumnKind` (στατικά τίμια ταξινόμηση
 * ανά αναλογία πλευρών), (2) `classifyPerimeterFacesToColumns` ΧΩΡΙΣ ένωση (κάθε
 * περίγραμμα ξεχωριστό· wallCount/columnCount breakdown), (3) `classifyColumnsFrom-
 * Perimeters` (click-inside path). Αντίθεση με το union path (Φάση 3) που ενώνει.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity, LWPolylineEntity } from '../../../types/entities';
import {
  classifyPerimeterFacesToColumns,
  classifyColumnsFromPerimeters,
  perimeterColumnKind,
  isWallColumnKind,
} from '../column-from-faces';
import { perimeterFacesToRects } from '../../walls/perimeter-from-faces';

const TOL = 5;
const SU = 'mm' as const;
const LEVEL = '0';

// Ορθογώνιο 1000×800 (aspect 1.25 < 4 → κολώνα rectangular).
const RECT: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 800 },
  { x: 0, y: 800 },
];

// Μακρόστενο 2000×300 (aspect 6.67 ≥ 4 → τοιχίο shear-wall).
const SHEAR: Point2D[] = [
  { x: 0, y: 0 },
  { x: 2000, y: 0 },
  { x: 2000, y: 300 },
  { x: 0, y: 300 },
];

// Γ (L) — 6 κορυφές → composite (τοιχίο).
const L_SHAPE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 300 },
  { x: 300, y: 300 },
  { x: 300, y: 3000 },
  { x: 0, y: 3000 },
];

// Π (U) — 8 κορυφές → U-shape (τοιχίο).
const U_SHAPE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 3000 },
  { x: 2700, y: 3000 },
  { x: 2700, y: 300 },
  { x: 300, y: 300 },
  { x: 300, y: 3000 },
  { x: 0, y: 3000 },
];

function lwPolyline(id: string, verts: Point2D[]): LWPolylineEntity {
  return { id, type: 'lwpolyline', layerId: 'lyr', vertices: verts, closed: true } as LWPolylineEntity;
}

function off(poly: Point2D[], dx: number, dy = 0): Point2D[] {
  return poly.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

describe('perimeterColumnKind / isWallColumnKind — στατικά τίμια ταξινόμηση', () => {
  function kindOf(poly: Point2D[]): string {
    const { perimeters } = perimeterFacesToRects([lwPolyline('p', poly)], TOL, {
      unionTouching: false,
    });
    return perimeterColumnKind(perimeters[0]);
  }

  it('ορθογώνιο aspect < 4 → rectangular (κολώνα)', () => {
    expect(kindOf(RECT)).toBe('rectangular');
  });
  it('ορθογώνιο aspect ≥ 4 → shear-wall (τοιχίο)', () => {
    expect(kindOf(SHEAR)).toBe('shear-wall');
  });
  it('Γ (L) → composite (τοιχίο)', () => {
    expect(kindOf(L_SHAPE)).toBe('composite');
  });
  it('Π (U) → U-shape (τοιχίο)', () => {
    expect(kindOf(U_SHAPE)).toBe('U-shape');
  });

  it('isWallColumnKind: rectangular=false, shear-wall/composite/U-shape=true', () => {
    expect(isWallColumnKind('rectangular')).toBe(false);
    expect(isWallColumnKind('shear-wall')).toBe(true);
    expect(isWallColumnKind('composite')).toBe(true);
    expect(isWallColumnKind('U-shape')).toBe(true);
  });
});

describe('classifyPerimeterFacesToColumns — ΧΩΡΙΣ ένωση + breakdown', () => {
  function classify(entities: Entity[]) {
    return classifyPerimeterFacesToColumns(entities, TOL, LEVEL, SU);
  }

  it('μία κολώνα → columnCount=1, wallCount=0', () => {
    const r = classify([lwPolyline('r', RECT)]);
    expect(r.columns).toHaveLength(1);
    expect(r.columnCount).toBe(1);
    expect(r.wallCount).toBe(0);
  });

  it('ένα μακρόστενο → wallCount=1, columnCount=0', () => {
    const r = classify([lwPolyline('s', SHEAR)]);
    expect(r.wallCount).toBe(1);
    expect(r.columnCount).toBe(0);
  });

  it('μικτή επιλογή (RECT + SHEAR + L) → columnCount=1, wallCount=2', () => {
    const r = classify([
      lwPolyline('r', RECT),
      lwPolyline('s', off(SHEAR, 6000)),
      lwPolyline('L', off(L_SHAPE, 12000)),
    ]);
    expect(r.columns).toHaveLength(3);
    expect(r.columnCount).toBe(1);
    expect(r.wallCount).toBe(2);
  });

  it('ΧΩΡΙΣ ένωση: 2 εφαπτόμενα ορθογώνια → 2 ξεχωριστές κολώνες (όχι 1)', () => {
    // Αντίθεση με το union path (Φάση 3) που θα τα ένωνε σε ΕΝΑ σύνθετο.
    const r = classify([
      lwPolyline('a', RECT),
      lwPolyline('b', off(RECT, 1000)), // μοιράζεται την ακμή x=1000
    ]);
    expect(r.columns).toHaveLength(2);
    expect(r.columnCount).toBe(2);
    expect(r.wallCount).toBe(0);
  });
});

describe('classifyColumnsFromPerimeters — click-inside path (ήδη φιλτραρισμένα)', () => {
  it('ταξινομεί έτοιμα perimeters με τα ίδια counts', () => {
    const { perimeters } = perimeterFacesToRects(
      [lwPolyline('r', RECT), lwPolyline('s', off(SHEAR, 6000))],
      TOL,
      { unionTouching: false },
    );
    const r = classifyColumnsFromPerimeters(perimeters, LEVEL, SU);
    expect(r.columns).toHaveLength(2);
    expect(r.columnCount).toBe(1);
    expect(r.wallCount).toBe(1);
  });
});
