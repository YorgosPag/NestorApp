/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΟΥ ΑΙΤΗΜΑΤΟΣ ΘΕΑΣΗΣ** (ADR-884 Φ0.13) — άγκυρες.
 *
 * - **Ε** — εντοπισμός: η περιήγηση βρίσκεται από τη **ρίζα**, στο διαμέρισμα του κατόχου της.
 * - **Α** — αιτών: μόνο σε δημοσιευμένη `on-request`· idempotent· ξανα-αίτημα = το **ίδιο** έγγραφο.
 * - **Υ** — υπεύθυνος: μόνο όποιος `mayManageTour`· λήξη **υποχρεωτική**· μαζική με αποτέλεσμα ανά άνθρωπο.
 * - **Λ** — 🔴 η λήξη **παράγεται**: καμία εγγραφή, και όμως η πρόσβαση τελειώνει.
 *
 * 🔑 Κάθε άρνηση ελέγχει **και** το ημερολόγιο εγγραφών — «επέστρεψε άρνηση» χωρίς «δεν έγραψε» δεν αποδεικνύει τίποτα.
 */

jest.mock('server-only', () => ({}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import { decideTourAccessRequests, listTourAccessRequests, revokeTourAccess } from '../tour-access-decision';
import { TOUR_ACCESS_MAX_DAYS } from '../tour-access-shared';
import { readTourViewStanding, requestTourAccess, withdrawTourAccessRequest } from '../tour-access-request';
import { locateSpatialTour } from '../tour-locate';

const AGENCY = 'comp_agency';
const COMPANY_SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const PERSONAL_SUBJECT: TourSubject = { kind: 'owner-property', id: 'ownp_1' };
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const TOURS = COLLECTIONS.SPATIAL_TOURS;
const REQUESTS = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_ACCESS_REQUESTS}`;
const requestId = (uid: string) => enterpriseIdService.generateDeterministicTourAccessRequestId(TOUR_ID, uid);

const MANAGER: TourActor = {
  listing: { uid: 'boris', companyId: AGENCY },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};
const STRANGER: TourActor = {
  listing: { uid: 'carl', companyId: 'comp_rival' },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

function tourDoc(overrides: Record<string, unknown> = {}) {
  return {
    companyId: AGENCY,
    subject: COMPANY_SUBJECT,
    visibility: 'on-request',
    lifecycle: 'published',
    levels: [],
    nodes: [],
    revision: 0,
    createdAt: '2026-09-01T10:00:00.000Z',
    createdBy: 'boris',
    updatedAt: '2026-09-01T10:00:00.000Z',
    updatedBy: 'boris',
    ...overrides,
  };
}

let kit: MockFirestoreKit;
let db: Firestore;

function seed(tour: Record<string, unknown> | null = tourDoc()) {
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY } });
  if (tour !== null) kit.seedCollection(TOURS, { [TOUR_ID]: tour });
}

beforeEach(() => {
  kit = createMockFirestore();
  db = kit.instance as unknown as Firestore;
});

describe('Ε — ο εντοπισμός από τη ρίζα', () => {
  it('εταιρική ρίζα ⇒ εταιρικό διαμέρισμα, ντετερμινιστικό id', async () => {
    seed();
    const location = await locateSpatialTour(db, COMPANY_SUBJECT);
    expect(location).toMatchObject({ kind: 'found', custody: { companyId: AGENCY } });
    expect(location.kind === 'found' && location.tourRef.id).toBe(TOUR_ID);
  });

  it('ρίζα ιδιώτη ⇒ ΠΡΟΣΩΠΙΚΟ διαμέρισμα — ποτέ εταιρικό', async () => {
    kit.seedCollection(COLLECTIONS.OWNER_PROPERTIES, { ownp_1: { authorUserId: 'anna', authorCompanyId: null } });
    const location = await locateSpatialTour(db, PERSONAL_SUBJECT);
    expect(location).toMatchObject({ kind: 'found', custody: { userId: 'anna' }, tour: null });
  });

  it('απούσα ρίζα ⇒ absent · εταιρική χωρίς μισθωτή ⇒ unscoped', async () => {
    expect(await locateSpatialTour(db, COMPANY_SUBJECT)).toEqual({ kind: 'absent' });
    kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: '' } });
    expect(await locateSpatialTour(db, COMPANY_SUBJECT)).toEqual({ kind: 'unscoped' });
  });
});

describe('Α — ο αιτών', () => {
  it('Α1 — πρώτο αίτημα ⇒ pending, requestCount 1, στο ντετερμινιστικό έγγραφο', async () => {
    seed();
    const outcome = await requestTourAccess(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer', message: '  γεια  ' });
    expect(outcome).toMatchObject({ kind: 'requested', request: { state: 'pending', requestCount: 1, message: 'γεια' } });
    expect(kit.getData(REQUESTS, requestId('buyer'))).toMatchObject({ state: 'pending', expiresAt: null });
  });

  it('Α2 — δεύτερο αίτημα σε εκκρεμές ⇒ already-pending, ΚΑΜΙΑ εγγραφή (idempotent)', async () => {
    seed();
    await requestTourAccess(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer', message: null });
    kit.clearWrites();
    const again = await requestTourAccess(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer', message: null });
    expect(again.kind).toBe('already-pending');
    expect(kit.writes()).toHaveLength(0);
  });

  it.each([
    ['δημόσια', { visibility: 'public' }],
    ['μόνο με σύνδεσμο', { visibility: 'link-only' }],
    ['πρόχειρη', { lifecycle: 'draft' }],
  ])('Α3 — 🔴 περιήγηση %s ⇒ not-requestable, καμία εγγραφή', async (_label, patch) => {
    seed(tourDoc(patch));
    const outcome = await requestTourAccess(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer', message: null });
    expect(outcome).toEqual({ kind: 'refused', reason: 'not-requestable' });
    expect(kit.writes()).toHaveLength(0);
  });

  it('Α4 — ρίζα χωρίς περιήγηση ⇒ tour-absent', async () => {
    seed(null);
    expect(await requestTourAccess(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer', message: null }))
      .toEqual({ kind: 'refused', reason: 'tour-absent' });
  });

  it('Α5 — απόσυρση μόνο εκκρεμούς · ξανα-αίτημα ανοίγει το ΙΔΙΟ έγγραφο με requestCount 2', async () => {
    seed();
    await requestTourAccess(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer', message: null });
    expect(await withdrawTourAccessRequest(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer' })).toEqual({ kind: 'withdrawn' });
    expect(await withdrawTourAccessRequest(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer' }))
      .toEqual({ kind: 'refused', reason: 'not-pending' });
    const again = await requestTourAccess(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer', message: null });
    expect(again).toMatchObject({ kind: 'requested', request: { id: requestId('buyer'), requestCount: 2 } });
  });
});

describe('Υ — ο υπεύθυνος', () => {
  beforeEach(async () => {
    seed();
    for (const uid of ['buyer', 'buyer2']) {
      await requestTourAccess(db, { subject: COMPANY_SUBJECT, requesterUid: uid, message: null });
    }
    kit.clearWrites();
  });

  const approve = (actor: TourActor, expiresAt: string | null, uids = ['buyer']) =>
    decideTourAccessRequests(db, { subject: COMPANY_SUBJECT, actor, requesterUids: uids, decision: 'approved', expiresAt });

  it('Υ1 — 🔴 ξένος μισθωτής ⇒ not-manager, καμία εγγραφή', async () => {
    expect(await approve(STRANGER, inDays(30))).toEqual({ kind: 'refused', reason: 'not-manager' });
    expect(kit.writes()).toHaveLength(0);
  });

  it.each([
    ['χωρίς λήξη', null, 'expiry-required'],
    ['άκυρη λήξη', 'αύριο', 'expiry-required'],
    ['λήξη στο παρελθόν', inDays(-1), 'expiry-past'],
    ['λήξη πέρα από τον ορίζοντα', inDays(TOUR_ACCESS_MAX_DAYS + 1), 'expiry-too-far'],
  ])('Υ2 — 🔴 έγκριση %s ⇒ %s, καμία εγγραφή', async (_label, expiresAt, reason) => {
    expect(await approve(MANAGER, expiresAt)).toEqual({ kind: 'refused', reason });
    expect(kit.writes()).toHaveLength(0);
  });

  it('Υ3 — μαζική έγκριση: αποτέλεσμα ανά άνθρωπο, άγνωστος δεν ρίχνει τους άλλους', async () => {
    const outcome = await approve(MANAGER, inDays(30), ['buyer', 'buyer2', 'ghost', 'buyer']);
    expect(outcome).toEqual({
      kind: 'decided',
      results: [
        { requesterUid: 'buyer', kind: 'decided', state: 'approved' },
        { requesterUid: 'buyer2', kind: 'decided', state: 'approved' },
        { requesterUid: 'ghost', kind: 'refused', reason: 'request-absent' },
      ],
    });
    expect(await readTourViewStanding(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer' })).toBe('active');
  });

  it('Υ4 — ποτέ ανατροπή: απόφαση πάνω σε αποφασισμένο ⇒ not-pending', async () => {
    await approve(MANAGER, inDays(30));
    const again = await decideTourAccessRequests(db, {
      subject: COMPANY_SUBJECT, actor: MANAGER, requesterUids: ['buyer'], decision: 'declined', expiresAt: null,
    });
    expect(again).toEqual({ kind: 'decided', results: [{ requesterUid: 'buyer', kind: 'refused', reason: 'not-pending' }] });
  });

  it('Υ5 — απόρριψη δεν χρειάζεται λήξη και δεν γράφει λήξη', async () => {
    await decideTourAccessRequests(db, {
      subject: COMPANY_SUBJECT, actor: MANAGER, requesterUids: ['buyer'], decision: 'declined', expiresAt: inDays(30),
    });
    expect(kit.getData(REQUESTS, requestId('buyer'))).toMatchObject({ state: 'declined', expiresAt: null, decidedBy: 'boris' });
  });

  it('Υ6 — ανάκληση: μόνο ενεργού · ⇒ revoked · ξανα-αίτημα επιτρέπεται', async () => {
    const revoke = () => revokeTourAccess(db, { subject: COMPANY_SUBJECT, actor: MANAGER, requesterUid: 'buyer' });
    expect(await revoke()).toEqual({ kind: 'refused', reason: 'not-active' });
    await approve(MANAGER, inDays(30));
    expect(await revoke()).toEqual({ kind: 'revoked' });
    expect(await readTourViewStanding(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer' })).toBe('revoked');
    const again = await requestTourAccess(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer', message: null });
    expect(again).toMatchObject({ kind: 'requested', request: { requestCount: 2, revokedAt: null } });
  });

  it('Υ7 — λίστα: μόνο ο υπεύθυνος, μόνο η ζητούμενη κατάσταση', async () => {
    await approve(MANAGER, inDays(30), ['buyer']);
    const pending = await listTourAccessRequests(db, { subject: COMPANY_SUBJECT, actor: MANAGER, state: 'pending' });
    expect(pending.kind === 'listed' && pending.requests.map((r) => r.requesterUid)).toEqual(['buyer2']);
    expect(await listTourAccessRequests(db, { subject: COMPANY_SUBJECT, actor: STRANGER, state: 'pending' }))
      .toEqual({ kind: 'refused', reason: 'not-manager' });
  });
});

describe('Λ — 🔴 η λήξη ΠΑΡΑΓΕΤΑΙ', () => {
  it('εγκεκριμένο με παρελθούσα λήξη ⇒ expired στην ανάγνωση, χωρίς καμία εγγραφή', async () => {
    seed();
    kit.seedCollection(REQUESTS, {
      [requestId('buyer')]: {
        tourId: TOUR_ID, requesterUid: 'buyer', message: null, state: 'approved', requestedAt: '2026-08-01T00:00:00.000Z',
        requestCount: 1, decidedAt: '2026-08-02T00:00:00.000Z', decidedBy: 'boris',
        expiresAt: '2026-08-03T00:00:00.000Z', revokedAt: null, revokedBy: null,
      },
    });
    expect(await readTourViewStanding(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer' })).toBe('expired');
    expect(kit.writes()).toHaveLength(0);
    const again = await requestTourAccess(db, { subject: COMPANY_SUBJECT, requesterUid: 'buyer', message: null });
    expect(again).toMatchObject({ kind: 'requested', request: { requestCount: 2 } });
  });

  it('κανένα αίτημα ⇒ none', async () => {
    seed();
    expect(await readTourViewStanding(db, { subject: COMPANY_SUBJECT, requesterUid: 'nobody' })).toBe('none');
  });
});
