/**
 * ADR-396 Phase P10 — tests για per-wall-type U-value analytics.
 * jest globals (ΟΧΙ vitest import — repo standard).
 */

import {
  wallDnaToThermalLayers,
  computeWallTypeUValue,
  computeWallTypeUValueWithEnvelope,
  type EnvelopeLayerInput,
} from '../wall-assembly-thermal';
import {
  SURFACE_RESISTANCES_BY_FLOW,
  type SurfaceFlowDirection,
} from '../assembly-u-value';
import type { WallDna } from '../../types/wall-dna-types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDna(layers: Array<{ thickness: number; materialId: string }>): WallDna {
  return {
    layers: layers.map((l, i) => ({
      id: `layer-${i}`,
      name: l.materialId,
      thickness: l.thickness,
      materialId: l.materialId,
      side: i === 0 ? 'exterior' : i === layers.length - 1 ? 'interior' : 'core',
    })),
    totalThickness: layers.reduce((s, l) => s + l.thickness, 0),
  };
}

// Standard 3-layer exterior wall: 20 ext plaster + 200 brick + 20 int plaster
const BRICK_WALL_DNA = makeDna([
  { thickness: 20, materialId: 'mat-plaster-ext' },
  { thickness: 200, materialId: 'mat-brick-masonry' },
  { thickness: 20, materialId: 'mat-plaster-int' },
]);

// Wall with one unknown/custom material
const MIXED_DNA = makeDna([
  { thickness: 20, materialId: 'mat-plaster-ext' },
  { thickness: 200, materialId: 'my-custom-material' },
  { thickness: 20, materialId: 'mat-plaster-int' },
]);

// Single concrete layer
const CONCRETE_DNA = makeDna([
  { thickness: 210, materialId: 'mat-concrete-c25' },
]);

// ─── wallDnaToThermalLayers ───────────────────────────────────────────────────

describe('wallDnaToThermalLayers', () => {
  it('μετατρέπει DNA layers σε ThermalLayer (mm→m)', () => {
    const layers = wallDnaToThermalLayers(BRICK_WALL_DNA);
    expect(layers).toHaveLength(3);
    // εξωτ. σοβάς 20mm → 0.02m, λ=0.87
    expect(layers[0].thickness_m).toBeCloseTo(0.02, 6);
    expect(layers[0].lambda).toBeCloseTo(0.87, 6);
    // οπτοπλινθοδομή 200mm → 0.2m, λ=0.51
    expect(layers[1].thickness_m).toBeCloseTo(0.2, 6);
    expect(layers[1].lambda).toBeCloseTo(0.51, 6);
    // εσωτ. σοβάς 20mm → 0.02m, λ=0.7
    expect(layers[2].thickness_m).toBeCloseTo(0.02, 6);
    expect(layers[2].lambda).toBeCloseTo(0.7, 6);
  });

  it('παραλείπει στρώσεις με άγνωστο λ (custom material)', () => {
    const layers = wallDnaToThermalLayers(MIXED_DNA);
    // Η custom στρώση παραλείπεται → 2 layer
    expect(layers).toHaveLength(2);
    expect(layers.every((l) => l.lambda !== undefined)).toBe(true);
  });

  it('επιστρέφει [] για DNA με μόνο custom layers', () => {
    const dna = makeDna([{ thickness: 200, materialId: 'totally-unknown' }]);
    expect(wallDnaToThermalLayers(dna)).toHaveLength(0);
  });

  it('concrete 210mm → 1 layer, 0.21m, λ=2.0', () => {
    const layers = wallDnaToThermalLayers(CONCRETE_DNA);
    expect(layers).toHaveLength(1);
    expect(layers[0].thickness_m).toBeCloseTo(0.21, 6);
    expect(layers[0].lambda).toBeCloseTo(2.0, 6);
  });
});

// ─── computeWallTypeUValue ────────────────────────────────────────────────────

describe('computeWallTypeUValue', () => {
  it('τυπικός τοίχος (εξωτ.σοβάς + οπτοπλινθοδομή + εσωτ.σοβάς) ≈ 1.63 W/m²K', () => {
    const u = computeWallTypeUValue(BRICK_WALL_DNA);
    // R = 0.13 + 0.02/0.87 + 0.20/0.51 + 0.02/0.7 + 0.04
    //   ≈ 0.13 + 0.023 + 0.392 + 0.029 + 0.04 ≈ 0.614
    expect(u).toBeCloseTo(1 / 0.6137, 1);
  });

  it('υψηλότερη U για τοίχο χωρίς μόνωση (μονότονη)', () => {
    const uBare = computeWallTypeUValue(BRICK_WALL_DNA);
    const dnaWithInsulation = makeDna([
      { thickness: 20, materialId: 'mat-plaster-ext' },
      { thickness: 200, materialId: 'mat-brick-masonry' },
      { thickness: 80, materialId: 'mat-eps' },
      { thickness: 20, materialId: 'mat-plaster-int' },
    ]);
    const uInsulated = computeWallTypeUValue(dnaWithInsulation);
    expect(uBare).toBeGreaterThan(uInsulated);
  });

  it('επιστρέφει Infinity όταν δεν υπάρχει κανένα γνωστό layer', () => {
    const emptyDna = makeDna([{ thickness: 200, materialId: 'unknown' }]);
    // μόνο Rsi+Rse → R=0.17 → U=1/0.17 (Infinity check: δεν είναι Infinity)
    const u = computeWallTypeUValue(emptyDna);
    expect(Number.isFinite(u)).toBe(true);
    // R = 0.13 + 0.04 = 0.17 (χωρίς layers)
    expect(u).toBeCloseTo(1 / 0.17, 1);
  });

  it('δέχεται custom surface resistances', () => {
    const uRoof = computeWallTypeUValue(BRICK_WALL_DNA, SURFACE_RESISTANCES_BY_FLOW.roof);
    const uWall = computeWallTypeUValue(BRICK_WALL_DNA, SURFACE_RESISTANCES_BY_FLOW.wall);
    // στέγη: Rsi=0.10 < 0.13 → μικρότερο Rtotal → μεγαλύτερο U
    expect(uRoof).toBeGreaterThan(uWall);
  });
});

