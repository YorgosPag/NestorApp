/**
 * ADR-436 Slice 1-persist — FoundationFirestoreService unit tests.
 * Mirror του stair-firestore-service.test.ts (Firestore SDK + firestoreQueryService mocked).
 *
 * Covers: enterprise-id gen (N.6), setDoc payload shape, audit fields, scope
 * stamping (ADR-420 floorId), optional-field omission, entityToSaveInput geometry
 * strip, subscribe constraints, addDoc-never-called.
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
  generateFoundationId: () => {
    mockIdCounter += 1;
    return `fnd_test${String(mockIdCounter).padStart(20, '0')}`;
  },
}));

// SUT import AFTER mocks
import {
  FoundationFirestoreService,
  createFoundationFirestoreService,
  entityToSaveInput,
} from '../foundation-firestore-service';
import type { FoundationParams, FoundationEntity } from '../../types/foundation-types';
import type { BimValidation } from '../../types/bim-base';

const PAD_PARAMS: FoundationParams = {
  kind: 'pad',
  topElevationMm: -1000,
  thicknessMm: 500,
  position: { x: 0, y: 0, z: 0 },
  width: 1500,
  length: 1500,
  rotation: 0,
  anchor: 'center',
  profile: 'flat',
};

const VALIDATION: BimValidation = {
  hasCodeViolations: false,
  violationKeys: [],
  lastValidatedAt: '__ts__' as unknown as BimValidation['lastValidatedAt'],
};

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

describe('FoundationFirestoreService — factory', () => {
  it('returns instance', () => {
    expect(createFoundationFirestoreService(CONFIG)).toBeInstanceOf(FoundationFirestoreService);
  });
});

describe('FoundationFirestoreService.saveFoundation', () => {
  it('generates enterprise fnd_ ID when not provided (N.6) — never addDoc', async () => {
    const svc = createFoundationFirestoreService(CONFIG);
    const d = await svc.saveFoundation({ kind: 'pad', params: PAD_PARAMS, validation: VALIDATION });
    expect(d.id).toMatch(/^fnd_test\d{20}$/);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('preserves id when provided (id-preserving overwrite)', async () => {
    const svc = createFoundationFirestoreService(CONFIG);
    const d = await svc.saveFoundation({ id: 'fnd_existing', kind: 'pad', params: PAD_PARAMS, validation: VALIDATION });
    expect(d.id).toBe('fnd_existing');
  });

  it('stamps scope + audit fields', async () => {
    const svc = createFoundationFirestoreService(CONFIG);
    await svc.saveFoundation({ kind: 'pad', params: PAD_PARAMS, validation: VALIDATION });
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.companyId).toBe('c1');
    expect(payload.projectId).toBe('p1');
    expect(payload.floorplanId).toBe('fp1');
    expect(payload.createdBy).toBe('u1');
    expect(payload.updatedBy).toBe('u1');
    expect(payload.createdAt).toBe('__server_timestamp__');
  });

  it('omits optional fields when absent (Firestore rejects undefined) — no buildingId', async () => {
    const svc = createFoundationFirestoreService(CONFIG);
    await svc.saveFoundation({ kind: 'pad', params: PAD_PARAMS, validation: VALIDATION });
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('geometry');
    expect(payload).not.toHaveProperty('buildingId');
    expect(payload).not.toHaveProperty('floorId');
    expect(payload).not.toHaveProperty('layerId');
  });

  it('persists floorId from config scope (ADR-420) + layerId when provided', async () => {
    const svc = createFoundationFirestoreService({ ...CONFIG, floorId: 'flr_1' });
    await svc.saveFoundation({ kind: 'pad', params: PAD_PARAMS, validation: VALIDATION, layerId: 'FND' });
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.floorId).toBe('flr_1');
    expect(payload.layerId).toBe('FND');
  });
});

describe('FoundationFirestoreService.updateFoundation / deleteFoundation', () => {
  it('update touches updatedBy/At + patch fields only', async () => {
    const svc = createFoundationFirestoreService(CONFIG);
    await svc.updateFoundation('fnd_1', { params: PAD_PARAMS });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.updatedBy).toBe('u1');
    expect(payload.params).toBe(PAD_PARAMS);
    expect(payload).not.toHaveProperty('companyId');
    expect(payload).not.toHaveProperty('createdAt');
  });

  it('delete routes deleteDoc by id', async () => {
    const svc = createFoundationFirestoreService(CONFIG);
    await svc.deleteFoundation('fnd_1');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  // ADR-441 Slice 6b — re-host writes hosting bindings into an existing doc.
  it('update persists guideBindings when provided, omits the key when undefined', async () => {
    const svc = createFoundationFirestoreService(CONFIG);
    const bindings = [{ guideId: 'x0', slot: 'start-x' as const }];
    await svc.updateFoundation('fnd_1', { guideBindings: bindings });
    expect(mockUpdateDoc.mock.calls[0][1].guideBindings).toEqual(bindings);

    mockUpdateDoc.mockClear();
    await svc.updateFoundation('fnd_1', { params: PAD_PARAMS });
    expect(mockUpdateDoc.mock.calls[0][1]).not.toHaveProperty('guideBindings');
  });
});

describe('FoundationFirestoreService.subscribeFoundations', () => {
  it('routes through FLOORPLAN_FOUNDATIONS key + scopes by floorId when bound', () => {
    const svc = createFoundationFirestoreService({ ...CONFIG, floorId: 'flr_1' });
    svc.subscribeFoundations(jest.fn(), jest.fn());
    const last = subscribeCalls[subscribeCalls.length - 1];
    expect(last.key).toBe('FLOORPLAN_FOUNDATIONS');
    const constraints = last.options?.constraints;
    expect(constraints!.find((c) => (c as { field: string }).field === 'floorId'))
      .toEqual(expect.objectContaining({ field: 'floorId', value: 'flr_1' }));
    expect(constraints!.find((c) => (c as { field: string }).field === 'floorplanId')).toBeUndefined();
  });
});

describe('entityToSaveInput', () => {
  it('strips geometry (re-derivable) + carries id/kind/params/validation/layerId', () => {
    const entity = {
      id: 'fnd_9', type: 'foundation', kind: 'pad', layerId: 'FND',
      params: PAD_PARAMS, geometry: { area: 2.25 }, validation: VALIDATION,
    } as unknown as FoundationEntity;
    const input = entityToSaveInput(entity);
    expect(input).not.toHaveProperty('geometry');
    expect(input).toMatchObject({ id: 'fnd_9', kind: 'pad', params: PAD_PARAMS, layerId: 'FND' });
  });

  // ADR-441 Slice 3 — grid hosting bindings round-trip.
  it('carries guideBindings when the entity is grid-hosted', () => {
    const entity = {
      id: 'fnd_h', type: 'foundation', kind: 'strip', layerId: '0',
      params: PAD_PARAMS, validation: VALIDATION,
      guideBindings: [{ guideId: 'x1', slot: 'start-x' }, { guideId: 'y1', slot: 'start-y' }],
    } as unknown as FoundationEntity;
    expect(entityToSaveInput(entity).guideBindings).toEqual([
      { guideId: 'x1', slot: 'start-x' },
      { guideId: 'y1', slot: 'start-y' },
    ]);
  });

  it('leaves guideBindings undefined for an unhosted entity (Firestore-safe omission)', () => {
    const entity = {
      id: 'fnd_p', type: 'foundation', kind: 'pad', layerId: '0',
      params: PAD_PARAMS, validation: VALIDATION,
    } as unknown as FoundationEntity;
    expect(entityToSaveInput(entity).guideBindings).toBeUndefined();
  });
});

describe('FoundationFirestoreService.saveFoundation — guideBindings (ADR-441 Slice 3)', () => {
  it('persists guideBindings when present, omits the key when absent', async () => {
    const svc = createFoundationFirestoreService(CONFIG);
    const bindings = [{ guideId: 'x1', slot: 'start-x' as const }];
    await svc.saveFoundation({ kind: 'strip', params: PAD_PARAMS, validation: VALIDATION, guideBindings: bindings });
    expect(mockSetDoc.mock.calls[0][1].guideBindings).toEqual(bindings);

    mockSetDoc.mockClear();
    await svc.saveFoundation({ kind: 'pad', params: PAD_PARAMS, validation: VALIDATION });
    expect(mockSetDoc.mock.calls[0][1]).not.toHaveProperty('guideBindings');
  });
});
