/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ ΑΙΤΗΜΑ ΓΙΝΕΤΑΙ ΕΠΑΦΗ** (ADR-884 Φ0.13β · Κ3β) — άγκυρες μέσα από την **πραγματική** απόφαση.
 *
 * - **Ε1** — νέος άνθρωπος ⇒ καρτέλα CRM **στην ίδια** συναλλαγή με την έγκριση + `contactId` στο αίτημα + ίχνος ADR-195.
 * - **Ε2** — υπάρχουσα καρτέλα (ίδιο email) ⇒ σύνδεση, **καμία** δεύτερη.
 * - **Ε3** — 🔴 αποτυχία ανάγνωσης CRM ⇒ έγκριση **ναι**, καρτέλα **όχι** (ποτέ «γράψε καινούρια» πάνω σε άγνωστο).
 * - **Ε4** — ιδιώτης κάτοχος / απόρριψη ⇒ καμία επαφή.
 * - **Ε5** — ήδη δεμένο αίτημα ⇒ καμία νέα αναζήτηση.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/server/auth/account-identities', () => ({ readAccountIdentities: jest.fn() }));
jest.mock('@/services/ai-pipeline/shared/contact-lookup-search', () => ({ findContactByEmail: jest.fn() }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn() } }));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { readAccountIdentities } from '@/server/auth/account-identities';
import { findContactByEmail } from '@/services/ai-pipeline/shared/contact-lookup-search';
import { EntityAuditService } from '@/services/entity-audit.service';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import { decideTourAccessRequests } from '../tour-access-decision';

const AGENCY = 'comp_agency';
const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const TOURS = COLLECTIONS.SPATIAL_TOURS;
const REQUESTS = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_ACCESS_REQUESTS}`;
const requestIdOf = (uid: string) => enterpriseIdService.generateDeterministicTourAccessRequestId(TOUR_ID, uid);
const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const MANAGER: TourActor = {
  listing: { uid: 'boris', companyId: AGENCY },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};

const pending = (uid: string, overrides: Record<string, unknown> = {}) => ({
  tourId: TOUR_ID, requesterUid: uid, message: 'Ενδιαφέρομαι', state: 'pending', requestedAt: '2026-09-25T10:00:00.000Z',
  requestCount: 1, decidedAt: null, decidedBy: null, expiresAt: null, revokedAt: null, revokedBy: null, ...overrides,
});

const identity = (uid: string) => ({
  uid, displayName: 'Δώρα Αγοράστρια', email: 'dora@example.com', emailVerified: true, givenName: 'Δώρα', familyName: 'Αγοράστρια',
});

let kit: MockFirestoreKit;
let db: Firestore;

function seed(tourOverrides: Record<string, unknown> = {}) {
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY } });
  kit.seedCollection(TOURS, {
    [TOUR_ID]: {
      companyId: AGENCY, subject: SUBJECT, visibility: 'on-request', lifecycle: 'published', levels: [], nodes: [], revision: 0,
      createdAt: '2026-09-01T10:00:00.000Z', createdBy: 'boris', updatedAt: '2026-09-01T10:00:00.000Z', updatedBy: 'boris',
      ...tourOverrides,
    },
  });
}

const decide = (decision: 'approved' | 'declined') =>
  decideTourAccessRequests(db, { subject: SUBJECT, actor: MANAGER, requesterUids: ['dora'], decision, expiresAt: decision === 'approved' ? inDays(30) : null });

beforeEach(() => {
  jest.clearAllMocks();
  kit = createMockFirestore();
  db = kit.instance as unknown as Firestore;
  (readAccountIdentities as jest.Mock).mockResolvedValue(new Map([['dora', identity('dora')]]));
});

it('Ε1 — νέος άνθρωπος ⇒ καρτέλα στην ίδια συναλλαγή, contactId στο αίτημα, ίχνος γέννησης', async () => {
  seed();
  kit.seedCollection(REQUESTS, { [requestIdOf('dora')]: pending('dora') });
  (findContactByEmail as jest.Mock).mockResolvedValue(null);

  const outcome = await decide('approved');
  expect(outcome).toMatchObject({ kind: 'decided', results: [{ requesterUid: 'dora', kind: 'decided', contact: 'created' }] });
  const contactId = kit.getData(REQUESTS, requestIdOf('dora'))?.contactId as string;
  expect(contactId).toBeTruthy();
  expect(kit.getData(COLLECTIONS.CONTACTS, contactId)).toMatchObject({ companyId: AGENCY, firstName: 'Δώρα', lastName: 'Αγοράστρια' });
  expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({ entityId: contactId, action: 'created' }));
});

it('Ε2 — υπάρχουσα καρτέλα ⇒ σύνδεση, καμία δεύτερη, κανένα ίχνος γέννησης', async () => {
  seed();
  kit.seedCollection(REQUESTS, { [requestIdOf('dora')]: pending('dora') });
  (findContactByEmail as jest.Mock).mockResolvedValue({ contactId: 'cont_existing', name: 'Δώρα' });

  const outcome = await decide('approved');
  expect(outcome).toMatchObject({ results: [{ contact: 'linked' }] });
  expect(kit.getData(REQUESTS, requestIdOf('dora'))).toMatchObject({ contactId: 'cont_existing', state: 'approved' });
  expect(Object.keys(kit.getAllDocs(COLLECTIONS.CONTACTS))).toEqual([]);
  expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
});

it('Ε3 — 🔴 το CRM δεν διαβάστηκε ⇒ εγκρίνεται, ΧΩΡΙΣ καρτέλα', async () => {
  seed();
  kit.seedCollection(REQUESTS, { [requestIdOf('dora')]: pending('dora') });
  (findContactByEmail as jest.Mock).mockRejectedValue(new Error('UNAVAILABLE'));

  const outcome = await decide('approved');
  expect(outcome).toMatchObject({ results: [{ kind: 'decided', state: 'approved', contact: 'unavailable' }] });
  expect(kit.getData(REQUESTS, requestIdOf('dora'))).toMatchObject({ state: 'approved' });
  expect(kit.getData(REQUESTS, requestIdOf('dora'))?.contactId ?? null).toBeNull();
  expect(Object.keys(kit.getAllDocs(COLLECTIONS.CONTACTS))).toEqual([]);
});

it('Ε4 — απόρριψη ⇒ καμία επαφή, καμία αναζήτηση', async () => {
  seed();
  kit.seedCollection(REQUESTS, { [requestIdOf('dora')]: pending('dora') });
  const outcome = await decide('declined');
  expect(outcome).toMatchObject({ results: [{ contact: 'none', state: 'declined' }] });
  expect(findContactByEmail).not.toHaveBeenCalled();
});

it('Ε5 — ήδη δεμένο αίτημα (ξανα-αίτημα) ⇒ linked, χωρίς νέα αναζήτηση', async () => {
  seed();
  kit.seedCollection(REQUESTS, { [requestIdOf('dora')]: pending('dora', { requestCount: 2, contactId: 'cont_prev' }) });
  const outcome = await decide('approved');
  expect(outcome).toMatchObject({ results: [{ contact: 'linked', requestCount: 2 }] });
  expect(findContactByEmail).not.toHaveBeenCalled();
  expect(kit.getData(REQUESTS, requestIdOf('dora'))).toMatchObject({ contactId: 'cont_prev' });
});
