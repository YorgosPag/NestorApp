/**
 * @jest-environment node
 *
 * ADR-928 Φ1 — γραφείς της βιβλιοθήκης ρητρών πάνω στο επαληθευμένο ψεύτικο Firestore: δημιουργία, πρόταση, έγκριση με
 * διάκριση καθηκόντων, μία ανοιχτή πρόταση, CAS, μεταφράσεις, πρότυπα απέναντι στη βιβλιοθήκη, ιδεμποτική σπορά.
 * (`node`: τα αποτυπώματα είναι Web Crypto.)
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { AuthContext } from '@/lib/auth';
import { DEFAULT_CLAUSE_LIBRARY } from '@/config/subcontracts/default-clause-library';
import { DEFAULT_TRADE_TEMPLATES } from '@/config/subcontracts/default-trade-templates';
import { retentionBody, retentionRate } from '@/subapps/procurement/subcontracts/clauses/__tests__/clause-fixtures';
import type { SubcontractClause, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';

const fake = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: async () => undefined }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { createSubcontractClause, proposeSubcontractClauseVersion } from '../clause-library-writer.server';
import {
  approveSubcontractClauseVersion,
  markSubcontractClauseVersionReviewed,
  withdrawSubcontractClauseVersion,
} from '../clause-governance-writer.server';
import { approveSubcontractClauseTranslation, proposeSubcontractClauseTranslation } from '../clause-translation-writer.server';
import { seedDefaultSubcontractLibrary } from '../default-library-seed.server';
import { createSubcontractTradeTemplate } from '../trade-template-writer.server';
import { SubcontractWriteError } from '../subcontract-write-error';
/* eslint-enable import/first */

const actor = (uid: string, companyId = 'comp-aries'): AuthContext => ({
  uid, email: `${uid}@aries.gr`, companyId, globalRole: 'company_admin', mfaEnrolled: false, isAuthenticated: true,
});
const ENGINEER = actor('u-engineer');
const ADMIN = actor('u-admin');
const RIVAL = actor('u-rival', 'comp-rival');

async function rejectionOf(promise: Promise<unknown>): Promise<SubcontractWriteError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SubcontractWriteError) return error;
    throw error;
  }
  throw new Error('expected a SubcontractWriteError');
}

const versionsOf = (clauseId: string) =>
  Object.values(fake.getAllDocs(`subcontract_clauses/${clauseId}/subcontract_clause_versions`)) as unknown as SubcontractClauseVersion[];
const clauseOf = (clauseId: string) => fake.getData('subcontract_clauses', clauseId) as unknown as SubcontractClause;

const draft = { clauseKey: 'retention.performance', title: { el: 'Κράτηση' }, body: retentionBody, parameters: [retentionRate] };
const create = (who = ENGINEER) => createSubcontractClause(who, { draft, proposalReason: 'Από το συμφωνητικό του 2008' });
const target = (clauseId: string, version: number, expectedRevision: number) => ({ clauseId, version, expectedRevision });

beforeEach(() => fake.reset());

