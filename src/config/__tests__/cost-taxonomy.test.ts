/**
 * ADR-917 §7 Α8 + taxonomy rules — every cost code has a label in el AND en,
 * soft and ΑΤΟΕ families stay apart, and the dot always rolls up to the group.
 */

import elProcurement from '@/i18n/locales/el/procurement.json';
import enProcurement from '@/i18n/locales/en/procurement.json';
import {
  allCostCodes,
  compareCostCodes,
  costCodeFamilyOf,
  costCodeGroupOf,
  costCodeLabelKey,
  isBudgetLineCostCode,
  SOFT_COST_CODES,
  UNCATEGORIZED_COST_CODE,
} from '../cost-taxonomy';

const LOCALES: Record<string, { categories: Record<string, string> }> = {
  el: elProcurement,
  en: enProcurement,
};

describe('cost taxonomy (ADR-917 Α1 · Ζ1)', () => {
  it.each(Object.keys(LOCALES))('Α8 🔴 every cost code has a non-empty label in %s', locale => {
    const missing = allCostCodes().filter(code => {
      const key = costCodeLabelKey(code).replace('procurement:categories.', '');
      return !LOCALES[locale].categories[key];
    });
    expect(missing).toEqual([]);
  });

  it('the label key is the procurement category key — ONE label per code for every screen', () => {
    expect(costCodeLabelKey('SOFT-LAND')).toBe('procurement:categories.SOFT-LAND');
  });

  it('ten one-level soft codes (Ζ1)', () => {
    expect(SOFT_COST_CODES).toHaveLength(10);
    expect(SOFT_COST_CODES.every(code => code.startsWith('SOFT-') && !code.includes('.'))).toBe(true);
  });

  it('families: ΑΤΟΕ (any level) · soft (any level) · other', () => {
    expect(costCodeFamilyOf('OIK-2.03')).toBe('atoe');
    expect(costCodeFamilyOf('SOFT-PERMITS.TEE')).toBe('soft');
    expect(costCodeFamilyOf(UNCATEGORIZED_COST_CODE)).toBe('other');
    expect(costCodeFamilyOf('SOFT-UNKNOWN')).toBe('other');
  });

  it('the dot rolls up to the group; no code ⇒ OTHER', () => {
    expect(costCodeGroupOf('SOFT-PERMITS.TEE')).toBe('SOFT-PERMITS');
    expect(costCodeGroupOf('OIK-10.20')).toBe('OIK-10');
    expect(costCodeGroupOf('')).toBe(UNCATEGORIZED_COST_CODE);
    expect(costCodeGroupOf(null)).toBe(UNCATEGORIZED_COST_CODE);
  });

  it('a budget line takes a catalogue ΑΤΟΕ code or a soft code — never OTHER or an unknown code', () => {
    expect(isBudgetLineCostCode('OIK-2')).toBe(true);
    expect(isBudgetLineCostCode('SOFT-PERMITS.TEE')).toBe(true);
    expect(isBudgetLineCostCode('OIK-99')).toBe(false);
    expect(isBudgetLineCostCode('SOFT-UNKNOWN')).toBe(false);
    expect(isBudgetLineCostCode(UNCATEGORIZED_COST_CODE)).toBe(false);
  });

  it('🔴 the lower level is ONE short code segment — never free text under a valid group (Φ3β)', () => {
    expect(isBudgetLineCostCode('OIK-2.03')).toBe(true);
    expect(isBudgetLineCostCode('SOFT-PERMITS.tee')).toBe(false);
    expect(isBudgetLineCostCode('SOFT-PERMITS.TEE.X')).toBe(false);
    expect(isBudgetLineCostCode('SOFT-PERMITS.')).toBe(false);
    expect(isBudgetLineCostCode('SOFT-PERMITS.ΤΕΕ')).toBe(false);
    expect(isBudgetLineCostCode(`SOFT-PERMITS.${'A'.repeat(17)}`)).toBe(false);
    expect(isBudgetLineCostCode('SOFT-PERMITS/TEE')).toBe(false);
  });

  it('order: ΑΤΟΕ by catalogue → soft by declaration → other', () => {
    const codes = ['OTHER', 'SOFT-CONTINGENCY', 'OIK-10', 'SOFT-LAND', 'OIK-2'];
    expect([...codes].sort(compareCostCodes)).toEqual(['OIK-2', 'OIK-10', 'SOFT-LAND', 'SOFT-CONTINGENCY', 'OTHER']);
  });
});
