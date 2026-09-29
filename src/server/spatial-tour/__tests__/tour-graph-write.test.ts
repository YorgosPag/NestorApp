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
import { MAX_TOUR_NODES, MAX_TOUR_SPACES_PER_LEVEL, TOUR_FACE_DETECTOR_VERSION } from '@/constants/spatial-tour-vocabulary';
import { spatialTourFromDocument, tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import type { TourGraphCommand } from '@/lib/spatial-tour/tour-graph-edit';

import type { DocumentReference } from 'firebase-admin/firestore';

import { isRebakingAfterRedaction } from '@/lib/spatial-tour/tour-manifest-stop';

import { recordFaceScan, writeTourGraph } from '../tour-graph-write';
import { tilesetKeyOf } from '../tour-redaction-apply';
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

describe('Κ — κάτοψη, κλίμακα, θέση, προσανατολισμός (Φ2στ-β · §4.13)', () => {
  const NONE = { source: 'none', state: 'active', fileId: null, approvedBy: null, approvedAt: null };
  const PLACED_NODES = [
    { id: 'tnod_a', levelKey: L0, position: null, links: [{ toNodeId: 'tnod_b', via: 'manual', bearingRad: 1 }] },
    { id: 'tnod_b', levelKey: L0, position: null, links: [{ toNodeId: 'tnod_a', via: 'manual', bearingRad: 4 }] },
  ];

  beforeEach(() => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc({ levels: [{ key: L0, floorPlans: [NONE] }], nodes: PLACED_NODES }) });
    kit.seedCollection(CAPTURES, { tcap_1: captureDoc({ nodeId: 'tnod_a', headingRad: 0.5 }), tcap_2: captureDoc({ nodeId: 'tnod_b' }) });
  });

  it('orient: η λήψη παίρνει νέα κατεύθυνση (manual) ΚΑΙ τα βελάκια του σημείου στρέφονται κατά την ίδια Δ — μία συναλλαγή', async () => {
    expect(await write({ op: 'orient', captureId: 'tcap_1', headingRad: 1.5 })).toEqual({ kind: 'written', revision: 4 });
    const capture = await readCapture('tcap_1');
    expect(capture.headingRad).toBeCloseTo(1.5);
    expect(capture.headingSource).toBe('manual');
    const tour = await readTour();
    expect(tour.nodes.find((n) => n.id === 'tnod_a')?.links[0].bearingRad).toBeCloseTo(2);
    expect(tour.nodes.find((n) => n.id === 'tnod_b')?.links[0].bearingRad).toBe(4);
  });

  it('orient σε ατοποθέτητη λήψη ⇒ capture-unplaced, καμία εγγραφή', async () => {
    kit.seedCollection(CAPTURES, { tcap_3: captureDoc() });
    expect(await write({ op: 'orient', captureId: 'tcap_3', headingRad: 1 })).toEqual({ kind: 'refused', reason: 'capture-unplaced' });
    expect((await readTour()).revision).toBe(3);
  });

  it('θέση χωρίς βαθμονομημένη κάτοψη ⇒ plan-uncalibrated · κλίμακα χωρίς εικόνα ⇒ plan-absent', async () => {
    expect(await write({ op: 'position', nodeId: 'tnod_a', point: { x: 1, y: -1 } })).toEqual({ kind: 'refused', reason: 'plan-uncalibrated' });
    expect(await write({ op: 'calibrate', levelKey: L0, metresPerPixel: 0.02 })).toEqual({ kind: 'refused', reason: 'plan-absent' });
    expect((await readTour()).revision).toBe(3);
  });

  it('κάτοψη από αρχείο ΑΛΛΟΥ ακινήτου ⇒ plan-not-eligible (ο ίδιος κριτής με τη λίστα της οθόνης)', async () => {
    kit.seedCollection(COLLECTIONS.FILES, {
      file_other: {
        companyId: AGENCY, entityType: 'property', entityId: 'prop_OTHER', category: 'floorplans', domain: 'sales', status: 'ready',
        contentType: 'image/png', storagePath: 'companies/x/plan.png', displayName: 'Κάτοψη', originalFilename: 'plan.png', ext: 'png',
        createdAt: '2026-09-01T10:00:00.000Z', createdBy: 'boris',
      },
    });
    const pick: TourGraphCommand = { op: 'floorplan', levelKey: L0, plan: { fileId: 'file_other', source: 'engineer' } };
    expect(await write(pick)).toEqual({ kind: 'refused', reason: 'plan-not-eligible' });
    expect(await write({ ...pick, plan: { fileId: 'file_missing', source: 'engineer' } })).toEqual({ kind: 'refused', reason: 'plan-not-eligible' });
    expect((await readTour()).revision).toBe(3);
  });

  it('«χωρίς κάτοψη» σε όροφο που ήδη δεν έχει ⇒ unchanged', async () => {
    expect(await write({ op: 'floorplan', levelKey: L0, plan: null })).toEqual({ kind: 'unchanged', revision: 3 });
  });
});

