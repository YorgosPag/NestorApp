/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΕΠΙΒΕΒΑΙΩΣΗ EMAIL ΤΗΣ ΚΑΡΤΑΣ — ΡΩΤΑ ΤΟΝ ΔΙΣΚΟ** (ADR-841 §7 Α21.18 · Α21.20).
 * @related services/mandate/showcase-email-confirmation.service · showcase-email-confirmation-decision ·
 *   showcase-email-return.service · showcase-card-survival.test.ts (το πρότυπο στησίματος)
 *
 *   • Ε1-Ε4 — έκδοση: μόνο διεύθυνση της κάρτας · ποσόστωση πριν από κάθε εγγραφή · αντικατάσταση
 *   • Ε5-Ε7 — έκδοση σε διεύθυνση που ΕΠΕΣΤΡΕΨΕ: άρνηση · «διόρθωσα» ⇒ καθάρισμα ΠΡΙΝ την αποστολή · βλάβη καθαρίσματος
 *   • Δ1 — 🔴 η ΣΕΛΙΔΑ δεν γράφει τίποτα (σαρωτές αλληλογραφίας)
 *   • Δ2-Δ6 — απόφαση: ένα σήμα σε δύο μισά · διπλό πάτημα · email που έφυγε · άρνηση · λήξη · πλαστός
 *   • Κ1-Κ2 — η κάρτα: ίδια διεύθυνση κρατά το σήμα, αλλαγμένη το χάνει
 *   • Ρ1-Ρ4 — hard bounce: ακύρωση και στα δύο μισά · ιδεμποτένεια · αυτοθεραπεία · άλλη διεύθυνση ανέγγιχτη
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { FakeShelfBucket } from '@/services/upload/__fixtures__/fake-shelf-bucket';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { ShowcaseAuthority } from '@/lib/auth/brokerage-authority';
import type { ClassifiedOccupation } from '@/types/agency-profile';
import type { EmailDeliveryEvent } from '@/types/email-delivery';
import type { VerifiedLocationDeclaration } from '@/lib/agency/showcase-card-form';
import { givenCompanyProfile, LEGAL_NAME_CHOICE } from './showcase-legal-fixture';

const shelf = new FakeShelfBucket();
const privateBucket = new FakeShelfBucket();
const markSources = new FakeFirestore();
const sent: { to: string; textBody: string }[] = [];
const cleared: string[] = [];
const notified: { recipientId: string; eventId: string }[] = [];
const quota = { allowed: true };
const clearance: { outcome: 'cleared' | 'not-listed' | 'failed' } = { outcome: 'cleared' };

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => shelf }),
  getAdminBucket: () => privateBucket,
  getAdminFirestore: () => markSources,
}));
jest.mock('@/services/ai-pipeline/shared/mailgun-sender', () => ({
  sendReplyViaMailgun: async (params: { to: string; textBody: string }) => {
    sent.push(params);
    return { success: true };
  },
  clearMailgunBounce: async (address: string) => {
    cleared.push(address);
    return clearance.outcome;
  },
}));
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: async (request: { recipientId: string; eventId: string }) => {
    notified.push({ recipientId: request.recipientId, eventId: request.eventId });
    return { success: true, dedupeKey: request.eventId, skipped: false };
  },
}));
jest.mock('@/lib/middleware/recipient-quota', () => ({ withinRecipientQuota: async () => quota.allowed }));
// ⚠️ `requireActual` — η βιτρίνα χρειάζεται και το `publicOrigin`· αντικαθίσταται ΜΟΝΟ το `publicUrl`.
jest.mock('@/lib/http/public-origin', () => ({
  ...jest.requireActual<typeof import('@/lib/http/public-origin')>('@/lib/http/public-origin'),
  publicUrl: (path: string) => `https://nestor.test${path}`,
}));

