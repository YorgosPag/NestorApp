/**
 * @jest-environment node
 *
 * ADR-901 Φ4.4 — το transmittal **από άκρη σε άκρη**, πάνω στο fake Firestore: συμμετοχή → ανέβασμα στον ΔΙΚΟ του
 * χώρο → αποστολή → κατάλογος κάθε θεατή → άνοιγμα (επαγγελματίας · οικοδεσπότης) → απόσυρση.
 *
 * Γνήσιοι: γραφέας, κριτής ρόλου × κατάστασης, ακροατήριο, ο ΕΝΑΣ συλλέκτης τεκμηρίων, το άνοιγμα αρχείων.
 * Πλαστά: βάση, υπογραφή συνδέσμου, ίχνος, δέσμευση (έχει δικές της άγκυρες), ειδοποιήσεις.
 * Κάθε `it` ονομάζει τη μετάλλαξη που πρέπει να πιάσει.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { ConveyanceCase } from '@/types/conveyance-case';
import { EntityAuditService } from '@/services/entity-audit.service';
import { getConveyanceCaseView, openConveyanceCase, type ConveyanceActor } from '../conveyance-case.service';
import { endCaseEngagement, listCaseProfessionalSlots, offerCaseEngagement } from '../conveyance-engagement-host.service';
import { getEngagedCaseView, respondToCaseEngagement } from '../conveyance-engagement-access.service';
import { personalWorkspace } from '@/types/workspace-membership';
import { openCaseFile, openHostCaseFile } from '../conveyance-case-file-access.service';
import { issueContribution, reissueContribution, withdrawContribution } from '../conveyance-contribution.service';
import { requestCaseDocuments } from '../conveyance-document-request.service';
import { onBehalfEntryPointId } from '@/config/upload-entry-points/entries-conveyance-case';
import { listCaseEngagements } from '../conveyance-engagement-support';
import { loadConveyanceSubject } from '../conveyance-subject.server';
import { readViewRevision } from '../conveyance-view-signal.server';
import type { CaseViewKey } from '@/lib/conveyance/view-signal-key';

/** ADR-901 §15 (Γ1) — τα γραφεία όπου ΑΝΗΚΕΙ ο αποδεχόμενος· προεπιλογή: κανένα ⇒ προσωρινά ο προσωπικός του χώρος. */
const mockOwnWorkspaces = jest.fn(async (_uid: string, _active: unknown): Promise<unknown> => ({ outcome: 'ok', reachable: [], belonging: [] }));
jest.mock('@/lib/auth/workspace-membership', () => ({
  ...jest.requireActual('@/lib/auth/workspace-membership'),
  listOwnWorkspaces: (uid: string, active: unknown) => mockOwnWorkspaces(uid, active),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
  resolveUserDisplayName: jest.fn(async (_uid: string, fallback: string | null) => fallback),
}));
jest.mock('@/server/engagement-invitations/engagement-invitation-notice', () => ({ notifyEngagementInvitation: jest.fn(async () => 'accepted') }));
process.env.ENGAGEMENT_INVITE_SECRET ??= 'δοκιμαστικό-μυστικό-πρόσκλησης-υπόθεσης';
jest.mock('../conveyance-engagement-notifier', () => ({
  announceEngagementChanged: jest.fn(async () => undefined),
  announceEngagementAnswered: jest.fn(async () => undefined),
}));
const announceDocumentToHost = jest.fn(async (_n: { recipientUid: string }) => true);
const announceDocumentToEngaged = jest.fn(async (_n: { engagement: { uid: string } }) => true);
jest.mock('../conveyance-transmittal-notifier', () => ({
  announceDocumentToHost: (n: { recipientUid: string }) => announceDocumentToHost(n),
  announceDocumentToEngaged: (n: { engagement: { uid: string } }) => announceDocumentToEngaged(n),
}));
type RequestDelivery = 'sent' | 'skipped' | 'failed';
const announceDocumentRequest = jest.fn(async (_n: { requestIds: readonly string[]; recipient: { kind: string; uid?: string; engagement?: { uid: string } } }): Promise<RequestDelivery> => 'sent');
jest.mock('../conveyance-document-request-notifier', () => ({
  announceDocumentRequest: (n: { requestIds: readonly string[]; recipient: { kind: string } }) => announceDocumentRequest(n),
}));
const ensureTransmittalHold = jest.fn(async (_uid: string, _fileId: string, _caseId: string) => 'held');
const releaseTransmittalHold = jest.fn(async (_uid: string, _fileId: string, _pinned: ReadonlySet<string>) => 'released');
jest.mock('../conveyance-transmittal-hold', () => ({
  ensureTransmittalHold: (uid: string, fileId: string, caseId: string) => ensureTransmittalHold(uid, fileId, caseId),
  releaseTransmittalHold: (uid: string, fileId: string, pinned: ReadonlySet<string>) => releaseTransmittalHold(uid, fileId, pinned),
}));
jest.mock('@/lib/workspace/workspace-administrators', () => ({ activeWorkspaceAdministrators: async () => ['u_host'] }));
const signedDownloadUrl = jest.fn(async (_req: { storagePath: string }) => ({ outcome: 'signed', url: 'https://signed.example/x', expiresAt: 1 }));
jest.mock('@/lib/storage/signed-download-url', () => ({ signedDownloadUrl: (req: { storagePath: string }) => signedDownloadUrl(req) }));
jest.mock('@/server/files/file-record-bucket', () => ({ fileRecordBucket: () => ({ name: 'bucket-under-test' }) }));
const ACCOUNTS: Record<string, string> = { 'seller-lawyer@x.gr': 'u_sl', 'buyer-lawyer@x.gr': 'u_bl', 'notary@x.gr': 'u_n' };
jest.mock('@/lib/firebaseAdmin', () => ({
  // Φ4.5 — η στοίβα εκδόσεων διαβάζεται από το Admin SDK· εδώ ΕΙΝΑΙ η ίδια πλαστή βάση.
  getAdminFirestore: () => fake,
  getAdminAuth: () => ({
    getUserByEmail: async (email: string) => {
      const uid = ACCOUNTS[email];
      if (!uid) throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
      return { uid, disabled: false };
    },
  }),
}));

