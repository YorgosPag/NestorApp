/**
 * Άγκυρες της **μίας αλήθειας** για τη ζώνη εργοταξίου (ADR-891 §10.3).
 *
 * 🔑 Η ερώτηση δεν είναι «φορτώνει;» αλλά **βλέπουν οι δύο χάρτες το ΙΔΙΟ πράγμα μετά από αποθήκευση** —
 * αυτό που μετρήθηκε ζωντανά να σπάει: αποθήκευση στον GeofenceConfigMap, κανένας κύκλος στον LiveWorkerMap.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { GeofenceConfig } from '../../contracts';
import {
  publishProjectGeofence,
  resetProjectGeofenceStoreForTests,
  revalidateProjectGeofence,
  useProjectGeofence,
} from '../project-geofence-store';

const PROJECT = 'proj_test';

function zone(radiusMeters: number): GeofenceConfig {
  return { latitude: 40.63, longitude: 22.94, radiusMeters, enabled: true, updatedAt: '2026-09-29T00:00:00.000Z', updatedBy: 'u' };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function respond(geofence: GeofenceConfig | null, success = true): Response {
  return { json: async () => ({ success, geofence }) } as unknown as Response;
}

const fetchMock = jest.fn<Promise<Response>, [string]>();

beforeEach(() => {
  resetProjectGeofenceStoreForTests();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('Α — δύο αναγνώστες, ΜΙΑ αλήθεια', () => {
  it('η αποθήκευση φαίνεται ΑΜΕΣΩΣ και στον άλλο αναγνώστη (το ζωντανό σφάλμα)', async () => {
    fetchMock.mockResolvedValue(respond(null));
    const editor = renderHook(() => useProjectGeofence(PROJECT));
    const live = renderHook(() => useProjectGeofence(PROJECT));
    await waitFor(() => expect(live.result.current.hasLoaded).toBe(true));
    expect(live.result.current.geofence).toBeNull();

    act(() => publishProjectGeofence(PROJECT, zone(100)));

    expect(live.result.current.geofence?.radiusMeters).toBe(100);
    expect(editor.result.current.geofence?.radiusMeters).toBe(100);
  });

  it('παράλληλοι αναγνώστες μοιράζονται ΕΝΑ αίτημα', async () => {
    fetchMock.mockResolvedValue(respond(zone(200)));
    renderHook(() => useProjectGeofence(PROJECT));
    renderHook(() => useProjectGeofence(PROJECT));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});

describe('Β — κανένα μπαγιάτικο GET δεν νικά μια εγγραφή', () => {
  it('GET που ξεκίνησε ΠΡΙΝ την αποθήκευση και γύρισε ΜΕΤΑ απορρίπτεται', async () => {
    const late = deferred<Response>();
    fetchMock.mockReturnValue(late.promise);
    const { result } = renderHook(() => useProjectGeofence(PROJECT));

    act(() => publishProjectGeofence(PROJECT, zone(100)));
    await act(async () => { late.resolve(respond(null)); await revalidateProjectGeofence(PROJECT); });

    expect(result.current.geofence?.radiusMeters).toBe(100);
  });

  it('σφάλμα δικτύου ΔΕΝ σβήνει γνωστή ζώνη', async () => {
    act(() => publishProjectGeofence(PROJECT, zone(150)));
    fetchMock.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useProjectGeofence(PROJECT));
    await act(async () => { await revalidateProjectGeofence(PROJECT); });
    expect(result.current.geofence?.radiusMeters).toBe(150);
  });

  it('σφάλμα στην ΠΡΩΤΗ φόρτωση ⇒ «φορτώθηκε, χωρίς ζώνη» (ο χάρτης δεν μένει σε spinner)', async () => {
    fetchMock.mockResolvedValue(respond(null, false));
    const { result } = renderHook(() => useProjectGeofence(PROJECT));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.geofence).toBeNull();
  });
});
