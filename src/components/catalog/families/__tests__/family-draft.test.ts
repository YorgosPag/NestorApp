import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';
import { issueCountByTab, nextLocalId, tabOfIssue, validateFamilyDraft, withoutFamilyAttribute } from '../family-draft';

const validate = (draft: typeof MFP_FAMILY) => validateFamilyDraft(draft, MFP_ATTRIBUTE_MAP, PLATFORM_MEASUREMENT_REGISTRY);

describe('family-draft — το πρόχειρο της οικογένειας', () => {
  it('το Fan coil (MFP) είναι έγκυρο όπως είναι — ο ίδιος επικυρωτής με τον γραφέα', () => {
    expect(validate(MFP_FAMILY)).toEqual([]);
  });

  it('αφαίρεση του άξονα: φεύγει και από επίπεδα, γραμμές πίνακα και κανόνες — καμία ορφανή αναφορά', () => {
    const without = withoutFamilyAttribute(MFP_FAMILY, 'size');
    expect(without.attributes.some((binding) => binding.attributeId === 'size')).toBe(false);
    expect(without.tableSpec?.rows.some((row) => row.kind === 'axis')).toBe(false);
    expect(without.consistencyRules.some((rule) => rule.kind === 'monotonicAlongAxis')).toBe(false);
    // Ό,τι μένει είναι μόνο η συνέπεια της απόφασης (επίπεδο χωρίς άξονα) — όχι αναφορές-φαντάσματα.
    expect(validate(without).map((issue) => issue.code)).toEqual(['axesCount']);
  });

  it('αφαίρεση της ιδιότητας-ονόματος: το όνομα αδειάζει, δεν δείχνει σε κάτι που λείπει', () => {
    const without = withoutFamilyAttribute(MFP_FAMILY, 'model_code');
    expect(without.labelAttributeId).toBeNull();
    expect(validate(without)).toEqual([]);
  });

  it('τοπικά αναγνωριστικά: επόμενο μετά το μέγιστο, χωρίς ρολόι', () => {
    expect(nextLocalId('rule', ['rule_1', 'rule_7', 'other_9'])).toBe('rule_8');
    expect(nextLocalId('row', [])).toBe('row_1');
  });

  it('κάθε εύρημα πάει στην καρτέλα του', () => {
    expect(tabOfIssue({ code: 'axesCount', path: 'variantSchemes[0].levels[0].axisAttributeIds' })).toBe('variants');
    expect(tabOfIssue({ code: 'labelRequired', path: 'labels' })).toBe('general');
    expect(issueCountByTab([{ code: 'tooMany', path: 'consistencyRules' }]).rules).toBe(1);
  });
});
