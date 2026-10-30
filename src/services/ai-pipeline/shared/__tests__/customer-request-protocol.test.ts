/**
 * @fileoverview Άγκυρα για τα κοινά βήματα των UC modules αιτήματος πελάτη (CHECK 3.28, 2026-10-30).
 * @related services/ai-pipeline/shared/customer-request-protocol.ts
 */

import type { PipelineContext } from '@/types/ai-pipeline';
import type { Logger } from '@/lib/telemetry/Logger';

const mockSet = jest.fn();
const mockDoc = jest.fn(() => ({ set: mockSet }));
const mockGet = jest.fn();
const mockLimit = jest.fn(() => ({ get: mockGet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc, limit: mockLimit }));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: mockCollection }),
}));
jest.mock('@/services/enterprise-id.service', () => ({
  generatePipelineAuditId: () => 'paudit_1',
}));
jest.mock('../contact-lookup', () => ({
  findContactByEmail: jest.fn(),
}));

import { findContactByEmail } from '../contact-lookup';
import {
  acknowledgeReply,
  approvalOf,
  collectionHealthCheck,
  findSenderContact,
  lookupOf,
  lookupSender,
  recordPipelineAudit,
  requesterOf,
  senderDisplayOf,
  senderEmailOf,
  toLookupRecord,
} from '../customer-request-protocol';

const mockFind = findContactByEmail as jest.Mock;

function makeLogger(): Logger {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger;
}

function ctxWith(over: Record<string, unknown> = {}, sender: { email?: string; name?: string } = {}): PipelineContext {
  return {
    requestId: 'req_1',
    companyId: 'comp_1',
    intake: { id: 'in_1', channel: 'email', normalized: { sender } },
    ...over,
  } as unknown as PipelineContext;
}

beforeEach(() => jest.clearAllMocks());

