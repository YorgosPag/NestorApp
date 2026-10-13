/**
 * @jest-environment node
 *
 * @fileoverview **ΟΙ ΤΕΣΣΕΡΙΣ ΓΡΑΦΕΙΣ ΚΑΛΟΥΝ ΤΟΝ ΕΝΑ ΔΡΟΜΟ** — ADR-777 §8.88 · ADR-884 · CHECK 3.104.
 * @related services/listings/listing-tour-refresh.ts · tour-settings.ts · tour-graph-write.ts · tour-tileset-state.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: η πύλη 3.104 βλέπει ότι κάθε γραφέας **αναφέρει** τον δρόμο επαναπροβολής· αυτή η σουίτα **εκτελεί**
 * τους γραφείς και ρωτά ό,τι η στατική ανάλυση δεν μπορεί: καλείται **μετά** το commit (ο κριτής πρέπει να διαβάσει
 * ό,τι γράφτηκε), **μόνο** όταν γράφτηκε κάτι, και με τη σωστή ρίζα ή περιήγηση.
 *
 * 🔑 Ο δρόμος είναι **mock επίτηδες**: η δική του κρίση (πρώιμη αποκοπή, ποιος γραφέας ανά ρίζα) έχει δική της σουίτα
 * (`listing-tour-refresh.test.ts`). Εδώ κρίνεται η **καλωδίωση**.
 */

jest.mock('server-only', () => ({}));

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { TourSubject } from '@/types/spatial-tour';

/** Τι είχε **ήδη** γραφτεί στη βάση τη στιγμή που κλήθηκε ο δρόμος — η απόδειξη του «μετά το commit». */
const seenAtRefresh: unknown[] = [];
let observe: () => unknown = () => undefined;

