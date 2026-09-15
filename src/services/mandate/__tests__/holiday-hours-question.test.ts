/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΕΡΩΤΗΣΗ ΑΡΓΙΩΝ — ΡΩΤΑ ΤΟΝ ΔΙΣΚΟ** (ADR-841 §7 Α21.21 Φάση Β).
 * @related services/mandate/holiday-hours-question.service · holiday-hours-question-decision ·
 *   showcase-email-confirmation.test.ts (το πρότυπο στησίματος)
 *
 *   • Ε1-Ε5 — έκδοση: μόνο διαχειριστές · ιδεμποτένεια ίδιας μέρας · ΜΙΑ υπενθύμιση · όχι υπενθύμιση αν ρωτήθηκε ήδη
 *     μέσα στο παράθυρο · απαντημένο στη φόρμα ΔΕΝ ρωτιέται
 *   • Δ1 — 🔴 η ΣΕΛΙΔΑ δεν γράφει τίποτα (σαρωτές αλληλογραφίας)
 *   • Δ2-Δ5 — απόφαση: ειδικές μέρες στην κάρτα + σφράγισμα · διπλό πάτημα · η ΦΟΡΜΑ ΚΕΡΔΙΖΕΙ · λήξη · πλαστός
 *
 * ⚠️ **Καμία ωρολογιακή βόμβα**: το ρολόι παγώνει στις 4/12/2026 (μόνο το `Date`) — ο γραφέας της κάρτας κρίνει τον
 * ορίζοντα με το πραγματικό ρολόι, και χωρίς πάγωμα οι ημερομηνίες του fixture θα γίνονταν «περασμένες» το 2027.
 */

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { FakeShelfBucket } from '@/services/upload/__fixtures__/fake-shelf-bucket';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { ShowcaseAuthority } from '@/lib/auth/brokerage-authority';
import type { ClassifiedOccupation } from '@/types/agency-profile';
import type { VerifiedLocationDeclaration } from '@/lib/agency/showcase-card-form';
import type { SpecialDay } from '@/lib/calendar/special-hours';
import type { WeeklyHours } from '@/lib/calendar/weekly-hours';
import { AGENCY_SHOWCASE_CARD_ROUTE } from '@/lib/mandate/mandate-routes';
import { holidayQuestionFactsKey } from '@/types/notification-email-facts';
import { givenCompanyProfile, LEGAL_NAME_CHOICE } from './showcase-legal-fixture';

const shelf = new FakeShelfBucket();
const privateBucket = new FakeShelfBucket();
const markSources = new FakeFirestore();
const notified: { recipientId: string; eventId: string; emailFacts?: unknown }[] = [];

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => shelf }),
  getAdminBucket: () => privateBucket,
  getAdminFirestore: () => markSources,
  // Δ6 — ο επιλυτής του χώρου (`workspaceSegmentFor`) ρωτά πρώτα αν υπάρχει διαχειριστής βάσης.
  isFirebaseAdminAvailable: () => true,
}));
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: async (request: { recipientId: string; eventId: string; emailFacts?: unknown }) => {
    notified.push({ recipientId: request.recipientId, eventId: request.eventId, emailFacts: request.emailFacts });
    return { success: true, dedupeKey: request.eventId, skipped: false };
  },
}));
jest.mock('@/server/notifications/user-notification-settings-store', () => ({
  loadUserNotificationSettingsMany: async () => new Map(),
}));

