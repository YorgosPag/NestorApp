/**
 * @jest-environment node
 *
 * **Η σχέση προμήθειας από άκρη σε άκρη** (ADR-923 §5.12 Σ1–Σ7), πάνω στο επαληθευμένο ψεύτικο Firestore: πραγματικό token
 * από την πραγματική έκδοση, πραγματική εξαργύρωση, πραγματικός θεατής τιμής. Κάθε άρνηση ελέγχει και τι **δεν** γράφτηκε.
 */

jest.mock('server-only', () => ({}));

const mockOwnWorkspaces = jest.fn(async (_uid: string, _active: unknown): Promise<unknown> => ({ outcome: 'ok', reachable: [], belonging: ['comp-buyer'] }));
jest.mock('@/lib/auth/workspace-membership', () => ({
  ...jest.requireActual('@/lib/auth/workspace-membership'),
  listOwnWorkspaces: (uid: string, active: unknown) => mockOwnWorkspaces(uid, active),
}));

const fake = new (jest.requireActual('@/test-utils/fake-firestore/fake-firestore').FakeFirestore)();
const recordTrackedEntityWrite = jest.fn(async (_input: { entityType: string; ledger: { companyId: string } }) => undefined);

const dispatchNotification = jest.fn(async (_input: Record<string, unknown>) => ({ success: true }));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => fake }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (input: Record<string, unknown>) => dispatchNotification(input),
}));
jest.mock('@/services/entity-audit-tracked-write', () => ({
  recordTrackedEntityWrite: (input: { entityType: string; ledger: { companyId: string } }) => recordTrackedEntityWrite(input),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createCustomerAssignment } from '@/server/catalog/customer-assignment-writer.server';
import { expectedDestinationOf } from '@/server/notifications/notification-destination-rules';
import { quoteCatalogPrice } from '@/server/catalog/price-quote.server';
import { createPricingGroup } from '@/server/catalog/pricing-group-writer.server';
import { ARIES, RIVAL, rejectionOf } from '@/server/catalog/__tests__/catalog-writer-seed';
import { seedPricedProducts } from '@/server/catalog/__tests__/catalog-pricing-seed';
import { SIMPLE_VARIANT_ID } from '@/subapps/catalog/__tests__/fixtures/mfp-price-list.fixture';
import { audienceCovers } from '@/subapps/catalog/pricing/price-audience';
import type { PricingPartyRef } from '@/subapps/catalog/types/price-list';
import type { SupplyRelationship } from '@/subapps/catalog/types/supply-relationship';

import { issueSupplyInvitation, revokeSupplyInvitation } from '../supply-invitation-issue.server';
import { previewSupplyInvitation, respondToSupplyInvitation, type SupplyInvitationResponse } from '../supply-invitation-redeem.server';
import { supplyRelationshipId } from '../supply-relationship-store.server';
import { approveSupplyRequest, declineSupplyRequest, endSupplyRelationship } from '../supply-relationship-writer.server';
import { previewSupplyRequestLink, publishSupplyRequestLink, requestSupplyAccess, revokeSupplyRequestLink } from '../supply-request-link.server';
import { readBuyerSupplyView, readSupplierSupplyView } from '../supply-views.server';
/* eslint-enable import/first */

process.env.SUPPLY_INVITE_SECRET ??= 'δοκιμαστικό-μυστικό-πρόσκλησης-προμήθειας';
process.env.SUPPLY_REQUEST_LINK_SECRET ??= 'δοκιμαστικό-μυστικό-συνδέσμου-προμήθειας';

const db = () => fake as unknown as Firestore;
const BUYER_ID = 'comp-buyer';
const BUYER = { ...ARIES, uid: 'u_buyer', companyId: BUYER_ID };
const CONTACT = 'cont_buyer';
const EMAIL = 'orders@buyer.gr';
const WORKSPACE_PARTY: PricingPartyRef = { kind: 'workspace', companyId: BUYER_ID };
const identity = (overrides: Record<string, unknown> = {}) => ({ uid: 'u_buyer', email: EMAIL, emailVerified: true, secondFactorEnrolled: false, ...overrides });
const acting = (overrides: Partial<SupplyInvitationResponse['acting']> = {}) => ({ uid: 'u_buyer', active: null, requested: null, ...overrides });

const relationshipDoc = () => fake.getData(COLLECTIONS.SUPPLY_RELATIONSHIPS, supplyRelationshipId({ supplierCompanyId: ARIES.companyId, buyerCompanyId: BUYER_ID })) as SupplyRelationship | undefined;
const accept = (token: string, overrides: Partial<SupplyInvitationResponse> = {}) =>
  respondToSupplyInvitation(db(), { action: 'accept', token, identity: identity(), acting: acting(), ...overrides } as SupplyInvitationResponse);
const invite = (customerGroupId: string | null = null, contactId = CONTACT) => issueSupplyInvitation(ARIES, { contactId, customerGroupId });
const quote = (party: PricingPartyRef) => quoteCatalogPrice(ARIES, {
  viewAs: { kind: 'partner', party }, subject: { kind: 'variant', variantId: SIMPLE_VARIANT_ID }, quantity: 1, at: null, priceListId: null,
});

/** Ενεργή σχέση με ΑΛΛΟΝ αγοραστή, που κρατά την ίδια επαφή. */
const activeWithOther = () => ({
  id: 'srel_other', companyId: ARIES.companyId, buyerCompanyId: 'comp-other', state: 'active', origin: 'invitation', supplierContactId: CONTACT,
  customerRef: null, requestCount: 0, requestedByUid: null, requestedAt: null, acceptedByUid: 'u', acceptedAt: 'x', approvedByUid: null, approvedAt: null,
  endedBySide: null, endedByUid: null, endedAt: null, revision: 1, createdAt: 'x', updatedAt: 'x', updatedBy: 'u',
});

async function connected(): Promise<SupplyRelationship> {
  const { token } = await invite();
  await accept(token);
  return relationshipDoc() as SupplyRelationship;
}

async function requested(customerRef: string | null = 'R-77'): Promise<{ readonly token: string; readonly relationship: SupplyRelationship }> {
  const view = await publishSupplyRequestLink(ARIES);
  await requestSupplyAccess(db(), { token: view.token as string, customerRef, acting: acting() });
  return { token: view.token as string, relationship: relationshipDoc() as SupplyRelationship };
}

beforeEach(() => {
  fake.reset();
  recordTrackedEntityWrite.mockClear();
  dispatchNotification.mockClear();
  mockOwnWorkspaces.mockImplementation(async () => ({ outcome: 'ok', reachable: [], belonging: [BUYER_ID] }));
  fake.seed(COLLECTIONS.COMPANIES, ARIES.companyId, { name: 'Aries' });
  fake.seed(COLLECTIONS.COMPANIES, BUYER_ID, { name: 'Γραφείο Αγοραστή' });
  fake.seed(COLLECTIONS.CONTACTS, CONTACT, { id: CONTACT, companyId: ARIES.companyId, emails: [{ email: EMAIL, isPrimary: true }], displayName: 'Αγοραστής ΑΕ' });
});

describe('πόρτα α: πρόσκληση από επαφή', () => {
  it('η αποδοχή γεννά ενεργή σχέση, δεμένη στην επαφή, με ίχνος στα ΔΥΟ βιβλία', async () => {
    const relationship = await connected();
    expect(relationship).toMatchObject({ companyId: ARIES.companyId, buyerCompanyId: BUYER_ID, state: 'active', supplierContactId: CONTACT, acceptedByUid: 'u_buyer', revision: 1 });
    const ledgers = recordTrackedEntityWrite.mock.calls.map(([input]) => input.ledger.companyId).sort();
    expect(ledgers).toEqual([ARIES.companyId, BUYER_ID].sort());
  });

  it('🔑 η προέγκριση γράφεται στην ΕΚΔΟΣΗ: η αποδοχή του ξένου χώρου δεν αγγίζει κατάλογο', async () => {
    const group = await createPricingGroup(ARIES, 'customerGroup', { code: 'wholesale', labels: { el: 'Χονδρική' } });
    const { token } = await invite(group.id);
    const assignmentsAfterIssue = fake.getAllDocs(COLLECTIONS.CATALOG_CUSTOMER_ASSIGNMENTS);
    expect(Object.values(assignmentsAfterIssue)).toEqual([expect.objectContaining({ party: { kind: 'contact', contactId: CONTACT }, customerGroupId: group.id, companyId: ARIES.companyId })]);
    await accept(token);
    expect(fake.getAllDocs(COLLECTIONS.CATALOG_CUSTOMER_ASSIGNMENTS)).toEqual(assignmentsAfterIssue);
  });

  it('🔴 άλλο email ⇒ `wrong-recipient`, καμία σχέση', async () => {
    const { token } = await invite();
    expect(await accept(token, { identity: identity({ email: 'other@x.gr' }) })).toEqual({ kind: 'refused', reason: 'wrong-recipient' });
    expect(relationshipDoc()).toBeUndefined();
  });

  it('Σ3: χωρίς γραφείο ⇒ `office-required`, η πρόσκληση μένει ζωντανή', async () => {
    mockOwnWorkspaces.mockImplementation(async () => ({ outcome: 'ok', reachable: [], belonging: [] }));
    const { token, invitation } = await invite();
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'office-required' });
    expect(relationshipDoc()).toBeUndefined();
    expect(fake.getData(COLLECTIONS.SUPPLY_INVITATIONS, invitation.id)).toMatchObject({ state: 'pending' });
  });

  it('Σ3: 2+ γραφεία χωρίς επιλογή ⇒ ρωτά, ζητημένο ξένο γραφείο ⇒ αρνείται', async () => {
    mockOwnWorkspaces.mockImplementation(async () => ({ outcome: 'ok', reachable: [], belonging: [BUYER_ID, 'comp-other'] }));
    const { token } = await invite();
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'office-choice-required' });
    expect(await accept(token, { acting: acting({ requested: { kind: 'org', companyId: 'comp-foreign' } }) })).toEqual({ kind: 'refused', reason: 'office-refused' });
    expect(relationshipDoc()).toBeUndefined();
  });

  it('«δεν μπόρεσα να ρωτήσω τα γραφεία» ⇒ `unavailable`, ποτέ άρνηση', async () => {
    mockOwnWorkspaces.mockImplementation(async () => ({ outcome: 'unknown' }));
    const { token } = await invite();
    expect(await accept(token)).toEqual({ kind: 'unavailable', reason: 'offices-unknown' });
  });

  it('ο προμηθευτής δεν γίνεται αγοραστής του εαυτού του', async () => {
    mockOwnWorkspaces.mockImplementation(async () => ({ outcome: 'ok', reachable: [], belonging: [ARIES.companyId] }));
    const { token } = await invite();
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'same-workspace' });
  });

  it('δεύτερη αποδοχή ⇒ `already-used`, ένα ίχνος', async () => {
    const { token } = await invite();
    await accept(token);
    const traces = recordTrackedEntityWrite.mock.calls.length;
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'already-used' });
    expect(recordTrackedEntityWrite.mock.calls).toHaveLength(traces);
  });

  it('η άρνηση κλείνει την πρόσκληση χωρίς σχέση, χωρίς να ρωτήσει για γραφείο', async () => {
    mockOwnWorkspaces.mockClear();
    const { token, invitation } = await invite();
    const outcome = await accept(token, { action: 'decline' });
    expect(outcome.kind).toBe('declined');
    expect(mockOwnWorkspaces).not.toHaveBeenCalled();
    expect(relationshipDoc()).toBeUndefined();
    expect(fake.getData(COLLECTIONS.SUPPLY_INVITATIONS, invitation.id)).toMatchObject({ state: 'declined' });
  });

  it('νέα πρόσκληση της ίδιας επαφής ανακαλεί την παλιά', async () => {
    const first = await invite();
    await invite();
    expect(await accept(first.token)).toEqual({ kind: 'refused', reason: 'revoked' });
  });

  it('επαφή χωρίς email · ξένη επαφή ⇒ ονομασμένα ευρήματα, καμία πρόσκληση', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'cont_mute', { id: 'cont_mute', companyId: ARIES.companyId, emails: [] });
    fake.seed(COLLECTIONS.CONTACTS, 'cont_rival', { id: 'cont_rival', companyId: RIVAL.companyId, emails: [{ email: EMAIL, isPrimary: true }] });
    expect((await rejectionOf(invite(null, 'cont_mute'))).issues).toEqual([expect.objectContaining({ code: 'contactWithoutEmail' })]);
    expect((await rejectionOf(invite(null, 'cont_rival'))).issues).toEqual([expect.objectContaining({ code: 'unknownParty' })]);
    expect(fake.getAllDocs(COLLECTIONS.SUPPLY_INVITATIONS)).toEqual({});
  });

  it('🔴 μία επαφή ⇒ ένας αγοραστής: η έκδοση σε δεμένη επαφή αρνείται', async () => {
    await connected();
    expect((await rejectionOf(invite())).issues).toEqual([expect.objectContaining({ code: 'contactAlreadyBound' })]);
  });

  it('🔴 επαφή που δέθηκε αλλού ανάμεσα σε έκδοση και αποδοχή ⇒ `contact-bound`, η πρόσκληση μένει ζωντανή', async () => {
    const { token, invitation } = await invite();
    fake.seed(COLLECTIONS.SUPPLY_RELATIONSHIPS, 'srel_other', activeWithOther());
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'contact-bound' });
    expect(relationshipDoc()).toBeUndefined();
    expect(fake.getData(COLLECTIONS.SUPPLY_INVITATIONS, invitation.id)).toMatchObject({ state: 'pending' });
  });

  it('η ανάκληση πρόσκλησης σκοτώνει τον σύνδεσμο · ξένη ≡ ανύπαρκτη', async () => {
    const { token, invitation } = await invite();
    expect((await rejectionOf(revokeSupplyInvitation(RIVAL, invitation.id))).kind).toBe('notFound');
    await revokeSupplyInvitation(ARIES, invitation.id);
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'revoked' });
  });

  it('η όψη δείχνει μόνο τον προμηθευτή και δεν καταναλώνει', async () => {
    const { token, invitation } = await invite();
    const outcome = await previewSupplyInvitation(db(), { token, viewerEmail: 'other@x.gr' });
    expect(outcome).toMatchObject({ kind: 'preview', addressedToViewer: false, preview: { supplierName: 'Aries', expiresAt: invitation.expiresAt } });
    expect(fake.getData(COLLECTIONS.SUPPLY_INVITATIONS, invitation.id)).toMatchObject({ state: 'pending' });
  });
});

