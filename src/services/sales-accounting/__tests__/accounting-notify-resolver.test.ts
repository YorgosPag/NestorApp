/**
 * Integration test — ADR-326 Phase 3
 * Verifies that notifyAccountingOffice routes via OrgStructure resolver,
 * skips when no email resolves (G1), and logs source field.
 */

import 'server-only';

jest.mock('@/services/org-structure/org-routing-resolver', () => ({
  resolveTenantNotificationEmail: jest.fn(),
}));
jest.mock('@/services/ai-pipeline/shared/mailgun-sender', () => ({
  sendReplyViaMailgun: jest.fn().mockResolvedValue({ success: true, messageId: 'msg_test' }),
}));

import { resolveTenantNotificationEmail } from '@/services/org-structure/org-routing-resolver';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { notifyAccountingOffice } from '../accounting-office-notify';
import type { ReservationNotifyEvent } from '../types';

const mockResolve = resolveTenantNotificationEmail as jest.MockedFunction<typeof resolveTenantNotificationEmail>;
const mockSend = sendReplyViaMailgun as jest.MockedFunction<typeof sendReplyViaMailgun>;

const baseEvent: ReservationNotifyEvent = {
  eventType: 'reservation_notify',
  propertyId: 'prop_001',
  propertyName: 'Α-101',
  projectId: null,
  buyerContactId: null,
  buyerName: 'Γεώργιος Παγώνης',
  projectName: null,
  permitTitle: null,
  companyName: null,
  buildingName: null,
  unitFloor: null,
  projectAddress: null,
  paymentMethod: 'bank_transfer',
  notes: null,
  depositAmount: 5000,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('notifyAccountingOffice — ADR-326 Phase 3 routing', () => {
  it('sends to head email when orgStructure resolves (source: head)', async () => {
    mockResolve.mockResolvedValue({
      email: 'accounting@tenant.gr',
      source: 'head',
      memberDisplayName: 'Κωνσταντίνος Λογιστής',
      departmentCode: 'ACCOUNTING',
    });

    await notifyAccountingOffice(baseEvent, null, 'company_001');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'accounting@tenant.gr' })
    );
  });

  it('sends to override email when routing rule has overrideEmail (source: override)', async () => {
    mockResolve.mockResolvedValue({
      email: 'override@tenant.gr',
      source: 'override',
      departmentCode: 'ACCOUNTING',
    });

    await notifyAccountingOffice(baseEvent, null, 'company_001');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'override@tenant.gr' })
    );
  });

  it('skips email when orgStructure is absent (null resolve) — G1 no fallback', async () => {
    mockResolve.mockResolvedValue(null);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await notifyAccountingOffice(baseEvent, null, 'company_001');

    expect(mockSend).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[ADR-326 Notify] Skipping — no email resolved from orgStructure',
      expect.objectContaining({ companyId: 'company_001' })
    );

    warnSpy.mockRestore();
  });

  it('skips email when result.success is false (failed invoice)', async () => {
    mockResolve.mockResolvedValue({
      email: 'accounting@tenant.gr',
      source: 'head',
      departmentCode: 'ACCOUNTING',
    });

    await notifyAccountingOffice(
      baseEvent,
      { success: false, invoiceId: null, invoiceNumber: null, journalEntryId: null, transactionChainId: 'tc_001', error: 'DB error' },
      'company_001'
    );

    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('passes correct NotificationEventCode for reservation_notify', async () => {
    mockResolve.mockResolvedValue({
      email: 'accounting@tenant.gr',
      source: 'dept',
      departmentCode: 'ACCOUNTING',
    });

    await notifyAccountingOffice(baseEvent, null, 'company_002');

    expect(mockResolve).toHaveBeenCalledWith('company_002', 'reservation.created');
  });
});
