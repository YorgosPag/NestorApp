/**
 * ADR-677 Φάση 2β — the display-unit boundary for ribbon numeric comboboxes.
 *
 * Two things are pinned here, and the second matters more than the first:
 *   1. a `model-length` field renders in the user's unit and commits back in mm;
 *   2. every OTHER kind — counts, degrees, percentages, paper mm, DN sizes — comes out
 *      byte-identical. That is the regression that would silently corrupt drawings
 *      («16 βαθμίδες» → «0.016»), so it is asserted per-kind rather than in the abstract.
 */

import {
  isUnitConvertedKind,
  optionsToDisplayUnit,
  valueToDisplayUnit,
  valueFromDisplayUnit,
  boundsToDisplayUnit,
  isSameCommittedValue,
  unitSuffixFor,
} from '../ribbon-display-unit';
import { displayUnitState } from '../../../../config/display-unit-state';
import type { RibbonComboboxOption, RibbonQuantityKind } from '../../types/ribbon-types';

const opt = (v: string): RibbonComboboxOption => ({
  value: v,
  labelKey: v,
  isLiteralLabel: true,
});

/** Every kind that must pass through untouched (i.e. everything except model-length). */
const NON_CONVERTED_KINDS: readonly RibbonQuantityKind[] = [
  'paper-length', 'screen-px', 'angle', 'count', 'percent', 'ratio',
  'nominal-diameter', 'power', 'pressure', 'temperature', 'volume', 'mass',
  'dimensionless',
];

beforeEach(() => {
  displayUnitState.setUnit('m');
});

afterAll(() => {
  displayUnitState.setUnit('m');
});

describe('isUnitConvertedKind', () => {
  it('converts model-length and nothing else', () => {
    expect(isUnitConvertedKind('model-length')).toBe(true);
    for (const kind of NON_CONVERTED_KINDS) {
      expect(isUnitConvertedKind(kind)).toBe(false);
    }
  });

  it('treats an undeclared field as NOT converted (safe default)', () => {
    // The asymmetry is the whole safety argument: a forgotten declaration must leave the
    // field in mm, never rescale it. See RibbonQuantityKind's doc-comment.
    expect(isUnitConvertedKind(undefined)).toBe(false);
  });
});

describe('optionsToDisplayUnit', () => {
  it('re-expresses a mm preset ladder in metres — value AND label together', () => {
    const shown = optionsToDisplayUnit([opt('900'), opt('2000')], 'model-length');
    expect(shown.map((o) => o.value)).toEqual(['0.900', '2.000']);
    // A converted value with a stale «900» label would read one thing and commit another.
    expect(shown.map((o) => o.labelKey)).toEqual(['0.900', '2.000']);
  });

  it('follows the active unit', () => {
    displayUnitState.setUnit('cm');
    expect(optionsToDisplayUnit([opt('900')], 'model-length')[0].value).toBe('90.00');
    displayUnitState.setUnit('mm');
    expect(optionsToDisplayUnit([opt('900')], 'model-length')[0].value).toBe('900');
  });

  it('leaves EVERY non-length kind exactly as authored', () => {
    // 16 steps stay 16 steps; 45° stays 45; DN110 stays 110.
    for (const kind of NON_CONVERTED_KINDS) {
      const shown = optionsToDisplayUnit([opt('16'), opt('45'), opt('110')], kind);
      expect(shown.map((o) => o.value)).toEqual(['16', '45', '110']);
    }
    expect(optionsToDisplayUnit([opt('16')], undefined)[0].value).toBe('16');
  });

  it('passes non-numeric entries through untouched', () => {
    const enumOpt: RibbonComboboxOption = { value: 'auto', labelKey: 'ribbon.auto' };
    expect(optionsToDisplayUnit([enumOpt], 'model-length')[0]).toBe(enumOpt);
  });
});

