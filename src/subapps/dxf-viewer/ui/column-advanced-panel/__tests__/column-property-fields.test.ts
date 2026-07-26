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
  COLUMN_BURIED_READOUT_KEYS,
} from '../../ribbon/hooks/bridge/column-command-keys';
import { BURIED_WATERPROOFING_MATERIALS } from '../../../bim/finishes/buried-waterproofing';

describe('column-property-fields descriptor (SSoT)', () => {
  it('έχει τα 7 αναμενόμενα groups με μοναδικά ids', () => {
    const ids = COLUMN_PROPERTY_GROUPS.map((g) => g.id);
    // ADR-404 Φ5 — `tilt` group (κεκλιμένη κολώνα / Revit "Slanted Column").
    // ADR-715 — `buriedWaterproofing` ΑΜΕΣΩΣ μετά το `finish`: είναι ο αδελφός του για την άλλη
    // πλευρά του ορίου εδάφους (πάνω σοβάς, κάτω στεγάνωση), άρα διαβάζονται μαζί.
    expect(ids).toEqual([
      'structural', 'loads', 'tilt', 'finish', 'buriedWaterproofing', 'envelope', 'material',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('το loads group (ADR-467) δεν είναι gated και είναι όλα read-only readouts', () => {
    const loads = COLUMN_PROPERTY_GROUPS.find((g) => g.id === 'loads');
    expect(loads?.visibilityKey).toBeUndefined();
    for (const field of loads!.fields) {
      expect(field.readOnly).toBe(true);
      expect(field.options).toHaveLength(0);
    }
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

  /**
   * ADR-715 — το group στεγάνωσης είναι ΠΑΡΑΓΩΓΟ του καταλόγου, όχι χειρόγραφη λίστα. Αυτό το
   * test είναι η δικλείδα του: προσθέτοντας 9ο υλικό στον κατάλογο, εμφανίζεται εδώ **μόνο** του.
   * Αν κάποιος αντικαταστήσει τα options με hardcoded λίστα, το πλήθος αποκλίνει → κόκκινο.
   */
  it('το buriedWaterproofing group παράγεται από τον κατάλογο (8 υλικά, 2 ομάδες)', () => {
    const buried = COLUMN_PROPERTY_GROUPS.find((g) => g.id === 'buriedWaterproofing');
    const material = buried?.fields.find((f) => f.commandKey.endsWith('materialId'));
    expect(material?.options.map((o) => o.value)).toEqual(BURIED_WATERPROOFING_MATERIALS);
    // Κάθε option φέρει ομάδα (αλλιώς η λίστα των 8 αποδίδεται επίπεδη — βλ. ADR-715 §5).
    expect(material?.options.every((o) => o.groupLabelKey !== undefined)).toBe(true);
    expect(new Set(material?.options.map((o) => o.groupLabelKey)).size).toBe(2);
  });

  it('το readout απόκλισης βαφής (ADR-715 §3.1) είναι read-only με options:[]', () => {
    const buried = COLUMN_PROPERTY_GROUPS.find((g) => g.id === 'buriedWaterproofing');
    const readout = buried?.fields.find((f) => f.readOnly);
    expect(readout?.commandKey).toBe(COLUMN_BURIED_READOUT_KEYS.paintDivergence);
    expect(readout?.options).toHaveLength(0);
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
