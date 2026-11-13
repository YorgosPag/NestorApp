/**
 * @jest-environment jsdom
 *
 * @fileoverview Η αναμονή επιβεβαίωσης πληρωμής στον χρόνο (ADR-ACC-030 §5.6 · ADR-315 Α6).
 * @related components/shared/pages/invoice-payment/usePaymentConfirmationWatch.ts
 *
 * Ζωντανά ευρήματα 2026-11-13 που φυλάσσονται εδώ:
 *   - η αναμονή κρατά ως τη λήξη της συνεδρίας του παρόχου + 1′, **όχι** 15′·
 *   - κρυμμένη καρτέλα έμεινε 11′ χωρίς γύρο ⇒ η επιστροφή στην καρτέλα κάνει γύρο **αμέσως**, χωρίς διπλό βρόχο·
 *   - επίσκεψη που έληξε ⇒ αθόρυβα νέα και η αναμονή συνεχίζει.
 */

import { act, renderHook } from '@testing-library/react';
import React from 'react';

import { ShareVisitContext } from '../share-visit-fetch';
import { usePaymentConfirmationWatch } from '../usePaymentConfirmationWatch';

const MINUTE = 60_000;
const PENDING = { status: 'ok', attempt: 'pending', expiresInMs: 35 * MINUTE };

const fetchMock = jest.fn();
const refresh = jest.fn(async () => undefined);
const reopenVisit = jest.fn(async () => true);

function answer(body: unknown) {
  return { ok: true, json: async () => body };
}

function renderWatch() {
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(ShareVisitContext.Provider, { value: reopenVisit }, children);
  return renderHook(
    () => usePaymentConfirmationWatch({ shareId: 'share_1', checkoutId: 'pchk_1', active: true, refresh }),
    { wrapper },
  );
}

async function advance(ms: number): Promise<void> {
  await act(async () => { await jest.advanceTimersByTimeAsync(ms); });
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock.mockReset().mockImplementation(async () => answer(PENDING));
  refresh.mockClear();
  reopenVisit.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
  setVisibility('visible');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('usePaymentConfirmationWatch', () => {
  it('ρυθμός: αμέσως, ανά 3″ το πρώτο λεπτό, μετά ανά 15″', async () => {
    renderWatch();
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(3_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(MINUTE);
    const atSlowPhase = fetchMock.mock.calls.length;
    await advance(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(atSlowPhase + 1);
  });

  it('στο 16′ ρωτά ακόμη· timed-out μόνο μετά τη λήξη της συνεδρίας + 1′ — και ΤΕΛΙΚΑ τελειώνει', async () => {
    // Όπως ο διακομιστής: υπόλοιπο ως τη λήξη, κομμένο στο 0 μετά (`attemptExpiresInMs`).
    const expiresAt = Date.now() + 35 * MINUTE;
    fetchMock.mockImplementation(async () => answer({ ...PENDING, expiresInMs: Math.max(0, expiresAt - Date.now()) }));
    const { result } = renderWatch();
    await advance(16 * MINUTE);
    expect(result.current.phase).toBe('slow');
    const at16 = fetchMock.mock.calls.length;
    await advance(MINUTE);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(at16);
    await advance(18 * MINUTE + 30_000);
    expect(result.current.phase).toBe('slow');
    await advance(MINUTE);
    expect(result.current.phase).toBe('timed-out');
    const ended = fetchMock.mock.calls.length;
    await advance(5 * MINUTE);
    expect(fetchMock).toHaveBeenCalledTimes(ended);
  });

  it('επιστροφή στην καρτέλα ⇒ γύρος αμέσως, χωρίς δεύτερο βρόχο', async () => {
    renderWatch();
    await advance(2 * MINUTE);
    const before = fetchMock.mock.calls.length;
    setVisibility('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(before + 1);
    // Ο εκκρεμής χρονοδιακόπτης ακυρώθηκε: ο επόμενος γύρος σε 15″, όχι δύο.
    await advance(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(before + 2);
  });

  it('κρυμμένη καρτέλα: το γεγονός δεν ξυπνά τον βρόχο', async () => {
    renderWatch();
    await advance(2 * MINUTE);
    const before = fetchMock.mock.calls.length;
    setVisibility('hidden');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(before);
  });

  it('επίσκεψη που έληξε ⇒ νέα επίσκεψη, και η αναμονή συνεχίζει', async () => {
    fetchMock
      .mockImplementationOnce(async () => answer({ status: 'refused', reason: 'visit-expired' }))
      .mockImplementation(async () => answer(PENDING));
    const { result } = renderWatch();
    await advance(0);
    expect(reopenVisit).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('waiting');
  });

  it('η απόπειρα απέτυχε ⇒ failed και καμία άλλη ερώτηση', async () => {
    fetchMock.mockImplementation(async () => answer({ ...PENDING, attempt: 'failed' }));
    const { result } = renderWatch();
    await advance(0);
    expect(result.current.phase).toBe('failed');
    await advance(MINUTE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
