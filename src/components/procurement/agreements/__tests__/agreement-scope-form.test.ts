/**
 * Φόρμα εμβέλειας ↔ πεδία εγγράφου (ADR-923 §5.11 «3γ», Βήμα 2): δύο διαστάσεις, όχι τρία πεδία.
 * Η κενή λίστα ΜΕΣΑ στην ένωση ειδών είναι «δεν περιορίζει» (`null`), ποτέ «τίποτα» (`[]`).
 */

import {
  EMPTY_SCOPE_FORM,
  scopeFieldsFromForm,
  scopeFormFromAgreement,
  scopeFormIssues,
} from '../agreement-scope-form';

describe('scopeFieldsFromForm', () => {
  it('«Όλα» και στις δύο διαστάσεις ⇒ τρία null', () => {
    expect(scopeFieldsFromForm(EMPTY_SCOPE_FORM)).toEqual({
      applicableMaterialIds: null,
      applicableAtoeCategoryCodes: null,
      applicableProjectIds: null,
    });
  });

  it('επιλεγμένα μόνο υλικά ⇒ οι κατηγορίες μένουν null (ΟΧΙ [])', () => {
    const fields = scopeFieldsFromForm({ ...EMPTY_SCOPE_FORM, itemsMode: 'selected', materialIds: ['m_1'] });
    expect(fields.applicableMaterialIds).toEqual(['m_1']);
    expect(fields.applicableAtoeCategoryCodes).toBeNull();
  });

  it('«Όλα τα είδη» αγνοεί ό,τι είχε επιλεγεί πριν την εναλλαγή', () => {
    const fields = scopeFieldsFromForm({ ...EMPTY_SCOPE_FORM, materialIds: ['m_1'], categoryCodes: ['OIK-9'] });
    expect(fields.applicableMaterialIds).toBeNull();
    expect(fields.applicableAtoeCategoryCodes).toBeNull();
  });

  it('επιλεγμένα έργα ⇒ λίστα', () => {
    expect(scopeFieldsFromForm({ ...EMPTY_SCOPE_FORM, projectsMode: 'selected', projectIds: ['p_1'] }).applicableProjectIds).toEqual(['p_1']);
  });
});

describe('scopeFormFromAgreement ⇄ scopeFieldsFromForm', () => {
  it.each([
    [{ applicableMaterialIds: null, applicableAtoeCategoryCodes: null, applicableProjectIds: null }],
    [{ applicableMaterialIds: ['m_1'], applicableAtoeCategoryCodes: null, applicableProjectIds: ['p_1'] }],
    [{ applicableMaterialIds: null, applicableAtoeCategoryCodes: ['OIK-9'], applicableProjectIds: null }],
    [{ applicableMaterialIds: ['m_1'], applicableAtoeCategoryCodes: ['OIK-9'], applicableProjectIds: ['p_1', 'p_2'] }],
  ])('στρογγυλή διαδρομή %j', (fields) => {
    expect(scopeFieldsFromForm(scopeFormFromAgreement(fields))).toEqual(fields);
  });
});

describe('scopeFormIssues', () => {
  it('«Επιλεγμένα» χωρίς τίποτα ⇒ πρόβλημα στη διάσταση που αφορά', () => {
    expect(scopeFormIssues({ ...EMPTY_SCOPE_FORM, itemsMode: 'selected' })).toEqual({ itemsEmpty: true, projectsEmpty: false });
    expect(scopeFormIssues({ ...EMPTY_SCOPE_FORM, projectsMode: 'selected' })).toEqual({ itemsEmpty: false, projectsEmpty: true });
  });

  it('μία κατηγορία αρκεί για τα είδη', () => {
    expect(scopeFormIssues({ ...EMPTY_SCOPE_FORM, itemsMode: 'selected', categoryCodes: ['OIK-2'] }).itemsEmpty).toBe(false);
  });
});
