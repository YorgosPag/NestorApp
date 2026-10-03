/**
 * @jest-environment node
 *
 * @fileoverview **«ΤΑ ΑΚΙΝΗΤΑ ΜΟΥ» ΓΙΑ ΤΗ ΛΗΨΗ** (ADR-904 Κ7).
 *
 * - **Τ1** ο ιδιώτης βλέπει **μόνο** τις δικές του αγγελίες· ξένες **ποτέ**·
 * - **Τ2** ο μεσίτης: δικές του + του **γραφείου** του, **μία** φορά η καθεμία· ποτέ άλλου γραφείου·
 * - **Τ3** εταιρικά ακίνητα **μόνο** με το δικαίωμα διαχείρισης εταιρικής περιήγησης (ο ίδιος κριτής)·
 * - **Τ4** ο φωτογράφος: οι άδειές του **με** κατάσταση (ενεργή · ληγμένη)· άδεια σε ακίνητο που διαχειρίζεται ο ίδιος
 *   εμφανίζεται **μία** φορά, ως `manager`·
 * - **Τ5** σελίδες: για κάθε μέγεθος, όλα **μία** φορά· τελευταία σελίδα ⇒ κενό token· κάθε σελίδα = σχήμα του συμβολαίου·
 * - **Τ6** όροφοι (Κ8, 1.2.0): της **δικής** περιήγησης, με τη σειρά του θεατή· ανενεργή άδεια ή ξένος κάτοχος ⇒ κανένας·
 *   **μία** ανάγνωση περιηγήσεων ανά πηγή ανά σελίδα. Κ9 (1.3.0): κάθε όροφος φέρει την κάτοψη **μόνο** αν είναι ενεργή **και**
 *   βαθμονομημένη (`calibratedPlan`) — ο όροφος χωρίς κάτοψη `null`.
 */

