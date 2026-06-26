/**
 * ADR-471 — beam Properties-palette descriptor integrity + visibility gating
 * (SSoT). Καθαρά data/logic tests — μηδέν React/canvas dependency. Mirror του
 * `column-property-fields.test.ts`.
 */

import { BEAM_EFFECTIVE_FLANGE_FIELD, BEAM_PROPERTY_GROUPS } from '../beam-property-fields';
import {
  resolveBeamPanelVisibility,
  isBeamStructuralReadoutKey,
  BEAM_STRUCTURAL_VISIBILITY_KEYS,
} from '../../ribbon/hooks/bridge/beam-command-keys';
import type { BeamParams } from '../../../bim/types/beam-types';

describe('beam-property-fields descriptor (SSoT)', () => {
  it('έχει τα 2 αναμενόμενα groups με μοναδικά ids', () => {
    const ids = BEAM_PROPERTY_GROUPS.map((g) => g.id);
    expect(ids).toEqual(['structural', 'loads']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('όλα τα fields έχουν μη-κενό commandKey + labelKey, μοναδικά commandKeys', () => {
    const keys: string[] = [];
    for (const group of BEAM_PROPERTY_GROUPS) {
      for (const field of group.fields) {
        expect(field.commandKey.length).toBeGreaterThan(0);
        expect(field.labelKey.length).toBeGreaterThan(0);
        keys.push(field.commandKey);
      }
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('το structural group είναι gated (RC only) και τα readouts είναι read-only με options:[]', () => {
    const structural = BEAM_PROPERTY_GROUPS.find((g) => g.id === 'structural');
    expect(structural?.visibilityKey).toBe(BEAM_STRUCTURAL_VISIBILITY_KEYS.structural);
    for (const field of structural!.fields) {
      if (field.readOnly) {
        expect(field.options).toHaveLength(0);
        expect(isBeamStructuralReadoutKey(field.commandKey)).toBe(true);
      } else {
        expect(field.options.length).toBeGreaterThan(0);
      }
    }
  });

  it('το loads group δεν είναι gated (πάντα ορατό) και είναι όλα read-only readouts', () => {
    const loads = BEAM_PROPERTY_GROUPS.find((g) => g.id === 'loads');
    expect(loads?.visibilityKey).toBeUndefined();
    for (const field of loads!.fields) {
      expect(field.readOnly).toBe(true);
      expect(field.options).toHaveLength(0);
      expect(isBeamStructuralReadoutKey(field.commandKey)).toBe(true);
    }
  });

  it('το DERIVED b_eff field (Φ3c-A) είναι read-only, μη-bridge, ΕΚΤΟΣ των groups (scene-conditional)', () => {
    expect(BEAM_EFFECTIVE_FLANGE_FIELD.readOnly).toBe(true);
    expect(BEAM_EFFECTIVE_FLANGE_FIELD.options).toHaveLength(0);
    expect(BEAM_EFFECTIVE_FLANGE_FIELD.labelKey.length).toBeGreaterThan(0);
    // commandKey ΟΧΙ bridge readout key (η τιμή είναι scene-injected, όχι resolver-driven).
    expect(isBeamStructuralReadoutKey(BEAM_EFFECTIVE_FLANGE_FIELD.commandKey)).toBe(false);
    // Δεν διπλασιάζει commandKey κανενός group field.
    const groupKeys = BEAM_PROPERTY_GROUPS.flatMap((g) => g.fields.map((f) => f.commandKey));
    expect(groupKeys).not.toContain(BEAM_EFFECTIVE_FLANGE_FIELD.commandKey);
  });

  it('οι 2 στρώσεις διαμήκων (κάτω/άνω) υπάρχουν ως editable πεδία (vs κολόνα ενιαία)', () => {
    const structural = BEAM_PROPERTY_GROUPS.find((g) => g.id === 'structural');
    const editableKeys = structural!.fields.filter((f) => !f.readOnly).map((f) => f.commandKey);
    expect(editableKeys).toContain('beam.structural.bottomDiameter');
    expect(editableKeys).toContain('beam.structural.bottomCount');
    expect(editableKeys).toContain('beam.structural.topDiameter');
    expect(editableKeys).toContain('beam.structural.topCount');
  });
});

describe('resolveBeamPanelVisibility (SSoT gating)', () => {
  const STRUCT = BEAM_STRUCTURAL_VISIBILITY_KEYS.structural;

  function params(overrides: Partial<BeamParams>): BeamParams {
    return { width: 250, depth: 500, ...overrides } as BeamParams;
  }

  it('structural → ορατό για RC ορθογωνική δοκό (rectangular σκυρόδεμα)', () => {
    expect(resolveBeamPanelVisibility(STRUCT, params({ material: 'rc' }))).toBe(true);
    expect(resolveBeamPanelVisibility(STRUCT, params({}))).toBe(true);
  });

  it('structural → κρυφό για μεταλλική Ι / glulam (ο οπλισμός δεν έχει νόημα)', () => {
    expect(resolveBeamPanelVisibility(STRUCT, params({ sectionKind: 'I-shape' }))).toBe(false);
    expect(resolveBeamPanelVisibility(STRUCT, params({ material: 'steel' }))).toBe(false);
    expect(resolveBeamPanelVisibility(STRUCT, params({ material: 'glulam' }))).toBe(false);
  });

  it('params === null → false (καμία επιλογή)', () => {
    expect(resolveBeamPanelVisibility(STRUCT, null)).toBe(false);
  });

  it('μη-gated key → true (no-op)', () => {
    expect(resolveBeamPanelVisibility('beam.visibility.unknown', params({ material: 'rc' }))).toBe(true);
  });
});
