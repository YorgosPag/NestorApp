/**
 * @jest-environment node
 *
 * @fileoverview **Φρουρός δεσίματος στις εγγραφές του PM** (ADR-327 §8.5.4).
 *
 * Μέχρι 2026-10-28 η πύλη προμηθευτή επικύρωνε κάθε `rfqLineId`, ενώ οι δρόμοι του PM (`POST /api/quotes`,
 * `PATCH /api/quotes/[id]`) τα έγραφαν αυτούσια ⇒ ξένο/διπλό δέσιμο έσπαγε σιωπηλά το leveling.
 *
 * Φ1 καμία δήλωση γραμμής RFQ ⇒ **καμία** ανάγνωση (η συνηθισμένη επεξεργασία δεν πληρώνει τίποτα) ·
 * Φ2 ξένο id ⇒ `binding:unknown_rfq_line` · Φ3 δύο απαντήσεις στην ίδια γραμμή ⇒ `binding:duplicate_answer` ·
 * Φ4 αναπάντητες γραμμές RFQ **επιτρέπονται** (ο PM μεταγράφει· το κενό είναι εύρημα της Σύγκρισης) ·
 * Φ5 προσφορά χωρίς RFQ που δηλώνει γραμμή RFQ ⇒ απόρριψη (fail-closed) ·
 * Φ6 το «εξαιρείται» του προμηθευτή μετράει ως απάντηση: ο PM δεν δίνει δεύτερη τιμή στην ίδια γραμμή.
 */

jest.mock('server-only', () => ({}));

const mockGetRfq = jest.fn();
const mockReadLines = jest.fn();
jest.mock('../rfq-service', () => ({ getRfq: (...a: unknown[]) => mockGetRfq(...a) }));
jest.mock('../rfq-line-service', () => ({ readRfqLinesPublic: (...a: unknown[]) => mockReadLines(...a) }));

import type { QuoteLine } from '../../types/quote';
import type { PublicRfqLine } from '../../types/rfq-line';
import type { RfqLineAnswers } from '../../utils/rfq-line-binding';
import { assertPmRfqBinding } from '../quote-rfq-binding-guard';

const rfqLine = (id: string): PublicRfqLine => ({
  id, description: id, trade: 'demolition', categoryCode: null, quantity: 1, unit: 'pcs', notes: null, displayOrder: 0,
});
const line = (id: string, rfqLineId?: string | null): QuoteLine => ({
  id, description: id, categoryCode: null, quantity: 1, unit: 'pcs', unitPrice: 1, vatRate: 24, lineTotal: 1, notes: null,
  ...(rfqLineId !== undefined ? { rfqLineId } : {}),
});
const answers = (partial: Partial<RfqLineAnswers>): RfqLineAnswers => ({ lines: [], alternates: [], scopeResponses: [], ...partial });

beforeEach(() => {
  mockGetRfq.mockReset().mockResolvedValue({ id: 'rfq1', companyId: 'c1' });
  mockReadLines.mockReset().mockResolvedValue([rfqLine('L1'), rfqLine('L2')]);
});

describe('assertPmRfqBinding', () => {
  it('Φ1 χωρίς δήλωση γραμμής RFQ ⇒ καμία ανάγνωση', async () => {
    await expect(assertPmRfqBinding('c1', 'rfq1', answers({ lines: [line('a'), line('b', null)] }))).resolves.toBeUndefined();
    expect(mockGetRfq).not.toHaveBeenCalled();
    expect(mockReadLines).not.toHaveBeenCalled();
  });

  it('Φ2 ξένο id ⇒ binding:unknown_rfq_line', async () => {
    await expect(assertPmRfqBinding('c1', 'rfq1', answers({ lines: [line('a', 'L9')] }))).rejects.toThrow('binding:unknown_rfq_line');
    expect(mockGetRfq).toHaveBeenCalledWith('c1', 'rfq1');
  });

  it('Φ3 δύο γραμμές στην ίδια γραμμή RFQ ⇒ binding:duplicate_answer', async () => {
    await expect(assertPmRfqBinding('c1', 'rfq1', answers({ lines: [line('a', 'L1'), line('b', 'L1')] })))
      .rejects.toThrow('binding:duplicate_answer');
  });

  it('Φ4 αναπάντητη γραμμή RFQ επιτρέπεται', async () => {
    await expect(assertPmRfqBinding('c1', 'rfq1', answers({ lines: [line('a', 'L2'), line('b', null)] }))).resolves.toBeUndefined();
  });

  it('Φ5 χωρίς RFQ, με δήλωση γραμμής ⇒ απόρριψη', async () => {
    await expect(assertPmRfqBinding('c1', null, answers({ lines: [line('a', 'L1')] }))).rejects.toThrow('binding:unknown_rfq_line');
    mockGetRfq.mockResolvedValueOnce(null);
    await expect(assertPmRfqBinding('c1', 'gone', answers({ lines: [line('a', 'L1')] }))).rejects.toThrow('binding:unknown_rfq_line');
  });

  it('Φ6 «εξαιρείται» του προμηθευτή + τιμή του PM στην ίδια γραμμή ⇒ binding:duplicate_answer', async () => {
    const scopeResponses = [{ rfqLineId: 'L1', response: 'excluded' as const, note: null, description: 'L1' }];
    await expect(assertPmRfqBinding('c1', 'rfq1', answers({ lines: [line('a', 'L1')], scopeResponses })))
      .rejects.toThrow('binding:duplicate_answer');
  });
});