jest.mock('server-only', () => ({}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { CaptureTargetsResponseSchema } from '@/contracts/capture-api/capture-api-schemas';
import { decodeChainPosition, type ChainPosition } from '@/lib/api/chained-pages';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import { CAPTURE_TARGET_SOURCES, captureTargetsPageSize, listCaptureTargets, type CaptureTarget } from '../tour-capture-targets';

const AGENCY = 'comp_agency';
const RIVAL = 'comp_rival';
const DAY_MS = 24 * 60 * 60 * 1000;

const listing = (authorUserId: string, authorCompanyId: string | null, title: string) => ({
  authorUserId, authorCompanyId, title, status: 'active', mandate: { kind: authorCompanyId === null ? 'self' : 'brokered' },
});

const citizen = (uid: string): TourActor => ({ listing: { uid, companyId: null }, capability: { globalRole: 'external_user', permissions: [] } });
const broker = (uid: string, permissions: readonly string[] = []): TourActor => ({
  listing: { uid, companyId: AGENCY },
  capability: { globalRole: 'internal_user', permissions: [...permissions], companyId: AGENCY },
});

const PHOTO_TOUR = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_rival');
const MANAGED_TOUR = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_a');
const NO_PLAN = [{ source: 'none', state: 'active', fileId: null, approvedBy: null, approvedAt: null }];
const PLAN_IMAGE = { width: 3000, height: 2000, contentHash: 'h_ground' };
const CALIBRATED = [{
  source: 'engineer', state: 'active', fileId: 'file_g', approvedBy: 'boss', approvedAt: '2026-09-19T10:00:00.000Z', image: PLAN_IMAGE,
  scale: { metresPerPixel: 0.01, calibratedBy: 'boss', calibratedAt: '2026-09-19T10:00:00.000Z' },
}];
const BIM_AND_LOCAL = [
  { key: { kind: 'floor', floorId: 'flr_ground' }, floorPlans: CALIBRATED },
  { key: { kind: 'local', ordinal: 3 }, floorPlans: NO_PLAN },
];
const tourDoc = (companyId: string, id: string, levels: readonly unknown[] = []) => ({
  companyId, subject: { kind: 'company-property', id }, visibility: 'public', lifecycle: 'draft', levels, nodes: [], revision: 0,
  createdAt: '2026-09-19T10:00:00.000Z', createdBy: 'x', updatedAt: '2026-09-19T10:00:00.000Z', updatedBy: 'x',
});
const grant = (uid: string, tourId: string, overrides: Record<string, unknown> = {}) => ({
  granteeUid: uid, tourId, scopes: ['tour:capture:upload'], expiresAt: new Date(Date.now() + 7 * DAY_MS).toISOString(),
  revokedAt: null, revokedBy: null, createdAt: '2026-09-19T10:00:00.000Z', createdBy: 'boss', reason: 'Λήψη σαλονιού', invitationId: null,
  ...overrides,
});

let kit: FakeFirestore;
let db: Firestore;

beforeEach(() => {
  kit = new FakeFirestore();
  db = kit as unknown as Firestore;
  kit.seedCollection(COLLECTIONS.OWNER_PROPERTIES, {
    op_citizen1: listing('citizen', null, 'Σπίτι 1'),
    op_citizen2: listing('citizen', null, 'Σπίτι 2'),
    op_other: listing('stranger', null, 'Ξένο'),
    op_mine_agency: listing('boris', AGENCY, 'Του Μπόρις για το γραφείο'),
    op_colleague: listing('anna', AGENCY, 'Της Άννας'),
    op_rival: listing('rival_broker', RIVAL, 'Άλλου γραφείου'),
  });
  kit.seedCollection(COLLECTIONS.PROPERTIES, {
    prop_a: { companyId: AGENCY, name: 'Α1' },
    prop_b: { companyId: AGENCY, name: 'Β2' },
    prop_rival: { companyId: RIVAL, name: 'Ξένη μονάδα' },
  });
  kit.seedCollection(COLLECTIONS.SPATIAL_TOURS, { [PHOTO_TOUR]: tourDoc(RIVAL, 'prop_rival'), [MANAGED_TOUR]: tourDoc(AGENCY, 'prop_a') });
  kit.seedCollection(`${COLLECTIONS.SPATIAL_TOURS}/${PHOTO_TOUR}/${SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS}`, {
    photographer: grant('photographer', PHOTO_TOUR),
  });
});

async function readAll(actor: TourActor, pageSize: number): Promise<{ readonly targets: CaptureTarget[]; readonly pages: number }> {
  const targets: CaptureTarget[] = [];
  let from: ChainPosition | null = null;
  for (let pages = 1; pages < 40; pages += 1) {
    const page = await listCaptureTargets(db, { actor, from, pageSize });
    expect(CaptureTargetsResponseSchema.safeParse(page).success).toBe(true);
    expect(page.targets.length).toBeLessThanOrEqual(pageSize);
    targets.push(...page.targets);
    if (page.nextPageToken === '') return { targets, pages };
    from = decodeChainPosition(page.nextPageToken, CAPTURE_TARGET_SOURCES);
  }
  throw new Error('no end');
}

const ids = (targets: readonly CaptureTarget[]) => targets.map((t) => `${t.subject.id}:${t.access.kind}`);

describe('Τ1-Τ3 — ο υπεύθυνος', () => {
  it('Τ1 ιδιώτης ⇒ μόνο οι δικές του, με τίτλο', async () => {
    const { targets } = await readAll(citizen('citizen'), 50);
    expect(ids(targets)).toEqual(['op_citizen1:manager', 'op_citizen2:manager']);
    expect(targets[0]?.label).toBe('Σπίτι 1');
  });

  it('Τ2 μεσίτης χωρίς δικαίωμα εταιρικών ⇒ δικές του + του γραφείου, μία φορά· ποτέ άλλου γραφείου', async () => {
    const { targets } = await readAll(broker('boris'), 50);
    expect(ids(targets)).toEqual(['op_mine_agency:manager', 'op_colleague:manager']);
  });

  it('Τ3 με το δικαίωμα ⇒ και τα εταιρικά ακίνητα του μισθωτή του — ποτέ ξένου', async () => {
    const { targets } = await readAll(broker('boris', ['listings:listings:publish']), 50);
    expect(ids(targets)).toEqual(['op_mine_agency:manager', 'op_colleague:manager', 'prop_a:manager', 'prop_b:manager']);
  });

  it('κανένας τίτλος/ρίζα ⇒ ξένος χρήστης βλέπει ΤΙΠΟΤΑ', async () => {
    const page = await listCaptureTargets(db, { actor: citizen('nobody'), from: null, pageSize: 50 });
    expect(page).toEqual({ targets: [], nextPageToken: '' });
  });
});

describe('Τ4 — ο φωτογράφος', () => {
  it('η άδειά του, με κατάσταση και τον λόγο του υπευθύνου', async () => {
    const { targets } = await readAll(citizen('photographer'), 50);
    expect(targets).toEqual([{
      subject: { kind: 'company-property', id: 'prop_rival' }, label: 'Ξένη μονάδα',
      access: expect.objectContaining({ kind: 'capture-grant', standing: 'active', reason: 'Λήψη σαλονιού' }),
      levels: [],
    }]);
  });

  it('ληγμένη άδεια ⇒ ΕΜΦΑΝΙΖΕΤΑΙ ως `expired` (ο άνθρωπος μαθαίνει γιατί), όχι εξαφάνιση', async () => {
    kit.seedCollection(`${COLLECTIONS.SPATIAL_TOURS}/${PHOTO_TOUR}/${SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS}`, {
      photographer: grant('photographer', PHOTO_TOUR, { expiresAt: new Date(Date.now() - DAY_MS).toISOString() }),
    });
    const { targets } = await readAll(citizen('photographer'), 50);
    expect(targets.map((t) => t.access.kind === 'capture-grant' && t.access.standing)).toEqual(['expired']);
  });

  it('άδεια σε ακίνητο που ΔΙΑΧΕΙΡΙΖΕΤΑΙ ο ίδιος ⇒ μία γραμμή, ως `manager`', async () => {
    kit.seedCollection(`${COLLECTIONS.SPATIAL_TOURS}/${MANAGED_TOUR}/${SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS}`, { boris: grant('boris', MANAGED_TOUR) });
    const { targets } = await readAll(broker('boris', ['listings:listings:publish']), 50);
    expect(ids(targets).filter((id) => id.startsWith('prop_a'))).toEqual(['prop_a:manager']);
  });
});

describe('Τ5 — οι σελίδες', () => {
  it.each([1, 2, 3, 5])('pageSize %i ⇒ όλα, μία φορά, ίδια σειρά με τη μία σελίδα', async (size) => {
    const actor = broker('boris', ['listings:listings:publish']);
    kit.seedCollection(`${COLLECTIONS.SPATIAL_TOURS}/${PHOTO_TOUR}/${SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS}`, { boris: grant('boris', PHOTO_TOUR) });
    const whole = (await readAll(actor, 100)).targets;
    expect(whole).toHaveLength(5);
    expect((await readAll(actor, size)).targets).toEqual(whole);
  });

  it('το μέγεθος σελίδας κατά AIP-158: απών/0 ⇒ προεπιλογή · υπερβολικό ⇒ μειώνεται', () => {
    expect([captureTargetsPageSize(undefined), captureTargetsPageSize(0), captureTargetsPageSize(7), captureTargetsPageSize(10_000)])
      .toEqual([50, 50, 7, 100]);
  });
});

describe('Τ6 — οι όροφοι της περιήγησης (ADR-904 Κ8)', () => {
  const levelsOf = (targets: readonly CaptureTarget[], id: string) => targets.find((t) => t.subject.id === id)?.levels;
  const EXPECTED = [
    { key: { kind: 'floor', floorId: 'flr_ground' }, ordinal: 0, label: null, calibratedPlan: { image: PLAN_IMAGE, metresPerPixel: 0.01 } },
    { key: { kind: 'local', ordinal: 3 }, ordinal: 3, label: null, calibratedPlan: null },
  ];

  it('υπεύθυνος ⇒ οι όροφοι της ΔΙΚΗΣ του περιήγησης, με τη σειρά του θεατή· ακίνητο χωρίς περιήγηση ⇒ κανένας', async () => {
    kit.seedCollection(COLLECTIONS.SPATIAL_TOURS, { [MANAGED_TOUR]: tourDoc(AGENCY, 'prop_a', BIM_AND_LOCAL) });
    const { targets } = await readAll(broker('boris', ['listings:listings:publish']), 50);
    expect(levelsOf(targets, 'prop_a')).toEqual(EXPECTED);
    expect(levelsOf(targets, 'prop_b')).toEqual([]);
  });

  it('περιήγηση με ΞΕΝΟ κάτοχο στη θέση της ⇒ κανένας όροφος (ποτέ ξένη δομή)', async () => {
    kit.seedCollection(COLLECTIONS.SPATIAL_TOURS, { [MANAGED_TOUR]: tourDoc(RIVAL, 'prop_a', BIM_AND_LOCAL) });
    const { targets } = await readAll(broker('boris', ['listings:listings:publish']), 50);
    expect(levelsOf(targets, 'prop_a')).toEqual([]);
  });

  it('φωτογράφος: ενεργή άδεια ⇒ οι όροφοι· ληγμένη ⇒ κανένας (μαθαίνει ΓΙΑΤΙ, όχι τη δομή)', async () => {
    kit.seedCollection(COLLECTIONS.SPATIAL_TOURS, { [PHOTO_TOUR]: tourDoc(RIVAL, 'prop_rival', BIM_AND_LOCAL) });
    expect(levelsOf((await readAll(citizen('photographer'), 50)).targets, 'prop_rival')).toEqual(EXPECTED);
    kit.seedCollection(`${COLLECTIONS.SPATIAL_TOURS}/${PHOTO_TOUR}/${SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS}`, {
      photographer: grant('photographer', PHOTO_TOUR, { expiresAt: new Date(Date.now() - DAY_MS).toISOString() }),
    });
    expect(levelsOf((await readAll(citizen('photographer'), 50)).targets, 'prop_rival')).toEqual([]);
  });

  it('ΜΙΑ ανάγνωση περιηγήσεων ανά πηγή-ερώτημα ανά σελίδα — όχι μία ανά ακίνητο', async () => {
    const getAll = jest.spyOn(kit, 'getAll');
    const page = await listCaptureTargets(db, { actor: broker('boris', ['listings:listings:publish']), from: null, pageSize: 50 });
    expect(page.targets).toHaveLength(4);
    // own · agency · company — τρεις πηγές με υποψηφίους, τρεις κλήσεις, όσα κι αν είναι τα ακίνητα.
    expect(getAll).toHaveBeenCalledTimes(3);
  });
});