describe('lookup του αποστολέα', () => {
  it('email/όνομα: το όνομα πέφτει στο email, το email στο κενό', () => {
    expect(senderEmailOf(ctxWith())).toBe('');
    expect(senderEmailOf(ctxWith({}, { email: 'a@b.gr' }))).toBe('a@b.gr');
  });

  it('χωρίς email ⇒ καμία αναζήτηση', async () => {
    const r = await findSenderContact(ctxWith(), 'UC-004', makeLogger(), '');
    expect(r).toBeNull();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('βρίσκει την επαφή με το companyId', async () => {
    mockFind.mockResolvedValue({ contactId: 'c1', name: 'Γ' });
    const r = await findSenderContact(ctxWith(), 'UC-004', makeLogger(), 'a@b.gr');
    expect(r).toEqual({ contactId: 'c1', name: 'Γ' });
    expect(mockFind).toHaveBeenCalledWith('a@b.gr', 'comp_1');
  });

  it('αποτυχία αναζήτησης ⇒ null + warn με το module id', async () => {
    mockFind.mockRejectedValue(new Error('boom'));
    const logger = makeLogger();
    const r = await findSenderContact(ctxWith(), 'UC-004', logger, 'a@b.gr');
    expect(r).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('UC-004 LOOKUP: Contact search failed (non-fatal)', { requestId: 'req_1', error: 'boom' });
  });

  it('lookupSender: info log + επαφή', async () => {
    mockFind.mockResolvedValue({ contactId: 'c1', name: 'Γ' });
    const logger = makeLogger();
    const r = await lookupSender(ctxWith({}, { email: 'a@b.gr', name: 'Νίκος' }), 'UC-001', logger);
    expect(r).toEqual({ senderEmail: 'a@b.gr', senderName: 'Νίκος', senderContact: { contactId: 'c1', name: 'Γ' } });
    expect(logger.info).toHaveBeenCalledWith('UC-001 LOOKUP: Searching for sender contact', {
      requestId: 'req_1', senderEmail: 'a@b.gr', companyId: 'comp_1',
    });
  });

  it('lookupSender: χωρίς όνομα ⇒ το email', async () => {
    const r = await lookupSender(ctxWith({}, { email: 'a@b.gr' }), 'UC-001', makeLogger());
    expect(r.senderName).toBe('a@b.gr');
  });
});

describe('καθαρές βοηθητικές', () => {
  it('senderDisplayOf: όνομα > email > «Άγνωστος αποστολέας»', () => {
    expect(senderDisplayOf({ senderName: 'Ν', senderEmail: 'e' })).toBe('Ν');
    expect(senderDisplayOf({ senderEmail: 'e' })).toBe('e');
    expect(senderDisplayOf(undefined)).toBe('Άγνωστος αποστολέας');
  });

  it('requesterOf: προεπιλογές null/false', () => {
    expect(requesterOf({})).toEqual({ email: null, name: null, contactId: null, isKnownContact: false });
    expect(requesterOf({ senderEmail: 'e', senderName: 'n', contactId: 'c', isKnownContact: true }))
      .toEqual({ email: 'e', name: 'n', contactId: 'c', isKnownContact: true });
  });

  it('approvalOf: διαβάζει approvedBy/decidedAt, αλλιώς null', () => {
    expect(approvalOf(ctxWith())).toEqual({ approvedBy: null, approvedAt: null });
    expect(approvalOf(ctxWith({ approval: { approvedBy: 'u1', decidedAt: 't1' } })))
      .toEqual({ approvedBy: 'u1', approvedAt: 't1' });
  });

  it('toLookupRecord/lookupOf: ίδιο αντικείμενο, χωρίς αντιγραφή', () => {
    const data = { a: 1 };
    expect(toLookupRecord(data)).toBe(data);
    expect(lookupOf<{ a: number }>(ctxWith({ lookupData: data }))).toBe(data);
    expect(lookupOf(ctxWith())).toBeUndefined();
  });
});

describe('audit / acknowledge / health', () => {
  it('recordPipelineAudit: doc(id).set(record) στο ai_pipeline_audit και επιστρέφει το id', async () => {
    const record = { type: 'x' };
    const id = await recordPipelineAudit(record);
    expect(id).toBe('paudit_1');
    expect(mockDoc).toHaveBeenCalledWith('paudit_1');
    expect(mockSet).toHaveBeenCalledWith(record);
    expect(mockCollection).toHaveBeenCalledTimes(1);
  });

  it('acknowledgeReply: sent από την παρενέργεια reply_sent: + log', () => {
    const logger = makeLogger();
    const ctx = ctxWith({ executionResult: { success: true, sideEffects: ['reply_sent:m1'] } });
    expect(acknowledgeReply(ctx, 'UC-005', logger, 'Reply delivery status')).toEqual({ sent: true, channel: 'email' });
    expect(logger.info).toHaveBeenCalledWith('UC-005 ACKNOWLEDGE: Reply delivery status', {
      requestId: 'req_1', channel: 'email', replySent: true,
    });
  });

  it('acknowledgeReply: reply_failed ⇒ sent=false', () => {
    const ctx = ctxWith({ executionResult: { success: true, sideEffects: ['reply_failed:x'] } });
    expect(acknowledgeReply(ctx, 'UC-005', makeLogger(), 'l').sent).toBe(false);
  });

  it('collectionHealthCheck: true όταν διαβάζεται, false + error log όταν όχι', async () => {
    mockGet.mockResolvedValueOnce({});
    expect(await collectionHealthCheck('col', 'UC-006', makeLogger())).toBe(true);
    expect(mockCollection).toHaveBeenCalledWith('col');
    expect(mockLimit).toHaveBeenCalledWith(1);

    mockGet.mockRejectedValueOnce(new Error('down'));
    const logger = makeLogger();
    expect(await collectionHealthCheck('col', 'UC-006', logger)).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('UC-006 HEALTH CHECK: Failed', { error: 'down' });
  });
});
