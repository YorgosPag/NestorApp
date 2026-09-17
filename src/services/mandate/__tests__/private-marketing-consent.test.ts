/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Α7-Α8 · Α16-Α20 του ADR-864** — συναίνεση πωλητή για κλειστή διάθεση πάνω στην εντολή.
 * @related ADR-864 §7 · §17 · services/mandate/private-marketing-consent.service.ts · lib/mandate/private-marketing-standing.ts
 *
 * Εκτελούνται οι **πραγματικοί** γραφείς (κοινό · εντολή · υπηρεσία συναίνεσης) πάνω σε ψεύτικη Firestore που
 * **ξαναεκτελεί** συναλλαγές, με το **πραγματικό** παγωμένο κείμενο v1. Μοκάρονται μόνο: ράφια (GCS), παρουσία
 * γραφείου, ίχνος (για να μετρηθεί — Α18), επωνυμία γραφείου, αποστολή email.
 *
 * | # | Άγκυρα | Μετάλλαξη που πρέπει να πιάσει |
 * |---|---|---|
 * | Α7 | εντολή + κοινό ≠ public χωρίς συναίνεση ⇒ `private-marketing-consent-missing` από διακομιστή | κρίση μόνο στη διεπαφή |
 * | Α7α | εντολή σε ήδη κλειστή χωρίς συναίνεση ⇒ ίδια άρνηση | κριτής μόνο στο κοινό |
 * | Α7β | ιδιώτης χωρίς εντολή ⇒ κανένας έλεγχος | απαίτηση σε κάθε στένεμα |
 * | Α8 | η συναίνεση κρατά `{document,version,digest}`· νέα έκδοση ⇒ η παλιά ισχύει | `consented:boolean` · σύγκριση με τελευταία |
 * | Α8α | παλιά έκδοση/τιμές ⇒ `consent-text-superseded` | αποδοχή κάθε έκδοσης |
 * | Α8β | ελλιπείς δηλώσεις ⇒ `consent-incomplete` | αποδοχή μερικής |
 * | Α16 | ανάκληση ⇒ public **ή** withdrawn στην ίδια γραφή | ανάκληση = μόνο γεγονός |
 * | Α17 | νέο γραφείο ή παράταση ⇒ η παλιά συναίνεση δεν ισχύει | συναίνεση στο ακίνητο |
 * | Α18 | κάθε γεγονός αφήνει ίχνος ADR-195 | χωρίς `recordChange` |
 * | Α19 | η παροχή εκτελεί στένεμα ατομικά· μπαγιάτικο αίτημα ⇒ άρνηση | χωρίς έλεγχο ταυτότητας αιτήματος |
 * | Α20 | έντυπο χωρίς έγγραφο ⇒ άρνηση · ειδοποίηση ιδιοκτήτη | attestation χωρίς έγγραφο |
 * | Α23 | έντυπο = `FileRecord` **του γραφείου**, **αυτής** της αγγελίας, **έτοιμο** ⇒ διαδρομή από τη βάση | κριτής χωρίς εταιρεία · χωρίς αγγελία |
 * | Α27 | ιδιοκτήτης προς δύο γραφεία ⇒ μία υποβολή, ένα γεγονός ανά εντολή· μία άρνηση ⇒ τίποτα | παροχή ανά γραφείο · μερική εγγραφή |
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

type ShelfCall = [kind: unknown, subjectId: string, sources: readonly unknown[]];
const EMPTY_REPORT = { outcome: 'reconciled', published: [], removed: 0, rejected: 0 };
const reconcilePublicShelf = jest.fn<Promise<unknown>, ShelfCall>();
const reconcilePublicModelShelf = jest.fn<Promise<unknown>, ShelfCall>();
const recordOwnerPropertyWrite = jest.fn<Promise<void>, [unknown, { extraChanges?: readonly { field: string; newValue: unknown }[] }]>();
const sendMandateInvitation = jest.fn<Promise<unknown>, [unknown, string, unknown]>();

