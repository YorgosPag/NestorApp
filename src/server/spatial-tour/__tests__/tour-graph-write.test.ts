/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΓΡΑΦΕΑΣ ΤΟΥ ΓΡΑΦΟΥ** (ADR-884 Φ2β · §4.9) — ενσωμάτωση πάνω στον κοινό mock.
 *
 * - **Π** — πόρτα: μόνο ο υπεύθυνος· ο φωτογράφος (με άδεια λήψης) **δεν** οργανώνει.
 * - **Τ** — τοποθέτηση από άκρη σε άκρη: λήψη ⇒ σημείο ⇒ `revision + 1` ⇒ ο κριτής των στάσεων τη βλέπει (με έτοιμο tileset).
 * - **Α** — αφαίρεση της τελευταίας λήψης ⇒ φεύγει το σημείο· με δεύτερη λήψη ⇒ μένει.
 * - **Ο** — όριο κόμβων ⇒ ονομασμένη άρνηση, καμία εγγραφή.
 */

jest.mock('server-only', () => ({}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { MAX_TOUR_NODES } from '@/constants/spatial-tour-vocabulary';
import { spatialTourFromDocument, tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import type { TourGraphCommand } from '@/lib/spatial-tour/tour-graph-edit';

import { writeTourGraph } from '../tour-graph-write';
import { viewerStops } from '../tour-viewer-stops';

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
const PHOTOGRAPHER: TourActor = { listing: { uid: 'uid_photo', companyId: null }, capability: { globalRole: 'external_user', permissions: [] } };

let kit: MockFirestoreKit;
let db: Firestore;

function tourDoc(overrides: Record<string, unknown> = {}) {
  return {
    companyId: AGENCY, subject: SUBJECT, visibility: 'public', lifecycle: 'draft', levels: [], nodes: [], revision: 3,
    createdAt: '2026-09-01T10:00:00.000Z', createdBy: 'boris', updatedAt: '2026-09-01T10:00:00.000Z', updatedBy: 'boris',
    ...overrides,
  };
}

function captureDoc(overrides: Record<string, unknown> = {}) {
  return {
    tourId: TOUR_ID, nodeId: null, capturedAt: '2026-09-20T10:00:00.000Z', headingRad: 0, source: 'camera-360',
    provenance: 'as-built', baseCaptureId: null, signatory: null, audience: 'public-listing', milestone: null,
    originalFileId: 'file_1', uploadedBy: 'uid_photo', createdAt: '2026-09-20T10:05:00.000Z',
    rights: {
      creator: { name: 'Φωτογράφος', userId: null, url: null }, licensors: [], copyrightNotice: '© 2026 Φωτογράφος',
      webStatementOfRights: null, license: { purpose: 'listing-marketing', term: { kind: 'perpetual' } },
    },
    tileset: { state: 'ready', contentHash: 'h1', faceSize: 2048 },
    ...overrides,
  };
}

beforeEach(() => {
  kit = createMockFirestore();
  db = kit.instance as unknown as Firestore;
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY, name: 'Διαμέρισμα Α2' } });
  kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
  kit.seedCollection(CAPTURES, { tcap_1: captureDoc(), tcap_2: captureDoc() });
});

const write = (command: TourGraphCommand, actor: TourActor = MANAGER) => writeTourGraph(db, { subject: SUBJECT, actor, command });
async function readTour() {
  const snap = await db.collection(TOURS).doc(TOUR_ID).get();
  return spatialTourFromDocument(snap.data(), TOUR_ID)!;
}
async function readCapture(id: string) {
  const snap = await db.collection(CAPTURES).doc(id).get();
  return tourCaptureFromDocument(snap.data(), id)!;
}
const placeNew = (captureId: string, linkFrom: string | null = null): TourGraphCommand =>
  ({ op: 'place', captureId, target: { kind: 'new-node', levelKey: L0, linkFrom } });

describe('Π — πόρτα', () => {
  it('ο φωτογράφος δεν οργανώνει τον γράφο', async () => {
    expect(await write(placeNew('tcap_1'), PHOTOGRAPHER)).toEqual({ kind: 'refused', reason: 'not-manager' });
    expect((await readTour()).nodes).toEqual([]);
  });
});

