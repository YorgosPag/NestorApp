/**
 * ADR-363 §5.6c — Γενικός edit-time detector «σχέσεων» διατομής (validator-driven, όλοι οι τύποι).
 *
 * Καλύπτει: εισαγωγή νέας παραβίασης ανά τύπο (Γ/Τ/Π/Ι/πολύγωνο/τοιχίο-min-πάχος), crossing-only
 * (καμία re-nag σε ήδη-υπάρχουσα), καθαρή μετάβαση → null, και το reinforcement gate (φθηνό vs πλήρες).
 */

import { detectColumnRelationshipWarning } from '../section-relationship-warning';
import {
  DEFAULT_COLUMN_BASE_BINDING,
  DEFAULT_COLUMN_TOP_BINDING,
} from '../../types/bim-binding';
import type { ColumnKind, ColumnParams } from '../../types/column-types';

function makeParams(over: Partial<ColumnParams> & { kind?: ColumnKind }): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center',
    width: 500,
    depth: 500,
    height: 3000,
    rotation: 0,
    baseBinding: DEFAULT_COLUMN_BASE_BINDING,
    topBinding: DEFAULT_COLUMN_TOP_BINDING,
    ...over,
  };
}

const K = (leaf: string) => `column.validation.hardErrors.${leaf}`;

describe('detectColumnRelationshipWarning — per-type crossing', () => {
  it('Γ (L): σκέλος > bbox → invalidLshapeArm', () => {
    const prev = makeParams({ kind: 'L-shape', lshape: { armLength: 150, armWidth: 150 } });
    const next = makeParams({ kind: 'L-shape', lshape: { armLength: 600, armWidth: 150 } });
    const res = detectColumnRelationshipWarning(prev, next);
    expect(res).not.toBeNull();
    expect(res?.violationKeys).toContain(K('invalidLshapeArm'));
  });

  it('Τ (T): πέλμα-πάχος > βάθος → invalidTshapeFlange', () => {
    const base = { kind: 'T-shape' as const, width: 600, depth: 400 };
    const prev = makeParams({ ...base, tshape: { flangeLength: 600, webThickness: 200, flangeThickness: 150 } });
    const next = makeParams({ ...base, tshape: { flangeLength: 600, webThickness: 200, flangeThickness: 450 } });
    const res = detectColumnRelationshipWarning(prev, next);
    expect(res?.violationKeys).toContain(K('invalidTshapeFlange'));
  });

  it('Π (U): 2×πόδι > πλάτος → invalidUshapeLeg', () => {
    const base = { kind: 'U-shape' as const, width: 500, depth: 400 };
    const prev = makeParams({ ...base, ushape: { legThickness: 200, baseThickness: 200 } });
    const next = makeParams({ ...base, ushape: { legThickness: 300, baseThickness: 200 } });
    const res = detectColumnRelationshipWarning(prev, next);
    expect(res?.violationKeys).toContain(K('invalidUshapeLeg'));
  });

  it('Ι (I): 2×tf ≥ ύψος → invalidIShapeFlangeOverlap', () => {
    const base = { kind: 'I-shape' as const, width: 300, depth: 300 };
    const prev = makeParams({ ...base, ishape: { flangeThickness: 60, webThickness: 20 } });
    const next = makeParams({ ...base, ishape: { flangeThickness: 160, webThickness: 20 } });
    const res = detectColumnRelationshipWarning(prev, next);
    expect(res?.violationKeys).toContain(K('invalidIShapeFlangeOverlap'));
  });

  it('Πολύγωνο: πλευρές ∉ [3,12] → invalidPolygonSides', () => {
    const prev = makeParams({ kind: 'polygon', polygon: { sides: 6 } });
    const next = makeParams({ kind: 'polygon', polygon: { sides: 15 } });
    const res = detectColumnRelationshipWarning(prev, next);
    expect(res?.violationKeys).toContain(K('invalidPolygonSides'));
  });

  it('Τοιχίο: πάχος < 150mm → shearWallThicknessNotConstructible (νέα κάλυψη §5.6c)', () => {
    const prev = makeParams({ kind: 'shear-wall', width: 2000, depth: 200 });
    const next = makeParams({ kind: 'shear-wall', width: 2000, depth: 100 });
    const res = detectColumnRelationshipWarning(prev, next);
    expect(res?.violationKeys).toContain(K('shearWallThicknessNotConstructible'));
  });
});

describe('detectColumnRelationshipWarning — crossing-only (μηδέν re-nag)', () => {
  it('καθαρή → καθαρή μετάβαση → null', () => {
    const prev = makeParams({ kind: 'L-shape', lshape: { armLength: 150, armWidth: 150 } });
    const next = makeParams({ kind: 'L-shape', lshape: { armLength: 180, armWidth: 150 } });
    expect(detectColumnRelationshipWarning(prev, next)).toBeNull();
  });

  it('prev ήδη εκφυλισμένο, next ακόμη εκφυλισμένο (ίδιο key) → null', () => {
    const prev = makeParams({ kind: 'L-shape', lshape: { armLength: 600, armWidth: 150 } });
    const next = makeParams({ kind: 'L-shape', lshape: { armLength: 700, armWidth: 150 } });
    expect(detectColumnRelationshipWarning(prev, next)).toBeNull();
  });

  it('identity → null', () => {
    const p = makeParams({ kind: 'L-shape', lshape: { armLength: 150, armWidth: 150 } });
    expect(detectColumnRelationshipWarning(p, p)).toBeNull();
  });
});

describe('detectColumnRelationshipWarning — reinforcement gate', () => {
  it('γεωμετρική εκφύλιση πιάνεται και ΧΩΡΙΣ οπλισμό (φθηνό, hot-path) και ΜΕ οπλισμό (πλήρες)', () => {
    const prev = makeParams({ kind: 'L-shape', lshape: { armLength: 150, armWidth: 150 } });
    const next = makeParams({ kind: 'L-shape', lshape: { armLength: 600, armWidth: 150 } });
    expect(detectColumnRelationshipWarning(prev, next, { includeReinforcement: false })?.violationKeys)
      .toContain(K('invalidLshapeArm'));
    expect(detectColumnRelationshipWarning(prev, next, { includeReinforcement: true })?.violationKeys)
      .toContain(K('invalidLshapeArm'));
  });
});