jest.mock('@/services/listings/public-shelf.service', () => ({
  reconcilePublicShelf: (...args: ShelfCall) => reconcilePublicShelf(...args),
}));
jest.mock('@/services/listings/public-shelf-model.service', () => ({
  reconcilePublicModelShelf: (...args: ShelfCall) => reconcilePublicModelShelf(...args),
}));
jest.mock('@/services/mandate/showcase-presence.service', () => ({ refreshShowcasePresence: async () => undefined }));
jest.mock('@/services/owner-property/owner-property-audit', () => ({
  recordOwnerPropertyWrite: (...args: Parameters<typeof recordOwnerPropertyWrite>) => recordOwnerPropertyWrite(...args),
}));
jest.mock('@/services/company/company-public-name.reader', () => ({
  ...jest.requireActual('@/services/company/company-public-name.reader'),
  readCompanyPublicName: async () => 'Άλφα Ακίνητα',
}));
jest.mock('@/services/mandate/mandate-invitation.service', () => ({
  sendMandateInvitation: (...args: Parameters<typeof sendMandateInvitation>) => sendMandateInvitation(...args),
}));

process.env.MANDATE_CONSENT_SECRET ??= 'δοκιμαστικό-μυστικό-κλειστής-διάθεσης';

/* eslint-disable @typescript-eslint/no-require-imports */
const { COLLECTIONS } = require('@/config/firestore-collections') as typeof import('@/config/firestore-collections');
const { FakeFirestore } = require('@/services/places/__tests__/fake-firestore') as typeof import('@/services/places/__tests__/fake-firestore');
const fixtures = require('@/lib/owner-property/__tests__/owner-property-fixtures') as typeof import('@/lib/owner-property/__tests__/owner-property-fixtures');
const writer = require('@/services/owner-property/owner-property-write.service') as typeof import('@/services/owner-property/owner-property-write.service');
const consent = require('../private-marketing-consent.service') as typeof import('../private-marketing-consent.service');
const standingLib = require('@/lib/mandate/private-marketing-standing') as typeof import('@/lib/mandate/private-marketing-standing');
const { consentValuesFor } = require('@/lib/mandate/private-marketing-consent-text') as typeof import('@/lib/mandate/private-marketing-consent-text');
const { latestLegalDocumentVersion } = require('@/lib/legal/legal-document-versions') as typeof import('@/lib/legal/legal-document-versions');
const { clauseIdsOf } = require('@/lib/legal/legal-clauses') as typeof import('@/lib/legal/legal-clauses');
const { ownerPropertyFromDocument } = require('@/lib/owner-property/owner-property-from-document') as typeof import('@/lib/owner-property/owner-property-from-document');
/* eslint-enable @typescript-eslint/no-require-imports */

import type { OwnerProperty } from '@/types/owner-property';
import type { BrokeredListingMandate } from '@/types/owner-property-mandate';
import type { PrivateMarketingEvent, PrivateMarketingGranted } from '@/types/private-marketing-consent';
import type { ConsentSubmission } from '@/lib/mandate/private-marketing-consent-text';

const NOW = '2026-09-16T10:00:00.000Z';
const AGENCY = 'comp_alfa';
const AGENT = { uid: 'agent-1', companyId: AGENCY };
const OWNER = { uid: 'user-1', companyId: null };

const latest = latestLegalDocumentVersion('private-marketing-disclosure');
if (latest.kind !== 'published') throw new Error('private-marketing-disclosure v1 must be frozen');
const DISCLOSURE = latest.version;

type Fake = InstanceType<typeof FakeFirestore>;

function confirmedMandate(over: Partial<BrokeredListingMandate> = {}): BrokeredListingMandate {
  return fixtures.brokeredMandate({ confirmation: 'confirmed', agreement: 'open', consentNonce: 'nonce-live', ...over });
}

