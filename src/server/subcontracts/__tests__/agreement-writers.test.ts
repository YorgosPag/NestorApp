/**
 * @jest-environment node
 *
 * ADR-928 Φ2 — γραφείς του συμφωνητικού πάνω στο επαληθευμένο ψεύτικο Firestore: μέρη από τις πηγές, αριθμός στην ίδια
 * συναλλαγή, αποκλίσεις με διάκριση καθηκόντων, πάγωμα αναθεώρησης, Τρόπος Β, αναθέσεις, CAS, ιστορικό.
 * (`node`: τα αποτυπώματα είναι Web Crypto.)
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { AuthContext } from '@/lib/auth';
import type { CompanyProfile } from '@/subapps/accounting/types/company';
import { paymentInstrument, retentionBody } from '@/subapps/procurement/subcontracts/clauses/__tests__/clause-fixtures';
import { boundRetention, sampleDraftInput } from '@/subapps/procurement/subcontracts/agreements/__tests__/agreement-fixtures';
import { agreementSnapshotHash } from '@/subapps/procurement/subcontracts/agreements/agreement-snapshot';
import type { SubcontractAgreement, SubcontractAgreementRevision } from '@/subapps/procurement/subcontracts/types/agreement';

const fake = new FakeFirestore();
const audited: { entityType: string; entityId: string }[] = [];
let profile: Partial<CompanyProfile> | null = null;

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({
  recordTrackedEntityWrite: async (entry: { entityType: string; entityId: string }) => void audited.push(entry),
}));
jest.mock('@/subapps/accounting/services/repository/accounting-repo-company-setup', () => ({ getCompanySetup: async () => profile }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { createSubcontractClause, proposeSubcontractClauseVersion } from '../clause-library-writer.server';
import { approveSubcontractClauseVersion } from '../clause-governance-writer.server';
import { addSubcontractAgreementAssignment, createSubcontractAgreement, updateSubcontractAgreementDraft } from '../agreement-writer.server';
import { transitionSubcontractAgreement } from '../agreement-lifecycle-writer.server';
import { decideSubcontractAgreementDeviation } from '../agreement-deviation-writer.server';
import { SubcontractWriteError } from '../subcontract-write-error';
/* eslint-enable import/first */

const actor = (uid: string, companyId = 'comp-aries'): AuthContext => ({
  uid, email: `${uid}@aries.gr`, companyId, globalRole: 'company_admin', mfaEnrolled: false, isAuthenticated: true,
});
const ENGINEER = actor('u-engineer');
const ADMIN = actor('u-admin');

async function rejectionOf(promise: Promise<unknown>): Promise<SubcontractWriteError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SubcontractWriteError) return error;
    throw error;
  }
  throw new Error('expected a SubcontractWriteError');
}
const codesOf = (error: SubcontractWriteError) => error.issues.map((issue) => issue.code);

const instrumentBody = { heading: 'Μέσο πληρωμής', blocks: [{ kind: 'paragraph' as const, inlines: [{ kind: 'text' as const, text: 'Πληρωμή με ' }, { kind: 'param' as const, key: 'instrument' }] }] };

/** Δύο εγκεκριμένες ρήτρες: κράτηση (δεμένη στους όρους) και μέσο πληρωμής (τιμή της ρήτρας). */
async function approvedLibrary(): Promise<void> {
  for (const draft of [
    { clauseKey: 'retention.performance', title: { el: 'Κράτηση' }, body: retentionBody, parameters: [boundRetention] },
    { clauseKey: 'payment.instruments', title: { el: 'Μέσο πληρωμής' }, body: instrumentBody, parameters: [paymentInstrument] },
  ]) {
    const clause = await createSubcontractClause(ENGINEER, { draft, proposalReason: null });
    await approveSubcontractClauseVersion(ADMIN, { clauseId: clause.id, version: 1, expectedRevision: 1 }, { effectiveFrom: null, reason: null });
  }
}

const draft = sampleDraftInput;

const chequeClauses = (reason: string) => draft().clauses.map((clause) => clause.clauseKey !== 'payment.instruments' ? clause : {
  ...clause, parameterValues: { instrument: { kind: 'enum' as const, value: 'cheque' } }, deviationReasons: { instrument: reason },
});

const agreementOf = (id: string) => fake.getData('subcontract_agreements', id) as unknown as SubcontractAgreement;
const revisionsOf = (id: string) => Object.values(fake.getAllDocs(`subcontract_agreements/${id}/subcontract_agreement_revisions`)) as unknown as SubcontractAgreementRevision[];
const transition = (who: AuthContext, agreement: SubcontractAgreement, name: Parameters<typeof transitionSubcontractAgreement>[2]) =>
  transitionSubcontractAgreement(who, agreement.id, name, { expectedRevision: agreement.revision, mobilizedOn: null });