describe('πόρτα β: σύνδεσμος/QR', () => {
  it('το αίτημα ΔΕΝ ανοίγει τίποτα: `requested`, με αριθμό πελάτη και πρόσωπο', async () => {
    const { relationship } = await requested();
    expect(relationship).toMatchObject({ state: 'requested', origin: 'link', customerRef: 'R-77', requestedByUid: 'u_buyer', supplierContactId: null, requestCount: 1 });
  });

  it('το ίδιο token ξαναδιαβάζεται: ίδιο QR σε κάθε έντυπο', async () => {
    const first = await publishSupplyRequestLink(ARIES);
    const view = await readSupplierSupplyView(ARIES);
    expect(view.link).toEqual({ state: 'live', token: first.token });
  });

  it('🔴 ανάκληση: ο τυπωμένος σύνδεσμος πεθαίνει, και η νέα δημοσίευση ΔΕΝ τον ξαναζωντανεύει', async () => {
    const printed = (await publishSupplyRequestLink(ARIES)).token as string;
    await revokeSupplyRequestLink(ARIES);
    expect(await previewSupplyRequestLink(db(), printed)).toEqual({ kind: 'refused', reason: 'revoked' });
    const fresh = (await publishSupplyRequestLink(ARIES)).token as string;
    expect(fresh).not.toBe(printed);
    expect(await requestSupplyAccess(db(), { token: printed, customerRef: null, acting: acting() })).toEqual({ kind: 'refused', reason: 'revoked' });
    expect(relationshipDoc()).toBeUndefined();
    expect(await previewSupplyRequestLink(db(), fresh)).toEqual({ kind: 'preview', preview: { supplierName: 'Aries' } });
  });

  it('πλαστός σύνδεσμος ⇒ `link-invalid`', async () => {
    expect(await previewSupplyRequestLink(db(), 'not-a-token')).toMatchObject({ kind: 'refused' });
  });

  it('Σ3: προσωπικός χώρος δεν ζητά · ο προμηθευτής δεν ζητά από τον εαυτό του', async () => {
    const token = (await publishSupplyRequestLink(ARIES)).token as string;
    mockOwnWorkspaces.mockImplementation(async () => ({ outcome: 'ok', reachable: [], belonging: [] }));
    expect(await requestSupplyAccess(db(), { token, customerRef: null, acting: acting() })).toEqual({ kind: 'refused', reason: 'office-required' });
    mockOwnWorkspaces.mockImplementation(async () => ({ outcome: 'ok', reachable: [], belonging: [ARIES.companyId] }));
    expect(await requestSupplyAccess(db(), { token, customerRef: null, acting: acting() })).toEqual({ kind: 'refused', reason: 'same-workspace' });
  });

  it('έγκριση χωρίς επαφή: ενεργή, και η ομάδα δένεται στον ΧΩΡΟ, ατομικά', async () => {
    const { relationship } = await requested();
    const group = await createPricingGroup(ARIES, 'customerGroup', { code: 'wholesale', labels: { el: 'Χονδρική' } });
    const after = await approveSupplyRequest(ARIES, relationship.id, { expectedRevision: relationship.revision, supplierContactId: null, customerGroupId: group.id });
    expect(after).toMatchObject({ state: 'active', acceptedByUid: 'u_buyer', approvedByUid: ARIES.uid });
    expect(Object.values(fake.getAllDocs(COLLECTIONS.CATALOG_CUSTOMER_ASSIGNMENTS))).toEqual([expect.objectContaining({ party: WORKSPACE_PARTY, customerGroupId: group.id })]);
  });

  it('έγκριση με επαφή: η ομάδα δένεται στην ΕΠΑΦΗ, υπάρχουσα ανάθεση αλλάζει ομάδα', async () => {
    const { relationship } = await requested();
    const groupA = await createPricingGroup(ARIES, 'customerGroup', { code: 'a', labels: { el: 'Α' } });
    const groupB = await createPricingGroup(ARIES, 'customerGroup', { code: 'b', labels: { el: 'Β' } });
    await createCustomerAssignment(ARIES, { party: { kind: 'contact', contactId: CONTACT }, customerGroupId: groupA.id });
    await approveSupplyRequest(ARIES, relationship.id, { expectedRevision: relationship.revision, supplierContactId: CONTACT, customerGroupId: groupB.id });
    expect(Object.values(fake.getAllDocs(COLLECTIONS.CATALOG_CUSTOMER_ASSIGNMENTS))).toEqual([expect.objectContaining({ customerGroupId: groupB.id })]);
    expect(relationshipDoc()).toMatchObject({ supplierContactId: CONTACT });
  });

  it('🔴 άγνωστη ομάδα ⇒ τίποτα δεν ενεργοποιείται', async () => {
    const { relationship } = await requested();
    await rejectionOf(approveSupplyRequest(ARIES, relationship.id, { expectedRevision: relationship.revision, supplierContactId: null, customerGroupId: 'grp_none' }));
    expect(relationshipDoc()).toMatchObject({ state: 'requested' });
  });

  it('🔴 επαφή που κρατά άλλον αγοραστή ⇒ η έγκριση αρνείται', async () => {
    fake.seed(COLLECTIONS.SUPPLY_RELATIONSHIPS, 'srel_other', activeWithOther());
    const { relationship } = await requested();
    const error = await rejectionOf(approveSupplyRequest(ARIES, relationship.id, { expectedRevision: relationship.revision, supplierContactId: CONTACT, customerGroupId: null }));
    expect(error.issues).toEqual([expect.objectContaining({ code: 'contactAlreadyBound' })]);
    expect(relationshipDoc()).toMatchObject({ state: 'requested' });
  });

  it('CAS · ξένος χώρος ≡ ανύπαρκτη', async () => {
    const { relationship } = await requested();
    expect((await rejectionOf(approveSupplyRequest(ARIES, relationship.id, { expectedRevision: 99, supplierContactId: null, customerGroupId: null }))).kind).toBe('revisionMismatch');
    expect((await rejectionOf(approveSupplyRequest(RIVAL, relationship.id, { expectedRevision: relationship.revision, supplierContactId: null, customerGroupId: null }))).kind).toBe('notFound');
    expect((await rejectionOf(approveSupplyRequest(BUYER, relationship.id, { expectedRevision: relationship.revision, supplierContactId: null, customerGroupId: null }))).kind).toBe('notFound');
  });

  it('το όριο αιτημάτων κόβει το επαναλαμβανόμενο αίτημα', async () => {
    const { token } = await requested();
    for (let round = 0; round < 2; round += 1) {
      const current = relationshipDoc() as SupplyRelationship;
      await declineSupplyRequest(ARIES, current.id, current.revision);
      await requestSupplyAccess(db(), { token, customerRef: 'R-77', acting: acting() });
    }
    const current = relationshipDoc() as SupplyRelationship;
    await declineSupplyRequest(ARIES, current.id, current.revision);
    expect(await requestSupplyAccess(db(), { token, customerRef: 'R-77', acting: acting() })).toEqual({ kind: 'refused', reason: 'request-limit' });
  });
});

