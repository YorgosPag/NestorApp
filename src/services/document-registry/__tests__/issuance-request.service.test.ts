/**
 * @jest-environment node
 *
 * @fileoverview ADR-945 §7.5 — **η πράξη** «αίτημα προσφορών» πάνω στο fake Firestore: ο κριτής υποκειμένου είναι ο ΙΔΙΟΣ
 *   με τη μόνιμη υποχρέωση (ξένο ⇒ `absent`), ο ιδιώτης πράττει **μόνο** στο δικό του βιβλίο, το προσόν παράγεται από τη
 *   βιτρίνα, και η ανάθεση είναι **ατομική** (νικήτρια + «δεν επιλέχθηκε» + αίτημα σε μία συναλλαγή). Όλα συνθετικά.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceRequestBody } from '@/lib/document-validity/issuance-bidding-request';
import { quoteTermsOf, type QuoteTermsBody } from '@/lib/document-validity/issuance-request';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { PublicShowcase, PublicShowcaseLookup } from '@/types/agency-profile';
import { writeIssuanceAction } from '@/services/document-registry/issuance-assignments.server';
import { bidIdOf, issuanceRequestIdOf } from '@/services/document-registry/issuance-request-schema';
import { actOnIssuanceRequest, readIssuanceRequest } from '@/services/document-registry/issuance-request.service';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
}));
jest.mock('@/services/mandate/agency-profile.service', () => ({ lookupAgencyProfile: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EntityAuditService } = require('@/services/entity-audit.service') as { EntityAuditService: { recordChange: jest.Mock } };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { lookupAgencyProfile } = require('@/services/mandate/agency-profile.service') as { lookupAgencyProfile: jest.Mock };

const NOW = new Date('2026-11-18T09:00:00.000Z');
const OWNER_UID = 'user_owner';
const COMPANY = 'comp_alfa';
/** Ο ιδιώτης χωρίς οργανισμό (`companyId: null`, όπως τον δίνει το `listingActorOf`). */
const OWNER = { companyId: null, uid: OWNER_UID, name: 'owner@example.test' };
const PEA = 'energy-certificate' as const;
const TARGET = { propertyId: 'ownp_me', documentKind: PEA } as const;
const OWNER_LEDGER = { userId: OWNER_UID } as const;
const REQUEST_ID = issuanceRequestIdOf(OWNER_LEDGER, 'ownp_me', PEA);
const bidOf = (companyId: string, cycle = 1) => bidIdOf(REQUEST_ID, cycle, { kind: 'workspace', companyId });

/** Βιτρίνα με δηλωμένη άδεια ενεργειακού επιθεωρητή (ΥΠΕΝ) — ή χωρίς καμία άδεια. */
function showcase(companyId: string, licensed = true): PublicShowcaseLookup {
  const licences = licensed
    ? [{ licence: 'energy-inspector', attestation: { state: 'declared', registration: { authorityKind: 'national', authority: 'ypen', number: `ΥΠΕΝ-${companyId}` } } }]
    : [];
  return { outcome: 'found', showcase: { companyId, displayName: `Μηχανικός ${companyId}`, credentials: [], licences } as unknown as PublicShowcase };
}

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const act = (body: IssuanceRequestBody, actor: { readonly companyId: string | null; readonly uid: string; readonly name: string | null } = OWNER) =>
  actOnIssuanceRequest(db(), actor, body, NOW);
const invite = (companyId: string, expectedCycle: number | null = null) =>
  act({ action: 'invite', ...TARGET, professionalCompanyId: companyId, expectedCycle });
const assignments = () => fake.getAllDocs(COLLECTIONS.DOCUMENT_ISSUANCE_ASSIGNMENTS);
const requests = () => fake.getAllDocs(COLLECTIONS.DOCUMENT_ISSUANCE_REQUESTS);

const QUOTE_TERMS: QuoteTermsBody = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31', scope: ['issuance'],
  deliveryBusinessDays: 5, advance: null,
};

