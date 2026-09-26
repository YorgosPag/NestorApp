/**
 * @jest-environment node
 *
 * @fileoverview **Η ΣΥΝΕΔΡΙΑ ΘΕΑΣΗΣ** (ADR-884 Κ3β) — άγκυρες ενσωμάτωσης πάνω στον κοινό mock.
 *
 * - **Β** — οι βάσεις: δημόσιο · εγκεκριμένο αίτημα · σύνδεσμος · υπεύθυνος — και οι αρνήσεις τους.
 * - **Ι** — 🔴 ίχνος: **μία** επίσκεψη = **μία** μέτρηση· ζωντανό κουπόνι ⇒ καμία δεύτερη.
 * - **Σ** — ο σύνδεσμος μετρά μόνο αν είναι **ενεργός** και δείχνει **αυτή** την περιήγηση.
 * - **Μ** — το μανιφέστο λέει μόνο ό,τι έκρινε η πύλη: κοινό αγγελίας, τοποθετημένη, πιο πρόσφατη, έτοιμο tileset.
 */

jest.mock('server-only', () => ({}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import { openTourViewSession, type TourViewSessionInput } from '../tour-view-session';

const AGENCY = 'comp_agency';
const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const TOURS = COLLECTIONS.SPATIAL_TOURS;
const REQUESTS = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_ACCESS_REQUESTS}`;
const CAPTURES = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURES}`;
const requestIdOf = (uid: string) => enterpriseIdService.generateDeterministicTourAccessRequestId(TOUR_ID, uid);
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

const MANAGER: TourActor = {
  listing: { uid: 'boris', companyId: AGENCY },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};
const buyer = (uid: string): TourActor => ({ listing: { uid, companyId: null }, capability: { globalRole: 'external_user', permissions: [] } });

function tourDoc(overrides: Record<string, unknown> = {}) {
  return {
    companyId: AGENCY, subject: SUBJECT, visibility: 'on-request', lifecycle: 'published', levels: [], nodes: [],
    revision: 0, createdAt: '2026-09-01T10:00:00.000Z', createdBy: 'boris', updatedAt: '2026-09-01T10:00:00.000Z',
    updatedBy: 'boris', ...overrides,
  };
}

function approvedRequest(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    tourId: TOUR_ID, requesterUid: uid, message: null, state: 'approved', requestedAt: '2026-09-20T10:00:00.000Z',
    requestCount: 1, decidedAt: '2026-09-21T10:00:00.000Z', decidedBy: 'boris',
    expiresAt: new Date(NOW + 30 * DAY).toISOString(), revokedAt: null, revokedBy: null, ...overrides,
  };
}

function capture(overrides: Record<string, unknown> = {}) {
  return {
    tourId: TOUR_ID, nodeId: 'tnod_1', capturedAt: '2026-09-20T10:00:00.000Z', headingRad: 0, source: 'camera-360',
    provenance: 'as-built', baseCaptureId: null, signatory: null, audience: 'public-listing', milestone: null,
    originalFileId: 'file_1', uploadedBy: 'boris', createdAt: '2026-09-20T10:05:00.000Z',
    tileset: { state: 'ready', contentHash: 'h1' },
    rights: { creator: { name: 'Χ', userId: null, url: null }, licensors: [], copyrightNotice: '© Χ', webStatementOfRights: null,
      license: { purpose: 'listing-marketing', term: { kind: 'perpetual' } } },
    ...overrides,
  };
}

let kit: MockFirestoreKit;
let db: Firestore;

function seed(tour: Record<string, unknown> = tourDoc()) {
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY, name: 'Διαμέρισμα Α2' } });
  kit.seedCollection(TOURS, { [TOUR_ID]: tour });
}

const open = (overrides: Partial<TourViewSessionInput> = {}) =>
  openTourViewSession(db, { subject: SUBJECT, actor: null, openedShareId: null, presentedGrant: null, nowMs: NOW, ...overrides });

beforeEach(() => {
  process.env.SHARE_ACCESS_SECRET = 'test-secret-with-enough-entropy-0123456789abcdef';
  kit = createMockFirestore();
  db = kit.instance as unknown as Firestore;
});

describe('Β — οι βάσεις', () => {
  it('Β1 — δημοσιευμένη public ⇒ ανώνυμος βλέπει, με κουπόνι', async () => {
    seed(tourDoc({ visibility: 'public' }));
    const outcome = await open();
    expect(outcome).toMatchObject({ kind: 'granted', grant: { basis: 'public', tourId: TOUR_ID } });
    expect(outcome.kind === 'granted' && outcome.token).toBeTruthy();
  });

  it('Β2 — on-request + ανώνυμος ⇒ sign-in-required · + συνδεδεμένος χωρίς έγκριση ⇒ not-viewable', async () => {
    seed();
    expect(await open()).toEqual({ kind: 'refused', reason: 'sign-in-required' });
    expect(await open({ actor: buyer('dora') })).toEqual({ kind: 'refused', reason: 'not-viewable' });
  });

  it('Β3 — εγκεκριμένο αίτημα ⇒ βάση request με το id του αιτήματος', async () => {
    seed();
    kit.seedCollection(REQUESTS, { [requestIdOf('dora')]: approvedRequest('dora') });
    expect(await open({ actor: buyer('dora') })).toMatchObject({ kind: 'granted', grant: { basis: 'request', basisId: requestIdOf('dora') } });
  });

  it('Β4 — ανακλημένο αίτημα ⇒ not-viewable (η ανάκληση κόβει στην επόμενη επίσκεψη)', async () => {
    seed();
    kit.seedCollection(REQUESTS, { [requestIdOf('dora')]: approvedRequest('dora', { revokedAt: new Date(NOW - DAY).toISOString(), revokedBy: 'boris' }) });
    expect(await open({ actor: buyer('dora') })).toEqual({ kind: 'refused', reason: 'not-viewable' });
  });

  it('Β5 — ο υπεύθυνος βλέπει ακόμη και αποσυρμένη', async () => {
    seed(tourDoc({ lifecycle: 'withdrawn' }));
    expect(await open({ actor: MANAGER })).toMatchObject({ kind: 'granted', grant: { basis: 'manager' } });
  });

  it('Β6 — περιήγηση προηγούμενου κατόχου ⇒ tour-custody-mismatch (ποτέ θέαση)', async () => {
    seed(tourDoc({ companyId: 'comp_previous', visibility: 'public' }));
    expect(await open()).toEqual({ kind: 'refused', reason: 'tour-custody-mismatch' });
  });
});

