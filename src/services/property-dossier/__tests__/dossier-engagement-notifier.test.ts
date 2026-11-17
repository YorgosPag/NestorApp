/**
 * ADR-916 Φ-Ε1 — **ποιος** απάντησε στην πρόσκληση του φακέλου: η ειδοποίηση προς τον κάτοχο λέει το **όνομα** του
 * επαγγελματία (Dropbox/Drive «X accepted your invitation»)· χωρίς όνομα ⇒ το email της πρόσκλησης.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | `who: invitation.inviteeEmail` (χωρίς αναζήτηση ονόματος) | Ο1 |
 * | αναζήτηση με τον **κάτοχο** αντί για αυτόν που απάντησε | Ο1 |
 * | χωρίς εφεδρεία email | Ο2 |
 */

jest.mock('server-only', () => ({}));

interface DispatchedNotice { recipientId: string; titleKey: string; titleParams?: Record<string, string> }
const mockDispatch = jest.fn(async (_request: DispatchedNotice) => ({ ok: true }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (request: DispatchedNotice) => mockDispatch(request),
}));
jest.mock('@/services/conveyance/conveyance-engagement-notifier', () => ({
  caseEngagementChangedDestination: jest.fn(async () => ({})),
}));

const NAMES: Readonly<Record<string, string>> = { u_lawyer: 'Κλεομένης Δικηγόρος', u_owner: 'Γιώργος Παγώνης' };
jest.mock('@/services/entity-audit.service', () => ({
  resolveUserDisplayName: jest.fn(async (uid: string, fallback: string | null) => NAMES[uid] ?? fallback),
}));

import { announceDossierInvitationAnswered } from '../dossier-engagement-notifier';
import type { DossierEngagementInvitation } from '@/types/engagement-invitation';

const invitation = {
  id: 'einv_1',
  role: 'owner_lawyer',
  invitedByUid: 'u_owner',
  inviteeEmail: 'lawyer@example.gr',
  subject: { kind: 'property_dossier', dossierId: 'pdos_1' },
} as unknown as DossierEngagementInvitation;

describe('ADR-916 Φ-Ε1 — η απάντηση στην πρόσκληση φακέλου ονομάζει αυτόν που απάντησε', () => {
  beforeEach(() => mockDispatch.mockClear());

  it('Ο1 — αποδοχή ⇒ `who` = το όνομα του λογαριασμού που ΑΠΑΝΤΗΣΕ, προς τον κάτοχο', async () => {
    await announceDossierInvitationAnswered(invitation, 'accepted', 'ΔΙΑΜΕΡΙΣΜΑ', 'u_lawyer');
    const [request] = mockDispatch.mock.calls[0];
    expect(request.recipientId).toBe('u_owner');
    expect(request.titleKey).toBe('caseEngagementAnswered.dossier.acceptedTitle.owner_lawyer');
    expect(request.titleParams?.who).toBe('Κλεομένης Δικηγόρος');
  });

  it('Ο2 — λογαριασμός χωρίς όνομα ⇒ το email της πρόσκλησης (το έγραψε ο ίδιος ο κάτοχος)', async () => {
    await announceDossierInvitationAnswered(invitation, 'declined', 'ΔΙΑΜΕΡΙΣΜΑ', 'u_nameless');
    expect(mockDispatch.mock.calls[0][0].titleParams?.who).toBe('lawyer@example.gr');
  });
});
