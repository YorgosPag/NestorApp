import { renderHook, waitFor, act } from '@testing-library/react';

import { useLazyProjectResource } from '../useLazyProjectResource';

jest.mock('@/lib/draft-entity-id', () => ({ isDraftEntityId: (id: string) => id === '__new__' }));

type Props = { projectId: string; enabled: boolean };

function setup(fetcher: (id: string) => Promise<string[]>, initial: Props) {
  return renderHook(
    ({ projectId, enabled }: Props) =>
      useLazyProjectResource<string[]>({ projectId, enabled, empty: [], fetcher, fallbackError: 'fallback' }),
    { initialProps: initial },
  );
}

describe('useLazyProjectResource', () => {
  it('a draft id never reaches the server', async () => {
    const fetcher = jest.fn(async () => ['x']);
    const { result } = setup(fetcher, { projectId: '__new__', enabled: true });
    await act(async () => {});
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.isFetched).toBe(false);
  });

  it('lazy: waits for enabled, then fetches once', async () => {
    const fetcher = jest.fn(async (id: string) => [id]);
    const { result, rerender } = setup(fetcher, { projectId: 'p1', enabled: false });
    expect(fetcher).not.toHaveBeenCalled();
    rerender({ projectId: 'p1', enabled: true });
    await waitFor(() => expect(result.current.data).toEqual(['p1']));
    rerender({ projectId: 'p1', enabled: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.isFetched).toBe(true);
  });

  it('a new projectId resets and refetches — never shows the other project', async () => {
    const fetcher = jest.fn(async (id: string) => [id]);
    const { result, rerender } = setup(fetcher, { projectId: 'p1', enabled: true });
    await waitFor(() => expect(result.current.data).toEqual(['p1']));
    rerender({ projectId: 'p2', enabled: true });
    await waitFor(() => expect(result.current.data).toEqual(['p2']));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('a non-Error rejection uses the translated fallback', async () => {
    const fetcher = jest.fn(() => Promise.reject('boom'));
    const { result } = setup(fetcher, { projectId: 'p1', enabled: true });
    await waitFor(() => expect(result.current.error).toBe('fallback'));
    expect(result.current.loading).toBe(false);
  });
});