describe('Σ5: ο χώρος-συμβαλλόμενος θέλει ενεργή σχέση', () => {
  const group = () => createPricingGroup(ARIES, 'customerGroup', { code: 'wholesale', labels: { el: 'Χονδρική' } });

  it('🔴 χώρος που υπάρχει χωρίς σχέση ⇒ `unknownParty`: όχι όργανο απαρίθμησης', async () => {
    const error = await rejectionOf(createCustomerAssignment(ARIES, { party: WORKSPACE_PARTY, customerGroupId: (await group()).id }));
    expect(error.issues).toEqual([expect.objectContaining({ code: 'unknownParty', path: 'party' })]);
  });

  it('ίδια απάντηση για χώρο που δεν υπάρχει καθόλου', async () => {
    const error = await rejectionOf(createCustomerAssignment(ARIES, { party: { kind: 'workspace', companyId: 'comp-ghost' }, customerGroupId: (await group()).id }));
    expect(error.issues).toEqual([expect.objectContaining({ code: 'unknownParty' })]);
  });

  it('με ενεργή σχέση δεκτός, μετά την ανάκληση ξανά άγνωστος', async () => {
    const relationship = await connected();
    const { id } = await group();
    await createCustomerAssignment(ARIES, { party: WORKSPACE_PARTY, customerGroupId: id });
    await endSupplyRelationship(ARIES, relationship.id, { side: 'supplier', expectedRevision: relationship.revision });
    expect((await rejectionOf(quote(WORKSPACE_PARTY))).issues).toEqual([expect.objectContaining({ code: 'unknownParty' })]);
  });

  it('εκκρεμές αίτημα ΔΕΝ είναι σχέση', async () => {
    await requested();
    expect((await rejectionOf(quote(WORKSPACE_PARTY))).issues).toEqual([expect.objectContaining({ code: 'unknownParty' })]);
  });
});