/**
 * Φέρνει μια προσφορά στο `quoted` μέσα από τον ΕΝΑ γραφέα — ADR-945 Φ3α: η πρόσκληση του ιδιώτη φτάνει ήδη στο `sent`
 * (κανάλι της πλατφόρμας) και προσφέρει **μέλος του γραφείου βιτρίνας**, με το μέλος που υπογράφει.
 */
async function toQuoted(companyId: string): Promise<void> {
  const bidId = bidOf(companyId);
  const quoted = await writeIssuanceAction(db(), {
    ledger: { kind: 'owned', owner: OWNER_LEDGER, assignmentId: bidId, requestId: REQUEST_ID, cycle: 1 },
    property: { id: 'ownp_me', scope: 'owner-property', name: 'Το σπίτι μου' },
    documentKind: PEA, latestIssuedOn: null, names: {}, nowIso: NOW.toISOString(),
    writer: { kind: 'workspace-member', uid: 'user_pro', companyId, name: null, expectedStage: 'sent' },
    action: { kind: 'quote', terms: quoteTermsOf(QUOTE_TERMS, null), signerUid: 'user_engineer' },
  });
  expect(quoted).toMatchObject({ ok: true, stage: 'quoted' });
  expect(assignments()[bidId]).toMatchObject({ quote: { submission: { by: 'workspace-member', uid: 'user_pro', companyId, signerUid: 'user_engineer' } } });
}

beforeEach(() => {
  fake = new FakeFirestore();
  EntityAuditService.recordChange.mockClear();
  lookupAgencyProfile.mockReset();
  lookupAgencyProfile.mockImplementation(async (_db: unknown, companyId: string) => showcase(companyId));
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_me', { authorUserId: OWNER_UID, authorCompanyId: null, title: 'Το σπίτι μου' });
});

describe('ο κριτής υποκειμένου — ο ΙΔΙΟΣ με τη μόνιμη υποχρέωση', () => {
  it('ξένο προσωπικό · υπό θεματοφυλακή γραφείου · ανύπαρκτο ⇒ `absent`, και ΤΙΠΟΤΑ δεν γράφεται', async () => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_other', { authorUserId: 'user_other', authorCompanyId: null, title: 'Ξένο' });
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_office', { authorUserId: OWNER_UID, authorCompanyId: COMPANY, title: 'Υπό γραφείο' });
    for (const propertyId of ['ownp_other', 'ownp_office', 'ownp_missing']) {
      expect(await act({ action: 'invite', propertyId, documentKind: PEA, professionalCompanyId: 'comp_pro1', expectedCycle: null }))
        .toEqual({ ok: false, refusal: 'absent' });
      expect(await readIssuanceRequest(db(), OWNER, propertyId, PEA, NOW)).toEqual({ ok: false, refusal: 'absent' });
    }
    expect(requests()).toEqual({});
    expect(assignments()).toEqual({});
  });

  it('αποσυρμένο ακίνητο ⇒ `retired`', async () => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_me', { authorUserId: OWNER_UID, authorCompanyId: null, title: 'Το σπίτι μου', status: 'deleted' });
    expect(await invite('comp_pro1')).toEqual({ ok: false, refusal: 'retired' });
  });

  it('Φ1: βιβλίο ΓΡΑΦΕΙΟΥ (θεματοφυλακή γραφείου) ⇒ `office-ledger` — το γραφείο έχει την απευθείας ανάθεση §27', async () => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_office', { authorUserId: 'user_9', authorCompanyId: COMPANY, title: 'Εντολή' });
    const office = { companyId: COMPANY, uid: 'user_1', name: 'agent@example.test' };
    expect(await act({ action: 'invite', propertyId: 'ownp_office', documentKind: PEA, professionalCompanyId: 'comp_pro1', expectedCycle: null }, office))
      .toEqual({ ok: false, refusal: 'office-ledger' });
    expect(requests()).toEqual({});
  });
});

