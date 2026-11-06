import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';
import {
  emptyVariantScheme,
  isPristineScheme,
  issueCountByTab,
  nextLocalId,
  shownFamilyIssues,
  tabOfIssue,
  validateFamilyDraft,
  withoutFamilyAttribute,
} from '../family-draft';

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

  describe('ανέγγιχτο σχήμα παραλλαγών (ADR-923 §23.2 K1) — ημιτελές, όχι λάθος', () => {
    const withNewScheme = { ...MFP_FAMILY, variantSchemes: [...MFP_FAMILY.variantSchemes, emptyVariantScheme()] };
    const fresh = `variantSchemes[${MFP_FAMILY.variantSchemes.length}]`;

    it('ο επικυρωτής το βρίσκει ημιτελές· η προβολή το αναβάλλει ολόκληρο', () => {
      const all = validate(withNewScheme);
      expect(all.some((issue) => issue.path.startsWith(fresh))).toBe(true);
      expect(shownFamilyIssues(withNewScheme, all)).toEqual([]);
    });

    it('με το πρώτο άγγιγμα (ετικέτα) τα ευρήματά του φαίνονται', () => {
      const touched = { ...withNewScheme, variantSchemes: withNewScheme.variantSchemes.map((scheme, index) =>
        index === MFP_FAMILY.variantSchemes.length ? { ...scheme, labels: { el: 'Μέγεθος' } } : scheme) };
      const shown = shownFamilyIssues(touched, validate(touched));
      expect(shown.length).toBeGreaterThan(0);
      expect(shown.every((issue) => issue.path.startsWith(fresh))).toBe(true);
    });

    it('δεν κρύβει ευρήματα άλλων σχημάτων ούτε γειτονικού δείκτη (`[1]` ≠ `[10]`)', () => {
      const issues = [{ code: 'invalidCode' as const, path: 'variantSchemes[10].code' }, { code: 'tooMany' as const, path: 'variantSchemes' }];
      const draft = { ...MFP_FAMILY, variantSchemes: [...MFP_FAMILY.variantSchemes.slice(0, 1), emptyVariantScheme()] };
      expect(shownFamilyIssues(draft, issues)).toEqual(issues);
    });

    it('ανέγγιχτο = ακριβώς το πρότυπο: κάθε αλλαγή το κάνει αγγιγμένο', () => {
      expect(isPristineScheme(emptyVariantScheme())).toBe(true);
      expect(isPristineScheme({ ...emptyVariantScheme(), code: 'size' })).toBe(false);
      expect(isPristineScheme({ ...emptyVariantScheme(), levels: [...emptyVariantScheme().levels, { axisAttributeIds: [], attributeIds: [] }] })).toBe(false);
      expect(isPristineScheme({ ...emptyVariantScheme(), levels: [{ axisAttributeIds: ['size'], attributeIds: [] }] })).toBe(false);
    });
  });
});
