/**
 * ADR-862 Φ1 — άγκυρες της συμμετοχής σε υπόθεση (κριτής · γραφέας · αναγνώστης).
 *
 * Κάθε `it` ονομάζει την άγκυρα του ADR-862 §7 που φυλάει και τη μετάλλαξη που πρέπει να κοκκινίσει.
 * Η βάση είναι το ΕΝΑ verified fake (`test-utils/fake-firestore`) — οι **κανόνες** δοκιμάζονται στον emulator.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { decideEngagement } from '../engagement-judge';
import { selectCurrentEngagement } from '../engagement-read';
import {
  closeEngagementsForSubject,
  offerEngagement,
  planTransition,
  transitionEngagement,
  type EngagementOfferRequest,
} from '../engagement-write';
import type { DeclaredCredential, Engagement, EngagementSubject } from '@/types/engagement';
import { personalWorkspace } from '@/types/workspace-membership';

jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }) }));

const NOW = Date.parse('2026-10-03T10:00:00.000Z');
/** ADR-901 §14.8 — το σήμα όψεων είναι υποχρεωτικό· εδώ καταγράφεται (οι άγκυρες σήματος ζουν στο τέλος). */
const signal = jest.fn();
const DAY = 24 * 60 * 60 * 1000;
const CASE_A: EngagementSubject = { kind: 'conveyance_case', caseId: 'cvc_A' };
const CASE_B: EngagementSubject = { kind: 'conveyance_case', caseId: 'cvc_B' };
const CREDENTIAL: DeclaredCredential = { authority: 'notary-association', number: '4321', chapter: 'Αθηνών', assurance: 'declared', declaredAt: new Date(NOW).toISOString() };

function engagement(overrides: Partial<Engagement> = {}): Engagement {
  return {
    id: 'eng_1', hostCompanyId: 'comp_host', projectId: 'proj_1', uid: 'u_notary', email: 'n@example.gr',
    template: 'legal', role: 'notary', subject: CASE_A, scopes: ['conveyance:case:view'], state: 'active',
    expiresAt: new Date(NOW + 30 * DAY).toISOString(),
    origin: { kind: 'professional_appointment', contactId: 'cont_1' }, consents: [],
    offeredBy: 'u_host', offeredAt: new Date(NOW - DAY).toISOString(), respondedAt: null,
    revokedBy: null, closedAt: null, updatedAt: new Date(NOW - DAY).toISOString(),
    ...overrides,
  };
}

/** ADR-901 §15 — ο χώρος της αποδοχής στις άγκυρες της Φ1: ο προσωπικός του ίδιου (κανένα γραφείο). */
const OWN_SPACE = personalWorkspace('u_notary');

const ask = (e: Engagement | null, subject: EngagementSubject = CASE_A, uid = 'u_notary') =>
  decideEngagement({ engagement: e, uid, subject, scope: 'conveyance:case:view', nowMs: NOW }).verdict;

describe('ADR-862 Φ1 — ο κριτής (`decideEngagement`)', () => {
  it('Α1 — ο συμβολαιογράφος του διαμερίσματος Α ΔΕΝ βλέπει το Β του ίδιου έργου', () => {
    expect(ask(engagement(), CASE_A)).toBe('engaged');
    expect(ask(engagement(), CASE_B)).toBe('not-engaged');
  });

  it('Α1 — η συμμετοχή του Χ δεν ανοίγει τίποτα στον Ψ', () => {
    expect(ask(engagement(), CASE_A, 'u_other')).toBe('not-engaged');
  });

  it('Α3/Α4 — ληγμένη ≠ ανακληθείσα, και η καθεμία με ΔΙΚΟ της όνομα', () => {
    expect(ask(engagement({ expiresAt: new Date(NOW - 1).toISOString() }))).toBe('expired');
    expect(ask(engagement({ revokedAt: new Date(NOW - 1).toISOString() }))).toBe('revoked');
    expect(ask(engagement({ state: 'revoked', revokedAt: new Date(NOW).toISOString() }))).toBe('revoked');
  });

  it('Α3 — η λήξη κρίνεται και ΧΩΡΙΣ εργασία λήξης: ενεργή κατάσταση με περασμένη ημερομηνία ⇒ άρνηση', () => {
    expect(ask(engagement({ state: 'active', expiresAt: new Date(NOW - DAY).toISOString() }))).toBe('expired');
  });

  it('fail-closed — άκυρη ημερομηνία λήξης ⇒ άρνηση με δικό της όνομα, ποτέ «δεν λήγει»', () => {
    expect(ask(engagement({ expiresAt: 'not-a-date' }))).toBe('unreadable-expiry');
  });

  it('Entra — πρόταση ΧΩΡΙΣ αποδοχή ⇒ καμία πρόσβαση', () => {
    expect(ask(engagement({ state: 'offered' }))).toBe('offered');
    expect(ask(engagement({ state: 'declined' }))).toBe('declined');
    expect(ask(engagement({ state: 'completed' }))).toBe('completed');
  });
});

