/**
 * ADR-942 Φ1 (Δ8) — οι ειδοποιήσεις του αιτήματος εγγράφων στην ανάθεση έκδοσης.
 *
 * - **μία** ανά παραλήπτη ανά πάτημα («Ζήτησε όλα» = μία σύνοψη, όχι N κουδουνίσματα)
 * - `eventId` ντετερμινιστικό: ίδιο σύνολο αιτημάτων (με όποια σειρά) ⇒ ίδιο γεγονός ⇒ η επανάληψη δεν ξαναστέλνει
 * - αποτυχία έστω μίας αποστολής ⇒ `failed` (η ροή **δεν** σημαδεύει `notifiedAt`, η επανάληψη συγκλίνει)
 * - «ανέβηκε»: ένα γεγονός ανά (αίτημα, αρχείο, μηχανικός)
 */

const dispatchNotification = jest.fn();

jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotification(...args),
}));
jest.mock('@/services/conveyance/conveyance-engagement-notifier', () => ({
  caseEngagementChangedDestination: async () => ({ destination: 'space' }),
}));

import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import type { IssuanceEngagement } from '@/types/engagement';
import { announceDocumentProvided, announceDocumentsRequested } from '../issuance-document-request-notifier';

const ASSIGNMENT = { id: 'dia_1', companyId: 'comp_1', propertyId: 'prop_1', documentKind: 'energy-certificate' as const };

type Sent = { readonly eventType: string; readonly recipientId: string; readonly eventId: string; readonly titleParams: Record<string, string> };
const sent = (): Sent[] => dispatchNotification.mock.calls.map(([input]) => input as Sent);

beforeEach(() => {
  dispatchNotification.mockReset();
  dispatchNotification.mockResolvedValue(undefined);
});

describe('announceDocumentsRequested', () => {
  it('μία ειδοποίηση ανά λογαριασμό γραφείου, με το πλήθος των εγγράφων (σύνοψη)', async () => {
    const outcome = await announceDocumentsRequested({ assignment: ASSIGNMENT, propertyName: 'Οδός 1', requestIds: ['cdr_a', 'cdr_b'], recipientUids: ['u1', 'u2'] });
    expect(outcome).toBe('delivered');
    expect(sent().map((s) => s.recipientId)).toEqual(['u1', 'u2']);
    expect(sent().every((s) => s.eventType === NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_ISSUANCE_DOCUMENTS_REQUESTED)).toBe(true);
    expect(sent()[0].titleParams).toEqual({ title: 'Οδός 1', count: '2' });
  });

  it('ίδιο σύνολο αιτημάτων με άλλη σειρά ⇒ ΙΔΙΟ eventId (μετάλλαξη: η επανάληψη ξαναστέλνει)', async () => {
    await announceDocumentsRequested({ assignment: ASSIGNMENT, propertyName: null, requestIds: ['cdr_a', 'cdr_b'], recipientUids: ['u1'] });
    await announceDocumentsRequested({ assignment: ASSIGNMENT, propertyName: null, requestIds: ['cdr_b', 'cdr_a'], recipientUids: ['u1'] });
    const [first, second] = sent();
    expect(first.eventId).toBe(second.eventId);
  });

  it('άλλος παραλήπτης ή άλλο σύνολο ⇒ άλλο eventId', async () => {
    await announceDocumentsRequested({ assignment: ASSIGNMENT, propertyName: null, requestIds: ['cdr_a'], recipientUids: ['u1', 'u2'] });
    await announceDocumentsRequested({ assignment: ASSIGNMENT, propertyName: null, requestIds: ['cdr_a', 'cdr_c'], recipientUids: ['u1'] });
    expect(new Set(sent().map((s) => s.eventId)).size).toBe(3);
  });

  it('αποτυχία έστω μίας αποστολής ⇒ failed (καμία σήμανση notifiedAt)', async () => {
    dispatchNotification.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('down'));
    await expect(announceDocumentsRequested({ assignment: ASSIGNMENT, propertyName: null, requestIds: ['cdr_a'], recipientUids: ['u1', 'u2'] }))
      .resolves.toBe('failed');
  });
});

describe('announceDocumentProvided', () => {
  const engagement = { id: 'eng_1', uid: 'eng-uid' } as IssuanceEngagement;

  it('προς τον μηχανικό, με eventId (αίτημα, αρχείο, μηχανικός) — ίδιο αρχείο δύο φορές ⇒ ίδιο γεγονός', async () => {
    const notice = { assignment: ASSIGNMENT, propertyName: null, requestId: 'cdr_a', fileId: 'file_1', engagement };
    await announceDocumentProvided(notice);
    await announceDocumentProvided(notice);
    const [first, second] = sent();
    expect(first).toMatchObject({ eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_ISSUANCE_DOCUMENT_PROVIDED, recipientId: 'eng-uid' });
    expect(first.eventId).toBe('issuance-doc-provided:cdr_a:file_1:eng-uid');
    expect(second.eventId).toBe(first.eventId);
  });

  it('ποτέ δεν πετά — η πράξη (το ανέβασμα) έγινε ήδη', async () => {
    dispatchNotification.mockRejectedValue(new Error('down'));
    await expect(announceDocumentProvided({ assignment: ASSIGNMENT, propertyName: null, requestId: 'cdr_a', fileId: 'f', engagement })).resolves.toBeUndefined();
  });
});
