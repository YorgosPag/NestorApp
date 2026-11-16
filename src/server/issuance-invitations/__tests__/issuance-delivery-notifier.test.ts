/**
 * @jest-environment node
 *
 * ADR-915 §45 Φ5 — **ποιος παίρνει ποιο ορόσημο**: «καθυστερεί» ⇒ το γραφείο (πρότεινε + έστειλε, μία φορά ο καθένας) ·
 * «λήγει αύριο» ⇒ ο επαγγελματίας ΜΟΝΟ με ενεργή συμμετοχή · κανένα ορόσημο ⇒ τίποτα · βλάβη αποστολής ⇒ δεν πετά.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { DocumentIssuanceAssignment } from '@/services/document-registry/issuance-assignment-schema';

import { activeIssuanceEngagementOf } from '../issuance-active-engagement';
import { announceDeliveryMilestone } from '../issuance-delivery-notifier';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }) }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchNotification: jest.fn(async () => ({ skipped: false })) }));
jest.mock('../issuance-active-engagement', () => ({ activeIssuanceEngagementOf: jest.fn() }));
jest.mock('@/services/conveyance/conveyance-engagement-notifier', () => ({
  caseEngagementChangedDestination: jest.fn(async () => ({ workspace: { kind: 'personal' }, actions: [{ url: '/me/cases/ceng_1' }] })),
}));
jest.mock('@/lib/document-validity/issuance-delivery-due', () => ({
  ...jest.requireActual('@/lib/document-validity/issuance-delivery-due'),
  issuanceDeliveryOf: (record: { readonly due: string | null }) => (record.due === null ? null : { dueOn: record.due }),
}));

const dispatch = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;
const engagementOf = activeIssuanceEngagementOf as jest.MockedFunction<typeof activeIssuanceEngagementOf>;

const DB = {} as Firestore;
/** 2026-11-16 μεσημέρι ώρα Ελλάδας. */
const NOW = new Date('2026-11-16T10:00:00.000Z');

function subject(due: string | null, noticeByUid: string | null) {
  return {
    assignment: { id: 'diss_1', companyId: 'comp_1', propertyId: 'prop_1', documentKind: 'energy-certificate' } as unknown as DocumentIssuanceAssignment,
    registry: { properties: { prop_1: { name: 'Διαμέρισμα Α1' } }, people: { cont_pro: { name: 'Επιθεωρητής' } } } as unknown as DocumentRegistryResponse,
    record: {
      due, professionalContactId: 'cont_pro', proposedByUid: 'uid_proposer',
      notice: noticeByUid === null ? null : { byUid: noticeByUid },
    } as unknown as IssuanceAssignmentRecord,
    now: NOW,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('ADR-915 §45 Φ5 — announceDeliveryMilestone', () => {
  it('+1 ⇒ «καθυστερεί» σε όποιον πρότεινε ΚΑΙ όποιον έστειλε, με προσγείωση στη γραμμή', async () => {
    await announceDeliveryMilestone(DB, subject('2026-11-15', 'uid_sender'));
    expect(dispatch).toHaveBeenCalledTimes(2);
    const calls = dispatch.mock.calls.map(([input]) => input);
    expect(calls.map((input) => input.recipientId).sort()).toEqual(['uid_proposer', 'uid_sender']);
    expect(calls[0]).toMatchObject({
      eventType: 'properties.documentIssuanceOverdue', tenantId: 'comp_1', titleKey: 'documentIssuanceDelivery.overdue',
      bodyParams: { days: 1, name: 'Επιθεωρητής' },
    });
    expect(calls.map((input) => input.eventId)).toContain('document-issuance-delivery:diss_1:2026-11-15:overdue:uid_proposer');
    expect(engagementOf).not.toHaveBeenCalled();
  });

  it('ο ίδιος πρότεινε και έστειλε ⇒ ΜΙΑ ειδοποίηση', async () => {
    await announceDeliveryMilestone(DB, subject('2026-11-15', 'uid_proposer'));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('αύριο ⇒ ο επαγγελματίας στον χώρο του· χωρίς ενεργή συμμετοχή ⇒ ΤΙΠΟΤΑ (ποτέ στο γραφείο στη θέση του)', async () => {
    engagementOf.mockResolvedValue({ id: 'ceng_1', uid: 'uid_pro' } as unknown as Awaited<ReturnType<typeof activeIssuanceEngagementOf>>);
    await announceDeliveryMilestone(DB, subject('2026-11-17', 'uid_sender'));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      eventType: 'properties.documentIssuanceDeliveryDue', recipientId: 'uid_pro',
      eventId: 'document-issuance-delivery:diss_1:2026-11-17:due-tomorrow:uid_pro',
    });
    dispatch.mockClear();
    engagementOf.mockResolvedValue(null);
    await announceDeliveryMilestone(DB, subject('2026-11-17', 'uid_sender'));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('κανένα ορόσημο (μεθαύριο · χωρίς προθεσμία) ⇒ τίποτα', async () => {
    await announceDeliveryMilestone(DB, subject('2026-11-18', 'uid_sender'));
    await announceDeliveryMilestone(DB, subject(null, 'uid_sender'));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('🔴 βλάβη αποστολής ⇒ ΔΕΝ πετά (η υπενθύμιση συνεχίζει)', async () => {
    dispatch.mockRejectedValue(new Error('down'));
    await expect(announceDeliveryMilestone(DB, subject('2026-11-15', 'uid_sender'))).resolves.toBeUndefined();
  });
});