describe('ADR-862 Φ1 — οι μεταβάσεις (`planTransition`, καθαρές)', () => {
  const offered = engagement({ state: 'offered', expiresAt: new Date(NOW + DAY).toISOString() });

  it('αποδέχεται ΜΟΝΟ ο ίδιος — ο οικοδεσπότης δεν «αναλαμβάνει» για λογαριασμό του', () => {
    expect(planTransition(offered, { kind: 'accept', byUid: 'u_host', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW).outcome).toBe('not-allowed');
  });

  it('αποδοχή ⇒ active με ΠΑΡΑΓΟΜΕΝΟ ταβάνι λήξης', () => {
    const planned = planTransition(offered, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW);
    expect(planned.outcome).toBe('changed');
    if (planned.outcome !== 'changed') return;
    expect(planned.after.state).toBe('active');
    expect(Date.parse(planned.after.expiresAt)).toBeGreaterThan(NOW + 300 * DAY);
  });

  it('Α17 (ADR-901 Φ4) — η αποδοχή ΓΡΑΦΕΙ τη δήλωση ιδιότητας στη συμμετοχή· η άρνηση όχι', () => {
    // Μετάλλαξη: ο γραφέας πετά το `declaredCredential` της αποδοχής ⇒ ενεργή συμμετοχή χωρίς δήλωση.
    const planned = planTransition(offered, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW);
    expect(planned.outcome === 'changed' && planned.after.declaredCredential).toEqual(CREDENTIAL);
    const declined = planTransition(offered, { kind: 'decline', byUid: 'u_notary' }, NOW);
    expect(declined.outcome === 'changed' && declined.after.declaredCredential).toBeUndefined();
  });

  it('ληγμένη πρόταση ⇒ `offer-expired` και κατάσταση `expired` — ποτέ σιωπηλή αποδοχή', () => {
    const stale = engagement({ state: 'offered', expiresAt: new Date(NOW - 1).toISOString() });
    const planned = planTransition(stale, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW);
    expect(planned.outcome).toBe('offer-expired');
    const corrupt = engagement({ state: 'offered', expiresAt: 'garbage' });
    expect(planTransition(corrupt, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW).outcome).toBe('offer-expired');
  });

  it('Α4/Α5 — ανάκληση ενεργής ⇒ `revoked` + `revokedAt` (κατάσταση, όχι διαγραφή)· πρόταση ⇒ `withdrawn`', () => {
    const revoked = planTransition(engagement(), { kind: 'end', byUid: 'u_host' }, NOW);
    expect(revoked.outcome === 'changed' && revoked.after.state).toBe('revoked');
    expect(revoked.outcome === 'changed' && revoked.after.revokedAt).toBe(new Date(NOW).toISOString());
    const withdrawn = planTransition(offered, { kind: 'end', byUid: 'u_host' }, NOW);
    expect(withdrawn.outcome === 'changed' && withdrawn.after.state).toBe('withdrawn');
  });

  it('ιδεμποτησία — αποδοχή ήδη ενεργής ⇒ noop', () => {
    expect(planTransition(engagement(), { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW).outcome).toBe('noop');
  });
});

describe('ADR-862 Φ1 — ο γραφέας πάνω σε βάση (fake Firestore)', () => {
  let fake: FakeFirestore;
  const db = (): AdminFirestore => fake as unknown as AdminFirestore;
  const request = (overrides: Partial<EngagementOfferRequest> = {}): EngagementOfferRequest => ({
    hostCompanyId: 'comp_host', projectId: 'proj_1', uid: 'u_notary', email: 'n@example.gr', template: 'legal',
    role: 'notary', subject: CASE_A, origin: { kind: 'professional_appointment', contactId: 'cont_1' },
    consents: [], offeredBy: 'u_host', nowMs: NOW, ...overrides,
  });
  const docs = () => fake.collection('companies/comp_host/projects/proj_1/engagements').get();

  beforeEach(() => { fake = new FakeFirestore(); });

  it('N.7.2 #3 — δεύτερη πρόταση στον ίδιο = ίδιο έγγραφο (καμία δεύτερη εγγραφή)', async () => {
    const first = await offerEngagement(db(), request(), signal);
    const second = await offerEngagement(db(), request(), signal);
    expect(first.outcome).toBe('offered');
    expect(second.outcome).toBe('already-live');
    expect((await docs()).size).toBe(1);
  });

  it('ADR-901 §5.2 — η θέση έχει ΕΝΑΝ: δεύτερος συμβολαιογράφος ⇒ `slot-occupied`', async () => {
    await offerEngagement(db(), request(), signal);
    expect((await offerEngagement(db(), request({ uid: 'u_other' }), signal)).outcome).toBe('slot-occupied');
  });

  it('ο ίδιος άνθρωπος δεν παίρνει δύο θέσεις (δικηγόρος ΚΑΙ συμβολαιογράφος) ⇒ `role-conflict`', async () => {
    await offerEngagement(db(), request(), signal);
    expect((await offerEngagement(db(), request({ role: 'buyer_lawyer' }), signal)).outcome).toBe('role-conflict');
  });

  it('Α1 — ο ίδιος συμβολαιογράφος σε ΔΥΟ υποθέσεις του ίδιου έργου = ΔΥΟ συμμετοχές (γι\' αυτό κλειδί ≠ uid)', async () => {
    await offerEngagement(db(), request(), signal);
    expect((await offerEngagement(db(), request({ subject: CASE_B }), signal)).outcome).toBe('offered');
    expect((await docs()).size).toBe(2);
  });

  it('Α5 — ανάκληση + νέα πρόταση ⇒ η ιστορία ΜΕΝΕΙ (δύο έγγραφα)', async () => {
    const first = await offerEngagement(db(), request(), signal);
    if (first.outcome !== 'offered') throw new Error('setup');
    const key = { hostCompanyId: 'comp_host', projectId: 'proj_1', engagementId: first.engagement.id };
    await transitionEngagement(db(), key, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW, signal);
    await transitionEngagement(db(), key, { kind: 'end', byUid: 'u_host' }, NOW + 1, signal);
    expect((await offerEngagement(db(), request({ nowMs: NOW + 2 }), signal)).outcome).toBe('offered');
    const states = (await docs()).docs.map((d) => d.data().state).sort();
    expect(states).toEqual(['offered', 'revoked']);
  });

  it('κλείσιμο υπόθεσης ⇒ ενεργή `completed`, πρόταση `withdrawn` — ιδεμποτές', async () => {
    const a = await offerEngagement(db(), request(), signal);
    await offerEngagement(db(), request({ uid: 'u_lawyer', role: 'seller_lawyer' }), signal);
    if (a.outcome !== 'offered') throw new Error('setup');
    await transitionEngagement(db(), { hostCompanyId: 'comp_host', projectId: 'proj_1', engagementId: a.engagement.id }, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW, signal);
    const key = { hostCompanyId: 'comp_host', projectId: 'proj_1' };
    expect((await closeEngagementsForSubject(db(), key, CASE_A, 'u_host', NOW, signal)).map((e) => e.state).sort()).toEqual(['completed', 'withdrawn']);
    expect(await closeEngagementsForSubject(db(), key, CASE_A, 'u_host', NOW, signal)).toHaveLength(0);
  });

  it('Α36 (§14.8) — ΚΑΘΕ γραφή σημαίνει τις όψεις με τη λίστα ΜΕΤΑ· κανένα no-op δεν σημαίνει', async () => {
    signal.mockClear();
    const offered = await offerEngagement(db(), request(), signal);
    if (offered.outcome !== 'offered') throw new Error('setup');
    expect(signal).toHaveBeenLastCalledWith(expect.anything(), { live: [offered.engagement], changed: [offered.engagement] });
    await offerEngagement(db(), request(), signal); // already-live ⇒ καμία γραφή ⇒ κανένα σήμα
    expect(signal).toHaveBeenCalledTimes(1);

    const key = { hostCompanyId: 'comp_host', projectId: 'proj_1', engagementId: offered.engagement.id };
    const accepted = await transitionEngagement(db(), key, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW, signal);
    if (accepted.outcome !== 'changed') throw new Error('setup');
    expect(signal).toHaveBeenLastCalledWith(expect.anything(), { live: [accepted.after], changed: [accepted.after] });
    await transitionEngagement(db(), key, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW, signal); // noop
    expect(signal).toHaveBeenCalledTimes(2);

    const ended = await transitionEngagement(db(), key, { kind: 'end', byUid: 'u_host' }, NOW + 1, signal);
    if (ended.outcome !== 'changed') throw new Error('setup');
    // Η ανακληθείσα ΔΕΝ είναι πια ζωντανή — αλλά είναι στις αλλαγμένες (η δική της όψη πρέπει να μάθει την άρνηση).
    expect(signal).toHaveBeenLastCalledWith(expect.anything(), { live: [], changed: [ended.after] });
    await closeEngagementsForSubject(db(), { hostCompanyId: 'comp_host', projectId: 'proj_1' }, CASE_A, 'u_host', NOW, signal);
    expect(signal).toHaveBeenCalledTimes(3);
  });

  it('αναγνώστης — δύο ζωντανές για το ίδιο ζεύγος ⇒ ΔΕΝ διαλέγουμε (fail-closed)', () => {
    const picked = selectCurrentEngagement([engagement({ id: 'eng_1' }), engagement({ id: 'eng_2', state: 'offered' })]);
    expect(picked).toEqual({ engagement: null, ambiguous: true });
  });
});

describe('ADR-862 Φ1 — δομικές άγκυρες (Α2 · Α6)', () => {
  const SRC = join(process.cwd(), 'src');
  const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : files(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
  const rel = (f: string) => relative(process.cwd(), f).replace(/\\/g, '/');
  const all = files(SRC);

  it('Α2 — το μονοπάτι `engagements` χτίζεται ΜΟΝΟ στο `engagement-ref.ts`', () => {
    const builders = all.filter((f) => readFileSync(f, 'utf8').includes('SUBCOLLECTIONS.PROJECT_ENGAGEMENTS')).map(rel);
    expect(builders).toEqual(['src/lib/auth/engagement-ref.ts']);
  });

  it('Α2 — έγγραφο συμμετοχής ΓΡΑΦΕΙ μόνο ο ΕΝΑΣ γραφέας', () => {
    const writers = all
      .filter((f) => /engagementRef\(/.test(readFileSync(f, 'utf8')))
      .map(rel)
      .filter((f) => f !== 'src/lib/auth/engagement-ref.ts');
    expect(writers).toEqual(['src/lib/auth/engagement-write.ts']);
  });

  it('Α6 — ο γραφέας ΔΕΝ αγγίζει claims', () => {
    const source = readFileSync(join(SRC, 'lib/auth/engagement-write.ts'), 'utf8');
    expect(source).not.toMatch(/setCustomUserClaims|set-claims-with-mirror|claims-handler/);
  });
});
