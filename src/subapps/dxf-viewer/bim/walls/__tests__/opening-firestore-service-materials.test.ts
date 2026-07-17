/**
 * ADR-669 follow-up — per-opening `params.materials` (OpeningMaterials)
 * persistence round-trip. Mirrors `foundation-firestore-service.test.ts`
 * mocking pattern (Firestore SDK mocked, in-memory store).
 *
 * Proves the SAME thing the sibling optional fields (`material`,
 * `frameProfileId`, `frameProfileOverrides`) already get for free:
 * `OpeningFirestoreService.saveOpening` persists the ENTIRE `params` object
 * verbatim (no field-level allowlist that could drop `materials`), and
 * `openingDocToEntity` hydrates it back unchanged for a self-hosted
 * (ADR-615) opening — zero data loss serialize → Firestore → deserialize.
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
  deleteField: jest.fn(() => '__delete_field__'),
  serverTimestamp: jest.fn(() => '__server_timestamp__'),
  where: jest.fn((field: string, op: string, value: unknown) => ({ __where: true, field, op, value })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  // `validateOpeningParams` (via `nowTimestamp()`) calls `Timestamp.fromDate()`.
  Timestamp: { fromDate: jest.fn(() => '__timestamp__') },
}));

jest.mock('@/lib/firebase', () => ({ db: { __mockDb: true } }));

jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    subscribe: jest.fn(() => jest.fn()),
  },
}));

let mockIdCounter = 0;
jest.mock('@/services/enterprise-id-convenience', () => ({
  generateOpeningId: () => {
    mockIdCounter += 1;
    return `opn_test${String(mockIdCounter).padStart(20, '0')}`;
  },
}));

// SUT import AFTER mocks
import {
  OpeningFirestoreService,
  createOpeningFirestoreService,
  entityToSaveInput,
  type OpeningDoc,
} from '../opening-firestore-service';
import { openingDocToEntity } from '../opening-doc-hydration';
import type { OpeningEntity, OpeningParams } from '../../types/opening-types';
import type { BimValidation } from '../../types/bim-base';

// ADR-615 self-hosted params — no `wallId`, avoids needing a WallEntity fixture.
const SELF_HOSTED_PARAMS: OpeningParams = {
  kind: 'door',
  selfHost: { anchor: { x: 0, y: 0, z: 0 }, rotationRad: 0, hostThicknessMm: 200 },
  offsetFromStart: 0,
  width: 900,
  height: 2100,
  sillHeight: 0,
  // ADR-669 — new per-instance material assignment (frame/leaf/glass/hardware).
  materials: { frame: 'mat-metal', leaf: 'bmat_oak' },
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
  mockSetDoc.mockClear();
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockAddDoc.mockClear();
});

describe('OpeningFirestoreService.saveOpening — params.materials (ADR-669)', () => {
  it('persists params.materials verbatim inside the whole-params write (no field allowlist drop)', async () => {
    const svc = createOpeningFirestoreService(CONFIG);
    const saved = await svc.saveOpening({
      kind: 'door',
      params: SELF_HOSTED_PARAMS,
      validation: VALIDATION,
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const payload = mockSetDoc.mock.calls[0][1] as { params: OpeningParams };
    expect(payload.params.materials).toEqual({ frame: 'mat-metal', leaf: 'bmat_oak' });
    expect(saved.params.materials).toEqual({ frame: 'mat-metal', leaf: 'bmat_oak' });
  });

  it('round-trips through the FULL persistence cycle: save → OpeningDoc → openingDocToEntity hydrate', async () => {
    const svc = createOpeningFirestoreService(CONFIG);
    await svc.saveOpening({
      id: 'opn_materials_1',
      kind: 'door',
      params: SELF_HOSTED_PARAMS,
      validation: VALIDATION,
    });

    // Simulate the Firestore snapshot handing the stored doc back to the hydrator.
    const stored = store.get('opn_materials_1')!.data as unknown as OpeningDoc;
    const entity = openingDocToEntity(stored, /* hostWall */ null, 'mm');

    expect(entity).not.toBeNull();
    expect((entity as OpeningEntity).params.materials).toEqual({
      frame: 'mat-metal',
      leaf: 'bmat_oak',
    });
  });

  it('entityToSaveInput carries params (incl. materials) through unchanged before the write', () => {
    const entity = {
      id: 'opn_9',
      type: 'opening',
      kind: 'door',
      layerId: '0',
      params: SELF_HOSTED_PARAMS,
      validation: VALIDATION,
    } as unknown as OpeningEntity;

    const input = entityToSaveInput(entity);
    expect(input.params.materials).toEqual({ frame: 'mat-metal', leaf: 'bmat_oak' });
  });

  it('omits materials cleanly when absent — no literal `undefined` reaches Firestore (N.6/undefined-safety)', async () => {
    const svc = createOpeningFirestoreService(CONFIG);
    const { materials: _drop, ...paramsWithoutMaterials } = SELF_HOSTED_PARAMS;
    void _drop;
    await svc.saveOpening({
      kind: 'door',
      params: paramsWithoutMaterials as OpeningParams,
      validation: VALIDATION,
    });
    const payload = mockSetDoc.mock.calls[0][1] as { params: OpeningParams };
    expect(payload.params.materials).toBeUndefined();
    expect(JSON.stringify(payload.params)).not.toContain('materials');
  });
});

describe('OpeningFirestoreService — factory sanity (never addDoc, N.6)', () => {
  it('uses setDoc + enterprise opn_ id, never addDoc', async () => {
    expect(OpeningFirestoreService).toBeDefined();
    const svc = createOpeningFirestoreService(CONFIG);
    const d = await svc.saveOpening({ kind: 'door', params: SELF_HOSTED_PARAMS, validation: VALIDATION });
    expect(d.id).toMatch(/^opn_test\d{20}$/);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});
