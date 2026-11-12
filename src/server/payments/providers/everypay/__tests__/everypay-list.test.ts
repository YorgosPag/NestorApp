/**
 * @jest-environment node
 *
 * ADR-ACC-030 §5.9 #8 — λίστες Everypay: ΟΛΕΣ οι σελίδες (`count` προεπιλογή 10 — μόνο η πρώτη σελίδα έχανε κινήσεις).
 */

import { EVERYPAY_LIST_MAX_PAGES, EVERYPAY_LIST_PAGE_SIZE, everypayListAll } from '../everypay-list';
import { createEverypayProvider } from '../everypay-adapter';
import { EVERYPAY_ENDPOINTS, type EverypayCredentials } from '../everypay-config';

const credentials: EverypayCredentials = {
  mode: 'sandbox', secretKey: 'sk_test', publicKey: 'pk_test', endpoints: EVERYPAY_ENDPOINTS.sandbox,
};

const respond = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const refunds = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => ({ token: `ref_${from + i}`, payment: `pmt_${(from + i) % 3}` }));

function requestedQueries(spy: jest.SpyInstance): URLSearchParams[] {
  return spy.mock.calls.map((call) => new URL(String(call[0])).searchParams);
}

afterEach(() => jest.restoreAllMocks());

describe('everypayListAll', () => {
  it('διαβάζει ΟΛΕΣ τις σελίδες: count=20, offset προχωρά ως το total_count', async () => {
    const spy = jest.spyOn(global, 'fetch')
      .mockImplementationOnce(() => respond({ total_count: 45, items: refunds(0, 20) }))
      .mockImplementationOnce(() => respond({ total_count: 45, items: refunds(20, 40) }))
      .mockImplementationOnce(() => respond({ total_count: 45, items: refunds(40, 45) }));
    const items = await everypayListAll(credentials, '/refunds', { payment: 'pmt_1' });
    expect(items).toHaveLength(45);
    const queries = requestedQueries(spy);
    expect(queries.map((q) => q.get('offset'))).toEqual(['0', '20', '40']);
    expect(queries.every((q) => q.get('count') === String(EVERYPAY_LIST_PAGE_SIZE) && q.get('payment') === 'pmt_1')).toBe(true);
  });

  it('μία σελίδα όταν όλα χωρούν (καμία περιττή κλήση)', async () => {
    const spy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => respond({ total_count: 2, items: refunds(0, 2) }));
    await expect(everypayListAll(credentials, '/refunds', {})).resolves.toHaveLength(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('μετατόπιση σελίδων (νέα εγγραφή στο μεταξύ) ⇒ καμία εγγραφή δύο φορές', async () => {
    jest.spyOn(global, 'fetch')
      .mockImplementationOnce(() => respond({ total_count: 21, items: refunds(0, 20) }))
      .mockImplementationOnce(() => respond({ total_count: 22, items: refunds(19, 21) }))
      .mockImplementationOnce(() => respond({ total_count: 22, items: [] }));
    const items = await everypayListAll(credentials, '/refunds', {});
    expect(items.map((item) => item.token)).toEqual(refunds(0, 21).map((item) => item.token));
  });

  it('κενή σελίδα πριν από το total_count (η λίστα μίκρυνε) ⇒ τέλος, όχι ατέρμονος βρόχος', async () => {
    const spy = jest.spyOn(global, 'fetch')
      .mockImplementationOnce(() => respond({ total_count: 30, items: refunds(0, 20) }))
      .mockImplementationOnce(() => respond({ total_count: 30, items: [] }));
    await expect(everypayListAll(credentials, '/refunds', {})).resolves.toHaveLength(20);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ items: [] }],
    [{ total_count: '3', items: [] }],
    [{ data: [], total_count: 0 }],
  ])('μορφή εκτός συμβολαίου (%p) ⇒ 502, ποτέ «τίποτα»', async (body) => {
    jest.spyOn(global, 'fetch').mockImplementationOnce(() => respond(body));
    await expect(everypayListAll(credentials, '/payments', {})).rejects.toMatchObject({ httpStatus: 502 });
  });

  it('πέρα από το όριο σελίδων ⇒ 502, ποτέ σιωπηλή αποκοπή', async () => {
    let page = 0;
    jest.spyOn(global, 'fetch').mockImplementation(() => {
      page += 1;
      return respond({ total_count: 1_000_000, items: refunds(page * 20, page * 20 + 20) });
    });
    await expect(everypayListAll(credentials, '/refunds', {})).rejects.toMatchObject({ httpStatus: 502 });
    expect(page).toBe(EVERYPAY_LIST_MAX_PAGES);
  });
});

describe('listRecentlyRefundedPayments', () => {
  it('`date_from` = η ημέρα (UTC) του sinceIso · μοναδικές πληρωμές, κείμενο ή αντικείμενο', async () => {
    const spy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => respond({
      total_count: 4,
      items: [
        { token: 'ref_1', payment: 'pmt_a' }, { token: 'ref_2', payment: 'pmt_a' },
        { token: 'ref_3', payment: { token: 'pmt_b' } }, { token: 'ref_4' },
      ],
    }));
    const references = await createEverypayProvider(credentials).listRecentlyRefundedPayments('2026-11-10T23:30:00.000Z');
    expect([...references].sort()).toEqual(['pmt_a', 'pmt_b']);
    expect(requestedQueries(spy)[0].get('date_from')).toBe('2026-11-10');
    expect(new URL(String(spy.mock.calls[0][0])).pathname).toBe('/refunds');
  });
});
