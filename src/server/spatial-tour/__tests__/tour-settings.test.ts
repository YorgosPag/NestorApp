/**
 * @jest-environment node
 *
 * @fileoverview **ΡΥΘΜΙΣΕΙΣ + ΠΑΡΟΥΣΙΑ ΣΤΗΝ ΑΓΓΕΛΙΑ** (ADR-884 Κ3β) — άγκυρες.
 *
 * - **Ρ** — μόνο ο υπεύθυνος · ιδεμπότητο · δημοσίευση μόνο με λήψη για το κοινό · η επιλογή γεννά περιήγηση.
 * - **Π** — η κάρτα της αγγελίας: μόνο δημοσιευμένη, όχι `link-only`, με έτοιμο tileset — αλλιώς **καμία**.
 */

jest.mock('server-only', () => ({}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import { readTourPresence } from '../tour-presence';
import { readManagedTourSettings, updateTourSettings } from '../tour-settings';

const AGENCY = 'comp_agency';
const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const TOURS = COLLECTIONS.SPATIAL_TOURS;
const CAPTURES = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURES}`;

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
const capture = (overrides: Record<string, unknown> = {}) => ({ audience: 'public-listing', tileset: { state: 'ready', contentHash: 'h' }, ...overrides });

let kit: MockFirestoreKit;
let db: Firestore;

beforeEach(() => {
  kit = createMockFirestore();
  db = kit.instance as unknown as Firestore;
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY } });
});

const settings = (visibility: 'public' | 'on-request' | 'link-only', lifecycle: 'draft' | 'published' | 'withdrawn') =>
  ({ visibility, lifecycle }) as const;

describe('Ρ — οι ρυθμίσεις', () => {
  it('Ρ1 — ξένος ⇒ not-manager, καμία εγγραφή', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    kit.clearWrites();
    expect(await updateTourSettings(db, { subject: SUBJECT, actor: STRANGER, settings: settings('on-request', 'draft') }))
      .toEqual({ kind: 'refused', reason: 'not-manager' });
    expect(kit.writes()).toEqual([]);
  });

  it('Ρ2 — δημοσίευση χωρίς λήψη για το κοινό ⇒ publish-needs-capture', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    kit.seedCollection(CAPTURES, { tcap_1: capture({ audience: 'project-team' }) });
    expect(await updateTourSettings(db, { subject: SUBJECT, actor: MANAGER, settings: settings('on-request', 'published') }))
      .toEqual({ kind: 'refused', reason: 'publish-needs-capture' });
  });

  it('Ρ3 — δημοσίευση με λήψη ⇒ updated· ίδιες τιμές ξανά ⇒ unchanged χωρίς εγγραφή', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tourDoc() });
    kit.seedCollection(CAPTURES, { tcap_1: capture() });
    const target = settings('on-request', 'published');
    expect(await updateTourSettings(db, { subject: SUBJECT, actor: MANAGER, settings: target })).toEqual({ kind: 'updated', settings: target });
    expect(kit.getData(TOURS, TOUR_ID)).toMatchObject({ visibility: 'on-request', lifecycle: 'published', updatedBy: 'boris' });
    kit.clearWrites();
    expect(await updateTourSettings(db, { subject: SUBJECT, actor: MANAGER, settings: target })).toEqual({ kind: 'unchanged', settings: target });
    expect(kit.writes()).toEqual([]);
  });

  it('Ρ4 — η επιλογή ορατότητας ΓΕΝΝΑ την περιήγηση (πρώτη πράξη), πάντα ως πρόχειρη', async () => {
    const outcome = await updateTourSettings(db, { subject: SUBJECT, actor: MANAGER, settings: settings('link-only', 'draft') });
    expect(outcome).toEqual({ kind: 'updated', settings: settings('link-only', 'draft') });
    expect(kit.getData(TOURS, TOUR_ID)).toMatchObject({ visibility: 'link-only', lifecycle: 'draft' });
  });

  it('Ρ6 — ιδιώτης κάτοχος ⇒ link-only αρνείται (visibility-unsupported)· on-request επιτρέπεται', async () => {
    kit.seedCollection(COLLECTIONS.OWNER_PROPERTIES, { ownp_1: { authorUserId: 'anna', authorCompanyId: null } });
    const anna: TourActor = { listing: { uid: 'anna', companyId: null }, capability: { globalRole: 'external_user', permissions: [] } };
    const personal: TourSubject = { kind: 'owner-property', id: 'ownp_1' };
    expect(await updateTourSettings(db, { subject: personal, actor: anna, settings: settings('link-only', 'draft') }))
      .toEqual({ kind: 'refused', reason: 'visibility-unsupported' });
    expect(await updateTourSettings(db, { subject: personal, actor: anna, settings: settings('on-request', 'draft') }))
      .toMatchObject({ kind: 'updated' });
  });

  it('Ρ5 — η ανάγνωση αγέννητης περιήγησης δίνει τις ρυθμίσεις γέννησης ΧΩΡΙΣ εγγραφή', async () => {
    kit.clearWrites();
    expect(await readManagedTourSettings(db, { subject: SUBJECT, actor: MANAGER }))
      .toEqual({ kind: 'read', tourId: TOUR_ID, settings: { visibility: 'public', lifecycle: 'draft' }, exists: false });
    expect(await readManagedTourSettings(db, { subject: SUBJECT, actor: STRANGER })).toEqual({ kind: 'refused', reason: 'not-manager' });
    expect(kit.writes()).toEqual([]);
  });
});

describe('Π — η παρουσία στην αγγελία', () => {
  it.each([
    ['δημοσιευμένη public με έτοιμο tileset', tourDoc({ lifecycle: 'published' }), capture(), 'public'],
    ['δημοσιευμένη on-request με έτοιμο tileset', tourDoc({ lifecycle: 'published', visibility: 'on-request' }), capture(), 'on-request'],
    ['link-only (αόρατη στην αγγελία)', tourDoc({ lifecycle: 'published', visibility: 'link-only' }), capture(), null],
    ['πρόχειρη', tourDoc(), capture(), null],
    ['χωρίς έτοιμο tileset', tourDoc({ lifecycle: 'published' }), capture({ tileset: { state: 'pending', contentHash: null } }), null],
    ['λήψη μόνο για την ομάδα', tourDoc({ lifecycle: 'published' }), capture({ audience: 'project-team' }), null],
  ])('%s', async (_name, tour, captureDoc, visibility) => {
    kit.seedCollection(TOURS, { [TOUR_ID]: tour });
    kit.seedCollection(CAPTURES, { tcap_1: captureDoc });
    const presence = await readTourPresence(db, 'prop_1');
    expect(presence?.visibility ?? null).toBe(visibility);
  });

  it('ταυτότητα που δεν είναι αγγελίας ⇒ καμία κάρτα, χωρίς ανάγνωση', async () => {
    expect(await readTourPresence(db, 'cont_123')).toBeNull();
  });
});