const TEST_SECRET = '7e3b9c1d5a2f4e6b8c0d1e2f3a4b5c6d7e3b9c1d5a2f4e6b8c0d1e2f3a4b5c6d';
process.env.HOLIDAY_HOURS_QUESTION_SECRET = TEST_SECRET;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishShowcase } = require('../agency-profile.service') as typeof import('../agency-profile.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saveShowcaseCard } = require('../showcase-card-custody') as typeof import('../showcase-card-custody');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { issueDueHolidayQuestions } = require('../holiday-hours-question.service') as
  typeof import('../holiday-hours-question.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readHolidayQuestion, decideHolidayQuestion, holidayQuestionsStillAsking } = require('../holiday-hours-question-decision') as
  typeof import('../holiday-hours-question-decision');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { encodeHolidayQuestionLink } = require('../holiday-hours-question-token') as typeof import('../holiday-hours-question-token');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generateDeterministicHolidayHoursQuestionId } = require('@/services/enterprise-id.service') as
  typeof import('@/services/enterprise-id.service');

const COMPANY = 'comp_holiday_q_0001';
/** 10:00 ώρα Ελλάδας, Παρασκευή 4/12/2026 — 21 ημέρες πριν από τα Χριστούγεννα. */
const ASK = new Date('2026-12-04T08:00:00Z');
const at = (dateKey: string): Date => new Date(`${dateKey}T08:00:00Z`);
const QUESTION_ID = generateDeterministicHolidayHoursQuestionId(COMPANY, '2026-12-25');

const MON_SAT: WeeklyHours = {
  1: [{ opens: '09:00', closes: '17:00' }], 2: [{ opens: '09:00', closes: '17:00' }], 3: [{ opens: '09:00', closes: '17:00' }],
  4: [{ opens: '09:00', closes: '17:00' }], 5: [{ opens: '09:00', closes: '17:00' }], 6: [{ opens: '09:00', closes: '14:00' }], 7: [],
};

const PAINTER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/painter-fixture',
  label: { el: 'ελαιοχρωματιστής', en: 'painter' },
  iscoCode: '7131',
};

function headquarters(id: string | null, specialHours: readonly SpecialDay[] = []): VerifiedLocationDeclaration {
  return {
    wire: {
      id, role: 'headquarters', label: null, place: { landId: 'land_thessaloniki', buildingId: null },
      street: null, hours: MON_SAT, specialHours, phones: [], emails: [],
    },
    position: { lat: 40.63, lng: 22.94 },
  };
}

interface Given {
  readonly fake: FakeFirestore;
  readonly admin: AdminFirestore;
  readonly locationId: string;
}

async function givenCard(specialHours: readonly SpecialDay[] = []): Promise<Given> {
  const fake = new FakeFirestore();
  const admin = fake as unknown as AdminFirestore;
  const authority: ShowcaseAuthority = { kind: 'unregulated', companyId: COMPANY };
  givenCompanyProfile(fake, COMPANY, { businessName: 'ΒΑΦΕΣ ΠΑΓΩΝΗ' });
  const published = await publishShowcase(admin, authority, {
    alias: 'vafes-pagoni', legal: LEGAL_NAME_CHOICE,
    credentials: [{ occupation: PAINTER, registrationNumber: '', registrationChapter: '' }],
    place: null, position: null, coverage: null,
  });
  if (published.kind !== 'published') throw new Error(`fixture: ${published.kind}`);
  const saved = await saveShowcaseCard(admin, COMPANY, [headquarters(null, specialHours)], null);
  if (saved.kind !== 'saved') throw new Error(`fixture: ${saved.kind}`);
  const members = `${COLLECTIONS.COMPANIES}/${COMPANY}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`;
  fake.seed(members, 'uid_admin', { uid: 'uid_admin', status: 'active', globalRole: 'company_admin' });
  fake.seed(members, 'uid_suspended', { uid: 'uid_suspended', status: 'suspended', globalRole: 'company_admin' });
  fake.seed(members, 'uid_staff', { uid: 'uid_staff', status: 'active', globalRole: 'internal_user' });
  return { fake, admin, locationId: saved.locations[0].id };
}

async function storedQuestion(fake: FakeFirestore): Promise<Record<string, unknown> | undefined> {
  const snap = await fake.collection(COLLECTIONS.HOLIDAY_HOURS_QUESTIONS).doc(QUESTION_ID).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : undefined;
}