function grantFor(mandate: BrokeredListingMandate, over: Partial<PrivateMarketingGranted> = {}): PrivateMarketingGranted {
  return {
    kind: 'granted',
    id: 'pmev_seed_grant',
    at: NOW,
    requestId: null,
    audience: 'custodians',
    text: { document: 'private-marketing-disclosure', version: DISCLOSURE.frozen.version, digest: DISCLOSURE.digest },
    acknowledged: clauseIdsOf(DISCLOSURE.frozen),
    values: consentValuesFor('Άλφα Ακίνητα', mandate.expiresAt),
    locale: 'el',
    channel: 'link',
    actorUserId: null,
    proof: { via: 'owner-consent' },
    term: standingLib.mandateTermOf(mandate),
    ...over,
  };
}

function seeded(mandates: readonly BrokeredListingMandate[], over: Partial<OwnerProperty> = {}): { db: Fake; typed: AdminFirestore; property: OwnerProperty } {
  const property = fixtures.validOwnerProperty({ authorCompanyId: AGENCY, mandates, ...over });
  const db = new FakeFirestore();
  db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
  return { db, typed: db as unknown as AdminFirestore, property };
}

async function stored(db: Fake, id = 'ownp_a'): Promise<OwnerProperty> {
  const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(id).get();
  const property = ownerPropertyFromDocument(snap.data(), id);
  if (property === null) throw new Error('missing');
  return property;
}

const lastEvent = (property: OwnerProperty): PrivateMarketingEvent | undefined =>
  standingLib.privateMarketingEventsOf(property.mandates[0] as BrokeredListingMandate).at(-1);

function submission(mandate: BrokeredListingMandate, over: Partial<ConsentSubmission> = {}): ConsentSubmission {
  return {
    version: DISCLOSURE.frozen.version,
    acknowledged: clauseIdsOf(DISCLOSURE.frozen),
    locale: 'el',
    values: consentValuesFor('Άλφα Ακίνητα', mandate.expiresAt),
    ...over,
  };
}

const request = (id: string): PrivateMarketingEvent => ({ kind: 'requested', id, at: NOW, requestedByUserId: 'agent-1', audience: 'custodians' });

interface LinkOver {
  readonly nonce?: string;
  readonly requestId?: string | null;
  readonly submission?: ConsentSubmission;
}

function linkGrant(mandate: BrokeredListingMandate, over: LinkOver = {}): Parameters<typeof consent.grantPrivateMarketing>[1] {
  return {
    ownerPropertyId: 'ownp_a',
    who: { kind: 'owner-link', nonce: over.nonce ?? 'nonce-live', clientContactId: mandate.clientContactId },
    line: {
      agencyCompanyId: null,
      requestId: over.requestId === undefined ? 'pmev_req_1' : over.requestId,
      submission: over.submission ?? submission(mandate),
    },
    audience: null,
    nowISO: NOW,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  reconcilePublicShelf.mockResolvedValue(EMPTY_REPORT);
  reconcilePublicModelShelf.mockResolvedValue(EMPTY_REPORT);
  recordOwnerPropertyWrite.mockResolvedValue(undefined);
  sendMandateInvitation.mockResolvedValue({ kind: 'sent', to: 'kostas@example.test' });
});

// =============================================================================
// Α7 · Α7α · Α7β — ο διακομιστής κρίνει, σε ΚΑΘΕ γραφέα
// =============================================================================

