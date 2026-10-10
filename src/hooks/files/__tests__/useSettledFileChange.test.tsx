/**
 * @jest-environment jsdom
 *
 * @fileoverview Άγκυρες του **σήματος «άλλαξε αρχείο — και ησύχασε»** (ADR-907 §11.10 · εξαγωγή από ADR-845 §7.17 Α5β).
 *
 * | # | Κανόνας | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | ΣΑ-1 | πολλά σήματα ⇒ **ένα** κάλεσμα, μετά το τελευταίο | κάλεσμα ανά σήμα (30 φωτογραφίες = 30 αιτήματα) |
 * | ΣΑ-2 | αλλαγή θέματος **ακυρώνει** ό,τι εκκρεμούσε | αργοπορημένο σήμα άλλου θέματος ξυπνά την οθόνη |
 * | ΣΑ-3 | `null` ⇒ κανένας ακροατής· αποσύνδεση ⇒ κανένας ακροατής | διαρροή συνδρομής |
 * | ΣΑ-4 | καλείται η **τρέχουσα** συνάρτηση, όχι στιγμιότυπο | μπαγιάτικο κλείσιμο |
 */
import { act, renderHook } from '@testing-library/react';

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

jest.mock('@/services/realtime', () => ({
  RealtimeService: {
    subscribe: (event: string, listener: Listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(event, set);
      return () => { set.delete(listener); };
    },
  },
}));

import { FILE_CHANGE_SETTLE_MS, useSettledFileChange } from '../useSettledFileChange';

function emit(event: string): void {
  act(() => { listeners.get(event)?.forEach((listener) => listener()); });
}

function listenerCount(): number {
  return [...listeners.values()].reduce((total, set) => total + set.size, 0);
}

beforeEach(() => {
  listeners.clear();
  jest.useFakeTimers();
});
afterEach(() => { jest.useRealTimers(); });

describe('useSettledFileChange', () => {
  it('ΣΑ-1 — τρία σήματα δίνουν ένα κάλεσμα, μετρημένο από το τελευταίο', () => {
    const onSettled = jest.fn();
    renderHook(() => useSettledFileChange('floor_1', onSettled));

    emit('FILE_CREATED');
    act(() => { jest.advanceTimersByTime(FILE_CHANGE_SETTLE_MS - 1); });
    emit('FILE_UPDATED');
    act(() => { jest.advanceTimersByTime(FILE_CHANGE_SETTLE_MS - 1); });
    emit('FILE_TRASHED');
    expect(onSettled).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(FILE_CHANGE_SETTLE_MS); });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it.each(['FILE_CREATED', 'FILE_UPDATED', 'FILE_TRASHED', 'FILE_RESTORED', 'FILE_SUPERSEDED'])('ΣΑ-1 — ακούει το «%s»', (event) => {
    const onSettled = jest.fn();
    renderHook(() => useSettledFileChange('floor_1', onSettled));

    emit(event);
    act(() => { jest.advanceTimersByTime(FILE_CHANGE_SETTLE_MS); });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('ΣΑ-2 — αλλαγή θέματος ακυρώνει το σήμα που εκκρεμούσε', () => {
    const onSettled = jest.fn();
    const { rerender } = renderHook(({ subject }: { subject: string }) => useSettledFileChange(subject, onSettled), {
      initialProps: { subject: 'floor_1' },
    });

    emit('FILE_CREATED');
    rerender({ subject: 'floor_2' });
    act(() => { jest.advanceTimersByTime(FILE_CHANGE_SETTLE_MS * 2); });
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('ΣΑ-3 — χωρίς θέμα δεν στήνεται ακροατής· με θέμα στήνεται, και φεύγει στην αποσύνδεση', () => {
    const idle = renderHook(() => useSettledFileChange(null, jest.fn()));
    expect(listenerCount()).toBe(0);
    idle.unmount();

    const live = renderHook(() => useSettledFileChange('floor_1', jest.fn()));
    expect(listenerCount()).toBe(5);
    live.unmount();
    expect(listenerCount()).toBe(0);
  });

  it('ΣΑ-4 — καλείται η συνάρτηση της τελευταίας απόδοσης', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(({ onSettled }: { onSettled: () => void }) => useSettledFileChange('floor_1', onSettled), {
      initialProps: { onSettled: first },
    });

    rerender({ onSettled: second });
    emit('FILE_UPDATED');
    act(() => { jest.advanceTimersByTime(FILE_CHANGE_SETTLE_MS); });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
