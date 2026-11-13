/**
 * ADR-923 §21.5 — ο κανόνας με «όταν» κρίνει ΜΟΝΟ τις παραλλαγές που ικανοποιούν τη συνθήκη.
 * Σενάριο της ηλεκτρικής παροχής: «όταν Φάσεις = 3 ⇒ Τάση ≥ 380 V» (Revit: πόλοι ↔ τάση).
 */
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import { NO_MAPPINGS } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { ConsistencyRule, RuleCondition } from '../../types/family';
import { evaluateConsistency, violationIssueParams, type VariantValueRow } from '../evaluate-consistency';

const base = (code: string) => ({
  code, groupId: 'general', labels: { el: code }, description: {}, localizable: false, scopable: false,
  unique: false, searchable: false, orderKey: 'a0', mappings: NO_MAPPINGS,
});

const ATTRIBUTES: ReadonlyMap<string, CatalogAttributeDefinition> = new Map<string, CatalogAttributeDefinition>([
  ['voltage', { ...base('voltage'), type: 'measurement', config: { measurementFamilyCode: 'voltage', defaultUnitCode: 'V', min: 0, max: null, decimals: 0, negativeAllowed: false } }],
  ['phases', { ...base('phases'), type: 'number', config: { min: 1, max: 3, decimals: 0, negativeAllowed: false } }],
  ['frequency', { ...base('frequency'), type: 'select', config: { options: [
    { code: 'hz_50', labels: { el: '50 Hz' } }, { code: 'hz_60', labels: { el: '60 Hz' } }, { code: 'hz_50_60', labels: { el: '50/60 Hz' } },
  ] } }],
  ['ec_fan', { ...base('ec_fan'), type: 'boolean', config: {} }],
]);

const THREE_PHASE: RuleCondition = { attributeId: 'phases', test: { kind: 'number', operator: 'eq', value: 3, unitCode: null } };

const minVoltage = (when: RuleCondition | null, volts = 380, unitCode = 'V'): ConsistencyRule => ({
  id: 'rule_three_phase_voltage', severity: 'error', kind: 'compare', leftAttributeId: 'voltage', operator: 'gte',
  right: { kind: 'constant', value: volts, unitCode }, when,
});

const row = (variantId: string, values: VariantValueRow['values']): VariantValueRow => ({ variantId, values });

const run = (rules: readonly ConsistencyRule[], rows: readonly VariantValueRow[]) => evaluateConsistency({
  rules, rows, schemeAxisIds: [], attributes: ATTRIBUTES, registry: PLATFORM_MEASUREMENT_REGISTRY,
});

const ROWS = [
  row('single_230', { phases: 1, voltage: 230 }),
  row('three_400', { phases: 3, voltage: 400 }),
  row('three_230', { phases: 3, voltage: 230 }),
  row('unknown_230', { voltage: 230 }),
];

describe('consistency rule "when" condition (ADR-923 §21.5)', () => {
  it('judges only the variants that satisfy the condition: a three-phase unit at 230 V is caught, a single-phase one is not', () => {
    const violations = run([minVoltage(THREE_PHASE)], ROWS);
    expect(violations.map((found) => found.variantIds)).toEqual([['three_230']]);
  });

  it('without a condition the same rule judges every variant (the condition is what narrows it)', () => {
    const violations = run([minVoltage(null)], ROWS);
    expect(violations.flatMap((found) => found.variantIds)).toEqual(['single_230', 'three_230', 'unknown_230']);
  });

  it('a variant with no value for the condition attribute is NOT judged (never "applies because unknown")', () => {
    const violations = run([minVoltage(THREE_PHASE)], ROWS);
    expect(violations.flatMap((found) => found.variantIds)).not.toContain('unknown_230');
  });

  it('the condition attribute takes part in the violation, so changing the phases touches it', () => {
    const [found] = run([minVoltage(THREE_PHASE)], ROWS);
    expect(found.attributeIds).toEqual(['voltage', 'phases']);
    expect(found.conditional).toBe(true);
    expect(violationIssueParams(found)).toEqual({ ruleId: 'rule_three_phase_voltage', kind: 'compare', scope: 'conditional' });
  });

  it('the rule constant is converted to the standard unit (0.38 kV ≡ 380 V)', () => {
    const violations = run([minVoltage(THREE_PHASE, 0.38, 'kV')], ROWS);
    expect(violations.map((found) => found.variantIds)).toEqual([['three_230']]);
  });

  it('an option condition ("in"/"notIn") selects by option code', () => {
    const rows = [
      row('a', { frequency: 'hz_60', voltage: 100 }),
      row('b', { frequency: 'hz_50', voltage: 100 }),
      row('c', { frequency: 'hz_50_60', voltage: 100 }),
    ];
    const in60 = minVoltage({ attributeId: 'frequency', test: { kind: 'option', operator: 'in', optionCodes: ['hz_60', 'hz_50_60'] } }, 110);
    const not60 = minVoltage({ attributeId: 'frequency', test: { kind: 'option', operator: 'notIn', optionCodes: ['hz_60', 'hz_50_60'] } }, 110);
    expect(run([in60], rows).flatMap((found) => found.variantIds)).toEqual(['a', 'c']);
    expect(run([not60], rows).flatMap((found) => found.variantIds)).toEqual(['b']);
  });

  it('a boolean condition compares by equality, and the condition applies to every rule kind (unique here)', () => {
    const rows = [
      row('a', { ec_fan: true, phases: 1 }),
      row('b', { ec_fan: true, phases: 1 }),
      row('c', { ec_fan: false, phases: 1 }),
    ];
    const uniqueWhenEc: ConsistencyRule = { id: 'rule_u', severity: 'warning', kind: 'unique', attributeId: 'phases', when: { attributeId: 'ec_fan', test: { kind: 'boolean', value: true } } };
    expect(run([uniqueWhenEc], rows).map((found) => found.variantIds)).toEqual([['a', 'b']]);
  });

  it('a rule without "when" keeps the old parameters (scope: all)', () => {
    const [found] = run([minVoltage(null)], [row('x', { voltage: 1 })]);
    expect(violationIssueParams(found)).toEqual({ ruleId: 'rule_three_phase_voltage', kind: 'compare', scope: 'all' });
  });
});
