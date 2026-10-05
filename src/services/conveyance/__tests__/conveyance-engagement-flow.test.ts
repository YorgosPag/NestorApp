/**
 * @jest-environment node
 *
 * ADR-901 Φ2 · ADR-862 Φ1 — η ροή της συμμετοχής **από άκρη σε άκρη**, πάνω στο επαληθευμένο fake Firestore:
 * ορισμός (`contact_links`) → πρόταση (οικοδεσπότης) → «Αναλαμβάνω» (επαγγελματίας) → όψη ανά ρόλο → ανάκληση.
 *
 * Κάθε `it` ονομάζει τη μετάλλαξη που πρέπει να πιάσει.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { openConveyanceCase, type ConveyanceActor } from '../conveyance-case.service';
import { endCaseEngagement, listCaseProfessionalSlots, offerCaseEngagement } from '../conveyance-engagement-host.service';
import { getEngagedCaseView, listMyCases, respondToCaseEngagement } from '../conveyance-engagement-access.service';
import type { ConveyanceCase } from '@/types/conveyance-case';
import { EntityAuditService } from '@/services/entity-audit.service';
import { openCaseFile } from '../conveyance-case-file-access.service';

const NAMES: Record<string, string> = { u_sl: 'Ελένη Σ.', u_n: 'Νίκος Σ.' };
/** ADR-901 §15 (Γ1) — τα γραφεία όπου ΑΝΗΚΕΙ ο αποδεχόμενος· προεπιλογή: κανένα ⇒ προσωρινά ο προσωπικός του χώρος. */
const mockOwnWorkspaces = jest.fn(async (_uid: string, _active: unknown): Promise<unknown> => ({ outcome: 'ok', reachable: [], belonging: [] }));
jest.mock('@/lib/auth/workspace-membership', () => ({
  ...jest.requireActual('@/lib/auth/workspace-membership'),
  listOwnWorkspaces: (uid: string, active: unknown) => mockOwnWorkspaces(uid, active),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
  resolveUserDisplayName: jest.fn(async (uid: string, fallback: string | null) => NAMES[uid] ?? fallback),
}));
jest.mock('@/server/engagement-invitations/engagement-invitation-notice', () => ({
  notifyEngagementInvitation: jest.fn(async () => 'accepted'),
}));
process.env.ENGAGEMENT_INVITE_SECRET ??= 'δοκιμαστικό-μυστικό-πρόσκλησης-υπόθεσης';
jest.mock('../conveyance-engagement-notifier', () => ({
  announceEngagementChanged: jest.fn(async () => undefined),
  announceEngagementAnswered: jest.fn(async () => undefined),
}));
const signedDownloadUrl = jest.fn(async (_req: { storagePath: string; downloadFileName?: string }) => ({ outcome: 'signed', url: 'https://signed.example/x', expiresAt: 1 }));
jest.mock('@/lib/storage/signed-download-url', () => ({ signedDownloadUrl: (req: { storagePath: string; downloadFileName?: string }) => signedDownloadUrl(req) }));
jest.mock('@/server/files/file-record-bucket', () => ({ fileRecordBucket: () => ({ name: 'bucket-under-test' }) }));
/** Λογαριασμοί της «πλατφόρμας»: email → uid. Ό,τι λείπει ⇒ `auth/user-not-found`. */
const ACCOUNTS: Record<string, string> = { 'seller-lawyer@x.gr': 'u_sl', 'buyer-lawyer@x.gr': 'u_bl', 'notary@x.gr': 'u_n' };
jest.mock('@/lib/firebaseAdmin', () => ({
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
let fake: FakeFirestore;
const db = () => fake as unknown as Firestore;

function appoint(contactId: string, role: string, email: string | null): void {
  fake.seed(COLLECTIONS.CONTACT_LINKS, `cl_${contactId}`, {
    companyId: 'comp_a', sourceContactId: contactId, targetEntityType: 'property', targetEntityId: 'prop_1', role, status: 'active',
  });
  fake.seed(COLLECTIONS.CONTACTS, contactId, { companyId: 'comp_a', emails: email ? [{ email, isPrimary: true }] : [] });
}

function seedWorld(): void {
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', {
    companyId: 'comp_a', name: 'Δ3', type: 'apartment', buildingId: 'bld_1', projectId: 'proj_1',
    commercial: { owners: [{ contactId: 'cont_b' }], legalPhase: 'preliminary_signed' },
  });
  fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { companyId: 'comp_a', linkedCompanyId: 'cont_s', landownerContactIds: [] });
  appoint('cont_sl', 'seller_lawyer', 'seller-lawyer@x.gr');
  appoint('cont_bl', 'buyer_lawyer', 'buyer-lawyer@x.gr');
  appoint('cont_n', 'notary', 'notary@x.gr');
}

