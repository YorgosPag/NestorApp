/**
 * @jest-environment node
 *
 * @fileoverview **Η ΓΕΝΝΗΣΗ ΤΗΣ ΠΕΡΙΗΓΗΣΗΣ** (ADR-884 §4.5 · Κ3α) — άγκυρες του `ensureManagedTour`.
 *
 * - **Γ1** η πρώτη πράξη υπευθύνου γεννά **draft** περιήγηση στο σωστό διαμέρισμα· η δεύτερη **δεν** ξαναγράφει.
 * - **Γ2** όποιος δεν διαχειρίζεται ⇒ `not-manager` και **καμία** εγγραφή.
 * - **Γ3** περιήγηση του **προηγούμενου** κατόχου (ίδια διαδρομή μετά από μεταβίβαση) ⇒ `tour-custody-mismatch`, όχι υιοθεσία·
 *   και η πόρτα `locateManagedTour` (ανάκληση/λίστα) λέει το **ίδιο**.
 * - **Γ4** έγγραφο που δεν διαβάζεται ⇒ `tour-unreadable`, **ποτέ** αντικατάσταση.
 * - **Γ5** η πρώτη πρόσκληση φωτογράφου γεννά την περιήγηση (η ροή δεν πεθαίνει πια στο `tour-absent`).
 */

jest.mock('server-only', () => ({}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import { locateManagedTour } from '../tour-access-shared';
import { issueTourCaptureInvitation } from '../tour-capture-invitation';
import { ensureManagedTour } from '../tour-genesis';

process.env.TOUR_CAPTURE_INVITE_SECRET ??= 'δοκιμαστικό-μυστικό-πρόσκλησης-φωτογράφου';

const AGENCY = 'comp_agency';
const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const TOURS = COLLECTIONS.SPATIAL_TOURS;

const actorOf = (uid: string, companyId: string | null, permissions: string[]): TourActor => ({
  listing: { uid, companyId },
  capability: { globalRole: 'internal_user', permissions },
});
const MANAGER = actorOf('boris', AGENCY, ['listings:listings:publish']);
const STRANGER = actorOf('carl', 'comp_rival', ['listings:listings:publish']);

let kit: MockFirestoreKit;
let db: Firestore;
const tourWrites = () => kit.writes().filter((w) => w.collection === TOURS);

beforeEach(() => {
  kit = createMockFirestore();
  db = kit.instance as unknown as Firestore;
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY } });
});

describe('Γ — η γέννηση', () => {
  it('Γ1 — πρώτη πράξη ⇒ draft περιήγηση στο εταιρικό διαμέρισμα· δεύτερη ⇒ ίδια, ΚΑΜΙΑ νέα εγγραφή', async () => {
    const first = await ensureManagedTour(db, SUBJECT, MANAGER);
    expect(first).toMatchObject({ kind: 'managed', created: true, custody: { companyId: AGENCY } });
    expect(kit.getData(TOURS, TOUR_ID)).toMatchObject({
      companyId: AGENCY, lifecycle: 'draft', visibility: 'public', levels: [], nodes: [], revision: 0, createdBy: 'boris',
    });
    expect(kit.getData(TOURS, TOUR_ID)).not.toHaveProperty('userId');

    const second = await ensureManagedTour(db, SUBJECT, MANAGER);
    expect(second).toMatchObject({ kind: 'managed', created: false });
    expect(tourWrites()).toHaveLength(1);
  });

  it('Γ1β — αγγελία ιδιώτη ⇒ η περιήγηση γεννιέται στο ΠΡΟΣΩΠΙΚΟ διαμέρισμα', async () => {
    kit.seedCollection(COLLECTIONS.OWNER_PROPERTIES, { ownp_1: { authorUserId: 'anna', authorCompanyId: null } });
    const anna: TourActor = { listing: { uid: 'anna', companyId: null }, capability: { globalRole: 'external_user', permissions: [] } };
    const personalId = enterpriseIdService.generateDeterministicSpatialTourId('owner-property', 'ownp_1');

    expect((await ensureManagedTour(db, { kind: 'owner-property', id: 'ownp_1' }, anna)).kind).toBe('managed');
    expect(kit.getData(COLLECTIONS.SPATIAL_TOURS_PERSONAL, personalId)).toMatchObject({ userId: 'anna', lifecycle: 'draft' });
    expect(kit.getData(TOURS, personalId)).toBeUndefined();
  });

  it('🔴 Γ2 — όποιος δεν διαχειρίζεται ⇒ `not-manager`, ΚΑΜΙΑ εγγραφή· ρίζα που δεν υπάρχει ⇒ `tour-absent`', async () => {
    expect(await ensureManagedTour(db, SUBJECT, STRANGER)).toEqual({ kind: 'refused', reason: 'not-manager' });
    expect(await ensureManagedTour(db, { kind: 'company-property', id: 'prop_none' }, MANAGER))
      .toEqual({ kind: 'refused', reason: 'tour-absent' });
    expect(tourWrites()).toHaveLength(0);
  });

  it('🔴 Γ3 — περιήγηση ΠΡΟΗΓΟΥΜΕΝΟΥ κατόχου ⇒ `tour-custody-mismatch` σε γέννηση ΚΑΙ σε πόρτα υπευθύνου', async () => {
    await ensureManagedTour(db, SUBJECT, MANAGER);
    kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: 'comp_rival' } });
    const refused = { kind: 'refused', reason: 'tour-custody-mismatch' };

    expect(await ensureManagedTour(db, SUBJECT, STRANGER)).toEqual(refused);
    expect(await locateManagedTour(db, SUBJECT, STRANGER)).toEqual(refused);
    expect(kit.getData(TOURS, TOUR_ID)).toMatchObject({ companyId: AGENCY });
  });

  it('🔴 Γ4 — έγγραφο που δεν διαβάζεται ⇒ `tour-unreadable`, ΠΟΤΕ αντικατάσταση', async () => {
    kit.seedCollection(TOURS, { [TOUR_ID]: { companyId: AGENCY, visibility: 'κάτι' } });
    expect(await ensureManagedTour(db, SUBJECT, MANAGER)).toEqual({ kind: 'refused', reason: 'tour-unreadable' });
    expect(kit.getData(TOURS, TOUR_ID)).toEqual({ companyId: AGENCY, visibility: 'κάτι' });
  });

  it('Γ5 — η ΠΡΩΤΗ πρόσκληση φωτογράφου γεννά την περιήγηση (όχι πια `tour-absent`)', async () => {
    const outcome = await issueTourCaptureInvitation(db, {
      subject: SUBJECT, actor: MANAGER, inviteeEmailRaw: 'photo@example.com',
      grantExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), reason: 'λήψη πριν τους σοβάδες',
    });
    expect(outcome.kind).toBe('issued');
    expect(kit.getData(TOURS, TOUR_ID)).toMatchObject({ lifecycle: 'draft' });
  });
});
