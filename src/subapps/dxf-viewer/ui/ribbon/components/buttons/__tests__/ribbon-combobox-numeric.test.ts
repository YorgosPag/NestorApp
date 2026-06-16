/**
 * ADR-345 §4.5 — Unit tests for the numeric editable-combobox SSoT helpers.
 */

import {
  parseOptionNumber,
  isNumericOptionList,
  resolveNumericConfig,
  filterNumericDraft,
  commitNumericDraft,
  type ResolvedNumericConfig,
} from '../ribbon-combobox-numeric';
import type {
  RibbonCommand,
  RibbonComboboxOption,
} from '../../../types/ribbon-types';

const numOpt = (v: string): RibbonComboboxOption => ({
  value: v,
  labelKey: v,
  isLiteralLabel: true,
});
const enumOpt = (v: string): RibbonComboboxOption => ({
  value: v,
  labelKey: `ribbon.${v}`,
  isLiteralLabel: false,
});
const cmd = (over: Partial<RibbonCommand> = {}): RibbonCommand => ({
  id: 'x',
  labelKey: 'x',
  commandKey: 'x',
  ...over,
});

describe('parseOptionNumber', () => {
  it('parses integers, decimals (dot and comma), and negatives', () => {
    expect(parseOptionNumber('1500')).toBe(1500);
    expect(parseOptionNumber('1.5')).toBe(1.5);
    expect(parseOptionNumber('1,5')).toBe(1.5);
    expect(parseOptionNumber('-1000')).toBe(-1000);
  });
  it('rejects empty / partial / non-numeric', () => {
    expect(parseOptionNumber('')).toBeNull();
    expect(parseOptionNumber('-')).toBeNull();
    expect(parseOptionNumber('.')).toBeNull();
    expect(parseOptionNumber('1:50')).toBeNull();
    expect(parseOptionNumber('center')).toBeNull();
  });
});

describe('isNumericOptionList', () => {
  it('true only when every option is a numeric literal', () => {
    expect(isNumericOptionList([numOpt('300'), numOpt('500')])).toBe(true);
    expect(isNumericOptionList([numOpt('-500'), numOpt('-1000')])).toBe(true);
    expect(isNumericOptionList([])).toBe(false);
    expect(isNumericOptionList([enumOpt('center')])).toBe(false);
    expect(isNumericOptionList([numOpt('300'), enumOpt('auto')])).toBe(false);
    // Labelled non-numeric literal (scale "1:50") → not numeric.
    expect(isNumericOptionList([{ value: '1:50', labelKey: '1:50', isLiteralLabel: true }])).toBe(false);
  });
});

describe('resolveNumericConfig', () => {
  it('returns null for enum lists', () => {
    expect(resolveNumericConfig(cmd(), [enumOpt('center')])).toBeNull();
  });
  it('infers negatives from negative presets (top-elevation)', () => {
    const c = resolveNumericConfig(cmd(), [numOpt('-500'), numOpt('-2000')]);
    expect(c?.allowNegative).toBe(true);
  });
  it('blocks negatives for all-positive dimension presets', () => {
    const c = resolveNumericConfig(cmd(), [numOpt('300'), numOpt('500')]);
    expect(c?.allowNegative).toBe(false);
    expect(c?.allowDecimal).toBe(false);
  });
  it('infers decimals from non-integer presets', () => {
    const c = resolveNumericConfig(cmd(), [numOpt('1.0'), numOpt('1.5')]);
    expect(c?.allowDecimal).toBe(true);
  });
  it('command override wins (allow negative on positive presets)', () => {
    const c = resolveNumericConfig(
      cmd({ numericInput: { allowNegative: true } }),
      [numOpt('0'), numOpt('90')],
    );
    expect(c?.allowNegative).toBe(true);
  });
  it('editable:false forces a plain Select even for numeric lists', () => {
    expect(resolveNumericConfig(cmd({ numericInput: { editable: false } }), [numOpt('1')])).toBeNull();
  });
  it('editable:true forces editing even without numeric presets', () => {
    const c = resolveNumericConfig(cmd({ numericInput: { editable: true } }), []);
    expect(c).not.toBeNull();
  });
});

describe('filterNumericDraft', () => {
  const pos: ResolvedNumericConfig = { allowNegative: false, allowDecimal: false };
  const signedDec: ResolvedNumericConfig = { allowNegative: true, allowDecimal: true };
  it('strips letters and stray symbols', () => {
    expect(filterNumericDraft('1a5b0', pos)).toBe('150');
  });
  it('drops minus when not allowed; keeps a single leading minus when allowed', () => {
    expect(filterNumericDraft('-150', pos)).toBe('150');
    expect(filterNumericDraft('-1-5', signedDec)).toBe('-15');
  });
  it('keeps only the first decimal separator and normalizes comma to dot', () => {
    expect(filterNumericDraft('1,5', signedDec)).toBe('1.5');
    expect(filterNumericDraft('1.5.2', signedDec)).toBe('1.52');
    expect(filterNumericDraft('1.5', pos)).toBe('15');
  });
});

describe('commitNumericDraft', () => {
  const pos: ResolvedNumericConfig = { allowNegative: false, allowDecimal: true };
  const signed: ResolvedNumericConfig = { allowNegative: true, allowDecimal: false };
  it('commits valid values, normalizing comma', () => {
    expect(commitNumericDraft('1500', pos)).toBe('1500');
    expect(commitNumericDraft('1,5', pos)).toBe('1.5');
    expect(commitNumericDraft('-1000', signed)).toBe('-1000');
  });
  it('rejects partial / empty drafts', () => {
    expect(commitNumericDraft('', pos)).toBeNull();
    expect(commitNumericDraft('-', signed)).toBeNull();
    expect(commitNumericDraft('.', pos)).toBeNull();
  });
  it('rejects negatives when not allowed', () => {
    expect(commitNumericDraft('-5', pos)).toBeNull();
  });
  it('enforces min/max', () => {
    expect(commitNumericDraft('5', { ...pos, min: 10 })).toBeNull();
    expect(commitNumericDraft('50', { ...pos, max: 20 })).toBeNull();
    expect(commitNumericDraft('15', { ...pos, min: 10, max: 20 })).toBe('15');
  });
});
