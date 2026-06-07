/**
 * ADR-363 Post-Creation Adjacency Merge — detector unit tests.
 *
 * Καλύπτει το `findAdjacentColumnMergeGroup`: γειτονικές κολόνες που σχηματίζουν
 * τοιχίο (Γ/Τ ή μακρόστενο ορθογώνιο > 4) → group· μη-εφαπτόμενες ή ορθογώνια
 * ένωση aspect ≤ 4 → null. Επίσης το `buildCompositeFromColumns` (union → ΕΝΑ
 * composite ColumnEntity μέσω SSoT).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import type { ColumnEntity } from '../../types/column-types';
import {
  findAdjacentColumnMergeGroup,
  buildCompositeFromColumns,
  columnWorldFootprint,
} from '../column-adjacency-detector';

const TOL = 5;
const SU = 'mm' as const;

/** Minimal ColumnEntity με world footprint (μόνο τα πεδία που διαβάζει ο detector). */
function col(id: string, poly: readonly Point2D[], floorId?: string): ColumnEntity {
  return {
    id,
    type: 'column',
    layerId: '0',
    ...(floorId ? { floorId } : {}),
    geometry: { footprint: { vertices: poly.map((p) => ({ x: p.x, y: p.y, z: 0 })) } },
  } as unknown as ColumnEntity;
}

const rect = (x0: number, y0: number, x1: number, y1: number): Point2D[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

describe('findAdjacentColumnMergeGroup', () => {
  it('two touching rectangles forming an L → merge group of 2 (composite)', () => {
    const a = col('a', rect(0, 0, 1000, 300)); // οριζόντιος βραχίονας
    const b = col('b', rect(0, 0, 300, 1000)); // κατακόρυφος βραχίονας (overlap στη γωνία)
    const group = findAdjacentColumnMergeGroup(b, [a, b] as unknown as Entity[], TOL);
    expect(group).not.toBeNull();
    expect(group?.columnIds.slice().sort()).toEqual(['a', 'b']);
    expect(group?.shape).toBe('L'); // PerimeterShape για Γ· το ColumnKind είναι 'composite'
  });

  it('two non-touching rectangles → null (no notification)', () => {
    const a = col('a', rect(0, 0, 400, 400));
    const b = col('b', rect(5000, 0, 5400, 400));
    expect(findAdjacentColumnMergeGroup(b, [a, b] as unknown as Entity[], TOL)).toBeNull();
  });

  it('three columns forming a T → merge group of 3', () => {
    const left = col('left', rect(0, 0, 1500, 300)); // αριστερό πέλμα
    const right = col('right', rect(1500, 0, 3000, 300)); // δεξί πέλμα (κοινή ακμή x=1500)
    const web = col('web', rect(1350, 300, 1650, 2000)); // κορμός (κοινή ακμή y=300)
    const group = findAdjacentColumnMergeGroup(web, [left, right, web] as unknown as Entity[], TOL);
    expect(group).not.toBeNull();
    expect(group?.columnIds.slice().sort()).toEqual(['left', 'right', 'web']);
  });

  it('two touching rectangles forming a wide rectangle aspect ≤ 4 → null', () => {
    const a = col('a', rect(0, 0, 500, 400));
    const b = col('b', rect(500, 0, 1000, 400)); // ένωση = 1000×400, aspect 2.5 → κολόνα
    expect(findAdjacentColumnMergeGroup(b, [a, b] as unknown as Entity[], TOL)).toBeNull();
  });

  it('two touching rectangles forming a slender rectangle aspect > 4 → shear-wall group', () => {
    const a = col('a', rect(0, 0, 1000, 250));
    const b = col('b', rect(1000, 0, 2000, 250)); // ένωση = 2000×250, aspect 8 → τοιχίο
    const group = findAdjacentColumnMergeGroup(b, [a, b] as unknown as Entity[], TOL);
    expect(group).not.toBeNull();
    expect(group?.aspect).toBeGreaterThan(4);
  });

  it('respects same-floor gate (different floorId never groups)', () => {
    const a = col('a', rect(0, 0, 1000, 300), 'floor-1');
    const b = col('b', rect(0, 0, 300, 1000), 'floor-2');
    expect(findAdjacentColumnMergeGroup(b, [a, b] as unknown as Entity[], TOL)).toBeNull();
  });
});

describe('buildCompositeFromColumns', () => {
  it('builds ONE composite ColumnEntity from an L-shaped union', () => {
    const a = col('a', rect(0, 0, 1000, 300));
    const b = col('b', rect(0, 0, 300, 1000));
    const composite = buildCompositeFromColumns([a, b], '0', SU, TOL);
    expect(composite).not.toBeNull();
    expect(composite?.type).toBe('column');
    expect(composite?.kind).toBe('composite');
    // Το footprint του composite είναι ΕΝΑ συνεκτικό πολύγωνο (≥6 κορυφές για Γ).
    expect((columnWorldFootprint(composite as ColumnEntity)?.length ?? 0)).toBeGreaterThanOrEqual(6);
  });

  it('builds a shear-wall composite from a slender rectangular union', () => {
    const a = col('a', rect(0, 0, 1000, 250));
    const b = col('b', rect(1000, 0, 2000, 250));
    const composite = buildCompositeFromColumns([a, b], '0', SU, TOL);
    expect(composite).not.toBeNull();
    expect(composite?.kind).toBe('shear-wall');
  });

  it('returns null for fewer than 2 footprints', () => {
    const a = col('a', rect(0, 0, 1000, 300));
    expect(buildCompositeFromColumns([a], '0', SU, TOL)).toBeNull();
  });
});
