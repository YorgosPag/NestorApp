/**
 * Το ρολόι της όψης του εκδότη: ξαναδιαβάζει κάθε 3 s ΜΟΝΟ όσο υπάρχει έκδοση `queued`/`running`, και σταματά μόλις
 * τελειώσουν όλες ή φύγει ο άνθρωπος.
 */

import { act, renderHook } from '@testing-library/react';

import { fetchPublicationsView } from '@/services/catalog/catalog-publishing-api.client';
import type { PublicationRunStatus, PublicationRunWire, PublicationsViewWire } from '@/subapps/catalog/types/publication';
import { PUBLICATION_POLL_MS, usePublicationsView } from '../usePublicationsView';

jest.mock('@/services/catalog/catalog-publishing-api.client', () => ({ fetchPublicationsView: jest.fn() }));
jest.mock('@/hooks/useIdentityGatedResource', () => {
  // Η ταυτότητα θεωρείται λυμένη: η πρώτη ανάγνωση τρέχει μία φορά στη φόρτωση.
  const { useEffect, useState } = jest.requireActual<typeof import('react')>('react');
  return {
    useIdentityGatedResource: <T,>(fetcher: () => Promise<T>) => {
      const [value, setValue] = useState<T | null>(null);
      useEffect(() => { void fetcher().then(setValue); }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return { value, reload: jest.fn() };
    },
  };
});

const read = fetchPublicationsView as jest.MockedFunction<typeof fetchPublicationsView>;

const run = (status: PublicationRunStatus): PublicationRunWire => ({
  id: 'r1', recipeId: 'x', recipeRevision: 1, inputHash: 'h', audienceKey: 'none', priced: false, status,
  progress: { phase: 'queued', pagesDone: 0, pagesTotal: 0 }, artifacts: [], report: null, failure: null, attempts: 1,
  requestedAt: '2026-10-30T10:00:00.000Z', requestedBy: 'u', finishedAt: null,
  companyId: 'c', createdAt: '2026-10-30T10:00:00.000Z', updatedAt: '2026-10-30T10:00:00.000Z',
});

const viewWith = (status: PublicationRunStatus | null): PublicationsViewWire => ({ recipes: [], runs: status === null ? [] : [run(status)] });

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('usePublicationsView — ρολόι μόνο όσο τρέχει έκδοση', () => {
  beforeEach(() => { jest.useFakeTimers(); read.mockReset(); });
  afterEach(() => { jest.useRealTimers(); });

  it('με έκδοση σε εξέλιξη ξαναδιαβάζει κάθε 3 s και σταματά όταν τελειώσει', async () => {
    read.mockResolvedValueOnce(viewWith('running')).mockResolvedValueOnce(viewWith('running')).mockResolvedValue(viewWith('ready'));
    const { result } = renderHook(() => usePublicationsView());
    await flush();
    expect(read).toHaveBeenCalledTimes(1);

    await act(async () => { jest.advanceTimersByTime(PUBLICATION_POLL_MS); });
    await flush();
    expect(read).toHaveBeenCalledTimes(2);

    await act(async () => { jest.advanceTimersByTime(PUBLICATION_POLL_MS); });
    await flush();
    expect(read).toHaveBeenCalledTimes(3);
    expect(result.current.current.state === 'ready' && result.current.current.view.runs[0]?.status).toBe('ready');

    await act(async () => { jest.advanceTimersByTime(PUBLICATION_POLL_MS * 5); });
    await flush();
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('χωρίς έκδοση σε εξέλιξη δεν ξαναδιαβάζει ποτέ', async () => {
    read.mockResolvedValue(viewWith('ready'));
    renderHook(() => usePublicationsView());
    await flush();
    await act(async () => { jest.advanceTimersByTime(PUBLICATION_POLL_MS * 5); });
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('με την αποσύνδεση της οθόνης καθαρίζει το ρολόι', async () => {
    read.mockResolvedValue(viewWith('queued'));
    const { unmount } = renderHook(() => usePublicationsView());
    await flush();
    unmount();
    await act(async () => { jest.advanceTimersByTime(PUBLICATION_POLL_MS * 5); });
    expect(read).toHaveBeenCalledTimes(1);
  });
});
