/**
 * ADR-532 Stage 3 — useEventGatedDialog gate hook tests.
 *
 * Verifies the mount-gate contract that keeps closed dialog hosts out of the
 * per-selection re-render commit: starts closed, opens on its EventBus signal
 * (carrying the payload), honours the `accept` predicate (read live, never
 * re-subscribing), and resets on `close()`.
 */

import { act } from 'react';
import { renderHook } from '@testing-library/react';

import { EventBus } from '../../../systems/events/EventBus';
import { useEventGatedDialog } from '../useEventGatedDialog';

describe('useEventGatedDialog', () => {
  afterEach(() => {
    EventBus.clear();
  });

  it('starts closed with no payload', () => {
    const { result } = renderHook(() => useEventGatedDialog('dxf:export-dialog-requested'));
    expect(result.current.open).toBe(false);
    expect(result.current.payload).toBeNull();
  });

  it('opens and captures the payload when its event fires', () => {
    const { result } = renderHook(() => useEventGatedDialog('bim:column-detail-requested'));

    act(() => {
      EventBus.emit('bim:column-detail-requested', { columnId: 'col-1', levelId: 'lvl-0' });
    });

    expect(result.current.open).toBe(true);
    expect(result.current.payload).toEqual({ columnId: 'col-1', levelId: 'lvl-0' });
  });

  it('ignores the event when accept returns false (dialog never opens)', () => {
    const { result } = renderHook(() =>
      useEventGatedDialog('bim:column-detail-requested', (p) => p.columnId === 'allowed'),
    );

    act(() => {
      EventBus.emit('bim:column-detail-requested', { columnId: 'blocked', levelId: 'lvl-0' });
    });
    expect(result.current.open).toBe(false);

    act(() => {
      EventBus.emit('bim:column-detail-requested', { columnId: 'allowed', levelId: 'lvl-0' });
    });
    expect(result.current.open).toBe(true);
    expect(result.current.payload).toEqual({ columnId: 'allowed', levelId: 'lvl-0' });
  });

  it('close() resets to closed + drops the payload', () => {
    const { result } = renderHook(() => useEventGatedDialog('bim:column-detail-requested'));

    act(() => {
      EventBus.emit('bim:column-detail-requested', { columnId: 'col-1', levelId: 'lvl-0' });
    });
    expect(result.current.open).toBe(true);

    act(() => result.current.close());
    expect(result.current.open).toBe(false);
    expect(result.current.payload).toBeNull();
  });

  it('reads the latest accept without re-subscribing (ref-stable listener)', () => {
    let threshold = 0;
    const { result, rerender } = renderHook(() =>
      useEventGatedDialog('bim:column-detail-requested', (p) => Number(p.columnId) >= threshold),
    );

    // Re-render with a stricter predicate; the listener must use the NEW closure.
    threshold = 100;
    rerender();

    act(() => {
      EventBus.emit('bim:column-detail-requested', { columnId: '50', levelId: 'lvl-0' });
    });
    expect(result.current.open).toBe(false); // rejected by the updated accept
  });

  describe('beforeOpen (load-then-open)', () => {
    it('exposes the sync beforeOpen result as data', () => {
      const { result } = renderHook(() =>
        useEventGatedDialog('dxf:export-dialog-requested', {
          beforeOpen: () => ({ rows: 3 }),
        }),
      );

      act(() => {
        EventBus.emit('dxf:export-dialog-requested', {});
      });

      expect(result.current.open).toBe(true);
      expect(result.current.data).toEqual({ rows: 3 });
    });

    it('aborts the open when beforeOpen returns null', () => {
      const { result } = renderHook(() =>
        useEventGatedDialog('dxf:export-dialog-requested', {
          beforeOpen: () => null,
        }),
      );

      act(() => {
        EventBus.emit('dxf:export-dialog-requested', {});
      });

      expect(result.current.open).toBe(false);
      expect(result.current.data).toBeNull();
    });

    it('opens with data once an async beforeOpen resolves', async () => {
      const { result } = renderHook(() =>
        useEventGatedDialog('dxf:export-dialog-requested', {
          beforeOpen: async () => ({ rows: 7 }),
        }),
      );

      await act(async () => {
        EventBus.emit('dxf:export-dialog-requested', {});
        await Promise.resolve();
      });

      expect(result.current.open).toBe(true);
      expect(result.current.data).toEqual({ rows: 7 });
    });

    it('honours accept alongside beforeOpen (options form)', () => {
      const beforeOpen = jest.fn(() => ({ ok: true }));
      const { result } = renderHook(() =>
        useEventGatedDialog('bim:column-detail-requested', {
          accept: (p) => p.columnId === 'yes',
          beforeOpen,
        }),
      );

      act(() => {
        EventBus.emit('bim:column-detail-requested', { columnId: 'no', levelId: 'l' });
      });
      expect(result.current.open).toBe(false);
      expect(beforeOpen).not.toHaveBeenCalled(); // rejected before beforeOpen runs

      act(() => {
        EventBus.emit('bim:column-detail-requested', { columnId: 'yes', levelId: 'l' });
      });
      expect(result.current.open).toBe(true);
      expect(result.current.data).toEqual({ ok: true });
    });
  });
});
