/**
 * ADR-476 Slice 4 — Slab structural command-key registry + RC visibility gating.
 *
 * Verifies το structural reinforcement surface της πλάκας (Properties panel +
 * ribbon) είναι συνεπώς wired: τα editable keys χαρτογραφούνται 1-1 στα 5 πεδία
 * σχάρας, οι guards ταξινομούν σωστά (editable vs readout vs visibility), το
 * «Αυτόματος Οπλισμός» είναι έγκυρο slab action, και το RC gating κρύβει τον
 * οπλισμό σε σύμμικτη/ξύλινη πλάκα (parity με δοκό/κολόνα).
 */

import {
  SLAB_STRUCTURAL_KEYS,
  SLAB_STRUCTURAL_READOUT_KEYS,
  SLAB_STRUCTURAL_VISIBILITY_KEYS,
  SLAB_STRUCTURAL_KEY_TO_FIELD,
  SLAB_RIBBON_KEYS_ACTIONS,
  isSlabStructuralKey,
  isSlabStructuralReadoutKey,
  isSlabStructuralVisibilityKey,
  isSlabActionKey,
  resolveSlabPanelVisibility,
} from '../slab-command-keys';
import {
  formatSlabFoundationMainLabel,
  formatSlabFoundationTopLabel,
  type SlabFoundationReinforcement,
} from '../../../../../bim/structural/reinforcement/slab-foundation-reinforcement-types';
import type { SlabParams } from '../../../../../bim/types/slab-types';

const makeParams = (material?: string): SlabParams => ({
  kind: 'floor',
  outline: { vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 6000, y: 0, z: 0 },
    { x: 6000, y: 4000, z: 0 },
    { x: 0, y: 4000, z: 0 },
  ] },
  levelElevation: 0,
  thickness: 200,
  geometryType: 'box',
  material,
});

describe('slab-command-keys — structural registry (ADR-476 S4)', () => {
  it('maps every numeric structural key 1-1 to a mesh field (no gaps/dupes)', () => {
    const fields = Object.values(SLAB_STRUCTURAL_KEY_TO_FIELD);
    expect(fields).toEqual(
      expect.arrayContaining([
        'bottomMeshDiameter', 'bottomMeshSpacing',
        'topMeshDiameter', 'topMeshSpacing', 'cover',
      ]),
    );
    expect(new Set(fields).size).toBe(fields.length);
    // code/concreteGrade are NOT numeric mesh fields (routed separately).
    expect(SLAB_STRUCTURAL_KEY_TO_FIELD[SLAB_STRUCTURAL_KEYS.code]).toBeUndefined();
    expect(SLAB_STRUCTURAL_KEY_TO_FIELD[SLAB_STRUCTURAL_KEYS.concreteGrade]).toBeUndefined();
  });

  it('guards classify editable / readout / visibility keys disjointly', () => {
    expect(isSlabStructuralKey(SLAB_STRUCTURAL_KEYS.bottomMeshDiameter)).toBe(true);
    expect(isSlabStructuralKey(SLAB_STRUCTURAL_READOUT_KEYS.steelWeight)).toBe(false);

    expect(isSlabStructuralReadoutKey(SLAB_STRUCTURAL_READOUT_KEYS.bottomLabel)).toBe(true);
    expect(isSlabStructuralReadoutKey(SLAB_STRUCTURAL_READOUT_KEYS.loadUlsArea)).toBe(true);
    expect(isSlabStructuralReadoutKey(SLAB_STRUCTURAL_KEYS.cover)).toBe(false);

    expect(isSlabStructuralVisibilityKey(SLAB_STRUCTURAL_VISIBILITY_KEYS.structural)).toBe(true);
    expect(isSlabStructuralVisibilityKey(SLAB_STRUCTURAL_KEYS.code)).toBe(false);
  });

  it('registers «Αυτόματος Οπλισμός» as a slab action key', () => {
    expect(SLAB_RIBBON_KEYS_ACTIONS.autoReinforce).toBe('slab.actions.autoReinforce');
    expect(isSlabActionKey(SLAB_RIBBON_KEYS_ACTIONS.autoReinforce)).toBe(true);
  });
});

describe('resolveSlabPanelVisibility — RC gating (ADR-476 S4)', () => {
  const key = SLAB_STRUCTURAL_VISIBILITY_KEYS.structural;

  it('shows structural for RC (explicit or default) slabs', () => {
    expect(resolveSlabPanelVisibility(key, makeParams('rc'))).toBe(true);
    expect(resolveSlabPanelVisibility(key, makeParams(undefined))).toBe(true);
  });

  it('hides structural for composite / timber slabs', () => {
    expect(resolveSlabPanelVisibility(key, makeParams('composite'))).toBe(false);
    expect(resolveSlabPanelVisibility(key, makeParams('wood'))).toBe(false);
  });

  it('hides when no slab is selected (null params)', () => {
    expect(resolveSlabPanelVisibility(key, null)).toBe(false);
  });

  it('is a no-op (true) for non-structural visibility keys', () => {
    expect(resolveSlabPanelVisibility('some.other.key', makeParams('wood'))).toBe(true);
  });
});

describe('resolveSlabPanelVisibility — ceiling finish gating (ADR-534 Φ4)', () => {
  const key = SLAB_STRUCTURAL_VISIBILITY_KEYS.ceilingFinish;
  const withKind = (kind: SlabParams['kind']): SlabParams => ({ ...makeParams(), kind });

  it('shows soffit-finish panel ONLY for ceiling slabs', () => {
    expect(resolveSlabPanelVisibility(key, withKind('ceiling'))).toBe(true);
    expect(resolveSlabPanelVisibility(key, withKind('floor'))).toBe(false);
    expect(resolveSlabPanelVisibility(key, withKind('roof'))).toBe(false);
  });

  it('hides when no slab is selected (null params)', () => {
    expect(resolveSlabPanelVisibility(key, null)).toBe(false);
  });

  it('ceilingFinish is a registered visibility key', () => {
    expect(isSlabStructuralVisibilityKey(key)).toBe(true);
  });
});

describe('slab reinforcement labels (ADR-476 S4)', () => {
  const mesh = (diameterMm: number, spacingMm: number) => ({ diameterMm, spacingMm });
  const r: SlabFoundationReinforcement = {
    bottomMeshX: mesh(12, 200),
    bottomMeshY: mesh(12, 200),
    topMeshX: mesh(10, 250),
    topMeshY: mesh(10, 250),
    coverMm: 25,
  };

  it('formats bottom + top mesh labels distinctly', () => {
    expect(formatSlabFoundationMainLabel(r)).toBe('Ø12/200');
    expect(formatSlabFoundationTopLabel(r)).toBe('Ø10/250');
  });
});
