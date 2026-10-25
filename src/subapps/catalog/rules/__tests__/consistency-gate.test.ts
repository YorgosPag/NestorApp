import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY, MFP_SIZES } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import {
  AI_SHIFTED_HEATING,
  ARIES_DUPLICATE_CODE,
  MFP_PAGE_60,
  MFP_VARIANTS,
  mfpChain,
  mfpVariant,
  mfpVariantId,
} from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { CatalogProductDefinition } from '../../types/product';
import { axisClashIssues, findAxisCombinationClashes } from '../../values/axis-combination';
import { resolveInheritedValues } from '../../values/resolve-inherited';
import { changedCells, judgeConsistency, toVariantValueRow } from '../consistency-gate';
import { evaluateConsistency, type VariantValueRow } from '../evaluate-consistency';

const scheme = MFP_FAMILY.variantSchemes[0];

const rowsOf = (variants: readonly CatalogProductDefinition[]): VariantValueRow[] =>
  variants.map((variant, index) =>
    toVariantValueRow(mfpVariantId(index), resolveInheritedValues(mfpChain(variant, index), scheme), MFP_ATTRIBUTE_MAP, PLATFORM_MEASUREMENT_REGISTRY),
  );

const evaluate = (rows: readonly VariantValueRow[]) =>
  evaluateConsistency({
    rules: MFP_FAMILY.consistencyRules,
    rows,
    schemeAxisIds: ['size'],
    attributes: MFP_ATTRIBUTE_MAP,
    registry: PLATFORM_MEASUREMENT_REGISTRY,
  });

const clean = rowsOf(MFP_VARIANTS);

describe('προσαρμογέας: αποθηκευμένες τιμές → γραμμές αξιολογητή', () => {
  it('μέτρηση σε ΜΟΝΑΔΑ-ΠΡΟΤΥΠΟ: 340 m³/h → m³/s · 1800 W → 1800 · επιλογή → κωδικός', () => {
    expect(clean[0].values).toEqual(expect.objectContaining({
      size: 'mfp_34', cooling_h: 1800, model_code: '099-01-001',
    }));
    expect(clean[0].values.airflow_h).toBeCloseTo(340 / 3600, 10);
  });

  it('ίδια ισχύς γραμμένη σε kW αντί για W ⇒ ΙΔΙΑ γραμμή (συγκρίσιμα)', () => {
    const inKw: CatalogProductDefinition = {
      ...MFP_VARIANTS[0],
      values: { ...MFP_VARIANTS[0].values, cooling_h: { '*': { '*': { type: 'measurement', amount: '1.80', unitCode: 'kW' } } } },
    };
    expect(rowsOf([inKw])[0].values.cooling_h).toBe(1800);
  });

  it('οι πραγματικές τιμές της σελ. 60 δεν σηκώνουν ΚΑΜΙΑ σημαία', () => {
    expect(evaluate(clean)).toEqual([]);
  });
});