async function openCase(): Promise<ConveyanceCase> {
  const opened = await openConveyanceCase(db(), host, 'prop_1');
  if (!opened.ok) throw new Error(opened.failure.kind);
  return opened.value.view.conveyanceCase;
}

async function engagementIdOf(record: ConveyanceCase, role: string): Promise<string> {
  const slot = (await listCaseProfessionalSlots(db(), record)).find((s) => s.role === role);
  if (!slot?.engagement) throw new Error(`no engagement for ${role}`);
  return slot.engagement.engagementId;
}

beforeEach(() => { fake = new FakeFirestore(); seedWorld(); });

describe('ADR-901 Φ2 — από τον ορισμό στην πρόσβαση', () => {
  it('Entra — πρόταση ΧΩΡΙΣ αποδοχή ⇒ ΚΑΜΙΑ όψη (`offered`), και η κάρτα δεν δείχνει πρόοδο', async () => {
    const record = await openCase();
    expect((await offerCaseEngagement(db(), host, record, { role: 'seller_lawyer', attestedBasis: null, nowMs: NOW })).ok).toBe(true);
    const id = await engagementIdOf(record, 'seller_lawyer');
    expect(await getEngagedCaseView(db(), 'u_sl', id, NOW)).toEqual({ ok: false, rejection: 'denied', verdict: 'offered' });
    const cards = await listMyCases(db(), { uid: 'u_sl', active: null }, NOW);
    expect(cards.ok && cards.cards[0]).toMatchObject({ engagementState: 'offered', summary: null, propertyName: 'Δ3' });
  });

  it('visibleTo — ο δικηγόρος ΠΩΛΗΤΗ δεν βλέπει ΚΑΜΙΑ γραμμή αγοραστή, και το ωμό έγγραφο δεν φεύγει', async () => {
    const record = await openCase();
    await offerCaseEngagement(db(), host, record, { role: 'seller_lawyer', attestedBasis: null, nowMs: NOW });
    const id = await engagementIdOf(record, 'seller_lawyer');
    expect((await respondToCaseEngagement(db(), { uid: 'u_sl', email: null, active: null }, id, ACCEPT, NOW)).ok).toBe(true);
    const outcome = await getEngagedCaseView(db(), 'u_sl', id, NOW);
    if (!outcome.ok) throw new Error(outcome.rejection);
    const sections = new Set(outcome.view.checklist.rows.map((row) => row.section));
    expect(sections.has('buyer')).toBe(false);
    expect(sections.has('seller')).toBe(true);
    expect(Object.keys(outcome.view)).not.toContain('conveyanceCase');
  });

  it('visibleTo — ο δικηγόρος ΑΓΟΡΑΣΤΗ δεν βλέπει γραμμές πωλητή· χωρίς δηλωμένη βάση ΔΕΝ προτείνεται', async () => {
    const record = await openCase();
    expect(await offerCaseEngagement(db(), host, record, { role: 'buyer_lawyer', attestedBasis: null, nowMs: NOW }))
      .toEqual({ ok: false, rejection: 'consent-basis-required' });
    await offerCaseEngagement(db(), host, record, { role: 'buyer_lawyer', attestedBasis: 'preliminary_contract', nowMs: NOW });
    const id = await engagementIdOf(record, 'buyer_lawyer');
    await respondToCaseEngagement(db(), { uid: 'u_bl', email: null, active: null }, id, ACCEPT, NOW);
    const outcome = await getEngagedCaseView(db(), 'u_bl', id, NOW);
    if (!outcome.ok) throw new Error(outcome.rejection);
    expect(outcome.view.checklist.rows.some((row) => row.section === 'seller')).toBe(false);
  });

  it('ξένη συμμετοχή ≡ ανύπαρκτη — άλλος άνθρωπος με την ίδια ταυτότητα παίρνει `not-found`', async () => {
    const record = await openCase();
    await offerCaseEngagement(db(), host, record, { role: 'notary', attestedBasis: 'written_instruction', nowMs: NOW });
    const id = await engagementIdOf(record, 'notary');
    expect(await getEngagedCaseView(db(), 'u_sl', id, NOW)).toEqual({ ok: false, rejection: 'not-found' });
    expect(await respondToCaseEngagement(db(), { uid: 'u_sl', email: null, active: null }, id, ACCEPT, NOW)).toEqual({ ok: false, rejection: 'not-found' });
  });

  it('ζώνη-και-τιράντες — συμμετοχή που δείχνει σε υπόθεση ΑΛΛΟΥ μισθωτή ⇒ `not-found` (ο μισθωτής ξανακρίνεται στο έγγραφο)', async () => {
    const record = await openCase();
    await offerCaseEngagement(db(), host, record, { role: 'seller_lawyer', attestedBasis: null, nowMs: NOW });
    const id = await engagementIdOf(record, 'seller_lawyer');
    await respondToCaseEngagement(db(), { uid: 'u_sl', email: null, active: null }, id, ACCEPT, NOW);
    // ΚΑΙ το ακίνητο στον ξένο μισθωτή: αλλιώς ο έλεγχος μισθωτή του `loadConveyanceSubject` θα έκρυβε
    // τη μετάλλαξη (μετρημένο: M7 επέζησε) — εδώ ΜΟΝΟ ο έλεγχος «υπόθεση ∈ μισθωτή της συμμετοχής» σώζει.
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, record.id, { ...record, companyId: 'comp_b' });
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: 'comp_b', name: 'Δ3', type: 'apartment', buildingId: 'bld_1', projectId: 'proj_1' });
    expect(await getEngagedCaseView(db(), 'u_sl', id, NOW)).toEqual({ ok: false, rejection: 'not-found' });
  });

  it('ανάκληση ⇒ ΑΜΕΣΗ άρνηση με το δικό της όνομα (`revoked`, ποτέ `expired`)', async () => {
    const record = await openCase();
    await offerCaseEngagement(db(), host, record, { role: 'seller_lawyer', attestedBasis: null, nowMs: NOW });
    const id = await engagementIdOf(record, 'seller_lawyer');
    await respondToCaseEngagement(db(), { uid: 'u_sl', email: null, active: null }, id, ACCEPT, NOW);
    expect((await endCaseEngagement(db(), host, record, id, NOW + 1)).ok).toBe(true);
    expect(await getEngagedCaseView(db(), 'u_sl', id, NOW + 2)).toEqual({ ok: false, rejection: 'denied', verdict: 'revoked' });
  });

  it('Procore «Save & Send Invitation» (ADR-901 Φ3) — χωρίς λογαριασμό ⇒ ΠΡΟΣΚΛΗΣΗ με email, όχι άρνηση', async () => {
    appoint('cont_bl', 'buyer_lawyer', 'nobody@x.gr');
    const record = await openCase();
    const outcome = await offerCaseEngagement(db(), host, record, { role: 'buyer_lawyer', attestedBasis: 'verbal_instruction', nowMs: NOW });
    expect(outcome).toMatchObject({ ok: true, created: true, invited: 'accepted' });
    const slot = (await listCaseProfessionalSlots(db(), record)).find((s) => s.role === 'buyer_lawyer');
    expect(slot).toMatchObject({ appointment: 'needs-invitation', engagement: null, invitation: { state: 'pending', inviteeEmail: 'nobody@x.gr' } });
  });

  it('κλείσιμο υπόθεσης (ακύρωση) ⇒ η ενεργή συμμετοχή γίνεται `completed` — η κύρια λήξη, χωρίς χειρόγραφο βήμα', async () => {
    const { applyConveyanceCaseCommand } = await import('../conveyance-case.service');
    const record = await openCase();
    await offerCaseEngagement(db(), host, record, { role: 'seller_lawyer', attestedBasis: null, nowMs: NOW });
    const id = await engagementIdOf(record, 'seller_lawyer');
    await respondToCaseEngagement(db(), { uid: 'u_sl', email: null, active: null }, id, ACCEPT, NOW);
    const cancelled = await applyConveyanceCaseCommand(db(), host, record, { expectedVersion: record.version, command: { type: 'cancel', reason: 'ακύρωση' } });
    expect(cancelled.ok).toBe(true);
    expect(await getEngagedCaseView(db(), 'u_sl', id, Date.now())).toEqual({ ok: false, rejection: 'denied', verdict: 'completed' });
  });
});