describe('Ι — μία επίσκεψη, μία μέτρηση', () => {
  it('Ι1 — πρώτη επίσκεψη μετρά· με ζωντανό κουπόνι ίδιας βάσης ΔΕΝ ξαναμετρά', async () => {
    seed();
    kit.seedCollection(REQUESTS, { [requestIdOf('dora')]: approvedRequest('dora') });
    const first = await open({ actor: buyer('dora') });
    expect(kit.getData(REQUESTS, requestIdOf('dora'))).toMatchObject({ viewCount: 1 });
    const grant = first.kind === 'granted' ? first.grant : null;
    await open({ actor: buyer('dora'), presentedGrant: grant });
    expect(kit.getData(REQUESTS, requestIdOf('dora'))).toMatchObject({ viewCount: 1 });
    await open({ actor: buyer('dora') });
    expect(kit.getData(REQUESTS, requestIdOf('dora'))?.viewCount).toBe(2);
  });

  it('Ι2 — δημόσια βάση και υπεύθυνος δεν γράφουν τίποτα', async () => {
    seed(tourDoc({ visibility: 'public' }));
    kit.clearWrites();
    await open();
    await open({ actor: MANAGER });
    expect(kit.writes()).toEqual([]);
  });
});

describe('Σ — ο σύνδεσμος', () => {
  const share = (overrides: Record<string, unknown> = {}) => ({
    entityType: 'spatial_tour', entityId: TOUR_ID, companyId: AGENCY, createdBy: 'boris', isActive: true,
    expiresAt: new Date(NOW + DAY).toISOString(), ...overrides,
  });

  it('Σ1 — ενεργός σύνδεσμος αυτής της περιήγησης ⇒ βάση link, και σε πρόχειρη', async () => {
    seed(tourDoc({ lifecycle: 'draft', visibility: 'link-only' }));
    kit.seedCollection(COLLECTIONS.SHARES, { share_1: share() });
    expect(await open({ openedShareId: 'share_1' })).toMatchObject({ kind: 'granted', grant: { basis: 'link', basisId: 'share_1' } });
  });

  it.each([
    ['ανακλημένος', { isActive: false }],
    ['ληγμένος', { expiresAt: new Date(NOW - 1000).toISOString() }],
    ['άλλης περιήγησης', { entityId: 'stour_other' }],
    ['άλλου είδους', { entityType: 'contact' }],
  ])('Σ2 — %s σύνδεσμος ⇒ not-viewable', async (_name, overrides) => {
    seed(tourDoc({ visibility: 'link-only' }));
    kit.seedCollection(COLLECTIONS.SHARES, { share_1: share(overrides) });
    expect(await open({ openedShareId: 'share_1' })).toEqual({ kind: 'refused', reason: 'not-viewable' });
  });
});

describe('Μ — το μανιφέστο', () => {
  it('Μ1 — μόνο κοινό αγγελίας, τοποθετημένη, πιο πρόσφατη ανά κόμβο, με έτοιμο tileset', async () => {
    seed(tourDoc({ visibility: 'public' }));
    kit.seedCollection(CAPTURES, {
      tcap_old: capture({ capturedAt: '2026-09-01T10:00:00.000Z', tileset: { state: 'ready', contentHash: 'old' } }),
      tcap_new: capture({ capturedAt: '2026-09-22T10:00:00.000Z', tileset: { state: 'ready', contentHash: 'new' } }),
      tcap_team: capture({ nodeId: 'tnod_2', audience: 'project-team' }),
      tcap_unplaced: capture({ nodeId: null }),
      tcap_pending: capture({ nodeId: 'tnod_3', tileset: { state: 'pending', contentHash: null } }),
    });
    const outcome = await open();
    if (outcome.kind !== 'granted') throw new Error('expected granted');
    expect(outcome.manifest.stops.map((stop) => [stop.captureId, stop.tilesetHash])).toEqual([['tcap_new', 'new']]);
    expect(outcome.manifest).toMatchObject({ tourId: TOUR_ID, label: 'Διαμέρισμα Α2', ready: true });
  });

  it('Μ2 — χωρίς έτοιμο tileset ⇒ ready: false (η οθόνη λέει «ετοιμάζεται»)', async () => {
    seed(tourDoc({ visibility: 'public' }));
    kit.seedCollection(CAPTURES, { tcap_1: capture({ tileset: { state: 'pending', contentHash: null } }) });
    const outcome = await open();
    expect(outcome.kind === 'granted' && outcome.manifest.ready).toBe(false);
  });
});
