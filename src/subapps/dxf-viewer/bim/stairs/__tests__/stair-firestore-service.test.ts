/**
 * ADR-358 Phase 8 — StairFirestoreService unit tests.
 *
 * Covers:
 *   - saveStair: enterprise ID generation, setDoc payload shape, audit fields,
 *     optional field omission, id preservation when provided.
 *   - updateStair: patch surface, immutable fields excluded, updatedBy/At touched.
 *   - deleteStair: deletes by id.
 *   - acquireLock / releaseLock: editingBy stamped + cleared via deleteField sentinel.
 *   - subscribeStairs: routes through firestoreQueryService.subscribe with
 *     (projectId, floorplanId) constraints + correct collection key.
 *   - SOS N.6: addDoc never called.
 *
 * Firestore SDK + firestoreQueryService both fully mocked.
 */

import type { StairDoc, StairParams } from '../../../bim/types/stair-types';

// ---------------------------------------------------------------------------
// Firestore mock
// ---------------------------------------------------------------------------

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
  store.set(ref.id, {
    id: ref.id,
    data: { ...(existing?.data ?? {}), ...data },
  });
});

const mockDeleteDoc = jest.fn(async (ref: { id: string }) => {
  store.delete(ref.id);
});

const mockDeleteField = jest.fn(() => '__delete_field__');

const mockAddDoc = jest.fn(); // Tracks SOS N.6 violation if ever called

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ..._segments: string[]) => ({
    id: _segments[_segments.length - 1],
  })),
  setDoc: (...args: Parameters<typeof mockSetDoc>) => mockSetDoc(...args),
  updateDoc: (...args: Parameters<typeof mockUpdateDoc>) => mockUpdateDoc(...args),
  deleteDoc: (...args: Parameters<typeof mockDeleteDoc>) => mockDeleteDoc(...args),
  deleteField: (...args: Parameters<typeof mockDeleteField>) => mockDeleteField(...args),
  serverTimestamp: jest.fn(() => '__server_timestamp__'),
  where: jest.fn((field: string, op: string, value: unknown) => ({
    __where: true,
    field,
    op,
    value,
  })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
}));

jest.mock('@/lib/firebase', () => ({
  db: { __mockDb: true },
}));

// ---------------------------------------------------------------------------
// firestoreQueryService mock
// ---------------------------------------------------------------------------

interface CapturedSubscribe {
  key: string;
  onData: (result: { documents: readonly StairDoc[] }) => void;
  onError: (err: Error) => void;
  options: { constraints?: Array<{ field: string; value: unknown }> } | undefined;
}

const subscribeCalls: CapturedSubscribe[] = [];
const mockUnsubscribe = jest.fn();

jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    subscribe: jest.fn(
      (
        key: string,
        onData: (result: { documents: readonly StairDoc[] }) => void,
        onError: (err: Error) => void,
        options?: { constraints?: Array<{ field: string; value: unknown }> },
      ) => {
        subscribeCalls.push({ key, onData, onError, options });
        return mockUnsubscribe;
      },
    ),
  },
}));

// ---------------------------------------------------------------------------
// Enterprise ID mock
// ---------------------------------------------------------------------------

let mockIdCounter = 0;
jest.mock('@/services/enterprise-id.service', () => ({
  generateStairId: () => {
    mockIdCounter += 1;
    return `stair_test${String(mockIdCounter).padStart(20, '0')}`;
  },
}));

// ---------------------------------------------------------------------------
// SUT import AFTER mocks
// ---------------------------------------------------------------------------

import {
  StairFirestoreService,
  createStairFirestoreService,
  entityToSaveInput,
} from '../stair-firestore-service';
import type { StairEntity } from '../../../bim/types/stair-types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_PARAMS: StairParams = {
  basePoint: { x: 0, y: 0 },
  direction: 0,
  rise: 175,
  tread: 280,
  nosing: 20,
  nosingSide: 'front',
  width: 1000,
  stepCount: 16,
  totalRise: 2800,
  totalRun: 4480,
  pitch: 32,
  structureType: 'monolithic',
  riserType: 'closed',
  antiskidNosing: false,
  adaContrastStrip: false,
  variant: { kind: 'straight' },
  walklineOffset: 300,
  handrails: { inner: false, outer: true, height: 900 },
  upDirection: 'forward',
  treadNumberStart: 1,
  treadLabelDisplay: 'all',
  treadLabelRestartPerFlight: false,
  codeProfile: 'nok',
} as unknown as StairParams;

const MINIMAL_VALIDATION = {
  hardErrors: [],
  codeViolations: [],
  warnings: [],
  hasHardErrors: false,
  hasCodeViolations: false,
} as unknown as StairDoc['validation'];