describe('πρόταση → έγκριση', () => {
  it('η ρήτρα γεννιέται με την έκδοση 1 ως ΠΡΟΤΑΣΗ — χωρίς έκδοση σε ισχύ', async () => {
    const clause = await create();
    expect(clause).toMatchObject({ currentVersion: null, latestVersion: 1, openProposal: 1, revision: 1 });
    expect(versionsOf(clause.id)).toEqual([expect.objectContaining({ state: 'proposed', professionalReview: 'needs_professional_review', proposedBy: ENGINEER.uid })]);
    expect(versionsOf(clause.id)[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ο προτείνων ΔΕΝ εγκρίνει τη δική του πρόταση· άλλος ναι, και η ρήτρα δείχνει την έκδοση', async () => {
    const clause = await create();
    expect((await rejectionOf(approveSubcontractClauseVersion(ENGINEER, target(clause.id, 1, 1), { effectiveFrom: null, reason: null }))).kind).toBe('selfApproval');
    const approved = await approveSubcontractClauseVersion(ADMIN, target(clause.id, 1, 1), { effectiveFrom: '2026-11-04', reason: null });
    expect(approved).toMatchObject({ state: 'approved', decidedBy: ADMIN.uid, effectiveFrom: '2026-11-04', revision: 2 });
    expect(clauseOf(clause.id)).toMatchObject({ currentVersion: 1, openProposal: null });
  });

  it('νέα έκδοση: μία ανοιχτή πρόταση, και η έγκρισή της αντικαθιστά την προηγούμενη στην ΙΔΙΑ συναλλαγή', async () => {
    const clause = await create();
    await approveSubcontractClauseVersion(ADMIN, target(clause.id, 1, 1), { effectiveFrom: null, reason: null });
    // ρήτρα: δημιουργία (1) → έγκριση (2) → πρόταση (3)
    const input = { expectedRevision: 2, body: { ...retentionBody, heading: 'Εγγυοδοσία' }, parameters: [retentionRate], proposalReason: null };
    await proposeSubcontractClauseVersion(ENGINEER, clause.id, input);
    expect((await rejectionOf(proposeSubcontractClauseVersion(ENGINEER, clause.id, { ...input, expectedRevision: 3 }))).kind).toBe('proposalPending');
    await approveSubcontractClauseVersion(ADMIN, target(clause.id, 2, 1), { effectiveFrom: null, reason: null });
    const states = versionsOf(clause.id).map((version) => [version.version, version.state, version.supersededBy]);
    expect(states).toEqual(expect.arrayContaining([[1, 'superseded', 2], [2, 'approved', null]]));
    expect(clauseOf(clause.id)).toMatchObject({ currentVersion: 2, latestVersion: 2, openProposal: null });
  });

  it('CAS: παλιά αναθεώρηση ⇒ 409 με την τρέχουσα', async () => {
    const clause = await create();
    const error = await rejectionOf(approveSubcontractClauseVersion(ADMIN, target(clause.id, 1, 7), { effectiveFrom: null, reason: null }));
    expect(error).toMatchObject({ kind: 'revisionMismatch', details: { currentRevision: 1 } });
  });

  it('απόσυρση μόνο από τον προτείνοντα· κλείνει την ανοιχτή πρόταση', async () => {
    const clause = await create();
    expect((await rejectionOf(withdrawSubcontractClauseVersion(ADMIN, target(clause.id, 1, 1), null))).kind).toBe('notProposer');
    await withdrawSubcontractClauseVersion(ENGINEER, target(clause.id, 1, 1), 'λάθος κείμενο');
    expect(clauseOf(clause.id).openProposal).toBeNull();
  });

  it('ξένος χώρος ≡ ανύπαρκτο — ποτέ «απαγορεύεται», που θα φανέρωνε την ύπαρξη', async () => {
    const clause = await create();
    expect((await rejectionOf(approveSubcontractClauseVersion(RIVAL, target(clause.id, 1, 1), { effectiveFrom: null, reason: null }))).kind).toBe('notFound');
  });

  it('διπλό κλειδί στον ίδιο χώρο ⇒ 409· το ίδιο κλειδί σε άλλο χώρο είναι άλλη ρήτρα', async () => {
    await create();
    expect((await rejectionOf(create())).kind).toBe('duplicate');
    await expect(create(RIVAL)).resolves.toMatchObject({ companyId: 'comp-rival' });
  });

  it('επαγγελματικός έλεγχος μόνο μετά την έγκριση', async () => {
    const clause = await create();
    expect((await rejectionOf(markSubcontractClauseVersionReviewed(ADMIN, target(clause.id, 1, 1)))).kind).toBe('invalidTransition');
    await approveSubcontractClauseVersion(ADMIN, target(clause.id, 1, 1), { effectiveFrom: null, reason: null });
    await expect(markSubcontractClauseVersionReviewed(ADMIN, target(clause.id, 1, 2))).resolves.toMatchObject({ professionalReview: 'reviewed', reviewedBy: ADMIN.uid });
  });
});

describe('μεταφράσεις', () => {
  const en = { heading: 'Retention', blocks: [{ kind: 'paragraph' as const, inlines: [{ kind: 'text' as const, text: 'Retained: ' }, { kind: 'param' as const, key: 'rate' }] }] };

  it('πρόχειρο πάνω στο τρέχον ελληνικό · ο μεταφραστής δεν εγκρίνει τον εαυτό του', async () => {
    const clause = await create();
    const drafted = await proposeSubcontractClauseTranslation(ENGINEER, target(clause.id, 1, 1), { language: 'en', body: en, origin: 'human' });
    expect(drafted.translations.en).toMatchObject({ status: 'draft', sourceHash: drafted.sourceHash });
    expect((await rejectionOf(approveSubcontractClauseTranslation(ENGINEER, target(clause.id, 1, 2), 'en'))).kind).toBe('selfApproval');
    const approved = await approveSubcontractClauseTranslation(ADMIN, target(clause.id, 1, 2), 'en');
    expect(approved.translations.en).toMatchObject({ status: 'approved', approvedBy: ADMIN.uid });
  });

  it('μετάφραση που «ξεχνά» παράμετρο ⇒ 422', async () => {
    const clause = await create();
    const forgetful = { heading: 'Retention', blocks: [{ kind: 'paragraph' as const, inlines: [{ kind: 'text' as const, text: 'Retained.' }] }] };
    const error = await rejectionOf(proposeSubcontractClauseTranslation(ENGINEER, target(clause.id, 1, 1), { language: 'en', body: forgetful, origin: 'machine_draft' }));
    expect(error.issues.map((issue) => issue.code)).toEqual(['translationParamsMismatch']);
  });
});

describe('προεπιλεγμένη βιβλιοθήκη και πρότυπα', () => {
  it('σπορά: όλες οι ρήτρες ως προτάσεις του συστήματος, τα πρότυπα εκκρεμή ως τις εγκρίσεις — ιδεμποτική', async () => {
    const first = await seedDefaultSubcontractLibrary(ADMIN);
    expect(first.clausesCreated).toHaveLength(DEFAULT_CLAUSE_LIBRARY.length);
    expect(first.templatesCreated).toEqual([]);
    expect(first.templatesPending.map((pending) => pending.code)).toEqual(DEFAULT_TRADE_TEMPLATES.map((template) => template.code));
    const again = await seedDefaultSubcontractLibrary(ADMIN);
    expect(again.clausesCreated).toEqual([]);
    expect(again.clausesExisting).toHaveLength(DEFAULT_CLAUSE_LIBRARY.length);
  });

  it('μετά τις εγκρίσεις του ανθρώπου, η επόμενη σπορά γράφει τα πρότυπα', async () => {
    await seedDefaultSubcontractLibrary(ADMIN);
    const clauses = fake.all<SubcontractClause>('subcontract_clauses');
    for (const clause of clauses) {
      await approveSubcontractClauseVersion(ADMIN, target(clause.id, 1, 1), { effectiveFrom: null, reason: null });
    }
    const report = await seedDefaultSubcontractLibrary(ADMIN);
    expect(report.templatesCreated).toEqual(DEFAULT_TRADE_TEMPLATES.map((template) => template.code));
    expect(report.templatesPending).toEqual([]);
  });

  it('πρότυπο με ρήτρα χωρίς εγκεκριμένη έκδοση ⇒ 422 από τον γραφέα', async () => {
    await seedDefaultSubcontractLibrary(ADMIN);
    const error = await rejectionOf(createSubcontractTradeTemplate(ADMIN, DEFAULT_TRADE_TEMPLATES[0]));
    expect(error.kind).toBe('invalid');
    expect(new Set(error.issues.map((issue) => issue.code))).toEqual(new Set(['clauseRefNotApproved']));
  });
});