describe('invite — έως 3 βιτρίνες, το προσόν από τη ΒΙΤΡΙΝΑ', () => {
  it('γράφει αίτημα ΚΑΙ προσφορά στο ΠΡΟΣΩΠΙΚΟ βιβλίο, στην ίδια πράξη· ιστορικό στο προσωπικό βιβλίο', async () => {
    expect(await invite('comp_pro1')).toEqual({ ok: true, outcome: 'changed', cycle: 1 });
    expect(requests()[REQUEST_ID]).toMatchObject({
      id: REQUEST_ID, userId: OWNER_UID, propertyId: 'ownp_me', scope: 'owner-property', documentKind: PEA, cycle: 1,
      bids: [{ bidId: bidOf('comp_pro1'), professional: { kind: 'workspace', companyId: 'comp_pro1' }, invitedByUid: OWNER_UID }],
      award: null, closure: null,
    });
    expect(requests()[REQUEST_ID]).not.toHaveProperty('companyId');
    expect(assignments()[bidOf('comp_pro1')]).toMatchObject({
      userId: OWNER_UID, requestId: REQUEST_ID, cycle: 1,
      professional: { kind: 'workspace', companyId: 'comp_pro1' },
      credential: { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-comp_pro1' },
      proposedByUid: OWNER_UID,
    });
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'owner_property', userId: OWNER_UID, performedBy: OWNER_UID }));
  });

  it('ίδια βιτρίνα ξανά ⇒ `unchanged` · κύκλος που δεν είδε ⇒ `stale` · τέταρτη ⇒ `bid-limit`', async () => {
    await invite('comp_pro1');
    expect(await invite('comp_pro1', 1)).toEqual({ ok: true, outcome: 'unchanged', cycle: 1 });
    expect(await invite('comp_pro2', null)).toEqual({ ok: false, refusal: 'stale' });
    await invite('comp_pro2', 1);
    await invite('comp_pro3', 1);
    expect(await invite('comp_pro4', 1)).toEqual({ ok: false, refusal: 'bid-limit' });
    expect(Object.keys(assignments())).toHaveLength(3);
  });

  it('βιτρίνα μη δημόσια ⇒ `professional-unavailable` · χωρίς άδεια ⇒ `unqualified` · βλάβη ανάγνωσης ⇒ `unavailable`', async () => {
    lookupAgencyProfile.mockResolvedValueOnce({ outcome: 'not-published' });
    expect(await invite('comp_ghost')).toEqual({ ok: false, refusal: 'professional-unavailable' });
    lookupAgencyProfile.mockResolvedValueOnce(showcase('comp_plain', false));
    expect(await invite('comp_plain')).toEqual({ ok: false, refusal: 'unqualified' });
    lookupAgencyProfile.mockResolvedValueOnce({ outcome: 'unavailable' });
    expect(await invite('comp_down')).toEqual({ ok: false, refusal: 'unavailable' });
    expect(requests()).toEqual({});
    expect(assignments()).toEqual({});
  });
});

