/**
 * ADR-479 Slice 2 — active-preset detection.
 *
 * Επαληθεύει ότι ο selector «βλέπει» σωστά ποιο built-in preset ταυτίζεται με τα
 * τρέχοντα settings, και ότι κάθε απόκλιση → `null` («Προσαρμοσμένο»).
 *
 * @see ../resolve-active-preset.ts
 */

import { DEFAULT_STRUCTURAL_SETTINGS } from '../../structural-settings';
import {
  STRUCTURAL_PRESET_ORDER,
  buildStructuralSettingsForPreset,
} from '../structural-preset-defaults';
import { resolveActivePresetKind } from '../resolve-active-preset';

describe('resolveActivePresetKind', () => {
  it('επιστρέφει το preset όταν τα settings ταυτίζονται ακριβώς (κάθε built-in)', () => {
    for (const kind of STRUCTURAL_PRESET_ORDER) {
      const settings = buildStructuralSettingsForPreset(kind);
      expect(resolveActivePresetKind(settings)).toBe(kind);
    }
  });

  it('ταυτοποιεί τα γυμνά defaults ως το «blank» preset', () => {
    expect(resolveActivePresetKind(DEFAULT_STRUCTURAL_SETTINGS)).toBe('blank');
  });

  it('null/undefined (resolve→defaults) → «blank»', () => {
    expect(resolveActivePresetKind(null)).toBe('blank');
    expect(resolveActivePresetKind(undefined)).toBe('blank');
  });

  it('επιστρέφει null όταν έστω ένα πεδίο αποκλίνει (Προσαρμοσμένο)', () => {
    const base = buildStructuralSettingsForPreset('greek-rc-ec8');
    // Άλλαξε μόνο το έδαφος → κανένα preset δεν ταιριάζει.
    expect(resolveActivePresetKind({ ...base, soilBearingCapacityKpa: 999 })).toBeNull();
  });

  it('διακρίνει EC8 από legacy (διαφέρουν μόνο στον κανονισμό)', () => {
    expect(resolveActivePresetKind(buildStructuralSettingsForPreset('greek-rc-ec8'))).toBe(
      'greek-rc-ec8',
    );
    expect(resolveActivePresetKind(buildStructuralSettingsForPreset('greek-rc-legacy'))).toBe(
      'greek-rc-legacy',
    );
  });

  it('αγνοεί absent vs explicit-undefined optional (omit-invariant resolve)', () => {
    const blank = buildStructuralSettingsForPreset('blank');
    // Explicit undefined optionals πρέπει να ισοδυναμούν με absent → «blank».
    expect(
      resolveActivePresetKind({
        ...blank,
        soilBearingCapacityKpa: undefined,
        occupancy: undefined,
        seismicGroundType: undefined,
      }),
    ).toBe('blank');
  });
});