beforeEach(async () => {
  fake.reset();
  audited.length = 0;
  profile = { businessName: 'Άρης Κατασκευαστική ΑΕ', vatNumber: '099999999', taxOffice: 'ΦΑΕ Αθηνών', address: 'Σόλωνος 1', city: 'Αθήνα', postalCode: '10671', phone: '2100000000', email: 'info@aries.gr', profession: 'Κατασκευές' };
  fake.seed('projects', 'proj_1', { companyId: 'comp-aries', name: 'Οικοδομή Κηφισιάς', address: 'Λεβίδου 12, Κηφισιά', licenseNumber: '123/2026', buildingBlock: 'Ο.Τ. 45' });
  fake.seed('projects', 'proj_2', { companyId: 'comp-aries', name: 'Οικοδομή Μαρουσιού', address: 'Κηφισίας 100' });
  fake.seed('projects', 'proj_rival', { companyId: 'comp-rival', name: 'Ξένο', address: '—' });
  fake.seed('buildings', 'bld_1', { companyId: 'comp-aries', projectId: 'proj_1' });
  fake.seed('buildings', 'bld_other', { companyId: 'comp-aries', projectId: 'proj_2' });
  fake.seed('contacts', 'ct_sub', { companyId: 'comp-aries', type: 'individual', firstName: 'Νίκος', lastName: 'Σοβατζής', fatherName: 'Γεώργιος' });
  await approvedLibrary();
});

describe('δημιουργία', () => {
  it('μέρη από τις πηγές, αριθμός από τον μετρητή, έργα παράγωγα — και ίχνος', async () => {
    const first = await createSubcontractAgreement(ENGINEER, draft());
    expect(first).toMatchObject({ role: 'offer', status: 'draft', revision: 1, projectIds: ['proj_1'], issuedRevision: null });
    expect(first.documentNumber).toMatch(/^ΠΡΟΣ-\d{4}-001$/);
    expect(first.parties.issuer.name).toBe('Άρης Κατασκευαστική ΑΕ');
    expect(first.parties.subcontractor).toMatchObject({ name: 'Νίκος Σοβατζής', fatherName: 'Γεώργιος', contactId: 'ct_sub' });
    expect(first.scope).toMatchObject({ kind: 'single_project', project: { name: 'Οικοδομή Κηφισιάς', licenseNumber: '123/2026', buildingIds: ['bld_1'] } });
    expect((await createSubcontractAgreement(ENGINEER, draft())).documentNumber).toMatch(/-002$/);
    expect(audited.filter((entry) => entry.entityType === 'subcontract_agreement')).toHaveLength(2);
  });

  it('κλειστή αποτυχία με ΟΛΑ τα ευρήματα: ξένο έργο, ξένο κτίριο, άγνωστη επαφή, χωρίς προφίλ φορέα', async () => {
    profile = null;
    const error = await rejectionOf(createSubcontractAgreement(ENGINEER, draft({ subcontractorContactId: 'ct_ghost', scope: { kind: 'single_project', projectId: 'proj_rival', buildingIds: [] } })));
    expect(codesOf(error).sort()).toEqual(['contactUnknown', 'issuerProfileMissing', 'projectUnknown']);
    profile = { businessName: 'x' };
    const building = await rejectionOf(createSubcontractAgreement(ENGINEER, draft({ scope: { kind: 'single_project', projectId: 'proj_1', buildingIds: ['bld_other'] } })));
    expect(codesOf(building)).toEqual(['buildingNotInProject']);
  });
});

