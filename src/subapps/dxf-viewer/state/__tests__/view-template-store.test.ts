/**
 * ADR-375 Phase B.3 — useViewTemplateStore unit tests.
 *
 * Coverage:
 *   - mount-once subscribe / idempotent re-subscribe
 *   - data forwarding from service to store
 *   - error forwarding sets `error` and clears isLoading
 *   - unsubscribeAll tears down the subscription and resets templates
 *   - selectors (getById, getLinkedLevelCount)
 */

import { act } from '@testing-library/react';
import type { ViewTemplate } from '../../config/view-template-types';

// ---------------------------------------------------------------------------
// Service mock — captures subscribe callbacks for direct invocation in tests
// ---------------------------------------------------------------------------

type DataCb = (templates: ViewTemplate[]) => void;
type ErrCb = (err: Error) => void;

const captured: Array<{ onData: DataCb; onError?: ErrCb }> = [];
const mockUnsub = jest.fn();

jest.mock('../../services/view-template.service', () => ({
  subscribeViewTemplates: jest.fn((onData: DataCb, onError?: ErrCb) => {
    captured.push({ onData, onError });
    return mockUnsub;
  }),
}));

// ---------------------------------------------------------------------------
// SUT
// ---------------------------------------------------------------------------

import { useViewTemplateStore } from '../view-template-store';

beforeEach(() => {
  captured.length = 0;
  mockUnsub.mockClear();
  act(() => {
    useViewTemplateStore.setState({
      templates: [],
      isLoading: false,
      error: null,
      unsubscribe: null,
    });
  });
});

const fake = (id: string): ViewTemplate => ({
  id,
  companyId: 'c',
  name: `T-${id}`,
  settings: { drawingScale: 100 },
  createdBy: 'u',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

describe('subscribe lifecycle', () => {
  it('flips isLoading to true and clears error on subscribe', () => {
    act(() => {
      useViewTemplateStore.getState().subscribe();
    });
    const s = useViewTemplateStore.getState();
    expect(s.isLoading).toBe(true);
    expect(s.error).toBeNull();
    expect(captured).toHaveLength(1);
  });

  it('is idempotent — second subscribe returns the same unsub (no new service call)', () => {
    let unsubA: () => void;
    let unsubB: () => void;
    act(() => {
      unsubA = useViewTemplateStore.getState().subscribe();
    });
    act(() => {
      unsubB = useViewTemplateStore.getState().subscribe();
    });
    expect(captured).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(unsubA!).toBe(unsubB!);
  });
});

describe('data forwarding', () => {
  it('populates templates + clears isLoading when service delivers documents', () => {
    act(() => useViewTemplateStore.getState().subscribe());
    act(() => captured[0].onData([fake('a'), fake('b')]));
    const s = useViewTemplateStore.getState();
    expect(s.templates).toHaveLength(2);
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('handles empty snapshot', () => {
    act(() => useViewTemplateStore.getState().subscribe());
    act(() => captured[0].onData([]));
    expect(useViewTemplateStore.getState().templates).toEqual([]);
    expect(useViewTemplateStore.getState().isLoading).toBe(false);
  });
});

describe('error forwarding', () => {
  it('sets error and clears isLoading when service emits an error', () => {
    act(() => useViewTemplateStore.getState().subscribe());
    act(() => captured[0].onError?.(new Error('PERMISSION_DENIED')));
    const s = useViewTemplateStore.getState();
    expect(s.error).toBe('PERMISSION_DENIED');
    expect(s.isLoading).toBe(false);
  });
});

describe('unsubscribeAll', () => {
  it('invokes the underlying unsub and clears templates', () => {
    act(() => useViewTemplateStore.getState().subscribe());
    act(() => captured[0].onData([fake('a')]));
    act(() => useViewTemplateStore.getState().unsubscribeAll());
    expect(mockUnsub).toHaveBeenCalledTimes(1);
    const s = useViewTemplateStore.getState();
    expect(s.unsubscribe).toBeNull();
    expect(s.templates).toEqual([]);
  });

  it('is a no-op when not subscribed', () => {
    act(() => useViewTemplateStore.getState().unsubscribeAll());
    expect(mockUnsub).not.toHaveBeenCalled();
  });
});

describe('selectors', () => {
  it('getById returns the matching template or null', () => {
    act(() => {
      useViewTemplateStore.setState({ templates: [fake('a'), fake('b')] });
    });
    expect(useViewTemplateStore.getState().getById('a')?.id).toBe('a');
    expect(useViewTemplateStore.getState().getById('missing')).toBeNull();
  });

  it('getLinkedLevelCount counts FKs that match', () => {
    const count = useViewTemplateStore.getState().getLinkedLevelCount('vtmpl_1', [
      'vtmpl_1', 'vtmpl_1', 'vtmpl_2', null, undefined,
    ]);
    expect(count).toBe(2);
  });

  it('getLinkedLevelCount returns 0 when no FKs match', () => {
    const count = useViewTemplateStore.getState().getLinkedLevelCount('vtmpl_x', [
      'vtmpl_1', null,
    ]);
    expect(count).toBe(0);
  });
});
