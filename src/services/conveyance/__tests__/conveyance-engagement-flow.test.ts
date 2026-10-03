/**
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

jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') } }));
jest.mock('../conveyance-engagement-notifier', () => ({
  announceEngagementChanged: jest.fn(async () => undefined),
  announceEngagementAnswered: jest.fn(async () => undefined),
}));
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
    const cards = await listMyCases(db(), 'u_sl', NOW);
    expect(cards.ok && cards.cards[0]).toMatchObject({ engagementState: 'offered', summary: null, propertyName: 'Δ3' });
  });

  it('visibleTo — ο δικηγόρος ΠΩΛΗΤΗ δεν βλέπει ΚΑΜΙΑ γραμμή αγοραστή, και το ωμό έγγραφο δεν φεύγει', async () => {
    const record = await openCase();
    await offerCaseEngagement(db(), host, record, { role: 'seller_lawyer', attestedBasis: null, nowMs: NOW });
    const id = await engagementIdOf(record, 'seller_lawyer');
    expect((await respondToCaseEngagement(db(), { uid: 'u_sl', email: null }, id, true, NOW)).ok).toBe(true);
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
    await respondToCaseEngagement(db(), { uid: 'u_bl', email: null }, id, true, NOW);
    const outcome = await getEngagedCaseView(db(), 'u_bl', id, NOW);
    if (!outcome.ok) throw new Error(outcome.rejection);
    expect(outcome.view.checklist.rows.some((row) => row.section === 'seller')).toBe(false);
  });

  it('ξένη συμμετοχή ≡ ανύπαρκτη — άλλος άνθρωπος με την ίδια ταυτότητα παίρνει `not-found`', async () => {
    const record = await openCase();
    await offerCaseEngagement(db(), host, record, { role: 'notary', attestedBasis: 'written_instruction', nowMs: NOW });
    const id = await engagementIdOf(record, 'notary');
    expect(await getEngagedCaseView(db(), 'u_sl', id, NOW)).toEqual({ ok: false, rejection: 'not-found' });
    expect(await respondToCaseEngagement(db(), { uid: 'u_sl', email: null }, id, true, NOW)).toEqual({ ok: false, rejection: 'not-found' });
  });

  it('ζώνη-και-τιράντες — συμμετοχή που δείχνει σε υπόθεση ΑΛΛΟΥ μισθωτή ⇒ `not-found` (ο μισθωτής ξανακρίνεται στο έγγραφο)', async () => {
    const record = await openCase();
    await offerCaseEngagement(db(), host, record, { role: 'seller_lawyer', attestedBasis: null, nowMs: NOW });
    const id = await engagementIdOf(record, 'seller_lawyer');
    await respondToCaseEngagement(db(), { uid: 'u_sl', email: null }, id, true, NOW);
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
    await respondToCaseEngagement(db(), { uid: 'u_sl', email: null }, id, true, NOW);
    expect((await endCaseEngagement(db(), host, record, id, NOW + 1)).ok).toBe(true);
    expect(await getEngagedCaseView(db(), 'u_sl', id, NOW + 2)).toEqual({ ok: false, rejection: 'denied', verdict: 'revoked' });
  });

  it('Procore «Invitation» — χωρίς λογαριασμό ⇒ `needs-invitation`, ποτέ σιωπή', async () => {
    appoint('cont_bl', 'buyer_lawyer', 'nobody@x.gr');
    const record = await openCase();
    expect(await offerCaseEngagement(db(), host, record, { role: 'buyer_lawyer', attestedBasis: 'verbal_instruction', nowMs: NOW }))
      .toEqual({ ok: false, rejection: 'needs-invitation' });
    const slot = (await listCaseProfessionalSlots(db(), record)).find((s) => s.role === 'buyer_lawyer');
    expect(slot?.appointment).toBe('needs-invitation');
  });

  it('κλείσιμο υπόθεσης (ακύρωση) ⇒ η ενεργή συμμετοχή γίνεται `completed` — η κύρια λήξη, χωρίς χειρόγραφο βήμα', async () => {
    const { applyConveyanceCaseCommand } = await import('../conveyance-case.service');
    const record = await openCase();
    await offerCaseEngagement(db(), host, record, { role: 'seller_lawyer', attestedBasis: null, nowMs: NOW });
    const id = await engagementIdOf(record, 'seller_lawyer');
    await respondToCaseEngagement(db(), { uid: 'u_sl', email: null }, id, true, NOW);
    const cancelled = await applyConveyanceCaseCommand(db(), host, record, { expectedVersion: record.version, command: { type: 'cancel', reason: 'ακύρωση' } });
    expect(cancelled.ok).toBe(true);
    expect(await getEngagedCaseView(db(), 'u_sl', id, Date.now())).toEqual({ ok: false, rejection: 'denied', verdict: 'completed' });
  });
});