const ACCEPT = { decision: 'accept', credential: { number: '1234', chapter: 'ΔΣΑ' } } as const;
const host: ConveyanceActor = { uid: 'u_host', email: 'host@a.gr', companyId: 'comp_a' };
const NOW = Date.parse('2026-10-03T10:00:00.000Z');
const recordChange = EntityAuditService.recordChange as jest.Mock;
let fake: FakeFirestore;
const db = () => fake as unknown as Firestore;

type Role = 'seller_lawyer' | 'buyer_lawyer' | 'notary';
const UID: Readonly<Record<Role, string>> = { seller_lawyer: 'u_sl', buyer_lawyer: 'u_bl', notary: 'u_n' };
const BASIS: Readonly<Record<Role, 'written_instruction' | 'preliminary_contract' | null>> = {
  seller_lawyer: null, buyer_lawyer: 'preliminary_contract', notary: 'written_instruction',
};
const EMAIL: Readonly<Record<Role, string>> = { seller_lawyer: 'seller-lawyer@x.gr', buyer_lawyer: 'buyer-lawyer@x.gr', notary: 'notary@x.gr' };

function seedWorld(legalPhase = 'preliminary_signed'): void {
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', {
    companyId: 'comp_a', name: 'Δ3', type: 'apartment', buildingId: 'bld_1', projectId: 'proj_1',
    commercial: { owners: [{ contactId: 'cont_b' }], legalPhase },
  });
  fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { companyId: 'comp_a', linkedCompanyId: 'cont_s', landownerContactIds: [] });
  for (const role of Object.keys(UID) as Role[]) {
    fake.seed(COLLECTIONS.CONTACT_LINKS, `cl_${role}`, {
      companyId: 'comp_a', sourceContactId: `cont_${role}`, targetEntityType: 'property', targetEntityId: 'prop_1', role, status: 'active',
    });
    fake.seed(COLLECTIONS.CONTACTS, `cont_${role}`, { companyId: 'comp_a', emails: [{ email: EMAIL[role], isPrimary: true }] });
  }
}

/** Ένα αρχείο στον ΔΙΚΟ του χώρο, για αυτή την υπόθεση — όπως το γράφει το `uploadEntityFile`. */
function seedOwnFile(fileId: string, ownerUid: string, caseId: string, purpose: string): void {
  fake.seed(COLLECTIONS.FILES_PERSONAL, fileId, {
    id: fileId, userId: ownerUid, createdBy: ownerUid, entityType: 'conveyance_case', entityId: caseId, purpose, status: 'ready',
    displayName: `${purpose}.pdf`, ext: 'pdf', contentType: 'application/pdf', storagePath: `people/${ownerUid}/x/${fileId}.pdf`,
    // Φ4.5 — πλήρες FileRecord (η στοίβα εκδόσεων περνά από το `isFileRecord`, όπως κάθε πραγματικό ανέβασμα).
    domain: 'legal', category: 'documents', originalFilename: `${purpose}.pdf`,
    updatedAt: '2026-10-03T09:00:00.000Z',
  });
}

async function openCase(): Promise<ConveyanceCase> {
  const opened = await openConveyanceCase(db(), host, 'prop_1');
  if (!opened.ok) throw new Error(opened.failure.kind);
  return opened.value.view.conveyanceCase;
}

async function engage(record: ConveyanceCase, role: Role): Promise<string> {
  await offerCaseEngagement(db(), host, record, { role, attestedBasis: BASIS[role], nowMs: NOW });
  const slot = (await listCaseProfessionalSlots(db(), record)).find((s) => s.role === role);
  if (!slot?.engagement) throw new Error(`no engagement for ${role}`);
  await respondToCaseEngagement(db(), { uid: UID[role], email: null, active: null }, slot.engagement.engagementId, ACCEPT, NOW);
  return slot.engagement.engagementId;
}

const issue = (role: Role, engagementId: string, checklistItemId: string, entryPointId: string, fileId: string) =>
  issueContribution(db(), { uid: UID[role], engagementId, checklistItemId, entryPointId, fileId, nowMs: NOW });

async function hostRow(itemId: string) {
  const view = await getConveyanceCaseView(db(), host, 'prop_1');
  if (!view.ok || !view.value) throw new Error('no host view');
  return view.value.checklist.rows.find((r) => r.item.id === itemId);
}

async function hostRowFiles(itemId: string): Promise<string[]> {
  return (await hostRow(itemId))?.files.map((f) => f.fileId) ?? [];
}

async function engagedRowFiles(role: Role, engagementId: string, itemId: string): Promise<string[]> {
  const outcome = await getEngagedCaseView(db(), personally(UID[role]), engagementId, NOW);
  if (!outcome.ok) throw new Error(outcome.rejection);
  return outcome.view.checklist.rows.find((r) => r.item.id === itemId)?.files.map((f) => f.fileId) ?? [];
}

beforeEach(() => {
  fake = new FakeFirestore();
  seedWorld();
  jest.clearAllMocks();
});

