/**
 * Η ΜΙΑ ροή ειδοποιήσεων ανά χρήστη (ADR-927): μέτρηση αναφορών, άδειασμα στην αλλαγή χρήστη,
 * σελιδοποίηση με δρομέα-τιμή. Το σφάλμα που φυλάει: δύο ακροατές (κουδούνι + σελίδα) για τα ίδια έγγραφα.
 */

import type { Notification } from '@/types/notification';

type Listener = (ns: Notification[]) => void;
type ErrorListener = (e: Error) => void;

const mockSubscriptions: { uid: string; onUpdate: Listener; onError?: ErrorListener; unsubscribe: jest.Mock }[] = [];
const mockFetchBefore = jest.fn();

jest.mock('@/services/notificationService', () => ({
  NOTIFICATION_PAGE_SIZE: 2,
  subscribeToNotifications: (uid: string, onUpdate: Listener, onError?: ErrorListener) => {
    const unsubscribe = jest.fn();
    mockSubscriptions.push({ uid, onUpdate, onError, unsubscribe });
    return unsubscribe;
  },
  fetchNotificationsBefore: (...args: unknown[]) => mockFetchBefore(...args),
}));
jest.mock('@/services/firestore/auth-context', () => ({
  isMissingTenantError: (e: Error) => e.message === 'no-tenant',
}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }) }));

import { useNotificationCenter } from '../notificationCenter';
import {
  __resetNotificationFeedForTests,
  acquireNotificationFeed,
  loadOlderNotifications,
  restartNotificationFeed,
} from '../notification-feed';

function n(id: string, createdAt: string, state: Notification['delivery']['state'] = 'delivered'): Notification {
  return {
    id, tenantId: 't', userId: 'u', createdAt, severity: 'info', title: id,
    source: { service: 'test' }, channel: 'inapp', delivery: { state, attempts: 1 },
  };
}

const store = () => useNotificationCenter.getState();
const last = () => mockSubscriptions[mockSubscriptions.length - 1];

beforeEach(() => {
  __resetNotificationFeedForTests();
  mockSubscriptions.length = 0;
  mockFetchBefore.mockReset();
  store().reset();
});

describe('notification-feed — ένας ακροατής', () => {
  it('δύο δανειζόμενοι του ίδιου χρήστη ανοίγουν ΕΝΑΝ ακροατή', () => {
    acquireNotificationFeed('u1');
    acquireNotificationFeed('u1');
    expect(mockSubscriptions).toHaveLength(1);
  });

  it('κλείνει μόνο όταν επιστρέψει ο τελευταίος — και αδειάζει τη μνήμη', () => {
    const a = acquireNotificationFeed('u1');
    const b = acquireNotificationFeed('u1');
    last().onUpdate([n('x', '2026-11-03T10:00:00Z')]);
    a();
    expect(last().unsubscribe).not.toHaveBeenCalled();
    b();
    expect(last().unsubscribe).toHaveBeenCalledTimes(1);
    expect(store().order).toEqual([]);
  });

  it('η επιστροφή είναι ιδεμποτική (Strict Mode)', () => {
    const a = acquireNotificationFeed('u1');
    acquireNotificationFeed('u1');
    a();
    a();
    expect(last().unsubscribe).not.toHaveBeenCalled();
  });

  it('αλλαγή χρήστη: κλείνει την παλιά ροή και αδειάζει ΠΡΙΝ ανοίξει η νέα', () => {
    acquireNotificationFeed('u1');
    const first = last();
    first.onUpdate([n('of-u1', '2026-11-03T10:00:00Z')]);
    acquireNotificationFeed('u2');
    expect(first.unsubscribe).toHaveBeenCalled();
    expect(store().items.has('of-u1')).toBe(false);
    expect(last().uid).toBe('u2');
  });

  it('καθυστερημένο στιγμιότυπο κλεισμένης ροής πετιέται', () => {
    const release = acquireNotificationFeed('u1');
    const stale = last();
    release();
    stale.onUpdate([n('ghost', '2026-11-03T10:00:00Z')]);
    expect(store().items.has('ghost')).toBe(false);
  });

  it('«δεν έχεις εταιρεία» δεν είναι σφάλμα', () => {
    acquireNotificationFeed('u1');
    last().onError?.(new Error('no-tenant'));
    expect(store().status).toBe('ready');
    expect(store().error).toBeUndefined();
  });

  it('το «Δοκιμή ξανά» ξανανοίγει και κρατά τους δανειζόμενους', () => {
    const a = acquireNotificationFeed('u1');
    last().onError?.(new Error('boom'));
    expect(store().status).toBe('error');
    restartNotificationFeed();
    expect(mockSubscriptions).toHaveLength(2);
    expect(store().error).toBeUndefined();
    a();
    expect(last().unsubscribe).toHaveBeenCalled();
  });

  it('μετά το «Δοκιμή ξανά» η παλιά σύνδεση δεν γράφει πια', () => {
    acquireNotificationFeed('u1');
    const old = last();
    restartNotificationFeed();
    old.onUpdate([n('stale', '2026-11-03T10:00:00Z')]);
    old.onError?.(new Error('boom'));
    expect(store().items.has('stale')).toBe(false);
    expect(store().error).toBeUndefined();
  });
});

describe('notification-feed — παλαιότερες σελίδες', () => {
  it('γεμάτο παράθυρο ⇒ hasMore· ο δρομέας είναι η παλαιότερη (createdAt, id)', async () => {
    acquireNotificationFeed('u1');
    last().onUpdate([n('b', '2026-11-03T10:00:00Z'), n('a', '2026-11-02T10:00:00Z')]);
    expect(store().hasMore).toBe(true);

    mockFetchBefore.mockResolvedValue([n('z', '2026-11-01T10:00:00Z')]);
    await loadOlderNotifications();
    expect(mockFetchBefore).toHaveBeenCalledWith({ createdAt: '2026-11-02T10:00:00Z', id: 'a' });
    expect(store().order).toEqual(['b', 'a', 'z']);
    expect(store().hasMore).toBe(false);
    expect(store().loadingOlder).toBe(false);
  });

  it('μετά από σελιδοποίηση, νέο στιγμιότυπο του παραθύρου ΔΕΝ ξαναγράφει το hasMore', async () => {
    acquireNotificationFeed('u1');
    last().onUpdate([n('b', '2026-11-03T10:00:00Z'), n('a', '2026-11-02T10:00:00Z')]);
    mockFetchBefore.mockResolvedValue([n('z', '2026-11-01T10:00:00Z'), n('y', '2026-10-31T10:00:00Z')]);
    await loadOlderNotifications();
    expect(store().hasMore).toBe(true);
    last().onUpdate([n('c', '2026-11-03T11:00:00Z')]);
    expect(store().hasMore).toBe(true);
  });

  it('αποτέλεσμα που φτάνει μετά από αλλαγή χρήστη πετιέται', async () => {
    acquireNotificationFeed('u1');
    last().onUpdate([n('b', '2026-11-03T10:00:00Z'), n('a', '2026-11-02T10:00:00Z')]);
    let resolve: (v: Notification[]) => void = () => undefined;
    mockFetchBefore.mockReturnValue(new Promise<Notification[]>((r) => { resolve = r; }));
    const pending = loadOlderNotifications();
    acquireNotificationFeed('u2');
    resolve([n('leak', '2026-11-01T10:00:00Z')]);
    await pending;
    expect(store().items.has('leak')).toBe(false);
  });
});