describe('ADR-901 Φ4.1 — δήλωση με λογαριασμό · συμμετέχοντες', () => {
  async function engage(record: ConveyanceCase, role: 'seller_lawyer' | 'notary', uid: string, basis: 'written_instruction' | null) {
    await offerCaseEngagement(db(), host, record, { role, attestedBasis: basis, nowMs: NOW });
    const id = await engagementIdOf(record, role);
    await respondToCaseEngagement(db(), { uid, email: null, active: null }, id, ACCEPT, NOW);
    return id;
  }

  it('Α17 — «Αναλαμβάνω» με λογαριασμό ⇒ η δήλωση φτάνει στον οικοδεσπότη, με το μητρώο ΤΟΥ ΡΟΛΟΥ', async () => {
    const record = await openCase();
    await engage(record, 'seller_lawyer', 'u_sl', null);
    const slot = (await listCaseProfessionalSlots(db(), record)).find((s) => s.role === 'seller_lawyer');
    expect(slot?.engagement?.declaredCredential).toMatchObject({ authority: 'bar-association', number: '1234', chapter: 'ΔΣΑ', assurance: 'declared' });
  });

  it('Α18 — οι συμμετέχοντες δείχνουν ρόλο/όνομα/δήλωση και ΚΑΝΕΝΑ email ή uid', async () => {
    // Μετάλλαξη: ωμή συμμετοχή στην όψη ⇒ το email του άλλου επαγγελματία διαρρέει.
    const record = await openCase();
    const mine = await engage(record, 'seller_lawyer', 'u_sl', null);
    await engage(record, 'notary', 'u_n', 'written_instruction');
    const outcome = await getEngagedCaseView(db(), 'u_sl', mine, NOW);
    if (!outcome.ok) throw new Error(outcome.rejection);
    expect(outcome.view.participants.map((p) => [p.role, p.displayName, p.isViewer])).toEqual([
      ['seller_lawyer', 'Ελένη Σ.', true],
      ['notary', 'Νίκος Σ.', false],
    ]);
    expect(outcome.view.participants[1].declaredCredential).toMatchObject({ authority: 'notary-association', number: '1234' });
    const serialized = JSON.stringify(outcome.view.participants);
    expect(serialized).not.toMatch(/@x\.gr|u_n|u_sl/);
  });

  it('πρόταση που δεν απαντήθηκε ΔΕΝ είναι συμμετέχων — ούτε ανακλημένη', async () => {
    const record = await openCase();
    const mine = await engage(record, 'seller_lawyer', 'u_sl', null);
    await offerCaseEngagement(db(), host, record, { role: 'notary', attestedBasis: 'written_instruction', nowMs: NOW });
    const outcome = await getEngagedCaseView(db(), 'u_sl', mine, NOW);
    expect(outcome.ok && outcome.view.participants.map((p) => p.role)).toEqual(['seller_lawyer']);
  });

  it('«θυμήσου με» — η προσυμπλήρωση της πρότασης έρχεται από την ΠΙΟ ΠΡΟΣΦΑΤΗ δική του δήλωση', async () => {
    // Πρώτη υπόθεση: δηλώνει. Δεύτερη (άλλο ακίνητο): η κάρτα της πρότασης προσυμπληρώνεται από την πρώτη.
    const first = await openCase();
    await engage(first, 'seller_lawyer', 'u_sl', null);
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_2', {
      companyId: 'comp_a', name: 'Δ4', type: 'apartment', buildingId: 'bld_1', projectId: 'proj_1',
      commercial: { owners: [{ contactId: 'cont_b' }], legalPhase: 'preliminary_signed' },
    });
    fake.seed(COLLECTIONS.CONTACT_LINKS, 'cl_sl_2', {
      companyId: 'comp_a', sourceContactId: 'cont_sl', targetEntityType: 'property', targetEntityId: 'prop_2', role: 'seller_lawyer', status: 'active',
    });
    const opened = await openConveyanceCase(db(), host, 'prop_2');
    if (!opened.ok) throw new Error(opened.failure.kind);
    await offerCaseEngagement(db(), host, opened.value.view.conveyanceCase, { role: 'seller_lawyer', attestedBasis: null, nowMs: NOW });
    const cards = await listMyCases(db(), { uid: 'u_sl', active: null }, NOW);
    const offered = cards.ok ? cards.cards.find((c) => c.engagementState === 'offered') : undefined;
    expect(offered?.credentialHint).toEqual({ number: '1234', chapter: 'ΔΣΑ' });
    const active = cards.ok ? cards.cards.find((c) => c.engagementState === 'active') : undefined;
    expect(active?.credentialHint).toBeNull();
  });
});

