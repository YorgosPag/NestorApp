import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY, MFP_SIZES } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { evaluateConsistency, type VariantValueRow } from '../evaluate-consistency';

/** Ψυκτικές ισχείς H/M/L σε W (μονάδα-πρότυπο), αύξουσες ανά μέγεθος. */
const COOLING_W: ReadonlyArray<readonly [number, number, number]> = [
  [1530, 1250, 990], [2150, 1800, 1400], [2940, 2400, 1860], [3550, 2900, 2250],
  [4100, 3350, 2600], [5300, 4300, 3300], [6200, 5100, 3900],
];

function rows(mutate?: (index: number, values: Record<string, number | string>) => void): VariantValueRow[] {
  return MFP_SIZES.map((size, index) => {
    const [h, m, l] = COOLING_W[index];
    const values: Record<string, number | string> = {
      size, model_code: `030-14-00${index + 1}`, cooling_h: h, cooling_m: m, cooling_l: l,
    };
    mutate?.(index, values);
    return { variantId: size, values };
  });
}

const run = (variantRows: VariantValueRow[]) => evaluateConsistency({
  rules: MFP_FAMILY.consistencyRules,
  rows: variantRows,
  schemeAxisIds: ['size'],
  attributes: MFP_ATTRIBUTE_MAP,
  registry: PLATFORM_MEASUREMENT_REGISTRY,
});

describe('evaluateConsistency — Phase 0 fixtures', () => {
  it('a clean MFP table raises nothing', () => {
    expect(run(rows())).toEqual([]);
  });

  it('catches the real duplicate item code of the Aries catalog (016-15-001 twice)', () => {
    const violations = run(rows((index, values) => {
      if (index === 1 || index === 5) values.model_code = '016-15-001';
    }));
    expect(violations).toEqual([
      expect.objectContaining({ ruleId: 'rule_unique_code', variantIds: ['mfp_51', 'mfp_136'] }),
    ]);
  });

  it('catches the AI column shift (H/M swapped by one column) on every affected variant', () => {
    const violations = run(rows((index, values) => {
      const [h, m] = [values.cooling_h, values.cooling_m];
      values.cooling_h = m;
      values.cooling_m = h;
    }));
    const hml = violations.filter((violation) => violation.ruleId === 'rule_hml');
    expect(hml).toHaveLength(7);
  });

  it('catches a row shift that breaks growth along the size axis', () => {
    const violations = run(rows((index, values) => {
      if (index === 3) values.cooling_h = 2000;
    }));
    expect(violations.map((violation) => violation.ruleId)).toContain('rule_grows_with_size');
  });

  it('compares against a constant converted to the standard unit (500 W)', () => {
    const violations = run(rows((index, values) => {
      if (index === 0) {
        values.cooling_h = 400;
        values.cooling_m = 300;
        values.cooling_l = 200;
      }
    }));
    expect(violations.map((violation) => violation.ruleId)).toContain('rule_min_power');
  });

  it('does not judge missing values', () => {
    const violations = run(rows((index, values) => {
      delete values.cooling_m;
    }));
    expect(violations).toEqual([]);
  });
});