/** §15 Γ2 — ο θεατής από τον ΠΡΟΣΩΠΙΚΟ του χώρο (εκεί ζει κάθε συμμετοχή αυτών των σεναρίων: κανένα γραφείο). */
const personally = (uid: string) => ({ uid, viewed: personalWorkspace(uid) });

describe('ADR-901 Φ4.4 — αποστολή (transmittal)', () => {
  it('ο συμβολαιογράφος στέλνει σχέδιο ⇒ το βλέπουν ο οικοδεσπότης ΚΑΙ ο δικηγόρος αγοραστή · ίχνος · δέσμευση · ειδοποίηση', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    const buyerLawyer = await engage(record, 'buyer_lawyer');
    seedOwnFile('pf_draft', 'u_n', record.id, 'contract_draft');

    const outcome = await issue('notary', notary, 'contract_draft', 'case-contract-draft', 'pf_draft');

    expect(outcome).toMatchObject({ ok: true, kind: 'issued', contribution: { authorRole: 'notary', supersedes: null } });
    expect(await hostRowFiles('contract_draft')).toEqual(['pf_draft']);
    expect(await engagedRowFiles('buyer_lawyer', buyerLawyer, 'contract_draft')).toEqual(['pf_draft']);
    expect(ensureTransmittalHold).toHaveBeenCalledWith('u_n', 'pf_draft', record.id);
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({ action: 'document_added', entityType: 'conveyance_case' }));
    expect(announceDocumentToHost).toHaveBeenCalledWith(expect.objectContaining({ recipientUid: 'u_host' }));
    expect(announceDocumentToEngaged.mock.calls.map(([n]) => n.engagement.uid)).toEqual(['u_bl']);
  });

  it('Α23 — η έκθεση του δικηγόρου ΑΓΟΡΑΣΤΗ: όχι στον οικοδεσπότη, όχι στον δικηγόρο πωλητή, χωρίς όνομα στο βιβλίο, χωρίς ειδοποίηση', async () => {
    const record = await openCase();
    const buyerLawyer = await engage(record, 'buyer_lawyer');
    const sellerLawyer = await engage(record, 'seller_lawyer');
    seedOwnFile('pf_report', 'u_bl', record.id, 'legal_due_diligence_report');

    expect(await issue('buyer_lawyer', buyerLawyer, 'legal_due_diligence_report', 'case-legal-due-diligence', 'pf_report')).toMatchObject({ ok: true });

    expect(await hostRowFiles('legal_due_diligence_report')).toEqual([]);
    expect(await engagedRowFiles('seller_lawyer', sellerLawyer, 'legal_due_diligence_report')).toEqual([]);
    expect(await engagedRowFiles('buyer_lawyer', buyerLawyer, 'legal_due_diligence_report')).toEqual(['pf_report']);
    const added = recordChange.mock.calls.map(([e]) => e).find((e) => e.action === 'document_added');
    expect(JSON.stringify(added)).not.toContain('legal_due_diligence_report.pdf');
    expect(announceDocumentToHost).not.toHaveBeenCalled();
    expect(announceDocumentToEngaged).not.toHaveBeenCalled();
    // Ούτε με άνοιγμα από τον οικοδεσπότη: δεν είναι στον κατάλογό του ⇒ ίδιο με ανύπαρκτο.
    expect(await openHostCaseFile(db(), { uid: 'u_host', email: null, record, fileId: 'pf_report', mode: 'view' })).toEqual({ ok: false, rejection: 'not-found' });
  });

  it('Π2 (Α34 · Α35) — ταυτότητα αγοραστή εκ μέρους του: συμβολαιογράφος ✅ + ειδοποίηση · οικοδεσπότης μόνο «παραδόθηκε», χωρίς όνομα/άνοιγμα', async () => {
    const record = await openCase();
    const buyerLawyer = await engage(record, 'buyer_lawyer');
    const notary = await engage(record, 'notary');
    seedOwnFile('pf_buyer_id', 'u_bl', record.id, 'buyer_identity');

    expect(await issue('buyer_lawyer', buyerLawyer, 'buyer_identity', onBehalfEntryPointId('buyer_identity'), 'pf_buyer_id')).toMatchObject({ ok: true });

    expect(await engagedRowFiles('notary', notary, 'buyer_identity')).toEqual(['pf_buyer_id']);
    expect(announceDocumentToEngaged.mock.calls.map(([n]) => n.engagement.uid)).toEqual(['u_n']);
    const row = await hostRow('buyer_identity');
    expect(row).toMatchObject({ status: 'delivered_sealed', files: [], sealed: { itemId: 'buyer_identity', authorRole: 'buyer_lawyer' } });
    expect(announceDocumentToHost).not.toHaveBeenCalled();
    const added = recordChange.mock.calls.map(([e]) => e).find((e) => e.action === 'document_added');
    expect(JSON.stringify(added)).not.toContain('buyer_identity.pdf');
    expect(await openHostCaseFile(db(), { uid: 'u_host', email: null, record, fileId: 'pf_buyer_id', mode: 'view' })).toEqual({ ok: false, rejection: 'not-found' });
  });

  it('ιδεμπότητα — ίδια έκδοση δύο φορές ⇒ ΕΝΑ έγγραφο, ΕΝΑ ίχνος, ΜΙΑ ειδοποίηση', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    seedOwnFile('pf_draft', 'u_n', record.id, 'contract_draft');

    await issue('notary', notary, 'contract_draft', 'case-contract-draft', 'pf_draft');
    const again = await issue('notary', notary, 'contract_draft', 'case-contract-draft', 'pf_draft');

    expect(again).toMatchObject({ ok: true, kind: 'already-issued' });
    expect((await fake.collection(COLLECTIONS.CONVEYANCE_CONTRIBUTIONS).get()).size).toBe(1);
    expect(recordChange.mock.calls.filter(([e]) => e.action === 'document_added')).toHaveLength(1);
    expect(announceDocumentToHost).toHaveBeenCalledTimes(1);
    expect(ensureTransmittalHold).toHaveBeenCalledTimes(2); // η δέσμευση ΣΥΓΚΛΙΝΕΙ και στην επανάληψη
  });

  it('νέα έκδοση ⇒ νέο έγγραφο με `supersedes` · ο κατάλογος δείχνει μόνο τη νεότερη', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    seedOwnFile('pf_v1', 'u_n', record.id, 'contract_draft');
    seedOwnFile('pf_v2', 'u_n', record.id, 'contract_draft');
    const first = await issue('notary', notary, 'contract_draft', 'case-contract-draft', 'pf_v1');
    const second = await issueContribution(db(), { uid: 'u_n', engagementId: notary, checklistItemId: 'contract_draft', entryPointId: 'case-contract-draft', fileId: 'pf_v2', nowMs: NOW + 1000 });

    expect(second).toMatchObject({ ok: true, kind: 'issued', contribution: { supersedes: first.ok ? first.contribution.id : 'x' } });
    expect(await hostRowFiles('contract_draft')).toEqual(['pf_v2']);
  });

  it('κανένα μαντείο ύπαρξης — ξένο αρχείο · άλλης υπόθεσης · άλλης γραμμής · ανύπαρκτο ⇒ ίδιο `not-found`, μηδέν εγγραφές', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    seedOwnFile('pf_other_user', 'u_bl', record.id, 'contract_draft');
    seedOwnFile('pf_other_case', 'u_n', 'cvc_other', 'contract_draft');
    seedOwnFile('pf_wrong_row', 'u_n', record.id, 'final_contract');
    for (const fileId of ['pf_other_user', 'pf_other_case', 'pf_wrong_row', 'pf_missing']) {
      expect(await issue('notary', notary, 'contract_draft', 'case-contract-draft', fileId)).toEqual({ ok: false, rejection: 'not-found' });
    }
    expect((await fake.collection(COLLECTIONS.CONVEYANCE_CONTRIBUTIONS).get()).size).toBe(0);
  });

  it('Α25 — ο δικηγόρος δεν στέλνει έγγραφο του συμβολαιογράφου · μετά την υπογραφή παγώνει, ο συμβολαιογράφος όχι', async () => {
    const record = await openCase();
    const sellerLawyer = await engage(record, 'seller_lawyer');
    const notary = await engage(record, 'notary');
    seedOwnFile('pf_sl', 'u_sl', record.id, 'final_contract');
    expect(await issue('seller_lawyer', sellerLawyer, 'final_contract', 'case-final-contract', 'pf_sl'))
      .toEqual({ ok: false, rejection: 'refused', refusal: 'role-not-provider' });

    seedWorld('final_signed');
    seedOwnFile('pf_report', 'u_sl', record.id, 'legal_due_diligence_report');
    seedOwnFile('pf_final', 'u_n', record.id, 'final_contract');
    expect(await issue('seller_lawyer', sellerLawyer, 'legal_due_diligence_report', 'case-legal-due-diligence', 'pf_report'))
      .toEqual({ ok: false, rejection: 'refused', refusal: 'case-frozen' });
    expect(await issue('notary', notary, 'final_contract', 'case-final-contract', 'pf_final')).toMatchObject({ ok: true, kind: 'issued' });
  });

  it('Α24 — αρχείο στον χώρο του επαγγελματία ΧΩΡΙΣ αποστολή ⇒ κανένα τεκμήριο, η γραμμή μένει `notary_side`', async () => {
    const record = await openCase();
    await engage(record, 'notary');
    seedOwnFile('pf_draft', 'u_n', record.id, 'contract_draft');
    expect(await hostRow('contract_draft')).toMatchObject({ status: 'notary_side', files: [] });
  });
});

