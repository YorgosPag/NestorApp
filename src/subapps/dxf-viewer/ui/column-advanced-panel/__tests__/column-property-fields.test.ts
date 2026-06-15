/**
 * ADR-363 Phase 4 / Properties-palette split — descriptor integrity + visibility
 * gating (SSoT). Καθαρά data/logic tests — μηδέν React/canvas dependency.
 */

import {
  COLUMN_PROPERTY_GROUPS,
  COLUMN_MATERIAL_OPTIONS,
} from '../column-property-fields';
import {
  resolveColumnPanelVisibility,
  COLUMN_RIBBON_VISIBILITY_KEYS,
} from '../../ribbon/hooks/bridge/column-command-keys';

describe('column-property-fields descriptor (SSoT)', () => {
  it('έχει τα 4 αναμενόμενα groups με μοναδικά ids', () => {
    const ids = COLUMN_PROPERTY_GROUPS.map((g) => g.id);
    expect(ids).toEqual(['structural', 'finish', 'envelope', 'material']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('όλα τα fields έχουν μη-κενό commandKey + labelKey, μοναδικά commandKeys', () => {
    const keys: string[] = [];
    for (const group of COLUMN_PROPERTY_GROUPS) {
      for (const field of group.fields) {
        expect(field.commandKey.length).toBeGreaterThan(0);
        expect(field.labelKey.length).toBeGreaterThan(0);
        keys.push(field.commandKey);
      }
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('το structural group είναι gated (RC only) και τα readouts είναι read-only με options:[]', () => {
    const structural = COLUMN_PROPERTY_GROUPS.find((g) => g.id === 'structural');
    expect(structural?.visibilityKey).toBe(COLUMN_RIBBON_VISIBILITY_KEYS.structural);
    for (const field of structural!.fields) {
      if (field.readOnly) {
        expect(field.options).toHaveLength(0);
      } else {
        expect(field.options.length).toBeGreaterThan(0);
      }
    }
  });

  it('τα μη-structural groups δεν είναι gated (πάντα ορατά)', () => {
    for (const group of COLUMN_PROPERTY_GROUPS) {
      if (group.id !== 'structural') expect(group.visibilityKey).toBeUndefined();
    }
  });

  it('COLUMN_MATERIAL_OPTIONS = rc/steel/masonry/wood', () => {
    expect(COLUMN_MATERIAL_OPTIONS.map((o) => o.value)).toEqual([
      'rc',
      'steel',
      'masonry',
      'wood',
    ]);
  });
});

describe('resolveColumnPanelVisibility (SSoT gating)', () => {
  const STRUCT = COLUMN_RIBBON_VISIBILITY_KEYS.structural;

  it('structural → ορατό για ΟΛΟΥΣ τους τύπους διατομής (ADR-460: οπλισμός παντού)', () => {
    expect(resolveColumnPanelVisibility(STRUCT, 'rectangular', false)).toBe(true);
    expect(resolveColumnPanelVisibility(STRUCT, 'shear-wall', false)).toBe(true);
    expect(resolveColumnPanelVisibility(STRUCT, 'circular', false)).toBe(true);
    expect(resolveColumnPanelVisibility(STRUCT, 'I-shape', false)).toBe(true);
    expect(resolveColumnPanelVisibility(STRUCT, 'L-shape', false)).toBe(true);
  });

  it('kind === null → false (καμία επιλογή)', () => {
    expect(resolveColumnPanelVisibility(STRUCT, null, false)).toBe(false);
  });

  it('μη-gated key → true (no-op)', () => {
    expect(resolveColumnPanelVisibility('column.visibility.unknown', 'circular', false)).toBe(true);
  });

  it('ushapeParams → ορατό για U-shape χωρίς polygon, κρυφό με polygon', () => {
    const U = COLUMN_RIBBON_VISIBILITY_KEYS.ushapeParams;
    expect(resolveColumnPanelVisibility(U, 'U-shape', false)).toBe(true);
    expect(resolveColumnPanelVisibility(U, 'U-shape', true)).toBe(false);
  });
});