const refreshListingAfterTourChange = jest.fn(async (..._args: unknown[]): Promise<string> => {
  seenAtRefresh.push(observe());
  return 'unchanged';
});
const refreshListingOfTour = jest.fn(async (..._args: unknown[]): Promise<string> => {
  seenAtRefresh.push(observe());
  return 'unchanged';
});
jest.mock('@/services/listings/listing-tour-refresh', () => ({
  refreshListingAfterTourChange: (...args: unknown[]) => refreshListingAfterTourChange(...args),
  refreshListingOfTour: (...args: unknown[]) => refreshListingOfTour(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { updateTourSettings } = require('../tour-settings') as typeof import('../tour-settings');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { recordFaceScan, writeTourGraph } = require('../tour-graph-write') as typeof import('../tour-graph-write');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { transitionTileset } = require('../tour-tileset-state') as typeof import('../tour-tileset-state');

const AGENCY = 'comp_agency';
const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const TOURS = COLLECTIONS.SPATIAL_TOURS;
const CAPTURES = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURES}`;
const L0 = { kind: 'local', ordinal: 0 } as const;

const MANAGER: TourActor = {
  listing: { uid: 'boris', companyId: AGENCY },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};
const STRANGER: TourActor = {
  listing: { uid: 'carl', companyId: 'comp_rival' },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};

const tourDoc = (overrides: Record<string, unknown> = {}) => ({
  companyId: AGENCY, subject: SUBJECT, visibility: 'public', lifecycle: 'draft', levels: [], nodes: [], revision: 0,
  createdAt: '2026-09-01T10:00:00.000Z', createdBy: 'boris', updatedAt: '2026-09-01T10:00:00.000Z', updatedBy: 'boris',
  ...overrides,
});

const captureDoc = (overrides: Record<string, unknown> = {}) => ({
  tourId: TOUR_ID, nodeId: null, capturedAt: '2026-09-20T10:00:00.000Z', headingRad: 0, source: 'camera-360',
  provenance: 'as-built', baseCaptureId: null, signatory: null, audience: 'public-listing', milestone: null,
  originalFileId: 'file_1', uploadedBy: 'uid_photo', createdAt: '2026-09-20T10:05:00.000Z',
  rights: {
    creator: { name: 'Φωτογράφος', userId: null, url: null }, licensors: [], copyrightNotice: '© 2026 Φωτογράφος',
    webStatementOfRights: null, license: { purpose: 'listing-marketing', term: { kind: 'perpetual' } },
  },
  tileset: { state: 'ready', contentHash: 'h1', faceSize: 2048 },
  ...overrides,
});

let kit: FakeFirestore;
let db: Firestore;

const captureRef = (id = 'tcap_1') => db.collection(CAPTURES).doc(id) as unknown as DocumentReference;

beforeEach(() => {
  jest.clearAllMocks();
  seenAtRefresh.length = 0;
  observe = () => undefined;
  kit = new FakeFirestore();
  db = kit as unknown as Firestore;
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY, name: 'Α2' } });
});

describe('ρυθμίσεις — ορατότητα και κύκλος ζωής ΕΙΝΑΙ η απάντηση', () => {
  it('🔴 αλλαγή ⇒ ο δρόμος καλείται ΜΙΑ φορά, με τη ρίζα, ΑΦΟΥ γράφτηκε η νέα ορατότητα', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    observe = () => (kit.getData(TOURS, TOUR_ID) as { visibility: string }).visibility;

    await updateTourSettings(db, { subject: SUBJECT, actor: MANAGER, settings: { visibility: 'on-request', lifecycle: 'draft' } });

    expect(refreshListingAfterTourChange).toHaveBeenCalledTimes(1);
    expect(refreshListingAfterTourChange).toHaveBeenCalledWith(db, SUBJECT);
    expect(seenAtRefresh).toEqual(['on-request']);
  });

  it('ίδιες τιμές (`unchanged`) ⇒ ΚΑΜΙΑ κλήση — διπλό κλικ δεν ξαναδημοσιεύει', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    await updateTourSettings(db, { subject: SUBJECT, actor: MANAGER, settings: { visibility: 'public', lifecycle: 'draft' } });
    expect(refreshListingAfterTourChange).not.toHaveBeenCalled();
  });

  it('άρνηση ⇒ καμία κλήση', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    await updateTourSettings(db, { subject: SUBJECT, actor: STRANGER, settings: { visibility: 'on-request', lifecycle: 'draft' } });
    expect(refreshListingAfterTourChange).not.toHaveBeenCalled();
  });
});

describe('γράφος — τοποθέτηση λήψης γεννά στάση θεατή', () => {
  it('🔴 `place` ⇒ ο δρόμος καλείται με τη ρίζα, ΑΦΟΥ η λήψη πήρε κόμβο', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    kit.seedCollection(CAPTURES, { tcap_1: captureDoc() });
    observe = () => (kit.getData(CAPTURES, 'tcap_1') as { nodeId: string | null }).nodeId !== null;

    const outcome = await writeTourGraph(db, {
      subject: SUBJECT, actor: MANAGER,
      command: { op: 'place', captureId: 'tcap_1', target: { kind: 'new-node', levelKey: L0, linkFrom: null } },
    });

    expect(outcome.kind).toBe('written');
    expect(refreshListingAfterTourChange).toHaveBeenCalledTimes(1);
    expect(refreshListingAfterTourChange).toHaveBeenCalledWith(db, SUBJECT);
    expect(seenAtRefresh).toEqual([true]);
  });

  it('άρνηση (λήψη που δεν υπάρχει) ⇒ καμία κλήση', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    const outcome = await writeTourGraph(db, {
      subject: SUBJECT, actor: MANAGER,
      command: { op: 'place', captureId: 'tcap_x', target: { kind: 'new-node', levelKey: L0, linkFrom: null } },
    });
    expect(outcome.kind).toBe('refused');
    expect(refreshListingAfterTourChange).not.toHaveBeenCalled();
  });
});

describe('tileset — το `ready` είναι η στιγμή που γεννιέται η στάση', () => {
  const PENDING = { state: 'pending', contentHash: 'h1', faceSize: null };

  it('🔴 `pending → ready` ⇒ ο δρόμος καλείται με την ΠΕΡΙΗΓΗΣΗ της λήψης, ΑΦΟΥ γράφτηκε το `ready`', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    kit.seedCollection(CAPTURES, { tcap_1: captureDoc({ tileset: PENDING }) });
    observe = () => (kit.getData(CAPTURES, 'tcap_1') as { tileset: { state: string } }).tileset.state;

    await expect(transitionTileset(db, captureRef(), 'h1', { to: 'ready', faceSize: 2048 })).resolves.toBe('written');

    expect(refreshListingOfTour).toHaveBeenCalledTimes(1);
    expect((refreshListingOfTour.mock.calls[0][1] as DocumentReference).id).toBe(TOUR_ID);
    expect(seenAtRefresh).toEqual(['ready']);
  });

  it('`pending → failed` επίσης (η στάση μπορεί να ΧΑΘΗΚΕ μετά από θόλωμα)', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    kit.seedCollection(CAPTURES, { tcap_1: captureDoc({ tileset: PENDING }) });
    await transitionTileset(db, captureRef(), 'h1', { to: 'failed' });
    expect(refreshListingOfTour).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ήδη `ready` (δεύτερος ψήστης)', { state: 'ready', contentHash: 'h1', faceSize: 2048 }, 'h1', 'not-pending'],
    ['άλλο περιεχόμενο στο μεταξύ', PENDING, 'h_άλλο', 'hash-changed'],
  ] as const)('%s ⇒ τίποτα δεν γράφτηκε, καμία κλήση', async (_name, tileset, baked, expected) => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    kit.seedCollection(CAPTURES, { tcap_1: captureDoc({ tileset }) });
    await expect(transitionTileset(db, captureRef(), baked, { to: 'ready', faceSize: 2048 })).resolves.toBe(expected);
    expect(refreshListingOfTour).not.toHaveBeenCalled();
  });
});

describe('σάρωση προσώπων — αυτόματο θόλωμα γυρίζει μια έτοιμη λήψη σε `pending`', () => {
  it('🔴 καταγραφή ⇒ ο δρόμος καλείται με την περιήγηση', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    kit.seedCollection(CAPTURES, { tcap_1: captureDoc() });

    const outcome = await recordFaceScan(db, captureRef(), { expectedKey: 'h1', faces: [{ yawRad: 0.5, pitchRad: 0.1, radiusRad: 0.2 }] });

    expect(outcome.kind).toBe('recorded');
    expect(refreshListingOfTour).toHaveBeenCalledTimes(1);
    expect((refreshListingOfTour.mock.calls[0][1] as DocumentReference).id).toBe(TOUR_ID);
  });

  it('`superseded` (άλλος ψήστης πρόλαβε) ⇒ καμία κλήση', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    kit.seedCollection(CAPTURES, { tcap_1: captureDoc() });
    await expect(recordFaceScan(db, captureRef(), { expectedKey: 'k_παλιό', faces: [] })).resolves.toEqual({ kind: 'superseded' });
    expect(refreshListingOfTour).not.toHaveBeenCalled();
  });
});
