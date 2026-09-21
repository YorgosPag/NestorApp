/**
 * @fileoverview **ΑΓΚΥΡΕΣ: ΠΟΙΑ ΠΥΛΗ ΤΑΥΤΟΤΗΤΑΣ ΕΠΙΛΕΓΕΙ ΤΟ `firestoreQueryService`** (2026-09-21)
 * @related services/firestore/firestore-query.service (`contextFor`) · user-scoped-context.test.ts
 *
 * Συλλογή ανθρώπου (`mode: 'userId'`) ⇒ `requireUserContext` (αρκεί ο συνδεδεμένος).
 * Οποιαδήποτε άλλη ⇒ `requireAuthContext` (οργανισμός). Ο αυτόνομος στο `/o/me` έχανε
 * σιωπηλά τις δικές του ειδοποιήσεις επειδή **όλες** περνούσαν από τη δεύτερη.
 */

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...parts: string[]) => ({ __path: parts.join('/') })),
  doc: jest.fn((_db: unknown, name: string, id: string) => ({ __doc: `${name}/${id}` })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn((field: string, op: string, value: unknown) => ({ where: [field, op, value] })),
  limit: jest.fn((n: number) => ({ limit: n })),
  documentId: jest.fn(() => '__id__'),
  serverTimestamp: jest.fn(() => '__ts__'),
  onSnapshot: jest.fn(() => () => undefined),
  getDoc: jest.fn(),
  getDocs: jest.fn(async () => ({ docs: [], size: 0, empty: true })),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

const mockUserCtx = { uid: 'u1', companyId: null, isSuperAdmin: false, requested: { kind: 'personal' } };

jest.mock('../auth-context', () => ({
  requireAuthContext: jest.fn(async () => { throw new Error('tenant required'); }),
  requireUserContext: jest.fn(async () => mockUserCtx),
  waitForAuthReady: jest.fn(async () => true),
  resolveEffectiveCompanyId: jest.fn(() => null),
}));

jest.mock('../super-admin-active-company', () => ({
  onSuperAdminActiveCompanyChange: jest.fn(() => () => undefined),
}));

jest.mock('../tenant-config', () => ({
  getTenantConfig: jest.fn((key: string) =>
    key === 'NOTIFICATIONS' || key === 'USER_NOTIFICATION_SETTINGS'
      ? { mode: 'userId', fieldName: 'userId' }
      : { mode: 'companyId', fieldName: 'companyId' }),
  resolveTenantValue: jest.fn((mode: string, ctx: { uid: string }) => (mode === 'userId' ? ctx.uid : null)),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: new Proxy({}, { get: (_t, key) => String(key).toLowerCase() }),
  FIRESTORE_LIMITS: { IN_QUERY_MAX_ITEMS: 10 },
}));

jest.mock('@/lib/auth/query-middleware', () => ({
  AuthorizationError: class extends Error {},
  QueryExecutionError: class extends Error {},
}));

import { onSnapshot } from 'firebase/firestore';
import { requireAuthContext, requireUserContext } from '../auth-context';
import { firestoreQueryService } from '../firestore-query.service';

const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

describe('firestoreQueryService — η πύλη ταυτότητας ακολουθεί τη συλλογή', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Κ4: subscribeDoc σε συλλογή ανθρώπου στήνει ακροατή ΧΩΡΙΣ οργανισμό (η ζωντανή βλάβη)', async () => {
    const onError = jest.fn();
    firestoreQueryService.subscribeDoc('USER_NOTIFICATION_SETTINGS', 'u1', jest.fn(), onError);
    await flush();
    expect(requireUserContext).toHaveBeenCalled();
    expect(requireAuthContext).not.toHaveBeenCalled();
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('Κ5: getAll σε συλλογή ανθρώπου φιλτράρει με το uid, χωρίς οργανισμό', async () => {
    await expect(firestoreQueryService.getAll('NOTIFICATIONS')).resolves.toMatchObject({ documents: [] });
    expect(requireUserContext).toHaveBeenCalled();
    expect(requireAuthContext).not.toHaveBeenCalled();
  });

  it('Κ6: συλλογή εταιρείας ΣΥΝΕΧΙΖΕΙ να ζητά οργανισμό (καμία διεύρυνση)', async () => {
    const onError = jest.fn();
    firestoreQueryService.subscribeDoc('PROJECTS', 'p1', jest.fn(), onError);
    await flush();
    expect(requireAuthContext).toHaveBeenCalled();
    expect(requireUserContext).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
