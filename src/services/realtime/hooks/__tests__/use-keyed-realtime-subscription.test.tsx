/**
 * ΑΓΚΥΡΕΣ — **Η ΣΥΝΔΡΟΜΗ ΜΕ ΑΝΤΙΔΡΑΣΤΙΚΟ ΚΛΕΙΔΙ** + **Ο ΧΕΙΡΙΣΤΗΣ ΣΦΑΛΜΑΤΟΣ**
 * (ADR-798 §22.6 #1).
 *
 * 🔴 Η βλάβη που φυλάνε: ο παλιός χειριστής ήταν `() => { setLoading(false); }` —
 * **σιωπηλή κατάποση**. Το spinner έσβηνε, η οθόνη έλεγε «κανένας όροφος», και
 * **κανείς δεν μάθαινε ποτέ** ότι το ερώτημα απέτυχε.
 *
 * ⚠️ Οι **δύο σιωπές δεν λένε το ίδιο**, και υπάρχει άγκυρα **ονομαστικά** γι'
 * αυτό: `MissingTenantError` *(ο αυτόνομος, ADR-807)* ⇒ κενό **χωρίς** κόκκινη
 * γραμμή· οτιδήποτε άλλο ⇒ `logger.error` **και** ορατό `error`. Χωρίς αυτό το
 * ζεύγος, μια «απλοποίηση» που τις ξαναενώνει θα άφηνε και τις δύο πράσινες.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { where } from 'firebase/firestore';

const subscribeMock = jest.fn();

jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    subscribe: (...args: unknown[]) => subscribeMock(...args),
  },
}));

jest.mock('@/services/firestore/auth-context', () => ({
  isMissingTenantError: (error: Error) => error.name === 'MissingTenantError',
}));

jest.mock('firebase/firestore', () => ({
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
}));

import { useKeyedRealtimeSubscription } from '../use-keyed-realtime-subscription';
import { createSubscriptionErrorHandler } from '../subscription-error-handler';

interface Captured {
  collection: string;
  onData: (result: { documents: Array<Record<string, unknown>>; size: number }) => void;
  onError: (error: Error) => void;
  options: { constraints?: unknown[] };
}

const captured: Captured[] = [];
const unsubscribes: jest.Mock[] = [];

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Parameters<typeof createSubscriptionErrorHandler>[0]['logger'];

beforeEach(() => {
  captured.length = 0;
  unsubscribes.length = 0;
  subscribeMock.mockReset();
  jest.clearAllMocks();
  subscribeMock.mockImplementation(
    (collection: string, onData: Captured['onData'], onError: Captured['onError'], options: Captured['options']) => {
      captured.push({ collection, onData, onError, options });
      const unsub = jest.fn();
      unsubscribes.push(unsub);
      return unsub;
    },
  );
});

function renderFloors(buildingId: string | null) {
  return renderHook(
    ({ id }: { id: string | null }) =>
      useKeyedRealtimeSubscription<readonly string[]>({
        collection: 'FLOORS',
        logger,
        key: id,
        empty: [],
        constraints: (key) => [where('buildingId', '==', key)],
        select: (result) => result.documents.map((d) => d['id'] as string),
      }),
    { initialProps: { id: buildingId } },
  );
}

const result = (ids: string[]) => ({ documents: ids.map((id) => ({ id })), size: ids.length });

// ============================================================================
// Α. ΤΟ ΚΛΕΙΔΙ
// ============================================================================

describe('Α. το αντιδραστικό κλειδί', () => {
  it('κλειδί null ⇒ ΚΑΜΙΑ συνδρομή, κενό, loading false', () => {
    const { result: hook } = renderFloors(null);

    expect(subscribeMock).not.toHaveBeenCalled();
    expect(hook.current).toEqual({ data: [], loading: false, error: null });
  });

  it('κλειδί ⇒ μία συνδρομή, με τους περιορισμούς ΤΟΥ κλειδιού', () => {
    renderFloors('bld-1');

    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(captured[0].collection).toBe('FLOORS');
    expect(captured[0].options.constraints).toEqual([
      { field: 'buildingId', op: '==', value: 'bld-1' },
    ]);
  });

  it('🔑 ΑΛΛΑΓΗ κλειδιού ⇒ κλείνει η παλιά, ανοίγει νέα με το ΝΕΟ κλειδί', () => {
    const { rerender } = renderFloors('bld-1');
    rerender({ id: 'bld-2' });

    expect(subscribeMock).toHaveBeenCalledTimes(2);
    expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
    expect(captured[1].options.constraints).toEqual([
      { field: 'buildingId', op: '==', value: 'bld-2' },
    ]);
  });

  it('🔴 ΙΔΙΟ κλειδί σε νέο render ⇒ ΚΑΜΙΑ επανασυνδρομή', () => {
    // ⚠️ Ο φρουρός του `ref`: τα `constraints`/`select` γράφονται inline, άρα
    // αλλάζουν ταυτότητα σε κάθε render. Στις εξαρτήσεις, θα ξανάνοιγαν τη
    // συνδρομή κάθε φορά — ακριβώς η βλάβη που όλο το §22 λύνει.
    const { rerender } = renderFloors('bld-1');
    rerender({ id: 'bld-1' });
    rerender({ id: 'bld-1' });

    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });

  it('unmount ⇒ κλείνει η συνδρομή', () => {
    const { unmount } = renderFloors('bld-1');
    unmount();

    expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Β. ΤΑ ΔΕΔΟΜΕΝΑ
// ============================================================================

describe('Β. παράδοση δεδομένων', () => {
  it('το select χαρτογραφεί, το loading σβήνει, το error μένει null', async () => {
    const { result: hook } = renderFloors('bld-1');
    expect(hook.current.loading).toBe(true);

    act(() => captured[0].onData(result(['f1', 'f2'])));

    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(hook.current.data).toEqual(['f1', 'f2']);
    expect(hook.current.error).toBeNull();
  });
});

// ============================================================================
// Γ. 🔴 ΟΙ ΔΥΟ ΣΙΩΠΕΣ — ΤΟ ΖΕΥΓΟΣ
// ============================================================================

describe('Γ. οι δύο σιωπές δεν λένε το ίδιο', () => {
  function missingTenant(): Error {
    const error = new Error('No company');
    error.name = 'MissingTenantError';
    return error;
  }

  it('ΣΧΕΔΙΑΣΜΕΝΗ σιωπή (αυτόνομος) ⇒ κενό, ΚΑΜΙΑ κόκκινη γραμμή', async () => {
    const { result: hook } = renderFloors('bld-1');

    act(() => captured[0].onError(missingTenant()));

    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(hook.current.data).toEqual([]);
    expect(hook.current.error).toBeNull();
    expect(logger.error).not.toHaveBeenCalled(); // ⚠️ ο θόρυβος κρύβει τα αληθινά
  });

  it('🔴 ΒΛΑΒΗ ⇒ ορατό error ΚΑΙ καταγραφή — όχι σιωπηλή κατάποση', async () => {
    const { result: hook } = renderFloors('bld-1');

    act(() => captured[0].onError(new Error('permission-denied')));

    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(hook.current.error).toBe('permission-denied');
    expect(logger.error).toHaveBeenCalledWith('Realtime subscription error', {
      collection: 'FLOORS',
      error: 'permission-denied',
    });
  });

  it('🔑 ΤΟ ΖΕΥΓΟΣ: η μία σιωπά, η άλλη φωνάζει — και ΔΕΝ είναι εναλλάξιμες', async () => {
    const designed = renderFloors('bld-1');
    act(() => captured[0].onError(missingTenant()));
    await waitFor(() => expect(designed.result.current.loading).toBe(false));
    const designedErrors = (logger.error as jest.Mock).mock.calls.length;

    const broken = renderFloors('bld-2');
    act(() => captured[1].onError(new Error('unavailable')));
    await waitFor(() => expect(broken.result.current.loading).toBe(false));

    expect(designed.result.current.error).toBeNull();
    expect(broken.result.current.error).toBe('unavailable');
    expect((logger.error as jest.Mock).mock.calls.length).toBe(designedErrors + 1);
  });
});

// ============================================================================
// Δ. Ο ΧΕΙΡΙΣΤΗΣ, ΞΕΧΩΡΙΣΤΑ
// ============================================================================

describe('Δ. createSubscriptionErrorHandler', () => {
  it('δρομολογεί στη σωστή έκβαση, χωρίς React', () => {
    const onDesignedEmpty = jest.fn();
    const onFailure = jest.fn();
    const handle = createSubscriptionErrorHandler({
      logger,
      collection: 'FILES',
      onDesignedEmpty,
      onFailure,
    });

    const tenant = new Error('no company');
    tenant.name = 'MissingTenantError';
    handle(tenant);
    expect(onDesignedEmpty).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();

    handle(new Error('boom'));
    expect(onFailure).toHaveBeenCalledWith('boom');
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
