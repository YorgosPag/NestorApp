/**
 * ADR-363 Φάση 3 «Τοιχίο από περίγραμμα» — end-to-end geometry path tests.
 *
 * Drives the box-select pipeline στο SSoT level: scene faces → perimeter analysis
 * → **ΕΝΑ `ColumnEntity` (τοιχίο ΟΣ) ανά κλειστή περίμετρο** (ΠΟΤΕ αποσύνθεση).
 * Covers το map shape→ColumnKind (ορθογώνιο→rectangular/shear-wall· Γ/Τ/σύνθετο→
 * composite· Π→U-shape), το non-decomposition invariant, το polygon-centering
 * round-trip (footprint == αρχικό περίγραμμα), και τον ignored count.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity, LWPolylineEntity } from '../../../types/entities';
import { perimeterFacesToColumns } from '../column-from-faces';
import { perimeterFacesToRects } from '../../walls/perimeter-from-faces';

const TOL = 5;
const SU = 'mm' as const;
const LEVEL = '0';

// Ορθογώνιο 1000×800 (aspect 1.25 < 4 → rectangular).
const RECT: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 800 },
  { x: 0, y: 800 },
];

// Μακρόστενο 2000×300 (aspect 6.67 ≥ 4 → shear-wall).
const SHEAR: Point2D[] = [
  { x: 0, y: 0 },
  { x: 2000, y: 0 },
  { x: 2000, y: 300 },
  { x: 0, y: 300 },
];

// Γ (L) — 6 κορυφές, 1 reflex → composite.
const L_SHAPE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 300 },
  { x: 300, y: 300 },
  { x: 300, y: 3000 },
  { x: 0, y: 3000 },
];

// Τ — 8 κορυφές, 2 reflex (απόσταση 3) → composite.
const T_SHAPE: Point2D[] = [
  { x: 1000, y: 0 },
  { x: 2000, y: 0 },
  { x: 2000, y: 2000 },
  { x: 3000, y: 2000 },
  { x: 3000, y: 3000 },
  { x: 0, y: 3000 },
  { x: 0, y: 2000 },
  { x: 1000, y: 2000 },
];

// Π (U) — 8 κορυφές, 2 reflex (απόσταση 1) → U-shape.
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

// Σταυρός (+) — 12 κορυφές, 4 reflex → composite.
const CROSS: Point2D[] = [
  { x: 1000, y: 0 },
  { x: 2000, y: 0 },
  { x: 2000, y: 1000 },
  { x: 3000, y: 1000 },
  { x: 3000, y: 2000 },
  { x: 2000, y: 2000 },
  { x: 2000, y: 3000 },
  { x: 1000, y: 3000 },
  { x: 1000, y: 2000 },
  { x: 0, y: 2000 },
  { x: 0, y: 1000 },
  { x: 1000, y: 1000 },
];

// Bowtie (αυτο-τεμνόμενο) — μηδενικό εμβαδόν → validator-rejected → ignored.
const BOWTIE: Point2D[] = [
  { x: 10000, y: 0 },
  { x: 11000, y: 1000 },
  { x: 11000, y: 0 },
  { x: 10000, y: 1000 },
];

function lwPolyline(id: string, verts: Point2D[]): LWPolylineEntity {
  return { id, type: 'lwpolyline', layerId: 'lyr', vertices: verts, closed: true } as LWPolylineEntity;
}

function buildColumnsFrom(entities: Entity[]) {
  return perimeterFacesToColumns(entities, TOL, LEVEL, SU);
}

describe('column-from-faces — ορθογώνιο → rectangular / shear-wall', () => {
  it('τετράγωνη/χαμηλού aspect → rectangular, width=longSide, depth=shortSide', () => {
    const { columns } = buildColumnsFrom([lwPolyline('r', RECT)]);
    expect(columns).toHaveLength(1);
    expect(columns[0].type).toBe('column');
    expect(columns[0].params.kind).toBe('rectangular');
    expect(columns[0].params.width).toBeCloseTo(1000, 3);
    expect(columns[0].params.depth).toBeCloseTo(800, 3);
  });

  it('μακρόστενο (aspect ≥ 4) → shear-wall', () => {
    const { columns } = buildColumnsFrom([lwPolyline('s', SHEAR)]);
    expect(columns).toHaveLength(1);
    expect(columns[0].params.kind).toBe('shear-wall');
    expect(columns[0].params.width).toBeCloseTo(2000, 3);
    expect(columns[0].params.depth).toBeCloseTo(300, 3);
  });
});

describe('column-from-faces — μη-ορθογωνικά → polygon-backed (exact polygon)', () => {
  it('Γ (L) → composite, ΕΝΑ entity (ΟΧΙ αποσύνθεση σε σκέλη)', () => {
    const { columns } = buildColumnsFrom([lwPolyline('L', L_SHAPE)]);
    expect(columns).toHaveLength(1);
    expect(columns[0].params.kind).toBe('composite');
    expect(columns[0].params.composite?.polygon.length).toBe(6);
  });

  it('Τ → composite (ΕΝΑ entity)', () => {
    const { columns } = buildColumnsFrom([lwPolyline('T', T_SHAPE)]);
    expect(columns).toHaveLength(1);
    expect(columns[0].params.kind).toBe('composite');
  });

  it('Π (U) → U-shape polygon-backed (ΕΝΑ entity)', () => {
    const { columns } = buildColumnsFrom([lwPolyline('U', U_SHAPE)]);
    expect(columns).toHaveLength(1);
    expect(columns[0].params.kind).toBe('U-shape');
    expect(columns[0].params.ushape?.polygon?.length).toBe(8);
  });

  it('σταυρός → composite (ΕΝΑ entity, 12 κορυφές)', () => {
    const { columns } = buildColumnsFrom([lwPolyline('+', CROSS)]);
    expect(columns).toHaveLength(1);
    expect(columns[0].params.kind).toBe('composite');
    expect(columns[0].params.composite?.polygon.length).toBe(12);
  });
});

describe('column-from-faces — polygon-centering round-trip', () => {
  it('το footprint του τοιχίου ταυτίζεται με το αρχικό περίγραμμα (world)', () => {
    const entities = [lwPolyline('L', L_SHAPE)];
    const expected = perimeterFacesToRects(entities, TOL).perimeters[0].polygon;
    const { columns } = buildColumnsFrom(entities);
    const footprint = columns[0].geometry.footprint.vertices;
    expect(footprint).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(footprint[i].x).toBeCloseTo(expected[i].x, 3);
      expect(footprint[i].y).toBeCloseTo(expected[i].y, 3);
    }
  });
});

describe('column-from-faces — ΕΝΑ entity ανά περίμετρο (μη-αποσύνθεση)', () => {
  it('πολλαπλά περιγράμματα → ΕΝΑ ColumnEntity το καθένα', () => {
    const { columns } = buildColumnsFrom([
      lwPolyline('L', L_SHAPE),
      lwPolyline('U', U_SHAPE),
      lwPolyline('T', T_SHAPE),
    ]);
    expect(columns).toHaveLength(3);
    expect(columns.map((c) => c.params.kind).sort()).toEqual(
      ['U-shape', 'composite', 'composite'].sort(),
    );
  });
});

describe('column-from-faces — μικτή επιλογή', () => {
  it('χτίζει το έγκυρο Γ και μετρά το αυτο-τεμνόμενο ως ignored', () => {
    const { columns, ignored } = buildColumnsFrom([
      lwPolyline('good', L_SHAPE),
      lwPolyline('bad', BOWTIE),
    ]);
    expect(columns).toHaveLength(1);
    expect(ignored).toBe(1);
  });
});
