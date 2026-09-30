/**
 * @jest-environment node
 */

/**
 * ADR-884 Κ3β — **ποιος δίνει σύνδεσμο θέασης περιήγησης**: ο **υπεύθυνος** (`mayManageTour`), όχι σκέτος μισθωτής.
 *
 * Load-bearing: a tour link GRANTS access (on-request / link-only), so the one writer (`createShareOnServer`) asks the
 * tour's own judge — a tenant member without the publish capability, a caller without a capability view, or a tour of
 * another company is refused; the tour kind demands a recipient label and forbids a password.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
let idCounter = 0;
jest.mock('@/services/enterprise-id-convenience', () => ({ generateShareId: () => `share_${++idCounter}` }));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { CAPTURE_DOC } from '@/lib/spatial-tour/__tests__/spatial-tour-fixtures';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import { createShareOnServer, parseCreateShareRequest } from '../share-create';
import { updateShareOnServer } from '../share-update';

const AGENCY = 'comp_agency';
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const CAPTURES = `${COLLECTIONS.SPATIAL_TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURES}`;
const PUBLISHER = { globalRole: 'internal_user', permissions: ['listings:listings:publish'], companyId: AGENCY };

let kit: FakeFirestore;
const db = (): Firestore => kit as unknown as Firestore;

beforeEach(() => {
  kit = new FakeFirestore();
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY } });
  kit.seedCollection(COLLECTIONS.SPATIAL_TOURS, {
    [TOUR_ID]: {
      companyId: AGENCY, subject: { kind: 'company-property', id: 'prop_1' }, visibility: 'link-only', lifecycle: 'draft',
      levels: [], nodes: [], revision: 0, createdAt: '2026-09-01T10:00:00.000Z', createdBy: 'boris',
      updatedAt: '2026-09-01T10:00:00.000Z', updatedBy: 'boris',
    },
  });
  kit.seedCollection(CAPTURES, { tcap_1: { ...CAPTURE_DOC, tourId: TOUR_ID } });
});

const tourRequest = (extra: Record<string, unknown> = {}) =>
  parseCreateShareRequest({ entityType: 'spatial_tour', entityId: TOUR_ID, label: 'κ. Παπαδόπουλος — τράπεζα', expiresInHours: 72, ...extra })!;

describe('spatial_tour — ο υπεύθυνος δίνει σύνδεσμο', () => {
  it('ο υπεύθυνος ⇒ σύνδεσμος (αποθηκεύεται μόνο hash)', async () => {
    const outcome = await createShareOnServer(db(), { uid: 'boris', companyId: AGENCY, capability: PUBLISHER }, tourRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(kit.getData(COLLECTIONS.SHARES, outcome.result.shareId)).toMatchObject({
      entityType: 'spatial_tour', entityId: TOUR_ID, label: 'κ. Παπαδόπουλος — τράπεζα', requiresPassword: false,
    });
  });

  it.each([
    ['μέλος χωρίς δυνατότητα δημοσίευσης', { uid: 'eve', companyId: AGENCY, capability: { globalRole: 'internal_user', permissions: [], companyId: AGENCY } }],
    ['καλών χωρίς όψη ρόλου (fail-closed)', { uid: 'boris', companyId: AGENCY }],
    ['άλλος μισθωτής', { uid: 'carl', companyId: 'comp_rival', capability: { ...PUBLISHER, companyId: 'comp_rival' } }],
  ])('%s ⇒ forbidden, καμία εγγραφή', async (_name, creator) => {
    kit.clearWriteLog();
    expect(await createShareOnServer(db(), creator, tourRequest())).toMatchObject({ ok: false, refusal: 'forbidden' });
    expect(kit.writeLog()).toEqual([]);
  });

  // 🔴 ζωντανά 2026-09-26 (ADR-884 §4.7 Α8): σύνδεσμος για περιήγηση χωρίς στάση θεατή = ο παραλήπτης βλέπει
  //    «ετοιμάζεται». Ο ΕΝΑΣ κριτής του θεατή ⇒ 422 με λόγο (ο υπεύθυνος ΕΧΕΙ δικαίωμα — δεν είναι 403).
  it.each([
    ['λήψη μόνο για την ομάδα', { audience: 'project-team' }],
    ['λήψη χωρίς έτοιμο tileset', { tileset: { state: 'pending', contentHash: null, faceSize: null } }],
    ['ατοποθέτητη λήψη', { nodeId: null }],
  ])('%s ⇒ invalid nothing-to-share, καμία εγγραφή', async (_name, overrides) => {
    kit.seedCollection(CAPTURES, { tcap_1: { ...CAPTURE_DOC, tourId: TOUR_ID, ...overrides } });
    kit.clearWriteLog();
    const outcome = await createShareOnServer(db(), { uid: 'boris', companyId: AGENCY, capability: PUBLISHER }, tourRequest());
    expect(outcome).toEqual({ ok: false, refusal: 'invalid', reason: 'nothing-to-share' });
    expect(kit.writeLog()).toEqual([]);
  });

  it('ξένος σε άδεια περιήγηση ⇒ forbidden (ποτέ «υπάρχει, αλλά είναι άδεια»)', async () => {
    kit.seedCollection(CAPTURES, { tcap_1: { ...CAPTURE_DOC, tourId: TOUR_ID, nodeId: null } });
    const rival = { uid: 'carl', companyId: 'comp_rival', capability: { ...PUBLISHER, companyId: 'comp_rival' } };
    expect(await createShareOnServer(db(), rival, tourRequest())).toMatchObject({ ok: false, refusal: 'forbidden' });
  });

  it('id που δεν είναι η περιήγηση της ρίζας του ⇒ forbidden', async () => {
    const outcome = await createShareOnServer(db(), { uid: 'boris', companyId: AGENCY, capability: PUBLISHER }, tourRequest({ entityId: 'stour_forged' }));
    expect(outcome).toMatchObject({ ok: false, refusal: 'forbidden' });
  });

  it.each([
    ['χωρίς όνομα παραλήπτη', { label: undefined }],
    ['με κωδικό', { password: 'secret' }],
  ])('%s ⇒ invalid', async (_name, extra) => {
    const outcome = await createShareOnServer(db(), { uid: 'boris', companyId: AGENCY, capability: PUBLISHER }, tourRequest(extra));
    expect(outcome).toMatchObject({ ok: false, refusal: 'invalid' });
  });
});

describe('spatial_tour — η αλλαγή ρυθμίσεων δεν είναι πίσω πόρτα', () => {
  beforeEach(() => {
    kit.seedCollection(COLLECTIONS.SHARES, {
      share_t: { entityType: 'spatial_tour', entityId: TOUR_ID, companyId: AGENCY, createdBy: 'boris', isActive: true,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(), label: 'κ. Π.', requiresPassword: false },
    });
  });

  it.each([
    ['προσθήκη κωδικού', { password: 'secret' }, 'password-not-allowed'],
    ['σβήσιμο του «για ποιον»', { label: null }, 'label-required'],
  ])('%s ⇒ invalid, καμία εγγραφή', async (_name, request, reason) => {
    kit.clearWriteLog();
    const outcome = await updateShareOnServer(db(), { uid: 'boris', companyId: AGENCY }, 'share_t', request);
    expect(outcome).toEqual({ ok: false, refusal: 'invalid', reason });
    expect(kit.writeLog()).toEqual([]);
  });
});