describe('Σ6: ο θεατής είναι σύνολο ταυτοτήτων', () => {
  it('🔴 συνθήκη σε επαφή φτάνει τον αγοραστή όταν ρωτιέται ως χώρος', async () => {
    seedPricedProducts(fake);
    await connected();
    const viaWorkspace = await quote(WORKSPACE_PARTY);
    const viaContact = await quote({ kind: 'contact', contactId: CONTACT });
    const expected = [{ kind: 'contact', contactId: CONTACT }, WORKSPACE_PARTY];
    expect(viaWorkspace.viewer).toMatchObject({ kind: 'signedIn', parties: expected });
    expect(viaContact.viewer).toMatchObject({ kind: 'signedIn', parties: expected });
    expect(audienceCovers({ kind: 'partner', party: { kind: 'contact', contactId: CONTACT } }, viaWorkspace.viewer)).toBe(true);
    expect(audienceCovers({ kind: 'partner', party: WORKSPACE_PARTY }, viaContact.viewer)).toBe(true);
    expect(audienceCovers({ kind: 'partner', party: { kind: 'contact', contactId: 'cont_other' } }, viaContact.viewer)).toBe(false);
  });

  it('η ομάδα έρχεται από την επαφή, με δίχτυ τον χώρο', async () => {
    seedPricedProducts(fake);
    await connected();
    const a = await createPricingGroup(ARIES, 'customerGroup', { code: 'a', labels: { el: 'Α' } });
    const b = await createPricingGroup(ARIES, 'customerGroup', { code: 'b', labels: { el: 'Β' } });
    await createCustomerAssignment(ARIES, { party: WORKSPACE_PARTY, customerGroupId: b.id });
    expect((await quote(WORKSPACE_PARTY)).viewer).toMatchObject({ customerGroupId: b.id });
    await createCustomerAssignment(ARIES, { party: { kind: 'contact', contactId: CONTACT }, customerGroupId: a.id });
    expect((await quote(WORKSPACE_PARTY)).viewer).toMatchObject({ customerGroupId: a.id });
  });

  it('επαφή χωρίς σχέση κρατά μόνο τον εαυτό της', async () => {
    seedPricedProducts(fake);
    expect((await quote({ kind: 'contact', contactId: CONTACT })).viewer).toMatchObject({ parties: [{ kind: 'contact', contactId: CONTACT }] });
  });
});

