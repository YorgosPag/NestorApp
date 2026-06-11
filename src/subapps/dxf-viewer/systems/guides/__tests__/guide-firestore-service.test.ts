/**
 * ADR-441 Slice 1 — GridGuideFirestoreService unit tests.
 * Mirror του foundation-firestore-service.test.ts (Firestore SDK +
 * firestoreQueryService mocked).
 *
 * Covers: enterprise-id gen (N.6, grd_), createGrid payload + scope stamping
 * (ADR-420 floorId), updateGrid patch fields, subscribe constraints, addDoc-never.
 */

interface StoreDoc {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

const store = new Map<string, StoreDoc>();

const mockSetDoc = jest.fn(async (ref: { id: string }, data: Record<string, unknown>) => {
  store.set(ref.id, { id: ref.id, data });
});
const mockUpdateDoc = jest.fn(async (ref: { id: string }, data: Record<string, unknown>) => {
  const existing = store.get(ref.id);
  store.set(ref.id, { id: ref.id, data: { ...(existing?.data ?? {}), ...data } });
});
const mockDeleteDoc = jest.fn(async (ref: { id: string }) => { store.delete(ref.id); });
const mockAddDoc = jest.fn(); // Tracks SOS N.6 violation if ever called

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ..._segments: string[]) => ({
    id: _segments[_segments.length - 1],
  })),
  setDoc: (...args: Parameters<typeof mockSetDoc>) => mockSetDoc(...args),
  updateDoc: (...args: Parameters<typeof mockUpdateDoc>) => mockUpdateDoc(...args),
  deleteDoc: (...args: Parameters<typeof mockDeleteDoc>) => mockDeleteDoc(...args),
  serverTimestamp: jest.fn(() => '__server_timestamp__'),
  where: jest.fn((field: string, op: string, value: unknown) => ({ __where: true, field, op, value })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
}));

jest.mock('@/lib/firebase', () => ({ db: { __mockDb: true } }));

interface CapturedSubscribe {
  key: string;
  options: { constraints?: Array<{ field: string; value: unknown }> } | undefined;
}
const subscribeCalls: CapturedSubscribe[] = [];
const mockUnsubscribe = jest.fn();

jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    subscribe: jest.fn((key: string, _onData: unknown, _onError: unknown, options?: CapturedSubscribe['options']) => {
      subscribeCalls.push({ key, options });
      return mockUnsubscribe;
    }),
  },
}));

let mockIdCounter = 0;
jest.mock('@/services/enterprise-id-convenience', () => ({
  generateGridGuideDocId: () => {
    mockIdCounter += 1;
    return `grd_test${String(mockIdCounter).padStart(20, '0')}`;
  },
}));

// SUT import AFTER mocks
import {
  GridGuideFirestoreService,
  createGridGuideFirestoreService,
} from '../guide-firestore-service';
import type { GuideSnapshot } from '../guide-persistence-types';

const GUIDES: readonly GuideSnapshot[] = [
  {
    id: 'guide_X_001', axis: 'X', offset: 4000, label: 'A', style: null,
    visible: true, locked: false, createdAt: '__ts__', parentId: null, groupId: null,
  },
];

const CONFIG = { companyId: 'c1', projectId: 'p1', floorplanId: 'fp1', userId: 'u1' };

beforeEach(() => {
  store.clear();
  mockIdCounter = 0;
  subscribeCalls.length = 0;
  mockSetDoc.mockClear();
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockAddDoc.mockClear();
  mockUnsubscribe.mockClear();
});

describe('GridGuideFirestoreService — factory', () => {
  it('returns instance', () => {
    expect(createGridGuideFirestoreService(CONFIG)).toBeInstanceOf(GridGuideFirestoreService);
  });
});

describe('GridGuideFirestoreService.createGrid', () => {
  it('generates enterprise grd_ ID when not provided (N.6) — never addDoc', async () => {
    const svc = createGridGuideFirestoreService(CONFIG);
    const id = await svc.createGrid({ guides: GUIDES, groups: [], version: 1 });
    expect(id).toMatch(/^grd_test\d{20}$/);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('preserves id when provided', async () => {
    const svc = createGridGuideFirestoreService(CONFIG);
    const id = await svc.createGrid({ id: 'grd_existing', guides: GUIDES, groups: [], version: 2 });
    expect(id).toBe('grd_existing');
  });

  it('stamps scope + audit fields + embedded guides/groups/version', async () => {
    const svc = createGridGuideFirestoreService(CONFIG);
    await svc.createGrid({ guides: GUIDES, groups: [], version: 1 });
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.companyId).toBe('c1');
    expect(payload.projectId).toBe('p1');
    expect(payload.floorplanId).toBe('fp1');
    expect(payload.createdBy).toBe('u1');
    expect(payload.createdAt).toBe('__server_timestamp__');
    expect(payload.guides).toBe(GUIDES);
    expect(payload.version).toBe(1);
  });

  it('persists floorId from config scope (ADR-420)', async () => {
    const svc = createGridGuideFirestoreService({ ...CONFIG, floorId: 'flr_1' });
    await svc.createGrid({ guides: GUIDES, groups: [], version: 1 });
    expect(mockSetDoc.mock.calls[0][1].floorId).toBe('flr_1');
  });
});

describe('GridGuideFirestoreService.updateGrid', () => {
  it('touches updatedBy/At + guides/groups/version, never createdAt', async () => {
    const svc = createGridGuideFirestoreService(CONFIG);
    await svc.updateGrid('grd_1', { guides: GUIDES, groups: [], version: 3 });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.updatedBy).toBe('u1');
    expect(payload.version).toBe(3);
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('companyId');
  });
});

describe('GridGuideFirestoreService.subscribeGrid', () => {
  it('routes through FLOORPLAN_GRID_GUIDES key + scopes by floorId when bound', () => {
    const svc = createGridGuideFirestoreService({ ...CONFIG, floorId: 'flr_1' });
    svc.subscribeGrid(jest.fn(), jest.fn());
    const last = subscribeCalls[subscribeCalls.length - 1];
    expect(last.key).toBe('FLOORPLAN_GRID_GUIDES');
    const constraints = last.options?.constraints;
    expect(constraints!.find((c) => (c as { field: string }).field === 'floorId'))
      .toEqual(expect.objectContaining({ field: 'floorId', value: 'flr_1' }));
    expect(constraints!.find((c) => (c as { field: string }).field === 'floorplanId')).toBeUndefined();
  });
});
