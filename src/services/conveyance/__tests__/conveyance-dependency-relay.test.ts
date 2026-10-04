/**
 * ADR-905 §6 (Στάδιο 3, CDC) — ο αποδέκτης: σήμα ⇔ η προβολή ΑΥΤΗΣ της όψης άλλαξε.
 *
 * Κόσμος = ο πραγματικός: άνοιγμα υπόθεσης από τον γραφέα της, συμμετοχές μέσω πρότασης + αποδοχής, και μετά
 * γεγονότα όπως θα τα έστελνε ο trigger. Μετράμε `conveyance_view_signals` — όχι κλήσεις.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { DependencyChangeEvent, WireDocument } from '@/lib/conveyance/dependency-change-event';
import type { CaseViewKey } from '@/lib/conveyance/view-signal-key';
import { getConveyanceCaseView, openConveyanceCase, type ConveyanceActor } from '../conveyance-case.service';
import { listCaseProfessionalSlots, offerCaseEngagement } from '../conveyance-engagement-host.service';
import { respondToCaseEngagement } from '../conveyance-engagement-access.service';
import { relayDependencyChange } from '../conveyance-dependency-relay.server';
import { caseDependencyKeys } from '../conveyance-evidence.server';
import { readViewRevision } from '../conveyance-view-signal.server';

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
jest.mock('@/lib/workspace/workspace-administrators', () => ({ activeWorkspaceAdministrators: async () => ['u_host'] }));
const ACCOUNTS: Record<string, string> = { 'seller-lawyer@x.gr': 'u_sl', 'notary@x.gr': 'u_n' };
jest.mock('@/lib/firebaseAdmin', () => ({
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
let fake: FakeFirestore;
const db = () => fake as unknown as Firestore;

type Role = 'seller_lawyer' | 'notary';
const UID: Readonly<Record<Role, string>> = { seller_lawyer: 'u_sl', notary: 'u_n' };
const BASIS: Readonly<Record<Role, 'written_instruction' | null>> = { seller_lawyer: null, notary: 'written_instruction' };
const EMAIL: Readonly<Record<Role, string>> = { seller_lawyer: 'seller-lawyer@x.gr', notary: 'notary@x.gr' };

const PROPERTY = {
  companyId: 'comp_a', name: 'Δ3', type: 'apartment', buildingId: 'bld_1', projectId: 'proj_1',
  commercial: { owners: [{ contactId: 'cont_b' }], legalPhase: 'preliminary_signed' },
};
const PROJECT = { companyId: 'comp_a', linkedCompanyId: 'cont_s', landownerContactIds: [] };

function seedWorld(): void {
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', PROPERTY);
  fake.seed(COLLECTIONS.PROJECTS, 'proj_1', PROJECT);
  for (const role of Object.keys(UID) as Role[]) {
    fake.seed(COLLECTIONS.CONTACT_LINKS, `cl_${role}`, {
      companyId: 'comp_a', sourceContactId: `cont_${role}`, targetEntityType: 'property', targetEntityId: 'prop_1', role, status: 'active',
    });
    fake.seed(COLLECTIONS.CONTACTS, `cont_${role}`, { companyId: 'comp_a', emails: [{ email: EMAIL[role], isPrimary: true }] });
  }
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
  await respondToCaseEngagement(db(), { uid: UID[role], email: null }, slot.engagement.engagementId, ACCEPT, NOW);
  return slot.engagement.engagementId;
}

/** Αρχείο του μισθωτή, στο ακίνητο, έτοιμο — όπως το γράφει το ανέβασμα. */
function propertyFile(extra: Record<string, unknown> = {}): WireDocument {
  return {
    companyId: 'comp_a', entityType: 'property', entityId: 'prop_1', purpose: 'energy_certificate', status: 'ready',
    displayName: 'ΠΕΑ.pdf', revision: 1, updatedAt: '2026-10-03T09:00:00.000Z', createdAt: '2026-10-03T09:00:00.000Z', ...extra,
  } as WireDocument;
}

