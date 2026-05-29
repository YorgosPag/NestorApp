/**
 * ADR-396 P7 — Thermal Envelope Zod schemas (SSoT) + entity round-trip.
 *
 * Ο πυρήνας: τα 4 entity param schemas (`.strict()`) ΔΕΝ σβήνουν πλέον
 * `envelopeLayer`/`revealInsulation` σε parse (P2 flag → P7 fix). Χωρίς το
 * fix, τα `.strict()` schemas θα ΑΠΕΡΡΙΠΤΑΝ άγνωστο key — άρα η επιτυχής
 * διατήρηση αποδεικνύει το round-trip (ADR-375 v2.13 lesson).
 *
 * jest globals (ΟΧΙ vitest — P4 παγίδα).
 */

import {
  EnvelopeLayerSchema,
  RevealInsulationSchema,
  ThermalEnvelopeSpecSchema,
} from '../thermal-envelope.schemas';
import { ColumnParamsSchema } from '../column.schemas';
import { BeamParamsSchema } from '../beam.schemas';
import { SlabParamsSchema } from '../slab.schemas';
import { OpeningParamsSchema } from '../opening.schemas';

const Z1_LAYER = { materialId: 'mat-eps-graphite', thickness_m: 0.1, zone: 'Z1' } as const;
const Z2_LAYER = { materialId: 'mat-xps', thickness_m: 0.08, zone: 'Z2' } as const;
const Z4_REVEAL = { materialId: 'mat-eps-graphite', thickness_m: 0.05, zone: 'Z4' } as const;

describe('EnvelopeLayerSchema', () => {
  it('δέχεται έγκυρη στρώση Z1', () => {
    expect(EnvelopeLayerSchema.parse(Z1_LAYER)).toEqual(Z1_LAYER);
  });

  it('απορρίπτει πάχος < 5εκ (D6)', () => {
    expect(() => EnvelopeLayerSchema.parse({ ...Z1_LAYER, thickness_m: 0.02 })).toThrow();
  });

  it('απορρίπτει άγνωστη ζώνη', () => {
    expect(() => EnvelopeLayerSchema.parse({ ...Z1_LAYER, zone: 'Z9' })).toThrow();
  });

  it('απορρίπτει κενό materialId', () => {
    expect(() => EnvelopeLayerSchema.parse({ ...Z1_LAYER, materialId: '' })).toThrow();
  });
});

describe('RevealInsulationSchema', () => {
  it('δέχεται Z4 reveal', () => {
    expect(RevealInsulationSchema.parse(Z4_REVEAL)).toEqual(Z4_REVEAL);
  });

  it('απορρίπτει ζώνη ≠ Z4 (τα περβάζια είναι πάντα Z4)', () => {
    expect(() => RevealInsulationSchema.parse({ ...Z4_REVEAL, zone: 'Z1' })).toThrow();
  });
});

describe('ThermalEnvelopeSpecSchema', () => {
  const SPEC = {
    materialId: 'mat-eps-graphite',
    thickness_m: 0.1,
    revealThickness_m: 0.05,
    zones: { Z1: true, Z2: true, Z3: false, Z4: true },
  } as const;

  it('δέχεται έγκυρο per-floor spec', () => {
    expect(ThermalEnvelopeSpecSchema.parse(SPEC)).toEqual(SPEC);
  });

  it('απορρίπτει spec χωρίς zones', () => {
    const { zones: _omit, ...noZones } = SPEC;
    expect(() => ThermalEnvelopeSpecSchema.parse(noZones)).toThrow();
  });
});

describe('entity param schemas — envelopeLayer/revealInsulation round-trip (.strict, no strip)', () => {
  it('ColumnParamsSchema διατηρεί envelopeLayer', () => {
    const params = {
      kind: 'rectangular', position: { x: 0, y: 0 }, anchor: 'center',
      width: 400, depth: 400, height: 3000, rotation: 0,
      baseBinding: 'storey-floor', topBinding: 'storey-ceiling',
      baseOffset: 0, topOffset: 0, envelopeLayer: Z1_LAYER,
    };
    const parsed = ColumnParamsSchema.parse(params);
    expect(parsed.envelopeLayer).toEqual(Z1_LAYER);
  });

  it('BeamParamsSchema διατηρεί envelopeLayer', () => {
    const params = {
      kind: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 1000, y: 0 },
      width: 200, depth: 400, topElevation: 3000, envelopeLayer: Z1_LAYER,
    };
    const parsed = BeamParamsSchema.parse(params);
    expect(parsed.envelopeLayer).toEqual(Z1_LAYER);
  });

  it('SlabParamsSchema διατηρεί envelopeLayer (Z2)', () => {
    const params = {
      kind: 'floor',
      outline: { vertices: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] },
      levelElevation: 0, thickness: 200, geometryType: 'box', envelopeLayer: Z2_LAYER,
    };
    const parsed = SlabParamsSchema.parse(params);
    expect(parsed.envelopeLayer).toEqual(Z2_LAYER);
  });

  it('OpeningParamsSchema διατηρεί revealInsulation (Z4)', () => {
    const params = {
      kind: 'window', wallId: 'w1', offsetFromStart: 500,
      width: 1100, height: 1100, sillHeight: 900, revealInsulation: Z4_REVEAL,
    };
    const parsed = OpeningParamsSchema.parse(params);
    expect(parsed.revealInsulation).toEqual(Z4_REVEAL);
  });

  it('entities χωρίς θερμοπρόσοψη παραμένουν έγκυρα (optional)', () => {
    const params = {
      kind: 'rectangular', position: { x: 0, y: 0 }, anchor: 'center',
      width: 400, depth: 400, height: 3000, rotation: 0,
      baseBinding: 'storey-floor', topBinding: 'storey-ceiling',
      baseOffset: 0, topOffset: 0,
    };
    expect(ColumnParamsSchema.parse(params).envelopeLayer).toBeUndefined();
  });
});