describe('🏆 Α7 — κλειστή διάθεση με εντολή απαιτεί συναίνεση, κριμένη από τον διακομιστή', () => {
  it('🔑 παρονομαστής: με ενεργή συναίνεση το στένεμα ΓΡΑΦΕΤΑΙ', async () => {
    const mandate = confirmedMandate();
    const { db, typed } = seeded([{ ...mandate, privateMarketing: [grantFor(mandate)] }]);

    const result = await writer.setOwnerPropertyAudience(typed, 'ownp_a', 'custodians', AGENT);

    expect(result.kind).toBe('saved');
    expect((await stored(db)).marketingAudience).toBe('custodians');
  });

  it('🔴 Α7 — χωρίς συναίνεση ⇒ ονομασμένη άρνηση, ΤΙΠΟΤΑ δεν γράφεται', async () => {
    const { db, typed } = seeded([confirmedMandate()]);

    const result = await writer.setOwnerPropertyAudience(typed, 'ownp_a', 'custodians', AGENT);

    expect(result).toEqual({ kind: 'invalid-mandate', violations: ['private-marketing-consent-missing'] });
    expect((await stored(db)).marketingAudience).toBe('public');
  });

  it('🔴 Α7β — ιδιώτης ΧΩΡΙΣ εντολή στενεύει ελεύθερα (αποφασίζει για τον εαυτό του)', async () => {
    const { db, typed } = seeded([], { authorCompanyId: null });

    const result = await writer.setOwnerPropertyAudience(typed, 'ownp_a', 'custodians', OWNER);

    expect(result.kind).toBe('saved');
    expect((await stored(db)).marketingAudience).toBe('custodians');
  });

  it('🔑 η έξοδος μένει ανοιχτή: διεύρυνση σε public περνά ακόμη και σε προϋπάρχουσα παραβίαση', async () => {
    const { typed } = seeded([confirmedMandate()], { marketingAudience: 'custodians' });
    expect((await writer.setOwnerPropertyAudience(typed, 'ownp_a', 'public', AGENT)).kind).toBe('saved');
  });
});

describe('🏆 Α7α — ο γραφέας ΕΝΤΟΛΗΣ ρωτά τον ίδιο κριτή', () => {
  it('🔴 έγκριση εκκρεμούς εντολής πάνω σε ήδη κλειστή καταχώρηση ⇒ άρνηση', async () => {
    const pending = confirmedMandate({ confirmation: 'pending' });
    const { typed } = seeded([pending], { marketingAudience: 'custodians' });

    const result = await writer.setOwnerPropertyMandate(typed, 'ownp_a', { ...pending, confirmation: 'confirmed', decidedAt: NOW });

    expect(result.kind).toBe('invalid-mandate');
    if (result.kind === 'invalid-mandate') expect(result.violations).toContain('private-marketing-consent-missing');
  });

  it('🔑 παρονομαστής: αγγιγμένη εντολή ΧΩΡΙΣ αλλαγή όρων (σφραγίδα «το είδε») γράφεται', async () => {
    const mandate = confirmedMandate();
    const { typed } = seeded([{ ...mandate, privateMarketing: [grantFor(mandate)] }], { marketingAudience: 'custodians' });

    const result = await writer.setOwnerPropertyMandate(typed, 'ownp_a', { ...mandate, privateMarketing: [grantFor(mandate)], viewedAt: NOW });

    expect(result.kind).toBe('saved');
  });
});

// =============================================================================
// Α8 · Α8α · Α8β — ποιο κείμενο, ολόκληρο
// =============================================================================