// Γ3β — τα σχήματα των χώρων μέσα από τον ΕΝΑ γραφέα: ο διακομιστής ΞΑΝΑΚΡΙΝΕΙ ό,τι στέλνει η οθόνη.
describe('Σ — σχήματα χώρων + νοητές γραμμές (Φ2στ-γ Γ3β · §4.14)', () => {
  const PLAN = {
    source: 'engineer', state: 'active', fileId: 'f1', approvedBy: 'boris', approvedAt: '2026-09-01T10:00:00.000Z',
    image: { width: 1000, height: 500, contentHash: 'h1' },
    scale: { metresPerPixel: 0.02, calibratedBy: 'boris', calibratedAt: '2026-09-01T10:00:00.000Z' },
  };
  const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  const S1 = 'tspc_11111111-1111-4111-8111-111111111111';
  const S2 = 'tspc_22222222-2222-4222-8222-222222222222';
  const G1 = 'tsep_11111111-1111-4111-8111-111111111111';
  const space = (points = rect(1, -1, 5, -4), spaceId = S1): TourGraphCommand =>
    ({ op: 'space', levelKey: L0, spaceId, mode: 'create', space: { points, source: 'detected', room: null, declaredArea: null } });

  beforeEach(() => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc({ levels: [{ key: L0, floorPlans: [PLAN] }] }) });
  });

  it('νέος χώρος ⇒ το id του ΠΕΛΑΤΗ γράφεται αυτούσιο (Γ3γ-2α) · έγκριση = ο υπεύθυνος · revision + 1', async () => {
    expect(await write(space())).toEqual({ kind: 'written', revision: 4 });
    const [stored] = (await readTour()).levels[0].spaces ?? [];
    expect(stored).toMatchObject({ id: S1, approvedBy: 'boris', source: 'detected' });
  });

  it('επανάληψη του ΙΔΙΟΥ create ⇒ unchanged (ένας χώρος) · id άλλου είδους ⇒ space-invalid, καμία εγγραφή', async () => {
    await write(space());
    expect(await write(space())).toEqual({ kind: 'unchanged', revision: 4 });
    expect(await write(space(rect(10, -6, 12, -8), G1))).toEqual({ kind: 'refused', reason: 'space-invalid' });
    expect((await readTour()).levels[0].spaces).toHaveLength(1);
  });

  it('πελάτης με αυτοτεμνόμενο ή επικαλυπτόμενο σχήμα ⇒ ονομασμένη άρνηση, καμία εγγραφή', async () => {
    await write(space());
    const bowtie = [{ x: 6, y: -1 }, { x: 9, y: -4 }, { x: 9, y: -1 }, { x: 6, y: -4 }];
    expect(await write(space(bowtie, S2))).toEqual({ kind: 'refused', reason: 'space-invalid' });
    expect(await write(space(rect(4, -1, 8, -4), S2))).toEqual({ kind: 'refused', reason: 'space-overlap' });
    expect((await readTour()).revision).toBe(4);
  });

  it('νοητή γραμμή με id πελάτη `tsep_` · αφαίρεση ⇒ ο όροφος ξαναγίνεται όπως πριν', async () => {
    const outcome = await write({ op: 'separate', levelKey: L0, separationId: G1, mode: 'create', a: { x: 5, y: -1 }, b: { x: 5, y: -4 } });
    expect(outcome).toEqual({ kind: 'written', revision: 4 });
    expect((await readTour()).levels[0].separations?.[0].id).toBe(G1);
    expect(await write({ op: 'unseparate', levelKey: L0, separationId: G1 })).toMatchObject({ kind: 'written' });
    expect((await readTour()).levels[0]).not.toHaveProperty('separations');
  });

  it('γεμάτος όροφος (80 χώροι) ⇒ graph-full, καμία εγγραφή', async () => {
    const spaces = Array.from({ length: MAX_TOUR_SPACES_PER_LEVEL }, (_, i) => ({
      id: `tspc_${i}`, source: 'manual', approvedBy: 'boris', approvedAt: '2026-09-01T10:00:00.000Z',
      points: rect(0.2 * (i % 40), -0.2 * Math.floor(i / 40) - 5, 0.2 * (i % 40) + 0.19, -0.2 * Math.floor(i / 40) - 5.19),
    }));
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc({ levels: [{ key: L0, floorPlans: [PLAN], spaces }] }) });
    expect(await write(space(rect(12, -1, 16, -4)))).toEqual({ kind: 'refused', reason: 'graph-full' });
  });
});

