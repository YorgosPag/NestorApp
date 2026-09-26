/**
 * @jest-environment node
 *
 * @fileoverview **Η ΟΨΗ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΦΩΤΟΓΡΑΦΟΥ** (ADR-884 §4.5 · Κ3α) — πάνω στον **ίδιο** δρόμο με την εξαργύρωση.
 *
 * - **Ο1** ✅ όψη: ακίνητο · γραφείο · λόγος · λήξεις — και **κανένα** email/id στο αποτέλεσμα.
 * - **Ο2** η όψη **δεν** καίει την πρόσκληση· το «ανοίχτηκε» γράφεται **μόνο** με το `markOpened`, μία φορά.
 * - **Ο3** οι ίδιες αρνήσεις με την εξαργύρωση (ανακλήθηκε · πλαστός) — ένα κριτήριο, όχι δύο.
 * - **Ο4** `addressedToViewer`: σωστός / άλλος λογαριασμός / κανείς συνδεδεμένος.
 * - **Ο5** αγγελία ιδιώτη ⇒ `hostName: null` (η οθόνη λέει «ιδιοκτήτης»), ποτέ το uid του.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/workspace/workspace-catalog', () => ({
  readWorkspaceName: async (companyId: string) => (companyId === 'comp_agency' ? 'Μεσιτικό Αιγαίου' : ''),
}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import { issueTourCaptureInvitation, revokeTourCaptureInvitation } from '../tour-capture-invitation';
import { previewTourCaptureInvitation } from '../tour-capture-invitation-preview';

process.env.TOUR_CAPTURE_INVITE_SECRET ??= 'δοκιμαστικό-μυστικό-πρόσκλησης-φωτογράφου';

const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const INVITATIONS = `${COLLECTIONS.SPATIAL_TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURE_INVITATIONS}`;
const EMAIL = 'photo@example.com';
const MANAGER: TourActor = {
  listing: { uid: 'boris', companyId: 'comp_agency' },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};
const grantExpiresAt = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

let kit: MockFirestoreKit;
let db: Firestore;

async function issue(subject: TourSubject = SUBJECT, actor: TourActor = MANAGER) {
  const outcome = await issueTourCaptureInvitation(db, {
    subject, actor, inviteeEmailRaw: EMAIL, grantExpiresAt: grantExpiresAt(), reason: 'λήψη πριν τους σοβάδες',
  });
  if (outcome.kind !== 'issued') throw new Error(`αναμενόταν έκδοση, ήρθε ${JSON.stringify(outcome)}`);
  return outcome;
}

beforeEach(() => {
  kit = createMockFirestore();
  db = kit.instance as unknown as Firestore;
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: 'comp_agency', name: 'Διαμέρισμα Α2' } });
});

describe('Ο — η όψη', () => {
  it('Ο1 — ακίνητο · γραφείο · λόγος · λήξεις — ΚΑΝΕΝΑ email ή id στο αποτέλεσμα', async () => {
    const { invitation, token } = await issue();
    const outcome = await previewTourCaptureInvitation(db, { token, viewerEmail: null });
    if (outcome.kind !== 'preview') throw new Error(JSON.stringify(outcome));

    expect(outcome.preview).toEqual({
      propertyLabel: 'Διαμέρισμα Α2', hostName: 'Μεσιτικό Αιγαίου', reason: 'λήψη πριν τους σοβάδες',
      grantExpiresAt: invitation.grantExpiresAt, expiresAt: invitation.expiresAt, identityAssurance: 'declared',
    });
    const wire = JSON.stringify(outcome.preview);
    expect(wire).not.toContain(EMAIL);
    expect(wire).not.toContain(invitation.id);
  });

  it('🔑 Ο2 — η όψη ΔΕΝ καίει την πρόσκληση· το «ανοίχτηκε» γράφεται μόνο με markOpened, ΜΙΑ φορά', async () => {
    const { invitation, token } = await issue();
    const outcome = await previewTourCaptureInvitation(db, { token, viewerEmail: null });
    expect(kit.getData(INVITATIONS, invitation.id)).toMatchObject({ state: 'pending', openedAt: null });

    if (outcome.kind !== 'preview') throw new Error(JSON.stringify(outcome));
    await outcome.markOpened();
    const openedAt = kit.getData(INVITATIONS, invitation.id)?.openedAt;
    expect(typeof openedAt).toBe('string');
    await outcome.markOpened();
    expect(kit.getData(INVITATIONS, invitation.id)).toMatchObject({ state: 'pending', openedAt });
  });

  it('🔴 Ο3 — ίδιες αρνήσεις με την εξαργύρωση: ανακλήθηκε · πλαστός', async () => {
    const { invitation, token } = await issue();
    await revokeTourCaptureInvitation(db, { subject: SUBJECT, actor: MANAGER, invitationId: invitation.id });
    expect(await previewTourCaptureInvitation(db, { token, viewerEmail: null })).toEqual({ kind: 'refused', reason: 'revoked' });
    expect(await previewTourCaptureInvitation(db, { token: `${token}x`, viewerEmail: null }))
      .toMatchObject({ kind: 'refused' });
  });

  it('Ο4 — addressedToViewer: σωστός (με άλλα κεφαλαία) · άλλος λογαριασμός · κανείς', async () => {
    const { token } = await issue();
    const addressed = async (viewerEmail: string | null) => {
      const outcome = await previewTourCaptureInvitation(db, { token, viewerEmail });
      return outcome.kind === 'preview' ? outcome.addressedToViewer : 'όχι όψη';
    };
    expect(await addressed('Photo@Example.com')).toBe(true);
    expect(await addressed('other@example.com')).toBe(false);
    expect(await addressed(null)).toBeNull();
  });

  it('Ο5 — αγγελία ιδιώτη ⇒ hostName null, ΠΟΤΕ το uid του ιδιοκτήτη', async () => {
    kit.seedCollection(COLLECTIONS.OWNER_PROPERTIES, { ownp_1: { authorUserId: 'anna', authorCompanyId: null, title: 'Μεζονέτα' } });
    const anna: TourActor = { listing: { uid: 'anna', companyId: null }, capability: { globalRole: 'external_user', permissions: [] } };
    const { token } = await issue({ kind: 'owner-property', id: 'ownp_1' }, anna);
    const outcome = await previewTourCaptureInvitation(db, { token, viewerEmail: null });
    if (outcome.kind !== 'preview') throw new Error(JSON.stringify(outcome));
    expect(outcome.preview).toMatchObject({ hostName: null, propertyLabel: 'Μεζονέτα' });
    expect(JSON.stringify(outcome.preview)).not.toContain('anna');
  });
});