describe('Σ7: ανάκληση από όποια πλευρά', () => {
  it('από τον αγοραστή, άμεσα, με ίχνος στα δύο βιβλία', async () => {
    const relationship = await connected();
    recordTrackedEntityWrite.mockClear();
    const after = await endSupplyRelationship(BUYER, relationship.id, { side: 'buyer', expectedRevision: relationship.revision });
    expect(after).toMatchObject({ state: 'revoked', endedBySide: 'buyer', endedByUid: 'u_buyer' });
    expect(recordTrackedEntityWrite).toHaveBeenCalledTimes(2);
  });

  it('🔴 ο αγοραστής δεν μπορεί να ενεργήσει ως προμηθευτής, ούτε ξένος ως αγοραστής', async () => {
    const relationship = await connected();
    expect((await rejectionOf(endSupplyRelationship(BUYER, relationship.id, { side: 'supplier', expectedRevision: relationship.revision }))).kind).toBe('notFound');
    expect((await rejectionOf(endSupplyRelationship(RIVAL, relationship.id, { side: 'buyer', expectedRevision: relationship.revision }))).kind).toBe('notFound');
  });

  it('CAS: όποιος είδε παλιά εικόνα δεν ανακαλεί, ούτε απορρίπτει', async () => {
    const relationship = await connected();
    expect((await rejectionOf(endSupplyRelationship(ARIES, relationship.id, { side: 'supplier', expectedRevision: 99 }))).kind).toBe('revisionMismatch');
    expect(relationshipDoc()).toMatchObject({ state: 'active' });
  });

  it('η ανάκληση ρίχνει και κάθε ζωντανή πρόσκληση της επαφής', async () => {
    const relationship = await connected();
    fake.seed(COLLECTIONS.SUPPLY_INVITATIONS, 'sinv_live', { id: 'sinv_live', companyId: ARIES.companyId, contactId: CONTACT, state: 'pending' });
    await endSupplyRelationship(ARIES, relationship.id, { side: 'supplier', expectedRevision: relationship.revision });
    expect(fake.getData(COLLECTIONS.SUPPLY_INVITATIONS, 'sinv_live')).toMatchObject({ state: 'revoked' });
  });

  it('δεύτερη ανάκληση δεν γράφει και δεν αφήνει δεύτερο ίχνος', async () => {
    const relationship = await connected();
    const ended = await endSupplyRelationship(ARIES, relationship.id, { side: 'supplier', expectedRevision: relationship.revision });
    recordTrackedEntityWrite.mockClear();
    await endSupplyRelationship(ARIES, relationship.id, { side: 'supplier', expectedRevision: ended.revision });
    expect(recordTrackedEntityWrite).not.toHaveBeenCalled();
    expect(relationshipDoc()).toMatchObject({ revision: ended.revision });
  });
});