let seq = 0;
const event = (source: DependencyChangeEvent['source'], docId: string, before: WireDocument | null, after: WireDocument | null): DependencyChangeEvent =>
  ({ eventId: `evt_${++seq}`, source, docId, before, after });

const hostView: CaseViewKey = { kind: 'host', propertyId: 'prop_1', companyId: 'comp_a' };
const engagedView = (engagementId: string, role: Role): CaseViewKey => ({ kind: 'engagement', engagementId, uid: UID[role] });

async function revisions(views: readonly CaseViewKey[]): Promise<number[]> {
  return Promise.all(views.map((view) => readViewRevision(db(), view)));
}

/** Πόσο ανέβηκε η αναθεώρηση κάθε όψης κατά τη διάρκεια του `act`. */
async function deltas(views: readonly CaseViewKey[], act: () => Promise<unknown>): Promise<number[]> {
  const before = await revisions(views);
  await act();
  const after = await revisions(views);
  return after.map((value, i) => value - before[i]);
}

beforeEach(() => {
  fake = new FakeFirestore();
  seedWorld();
  jest.clearAllMocks();
});

describe('ADR-905 §6 — ευρετήριο εξαρτήσεων', () => {
  it('το άνοιγμα γράφει τα κλειδιά — παράγωγο του subject/parties, στο λεξιλόγιο του linkedTo', async () => {
    const record = await openCase();
    const stored = fake.getData(COLLECTIONS.CONVEYANCE_CASES, record.id);
    expect(stored?.dependencyKeys).toEqual(caseDependencyKeys(record.subject, record.parties));
    expect(stored?.dependencyKeys).toEqual(expect.arrayContaining(['property:prop_1', 'project:proj_1', 'building:bld_1', 'contact:cont_b', 'contact:cont_s']));
  });

  it('read-repair: υπόθεση χωρίς κλειδιά τα αποκτά στην ανάγνωση της όψης', async () => {
    const record = await openCase();
    const { dependencyKeys: _dropped, ...legacy } = fake.getData(COLLECTIONS.CONVEYANCE_CASES, record.id) ?? {};
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, record.id, legacy);
    await getConveyanceCaseView(db(), host, 'prop_1');
    expect(fake.getData(COLLECTIONS.CONVEYANCE_CASES, record.id)?.dependencyKeys).toEqual(caseDependencyKeys(record.subject, record.parties));
  });
});

