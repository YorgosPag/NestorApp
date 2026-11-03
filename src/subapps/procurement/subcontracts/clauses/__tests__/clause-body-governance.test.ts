/**
 * @jest-environment node
 *
 * ADR-928 Φ1 — σώμα ↔ παράμετροι, αποτυπώματα, διακυβέρνηση, μερίδια. (`node`: το sha256 είναι Web Crypto, που το
 * jsdom δεν έχει — όπως το `lib/hash/__tests__/sha256.test.ts`.)
 */

import { BP_PER_WHOLE } from '@/lib/pricing/discount-rule';
import { clauseContentHash, clauseSourceHash } from '../clause-content-hash';
import {
  carriedTranslations,
  refuseApproval,
  refuseReviewMark,
  refuseTranslationApproval,
  refuseWithdrawal,
} from '../clause-governance';
import { validateClauseContent, validateClauseIdentity, validateClauseTranslation } from '../validate-clause-version';
import { validateShares } from '../../shares/validate-shares';
import type { ClauseBody, ClauseTranslation } from '../../types/clause';
import { paymentInstrument, retentionBody, retentionRate } from './clause-fixtures';

const codes = (issues: readonly { code: string }[]) => issues.map((issue) => issue.code);

describe('σώμα ↔ παράμετροι — καμία ορφανή προς καμία κατεύθυνση', () => {
  it('έγκυρο', () => expect(validateClauseContent(retentionBody, [retentionRate])).toEqual([]));

  it('αναφορά σε παράμετρο που δεν ορίζεται', () => {
    expect(codes(validateClauseContent(retentionBody, []))).toEqual(['paramReferenceUnknown']);
  });

  it('ορισμένη παράμετρος που δεν τυπώνεται πουθενά', () => {
    expect(codes(validateClauseContent(retentionBody, [retentionRate, paymentInstrument]))).toEqual(['parameterUnreferenced']);
  });

  it('κενή επικεφαλίδα · κενό σώμα · κενή λίστα · κενό τμήμα κειμένου', () => {
    const empty: ClauseBody = { heading: ' ', blocks: [] };
    expect(codes(validateClauseContent(empty, []))).toEqual(['headingRequired', 'bodyEmpty']);
    const hollow: ClauseBody = { heading: 'Α', blocks: [{ kind: 'list', ordered: true, items: [] }, { kind: 'paragraph', inlines: [{ kind: 'text', text: '' }] }] };
    expect(codes(validateClauseContent(hollow, []))).toEqual(['blockEmpty', 'inlineTextEmpty']);
  });

  it('ταυτότητα: κλειδί με τελείες, ελληνικός τίτλος', () => {
    expect(validateClauseIdentity('tax.withholding_technical_works', { el: 'Παρακράτηση' })).toEqual([]);
    expect(codes(validateClauseIdentity('Tax Withholding', { en: 'Withholding' }))).toEqual(['clauseKeyInvalid', 'clauseTitleRequired']);
  });

  it('μετάφραση: ίδιο σύνολο παραμέτρων, όχι «μετάφραση» στα ελληνικά', () => {
    const en: ClauseBody = { heading: 'Retention', blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Retained: ' }, { kind: 'param', key: 'rate' }] }] };
    expect(validateClauseTranslation('en', retentionBody, en)).toEqual([]);
    const forgetful: ClauseBody = { heading: 'Retention', blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Retained.' }] }] };
    expect(codes(validateClauseTranslation('en', retentionBody, forgetful))).toEqual(['translationParamsMismatch']);
    expect(codes(validateClauseTranslation('el', retentionBody, en))).toEqual(['translationLanguageInvalid']);
  });
});

describe('αποτυπώματα — canonical JSON + sha256', () => {
  it('σταθερό, ανεξάρτητο από τη σειρά των κλειδιών, 64 hex', async () => {
    const reordered = { ...retentionRate, tolerance: retentionRate.tolerance, preferred: retentionRate.preferred, key: retentionRate.key };
    const [a, b] = await Promise.all([clauseContentHash(retentionBody, [retentionRate]), clauseContentHash(retentionBody, [reordered])]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('αλλάζει με το σώμα · το sourceHash αγνοεί τις παραμέτρους', async () => {
    const edited: ClauseBody = { ...retentionBody, heading: 'Εγγυοδοσία' };
    expect(await clauseContentHash(edited, [retentionRate])).not.toBe(await clauseContentHash(retentionBody, [retentionRate]));
    expect(await clauseSourceHash(retentionBody)).not.toBe(await clauseContentHash(retentionBody, [retentionRate]));
  });
});

describe('διακυβέρνηση — διάκριση καθηκόντων', () => {
  const proposed = { state: 'proposed' as const, proposedBy: 'u-eng', professionalReview: 'needs_professional_review' as const, sourceHash: 'h1' };

  it('ο προτείνων δεν εγκρίνει τη δική του πρόταση· άλλος ναι', () => {
    expect(refuseApproval(proposed, 'u-eng')).toBe('selfApproval');
    expect(refuseApproval(proposed, 'u-admin')).toBeNull();
    expect(refuseApproval({ ...proposed, state: 'approved' }, 'u-admin')).toBe('invalidTransition');
  });

  it('απόσυρση μόνο από τον προτείνοντα', () => {
    expect(refuseWithdrawal(proposed, 'u-eng')).toBeNull();
    expect(refuseWithdrawal(proposed, 'u-admin')).toBe('notProposer');
  });

  it('επαγγελματικός έλεγχος μόνο σε απόφαση, μία φορά', () => {
    expect(refuseReviewMark(proposed)).toBe('invalidTransition');
    expect(refuseReviewMark({ ...proposed, state: 'approved' })).toBeNull();
    expect(refuseReviewMark({ ...proposed, state: 'approved', professionalReview: 'reviewed' })).toBe('invalidTransition');
  });

  it('μετάφραση: μπαγιάτικη ⇒ άρνηση · ίδιος άνθρωπος ⇒ άρνηση', () => {
    const draft = { status: 'draft' as const, sourceHash: 'h1', proposedBy: 'u-translator' };
    expect(refuseTranslationApproval(proposed, draft, 'u-admin')).toBeNull();
    expect(refuseTranslationApproval(proposed, { ...draft, sourceHash: 'h0' }, 'u-admin')).toBe('translationStale');
    expect(refuseTranslationApproval(proposed, draft, 'u-translator')).toBe('selfApproval');
  });

  it('αλλαγή ελληνικού ⇒ η εγκεκριμένη μετάφραση της νέας έκδοσης υποβιβάζεται σε πρόχειρο', () => {
    const approved: ClauseTranslation = {
      body: retentionBody, status: 'approved', origin: 'human', sourceHash: 'h1', proposedBy: 'u-t', approvedBy: 'u-a', approvedAt: '2026-11-03T10:00:00.000Z',
    };
    expect(carriedTranslations({ en: approved }, 'h1').en.status).toBe('approved');
    expect(carriedTranslations({ en: approved }, 'h2').en).toMatchObject({ status: 'draft', approvedBy: null, sourceHash: 'h1' });
  });
});

describe('validateShares — ακριβώς 10.000', () => {
  const check = (shares: number[]) => codes(validateShares(shares, 's', { allowEmpty: false }));
  it('επιχρίσματα 2008: 10/20/45/25', () => expect(check([1000, 2000, 4500, 2500])).toEqual([]));
  it('99,99% δεν είναι 100%', () => expect(check([5000, 4999])).toEqual(['sharesNotWhole']));
  it('μηδενικό ή κλασματικό μερίδιο', () => expect(check([BP_PER_WHOLE, 0])).toEqual(['shareInvalid']));
  it('κενή λίστα όταν δεν επιτρέπεται', () => expect(check([])).toEqual(['sharesEmpty']));
  it('διπλή ταυτότητα', () => {
    const issues = validateShares([5000, 5000], 's', { allowEmpty: false, identityOf: () => 'employer' });
    expect(codes(issues)).toEqual(['shareKeyDuplicate']);
  });
});