describe('Θ — θόλωμα (Φ2ζ · §4.15 · Α8)', () => {
  const R1 = enterpriseIdService.generateTourRedactionId();
  const REGION = { yawRad: 0.5, pitchRad: 0.1, radiusRad: 0.2 };
  const redact = (mode: 'create' | 'replace' = 'create', region = REGION, redactionId = R1): TourGraphCommand =>
    ({ op: 'redact', captureId: 'tcap_1', redactionId, mode, region });

  it('νέα περιοχή ⇒ revision + 1 · νέο κλειδί σε pending (fail-closed) · το παλιό αποσύρεται · ψήσιμο ζητείται', async () => {
    const outcome = await write(redact());
    expect(outcome).toMatchObject({ kind: 'written', revision: 4 });
    expect(outcome).toHaveProperty('rebakeCapture');
    const capture = await readCapture('tcap_1');
    const key = tilesetKeyOf('h1', capture.redactions ?? []);
    expect(capture.redactions).toEqual([{ id: R1, ...REGION, source: 'manual', createdBy: 'boris', createdAt: expect.any(String) }]);
    expect(capture.originalHash).toBe('h1');
    expect(capture.tileset).toEqual({ state: 'pending', contentHash: key, faceSize: null, retiredKeys: ['h1'] });
    expect(key).not.toBe('h1');
    expect(viewerStops([{ ...capture, nodeId: 'tnod_x' }])).toEqual([]);
  });

  it('αφαίρεση ⇒ κλειδί ξανά το πρωτότυπο · αποσύρεται το θολωμένο, ΠΟΤΕ το τρέχον', async () => {
    await write(redact());
    const blurredKey = (await readCapture('tcap_1')).tileset.contentHash;
    expect(await write({ op: 'unredact', captureId: 'tcap_1', redactionId: R1 })).toMatchObject({ kind: 'written', revision: 5 });
    const capture = await readCapture('tcap_1');
    expect(capture.redactions).toBeUndefined();
    expect(capture.tileset).toEqual({ state: 'pending', contentHash: 'h1', faceSize: null, retiredKeys: [blurredKey] });
  });

  it('επανάληψη ίδιας περιοχής ⇒ unchanged, κανένα ψήσιμο, καμία εγγραφή', async () => {
    await write(redact());
    expect(await write(redact())).toEqual({ kind: 'unchanged', revision: 4 });
  });

  it('αρνήσεις με όνομα, καμία εγγραφή: φωτογράφος · ξένο id · πέρα από τον πόλο · ανύπαρκτη · άλλη γεωμετρία σε ίδιο id', async () => {
    expect(await write(redact(), PHOTOGRAPHER)).toEqual({ kind: 'refused', reason: 'not-manager' });
    expect(await write(redact('create', REGION, enterpriseIdService.generateTourSpaceId()))).toEqual({ kind: 'refused', reason: 'redaction-invalid' });
    expect(await write(redact('create', { ...REGION, pitchRad: 2 }))).toEqual({ kind: 'refused', reason: 'redaction-invalid' });
    expect(await write(redact('replace'))).toEqual({ kind: 'refused', reason: 'redaction-absent' });
    await write(redact());
    expect(await write(redact('create', { ...REGION, radiusRad: 0.3 }))).toEqual({ kind: 'refused', reason: 'redaction-exists' });
    expect((await readTour()).revision).toBe(4);
  });

  it('άγνωστη λήψη ⇒ capture-absent', async () => {
    expect(await write({ op: 'unredact', captureId: 'tcap_zz', redactionId: R1 })).toEqual({ kind: 'refused', reason: 'capture-absent' });
  });
});