describe('🏆 Α8 — η συναίνεση κρατά ΕΚΔΟΣΗ, και εκτελεί το στένεμα (Α19)', () => {
  it('🔴 Α8 + Α19 — συναίνεση από σύνδεσμο: {document,version,digest} + στένεμα ΣΤΗΝ ΙΔΙΑ γραφή', async () => {
    const mandate = confirmedMandate({ privateMarketing: [request('pmev_req_1')] });
    const { db, typed } = seeded([mandate]);

    const result = await consent.grantPrivateMarketing(typed, linkGrant(mandate));

    expect(result.kind).toBe('saved');
    const after = await stored(db);
    expect(after.marketingAudience).toBe('custodians');
    const event = lastEvent(after);
    expect(event?.kind).toBe('granted');
    if (event?.kind === 'granted') {
      expect(event.text).toEqual({ document: 'private-marketing-disclosure', version: DISCLOSURE.frozen.version, digest: DISCLOSURE.digest });
      expect(event.acknowledged).toEqual(clauseIdsOf(DISCLOSURE.frozen));
      expect(event.term).toEqual(standingLib.mandateTermOf(mandate));
      expect(event.requestId).toBe('pmev_req_1');
    }
  });

  it('🔴 Α8 — νεότερη έκδοση ΔΕΝ ακυρώνει σιωπηλά την παλιά συναίνεση', () => {
    const mandate = confirmedMandate();
    const older = grantFor(mandate, { text: { document: 'private-marketing-disclosure', version: DISCLOSURE.frozen.version - 1, digest: 'sha256:older' } });
    expect(standingLib.privateMarketingStandingOf({ ...mandate, privateMarketing: [older] }).kind).toBe('granted');
  });

  it('🔴 Α8α — παλιά έκδοση ⇒ `consent-text-superseded`, ΤΙΠΟΤΑ δεν γράφεται', async () => {
    const mandate = confirmedMandate({ privateMarketing: [request('pmev_req_1')] });
    const { db, typed } = seeded([mandate]);

    const result = await consent.grantPrivateMarketing(typed, linkGrant(mandate, { submission: submission(mandate, { version: 0 }) }));

    expect(result).toEqual({ kind: 'refused', reason: 'consent-text-superseded' });
    expect((await stored(db)).marketingAudience).toBe('public');
  });

  it('🔴 Α8α — τιμές θέσεων άλλες από όσες ισχύουν (CAS) ⇒ `consent-text-superseded`', async () => {
    const mandate = confirmedMandate({ privateMarketing: [request('pmev_req_1')] });
    const { typed } = seeded([mandate]);
    const stale = submission(mandate, { values: { agency: 'Άλφα Ακίνητα', expiresOn: '01/01/2020' } });

    expect(await consent.grantPrivateMarketing(typed, linkGrant(mandate, { submission: stale }))).toEqual({ kind: 'refused', reason: 'consent-text-superseded' });
  });

  it('🔴 Α8β — έστω μία δήλωση ανεπιβεβαίωτη ⇒ `consent-incomplete`', async () => {
    const mandate = confirmedMandate({ privateMarketing: [request('pmev_req_1')] });
    const { typed } = seeded([mandate]);
    const partial = submission(mandate, { acknowledged: [...clauseIdsOf(DISCLOSURE.frozen).slice(1), 'unknown-clause'] });

    expect(await consent.grantPrivateMarketing(typed, linkGrant(mandate, { submission: partial }))).toEqual({ kind: 'refused', reason: 'consent-incomplete' });
  });
});

// =============================================================================
// Α16 · Α17 · Α18 · Α19 · Α20
// =============================================================================

describe('🏆 Α16 — η ανάκληση δεν αφήνει ΠΟΤΕ κλειστή διάθεση', () => {
  it.each([
    ['public', 'listed'],
    ['withdrawn', 'withdrawn'],
  ] as const)('🔴 ανάκληση «%s» ⇒ κοινό public, κύκλος ζωής %s, στην ίδια γραφή', async (outcome, lifecycle) => {
    const mandate = confirmedMandate();
    const { db, typed } = seeded([{ ...mandate, privateMarketing: [grantFor(mandate)] }], { marketingAudience: 'custodians' });

    const result = await consent.revokePrivateMarketing(typed, {
      ownerPropertyId: 'ownp_a',
      who: { kind: 'owner-link', nonce: 'nonce-live', clientContactId: mandate.clientContactId },
      agencyCompanyId: null,
      outcome,
      nowISO: NOW,
    });

    expect(result.kind).toBe('saved');
    const after = await stored(db);
    expect(after.marketingAudience).toBe('public');
    expect(after.lifecycle).toBe(lifecycle);
    expect(lastEvent(after)).toMatchObject({ kind: 'revoked', outcome });
  });
});