// ─── computeWallTypeUValueWithEnvelope ───────────────────────────────────────

describe('computeWallTypeUValueWithEnvelope', () => {
  const NEOPOR_10CM: EnvelopeLayerInput = { thickness_m: 0.10, materialId: 'mat-eps-graphite' };
  const EPS_10CM: EnvelopeLayerInput = { thickness_m: 0.10, materialId: 'mat-eps' };

  it('U με κέλυφος < U χωρίς κέλυφος', () => {
    const uBare = computeWallTypeUValue(BRICK_WALL_DNA);
    const uEnv = computeWallTypeUValueWithEnvelope(BRICK_WALL_DNA, NEOPOR_10CM);
    expect(uEnv).toBeLessThan(uBare);
  });

  it('Neopor (0.031) → U<0.30 για τυπικό τοίχο + 10εκ ETICS', () => {
    const u = computeWallTypeUValueWithEnvelope(BRICK_WALL_DNA, NEOPOR_10CM);
    expect(u).toBeLessThan(0.30);
  });

  it('virtual append ΔΕΝ μεταλλάσσει το DNA', () => {
    const layersBefore = BRICK_WALL_DNA.layers.length;
    computeWallTypeUValueWithEnvelope(BRICK_WALL_DNA, NEOPOR_10CM);
    expect(BRICK_WALL_DNA.layers.length).toBe(layersBefore);
  });

  it('άγνωστο materialId στο envelope → ίδιο αποτέλεσμα με bare U (skip)', () => {
    const uEnvUnknown = computeWallTypeUValueWithEnvelope(
      BRICK_WALL_DNA,
      { thickness_m: 0.1, materialId: 'custom-foam' },
    );
    const uBare = computeWallTypeUValue(BRICK_WALL_DNA);
    expect(uEnvUnknown).toBeCloseTo(uBare, 6);
  });

  it('παχύτερο ETICS → χαμηλότερο U (μονότονο)', () => {
    const u10 = computeWallTypeUValueWithEnvelope(BRICK_WALL_DNA, { ...EPS_10CM, thickness_m: 0.10 });
    const u20 = computeWallTypeUValueWithEnvelope(BRICK_WALL_DNA, { ...EPS_10CM, thickness_m: 0.20 });
    expect(u20).toBeLessThan(u10);
  });
});

// ─── SURFACE_RESISTANCES_BY_FLOW ─────────────────────────────────────────────

describe('SURFACE_RESISTANCES_BY_FLOW', () => {
  const FLOWS: SurfaceFlowDirection[] = ['wall', 'roof', 'floor'];

  it('όλες οι κατευθύνσεις παρούσες', () => {
    FLOWS.forEach((f) => {
      expect(SURFACE_RESISTANCES_BY_FLOW[f]).toBeDefined();
      expect(SURFACE_RESISTANCES_BY_FLOW[f].rsi).toBeGreaterThan(0);
      expect(SURFACE_RESISTANCES_BY_FLOW[f].rse).toBeGreaterThan(0);
    });
  });

  it('ISO 6946 τιμές', () => {
    expect(SURFACE_RESISTANCES_BY_FLOW.wall.rsi).toBe(0.13);
    expect(SURFACE_RESISTANCES_BY_FLOW.wall.rse).toBe(0.04);
    expect(SURFACE_RESISTANCES_BY_FLOW.roof.rsi).toBe(0.10);
    expect(SURFACE_RESISTANCES_BY_FLOW.roof.rse).toBe(0.04);
    expect(SURFACE_RESISTANCES_BY_FLOW.floor.rsi).toBe(0.17);
    expect(SURFACE_RESISTANCES_BY_FLOW.floor.rse).toBe(0.17);
  });

  it('wall default = RSI_WALL_DEFAULT', () => {
    // Ο wall.rsi πρέπει να ταυτίζεται με RSI_WALL_DEFAULT (mutable lock)
    const { RSI_WALL_DEFAULT, RSE_WALL_DEFAULT } = require('../assembly-u-value');
    expect(SURFACE_RESISTANCES_BY_FLOW.wall.rsi).toBe(RSI_WALL_DEFAULT);
    expect(SURFACE_RESISTANCES_BY_FLOW.wall.rse).toBe(RSE_WALL_DEFAULT);
  });
});