const CONFIG = {
  companyId: 'c1',
  projectId: 'p1',
  floorplanId: 'fp1',
  userId: 'u1',
};

beforeEach(() => {
  store.clear();
  mockIdCounter = 0;
  subscribeCalls.length = 0;
  mockSetDoc.mockClear();
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockDeleteField.mockClear();
  mockAddDoc.mockClear();
  mockUnsubscribe.mockClear();
});

// ===========================================================================
// Factory
// ===========================================================================

describe('StairFirestoreService — factory', () => {
  it('createStairFirestoreService returns instance', () => {
    const svc = createStairFirestoreService(CONFIG);
    expect(svc).toBeInstanceOf(StairFirestoreService);
  });
});

// ===========================================================================
// saveStair
// ===========================================================================

describe('StairFirestoreService.saveStair', () => {
  it('generates enterprise ID when not provided', async () => {
    const svc = createStairFirestoreService(CONFIG);
    const doc1 = await svc.saveStair({
      kind: 'straight',
      params: MINIMAL_PARAMS,
      validation: MINIMAL_VALIDATION,
    });
    expect(doc1.id).toMatch(/^stair_test\d{20}$/);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('preserves id when provided (id-preserving overwrite)', async () => {
    const svc = createStairFirestoreService(CONFIG);
    const doc1 = await svc.saveStair({
      id: 'stair_existing_123',
      kind: 'straight',
      params: MINIMAL_PARAMS,
      validation: MINIMAL_VALIDATION,
    });
    expect(doc1.id).toBe('stair_existing_123');
  });

  it('stamps companyId/projectId/floorplanId from config', async () => {
    const svc = createStairFirestoreService(CONFIG);
    const doc1 = await svc.saveStair({
      kind: 'straight',
      params: MINIMAL_PARAMS,
      validation: MINIMAL_VALIDATION,
    });
    expect(doc1.companyId).toBe('c1');
    expect(doc1.projectId).toBe('p1');
    expect(doc1.floorplanId).toBe('fp1');
  });

  it('stamps audit fields createdBy/updatedBy from userId + server timestamps', async () => {
    const svc = createStairFirestoreService(CONFIG);
    await svc.saveStair({
      kind: 'straight',
      params: MINIMAL_PARAMS,
      validation: MINIMAL_VALIDATION,
    });
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.createdBy).toBe('u1');
    expect(payload.updatedBy).toBe('u1');
    expect(payload.createdAt).toBe('__server_timestamp__');
    expect(payload.updatedAt).toBe('__server_timestamp__');
  });

  it('omits optional fields when not provided (Firestore rejects undefined)', async () => {
    const svc = createStairFirestoreService(CONFIG);
    await svc.saveStair({
      kind: 'straight',
      params: MINIMAL_PARAMS,
      validation: MINIMAL_VALIDATION,
    });
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('geometry');
    expect(payload).not.toHaveProperty('qto');
    expect(payload).not.toHaveProperty('buildingId');
    expect(payload).not.toHaveProperty('floorId');
    expect(payload).not.toHaveProperty('layer');
  });

  it('persists optional fields when provided', async () => {
    const svc = createStairFirestoreService(CONFIG);
    await svc.saveStair({
      kind: 'straight',
      params: MINIMAL_PARAMS,
      validation: MINIMAL_VALIDATION,
      buildingId: 'b1',
      floorId: 'f1',
      layer: 'STAIRS',
    });
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.buildingId).toBe('b1');
    expect(payload.floorId).toBe('f1');
    expect(payload.layer).toBe('STAIRS');
  });

  it('NEVER calls addDoc (SOS N.6 enforcement)', async () => {
    const svc = createStairFirestoreService(CONFIG);
    await svc.saveStair({
      kind: 'straight',
      params: MINIMAL_PARAMS,
      validation: MINIMAL_VALIDATION,
    });
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// updateStair
// ===========================================================================

describe('StairFirestoreService.updateStair', () => {
  it('patches provided fields + touches updatedBy/At', async () => {
    const svc = createStairFirestoreService(CONFIG);
    await svc.updateStair('stair_x', {
      params: MINIMAL_PARAMS,
      validation: MINIMAL_VALIDATION,
    });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.params).toBe(MINIMAL_PARAMS);
    expect(payload.validation).toBe(MINIMAL_VALIDATION);
    expect(payload.updatedBy).toBe('u1');
    expect(payload.updatedAt).toBe('__server_timestamp__');
  });

  it('does NOT include unspecified optional fields', async () => {
    const svc = createStairFirestoreService(CONFIG);
    await svc.updateStair('stair_x', { params: MINIMAL_PARAMS });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('validation');
    expect(payload).not.toHaveProperty('geometry');
    expect(payload).not.toHaveProperty('qto');
    expect(payload).not.toHaveProperty('layer');
  });

  it('NEVER includes immutable fields companyId/projectId/floorplanId/createdBy/createdAt', async () => {
    const svc = createStairFirestoreService(CONFIG);
    await svc.updateStair('stair_x', {
      params: MINIMAL_PARAMS,
      validation: MINIMAL_VALIDATION,
    });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('companyId');
    expect(payload).not.toHaveProperty('projectId');
    expect(payload).not.toHaveProperty('floorplanId');
    expect(payload).not.toHaveProperty('createdBy');
    expect(payload).not.toHaveProperty('createdAt');
  });
});

// ===========================================================================
// deleteStair
// ===========================================================================

describe('StairFirestoreService.deleteStair', () => {
  it('calls deleteDoc with correct ref', async () => {
    const svc = createStairFirestoreService(CONFIG);
    await svc.deleteStair('stair_x');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc.mock.calls[0][0].id).toBe('stair_x');
  });
});

// ===========================================================================
// Soft-lock G24
// ===========================================================================

describe('StairFirestoreService.acquireLock', () => {
  it('stamps editingBy with userId + serverTimestamp', async () => {
    const svc = createStairFirestoreService(CONFIG);
    await svc.acquireLock('stair_x');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.editingBy).toEqual({
      userId: 'u1',
      since: '__server_timestamp__',
    });
    expect(payload.updatedBy).toBe('u1');
    expect(payload.updatedAt).toBe('__server_timestamp__');
  });
});

describe('StairFirestoreService.releaseLock', () => {
  it('clears editingBy via deleteField sentinel', async () => {
    const svc = createStairFirestoreService(CONFIG);
    await svc.releaseLock('stair_x');
    expect(mockDeleteField).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.editingBy).toBe('__delete_field__');
    expect(payload.updatedBy).toBe('u1');
    expect(payload.updatedAt).toBe('__server_timestamp__');
  });
});