describe('🏆 Α17 — η συναίνεση δένεται στους ΟΡΟΥΣ της εντολής', () => {
  it('🔴 παράταση λήξης ⇒ `outdated`, όχι `granted`', () => {
    const mandate = confirmedMandate();
    const extended = { ...mandate, expiresAt: '2027-12-01T00:00:00.000Z', privateMarketing: [grantFor(mandate)] };
    expect(standingLib.privateMarketingStandingOf(extended).kind).toBe('outdated');
  });

  it('🔴 παράταση σε κλειστή καταχώρηση μέσω του γραφέα εντολής ⇒ άρνηση', async () => {
    const mandate = { ...confirmedMandate(), privateMarketing: [grantFor(confirmedMandate())] };
    const { typed } = seeded([mandate], { marketingAudience: 'custodians' });

    const result = await writer.setOwnerPropertyMandate(typed, 'ownp_a', { ...mandate, expiresAt: '2027-12-01T00:00:00.000Z' });

    expect(result.kind).toBe('invalid-mandate');
    if (result.kind === 'invalid-mandate') expect(result.violations).toContain('private-marketing-consent-missing');
  });

  it('🔴 συναίνεση προς γραφείο Α ΔΕΝ καλύπτει εντολή γραφείου Β', () => {
    const alfa = confirmedMandate();
    const beta = confirmedMandate({ agencyCompanyId: 'comp_beta', consentNonce: 'nonce-beta' });
    const subject = { marketingAudience: 'custodians' as const, mandates: [{ ...alfa, privateMarketing: [grantFor(alfa)] }, beta] };
    expect(standingLib.privateMarketingViolators(subject, NOW)).toEqual(['comp_beta']);
  });
});

describe('🏆 Α18 — κάθε γεγονός αφήνει ίχνος ADR-195', () => {
  it('🔴 αίτημα · παροχή · ανάκληση ⇒ μία εγγραφή ίχνους η καθεμία, με το γεγονός', async () => {
    const { db, typed } = seeded([confirmedMandate()]);

    const requested = await consent.requestPrivateMarketing(typed, { ownerPropertyId: 'ownp_a', actor: AGENT, audience: 'custodians', nowISO: NOW });
    expect(requested.kind).toBe('requested');
    const afterRequest = await stored(db);
    const live = afterRequest.mandates[0] as BrokeredListingMandate;
    const pending = lastEvent(afterRequest);

    await consent.grantPrivateMarketing(typed, linkGrant(live, { nonce: live.consentNonce ?? '', requestId: pending?.id ?? '' }));
    await consent.revokePrivateMarketing(typed, { ownerPropertyId: 'ownp_a', who: { kind: 'owner-link', nonce: live.consentNonce ?? '', clientContactId: live.clientContactId }, agencyCompanyId: null, outcome: 'public', nowISO: NOW });

    const recorded = recordOwnerPropertyWrite.mock.calls.map(([, context]) => context.extraChanges?.find((c) => c.field === 'privateMarketing')?.newValue);
    expect(recorded).toEqual(['requested', 'granted', 'revoked']);
    expect(sendMandateInvitation).toHaveBeenCalledWith(expect.anything(), 'private-marketing-request', expect.anything());
  });
});

describe('🏆 Α19 — ο σύνδεσμος εκτελεί ΤΟ ΤΡΕΧΟΝ αίτημα', () => {
  it('🔴 νεότερο αίτημα αντικατέστησε το παλιό ⇒ `consent-request-stale`', async () => {
    const mandate = confirmedMandate({ privateMarketing: [request('pmev_req_1'), request('pmev_req_2')] });
    const { db, typed } = seeded([mandate]);

    expect(await consent.grantPrivateMarketing(typed, linkGrant(mandate))).toEqual({ kind: 'refused', reason: 'consent-request-stale' });
    expect((await stored(db)).marketingAudience).toBe('public');
  });

  it('🔴 σύνδεσμος ΧΩΡΙΣ αίτημα δεν στενεύει τίποτα', async () => {
    const mandate = confirmedMandate();
    const { typed } = seeded([mandate]);

    expect(await consent.grantPrivateMarketing(typed, linkGrant(mandate, { requestId: null }))).toEqual({ kind: 'refused', reason: 'consent-request-stale' });
  });
});