describe('award — ΑΤΟΜΙΚΗ: νικήτρια + «δεν επιλέχθηκε» + αίτημα', () => {
  async function threeBids(): Promise<void> {
    await invite('comp_pro1');
    await invite('comp_pro2', 1);
    await invite('comp_pro3', 1);
    await toQuoted('comp_pro1');
  }
  const stages = (over: Readonly<Record<string, IssuanceStage | null>> = {}) => ({
    [bidOf('comp_pro1')]: 'quoted' as const, [bidOf('comp_pro2')]: 'sent' as const, [bidOf('comp_pro3')]: 'sent' as const, ...over,
  });
  const award = (expectedStages = stages()) =>
    act({ action: 'award', ...TARGET, bidId: bidOf('comp_pro1'), expectedCycle: 1, quoteRevision: 1, expectedStages });

  it('απόφαση `owner-self` στη νικήτρια, `not-awarded` στις άλλες, ανάθεση στο αίτημα — όλα μαζί', async () => {
    await threeBids();
    expect(await award()).toEqual({ ok: true, outcome: 'changed', cycle: 1 });
    expect(assignments()[bidOf('comp_pro1')]).toMatchObject({ decision: { outcome: 'approved', basis: 'owner-self', uid: OWNER_UID } });
    for (const loser of ['comp_pro2', 'comp_pro3']) {
      expect(assignments()[bidOf(loser)]).toMatchObject({ cancellation: { reason: 'not-awarded', byUid: OWNER_UID } });
    }
    expect(requests()[REQUEST_ID]).toMatchObject({ award: { bidId: bidOf('comp_pro1'), byUid: OWNER_UID }, closure: null });
    expect(await award()).toEqual({ ok: true, outcome: 'unchanged', cycle: 1 });
  });

  it('🔑 μία προσφορά άλλαξε από ό,τι είδε ⇒ `stale`, και ΚΑΜΙΑ από τις τρεις δεν γράφτηκε (all-or-nothing)', async () => {
    await threeBids();
    const before = JSON.stringify([assignments(), requests()]);
    expect(await award(stages({ [bidOf('comp_pro3')]: 'proposed' }))).toEqual({ ok: false, refusal: 'stale' });
    expect(JSON.stringify([assignments(), requests()])).toBe(before);
  });

  it('ο άνθρωπος δεν είδε ΟΛΕΣ τις προσφορές του κύκλου ⇒ `stale`', async () => {
    await threeBids();
    const partial = Object.fromEntries(Object.entries(stages()).filter(([bidId]) => bidId !== bidOf('comp_pro3')));
    expect(await award(partial)).toEqual({ ok: false, refusal: 'stale' });
  });

  it('νικήτρια που δεν είναι σε `quoted` ⇒ άρνηση του μειωτή, τίποτα δεν γράφεται', async () => {
    await invite('comp_pro1');
    await invite('comp_pro2', 1);
    const expectedStages = { [bidOf('comp_pro1')]: 'sent' as const, [bidOf('comp_pro2')]: 'sent' as const };
    expect(await act({ action: 'award', ...TARGET, bidId: bidOf('comp_pro1'), expectedCycle: 1, quoteRevision: 1, expectedStages }))
      .toEqual({ ok: false, refusal: 'transition-refused' });
    expect(requests()[REQUEST_ID]).toMatchObject({ award: null });
  });

  it('ακύρωση αιτήματος ⇒ κλείνουν ΟΛΕΣ οι προσφορές (`cancelled`), μαζί με το αίτημα', async () => {
    await threeBids();
    expect(await act({ action: 'cancel', ...TARGET, expectedCycle: 1, expectedStages: stages() })).toEqual({ ok: true, outcome: 'changed', cycle: 1 });
    for (const bid of ['comp_pro1', 'comp_pro2', 'comp_pro3']) {
      expect(assignments()[bidOf(bid)]).toMatchObject({ cancellation: { reason: 'cancelled' } });
    }
    expect(requests()[REQUEST_ID]).toMatchObject({ closure: { kind: 'cancelled', byUid: OWNER_UID } });
  });
});

describe('readIssuanceRequest — ο ΙΔΙΟΣ κριτής με την πράξη', () => {
  it('το αίτημα και οι προσφορές του με το στάδιό τους', async () => {
    await invite('comp_pro1');
    const reading = await readIssuanceRequest(db(), OWNER, 'ownp_me', PEA, NOW);
    expect(reading).toMatchObject({
      ok: true,
      // ADR-945 Φ3α — η πρόσκληση του ιδιώτη ΕΙΝΑΙ η αποστολή (κανάλι της πλατφόρμας).
      view: { request: { cycle: 1 }, bids: [{ bidId: bidOf('comp_pro1'), stage: 'sent' }] },
    });
  });
});