describe('ADR-901 Φ4.4 — άνοιγμα & απόσυρση', () => {
  async function issuedDraft() {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    seedOwnFile('pf_draft', 'u_n', record.id, 'contract_draft');
    const issued = await issue('notary', notary, 'contract_draft', 'case-contract-draft', 'pf_draft');
    if (!issued.ok) throw new Error(issued.rejection);
    return { record, notary, contributionId: issued.contribution.id };
  }

  it('ο οικοδεσπότης ανοίγει τη σταλμένη έκδοση από τον χώρο του ΣΥΝΤΑΚΤΗ · ίχνος με ρόλο `host`', async () => {
    const { record } = await issuedDraft();
    const outcome = await openHostCaseFile(db(), { uid: 'u_host', email: null, record, fileId: 'pf_draft', mode: 'view' });
    expect(outcome).toMatchObject({ ok: true });
    expect(signedDownloadUrl).toHaveBeenCalledWith(expect.objectContaining({ storagePath: 'people/u_n/x/pf_draft.pdf' }));
    const access = recordChange.mock.calls.map(([e]) => e).find((e) => e.action === 'document_accessed');
    expect(access.changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'access', newValue: 'view:host' })]));
  });

  it('κάδος του συντάκτη ≠ απόσυρση — η σταλμένη έκδοση ανοίγει ακόμη', async () => {
    const { record } = await issuedDraft();
    await fake.collection(COLLECTIONS.FILES_PERSONAL).doc('pf_draft').update({ isDeleted: true });
    expect(await openHostCaseFile(db(), { uid: 'u_host', email: null, record, fileId: 'pf_draft', mode: 'view' })).toMatchObject({ ok: true });
  });

  it('απόσυρση ⇒ φεύγει από τον κατάλογο, ανοίγει πια ως `not-found`, ίχνος, αποδέσμευση· δεύτερη ⇒ χωρίς εγγραφή', async () => {
    const { record, notary, contributionId } = await issuedDraft();
    const withdrawn = await withdrawContribution(db(), { uid: 'u_n', engagementId: notary, contributionId, nowMs: NOW + 1 });

    expect(withdrawn).toMatchObject({ ok: true, kind: 'withdrawn' });
    expect(await hostRowFiles('contract_draft')).toEqual([]);
    expect(await openHostCaseFile(db(), { uid: 'u_host', email: null, record, fileId: 'pf_draft', mode: 'view' })).toEqual({ ok: false, rejection: 'not-found' });
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({ action: 'document_removed' }));
    expect(releaseTransmittalHold).toHaveBeenCalledWith('u_n', 'pf_draft', new Set());
    expect(await withdrawContribution(db(), { uid: 'u_n', engagementId: notary, contributionId, nowMs: NOW + 2 })).toMatchObject({ ok: true, kind: 'already-withdrawn' });
    expect(releaseTransmittalHold).toHaveBeenCalledTimes(1);
  });

  it('μόνο ο συντάκτης αποσύρει — άλλος επαγγελματίας ⇒ `not-found`, μηδέν εγγραφές', async () => {
    const { record, contributionId } = await issuedDraft();
    const buyerLawyer = await engage(record, 'buyer_lawyer');
    expect(await withdrawContribution(db(), { uid: 'u_bl', engagementId: buyerLawyer, contributionId, nowMs: NOW + 1 })).toEqual({ ok: false, rejection: 'not-found' });
    expect(await hostRowFiles('contract_draft')).toEqual(['pf_draft']);
  });

  it('ο συντάκτης ανοίγει το δικό του σταλμένο μέσω της συμμετοχής του (ίδιος πυρήνας)', async () => {
    const { notary } = await issuedDraft();
    expect(await openCaseFile(db(), { uid: 'u_n', email: null, engagementId: notary, fileId: 'pf_draft', mode: 'download', nowMs: NOW })).toMatchObject({ ok: true });
  });
});

