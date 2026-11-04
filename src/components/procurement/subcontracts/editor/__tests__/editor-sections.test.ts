import { validateAgreementDraft } from '@/subapps/procurement/subcontracts/agreements/agreement-draft';
import { draftInputOf } from '@/subapps/procurement/subcontracts/agreements/agreement-draft-input';
import { sampleAgreement } from '@/subapps/procurement/subcontracts/agreements/__tests__/agreement-fixtures';
import { issueCountsBySection, sectionOfPath } from '../editor-sections';

describe('editor-sections — κάθε εύρημα σε ΜΙΑ ενότητα (ADR-928 Φ3γ-2)', () => {
  it.each([
    ['title', 'identity'],
    ['validUntil', 'identity'],
    ['subcontractorContactId', 'parties'],
    ['scope.projectId', 'parties'],
    ['projectOwners.contactIds.0', 'parties'],
    ['lines.3.unitPrice', 'lines'],
    ['terms.vat.rate', 'terms'],
    ['terms.paymentPlan', 'plan'],
    ['terms.paymentPlan.settlement.regular', 'plan'],
    ['terms.paymentPlanX', 'terms'],
    ['clauses.0.parameterValues.rate', 'clauses'],
  ])('%s → %s', (path, section) => {
    expect(sectionOfPath(path)).toBe(section);
  });

  it('τα πραγματικά ευρήματα του κριτή μετριούνται όλα, κανένα δεν χάνεται', () => {
    const saved = draftInputOf(sampleAgreement());
    const broken = {
      ...saved,
      title: { el: '' },
      subcontractorContactId: '',
      lines: [{ ...saved.lines[0], unitPrice: -1 }],
      terms: { ...saved.terms, cashLimitPerPayment: -1, paymentPlan: { ...saved.terms.paymentPlan, settlement: { regular: [], final: null } } },
    };
    const issues = validateAgreementDraft(broken, '2026-11-03');
    const counts = issueCountsBySection(issues);
    expect(counts).toMatchObject({ identity: 1, parties: 1, lines: 1, terms: 1, plan: 1 });
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(issues.length);
  });
});
