/**
 * @jest-environment node
 *
 * @fileoverview `fetchInVisit` — μία αθόρυβη νέα επίσκεψη, ποτέ βρόχος (ADR-315 Α6 · ADR-ACC-030 §5.6).
 * @related components/shared/pages/invoice-payment/share-visit-fetch.ts
 */

import { fetchInVisit, isVisitExpired } from '../share-visit-fetch';

type Body = { readonly status: string; readonly reason?: string };

const EXPIRED: Body = { status: 'refused', reason: 'visit-expired' };
const OK: Body = { status: 'ok' };

function asker(...answers: Array<Body | null>) {
  const ask = jest.fn<Promise<Body | null>, []>();
  for (const answer of answers) ask.mockResolvedValueOnce(answer);
  return ask;
}

describe('isVisitExpired', () => {
  it.each([
    [EXPIRED, true],
    [{ status: 'refused', reason: 'link-inactive' }, false],
    [OK, false],
    [null, false],
  ])('%p ⇒ %p', (body, expected) => {
    expect(isVisitExpired(body)).toBe(expected);
  });
});

describe('fetchInVisit', () => {
  it('ζωντανή επίσκεψη ⇒ μία ερώτηση, καμία νέα επίσκεψη', async () => {
    const ask = asker(OK);
    const reopen = jest.fn(async () => true);
    expect(await fetchInVisit(ask, reopen)).toBe(OK);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(reopen).not.toHaveBeenCalled();
  });

  it('η επίσκεψη έληξε ⇒ μία νέα επίσκεψη και μία ακόμη ερώτηση', async () => {
    const ask = asker(EXPIRED, OK);
    const reopen = jest.fn(async () => true);
    expect(await fetchInVisit(ask, reopen)).toBe(OK);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(reopen).toHaveBeenCalledTimes(1);
  });

  it('ποτέ βρόχος: δεύτερο visit-expired επιστρέφεται αυτούσιο', async () => {
    const ask = asker(EXPIRED, EXPIRED);
    const reopen = jest.fn(async () => true);
    expect(await fetchInVisit(ask, reopen)).toBe(EXPIRED);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(reopen).toHaveBeenCalledTimes(1);
  });

  it('η νέα επίσκεψη δεν άνοιξε ⇒ η αρχική άρνηση, καμία δεύτερη ερώτηση', async () => {
    const ask = asker(EXPIRED);
    const reopen = jest.fn(async () => false);
    expect(await fetchInVisit(ask, reopen)).toBe(EXPIRED);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('σφάλμα δικτύου (null) δεν είναι ετυμηγορία για την επίσκεψη', async () => {
    const ask = asker(null);
    const reopen = jest.fn(async () => true);
    expect(await fetchInVisit(ask, reopen)).toBeNull();
    expect(reopen).not.toHaveBeenCalled();
  });
});