describe('ADR-901 Φ4.5 — «Στείλε τη νέα έκδοση στους ίδιους» (Α27 · Α28)', () => {
  /** v1 σταλμένη · v2 ανέβηκε ως διάδοχός της στη στοίβα του συντάκτη (όπως το γράφει ο `transitionContainer`). */
  async function sentThenRevised() {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    const buyerLawyer = await engage(record, 'buyer_lawyer');
    seedOwnFile('pf_v1', 'u_n', record.id, 'contract_draft');
    const sent = await issue('notary', notary, 'contract_draft', 'case-contract-draft', 'pf_v1');
    if (!sent.ok) throw new Error(sent.rejection);
    seedOwnFile('pf_v2', 'u_n', record.id, 'contract_draft');
    await fake.collection(COLLECTIONS.FILES_PERSONAL).doc('pf_v1').update({ supersededByFileId: 'pf_v2' });
    jest.clearAllMocks();
    return { record, notary, buyerLawyer, contributionId: sent.contribution.id };
  }

  const reissue = (uid: string, engagementId: string, contributionId: string, at = NOW + 1000) =>
    reissueContribution(db(), { uid, engagementId, contributionId, nowMs: at });

  async function draftSource(role: Role, engagementId: string) {
    const outcome = await getEngagedCaseView(db(), personally(UID[role]), engagementId, NOW);
    if (!outcome.ok) throw new Error(outcome.rejection);
    return outcome.view.checklist.rows.find((r) => r.item.id === 'contract_draft')?.files[0]?.source;
  }

  it('Α28 — ο συντάκτης βλέπει «νέα έκδοση» · ο δικηγόρος αγοραστή και ο οικοδεσπότης ΚΑΝΕΝΑ σήμα', async () => {
    const { notary, buyerLawyer } = await sentThenRevised();
    expect(await draftSource('notary', notary)).toMatchObject({ own: true, newerVersion: { displayName: 'contract_draft.pdf' } });
    const theirs = await draftSource('buyer_lawyer', buyerLawyer);
    expect(theirs).toMatchObject({ own: false });
    expect(theirs && 'newerVersion' in theirs).toBe(false);
    const hostSource = (await hostRow('contract_draft'))?.files[0]?.source;
    expect(hostSource && 'newerVersion' in hostSource).toBe(false);
  });

  it('Α27 — ένα πάτημα ⇒ η ΚΕΦΑΛΗ της στοίβας, `supersedes` = η σταλμένη, ίδιο ακροατήριο', async () => {
    const { contributionId, notary, buyerLawyer } = await sentThenRevised();
    const outcome = await reissue('u_n', notary, contributionId);

    expect(outcome).toMatchObject({ ok: true, kind: 'issued', contribution: { supersedes: contributionId, file: { fileId: 'pf_v2' } } });
    expect(await hostRowFiles('contract_draft')).toEqual(['pf_v2']);
    expect(await engagedRowFiles('buyer_lawyer', buyerLawyer, 'contract_draft')).toEqual(['pf_v2']);
    expect(announceDocumentToHost).toHaveBeenCalledTimes(1);
    expect(announceDocumentToEngaged.mock.calls.map(([n]) => n.engagement.uid)).toEqual(['u_bl']);
    // Μετά: η κεφαλή ΕΙΝΑΙ η σταλμένη ⇒ κανένα σήμα.
    expect(await draftSource('notary', notary)).toMatchObject({ own: true, newerVersion: null });
  });

  it('ιδεμπότητα — δεύτερο πάτημα ⇒ καμία νέα εγγραφή, καμία δεύτερη ειδοποίηση', async () => {
    const { contributionId, notary } = await sentThenRevised();
    await reissue('u_n', notary, contributionId);
    expect(await reissue('u_n', notary, contributionId, NOW + 2000)).toMatchObject({ ok: true, kind: 'already-issued' });
    expect((await fake.collection(COLLECTIONS.CONVEYANCE_CONTRIBUTIONS).get()).size).toBe(2);
    expect(announceDocumentToHost).toHaveBeenCalledTimes(1);
  });

  it('🔴 compare-and-set — αντικαταστάθηκε από ΑΛΛΗ έκδοση στο μεταξύ ⇒ `superseded`, καμία εγγραφή (μετάλλαξη: χωρίς CAS)', async () => {
    const { record, contributionId, notary } = await sentThenRevised();
    seedOwnFile('pf_other', 'u_n', record.id, 'contract_draft');
    await issueContribution(db(), { uid: 'u_n', engagementId: notary, checklistItemId: 'contract_draft', entryPointId: 'case-contract-draft', fileId: 'pf_other', nowMs: NOW + 500 });
    expect(await reissue('u_n', notary, contributionId)).toEqual({ ok: false, rejection: 'refused', refusal: 'superseded' });
    expect((await fake.collection(COLLECTIONS.CONVEYANCE_CONTRIBUTIONS).get()).size).toBe(2);
  });

  it('καμία νεότερη · νεότερη που ανεβαίνει ακόμη ⇒ `no-newer-version`, μηδέν εγγραφές', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    seedOwnFile('pf_v1', 'u_n', record.id, 'contract_draft');
    const sent = await issue('notary', notary, 'contract_draft', 'case-contract-draft', 'pf_v1');
    if (!sent.ok) throw new Error(sent.rejection);
    expect(await reissue('u_n', notary, sent.contribution.id)).toEqual({ ok: false, rejection: 'refused', refusal: 'no-newer-version' });

    seedOwnFile('pf_uploading', 'u_n', record.id, 'contract_draft');
    await fake.collection(COLLECTIONS.FILES_PERSONAL).doc('pf_uploading').update({ status: 'pending' });
    await fake.collection(COLLECTIONS.FILES_PERSONAL).doc('pf_v1').update({ supersededByFileId: 'pf_uploading' });
    expect(await reissue('u_n', notary, sent.contribution.id)).toEqual({ ok: false, rejection: 'refused', refusal: 'no-newer-version' });
    expect((await fake.collection(COLLECTIONS.CONVEYANCE_CONTRIBUTIONS).get()).size).toBe(1);
  });

  it('ξένη ή αποσυρμένη αποστολή ⇒ `not-found` (κανένα μαντείο ύπαρξης)', async () => {
    const { contributionId, notary, buyerLawyer } = await sentThenRevised();
    expect(await reissue('u_bl', buyerLawyer, contributionId)).toEqual({ ok: false, rejection: 'not-found' });
    await withdrawContribution(db(), { uid: 'u_n', engagementId: notary, contributionId, nowMs: NOW + 10 });
    expect(await reissue('u_n', notary, contributionId)).toEqual({ ok: false, rejection: 'not-found' });
  });
});