describe('ADR-905 §6 — αρχείο: σήμα ⇔ η προβολή της όψης άλλαξε', () => {
  it('νέο κοινόχρηστο αρχείο ακινήτου ⇒ οικοδεσπότης ΚΑΙ όποιος επαγγελματίας το φτάνει', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    const views = [hostView, engagedView(notary, 'notary')];
    expect(await deltas(views, () => relayDependencyChange(db(), event('file', 'file_1', null, propertyFile()), NOW))).toEqual([1, 1]);
  });

  it('WIP αρχείο ⇒ ΜΟΝΟ ο οικοδεσπότης (ο επαγγελματίας δεν μαθαίνει ούτε πότε)', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    const views = [hostView, engagedView(notary, 'notary')];
    const wip = propertyFile({ cdeState: 'WIP' });
    expect(await deltas(views, () => relayDependencyChange(db(), event('file', 'file_1', null, wip), NOW))).toEqual([1, 0]);
  });

  it('κοινόχρηστο → WIP ⇒ σήμα και στον επαγγελματία που το ΕΧΑΣΕ (χρειάζεται το «πριν»)', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    const views = [hostView, engagedView(notary, 'notary')];
    const change = event('file', 'file_1', propertyFile(), propertyFile({ cdeState: 'WIP' }));
    expect(await deltas(views, () => relayDependencyChange(db(), change, NOW))).toEqual([0, 1]);
  });

  it('εγγραφή που δεν αλλάζει τίποτα ορατό (μικρογραφία) ⇒ ΚΑΝΕΝΑ σήμα', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    const views = [hostView, engagedView(notary, 'notary')];
    const change = event('file', 'file_1', propertyFile(), propertyFile({ thumbnailUrl: 'https://x/t.png' }));
    expect(await deltas(views, () => relayDependencyChange(db(), change, NOW))).toEqual([0, 0]);
  });

  it('αρχείο ΣΥΝΔΕΔΕΜΕΝΟ στο ακίνητο (linkedTo) ⇒ σήμα, όπως το δείχνει ο συλλέκτης', async () => {
    await openCase();
    const linked = propertyFile({ entityType: 'contact', entityId: 'cont_unrelated', linkedTo: ['property:prop_1'] });
    expect(await deltas([hostView], () => relayDependencyChange(db(), event('file', 'file_2', null, linked), NOW))).toEqual([1]);
  });

  it('αρχείο άσχετης οντότητας ⇒ καμία υπόθεση, κανένα σήμα', async () => {
    await openCase();
    const other = propertyFile({ entityId: 'prop_other' });
    const outcome = await relayDependencyChange(db(), event('file', 'file_3', null, other), NOW);
    expect(outcome).toEqual({ cases: 0, signalled: 0 });
  });

  it('αρχείο ΑΛΛΟΥ μισθωτή με ίδια ετικέτα ⇒ καμία υπόθεση (το ερώτημα είναι ανά μισθωτή)', async () => {
    await openCase();
    const foreign = propertyFile({ companyId: 'comp_b' });
    expect(await relayDependencyChange(db(), event('file', 'file_4', null, foreign), NOW)).toEqual({ cases: 0, signalled: 0 });
  });

  it('αρχείο που ΦΕΥΓΕΙ σε άλλο μισθωτή ⇒ εξαφανίζεται από την όψη ⇒ σήμα (η προβολή κρίνει και τον μισθωτή)', async () => {
    await openCase();
    const moved = event('file', 'file_5', propertyFile(), propertyFile({ companyId: 'comp_b' }));
    expect(await deltas([hostView], () => relayDependencyChange(db(), moved, NOW))).toEqual([1]);
  });

  it('διαγραφή αρχείου (μόνο «πριν») ⇒ σήμα σε όσους το έβλεπαν', async () => {
    const record = await openCase();
    const notary = await engage(record, 'notary');
    const views = [hostView, engagedView(notary, 'notary')];
    expect(await deltas(views, () => relayDependencyChange(db(), event('file', 'file_1', propertyFile(), null), NOW))).toEqual([1, 1]);
  });
});

describe('ADR-905 §6 — ακίνητο / έργο: σήμα ⇔ άλλαξε ό,τι βλέπει η υπόθεση', () => {
  it('αλλαγή νομικής φάσης ⇒ όλες οι όψεις', async () => {
    const record = await openCase();
    const sellerLawyer = await engage(record, 'seller_lawyer');
    const views = [hostView, engagedView(sellerLawyer, 'seller_lawyer')];
    const after = { ...PROPERTY, commercial: { ...PROPERTY.commercial, legalPhase: 'contract_signed' } };
    expect(await deltas(views, () => relayDependencyChange(db(), event('property', 'prop_1', PROPERTY, after), NOW))).toEqual([1, 1]);
  });

  it('άσχετο πεδίο ακινήτου (τιμή) ⇒ κανένα σήμα', async () => {
    await openCase();
    const after = { ...PROPERTY, commercial: { ...PROPERTY.commercial, askingPrice: 250000 } };
    expect(await deltas([hostView], () => relayDependencyChange(db(), event('property', 'prop_1', PROPERTY, after), NOW))).toEqual([0]);
  });

  it('οικοπεδούχοι στο έργο (πηγή γεγονότος) ⇒ όλες οι όψεις · άσχετο πεδίο έργου ⇒ καμία', async () => {
    await openCase();
    const withLandowners = { ...PROJECT, landownerContactIds: ['cont_l1'] };
    expect(await deltas([hostView], () => relayDependencyChange(db(), event('project', 'proj_1', PROJECT, withLandowners), NOW))).toEqual([1]);
    const renamed = { ...PROJECT, name: 'Νέο όνομα' };
    expect(await deltas([hostView], () => relayDependencyChange(db(), event('project', 'proj_1', PROJECT, renamed), NOW))).toEqual([0]);
  });
});