describe('Δ8 — «καμία ΝΕΑ παράβαση», πάνω στις ΠΡΑΓΜΑΤΙΚΕΣ αστοχίες της Φάσης 0', () => {
  it('🔴 η μετατόπιση H/M του gpt-4o (επικόλληση πάνω από σωστό πίνακα) ⇒ 7/7 μπλοκαρισμένες', () => {
    const shifted = rowsOf(MFP_SIZES.map((_, index) => mfpVariant(index, AI_SHIFTED_HEATING)));
    const verdict = judgeConsistency(evaluate(clean), evaluate(shifted), changedCells(clean, shifted));
    const heat = verdict.blocking.filter((violation) => violation.ruleId === 'rule_heat_hml');
    expect(heat.map((violation) => violation.variantIds[0])).toEqual(MFP_SIZES.map((_, index) => mfpVariantId(index)));
  });

  it('🔴 ο πραγματικός διπλός κωδικός 016-15-001 ⇒ μπλοκάρεται η εγγραφή που τον εισάγει', () => {
    const codes = MFP_PAGE_60.code.map((code, index) => (index === 1 || index === 5 ? ARIES_DUPLICATE_CODE : code));
    const duplicated = rowsOf(MFP_SIZES.map((_, index) => mfpVariant(index, { code: codes })));
    const verdict = judgeConsistency(evaluate(clean), evaluate(duplicated), changedCells(clean, duplicated));
    expect(verdict.blocking).toEqual([
      expect.objectContaining({ ruleId: 'rule_unique_code', variantIds: [mfpVariantId(1), mfpVariantId(5)] }),
    ]);
  });

  it('✅ κανόνας που προστέθηκε ΑΡΓΟΤΕΡΑ δεν κλειδώνει άσχετη αποθήκευση (βάρος της 3 με ήδη ασυνεπή θέρμανση)', () => {
    const shifted = rowsOf(MFP_SIZES.map((_, index) => mfpVariant(index, AI_SHIFTED_HEATING)));
    const before = evaluate(shifted);
    const heavier = shifted.map((row, index) => (index === 2 ? { ...row, values: { ...row.values, weight: 21 } } : row));
    const verdict = judgeConsistency(before, evaluate(heavier), changedCells(shifted, heavier));
    expect(verdict.blocking).toEqual([]);
    expect(verdict.findings.filter((violation) => violation.ruleId === 'rule_heat_hml')).toHaveLength(7);
  });

  it('🔴 όποιος ΑΓΓΙΞΕΙ ασυνεπές κελί και το αφήσει ασυνεπές ⇒ μπλοκάρεται', () => {
    const shifted = rowsOf(MFP_SIZES.map((_, index) => mfpVariant(index, AI_SHIFTED_HEATING)));
    const touched = shifted.map((row, index) => (index === 0 ? { ...row, values: { ...row.values, heating_m: 2000 } } : row));
    const verdict = judgeConsistency(evaluate(shifted), evaluate(touched), changedCells(shifted, touched));
    expect(verdict.blocking.map((violation) => violation.variantIds)).toEqual([[mfpVariantId(0)]]);
  });

  it('οι προειδοποιήσεις δεν μπλοκάρουν ποτέ (μονοτονία κατά μέγεθος)', () => {
    const smaller = clean.map((row, index) => (index === 3 ? { ...row, values: { ...row.values, cooling_h: 3000, cooling_m: 2900, cooling_l: 2800 } } : row));
    const verdict = judgeConsistency(evaluate(clean), evaluate(smaller), changedCells(clean, smaller));
    expect(verdict.blocking).toEqual([]);
    expect(verdict.findings.map((violation) => violation.ruleId)).toContain('rule_grows_with_size');
  });
});

describe('συνδυασμός αξόνων — δύο παραλλαγές «MFP-34» είναι το ίδιο προϊόν δύο φορές', () => {
  const siblings = MFP_VARIANTS.map((variant, index) => ({ id: mfpVariantId(index), values: variant.values }));

  it('7 μεγέθη ⇒ καμία σύγκρουση', () => {
    expect(findAxisCombinationClashes(siblings, ['size'], MFP_ATTRIBUTE_MAP, PLATFORM_MEASUREMENT_REGISTRY)).toEqual([]);
  });

  it('🔴 δεύτερο «mfp_34» ⇒ axisComboDuplicate με δείκτη στο πρώτο', () => {
    const twice = [...siblings, { id: 'cpr_extra', values: MFP_VARIANTS[0].values }];
    const clashes = findAxisCombinationClashes(twice, ['size'], MFP_ATTRIBUTE_MAP, PLATFORM_MEASUREMENT_REGISTRY);
    expect(axisClashIssues(clashes)).toEqual([
      { code: 'axisComboDuplicate', path: 'variants.cpr_extra', params: { other: mfpVariantId(0) } },
    ]);
  });
});