describe('🏆 Α20 · Α23 — το έντυπο είναι αρχείο ΤΟΥ ΓΡΑΦΕΙΟΥ για ΑΥΤΗ την αγγελία', () => {
  const STORAGE_PATH = 'companies/comp_alfa/entities/owner_property/ownp_a/domains/legal/categories/contracts/files/file_pm.pdf';
  const readyFile = (over: Record<string, unknown> = {}) => ({
    companyId: AGENCY,
    entityType: 'owner_property',
    entityId: 'ownp_a',
    status: 'ready',
    storagePath: STORAGE_PATH,
    ...over,
  });
  const attest = (mandate: BrokeredListingMandate, documentFileId: string | null): Parameters<typeof consent.grantPrivateMarketing>[1] => ({
    ownerPropertyId: 'ownp_a',
    who: { kind: 'agency', actor: AGENT },
    line: { agencyCompanyId: null, requestId: null, submission: submission(mandate) },
    documentFileId,
    audience: 'custodians',
    nowISO: NOW,
  });

  it('🔴 Α20 — κανένα αρχείο ⇒ `consent-document-missing`, καμία ειδοποίηση', async () => {
    const mandate = confirmedMandate();
    const { db, typed } = seeded([mandate]);

    expect(await consent.grantPrivateMarketing(typed, attest(mandate, '  '))).toEqual({ kind: 'refused', reason: 'consent-document-missing' });
    expect((await stored(db)).marketingAudience).toBe('public');
    expect(sendMandateInvitation).not.toHaveBeenCalled();
  });

  it('🔴 Α20 + Α23 — έτοιμο αρχείο του γραφείου ⇒ διαδρομή ΑΠΟ ΤΗ ΒΑΣΗ, στένεμα, ειδοποίηση αμφισβήτησης', async () => {
    const mandate = confirmedMandate();
    const { db, typed } = seeded([mandate]);
    db.seed(COLLECTIONS.FILES, 'file_pm', readyFile());

    expect((await consent.grantPrivateMarketing(typed, attest(mandate, 'file_pm'))).kind).toBe('saved');
    const event = lastEvent(await stored(db));
    expect(event).toMatchObject({ kind: 'granted', channel: 'form', proof: { via: 'agency-attestation', attestedByUserId: 'agent-1', documentPath: STORAGE_PATH } });
    expect(sendMandateInvitation).toHaveBeenCalledWith(expect.anything(), 'private-marketing-attestation-notice', expect.anything());
  });

  it.each([
    ['ξένης εταιρείας', { companyId: 'comp_beta' }],
    ['άλλης αγγελίας', { entityId: 'ownp_other' }],
    ['άλλου τύπου οντότητας', { entityType: 'property' }],
    ['μη έτοιμο', { status: 'pending' }],
    ['διαγραμμένο', { isDeleted: true }],
  ] as const)('🔴 Α23 — αρχείο %s ⇒ `consent-document-invalid`, ΤΙΠΟΤΑ δεν γράφεται', async (_label, over) => {
    const mandate = confirmedMandate();
    const { db, typed } = seeded([mandate]);
    db.seed(COLLECTIONS.FILES, 'file_pm', readyFile(over));

    expect(await consent.grantPrivateMarketing(typed, attest(mandate, 'file_pm'))).toEqual({ kind: 'refused', reason: 'consent-document-invalid' });
    expect((await stored(db)).marketingAudience).toBe('public');
  });

  it('🔴 Α23 — ανύπαρκτο αρχείο λέγεται ΟΠΩΣ το ξένο (κανένα μαντείο ύπαρξης)', async () => {
    const mandate = confirmedMandate();
    const { typed } = seeded([mandate]);
    expect(await consent.grantPrivateMarketing(typed, attest(mandate, 'file_missing'))).toEqual({ kind: 'refused', reason: 'consent-document-invalid' });
  });
});

// =============================================================================
// Α27 — ο ιδιοκτήτης προς ΟΛΑ τα γραφεία μαζί (§18.4 Δ3)
// =============================================================================