async function publicSpecialHours(fake: FakeFirestore): Promise<unknown> {
  const snap = await fake.collection(COLLECTIONS.AGENCY_PROFILES).doc(COMPANY).get();
  return ((snap.data() as { locations: { specialHours: unknown }[] }).locations)[0]?.specialHours;
}

async function tokenFor(fake: FakeFirestore, recipientUid = 'uid_admin'): Promise<string> {
  const question = await storedQuestion(fake);
  return encodeHolidayQuestionLink(TEST_SECRET, { id: QUESTION_ID, nonce: String(question?.nonce), recipientUid });
}

beforeAll(() => {
  jest.useFakeTimers({ now: ASK, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  notified.length = 0;
});

describe('Ε — η έκδοση', () => {
  it('Ε1 🔑 ΜΙΑ ερώτηση για την περίοδο, ΜΟΝΟ στον ενεργό διαχειριστή, με γεγονότα για κουμπιά', async () => {
    const { admin, fake } = await givenCard();
    const report = await issueDueHolidayQuestions(admin, ASK);
    expect(report).toMatchObject({ asked: 1, reminded: 0, failed: 0 });
    expect(notified).toEqual([{
      recipientId: 'uid_admin', eventId: `holiday-hours:${QUESTION_ID}:ask`,
      emailFacts: { kind: 'holiday-hours-question', questionId: QUESTION_ID, nonce: (await storedQuestion(fake))?.nonce },
    }]);
    expect(await storedQuestion(fake)).toMatchObject({ state: 'open', seasonKey: '2026-12-25', lastDate: '2027-01-06' });
  });

  it('Ε2 🔴 δεύτερο πέρασμα την ίδια μέρα ⇒ ΚΑΝΕΝΑ δεύτερο email', async () => {
    const { admin } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    const again = await issueDueHolidayQuestions(admin, ASK);
    expect(again).toMatchObject({ asked: 0, reminded: 0 });
    expect(notified).toHaveLength(1);
  });

  it('Ε3 🔑 ΜΙΑ υπενθύμιση στις 7 ημέρες — και ποτέ δεύτερη', async () => {
    const { admin } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    expect(await issueDueHolidayQuestions(admin, at('2026-12-18'))).toMatchObject({ reminded: 1 });
    expect(await issueDueHolidayQuestions(admin, at('2026-12-19'))).toMatchObject({ asked: 0, reminded: 0 });
    expect(notified.map(({ eventId }) => eventId)).toEqual([
      `holiday-hours:${QUESTION_ID}:ask`, `holiday-hours:${QUESTION_ID}:reminder`,
    ]);
  });

  it('Ε4 🔴 ρωτήθηκε ΠΡΩΤΗ φορά μέσα στο παράθυρο ⇒ καμία υπενθύμιση την επομένη', async () => {
    const { admin } = await givenCard();
    await issueDueHolidayQuestions(admin, at('2026-12-20'));
    expect(await issueDueHolidayQuestions(admin, at('2026-12-21'))).toMatchObject({ asked: 0, reminded: 0 });
    expect(notified).toHaveLength(1);
  });

  it('Ε5 🔑 απαντημένο στη ΦΟΡΜΑ ⇒ δεν ρωτιέται (η κάρτα είναι η αλήθεια)', async () => {
    const declared: SpecialDay[] = ['2026-12-25', '2026-12-26', '2027-01-01', '2027-01-06'].map((date) => ({ date, kind: 'closed' }));
    const { admin, fake } = await givenCard(declared);
    expect(await issueDueHolidayQuestions(admin, ASK)).toMatchObject({ asked: 0 });
    expect(await storedQuestion(fake)).toBeUndefined();
  });
});

describe('Δ — η απάντηση', () => {
  it('Δ1 🔴 Η ΣΕΛΙΔΑ ΔΕΝ ΓΡΑΦΕΙ — ούτε η ερώτηση ούτε η κάρτα αλλάζουν', async () => {
    const { admin, fake } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    const before = [await storedQuestion(fake), await publicSpecialHours(fake)];
    const lookup = await readHolidayQuestion(admin, await tokenFor(fake), ASK);
    expect(lookup.ok && lookup.view.rows.map(({ date }) => date)).toEqual(['2026-12-25', '2026-12-26', '2027-01-01', '2027-01-06']);
    expect([await storedQuestion(fake), await publicSpecialHours(fake)]).toEqual(before);
  });

  it('Δ2 🔑 «Κλειστά» σε όλες ⇒ ειδικές μέρες στην κάρτα, ερώτηση σφραγισμένη · δεύτερο πάτημα ⇒ «ήδη απαντημένη»', async () => {
    const { admin, fake, locationId } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    const token = await tokenFor(fake);
    const answers = ['2026-12-25', '2026-12-26', '2027-01-01', '2027-01-06'].map((date) => ({ locationId, date, kind: 'closed' as const }));
    expect(await decideHolidayQuestion(admin, token, answers, ASK)).toMatchObject({ ok: true, remaining: 0 });
    expect(await publicSpecialHours(fake)).toEqual(answers.map(({ date }) => ({ date, kind: 'closed' })));
    expect(await storedQuestion(fake)).toMatchObject({ state: 'answered', answeredByUid: 'uid_admin' });
    expect(await decideHolidayQuestion(admin, token, answers, ASK)).toEqual({ ok: false, reason: 'already-answered' });
  });

  it('Δ3 🔴 Η ΦΟΡΜΑ ΚΕΡΔΙΖΕΙ — μέρα δηλωμένη στο μεταξύ δεν πατιέται από το email', async () => {
    const { admin, fake, locationId } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    const custom: SpecialDay = { date: '2026-12-25', kind: 'custom', intervals: [{ opens: '10:00', closes: '13:00' }] };
    await saveShowcaseCard(admin, COMPANY, [headquarters(locationId, [custom])], null);
    const outcome = await decideHolidayQuestion(admin, await tokenFor(fake), [{ locationId, date: '2026-12-25', kind: 'closed' }], ASK);
    expect(outcome).toMatchObject({ ok: true, remaining: 3, outcomes: [{ outcome: 'already-answered' }] });
    expect(await publicSpecialHours(fake)).toEqual([custom]);
    expect(await storedQuestion(fake)).toMatchObject({ state: 'open' });
  });

  it('Δ4 — μετά την τελευταία αργία της περιόδου ⇒ «έληξε», τίποτα δεν γράφεται', async () => {
    const { admin, fake, locationId } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    const token = await tokenFor(fake);
    expect(await readHolidayQuestion(admin, token, at('2027-01-07'))).toEqual({ ok: false, reason: 'expired' });
    expect(await decideHolidayQuestion(admin, token, [{ locationId, date: '2027-01-06', kind: 'closed' }], at('2027-01-07')))
      .toEqual({ ok: false, reason: 'expired' });
  });

  it('Δ5 🔴 πλαστός σύνδεσμος ή λάθος nonce ⇒ «άκυρος», χωρίς καμία εγγραφή', async () => {
    const { admin, fake, locationId } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    const forged = encodeHolidayQuestionLink('f'.repeat(64), { id: QUESTION_ID, nonce: 'x', recipientUid: 'uid_admin' });
    const wrongNonce = encodeHolidayQuestionLink(TEST_SECRET, { id: QUESTION_ID, nonce: 'not-the-nonce', recipientUid: 'uid_admin' });
    const answers = [{ locationId, date: '2026-12-25', kind: 'closed' as const }];
    expect(await decideHolidayQuestion(admin, forged, answers, ASK)).toEqual({ ok: false, reason: 'link-invalid' });
    expect(await decideHolidayQuestion(admin, wrongNonce, answers, ASK)).toEqual({ ok: false, reason: 'link-invalid' });
    expect(await publicSpecialHours(fake)).toEqual([]);
  });

  it('Δ6 🔑 «Άλλο ωράριο» ⇒ η φόρμα της κάρτας ΣΤΟΝ ΧΩΡΟ ΤΟΥ ΓΡΑΦΕΙΟΥ, μέσα από τη σύνδεση (`?next=`)', async () => {
    const { admin, fake } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    markSources.seed(COLLECTIONS.COMPANIES, COMPANY, { alias: 'vafes-pagoni' });
    const lookup = await readHolidayQuestion(admin, await tokenFor(fake), ASK);
    const formPath = lookup.ok ? lookup.view.cardFormPath : null;
    expect(formPath).not.toBeNull();
    const url = new URL(String(formPath), 'https://nestor.test');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('next')).toBe(`/o/vafes-pagoni${AGENCY_SHOWCASE_CARD_ROUTE}`);
  });

  it('Δ7 🔴 χώρος ΧΩΡΙΣ διεύθυνση ⇒ `cardFormPath: null` — η σελίδα ΔΕΝ προσφέρει κουμπί προς 404, αλλά ρωτά κανονικά', async () => {
    const { admin, fake } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    markSources.seed(COLLECTIONS.COMPANIES, COMPANY, {});
    const lookup = await readHolidayQuestion(admin, await tokenFor(fake), ASK);
    expect(lookup.ok && lookup.view.cardFormPath).toBeNull();
    expect(lookup.ok && lookup.view.rows).toHaveLength(4);
  });
});

const ALL_SEASON = ['2026-12-25', '2026-12-26', '2027-01-01', '2027-01-06'];

describe('Α — η πύλη της αποστολής: «έχει ακόμη νόημα αυτό το email;»', () => {
  async function refOf(fake: FakeFirestore): Promise<{ questionId: string; nonce: string }> {
    return { questionId: QUESTION_ID, nonce: String((await storedQuestion(fake))?.nonce) };
  }

  it('Α1 — ανοιχτή, με μέρες που περιμένουν ⇒ ρωτά ακόμη (διπλό ref ⇒ ΜΙΑ κρίση)', async () => {
    const { admin, fake } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    const ref = await refOf(fake);
    expect(await holidayQuestionsStillAsking(admin, [ref, ref], ASK)).toEqual(new Set([holidayQuestionFactsKey(ref)]));
  });

  it('Α2 🔴 η ΦΟΡΜΑ απάντησε όλες ΜΕΤΑ την έκδοση ⇒ δεν ρωτά — ενώ το έγγραφο μένει `open`', async () => {
    const { admin, fake, locationId } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    const declared: SpecialDay[] = ALL_SEASON.map((date) => ({ date, kind: 'closed' }));
    await saveShowcaseCard(admin, COMPANY, [headquarters(locationId, declared)], null);
    expect(await holidayQuestionsStillAsking(admin, [await refOf(fake)], ASK)).toEqual(new Set());
    expect(await storedQuestion(fake)).toMatchObject({ state: 'open' });
  });

  it('Α3 — παλιό nonce · έληξε · σφραγίστηκε από το κουμπί ⇒ δεν ρωτά', async () => {
    const { admin, fake, locationId } = await givenCard();
    await issueDueHolidayQuestions(admin, ASK);
    const ref = await refOf(fake);
    expect(await holidayQuestionsStillAsking(admin, [{ ...ref, nonce: 'stale' }], ASK)).toEqual(new Set());
    expect(await holidayQuestionsStillAsking(admin, [ref], at('2027-01-07'))).toEqual(new Set());
    const answers = ALL_SEASON.map((date) => ({ locationId, date, kind: 'regular' as const }));
    await decideHolidayQuestion(admin, await tokenFor(fake), answers, ASK);
    expect(await holidayQuestionsStillAsking(admin, [ref], ASK)).toEqual(new Set());
  });
});
