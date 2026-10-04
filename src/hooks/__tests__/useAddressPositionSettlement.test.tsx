/**
 * ΑΓΚΥΡΑ — **η θέση που γράφεται μετά την αποθήκευση φτάνει στην οθόνη** (ADR-332 D29).
 *
 * Ό,τι κάνει την επανανάγνωση ασφαλή να τρέχει χωρίς άνθρωπο:
 * - υιοθετείται **μόνο η θέση**, **μόνο** των διευθύνσεων που περίμεναν·
 * - το παράθυρο **κλείνει** — ποτέ αιώνιο «εντοπίζεται…»·
 * - μια αποτυχημένη ανάγνωση δεν σταματά τίποτα, απλώς ξαναδοκιμάζεται·
 * - αλλαγή οντότητας στη μέση ακυρώνει ό,τι εκκρεμούσε για την προηγούμενη.
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { renderHook, act } from '@testing-library/react';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import {
  publishAddressPositionsPending,
  resetAddressPositionsPendingForTests,
} from '@/services/addresses/address-positions-pending';
import { useAddressPositionSettlement } from '../useAddressPositionSettlement';

type Address = { id: string; street: string; coordinates?: { lat: number; lng: number }; source?: 'geocoded' };

const DELAYS = GEOGRAPHIC_CONFIG.GEOCODING.COMPLETION_POLL_DELAYS_MS;
const WHOLE_WINDOW_MS = DELAYS.reduce((sum, delay) => sum + delay, 0);

const LOCAL: Address[] = [
  { id: 'addr_1', street: 'Τσιμισκή' },
  { id: 'addr_2', street: 'Εγνατία', coordinates: { lat: 40.63, lng: 22.95 }, source: 'geocoded' },
];
const LOCATED = { coordinates: { lat: 40.6403, lng: 22.9444 }, source: 'geocoded' as const, verifiedAt: 1 };

/** Προχωρά το ρολόι και αφήνει τις υποσχέσεις της ανάγνωσης να ολοκληρωθούν. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

function setup(read: jest.Mock, entityId: string | undefined = 'proj_1') {
  const onSettled = jest.fn();
  const hook = renderHook(
    (props: { entityId: string | undefined }) =>
      useAddressPositionSettlement<Address>({ entityId: props.entityId, addresses: LOCAL, read, onSettled }),
    { initialProps: { entityId } },
  );
  return { ...hook, onSettled };
}

beforeEach(() => {
  jest.useFakeTimers();
  resetAddressPositionsPendingForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('υιοθέτηση θέσης που ολοκληρώθηκε μετά την αποθήκευση', () => {
  it('Υ1 — χωρίς εκκρεμότητα δεν διαβάζει ποτέ τον διακομιστή', async () => {
    const read = jest.fn();
    setup(read);

    await advance(WHOLE_WINDOW_MS);

    expect(read).not.toHaveBeenCalled();
  });

  it('Υ2 — η θέση γράφτηκε ⇒ υιοθετείται ΜΟΝΟ η θέση της εκκρεμούς διεύθυνσης', async () => {
    // Ο διακομιστής έχει στο μεταξύ ΚΑΙ άλλο κείμενο: δεν επιτρέπεται να πατήσει την οθόνη.
    const read = jest.fn().mockResolvedValue([
      { id: 'addr_1', street: 'ΑΛΛΟ ΚΕΙΜΕΝΟ', ...LOCATED },
      { id: 'addr_2', street: 'ΑΛΛΟ ΚΕΙΜΕΝΟ', coordinates: { lat: 1, lng: 1 }, source: 'geocoded' },
    ]);
    const { result, onSettled } = setup(read);
    act(() => publishAddressPositionsPending('proj_1', ['addr_1'], 'locating'));

    await advance(DELAYS[0]);

    expect(onSettled).toHaveBeenCalledWith([{ id: 'addr_1', street: 'Τσιμισκή', ...LOCATED }, LOCAL[1]]);
    expect(result.current.ids).toEqual([]);
  });

  it('Υ3 — δεν γράφτηκε ακόμη ⇒ ξαναδιαβάζει με αυξανόμενη αναμονή, χωρίς να αγγίξει την οθόνη', async () => {
    const read = jest.fn().mockResolvedValue(LOCAL);
    const { result, onSettled } = setup(read);
    act(() => publishAddressPositionsPending('proj_1', ['addr_1'], 'locating'));

    await advance(DELAYS[0]);
    expect(read).toHaveBeenCalledTimes(1);
    await advance(DELAYS[1]);
    expect(read).toHaveBeenCalledTimes(2);

    expect(onSettled).not.toHaveBeenCalled();
    expect(result.current).toEqual({ ids: ['addr_1'], phase: 'locating' });
  });

  it('Υ4 — το παράθυρο έκλεισε χωρίς θέση ⇒ «αναβλήθηκε», και σταματά να ρωτά', async () => {
    const read = jest.fn().mockResolvedValue(LOCAL);
    const { result } = setup(read);
    act(() => publishAddressPositionsPending('proj_1', ['addr_1'], 'locating'));

    await advance(WHOLE_WINDOW_MS);
    expect(result.current).toEqual({ ids: ['addr_1'], phase: 'deferred' });

    await advance(WHOLE_WINDOW_MS);
    expect(read).toHaveBeenCalledTimes(DELAYS.length);
  });

  it('Υ5 — αποτυχημένη ανάγνωση δεν σταματά τίποτα: η επόμενη φέρνει τη θέση', async () => {
    const read = jest
      .fn()
      .mockRejectedValueOnce(new Error('δίκτυο'))
      .mockResolvedValue([{ id: 'addr_1', street: 'Τσιμισκή', ...LOCATED }]);
    const { onSettled } = setup(read);
    act(() => publishAddressPositionsPending('proj_1', ['addr_1'], 'locating'));

    await advance(DELAYS[0] + DELAYS[1]);

    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('Υ6 — άλλαξε μόνο η στιγμή επαλήθευσης ⇒ ΔΕΝ είναι νέα θέση', async () => {
    const read = jest.fn().mockResolvedValue([LOCAL[0], { ...LOCAL[1], verifiedAt: 999 }]);
    const { onSettled } = setup(read);
    act(() => publishAddressPositionsPending('proj_1', ['addr_2'], 'locating'));

    await advance(DELAYS[0]);

    expect(onSettled).not.toHaveBeenCalled();
  });

  it('Υ7 — φάση «αναβλήθηκε» (επαφές): κανείς δεν συνεχίζει στον διακομιστή, άρα καμία ανάγνωση', async () => {
    const read = jest.fn();
    setup(read);
    act(() => publishAddressPositionsPending('proj_1', ['addr_1'], 'deferred'));

    await advance(WHOLE_WINDOW_MS);

    expect(read).not.toHaveBeenCalled();
  });

  it('Υ8 — άλλαξε η οντότητα στη μέση ⇒ η ανάγνωση της προηγούμενης δεν φτάνει ποτέ στην οθόνη', async () => {
    const read = jest.fn().mockResolvedValue([{ id: 'addr_1', street: 'Τσιμισκή', ...LOCATED }]);
    const { rerender, onSettled } = setup(read);
    act(() => publishAddressPositionsPending('proj_1', ['addr_1'], 'locating'));

    rerender({ entityId: 'proj_2' });
    await advance(WHOLE_WINDOW_MS);

    expect(onSettled).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});
