/**
 * @jest-environment node
 *
 * @fileoverview **«ΣΤΕΙΛΕ ΜΟΥ ΝΕΟ ΣΥΝΔΕΣΜΟ»** (ADR-876 §5 Φ4).
 *
 * Ρ1 email ΜΟΝΟ στον καταχωρημένο παραλήπτη · Ρ2 κλειστό RFQ / περασμένη προθεσμία ⇒ κανένα email ·
 * Ρ3 εξαντλημένη ποσόστωση ⇒ κανένας σύνδεσμος, κανένα email · Ρ4 λήξη = min(7 μέρες, προθεσμία) ·
 * Ρ5 ο νέος σύνδεσμος είναι `self_service` χωρίς εκδότη-μέλος, με αποτύπωμα IP.
 */

import type { RFQ } from '../../types/rfq';
import type { VendorInvite } from '../../types/vendor-invite';

const mockGetRfq = jest.fn();
jest.mock('../rfq-service', () => ({ getRfq: (...a: unknown[]) => mockGetRfq(...a) }));

const mockRecipient = jest.fn();
jest.mock('../vendor-invite-links-service', () => ({
  resolveInviteRecipient: (...a: unknown[]) => mockRecipient(...a),
}));

const mockQuota = jest.fn();
jest.mock('@/lib/middleware/recipient-quota', () => ({
  withinRecipientQuota: (...a: unknown[]) => mockQuota(...a),
}));

const mockIssue = jest.fn();
jest.mock('../vendor-invite-issue', () => ({
  issueAdditionalVendorLink: (...a: unknown[]) => mockIssue(...a),
}));

const mockSend = jest.fn();
jest.mock('../channels', () => ({ resolveChannel: () => ({ send: mockSend }) }));

jest.mock('@/services/vendor-portal/vendor-invite-credential', () => ({
  vendorLinkExpiryMs: (nowMs: number) => nowMs + 7 * 24 * 60 * 60 * 1000,
}));

import { renewedLinkExpiryMs, renewVendorLink } from '../vendor-link-renew';

const NOW = Date.parse('2026-09-24T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const ts = (ms: number) => ({ toMillis: () => ms });
const rfqDeadline = (ms: number | null) =>
  ({ deadlineDate: ms === null ? null : ts(ms) }) as unknown as Pick<RFQ, 'deadlineDate'>;

const invite = { id: 'vi_1', rfqId: 'rfq_1', companyId: 'co_1' } as unknown as VendorInvite;
const run = () => renewVendorLink({ invite, requesterIpHash: 'iphash', locale: 'en', nowMs: NOW });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRfq.mockResolvedValue({ status: 'active', title: 'RFQ', deadlineDate: null });
  mockRecipient.mockResolvedValue({ email: 'vendor@registered.test', name: 'Vendor' });
  mockQuota.mockResolvedValue(true);
  mockIssue.mockResolvedValue({
    credential: { id: 'vic_new' },
    portalUrl: 'https://app.test/vendor/quote#t=NEW',
    declineUrl: 'https://app.test/vendor/quote#t=NEW&intent=decline',
    expiresAtIso: new Date(NOW + 7 * DAY).toISOString(),
  });
  mockSend.mockResolvedValue({ success: true });
});

describe('renewVendorLink', () => {
  it('Ρ1 + Ρ5 — email ΜΟΝΟ στον καταχωρημένο παραλήπτη, με νέο σύνδεσμο self_service', async () => {
    expect(await run()).toBe('sent');
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'vendor@registered.test', locale: 'en' }));
    expect(mockIssue).toHaveBeenCalledWith(
      expect.objectContaining({ issuedVia: 'self_service', issuedBy: null, requesterIpHash: 'iphash' }),
    );
  });

  it.each(['closed', 'cancelled', 'archived'])('Ρ2 — RFQ «%s» ⇒ rfq_closed, κανένα email', async (status) => {
    mockGetRfq.mockResolvedValue({ status, title: 'RFQ', deadlineDate: null });
    expect(await run()).toBe('rfq_closed');
    expect(mockIssue).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Ρ2 — περασμένη προθεσμία ⇒ rfq_closed', async () => {
    mockGetRfq.mockResolvedValue({ status: 'active', title: 'RFQ', deadlineDate: ts(NOW - 1) });
    expect(await run()).toBe('rfq_closed');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Ρ3 — εξαντλημένη ποσόστωση ⇒ κανένας νέος σύνδεσμος, κανένα email', async () => {
    mockQuota.mockResolvedValue(false);
    expect(await run()).toBe('quota_exhausted');
    expect(mockIssue).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('χωρίς καταχωρημένο παραλήπτη ⇒ no_recipient (ΠΟΤΕ διεύθυνση από τον αιτούντα)', async () => {
    mockRecipient.mockResolvedValue(null);
    expect(await run()).toBe('no_recipient');
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('Ρ4 — λήξη νέου συνδέσμου', () => {
  it('χωρίς προθεσμία = 7 μέρες', () => {
    expect(renewedLinkExpiryMs(rfqDeadline(null), NOW)).toBe(NOW + 7 * DAY);
  });
  it('κοντινή προθεσμία κόβει τη ζωή του συνδέσμου', () => {
    expect(renewedLinkExpiryMs(rfqDeadline(NOW + DAY), NOW)).toBe(NOW + DAY);
  });
  it('περασμένη προθεσμία ⇒ null', () => {
    expect(renewedLinkExpiryMs(rfqDeadline(NOW), NOW)).toBeNull();
  });
});
