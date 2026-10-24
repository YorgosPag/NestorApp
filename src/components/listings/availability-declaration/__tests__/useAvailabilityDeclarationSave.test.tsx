/**
 * ΑΓΚΥΡΕΣ — αισιόδοξη αποθήκευση της υπόσχεσης, επαναφορά, αγώνας δρόμου (ADR-919 §11).
 *
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import type { AvailabilityDeclarationIntent } from '@/lib/listings/availability-declaration-write';

import { useAvailabilityDeclarationSave } from '../useAvailabilityDeclarationSave';

const STORED = { provenance: 'declared', value: { precision: 'quarter', anchor: '2027-07-01' }, at: '2026-10-01T00:00:00.000Z' };
const Q4: AvailabilityDeclarationIntent = { precision: 'quarter', anchor: '2027-10-01', origin: 'declared' };

function deferred() {
  let resolve: (ok: boolean) => void = () => undefined;
  const promise = new Promise<boolean>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('Α — αισιόδοξα, με επαναφορά στην ΕΠΙΒΕΒΑΙΩΜΕΝΗ τιμή', () => {
  it('Α1 — η νέα υπόσχεση φαίνεται αμέσως, πριν απαντήσει ο διακομιστής', async () => {
    const reply = deferred();
    const { result } = renderHook(() => useAvailabilityDeclarationSave(STORED, () => reply.promise));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.commit(Q4); });
    expect(result.current.stored?.value.anchor).toBe('2027-10-01');
    expect(result.current.status).toBe('saving');
    await act(async () => { reply.resolve(true); await pending; });
    expect(result.current.status).toBe('saved');
  });

  it('Α2 — αποτυχία ⇒ πίσω στην αποθηκευμένη, και το λέει', async () => {
    const { result } = renderHook(() => useAvailabilityDeclarationSave(STORED, async () => false));
    await act(async () => { await result.current.commit(Q4); });
    expect(result.current.stored?.value.anchor).toBe('2027-07-01');
    expect(result.current.status).toBe('failed');
  });

  it('Α3 — εξαίρεση δικτύου = αποτυχία, ποτέ σιωπηλό «αποθηκεύτηκε»', async () => {
    const { result } = renderHook(() => useAvailabilityDeclarationSave(STORED, async () => { throw new Error('offline'); }));
    await act(async () => { await result.current.commit(null); });
    expect(result.current.stored).not.toBeNull();
    expect(result.current.status).toBe('failed');
  });
});

describe('Ρ — μόνο η τελευταία πράξη μετρά', () => {
  it('Ρ1 — «Δημοσίευση» που απαντά ΜΕΤΑ την «Ανάκληση» δεν την ανατρέπει στην οθόνη', async () => {
    const first = deferred();
    const second = deferred();
    const replies = [first.promise, second.promise];
    const { result } = renderHook(() => useAvailabilityDeclarationSave(STORED, () => replies.shift() ?? Promise.resolve(false)));
    let publish: Promise<void> = Promise.resolve();
    let withdraw: Promise<void> = Promise.resolve();
    act(() => { publish = result.current.commit(Q4); });
    act(() => { withdraw = result.current.commit(null); });
    await act(async () => { second.resolve(true); await withdraw; });
    await act(async () => { first.resolve(true); await publish; });
    expect(result.current.stored).toBeNull();
  });
});