describe('ADR-901 Φ4.5 — «Ζήτησε έγγραφο» (Α29 · Α30 · Α31)', () => {
  const hostRequester = { kind: 'host', uid: 'u_host', name: 'host@a.gr' } as const;

  async function contextOf(record: ConveyanceCase) {
    const context = await loadConveyanceSubject(db(), 'comp_a', record.subject.propertyId);
    if (!context) throw new Error('no context');
    return context;
  }

  async function hostRequests(record: ConveyanceCase, itemIds: readonly string[], at = NOW) {
    return requestCaseDocuments(db(), { requester: hostRequester, record, context: await contextOf(record), itemIds, nowMs: at });
  }

  async function engagedRequests(record: ConveyanceCase, role: Role, engagementId: string, itemIds: readonly string[]) {
    const engagement = (await listCaseEngagements(db(), 'comp_a', 'proj_1', record.id)).find((e) => e.id === engagementId);
    if (!engagement) throw new Error('no engagement');
    return requestCaseDocuments(db(), { requester: { kind: 'engaged', engagement }, record, context: await contextOf(record), itemIds, nowMs: NOW });
  }

  const storedRequests = async () => (await fake.collection(COLLECTIONS.CONVEYANCE_DOCUMENT_REQUESTS).get()).size;
  const requestAudits = () => recordChange.mock.calls.map(([e]) => e).filter((e) => e.action === 'document_requested');

  it('ο οικοδεσπότης ζητά το σχέδιο ⇒ ο ΣΥΜΒΟΛΑΙΟΓΡΑΦΟΣ ειδοποιείται · ίχνος με ρόλους · «εκκρεμεί» και στις δύο πλευρές', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    jest.clearAllMocks();

    expect(await hostRequests(record, ['contract_draft'])).toEqual({ ok: true, items: [{ itemId: 'contract_draft', kind: 'requested', recipient: 'notary' }] });
    expect(announceDocumentRequest.mock.calls.map(([n]) => n.recipient.engagement?.uid)).toEqual(['u_n']);
    expect(requestAudits()).toHaveLength(1);
    expect(requestAudits()[0].changes).toEqual([expect.objectContaining({ field: 'request', newValue: 'contract_draft', label: 'host>notary' })]);
    expect(JSON.stringify(requestAudits()[0])).not.toMatch(/Σχέδιο|draft\.pdf/);

    const hostView = await getConveyanceCaseView(db(), host, 'prop_1');
    const hostPanel = hostView.ok && hostView.value ? hostView.value.documentRequests : null;
    expect(hostPanel?.log).toEqual([expect.objectContaining({ itemId: 'contract_draft', recipient: 'notary', byViewer: true })]);
    const engaged = await getEngagedCaseView(db(), personally('u_n'), notary, NOW);
    expect(engaged.ok && engaged.view.documentRequests.log).toEqual([expect.objectContaining({ itemId: 'contract_draft', byViewer: false })]);
  });

  it('Α30 — ίδια γραμμή ξανά την ίδια μέρα ⇒ `already-requested`: ΕΝΑ έγγραφο, ΕΝΑ ίχνος, ΜΙΑ ειδοποίηση · αύριο ξαναζητείται', async () => {
    const record = await openCase();
    await engage(record, 'notary');
    jest.clearAllMocks();
    await hostRequests(record, ['contract_draft']);
    expect(await hostRequests(record, ['contract_draft'], NOW + 60_000)).toMatchObject({ items: [{ kind: 'already-requested' }] });
    expect(await storedRequests()).toBe(1);
    expect(requestAudits()).toHaveLength(1);
    expect(announceDocumentRequest).toHaveBeenCalledTimes(1);

    expect(await hostRequests(record, ['contract_draft'], NOW + 86_400_000)).toMatchObject({ items: [{ kind: 'requested' }] });
    expect(await storedRequests()).toBe(2);
  });

  it('Α30 — ειδοποίηση που απέτυχε ⇒ η επανάληψη την ξαναστέλνει με το ΙΔΙΟ σύνολο, μετά σημαδεύεται (μετάλλαξη: σημάδεμα πριν την αποστολή)', async () => {
    const record = await openCase();
    await engage(record, 'notary');
    jest.clearAllMocks();
    announceDocumentRequest.mockResolvedValueOnce('failed');
    await hostRequests(record, ['contract_draft']);
    await hostRequests(record, ['contract_draft'], NOW + 1);
    await hostRequests(record, ['contract_draft'], NOW + 2);
    const sets = announceDocumentRequest.mock.calls.map(([n]) => n.requestIds);
    expect(sets).toHaveLength(2);
    expect(sets[0]).toEqual(sets[1]);
    expect(requestAudits()).toHaveLength(1);
  });

  it('🔴 Α29 — δικηγόρος αγοραστή ζητά γραμμή του ΠΩΛΗΤΗ ⇒ `not-found` (ίδιο με ανύπαρκτη), μηδέν εγγραφές, μηδέν ειδοποιήσεις', async () => {
    const record = await openCase();
    const buyerLawyer = await engage(record, 'buyer_lawyer');
    jest.clearAllMocks();
    expect(await engagedRequests(record, 'buyer_lawyer', buyerLawyer, ['seller_enfia_certificate']))
      .toEqual({ ok: true, items: [{ itemId: 'seller_enfia_certificate', kind: 'refused', refusal: 'not-found' }] });
    expect(await storedRequests()).toBe(0);
    expect(announceDocumentRequest).not.toHaveBeenCalled();
  });

  it('🔴 Α31 — συμβολαιογράφος → δικηγόρος αγοραστή: ο οικοδεσπότης ΔΕΝ το βλέπει, ο παραλήπτης ναι', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    const buyerLawyer = await engage(record, 'buyer_lawyer');
    jest.clearAllMocks();
    expect(await engagedRequests(record, 'notary', notary, ['buyer_payment_proofs']))
      .toMatchObject({ items: [{ kind: 'requested', recipient: 'buyer_lawyer' }] });
    const hostView = await getConveyanceCaseView(db(), host, 'prop_1');
    expect(hostView.ok && hostView.value?.documentRequests.log).toEqual([]);
    const theirs = await getEngagedCaseView(db(), personally('u_bl'), buyerLawyer, NOW);
    expect(theirs.ok && theirs.view.documentRequests.log).toEqual([expect.objectContaining({ itemId: 'buyer_payment_proofs', byViewer: false })]);
  });

  it('«Ζήτησε όλα» ⇒ ΜΙΑ ειδοποίηση ανά παραλήπτη · κάθε γραμμή απαντά για τον εαυτό της', async () => {
    const record = await openCase();
    await engage(record, 'notary');
    jest.clearAllMocks();
    const outcome = await hostRequests(record, ['contract_draft', 'final_contract', 'seller_enfia_certificate', 'buyer_payment_proofs']);
    expect(outcome).toEqual({ ok: true, items: [
      { itemId: 'contract_draft', kind: 'requested', recipient: 'notary' },
      { itemId: 'final_contract', kind: 'requested', recipient: 'notary' },
      { itemId: 'seller_enfia_certificate', kind: 'refused', refusal: 'self-provider' },
      { itemId: 'buyer_payment_proofs', kind: 'refused', refusal: 'no-recipient' },
    ] });
    expect(announceDocumentRequest).toHaveBeenCalledTimes(1);
    expect(announceDocumentRequest.mock.calls[0]?.[0].requestIds).toHaveLength(2);
    expect(requestAudits()).toHaveLength(1);
  });
});

