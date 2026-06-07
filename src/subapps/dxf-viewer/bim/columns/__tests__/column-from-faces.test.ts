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

// Μακρόστενο 2000×300 (aspect 6.67 > 4 → shear-wall).
const SHEAR: Point2D[] = [
  { x: 0, y: 0 },
  { x: 2000, y: 0 },
  { x: 2000, y: 300 },
  { x: 0, y: 300 },
];

// Ακριβώς 1000×250 (aspect 4.0 ≤ 4 → rectangular, EC2 §9.6.1 οριακή κολόνα).
const RECT_4_EXACT: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 250 },
  { x: 0, y: 250 },
];

// 1100×250 (aspect 4.4 > 4 → shear-wall).
const SHEAR_ABOVE_4: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1100, y: 0 },
  { x: 1100, y: 250 },
  { x: 0, y: 250 },
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

/** Μετατόπιση πολυγώνου κατά (dx,dy) — για disjoint placement σε union tests. */
function off(poly: Point2D[], dx: number, dy = 0): Point2D[] {
  return poly.map((p) => ({ x: p.x + dx, y: p.y + dy }));
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

  it('μακρόστενο (aspect 6.67 > 4) → shear-wall', () => {
    const { columns } = buildColumnsFrom([lwPolyline('s', SHEAR)]);
    expect(columns).toHaveLength(1);
    expect(columns[0].params.kind).toBe('shear-wall');
    expect(columns[0].params.width).toBeCloseTo(2000, 3);
    expect(columns[0].params.depth).toBeCloseTo(300, 3);
  });

  it('EC2 §9.6.1 οριακό: aspect ακριβώς 4.0 → rectangular (κολόνα, ΟΧΙ τοιχίο)', () => {
    const { columns } = buildColumnsFrom([lwPolyline('r4', RECT_4_EXACT)]);
    expect(columns).toHaveLength(1);
    expect(columns[0].params.kind).toBe('rectangular');
  });

  it('EC2 §9.6.1: aspect 4.4 > 4 → shear-wall', () => {
    const { columns } = buildColumnsFrom([lwPolyline('s44', SHEAR_ABOVE_4)]);
    expect(columns).toHaveLength(1);
    expect(columns[0].params.kind).toBe('shear-wall');
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
  it('πολλαπλά ΑΣΥΝΔΕΤΑ περιγράμματα → ΕΝΑ ColumnEntity το καθένα', () => {
    // Disjoint placement: το auto-union (Phase 3b) κρατά τα ασύνδετα ΧΩΡΙΣΤΑ.
    const { columns } = buildColumnsFrom([
      lwPolyline('L', L_SHAPE),
      lwPolyline('U', off(U_SHAPE, 6000)),
      lwPolyline('T', off(T_SHAPE, 12000)),
    ]);
    expect(columns).toHaveLength(3);
    expect(columns.map((c) => c.params.kind).sort()).toEqual(
      ['U-shape', 'composite', 'composite'].sort(),
    );
  });
});

// ─── ADR-363 Phase 3b — auto-union γειτονικών πλαισίων ─────────────────────────

// Π σχηματισμένο από 3 ΧΩΡΙΣΤΑ ορθογώνια (δύο πόδια + κορυφαία δοκός), που
// μοιράζονται ακμές. Mirror του Giorgio test (3 πλαίσια → ένα Π στατικά).
const PI_LEFT_LEG: Point2D[] = [
  { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 3000 }, { x: 0, y: 3000 },
];
const PI_RIGHT_LEG: Point2D[] = [
  { x: 2700, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 2700, y: 3000 },
];
const PI_CROSSBAR: Point2D[] = [
  { x: 0, y: 2700 }, { x: 3000, y: 2700 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 },
];

describe('column-from-faces — auto-union (Phase 3b)', () => {
  it('3 ορθογώνια που σχηματίζουν Π → ΕΝΑ τοιχίο U-shape (όχι 3)', () => {
    const { columns } = buildColumnsFrom([
      lwPolyline('leg-L', PI_LEFT_LEG),
      lwPolyline('leg-R', PI_RIGHT_LEG),
      lwPolyline('bar', PI_CROSSBAR),
    ]);
    expect(columns).toHaveLength(1);
    expect(columns[0].params.kind).toBe('U-shape');
    expect(columns[0].params.ushape?.polygon?.length).toBe(8);
  });

  it('2 ασύνδετα (μακριά) ορθογώνια → παραμένουν 2 ξεχωριστά τοιχία', () => {
    const { columns } = buildColumnsFrom([
      lwPolyline('a', RECT),
      lwPolyline('b', off(RECT, 20000)),
    ]);
    expect(columns).toHaveLength(2);
  });
});

describe('column-from-faces — μικτή επιλογή', () => {
  it('αυτο-τεμνόμενο μόνο του → 0 τοιχία, ignored=1', () => {
    // Μόνο 1 περίγραμμα → το auto-union κάνει early-return (δεν «καθαρίζει» το
    // bowtie), οπότε ο validator το απορρίπτει κανονικά (zero area).
    const { columns, ignored } = buildColumnsFrom([lwPolyline('bad', BOWTIE)]);
    expect(columns).toHaveLength(0);
    expect(ignored).toBe(1);
  });

  it('έγκυρο Γ + μακρινό αυτο-τεμνόμενο → το union επιλύει το bowtie σε στερεά', () => {
    // Phase 3b side-effect (αποδεκτό): με ≥2 περιγράμματα το safeUnion
    // κανονικοποιεί το αυτο-τεμνόμενο σε έγκυρα solids → δεν χάνεται ως «invalid».
    const { columns } = buildColumnsFrom([
      lwPolyline('good', L_SHAPE),
      lwPolyline('bad', off(BOWTIE, 20000)),
    ]);
    expect(columns.length).toBeGreaterThanOrEqual(2);
    expect(columns.some((c) => c.params.kind === 'composite')).toBe(true);
  });
});