describe('απόκλιση → έγκριση από ΑΛΛΟΝ → έκδοση', () => {
  it('εκκρεμής απόκλιση μπλοκάρει· ο αιτών δεν εγκρίνει· η έκδοση παγώνει αναθεώρηση με σταθερό αποτύπωμα', async () => {
    const created = await createSubcontractAgreement(ENGINEER, draft({ clauses: chequeClauses('Επιταγή 4 μηνών') }));
    expect((await rejectionOf(transition(ADMIN, created, 'issue'))).kind).toBe('deviationsPending');
    const decision = { expectedRevision: created.revision, clauseKey: 'payment.instruments', parameterKey: 'instrument', reason: null };
    expect((await rejectionOf(decideSubcontractAgreementDeviation(ENGINEER, created.id, { ...decision, decision: 'approved' }))).kind).toBe('selfApproval');
    const approved = await decideSubcontractAgreementDeviation(ADMIN, created.id, { ...decision, decision: 'approved' });
    const issued = await transition(ENGINEER, approved, 'issue');
    expect(issued.agreement).toMatchObject({ status: 'issued', issuedRevision: 1 });
    const [revision] = revisionsOf(created.id);
    expect(revision).toMatchObject({ revisionNumber: 1, pdfFileId: null, sealed: false, issuedBy: ENGINEER.uid });
    expect(revision.contentHash).toBe(await agreementSnapshotHash(revision.snapshot));
    expect(revision.snapshot.frozenClauses.map((clause) => [clause.clauseKey, clause.values])).toEqual([
      ['retention.performance', { rate: { kind: 'percent', value: 500 } }],
      ['payment.instruments', { instrument: { kind: 'enum', value: 'cheque' } }],
    ]);
    expect(audited.map((entry) => entry.entityType)).toContain('subcontract_agreement_revision');
  });

  it('μετά την έκδοση: κανένα πρόχειρο, καμία απόφαση· παλιό CAS ⇒ 409', async () => {
    const created = await createSubcontractAgreement(ENGINEER, draft());
    const { agreement } = await transition(ENGINEER, created, 'issue');
    expect((await rejectionOf(updateSubcontractAgreementDraft(ENGINEER, created.id, agreement.revision, draft()))).kind).toBe('invalidTransition');
    expect((await rejectionOf(transition(ENGINEER, created, 'accept'))).kind).toBe('revisionMismatch');
  });

  it('η βιβλιοθήκη προχώρησε μετά το πρόχειρο ⇒ το issue αρνείται (clauseVersionOutdated)', async () => {
    const created = await createSubcontractAgreement(ENGINEER, draft());
    const clauseId = created.clauses[1].clauseId;
    await proposeSubcontractClauseVersion(ENGINEER, clauseId, { expectedRevision: 2, body: { ...instrumentBody, heading: 'Μέσα πληρωμής' }, parameters: [paymentInstrument], proposalReason: null });
    await approveSubcontractClauseVersion(ADMIN, { clauseId, version: 2, expectedRevision: 1 }, { effectiveFrom: null, reason: null });
    expect(codesOf(await rejectionOf(transition(ENGINEER, created, 'issue')))).toEqual(['clauseVersionOutdated']);
  });
});

describe('κύκλος ζωής', () => {
  it('Τρόπος Β: η αποδοχή γεννά συμφωνητικό με δικό του αριθμό· η προσφορά δεν εγκαθίσταται', async () => {
    const offer = await createSubcontractAgreement(ENGINEER, draft({ documentMode: 'offer_then_agreement' }));
    const issued = await transition(ENGINEER, offer, 'issue');
    const accepted = await transition(ENGINEER, issued.agreement, 'accept');
    expect(accepted.spawnedAgreement).toMatchObject({ role: 'agreement', status: 'draft', sourceOfferId: offer.id, revision: 1 });
    expect(accepted.spawnedAgreement?.documentNumber).toMatch(/^ΣΥΜ-\d{4}-001$/);
    expect(agreementOf(offer.id)).toMatchObject({ status: 'accepted', agreementId: accepted.spawnedAgreement?.id });
    expect((await rejectionOf(transition(ENGINEER, accepted.agreement, 'mobilize'))).kind).toBe('mobilizeOnOffer');
  });

  it('Τρόπος Α: mobilize γράφει την ημέρα εγκατάστασης', async () => {
    const offer = await createSubcontractAgreement(ENGINEER, draft());
    const issued = await transition(ENGINEER, offer, 'issue');
    const accepted = await transition(ENGINEER, issued.agreement, 'accept');
    const mobilized = await transitionSubcontractAgreement(ENGINEER, offer.id, 'mobilize', { expectedRevision: accepted.agreement.revision, mobilizedOn: '2026-11-10' });
    expect(mobilized.agreement).toMatchObject({ status: 'in_execution', mobilizedOn: '2026-11-10' });
  });

  it('πολλά έργα: η ανάθεση προσθέτει έργο χωρίς νέο έγγραφο', async () => {
    const offer = await createSubcontractAgreement(ENGINEER, draft({ scope: { kind: 'multi_project' } }));
    expect(offer.projectIds).toEqual([]);
    const accepted = await transition(ENGINEER, (await transition(ENGINEER, offer, 'issue')).agreement, 'accept');
    const assigned = await addSubcontractAgreementAssignment(ENGINEER, offer.id, {
      expectedRevision: accepted.agreement.revision, projectId: 'proj_2', buildingIds: [], startDate: '2026-12-01', durationDays: 30, note: null,
    });
    expect(assigned.projectIds).toEqual(['proj_2']);
    expect(assigned.scope).toMatchObject({ kind: 'multi_project', assignments: [{ project: { name: 'Οικοδομή Μαρουσιού' }, assignedBy: ENGINEER.uid }] });
  });

  it('ξένος χώρος ≡ ανύπαρκτο', async () => {
    const created = await createSubcontractAgreement(ENGINEER, draft());
    expect((await rejectionOf(transition(actor('u-rival', 'comp-rival'), created, 'issue'))).kind).toBe('notFound');
  });
});