describe('valueToDisplayUnit / valueFromDisplayUnit', () => {
  it('round-trips a millimetre value through the display unit', () => {
    const shown = valueToDisplayUnit('900', 'model-length');
    expect(shown).toBe('0.900');
    expect(valueFromDisplayUnit(shown!, 'model-length')).toBe('900');
  });

  it('keeps a mixed selection (null) as null', () => {
    expect(valueToDisplayUnit(null, 'model-length')).toBeNull();
  });

  it('never touches a non-length value in either direction', () => {
    expect(valueToDisplayUnit('16', 'count')).toBe('16');
    expect(valueFromDisplayUnit('16', 'count')).toBe('16');
    expect(valueToDisplayUnit('2.5', 'paper-length')).toBe('2.5');
    expect(valueFromDisplayUnit('2.5', 'paper-length')).toBe('2.5');
  });

  it('renders the same string for a value and its matching preset', () => {
    // Otherwise the dropdown would not mark the current value as selected.
    const preset = optionsToDisplayUnit([opt('900')], 'model-length')[0].value;
    expect(valueToDisplayUnit('900', 'model-length')).toBe(preset);
  });
});

describe('boundsToDisplayUnit', () => {
  it('moves mm-authored min/max into the space the user types in', () => {
    // hatch gapTolerance is declared `max: 5000` (mm). Against a metre draft an unconverted
    // guard would accept 5000 m.
    const moved = boundsToDisplayUnit(
      { allowNegative: false, allowDecimal: true, min: 0, max: 5000 },
      'model-length',
    );
    expect(moved.min).toBe(0);
    expect(moved.max).toBe(5);
  });

  it('leaves bounds alone for non-length fields', () => {
    // A tilt guard of 0..80 DEGREES must never become 0..0.08.
    const cfg = { allowNegative: false, allowDecimal: false, min: 0, max: 80 };
    expect(boundsToDisplayUnit(cfg, 'angle')).toEqual(cfg);
  });

  it('returns the config untouched when there are no bounds', () => {
    const cfg = { allowNegative: false, allowDecimal: true };
    expect(boundsToDisplayUnit(cfg, 'model-length')).toBe(cfg);
  });
});

describe('isSameCommittedValue', () => {
  it('treats differently-written equal numbers as the same commit', () => {
    // `commitNumericDraft` normalises «0.900» → «0.9»; both are 900 mm, so the store must
    // not take a no-op write on every blur.
    expect(isSameCommittedValue('900', '900.0')).toBe(true);
    expect(isSameCommittedValue('0.9', '0.90')).toBe(true);
  });

  it('still reports a real change', () => {
    expect(isSameCommittedValue('900', '1000')).toBe(false);
  });
});

describe('ADR-677 Φάση 2γ — unitSuffixFor', () => {
  it('a converted field shows the ACTIVE unit, not a hardcoded one', () => {
    // Το σύμβολο ακολουθεί την επιλογή του χρήστη — αυτός ήταν όλος ο λόγος που το «(mm)»
    // έφυγε από τις 13 ετικέτες: μια σταθερή ετικέτα δεν μπορεί να πει την αλήθεια.
    expect(unitSuffixFor('model-length', 'm')).toBe('m');
    expect(unitSuffixFor('model-length', 'mm')).toBe('mm');
    expect(unitSuffixFor('model-length', 'cm')).toBe('cm');
    expect(unitSuffixFor('model-length', 'in')).toBe('"');
  });

  it.each(NON_CONVERTED_KINDS)('%s gets NO suffix', (kind) => {
    // «16 βαθμίδες m» ή «DN 100 m» θα ήταν χειρότερα από καμία ένδειξη.
    expect(unitSuffixFor(kind, 'm')).toBeUndefined();
  });

  it('an undeclared field gets no suffix either', () => {
    // Ίδια σκόπιμη ασυμμετρία με τη μετατροπή: απουσία δήλωσης = μη κάνεις τίποτα.
    expect(unitSuffixFor(undefined, 'm')).toBeUndefined();
  });
});