// ===========================================================================
// subscribeStairs
// ===========================================================================

describe('StairFirestoreService.subscribeStairs', () => {
  it('routes through firestoreQueryService.subscribe with FLOORPLAN_STAIRS key', () => {
    const svc = createStairFirestoreService(CONFIG);
    const onChange = jest.fn();
    const onError = jest.fn();
    svc.subscribeStairs(onChange, onError);

    expect(subscribeCalls).toHaveLength(1);
    expect(subscribeCalls[0].key).toBe('FLOORPLAN_STAIRS');
  });

  it('passes projectId + floorplanId constraints', () => {
    const svc = createStairFirestoreService(CONFIG);
    svc.subscribeStairs(jest.fn(), jest.fn());

    const constraints = subscribeCalls[0].options?.constraints;
    expect(constraints).toBeDefined();
    expect(constraints).toHaveLength(2);
    const projectConstraint = constraints!.find(
      (c) => (c as { field: string }).field === 'projectId',
    );
    const floorplanConstraint = constraints!.find(
      (c) => (c as { field: string }).field === 'floorplanId',
    );
    expect(projectConstraint).toEqual(
      expect.objectContaining({ field: 'projectId', value: 'p1' }),
    );
    expect(floorplanConstraint).toEqual(
      expect.objectContaining({ field: 'floorplanId', value: 'fp1' }),
    );
  });

  it('delivers documents array to onChange', () => {
    const svc = createStairFirestoreService(CONFIG);
    const onChange = jest.fn();
    svc.subscribeStairs(onChange, jest.fn());

    const fakeDocs = [{ id: 'stair_a' }, { id: 'stair_b' }] as unknown as StairDoc[];
    subscribeCalls[0].onData({ documents: fakeDocs });

    expect(onChange).toHaveBeenCalledWith(fakeDocs);
  });

  it('returns the unsubscribe handle from firestoreQueryService', () => {
    const svc = createStairFirestoreService(CONFIG);
    const unsubscribe = svc.subscribeStairs(jest.fn(), jest.fn());
    expect(unsubscribe).toBe(mockUnsubscribe);
  });
});

// ===========================================================================
// entityToSaveInput
// ===========================================================================

describe('entityToSaveInput', () => {
  it('extracts persistable fields from StairEntity', () => {
    const entity = {
      id: 'stair_x',
      kind: 'straight',
      params: MINIMAL_PARAMS,
      validation: MINIMAL_VALIDATION,
    } as unknown as StairEntity;

    const input = entityToSaveInput(entity);
    expect(input.id).toBe('stair_x');
    expect(input.kind).toBe('straight');
    expect(input.params).toBe(MINIMAL_PARAMS);
    expect(input.validation).toBe(MINIMAL_VALIDATION);
  });
});
