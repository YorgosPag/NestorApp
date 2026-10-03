/**
 * @fileoverview **Η ΚΑΤΟΨΗ ΓΙΑ ΤΗ ΛΗΨΗ** (ADR-904 Κ9) — ποιος κατεβάζει ποια κάτοψη.
 *
 * - **Κ1** υπεύθυνος **και** φωτογράφος με ενεργή άδεια ⇒ το **μεγαλύτερο** παράγωγο της ενεργής βαθμονομημένης κάτοψης·
 * - **Κ2** ληγμένη άδεια · κανένας δεσμός ⇒ η **ίδια** άρνηση με το ανέβασμα (κανένας νέος κριτής, CHECK 3.68)·
 * - **Κ3** παλιό hash · αβαθμονόμητη · αντικατεστημένη κάτοψη ⇒ `plan-absent` — μόνο ό,τι υπόσχεται η λίστα (`calibratedPlan`).
 */

jest.mock('server-only', () => ({}));

const DEFAULT_BUCKET = { name: 'default' };
const TOUR_EU_BUCKET = { name: 'tour-eu' };
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminBucket: () => DEFAULT_BUCKET,
  getTourMediaBucket: () => TOUR_EU_BUCKET,
}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import { locateCapturePlan } from '../tour-capture-plan';

const AGENCY = 'comp_agency';
const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const GRANTS = `${COLLECTIONS.SPATIAL_TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS}`;
const DAY_MS = 24 * 60 * 60 * 1000;
const HASH = 'c'.repeat(64);

const MANAGER: TourActor = {
  listing: { uid: 'boris', companyId: AGENCY },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};
const PHOTOGRAPHER: TourActor = { listing: { uid: 'uid_photo', companyId: null }, capability: { globalRole: 'external_user', permissions: [] } };

const SCALE = { metresPerPixel: 0.01, calibratedBy: 'boris', calibratedAt: '2026-10-01T00:00:00.000Z' };
const record = (overrides: Record<string, unknown> = {}) => ({
  source: 'engineer', state: 'active', fileId: 'file_g', approvedBy: 'boris', approvedAt: '2026-10-01T00:00:00.000Z',
  image: { width: 3000, height: 2000, contentHash: HASH }, scale: SCALE, ...overrides,
});

let kit: FakeFirestore;
let db: Firestore;

function seedTour(floorPlans: readonly unknown[]) {
  kit.seedCollection(COLLECTIONS.SPATIAL_TOURS, {
    [TOUR_ID]: {
      companyId: AGENCY, subject: SUBJECT, visibility: 'public', lifecycle: 'draft', nodes: [], revision: 0,
      levels: [{ key: { kind: 'local', ordinal: 0 }, floorPlans }],
      createdAt: '2026-10-01T00:00:00.000Z', createdBy: 'boris', updatedAt: '2026-10-01T00:00:00.000Z', updatedBy: 'boris',
    },
  });
}

const grantPhotographer = (overrides: Record<string, unknown> = {}) => kit.seedCollection(GRANTS, {
  uid_photo: {
    tourId: TOUR_ID, scopes: ['tour:capture:upload'], expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
    revokedAt: null, revokedBy: null, createdAt: '2026-10-01T00:00:00.000Z', createdBy: 'boris', reason: 'λήψη', invitationId: null,
    ...overrides,
  },
});

const locate = (actor: TourActor, contentHash = HASH) => locateCapturePlan(db, { subject: SUBJECT, actor, contentHash });

beforeEach(() => {
  kit = new FakeFirestore();
  db = kit as unknown as Firestore;
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY, name: 'Διαμέρισμα Α2' } });
});

describe('Κ1 — ποιος τη βλέπει', () => {
  const EXPECTED = { kind: 'found', objectPath: `tour-tiles/${TOUR_ID}/plans/${HASH}/p1/w2048.webp`, bucket: DEFAULT_BUCKET, tourId: TOUR_ID };

  it('υπεύθυνος ⇒ το μεγαλύτερο παράγωγο (ο φωτογράφος μεγεθύνει για να πατήσει με ακρίβεια)', async () => {
    seedTour([record()]);
    await expect(locate(MANAGER)).resolves.toEqual(EXPECTED);
  });

  it('φωτογράφος με ενεργή άδεια ⇒ το ίδιο', async () => {
    seedTour([record()]);
    grantPhotographer();
    await expect(locate(PHOTOGRAPHER)).resolves.toEqual(EXPECTED);
  });
});

describe('Κ2 — ο ίδιος κριτής με το ανέβασμα', () => {
  it('ληγμένη άδεια ⇒ expired · καμία άδεια ⇒ no-capture-grant', async () => {
    seedTour([record()]);
    await expect(locate(PHOTOGRAPHER)).resolves.toEqual({ kind: 'refused', reason: 'no-capture-grant' });
    grantPhotographer({ expiresAt: new Date(Date.now() - DAY_MS).toISOString() });
    await expect(locate(PHOTOGRAPHER)).resolves.toEqual({ kind: 'refused', reason: 'expired' });
  });
});

describe('Κ3 — μόνο ό,τι υπόσχεται η λίστα', () => {
  it.each([
    ['παλιό hash (η κάτοψη άλλαξε)', [record()], 'd'.repeat(64)],
    ['αβαθμονόμητη', [record({ scale: null })], HASH],
    ['αντικατεστημένη (superseded)', [record({ state: 'superseded' }), record({ fileId: 'file_new', image: { width: 10, height: 10, contentHash: 'new' } })], HASH],
  ])('%s ⇒ plan-absent', async (_label, floorPlans, hash) => {
    seedTour(floorPlans);
    await expect(locate(MANAGER, hash)).resolves.toEqual({ kind: 'refused', reason: 'plan-absent' });
  });
});
