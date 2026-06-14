/**
 * ADR-456 Slice 2 — structural-param helper tests.
 *
 * Επιβεβαιώνει ότι το ribbon helper (α) παράγει τα option lists από τα structural
 * SSoT, (β) διαβάζει/τροποποιεί immutably το `ColumnReinforcement`, και (γ)
 * φορμάρει σωστά τα readouts (βάρη/ρ%), χωρίς inline στατική λογική.
 */

import {
  CONCRETE_GRADE_OPTIONS,
  STRUCTURAL_CODE_OPTIONS,
  LONGITUDINAL_DIAMETER_OPTIONS,
  readReinforcementField,
  patchReinforcementField,
  resolveStructuralReadout,
} from '../structural-param';
import { CONCRETE_GRADE_ORDER } from '../../../../../bim/structural/concrete-grades';
import { REBAR_DIAMETERS_MM } from '../../../../../bim/structural/rebar-catalog';
import { STRUCTURAL_CODE_ORDER } from '../../../../../bim/structural/codes';
import { COLUMN_STRUCTURAL_READOUT_KEYS } from '../column-command-keys';
import type { ColumnReinforcement } from '../../../../../bim/structural/reinforcement/column-reinforcement-types';

const REINFORCEMENT: ColumnReinforcement = {
  longitudinal: { diameterMm: 16, count: 8 },
  stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100 },
  coverMm: 30,
};

const CTX = { widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160000 };

describe('structural-param option lists (SSoT-derived)', () => {
  it('mirror τα structural SSoT καταλόγους', () => {
    expect(CONCRETE_GRADE_OPTIONS).toHaveLength(CONCRETE_GRADE_ORDER.length);
    expect(STRUCTURAL_CODE_OPTIONS).toHaveLength(STRUCTURAL_CODE_ORDER.length);
    expect(LONGITUDINAL_DIAMETER_OPTIONS).toHaveLength(REBAR_DIAMETERS_MM.length);
    expect(CONCRETE_GRADE_OPTIONS[0].value).toBe(CONCRETE_GRADE_ORDER[0]);
    // ο κανονισμός φέρνει i18n labelKey (όχι literal).
    expect(STRUCTURAL_CODE_OPTIONS[0].isLiteralLabel).toBe(false);
    expect(STRUCTURAL_CODE_OPTIONS[0].labelKey).toContain('structural.code.');
  });
});

describe('readReinforcementField', () => {
  it('διαβάζει κάθε πεδίο', () => {
    expect(readReinforcementField(REINFORCEMENT, 'longitudinalDiameter')).toBe(16);
    expect(readReinforcementField(REINFORCEMENT, 'longitudinalCount')).toBe(8);
    expect(readReinforcementField(REINFORCEMENT, 'stirrupDiameter')).toBe(8);
    expect(readReinforcementField(REINFORCEMENT, 'stirrupSpacing')).toBe(200);
    expect(readReinforcementField(REINFORCEMENT, 'stirrupCriticalSpacing')).toBe(100);
    expect(readReinforcementField(REINFORCEMENT, 'cover')).toBe(30);
  });

  it('κρίσιμο βήμα πέφτει στο spacing όταν λείπει', () => {
    const noCrit: ColumnReinforcement = {
      ...REINFORCEMENT,
      stirrups: { diameterMm: 8, spacingMm: 250 },
    };
    expect(readReinforcementField(noCrit, 'stirrupCriticalSpacing')).toBe(250);
  });
});

describe('patchReinforcementField (immutable)', () => {
  it('ενημερώνει nested πεδίο χωρίς mutation', () => {
    const next = patchReinforcementField(REINFORCEMENT, 'longitudinalDiameter', 20);
    expect(next.longitudinal.diameterMm).toBe(20);
    expect(next.longitudinal.count).toBe(8);
    expect(REINFORCEMENT.longitudinal.diameterMm).toBe(16); // αμετάβλητο original
  });

  it('ενημερώνει stirrups + cover', () => {
    expect(patchReinforcementField(REINFORCEMENT, 'stirrupSpacing', 150).stirrups.spacingMm).toBe(150);
    expect(patchReinforcementField(REINFORCEMENT, 'cover', 25).coverMm).toBe(25);
  });
});

describe('resolveStructuralReadout', () => {
  it('βάρος σκυροδέματος = όγκος × πυκνότητα (2400)', () => {
    // 0.48 m³ × 2400 = 1152 kg
    expect(resolveStructuralReadout(COLUMN_STRUCTURAL_READOUT_KEYS.concreteWeight, 0.48, CTX, REINFORCEMENT))
      .toBe('1152');
  });

  it('ρ% = As/Ac (8Ø16 σε 400×400 ≈ 1.01%)', () => {
    expect(resolveStructuralReadout(COLUMN_STRUCTURAL_READOUT_KEYS.ratio, 0.48, CTX, REINFORCEMENT))
      .toBe('1.01');
  });

  it('βάρος χάλυβα θετικός ακέραιος', () => {
    const v = resolveStructuralReadout(COLUMN_STRUCTURAL_READOUT_KEYS.steelWeight, 0.48, CTX, REINFORCEMENT);
    expect(v).not.toBeNull();
    expect(Number(v)).toBeGreaterThan(0);
    expect(Number.isInteger(Number(v))).toBe(true);
  });

  it('επιστρέφει null για άγνωστο key', () => {
    expect(resolveStructuralReadout('column.unknown', 0.48, CTX, REINFORCEMENT)).toBeNull();
  });
});