describe('Δ — δέσμη θολώματος (Φ2ζ ζ3 · §4.15 — το «Apply»)', () => {
  const R1 = enterpriseIdService.generateTourRedactionId();
  const R2 = enterpriseIdService.generateTourRedactionId();
  const A = { yawRad: 0.5, pitchRad: 0.1, radiusRad: 0.2 };
  const B = { yawRad: -1, pitchRad: -0.3, radiusRad: 0.1 };
  const batch = (edits: Extract<TourGraphCommand, { op: 'redactions' }>['edits']): TourGraphCommand =>
    ({ op: 'redactions', captureId: 'tcap_1', edits });

  it('δύο νέοι κύκλοι ⇒ ΜΙΑ εγγραφή (revision + 1) · ΕΝΑ νέο κλειδί με ΚΑΙ τους δύο · ΕΝΑ ψήσιμο', async () => {
    const outcome = await write(batch([
      { op: 'redact', redactionId: R1, mode: 'create', region: A },
      { op: 'redact', redactionId: R2, mode: 'create', region: B },
    ]));
    expect(outcome).toMatchObject({ kind: 'written', revision: 4 });
    expect(outcome).toHaveProperty('rebakeCapture');
    const capture = await readCapture('tcap_1');
    expect(capture.redactions?.map((r) => r.id)).toEqual([R1, R2]);
    expect(capture.tileset).toEqual({ state: 'pending', contentHash: tilesetKeyOf('h1', capture.redactions ?? []), faceSize: null, retiredKeys: ['h1'] });
  });

  it('ΑΤΟΜΙΚΗ: μία άρνηση ⇒ καμία αλλαγή, ούτε από τις έγκυρες πριν από αυτήν', async () => {
    expect(await write(batch([
      { op: 'redact', redactionId: R1, mode: 'create', region: A },
      { op: 'redact', redactionId: R2, mode: 'replace', region: B },
    ]))).toEqual({ kind: 'refused', reason: 'redaction-absent' });
    const capture = await readCapture('tcap_1');
    expect(capture.redactions).toBeUndefined();
    expect(capture.tileset.contentHash).toBe('h1');
    expect((await readTour()).revision).toBe(3);
  });

  it('δέσμη που καταλήγει στα ίδια pixel ⇒ καμία επανα-ψήση· επανάληψη ⇒ unchanged', async () => {
    await write(batch([{ op: 'redact', redactionId: R1, mode: 'create', region: A }]));
    const key = (await readCapture('tcap_1')).tileset.contentHash;
    // Αφαίρεση + ξαναγέννηση στο ίδιο id/γεωμετρία: οι περιοχές ξαναγράφονται (νέα σφραγίδα), το κλειδί ΔΕΝ αλλάζει.
    const same = await write(batch([
      { op: 'unredact', redactionId: R1 },
      { op: 'redact', redactionId: R1, mode: 'create', region: A },
    ]));
    expect(same).toEqual({ kind: 'written', revision: 5 });
    expect((await readCapture('tcap_1')).tileset.contentHash).toBe(key);
    expect(await write(batch([{ op: 'redact', redactionId: R1, mode: 'create', region: A }]))).toEqual({ kind: 'unchanged', revision: 5 });
  });
});