describe('Τ — τοποθέτηση', () => {
  it('λήψη ⇒ νέο σημείο ⇒ revision + 1 ⇒ ο κριτής των στάσεων τη βλέπει', async () => {
    expect(await write(placeNew('tcap_1'))).toEqual({ kind: 'written', revision: 4 });
    const tour = await readTour();
    expect(tour.nodes).toHaveLength(1);
    const capture = await readCapture('tcap_1');
    expect(capture.nodeId).toBe(tour.nodes[0].id);
    expect(viewerStops([capture]).map((s) => s.nodeId)).toEqual([tour.nodes[0].id]);
  });

  it('δεύτερη λήψη «δίπλα στην πρώτη» + βελάκι ⇒ περπατιέται', async () => {
    await write(placeNew('tcap_1'));
    const first = (await readTour()).nodes[0].id;
    await write(placeNew('tcap_2', first));
    const second = (await readCapture('tcap_2')).nodeId!;
    expect(await write({ op: 'link', fromNodeId: first, toNodeId: second, bearingRad: 1.2 })).toEqual({ kind: 'written', revision: 6 });
    const nodes = (await readTour()).nodes;
    expect(nodes.find((n) => n.id === first)?.links).toEqual([{ toNodeId: second, via: 'manual', bearingRad: 1.2 }]);
    expect(nodes.find((n) => n.id === second)?.links).toEqual([{ toNodeId: first, via: 'manual', bearingRad: null }]);
  });

  it('άγνωστη λήψη ⇒ άρνηση, καμία εγγραφή', async () => {
    expect(await write(placeNew('tcap_zz'))).toEqual({ kind: 'refused', reason: 'capture-absent' });
    expect((await readTour()).revision).toBe(3);
  });

  it('λήψη που ψήνεται ⇒ capture-not-ready, ούτε σημείο ούτε nodeId (Φ2δ · §4.10)', async () => {
    kit.seedCollection(CAPTURES, { tcap_3: captureDoc({ tileset: { state: 'pending', contentHash: null, faceSize: null } }) });
    expect(await write(placeNew('tcap_3'))).toEqual({ kind: 'refused', reason: 'capture-not-ready' });
    expect((await readTour()).revision).toBe(3);
    expect((await readCapture('tcap_3')).nodeId).toBeNull();
  });
});

describe('Α — αφαίρεση', () => {
  it('τελευταία λήψη του σημείου ⇒ φεύγει και το σημείο', async () => {
    await write(placeNew('tcap_1'));
    await write({ op: 'unplace', captureId: 'tcap_1' });
    expect((await readTour()).nodes).toEqual([]);
    expect((await readCapture('tcap_1')).nodeId).toBeNull();
  });

  it('δεύτερη λήψη στο ίδιο σημείο ⇒ το σημείο μένει', async () => {
    await write(placeNew('tcap_1'));
    const nodeId = (await readTour()).nodes[0].id;
    await write({ op: 'place', captureId: 'tcap_2', target: { kind: 'node', nodeId } });
    await write({ op: 'unplace', captureId: 'tcap_1' });
    expect((await readTour()).nodes.map((n) => n.id)).toEqual([nodeId]);
  });
});

describe('Ο — όριο κόμβων', () => {
  it('γεμάτη περιήγηση ⇒ graph-full, καμία εγγραφή', async () => {
    const nodes = Array.from({ length: MAX_TOUR_NODES }, (_, i) => ({ id: `tnod_${i}`, levelKey: L0, position: null, links: [] }));
    const levels = [{ key: L0, floorPlans: [{ source: 'none', state: 'active', fileId: null, approvedBy: null, approvedAt: null }] }];
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc({ nodes, levels }) });
    expect(await write(placeNew('tcap_1'))).toEqual({ kind: 'refused', reason: 'graph-full' });
    expect((await readCapture('tcap_1')).nodeId).toBeNull();
  });
});

describe('Χ — ο χώρος ενός σημείου μέσα από τον ΕΝΑ γραφέα (Φ2στ · §4.12)', () => {
  it('όνομα ⇒ revision + 1 ⇒ διαβάζεται πίσω ίδιο· ίδιο ξανά ⇒ unchanged', async () => {
    await write(placeNew('tcap_1'));
    const nodeId = (await readTour()).nodes[0].id;
    const name: TourGraphCommand = { op: 'name', nodeId, room: { types: ['office'], label: ' Γραφείο ' } };
    expect(await write(name)).toEqual({ kind: 'written', revision: 5 });
    expect((await readTour()).nodes[0].room).toEqual({ types: ['office'], label: 'Γραφείο', source: 'manual' });
    expect(await write(name)).toEqual({ kind: 'unchanged', revision: 5 });
  });

  it('άκυρος χώρος ⇒ room-invalid, καμία εγγραφή', async () => {
    await write(placeNew('tcap_1'));
    const nodeId = (await readTour()).nodes[0].id;
    expect(await write({ op: 'name', nodeId, room: { types: ['throne-room'], label: null } }))
      .toEqual({ kind: 'refused', reason: 'room-invalid' });
    expect((await readTour()).revision).toBe(4);
  });
});