describe('ADR-901 §14.8 — σήματα όψεων άκρη σε άκρη (Α36)', () => {
  const HOST_VIEW = { kind: 'host', propertyId: 'prop_1', companyId: 'comp_a' } as const;
  const engagedView = (role: Role, engagementId: string) => ({ kind: 'engagement', engagementId, uid: UID[role] } as const);

  /** Η αναθεώρηση κάθε όψης — όπως τη διαβάζει ο server πριν από την όψη. */
  async function revisions(views: Readonly<Record<string, CaseViewKey>>): Promise<Record<string, number>> {
    const entries = await Promise.all(Object.entries(views).map(async ([name, view]) => [name, await readViewRevision(db(), view)] as const));
    return Object.fromEntries(entries);
  }

  async function delta(views: Readonly<Record<string, CaseViewKey>>, act: () => Promise<unknown>): Promise<Record<string, number>> {
    const before = await revisions(views);
    await act();
    const after = await revisions(views);
    return Object.fromEntries(Object.keys(views).map((name) => [name, (after[name] ?? 0) - (before[name] ?? 0)]));
  }

  it('Π5 — σφραγισμένη παράδοση ⇒ ο οικοδεσπότης ΠΑΙΡΝΕΙ σήμα ΧΩΡΙΣ ειδοποίηση · ο δικηγόρος πωλητή ΚΑΝΕΝΑ', async () => {
    const record = await openCase();
    const buyerLawyer = await engage(record, 'buyer_lawyer');
    const notary = await engage(record, 'notary');
    const sellerLawyer = await engage(record, 'seller_lawyer');
    seedOwnFile('pf_buyer_id', 'u_bl', record.id, 'buyer_identity');
    const views = { host: HOST_VIEW, bl: engagedView('buyer_lawyer', buyerLawyer), n: engagedView('notary', notary), sl: engagedView('seller_lawyer', sellerLawyer) };

    const moved = await delta(views, () => issue('buyer_lawyer', buyerLawyer, 'buyer_identity', onBehalfEntryPointId('buyer_identity'), 'pf_buyer_id'));

    expect(moved).toEqual({ host: 1, bl: 1, n: 1, sl: 0 });
    expect(announceDocumentToHost).not.toHaveBeenCalled();
  });

  it('Α23 — η έκθεση του δικηγόρου αγοραστή ⇒ ούτε ο οικοδεσπότης ούτε ο δικηγόρος πωλητή μαθαίνουν ΠΟΤΕ δούλεψε', async () => {
    const record = await openCase();
    const buyerLawyer = await engage(record, 'buyer_lawyer');
    const sellerLawyer = await engage(record, 'seller_lawyer');
    seedOwnFile('pf_report', 'u_bl', record.id, 'legal_due_diligence_report');
    const views = { host: HOST_VIEW, bl: engagedView('buyer_lawyer', buyerLawyer), sl: engagedView('seller_lawyer', sellerLawyer) };

    expect(await delta(views, () => issue('buyer_lawyer', buyerLawyer, 'legal_due_diligence_report', 'case-legal-due-diligence', 'pf_report')))
      .toEqual({ host: 0, bl: 1, sl: 0 });
  });

  it('Α31 — αίτημα συμβολαιογράφου → δικηγόρου αγοραστή ⇒ σήμα ΜΟΝΟ σε αυτούς τους δύο · ξανά σήμερα ⇒ κανένα', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    const buyerLawyer = await engage(record, 'buyer_lawyer');
    const engagement = (await listCaseEngagements(db(), 'comp_a', 'proj_1', record.id)).find((e) => e.id === notary);
    const context = await loadConveyanceSubject(db(), 'comp_a', 'prop_1');
    if (!engagement || !context) throw new Error('setup');
    const ask = () => requestCaseDocuments(db(), { requester: { kind: 'engaged', engagement }, record, context, itemIds: ['buyer_payment_proofs'], nowMs: NOW });
    const views = { host: HOST_VIEW, n: engagedView('notary', notary), bl: engagedView('buyer_lawyer', buyerLawyer) };

    expect(await delta(views, ask)).toEqual({ host: 0, n: 1, bl: 1 });
    expect(await delta(views, ask)).toEqual({ host: 0, n: 0, bl: 0 });
  });

  it('ανάκληση συμμετοχής ⇒ σήμα ΚΑΙ στην ανακλημένη (μαθαίνει αμέσως ότι έχασε την πρόσβαση) · στον οικοδεσπότη · στους άλλους', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    const buyerLawyer = await engage(record, 'buyer_lawyer');
    const views = { host: HOST_VIEW, n: engagedView('notary', notary), bl: engagedView('buyer_lawyer', buyerLawyer) };

    expect(await delta(views, () => endCaseEngagement(db(), host, record, buyerLawyer, NOW))).toEqual({ host: 1, n: 1, bl: 1 });
  });

  it('η όψη ΚΟΥΒΑΛΑ την αναθεώρηση στην οποία παράχθηκε — ο client δεν ξαναρωτά για τη δική του πράξη', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    seedOwnFile('pf_draft', 'u_n', record.id, 'contract_draft');
    await issue('notary', notary, 'contract_draft', 'case-contract-draft', 'pf_draft');

    const hostView = await getConveyanceCaseView(db(), host, 'prop_1');
    const engaged = await getEngagedCaseView(db(), personally('u_n'), notary, NOW);
    expect(hostView.ok && hostView.value?.freshness.revision).toBe(await readViewRevision(db(), HOST_VIEW));
    expect(engaged.ok && engaged.view.freshness.revision).toBe(await readViewRevision(db(), engagedView('notary', notary)));
  });
});