describe('Σ — η αυτόματη σάρωση προσώπων μέσα από τον ΕΝΑ γραφέα (Φ2ζ ζ4 · §4.15)', () => {
  const FACE = { yawRad: 0.5, pitchRad: 0.1, radiusRad: 0.2 };
  const OTHER = { yawRad: -1.5, pitchRad: 0, radiusRad: 0.1 };
  const FIRST_BAKE = { state: 'pending', contentHash: 'h1', faceSize: null };
  const ref = (id = 'tcap_1') => db.collection(CAPTURES).doc(id) as unknown as DocumentReference;
  const seed = (overrides: Record<string, unknown>) => kit.seedCollection(CAPTURES, { tcap_1: captureDoc(overrides) });

  it('πρώτο ψήσιμο με πρόσωπα ⇒ auto περιοχές (σύστημα) + νέο κλειδί · ΚΑΝΕΝΑ αποσυρμένο · revision + 1 · ακόμη «πρώτο ψήσιμο»', async () => {
    seed({ tileset: FIRST_BAKE });
    const outcome = await recordFaceScan(db, ref(), { expectedKey: 'h1', faces: [FACE, OTHER] });
    const capture = await readCapture('tcap_1');
    expect(capture.redactions?.map((r) => [r.source, r.createdBy, r.yawRad])).toEqual([['auto', 'system', 0.5], ['auto', 'system', -1.5]]);
    expect(capture.redactions?.every((r) => r.id.startsWith('tred_'))).toBe(true);
    const key = tilesetKeyOf('h1', capture.redactions ?? []);
    expect(capture.tileset).toEqual({ state: 'pending', contentHash: key, faceSize: null });
    expect(capture.originalHash).toBe('h1');
    expect(capture.faceScan).toEqual({ version: TOUR_FACE_DETECTOR_VERSION, faces: 2, added: 2, saturated: false, at: expect.any(String) });
    expect(outcome).toEqual({ kind: 'recorded', key, redactions: capture.redactions, scan: capture.faceScan });
    expect((await readTour()).revision).toBe(4);
    expect(isRebakingAfterRedaction(capture)).toBe(false);
  });

  it('κανένα πρόσωπο ⇒ μόνο το ίχνος · ίδιο κλειδί · καμία αλλαγή γράφου', async () => {
    seed({ tileset: FIRST_BAKE });
    expect(await recordFaceScan(db, ref(), { expectedKey: 'h1', faces: [] })).toMatchObject({ kind: 'recorded', key: 'h1', redactions: [] });
    const capture = await readCapture('tcap_1');
    expect(capture.tileset).toEqual(FIRST_BAKE);
    expect(capture.faceScan).toMatchObject({ faces: 0, added: 0 });
    expect(capture.originalHash).toBeUndefined();
    expect((await readTour()).revision).toBe(3);
  });

  it('πρόσωπο που σκεπάζει ήδη χειροκίνητη περιοχή ⇒ δεν προστίθεται δεύτερη', async () => {
    const manual = { id: enterpriseIdService.generateTourRedactionId(), ...FACE, radiusRad: 0.4, source: 'manual', createdBy: 'boris', createdAt: '2026-09-29T10:00:00.000Z' };
    const key = tilesetKeyOf('h1', [manual as never]);
    seed({ originalHash: 'h1', redactions: [manual], tileset: { state: 'pending', contentHash: key, faceSize: null, retiredKeys: ['h0'] } });
    expect(await recordFaceScan(db, ref(), { expectedKey: key, faces: [FACE] })).toMatchObject({ kind: 'recorded', key });
    const capture = await readCapture('tcap_1');
    expect(capture.redactions?.map((r) => r.source)).toEqual(['manual']);
    expect(capture.faceScan).toMatchObject({ faces: 1, added: 0 });
  });

  it('λήψη που δημοσιεύτηκε (backfill) ⇒ το τρέχον κλειδί αποσύρεται — τα πλακίδιά του έδειχναν το πρόσωπο', async () => {
    seed({ tileset: { state: 'pending', contentHash: 'k_old', faceSize: null, retiredKeys: ['h1'] }, originalHash: 'h1' });
    await recordFaceScan(db, ref(), { expectedKey: 'k_old', faces: [FACE] });
    expect((await readCapture('tcap_1')).tileset.retiredKeys).toEqual(['h1', 'k_old']);
  });

  it('CAS: άλλαξε το κλειδί στο μεταξύ · ήδη σαρωμένη από αυτή την έκδοση · failed ⇒ superseded, ΤΙΠΟΤΑ δεν γράφεται', async () => {
    seed({ tileset: FIRST_BAKE });
    expect(await recordFaceScan(db, ref(), { expectedKey: 'h_other', faces: [FACE] })).toEqual({ kind: 'superseded' });
    await recordFaceScan(db, ref(), { expectedKey: 'h1', faces: [] });
    expect(await recordFaceScan(db, ref(), { expectedKey: 'h1', faces: [FACE] })).toEqual({ kind: 'superseded' });
    expect((await readCapture('tcap_1')).redactions).toBeUndefined();
    seed({ tileset: { state: 'failed', contentHash: 'h1', faceSize: null } });
    expect(await recordFaceScan(db, ref(), { expectedKey: 'h1', faces: [FACE] })).toEqual({ kind: 'superseded' });
    expect(await recordFaceScan(db, ref('tcap_zz'), { expectedKey: 'h1', faces: [FACE] })).toEqual({ kind: 'superseded' });
    expect((await readTour()).revision).toBe(3);
  });

  it('ό,τι έσβησε ο άνθρωπος μετά τη σάρωση ΔΕΝ ξαναγεννιέται (μία σάρωση ανά έκδοση)', async () => {
    seed({ tileset: FIRST_BAKE });
    await recordFaceScan(db, ref(), { expectedKey: 'h1', faces: [FACE] });
    const [auto] = (await readCapture('tcap_1')).redactions ?? [];
    await write({ op: 'unredact', captureId: 'tcap_1', redactionId: auto.id });
    const after = await readCapture('tcap_1');
    expect(after.redactions).toBeUndefined();
    expect(await recordFaceScan(db, ref(), { expectedKey: after.tileset.contentHash ?? '', faces: [FACE] })).toEqual({ kind: 'superseded' });
  });
});