describe('ADR-901 Φ4.2 — ο επαγγελματίας ανοίγει τεκμήρια', () => {
  const PERMIT = 'file_permit';
  function seedPermit(): void {
    fake.seed(COLLECTIONS.FILES, PERMIT, {
      companyId: 'comp_a', entityType: 'project', entityId: 'proj_1', purpose: 'permit', status: 'ready',
      displayName: 'Οικοδομική άδεια', ext: 'pdf', contentType: 'application/pdf',
      storagePath: 'companies/comp_a/projects/proj_1/entities/project/proj_1/domains/legal/categories/permits/files/file_permit.pdf',
    });
    // Αρχείο του ίδιου μισθωτή που ΔΕΝ είναι τεκμήριο καμίας γραμμής.
    fake.seed(COLLECTIONS.FILES, 'file_secret', {
      companyId: 'comp_a', entityType: 'project', entityId: 'proj_1', purpose: 'invoice', status: 'ready',
      displayName: 'Τιμολόγιο', ext: 'pdf', contentType: 'application/pdf', storagePath: 'companies/comp_a/x/file_secret.pdf',
    });
  }
  const recordChange = EntityAuditService.recordChange as jest.Mock;
  const accessEntries = () => recordChange.mock.calls.map(([entry]) => entry).filter((entry) => entry.action === 'document_accessed');

  async function engagedSellerLawyer(): Promise<string> {
    const record = await openCase();
    await offerCaseEngagement(db(), host, record, { role: 'seller_lawyer', attestedBasis: null, nowMs: NOW });
    const id = await engagementIdOf(record, 'seller_lawyer');
    await respondToCaseEngagement(db(), { uid: 'u_sl', email: 'seller-lawyer@x.gr', active: null }, id, ACCEPT, NOW);
    return id;
  }

  beforeEach(() => { recordChange.mockClear(); signedDownloadUrl.mockClear(); seedPermit(); });

  it('Α20 — άνοιγμα ορατού τεκμηρίου ⇒ σύνδεσμος + ΑΚΡΙΒΩΣ ένα `document_accessed` στο βιβλίο της υπόθεσης', async () => {
    const id = await engagedSellerLawyer();
    const outcome = await openCaseFile(db(), { uid: 'u_sl', email: null, engagementId: id, fileId: PERMIT, mode: 'download', nowMs: NOW });
    expect(outcome).toMatchObject({ ok: true, url: 'https://signed.example/x', fileName: 'Οικοδομική άδεια.pdf' });
    expect(signedDownloadUrl).toHaveBeenCalledWith(expect.objectContaining({ downloadFileName: 'Οικοδομική άδεια.pdf' }));
    const entries = accessEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ entityType: 'conveyance_case', companyId: 'comp_a', performedBy: 'u_sl' });
    expect(entries[0].changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'access', newValue: 'download:seller_lawyer' })]));
  });

  it('προβολή ⇒ ΧΩΡΙΣ `attachment` (inline), ίδιο ίχνος με τον τρόπο `view`', async () => {
    const id = await engagedSellerLawyer();
    await openCaseFile(db(), { uid: 'u_sl', email: null, engagementId: id, fileId: PERMIT, mode: 'view', nowMs: NOW });
    expect(signedDownloadUrl.mock.calls[0][0].downloadFileName).toBeUndefined();
    expect(accessEntries()[0].changes).toEqual(expect.arrayContaining([expect.objectContaining({ newValue: 'view:seller_lawyer' })]));
  });

  it('Α19 — αρχείο του μισθωτή που ΔΕΝ είναι τεκμήριο ορατής γραμμής ⇒ `not-found`, καμία υπογραφή, κανένα ίχνος', async () => {
    // Μετάλλαξη: λήψη χωρίς επαναπαραγωγή του καταλόγου ⇒ ο επαγγελματίας κατεβάζει ΟΠΟΙΟΔΗΠΟΤΕ αρχείο του έργου.
    const id = await engagedSellerLawyer();
    expect(await openCaseFile(db(), { uid: 'u_sl', email: null, engagementId: id, fileId: 'file_secret', mode: 'download', nowMs: NOW }))
      .toEqual({ ok: false, rejection: 'not-found' });
    expect(signedDownloadUrl).not.toHaveBeenCalled();
    expect(accessEntries()).toHaveLength(0);
  });

  it('ανακλημένη συμμετοχή ⇒ `denied/revoked`, καμία υπογραφή — η ανάκληση είναι άμεση', async () => {
    const id = await engagedSellerLawyer();
    const record = await openCase(); // ιδεμποτές (Α14): η ΙΔΙΑ υπόθεση
    expect((await endCaseEngagement(db(), host, record, id, NOW + 1)).ok).toBe(true);
    expect(await openCaseFile(db(), { uid: 'u_sl', email: null, engagementId: id, fileId: PERMIT, mode: 'view', nowMs: NOW + 2 }))
      .toEqual({ ok: false, rejection: 'denied', verdict: 'revoked' });
    expect(signedDownloadUrl).not.toHaveBeenCalled();
  });

  it('ξένος άνθρωπος με την ίδια ταυτότητα συμμετοχής ⇒ `not-found`', async () => {
    const id = await engagedSellerLawyer();
    expect(await openCaseFile(db(), { uid: 'u_n', email: null, engagementId: id, fileId: PERMIT, mode: 'view', nowMs: NOW }))
      .toEqual({ ok: false, rejection: 'not-found' });
  });
});