describe('ποιος μαθαίνει τι', () => {
  const sent = () => dispatchNotification.mock.calls.map(([input]) => input);

  it('αποδοχή ⇒ όποιος προσκάλεσε, στον χώρο του προμηθευτή, με το όνομα του αγοραστή', async () => {
    await connected();
    expect(sent()).toEqual([expect.objectContaining({
      recipientId: ARIES.uid, tenantId: ARIES.companyId, titleKey: 'supplyConnection.acceptedTitle', titleParams: { who: 'Γραφείο Αγοραστή' },
      workspace: { kind: 'org', companyId: ARIES.companyId },
    })]);
  });

  it('αίτημα ⇒ όποιος δημοσίευσε τον σύνδεσμο · αλλαγή αριθμού πελάτη ⇒ σιωπή', async () => {
    const { token } = await requested();
    expect(sent()).toEqual([expect.objectContaining({ recipientId: ARIES.uid, titleKey: 'supplyConnection.requestedTitle' })]);
    dispatchNotification.mockClear();
    await requestSupplyAccess(db(), { token, customerRef: 'R-78', acting: acting() });
    expect(sent()).toEqual([]);
  });

  it('έγκριση ⇒ όποιος ζήτησε, στον ΔΙΚΟ του χώρο, στην καρτέλα προμηθευτών', async () => {
    const { relationship } = await requested();
    dispatchNotification.mockClear();
    await approveSupplyRequest(ARIES, relationship.id, { expectedRevision: relationship.revision, supplierContactId: null, customerGroupId: null });
    expect(sent()).toEqual([expect.objectContaining({
      recipientId: 'u_buyer', tenantId: BUYER_ID, titleKey: 'supplyConnection.approvedTitle', titleParams: { who: 'Aries' },
      workspace: { kind: 'org', companyId: BUYER_ID }, actions: [expect.objectContaining({ url: '/catalog/connections?tab=suppliers' })],
    })]);
  });

  it('ο ανιχνευτής ξαναχτίζει τον ΙΔΙΟ προορισμό, για κάθε πλευρά, από το έγγραφο', async () => {
    const { relationship } = await requested();
    await approveSupplyRequest(ARIES, relationship.id, { expectedRevision: relationship.revision, supplierContactId: null, customerGroupId: null });
    const stored = (userId: string) => ({ id: 'n1', userId, eventType: 'procurement.supplyConnection', entityId: relationship.id, url: '', workspace: null });
    expect(await expectedDestinationOf(db(), stored('u_buyer'))).toMatchObject({ destination: { workspace: { companyId: BUYER_ID }, actions: [{ url: '/catalog/connections?tab=suppliers' }] } });
    expect(await expectedDestinationOf(db(), stored(ARIES.uid))).toMatchObject({ destination: { workspace: { companyId: ARIES.companyId }, actions: [{ url: '/catalog/connections' }] } });
  });

  it('🔒 απόρριψη και ανάκληση σιωπούν (Σ7)', async () => {
    const { relationship } = await requested();
    dispatchNotification.mockClear();
    const after = await declineSupplyRequest(ARIES, relationship.id, relationship.revision);
    await endSupplyRelationship(BUYER, after.id, { side: 'buyer', expectedRevision: after.revision });
    expect(sent()).toEqual([]);
  });

  it('αποτυχία ειδοποίησης δεν ακυρώνει την πράξη', async () => {
    dispatchNotification.mockRejectedValueOnce(new Error('down'));
    const relationship = await connected();
    expect(relationship.state).toBe('active');
  });
});

