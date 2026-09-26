/**
 * @jest-environment node
 *
 * @fileoverview **ΟΙ ΛΙΣΤΕΣ ΤΗΣ ΡΟΗΣ ΦΩΤΟΓΡΑΦΟΥ** (ADR-884 §4.5 · Κ3α).
 *
 * - **Λ1** ο υπεύθυνος βλέπει **όλες** τις λήψεις· ο φωτογράφος **μόνο τις δικές του**· ο ξένος τίποτα.
 * - **Λ2** «οι λήψεις μου»: οι άδειες του ίδιου, με ακίνητο και κατάσταση — ποτέ άλλου φωτογράφου.
 * - **Λ3** άδεια σε περιήγηση που άλλαξε κάτοχο **παραλείπεται**.
 */

jest.mock('server-only', () => ({}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import { listMyTourCaptureGrants, listTourCaptures } from '../tour-capture-list';

const AGENCY = 'comp_agency';
const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const TOURS = COLLECTIONS.SPATIAL_TOURS;
const GRANTS = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS}`;
const CAPTURES = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURES}`;
const DAY_MS = 24 * 60 * 60 * 1000;

const MANAGER: TourActor = {
  listing: { uid: 'boris', companyId: AGENCY },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};
const photographer = (uid: string): TourActor => ({ listing: { uid, companyId: null }, capability: { globalRole: 'external_user', permissions: [] } });

const capture = (uploadedBy: string) => ({
  tourId: TOUR_ID, nodeId: null, capturedAt: '2026-09-20T10:00:00.000Z', headingRad: 0, source: 'camera-360',
  provenance: 'as-built', baseCaptureId: null, signatory: null, audience: 'public-listing', milestone: null,
  originalFileId: `file_${uploadedBy}`, uploadedBy, createdAt: '2026-09-20T10:05:00.000Z',
  tileset: { state: 'pending', contentHash: 'h' },
  rights: { creator: { name: 'Χ', userId: null, url: null }, licensors: [], copyrightNotice: '© Χ', webStatementOfRights: null,
    license: { purpose: 'listing-marketing', term: { kind: 'perpetual' } } },
});
const grant = (uid: string, overrides: Record<string, unknown> = {}) => ({
  granteeUid: uid, tourId: TOUR_ID, scopes: ['tour:capture:upload'], expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
  revokedAt: null, revokedBy: null, createdAt: '2026-09-19T10:00:00.000Z', createdBy: 'boris', reason: 'λήψη', invitationId: null,
  ...overrides,
});

let kit: MockFirestoreKit;
let db: Firestore;

beforeEach(() => {
  kit = createMockFirestore();
  db = kit.instance as unknown as Firestore;
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY, name: 'Διαμέρισμα Α2' } });
  kit.seedCollection(TOURS, {
    [TOUR_ID]: {
      companyId: AGENCY, subject: SUBJECT, visibility: 'public', lifecycle: 'draft', levels: [], nodes: [], revision: 0,
      createdAt: '2026-09-19T10:00:00.000Z', createdBy: 'boris', updatedAt: '2026-09-19T10:00:00.000Z', updatedBy: 'boris',
    },
  });
  kit.seedCollection(CAPTURES, { tcap_b: capture('boris'), tcap_p: capture('uid_photo'), tcap_q: capture('uid_other') });
  kit.seedCollection(GRANTS, { uid_photo: grant('uid_photo'), uid_other: grant('uid_other', { revokedAt: '2026-09-21T10:00:00.000Z' }) });
});

const ids = (outcome: Awaited<ReturnType<typeof listTourCaptures>>) =>
  outcome.kind === 'listed' ? outcome.captures.map((c) => c.id).sort() : outcome.reason;

describe('Λ — ποιος βλέπει τι', () => {
  it('Λ1 — υπεύθυνος: ΟΛΕΣ · φωτογράφος: ΜΟΝΟ οι δικές του · ξένος χωρίς άδεια: `not-manager`', async () => {
    expect(ids(await listTourCaptures(db, { subject: SUBJECT, actor: MANAGER }))).toEqual(['tcap_b', 'tcap_p', 'tcap_q']);
    expect(ids(await listTourCaptures(db, { subject: SUBJECT, actor: photographer('uid_photo') }))).toEqual(['tcap_p']);
    expect(ids(await listTourCaptures(db, { subject: SUBJECT, actor: photographer('uid_stranger') }))).toBe('not-manager');
  });

  it('Λ2 — «οι λήψεις μου»: ακίνητο + κατάσταση, ΜΟΝΟ του ίδιου', async () => {
    expect(await listMyTourCaptureGrants(db, 'uid_photo')).toEqual([
      expect.objectContaining({ subject: SUBJECT, propertyLabel: 'Διαμέρισμα Α2', standing: 'active', reason: 'λήψη' }),
    ]);
    expect(await listMyTourCaptureGrants(db, 'uid_other')).toEqual([expect.objectContaining({ standing: 'revoked' })]);
    expect(await listMyTourCaptureGrants(db, 'nobody')).toEqual([]);
  });

  it('🔴 Λ3 — η αγγελία άλλαξε κάτοχο ⇒ η άδεια ΔΕΝ εμφανίζεται', async () => {
    kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: 'comp_rival', name: 'Διαμέρισμα Α2' } });
    expect(await listMyTourCaptureGrants(db, 'uid_photo')).toEqual([]);
  });
});
