/**
 * @fileoverview **ΑΓΚΥΡΑ: μόνο η ΤΕΛΕΥΤΑΙΑ ανοικοδόμηση στήνει ακροατή** (ADR-849 Β1).
 * @related services/firestore/firestore-query.service (`subscribe` → `rebuild`)
 *
 * 🔴 Το `rebuild` περιμένει (`waitForAuthReady` · `requireAuthContext`). Με τη διεύθυνση
 * ως αρχή του χώρου, μια μετάβαση `/o/A` → `/o/B` δίνει **δύο** ειδοποιήσεις στο ίδιο
 * commit («έξοδος» + «νέος χώρος»). Χωρίς μετρητή γενιάς, κάθε αναμονή έστηνε δικό της
 * `onSnapshot` και οι προηγούμενοι **δεν απεγγράφονταν ποτέ** — διαρροή ακροατών, δηλαδή
 * αναγνώσεις που πληρώνονται για πάντα.
 */

const mockUnsubscribes: jest.Mock[] = [];
const mockOnSnapshot = jest.fn(() => {
  const unsubscribe = jest.fn();
  mockUnsubscribes.push(unsubscribe);
  return unsubscribe;
});

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ __collection: true })),
  doc: jest.fn(),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  documentId: jest.fn(),
  serverTimestamp: jest.fn(),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [])),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

/** Η πύλη ετοιμότητας ταυτότητας — ανοίγει όταν το πει το test. */
let openAuthGate: () => void = () => undefined;
let authGate: Promise<boolean> = Promise.resolve(true);

jest.mock('../auth-context', () => ({
  waitForAuthReady: jest.fn(() => authGate),
  requireAuthContext: jest.fn(async () => ({
    uid: 'u1',
    companyId: 'c1',
    isSuperAdmin: false,
    requested: { kind: 'default' },
  })),
  resolveEffectiveCompanyId: jest.fn(() => 'c1'),
}));

let notifyScopeChange: () => void = () => undefined;
jest.mock('../super-admin-active-company', () => ({
  onSuperAdminActiveCompanyChange: jest.fn((listener: () => void) => {
    notifyScopeChange = listener;
    return () => undefined;
  }),
}));

jest.mock('../tenant-config', () => ({
  getTenantConfig: jest.fn(() => ({ mode: 'companyId', fieldName: 'companyId' })),
  resolveTenantValue: jest.fn(() => 'c1'),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: new Proxy({}, { get: (_t, key) => String(key).toLowerCase() }),
  FIRESTORE_LIMITS: { IN_QUERY_MAX_ITEMS: 10 },
}));

jest.mock('@/lib/auth/query-middleware', () => ({
  AuthorizationError: class extends Error {},
  QueryExecutionError: class extends Error {},
}));

import { firestoreQueryService } from '../firestore-query.service';

async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  mockOnSnapshot.mockClear();
  mockUnsubscribes.length = 0;
  authGate = new Promise<boolean>((resolve) => {
    openAuthGate = () => resolve(true);
  });
});

describe('firestoreQueryService.subscribe — γενιά ανοικοδόμησης', () => {
  it('Ρ1 🔴 τρεις ανοικοδομήσεις σε αναμονή ⇒ ΕΝΑΣ ακροατής, όχι τρεις', async () => {
    const stop = firestoreQueryService.subscribe('PROPERTIES' as never, jest.fn(), jest.fn());

    // Αρχική + δύο αλλαγές χώρου (π.χ. `/o/A` → `/o/B`) — όλες πριν ανοίξει η ταυτότητα.
    notifyScopeChange();
    notifyScopeChange();
    openAuthGate();
    await flushMicrotasks();

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    stop();
    expect(mockUnsubscribes[0]).toHaveBeenCalledTimes(1);
  });

  it('Ρ2: νέα αλλαγή μετά το στήσιμο ⇒ ο παλιός ακροατής απεγγράφεται, ο νέος στήνεται', async () => {
    openAuthGate();
    const stop = firestoreQueryService.subscribe('PROPERTIES' as never, jest.fn(), jest.fn());
    await flushMicrotasks();
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

    notifyScopeChange();
    await flushMicrotasks();

    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    expect(mockUnsubscribes[0]).toHaveBeenCalledTimes(1);
    stop();
    expect(mockUnsubscribes[1]).toHaveBeenCalledTimes(1);
  });

  it('Ρ3: ακύρωση ενώ περιμένει ⇒ κανένας ακροατής', async () => {
    const stop = firestoreQueryService.subscribe('PROPERTIES' as never, jest.fn(), jest.fn());
    stop();
    openAuthGate();
    await flushMicrotasks();

    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });
});