describe('🏆 Α27 — δύο μη αποκλειστικές εντολές: μία υποβολή, ατομικά', () => {
  const BETA = 'comp_beta';
  const twoAgencies = () => {
    const alfa = confirmedMandate();
    const beta = confirmedMandate({ agencyCompanyId: BETA, consentNonce: 'nonce-beta', clientContactId: alfa.clientContactId });
    return { alfa, beta, ...seeded([alfa, beta], { authorCompanyId: null }) };
  };
  const line = (mandate: BrokeredListingMandate, over: Partial<ConsentSubmission> = {}) => ({
    agencyCompanyId: mandate.agencyCompanyId,
    requestId: null,
    submission: submission(mandate, over),
  });
  const accountGrant = (lines: readonly ReturnType<typeof line>[]): Parameters<typeof consent.grantPrivateMarketing>[1] => ({
    ownerPropertyId: 'ownp_a',
    who: { kind: 'owner-account', actor: OWNER },
    lines,
    audience: 'custodians',
    nowISO: NOW,
  });
  const eventsOf = (property: OwnerProperty, agency: string) =>
    standingLib.privateMarketingEventsOf(property.mandates.find((m) => m.agencyCompanyId === agency) as BrokeredListingMandate);

  it('🔑 παρονομαστής: συναίνεση προς ΕΝΑ από τα δύο ⇒ άρνηση (το άλλο μένει παραβάτης), τίποτα δεν γράφεται', async () => {
    const { alfa, db, typed } = twoAgencies();

    const result = await consent.grantPrivateMarketing(typed, accountGrant([line(alfa)]));

    expect(result).toEqual({ kind: 'invalid-mandate', violations: ['private-marketing-consent-missing'] });
    expect(eventsOf(await stored(db), AGENCY)).toEqual([]);
  });

  it('🔴 Α27 — και τα δύο σε μία υποβολή ⇒ στένεμα + ΕΝΑ γεγονός ανά εντολή + ΜΙΑ εγγραφή ίχνους', async () => {
    const { alfa, beta, db, typed } = twoAgencies();

    expect((await consent.grantPrivateMarketing(typed, accountGrant([line(alfa), line(beta)]))).kind).toBe('saved');

    const after = await stored(db);
    expect(after.marketingAudience).toBe('custodians');
    expect(eventsOf(after, AGENCY).map((e) => e.kind)).toEqual(['granted']);
    expect(eventsOf(after, BETA).map((e) => e.kind)).toEqual(['granted']);
    expect(recordOwnerPropertyWrite).toHaveBeenCalledTimes(1);
    expect(recordOwnerPropertyWrite.mock.calls[0]?.[1].extraChanges?.map((c) => c.newValue)).toEqual(['granted', 'granted']);
  });

  it('🔴 Α27 — έστω μία γραμμή άκυρη ⇒ ΤΙΠΟΤΑ δεν γράφεται (ούτε η έγκυρη)', async () => {
    const { alfa, beta, db, typed } = twoAgencies();

    const result = await consent.grantPrivateMarketing(typed, accountGrant([line(alfa), line(beta, { version: 0 })]));

    expect(result).toEqual({ kind: 'refused', reason: 'consent-text-superseded' });
    const after = await stored(db);
    expect(after.marketingAudience).toBe('public');
    expect(eventsOf(after, AGENCY)).toEqual([]);
  });
});

describe('🔑 σύνορο εγγράφου — τα γεγονότα ΠΕΡΝΟΥΝ από το `ownerPropertyFromDocument` (CHECK 3.74)', () => {
  it('η τιμή της συναίνεσης επιβιώνει της ανάγνωσης, αυτούσια', () => {
    const mandate = confirmedMandate();
    const grant = grantFor(mandate);
    const read = ownerPropertyFromDocument(fixtures.validOwnerProperty({ mandates: [{ ...mandate, privateMarketing: [grant] }] }), 'ownp_a');
    expect(read?.mandates[0]?.privateMarketing).toEqual([grant]);
  });
});