describe('οι όψεις', () => {
  it('🔒 ο αγοραστής βλέπει `ended` χωρίς λόγο, χωρίς επαφή, χωρίς εγκρίνοντα', async () => {
    const relationship = await connected();
    await endSupplyRelationship(ARIES, relationship.id, { side: 'supplier', expectedRevision: relationship.revision });
    const view = await readBuyerSupplyView(BUYER);
    expect(view.relationships).toEqual([{
      id: relationship.id, supplierCompanyId: ARIES.companyId, supplierName: 'Aries', state: 'ended', customerRef: null, revision: relationship.revision + 1,
    }]);
  });

  it('🔒 η απόρριψη είναι επίσης `ended` για τον αγοραστή', async () => {
    const { relationship } = await requested();
    await declineSupplyRequest(ARIES, relationship.id, relationship.revision);
    expect((await readBuyerSupplyView(BUYER)).relationships).toEqual([expect.objectContaining({ state: 'ended' })]);
  });

  it('ο προμηθευτής βλέπει τον αγοραστή με το όνομά του και την επαφή του', async () => {
    await connected();
    const view = await readSupplierSupplyView(ARIES);
    expect(view.relationships[0]).toMatchObject({ buyerName: 'Γραφείο Αγοραστή', supplierContactId: CONTACT, state: 'active' });
  });

  it('🔑 το σήμα ανεβαίνει ΚΑΙ στους δύο χώρους', async () => {
    await connected();
    expect((await readSupplierSupplyView(ARIES)).freshness.revision).toBeGreaterThan(0);
    expect((await readBuyerSupplyView(BUYER)).freshness.revision).toBeGreaterThan(0);
  });

  it('ξένος χώρος δεν βλέπει τίποτα', async () => {
    await connected();
    expect((await readSupplierSupplyView(RIVAL)).relationships).toEqual([]);
    expect((await readBuyerSupplyView(RIVAL)).relationships).toEqual([]);
  });

  it('οι εκκρεμείς προσκλήσεις με όνομα επαφής, χωρίς `nonceHash`', async () => {
    const { invitation } = await invite();
    const [row] = (await readSupplierSupplyView(ARIES)).invitations;
    expect(row).toMatchObject({ id: invitation.id, inviteeEmail: EMAIL, state: 'pending' });
    expect(row).not.toHaveProperty('nonceHash');
  });
});