process.env.SHOWCASE_EMAIL_CONFIRMATION_SECRET = '5f0c2b7e9a4d1c3e8b6a2f7d9e1c4b3a5f0c2b7e9a4d1c3e8b6a2f7d9e1c4b3a';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishShowcase } = require('../agency-profile.service') as typeof import('../agency-profile.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saveShowcaseCard, readOwnedShowcaseCard } = require('../showcase-card-custody') as typeof import('../showcase-card-custody');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { issueShowcaseEmailConfirmation } = require('../showcase-email-confirmation.service') as
  typeof import('../showcase-email-confirmation.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readShowcaseEmailConfirmation, decideShowcaseEmailConfirmation } = require('../showcase-email-confirmation-decision') as
  typeof import('../showcase-email-confirmation-decision');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { revokeShowcaseEmailConfirmations } = require('../showcase-email-return.service') as
  typeof import('../showcase-email-return.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { recordEmailDeliveryEvent } = require('@/server/comms/email-delivery/email-delivery-ledger') as
  typeof import('@/server/comms/email-delivery/email-delivery-ledger');

const COMPANY = 'comp_card_email_0001';
const ISSUED = '2026-09-14T08:00:00.000Z';
const CLICKED = '2026-09-14T09:00:00.000Z';
const BOUNCED = '2026-09-20T10:00:00.000Z';

const PAINTER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/painter-fixture',
  label: { el: 'ελαιοχρωματιστής', en: 'painter' },
  iscoCode: '7131',
};

function headquarters(id: string | null, emails: readonly string[] = ['office@vafes.gr']): VerifiedLocationDeclaration {
  return {
    wire: {
      id, role: 'headquarters', label: null, place: { landId: 'land_thessaloniki', buildingId: null },
      street: null, hours: null, phones: [], emails,
    },
    position: { lat: 40.63, lng: 22.94 },
  };
}

interface Given {
  readonly fake: FakeFirestore;
  readonly admin: AdminFirestore;
  readonly locationId: string;
}

async function givenCard(emails: readonly string[] = ['office@vafes.gr']): Promise<Given> {
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
  const saved = await saveShowcaseCard(admin, COMPANY, [headquarters(null, emails)], null);
  if (saved.kind !== 'saved') throw new Error(`fixture: ${saved.kind}`);
  return { fake, admin, locationId: saved.locations[0].id };
}

async function doc(fake: FakeFirestore, collection: string, id: string): Promise<Record<string, unknown> | undefined> {
  const snap = await fake.collection(collection).doc(id).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : undefined;
}

async function publicLocation(fake: FakeFirestore): Promise<Record<string, unknown>> {
  const profile = await doc(fake, COLLECTIONS.AGENCY_PROFILES, COMPANY);
  return (profile?.locations as Record<string, unknown>[])[0];
}

async function requests(fake: FakeFirestore): Promise<Record<string, unknown>[]> {
  const snap = await fake.collection(COLLECTIONS.SHOWCASE_EMAIL_CONFIRMATIONS).where('companyId', '==', COMPANY).get();
  return snap.docs.map((entry) => entry.data() as Record<string, unknown>);
}

/** Ο σύνδεσμος όπως τον διαβάζει ο παραλήπτης — από το **απλό κείμενο** του email. */
function lastToken(): string {
  const match = /\/card-email\/([^\s?]+)/.exec(sent[sent.length - 1]?.textBody ?? '');
  if (match === null) throw new Error('κανένας σύνδεσμος στο email');
  return decodeURIComponent(match[1]);
}

async function issue(given: Given, email = 'Office@Vafes.gr', acknowledgeReturned = false): ReturnType<typeof issueShowcaseEmailConfirmation> {
  return issueShowcaseEmailConfirmation(
    given.admin,
    { companyId: COMPANY, locationId: given.locationId, email, requestedByUid: 'uid_owner', acknowledgeReturned },
    ISSUED,
  );
}

/** Ένα hard bounce, όπως το γράφει το webhook — **από το ίδιο ημερολόγιο**, όχι σπαρμένο με το χέρι. */
async function bounce(given: Given, occurredAt: string, recipient = 'office@vafes.gr'): Promise<void> {
  const event: EmailDeliveryEvent = {
    provider: 'mailgun', providerEventId: `evt-${recipient}-${occurredAt}`, occurredAt, recipient, kind: 'failed',
    evidence: 'mailbox-absent', providerReason: 'bounce', smtpCode: 550, enhancedCode: '5.1.1',
    providerMessageId: null, purpose: null, ref: null,
  };
  await recordEmailDeliveryEvent(given.admin, event, occurredAt);
}

beforeEach(() => {
  shelf.reset();
  privateBucket.reset();
  sent.length = 0;
  cleared.length = 0;
  notified.length = 0;
  quota.allowed = true;
  clearance.outcome = 'cleared';
});

describe('Ε — η έκδοση', () => {
  it('🔑 Ε1 — διεύθυνση της κάρτας ⇒ ένα αίτημα, ένα email στην ΚΑΝΟΝΙΚΟΠΟΙΗΜΕΝΗ διεύθυνση, λήξη 72ω', async () => {
    const given = await givenCard();
    expect(await issue(given)).toEqual({ kind: 'sent', expiresAt: '2026-09-17T08:00:00.000Z' });
    expect(sent.map(({ to }) => to)).toEqual(['office@vafes.gr']);
    expect(await requests(given.fake)).toEqual([expect.objectContaining({ state: 'sent', email: 'office@vafes.gr', locationId: given.locationId })]);
  });

  it('🔴 Ε2 — διεύθυνση ΕΚΤΟΣ κάρτας ⇒ άρνηση, κανένα έγγραφο, κανένα email', async () => {
    const given = await givenCard();
    expect(await issue(given, 'victim@example.com')).toEqual({ kind: 'refused', reason: 'email-not-on-card' });
    expect(await requests(given.fake)).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('🔴 Ε3 — ποσόστωση παραλήπτη ΠΡΙΝ από κάθε εγγραφή', async () => {
    const given = await givenCard();
    quota.allowed = false;
    expect(await issue(given)).toEqual({ kind: 'refused', reason: 'recipient-quota' });
    expect(await requests(given.fake)).toEqual([]);
  });

  it('🔑 Ε4 — νέα αποστολή ⇒ ο παλιός σύνδεσμος απαντά «αντικαταστάθηκε»', async () => {
    const given = await givenCard();
    await issue(given);
    const oldToken = lastToken();
    await issue(given);
    expect(await decideShowcaseEmailConfirmation(given.admin, oldToken, 'confirm', CLICKED)).toEqual({ ok: false, reason: 'superseded' });
    expect(await decideShowcaseEmailConfirmation(given.admin, lastToken(), 'confirm', CLICKED)).toEqual({ ok: true, decision: 'confirm' });
  });

  it('🔴 Ε5 — διεύθυνση που ΕΠΕΣΤΡΕΨΕ, χωρίς «διόρθωσα» ⇒ άρνηση, κανένα αίτημα, κανένα email (όχι σιωπηλό 605)', async () => {
    const given = await givenCard();
    await bounce(given, '2026-09-13T10:00:00.000Z');
    expect(await issue(given)).toEqual({ kind: 'refused', reason: 'mailbox-returned' });
    expect(await requests(given.fake)).toEqual([]);
    expect(sent).toEqual([]);
    expect(cleared).toEqual([]);
  });

  it('🔑 Ε6 — «διόρθωσα» ⇒ η λίστα bounces καθαρίζεται ΠΡΙΝ την αποστολή', async () => {
    const given = await givenCard();
    await bounce(given, '2026-09-13T10:00:00.000Z');
    expect(await issue(given, 'office@vafes.gr', true)).toEqual({ kind: 'sent', expiresAt: '2026-09-17T08:00:00.000Z' });
    expect(cleared).toEqual(['office@vafes.gr']);
    expect(sent.map(({ to }) => to)).toEqual(['office@vafes.gr']);
  });

  it('🔴 Ε7 — το καθάρισμα απέτυχε ⇒ «δεν μάθαμε», κανένα email που θα χανόταν σιωπηλά', async () => {
    const given = await givenCard();
    await bounce(given, '2026-09-13T10:00:00.000Z');
    clearance.outcome = 'failed';
    expect(await issue(given, 'office@vafes.gr', true)).toEqual({ kind: 'failed' });
    expect(sent).toEqual([]);
  });
});

describe('Δ — η απόφαση', () => {
  it('🔴 Δ1 — η ΣΕΛΙΔΑ δεν γράφει: σαρωτής που την ανοίγει δεν αλλάζει τίποτα', async () => {
    const given = await givenCard();
    await issue(given);
    const lookup = await readShowcaseEmailConfirmation(given.admin, lastToken(), CLICKED);
    expect(lookup).toEqual({ ok: true, view: { agencyName: 'ΒΑΦΕΣ ΠΑΓΩΝΗ', email: 'office@vafes.gr', expiresAt: '2026-09-17T08:00:00.000Z' } });
    expect((await requests(given.fake))[0].state).toBe('sent');
    expect((await publicLocation(given.fake)).emailConfirmedAt).toBeNull();
  });

  it('🔑 Δ2 — «Επιβεβαίωση» ⇒ ημερομηνία στο δημόσιο ΚΑΙ στο ιδιωτικό μισό· δεύτερο πάτημα ⇒ already-confirmed', async () => {
    const given = await givenCard();
    await issue(given);
    const token = lastToken();
    expect(await decideShowcaseEmailConfirmation(given.admin, token, 'confirm', CLICKED)).toEqual({ ok: true, decision: 'confirm' });

    expect((await publicLocation(given.fake)).emailConfirmedAt).toBe(CLICKED);
    const channels = await doc(given.fake, COLLECTIONS.SHOWCASE_CARD_CHANNELS, COMPANY);
    expect(JSON.stringify(channels)).toContain(`"emailConfirmations":[{"email":"office@vafes.gr","confirmedAt":"${CLICKED}"}]`);
    expect(await decideShowcaseEmailConfirmation(given.admin, token, 'confirm', CLICKED)).toEqual({ ok: false, reason: 'already-confirmed' });
  });

  it('🔴 Δ3 — η διεύθυνση έφυγε από την κάρτα πριν το πάτημα ⇒ email-changed, ΤΙΠΟΤΑ δεν γράφεται', async () => {
    const given = await givenCard();
    await issue(given);
    await saveShowcaseCard(given.admin, COMPANY, [headquarters(given.locationId, ['sales@vafes.gr'])], null);
    expect(await decideShowcaseEmailConfirmation(given.admin, lastToken(), 'confirm', CLICKED)).toEqual({ ok: false, reason: 'email-changed' });
    expect((await publicLocation(given.fake)).emailConfirmedAt).toBeNull();
  });

  it('🔑 Δ4 — «Δεν το ζήτησα εγώ» σφραγίζει το αίτημα, κανένα σήμα', async () => {
    const given = await givenCard();
    await issue(given);
    const token = lastToken();
    expect(await decideShowcaseEmailConfirmation(given.admin, token, 'disown', CLICKED)).toEqual({ ok: true, decision: 'disown' });
    expect((await requests(given.fake))[0].state).toBe('disowned');
    expect((await publicLocation(given.fake)).emailConfirmedAt).toBeNull();
    expect(await decideShowcaseEmailConfirmation(given.admin, token, 'confirm', CLICKED)).toEqual({ ok: false, reason: 'already-disowned' });
  });

  it('Δ5 — μετά τις 72ω ⇒ expired, στη σελίδα ΚΑΙ στο κουμπί', async () => {
    const given = await givenCard();
    await issue(given);
    const late = '2026-09-17T08:00:00.000Z';
    expect(await readShowcaseEmailConfirmation(given.admin, lastToken(), late)).toEqual({ ok: false, reason: 'expired' });
    expect(await decideShowcaseEmailConfirmation(given.admin, lastToken(), 'confirm', late)).toEqual({ ok: false, reason: 'expired' });
  });

  it('🔴 Δ6 — αλλοιωμένος σύνδεσμος ⇒ link-invalid, χωρίς να αγγίξει τη βάση', async () => {
    const given = await givenCard();
    await issue(given);
    const token = lastToken();
    const forged = `${token.slice(0, -2)}${token.endsWith('A') ? 'B' : 'A'}A`;
    expect(await decideShowcaseEmailConfirmation(given.admin, forged, 'confirm', CLICKED)).toEqual({ ok: false, reason: 'link-invalid' });
  });
});

async function confirmed(emails?: readonly string[]): Promise<Given> {
  const given = await givenCard(emails);
  await issue(given);
  await decideShowcaseEmailConfirmation(given.admin, lastToken(), 'confirm', CLICKED);
  return given;
}

describe('Κ — η κάρτα μετά την επιβεβαίωση', () => {
  it('🔑 Κ1 — αποθήκευση με την ΙΔΙΑ διεύθυνση ⇒ το σήμα μένει', async () => {
    const given = await confirmed();
    await saveShowcaseCard(given.admin, COMPANY, [headquarters(given.locationId, ['OFFICE@vafes.gr '])], 'www.vafes.gr');
    expect((await publicLocation(given.fake)).emailConfirmedAt).toBe(CLICKED);
  });

  it('🔴 Κ2 — αλλαγμένη διεύθυνση ⇒ το σήμα χάνεται στην ίδια συναλλαγή', async () => {
    const given = await confirmed();
    await saveShowcaseCard(given.admin, COMPANY, [headquarters(given.locationId, ['sales@vafes.gr'])], null);
    expect((await publicLocation(given.fake)).emailConfirmedAt).toBeNull();
    expect(JSON.stringify(await doc(given.fake, COLLECTIONS.SHOWCASE_CARD_CHANNELS, COMPANY))).toContain('"emailConfirmations":[]');
  });
});

describe('Ρ — hard bounce: το σήμα ακολουθεί την αλήθεια (Α21.20)', () => {
  const absence = { email: 'office@vafes.gr', evidenceAt: BOUNCED, evidenceEventId: 'evt-bounce-1' };

  it('🔴 Ρ1 — bounce ΜΕΤΑ την επιβεβαίωση ⇒ φεύγει από το δημόσιο ΚΑΙ το ιδιωτικό μισό · ειδοποιείται όποιος τη ζήτησε', async () => {
    const given = await confirmed();

    expect(await revokeShowcaseEmailConfirmations(given.admin, absence)).toEqual({ revoked: 1 });

    expect((await publicLocation(given.fake)).emailConfirmedAt).toBeNull();
    expect(JSON.stringify(await doc(given.fake, COLLECTIONS.SHOWCASE_CARD_CHANNELS, COMPANY))).toContain('"emailConfirmations":[]');
    expect(notified).toEqual([{ recipientId: 'uid_owner', eventId: `card-email-returned:${COMPANY}:${given.locationId}:evt-bounce-1` }]);
  });

  it('🔑 Ρ2 — ο πάροχος ξαναστέλνει ⇒ καμία δεύτερη εγγραφή, καμία δεύτερη ειδοποίηση', async () => {
    const given = await confirmed();
    await revokeShowcaseEmailConfirmations(given.admin, absence);
    const writes = given.fake.writes;

    expect(await revokeShowcaseEmailConfirmations(given.admin, absence)).toEqual({ revoked: 0 });
    expect(given.fake.writes).toBe(writes);
    expect(notified).toHaveLength(1);
  });

  it('🏆 Ρ3 — επιβεβαίωση ΝΕΟΤΕΡΗ από το bounce ⇒ το σήμα μένει (αυτοθεραπεία, καμία κολλημένη σημαία)', async () => {
    const given = await confirmed();
    expect(await revokeShowcaseEmailConfirmations(given.admin, { ...absence, evidenceAt: '2026-09-14T08:30:00.000Z' })).toEqual({ revoked: 0 });
    expect((await publicLocation(given.fake)).emailConfirmedAt).toBe(CLICKED);
    expect(notified).toEqual([]);
  });

  it('Ρ4 — bounce ΑΛΛΗΣ διεύθυνσης ⇒ το σήμα αυτής μένει ανέγγιχτο', async () => {
    const given = await confirmed(['office@vafes.gr', 'sales@vafes.gr']);
    expect(await revokeShowcaseEmailConfirmations(given.admin, { ...absence, email: 'sales@vafes.gr' })).toEqual({ revoked: 0 });
    expect((await publicLocation(given.fake)).emailConfirmedAt).toBe(CLICKED);
  });

  it('🔑 Ρ5 — ο ιδιοκτήτης βλέπει «επέστρεψε» από το ημερολόγιο, χωρίς δεύτερο αντίγραφο στην κάρτα', async () => {
    const given = await confirmed();
    await bounce(given, BOUNCED);
    const read = await readOwnedShowcaseCard(given.admin, COMPANY);
    expect(read).toMatchObject({ kind: 'owned', emailReturns: [{ email: 'office@vafes.gr', returnedAt: BOUNCED }] });
  });
});