describe('ADR-901 §15 (Γ1) — «Αναλαμβάνω» για λογαριασμό ποιου γραφείου', () => {
  const recordChange = EntityAuditService.recordChange as jest.Mock;
  const sl = { uid: 'u_sl', email: 'seller-lawyer@x.gr', active: null } as const;
  /** Τα γραφεία όπου ΑΝΗΚΕΙ ο αποδεχόμενος — ό,τι θα απαντούσε ο `listOwnWorkspaces`. */
  const belongsTo = (...companyIds: string[]) =>
    mockOwnWorkspaces.mockImplementation(async () => ({ outcome: 'ok', reachable: companyIds, belonging: companyIds }));
  const stored = async (id: string) => (await fake.collection('companies/comp_a/projects/proj_1/engagements').doc(id).get()).data();

  async function offeredToSellerLawyer(): Promise<string> {
    const record = await openCase();
    await offerCaseEngagement(db(), host, record, { role: 'seller_lawyer', attestedBasis: null, nowMs: NOW });
    return engagementIdOf(record, 'seller_lawyer');
  }

  beforeEach(() => { recordChange.mockClear(); belongsTo(); });
  afterAll(() => { belongsTo(); });

  it('κανένα γραφείο ⇒ προσωρινά ο προσωπικός χώρος — γραμμένο στη συμμετοχή, στην κάρτα και στο ίχνος', async () => {
    const id = await offeredToSellerLawyer();
    const before = await listMyCases(db(), sl, NOW);
    expect(before.ok && before.cards[0]).toMatchObject({ acceptance: { kind: 'personal-provisional' }, actingFor: null });
    const outcome = await respondToCaseEngagement(db(), sl, id, ACCEPT, NOW);
    expect(outcome.ok && outcome.card).toMatchObject({ acceptance: null, actingFor: { kind: 'personal' } });
    expect((await stored(id))?.actingFor).toEqual({ kind: 'personal', userId: 'u_sl' });
    expect(recordChange.mock.calls.at(-1)?.[0].changes).toEqual(expect.arrayContaining([{ field: 'actingFor', oldValue: null, newValue: 'personal' }]));
  });

  it('Α1 — ένα γραφείο ⇒ εκεί, αυτόματα· ο πελάτης ΔΕΝ έστειλε τίποτα', async () => {
    belongsTo('comp_law');
    const id = await offeredToSellerLawyer();
    const before = await listMyCases(db(), sl, NOW);
    expect(before.ok && before.cards[0]?.acceptance).toMatchObject({ kind: 'office', office: { companyId: 'comp_law' } });
    const outcome = await respondToCaseEngagement(db(), sl, id, ACCEPT, NOW);
    expect(outcome.ok && outcome.card.actingFor).toMatchObject({ kind: 'office', office: { companyId: 'comp_law' } });
    expect((await stored(id))?.actingFor).toEqual({ kind: 'org', companyId: 'comp_law' });
    // ⛔ Εμφωλευμένο: κανένα επίπεδο `companyId` πάνω στη συμμετοχή (θα διαβαζόταν ως μισθωτής του εγγράφου).
    expect(await stored(id)).not.toHaveProperty('companyId');
    expect(recordChange.mock.calls.at(-1)?.[0]).toMatchObject({ companyId: 'comp_a' });
    expect(recordChange.mock.calls.at(-1)?.[0].changes).toEqual(expect.arrayContaining([{ field: 'actingFor', oldValue: null, newValue: 'comp_law' }]));
  });

  it('Α41 — 2 γραφεία χωρίς επιλογή ⇒ `acting-choice-required`, ΚΑΜΙΑ γραφή· με επιλογή ⇒ εκείνο', async () => {
    // Μετάλλαξη: η πόρτα καλεί τον γραφέα πριν από τον κριτή ⇒ η συμμετοχή γίνεται `active` χωρίς χώρο.
    belongsTo('comp_law', 'comp_partners');
    const id = await offeredToSellerLawyer();
    expect(await respondToCaseEngagement(db(), sl, id, ACCEPT, NOW)).toEqual({ ok: false, rejection: 'acting-choice-required' });
    expect(await stored(id)).toMatchObject({ state: 'offered' });
    expect(await stored(id)).not.toHaveProperty('actingFor');
    const chosen = { ...ACCEPT, actingRequest: { kind: 'org', companyId: 'comp_partners' } } as const;
    expect((await respondToCaseEngagement(db(), sl, id, chosen, NOW)).ok).toBe(true);
    expect((await stored(id))?.actingFor).toEqual({ kind: 'org', companyId: 'comp_partners' });
  });

  it('Α40 · Α42 — «προσωπικά» ενώ έχει γραφείο, ή ξένο γραφείο ⇒ `acting-refused`, καμία γραφή', async () => {
    belongsTo('comp_law');
    const id = await offeredToSellerLawyer();
    for (const actingRequest of [{ kind: 'personal' }, { kind: 'org', companyId: 'comp_a' }] as const) {
      expect(await respondToCaseEngagement(db(), sl, id, { ...ACCEPT, actingRequest }, NOW)).toEqual({ ok: false, rejection: 'acting-refused' });
    }
    expect(await stored(id)).toMatchObject({ state: 'offered' });
  });

  it('Α43 — «δεν μπόρεσα να ρωτήσω τα γραφεία» ⇒ `unknown` (503), ΠΟΤΕ σιωπηλά προσωπικός χώρος', async () => {
    mockOwnWorkspaces.mockImplementation(async () => ({ outcome: 'unknown', reason: 'query-failed' }));
    const id = await offeredToSellerLawyer();
    const before = await listMyCases(db(), sl, NOW);
    expect(before.ok && before.cards[0]?.acceptance).toEqual({ kind: 'unknown' });
    expect(await respondToCaseEngagement(db(), sl, id, ACCEPT, NOW)).toEqual({ ok: false, rejection: 'unknown' });
    expect(await stored(id)).toMatchObject({ state: 'offered' });
  });

  it('Α44 — δεύτερο «Αναλαμβάνω» (άλλο γραφείο στο μεταξύ) ⇒ 200 χωρίς εγγραφή: ο χώρος ΔΕΝ αλλάζει σιωπηλά', async () => {
    belongsTo('comp_law');
    const id = await offeredToSellerLawyer();
    await respondToCaseEngagement(db(), sl, id, ACCEPT, NOW);
    belongsTo('comp_partners');
    recordChange.mockClear();
    const again = await respondToCaseEngagement(db(), sl, id, ACCEPT, NOW + 1);
    expect(again.ok).toBe(true);
    expect((await stored(id))?.actingFor).toEqual({ kind: 'org', companyId: 'comp_law' });
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('η άρνηση ΔΕΝ ρωτά γραφεία και ΔΕΝ γράφει χώρο', async () => {
    mockOwnWorkspaces.mockClear();
    const id = await offeredToSellerLawyer();
    const outcome = await respondToCaseEngagement(db(), sl, id, { decision: 'decline' }, NOW);
    expect(outcome.ok && outcome.card).toMatchObject({ engagementState: 'declined', acceptance: null, actingFor: null });
    expect(await stored(id)).not.toHaveProperty('actingFor');
  });

  it('το «ανήκει» ρωτιέται με τον χώρο ΤΟΥ ΑΙΤΗΜΑΤΟΣ — η πόρτα δεν τον πετά', async () => {
    // Μετάλλαξη: η υπηρεσία περνά `null` αντί για `actor.active` ⇒ ο χώρος του token δεν μετρά ποτέ ως γραφείο.
    const id = await offeredToSellerLawyer();
    const active = { companyId: 'comp_law', verdict: 'home' } as const;
    mockOwnWorkspaces.mockClear();
    await respondToCaseEngagement(db(), { ...sl, active }, id, ACCEPT, NOW);
    expect(mockOwnWorkspaces).toHaveBeenCalledWith('u_sl', active);
  });
});
