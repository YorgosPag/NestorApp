/**
 * Tests για thermal-envelope-types SSoT (ADR-396 Phase P1).
 *
 * Foundations only: material id, default thicknesses, ΚΕΝΑΚ advisory
 * thresholds (OQ-1) + catalog/ΑΤΟΕ wiring του γραφιτούχου EPS (OQ-2).
 */

import {
  GRAPHITE_EPS_MATERIAL_ID,
  DEFAULT_ENVELOPE_THICKNESS_M,
  DEFAULT_REVEAL_THICKNESS_M,
  KENAK_MIN_THICKNESS_M,
  getEnvelopeMinThickness,
  isBelowKenakAdvisory,
} from '../thermal-envelope-types';
import {
  WALL_MATERIAL_PRESET_IDS,
  classifyWallMaterial,
} from '../../walls/wall-material-catalog';
import { resolveMaterialAtoeMapping } from '../../config/material-to-atoe-mapping';

describe('thermal-envelope-types — constants', () => {
  it('GRAPHITE_EPS_MATERIAL_ID is the Neopor preset slug', () => {
    expect(GRAPHITE_EPS_MATERIAL_ID).toBe('mat-eps-graphite');
  });

  it('default thicknesses match ADR-396 §5 (Z1=0.10, Z4=0.05)', () => {
    expect(DEFAULT_ENVELOPE_THICKNESS_M).toBe(0.1);
    expect(DEFAULT_REVEAL_THICKNESS_M).toBe(0.05);
  });

  it('ΚΕΝΑΚ advisory minima match OQ-1 (facade=0.07, reveal=0.02)', () => {
    expect(KENAK_MIN_THICKNESS_M.facade).toBe(0.07);
    expect(KENAK_MIN_THICKNESS_M.reveal).toBe(0.02);
  });

  it('default thicknesses are ≥ their advisory minima', () => {
    expect(DEFAULT_ENVELOPE_THICKNESS_M).toBeGreaterThanOrEqual(KENAK_MIN_THICKNESS_M.facade);
    expect(DEFAULT_REVEAL_THICKNESS_M).toBeGreaterThanOrEqual(KENAK_MIN_THICKNESS_M.reveal);
  });
});

describe('getEnvelopeMinThickness', () => {
  it('Z1/Z2/Z3 → facade minimum (0.07)', () => {
    expect(getEnvelopeMinThickness('Z1')).toBe(0.07);
    expect(getEnvelopeMinThickness('Z2')).toBe(0.07);
    expect(getEnvelopeMinThickness('Z3')).toBe(0.07);
  });

  it('Z4 → reveal minimum (0.02)', () => {
    expect(getEnvelopeMinThickness('Z4')).toBe(0.02);
  });
});

describe('isBelowKenakAdvisory (advisory only, never blocks)', () => {
  it('flags facade thickness below 0.07', () => {
    expect(isBelowKenakAdvisory(0.05, 'Z1')).toBe(true);
    expect(isBelowKenakAdvisory(0.069, 'Z2')).toBe(true);
  });

  it('does not flag facade thickness at/above 0.07', () => {
    expect(isBelowKenakAdvisory(0.07, 'Z1')).toBe(false);
    expect(isBelowKenakAdvisory(0.1, 'Z3')).toBe(false);
  });

  it('reveal (Z4) tolerates down to 0.02 — small surfaces (OQ-1)', () => {
    expect(isBelowKenakAdvisory(0.02, 'Z4')).toBe(false);
    expect(isBelowKenakAdvisory(0.05, 'Z4')).toBe(false);
    expect(isBelowKenakAdvisory(0.019, 'Z4')).toBe(true);
  });
});

describe('graphite EPS preset wiring (SSoT cross-check)', () => {
  it('mat-eps-graphite is registered in the wall material catalog', () => {
    expect(WALL_MATERIAL_PRESET_IDS).toContain(GRAPHITE_EPS_MATERIAL_ID);
  });

  it('classifyWallMaterial treats it as a preset (not custom)', () => {
    expect(classifyWallMaterial(GRAPHITE_EPS_MATERIAL_ID)).toBe('preset');
  });

  it('resolves to ΑΤΟΕ OIK-10.05 m2 area (OQ-2)', () => {
    const m = resolveMaterialAtoeMapping(GRAPHITE_EPS_MATERIAL_ID);
    expect(m).not.toBeNull();
    expect(m!.categoryCode).toBe('OIK-10.05');
    expect(m!.unit).toBe('m2');
    expect(m!.quantityKind).toBe('area');
  });
});
