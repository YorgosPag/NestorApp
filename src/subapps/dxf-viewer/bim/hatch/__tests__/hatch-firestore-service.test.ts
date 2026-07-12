/**
 * ADR-507 S2-persist — HatchFirestoreService unit tests.
 * Mirror του foundation-firestore-service.test.ts (Firestore SDK + firestoreQueryService mocked).
 *
 * Covers: enterprise-id gen (N.6, never addDoc), setDoc payload shape, audit +
 * scope stamping (ADR-420 floorId), `data` sub-key projection, undefined-strip,
 * subscribe constraints, converter round-trip, area over a doc-derived entity.
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
  doc: jest.fn((_db: unknown, ..._segments: string[]) => ({ id: _segments[_segments.length - 1] })),
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
  generateHatchId: () => {
    mockIdCounter += 1;
    return `hatch_test${String(mockIdCounter).padStart(18, '0')}`;
  },
}));

// SUT import AFTER mocks
import {
  HatchFirestoreService,
  createHatchFirestoreService,
  hatchEntityToSaveInput,
  hatchDocToEntity,
  pickHatchData,
  type HatchDoc,
  type HatchDocData,
} from '../hatch-firestore-service';
import { computeHatchAreaMm2 } from '../hatch-completion';
import type { Point2D } from '../../../rendering/types/Types';
import type { HatchEntity } from '../../../types/entities';

const SQUARE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];

const HATCH: HatchEntity = {
  id: 'hatch_existing',
  type: 'hatch',
  layerId: 'lyr_1',
  boundaryPaths: [SQUARE],
  fillType: 'solid',
  patternType: 'solid',
  fillColor: '#808080',
  islandStyle: 'normal',
  drawOrder: 0,
  visible: true,
};

const CONFIG = { companyId: 'c1', projectId: 'p1', floorplanId: 'fp1', userId: 'u1' };
const CONFIG_FLOOR = { ...CONFIG, floorId: 'flr_9' };

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

describe('createHatchFirestoreService — factory', () => {
  it('returns instance', () => {
    expect(createHatchFirestoreService(CONFIG)).toBeInstanceOf(HatchFirestoreService);
  });
});

describe('HatchFirestoreService.saveHatch', () => {
  it('generates enterprise hatch_ ID when not provided (N.6) — never addDoc', async () => {
    const svc = createHatchFirestoreService(CONFIG);
    const d = await svc.saveHatch({ data: pickHatchData(HATCH) });
    expect(d.id).toMatch(/^hatch_test\d{18}$/);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('preserves id when provided (id-preserving overwrite)', async () => {
    const svc = createHatchFirestoreService(CONFIG);
    const d = await svc.saveHatch({ id: 'hatch_keep', data: pickHatchData(HATCH) });
    expect(d.id).toBe('hatch_keep');
  });

  it('stamps scope + audit fields', async () => {
    const svc = createHatchFirestoreService(CONFIG);
    await svc.saveHatch({ data: pickHatchData(HATCH) });
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.companyId).toBe('c1');
    expect(payload.projectId).toBe('p1');
    expect(payload.floorplanId).toBe('fp1');
    expect(payload.createdBy).toBe('u1');
    expect(payload.updatedBy).toBe('u1');
    expect(payload.createdAt).toBe('__server_timestamp__');
  });

  it('writes the payload under the `data` sub-key with boundaryPaths', async () => {
    const svc = createHatchFirestoreService(CONFIG);
    await svc.saveHatch(hatchEntityToSaveInput(HATCH));
    const payload = mockSetDoc.mock.calls[0][1] as { data: HatchDocData; layerId?: string };
    // ⚠️ Firestore forbids nested arrays → rings are wrapped in { vertices } maps.
    expect(payload.data.boundaryPaths).toEqual([{ vertices: SQUARE }]);
    expect(payload.data.fillColor).toBe('#808080');
    expect(payload.layerId).toBe('lyr_1');
    // Top-level must NOT carry the hatch payload fields (only scope/audit/data/layerId).
    expect(payload).not.toHaveProperty('boundaryPaths');
    expect(payload).not.toHaveProperty('params');
  });

  it('stamps floorId scope when bound (ADR-420)', async () => {
    const svc = createHatchFirestoreService(CONFIG_FLOOR);
    await svc.saveHatch({ data: pickHatchData(HATCH) });
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.floorId).toBe('flr_9');
    expect(payload.floorplanId).toBe('fp1');
  });

  it('omits floorId when absent (Firestore rejects undefined)', async () => {
    const svc = createHatchFirestoreService(CONFIG);
    await svc.saveHatch({ data: pickHatchData(HATCH) });
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('floorId');
  });
});

describe('HatchFirestoreService.update/delete', () => {
  it('updateHatch writes data + audit, never createdAt', async () => {
    const svc = createHatchFirestoreService(CONFIG);
    await svc.updateHatch('hatch_x', { data: pickHatchData(HATCH) });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.updatedBy).toBe('u1');
    expect(payload.updatedAt).toBe('__server_timestamp__');
    expect(payload).not.toHaveProperty('createdAt');
    expect((payload.data as HatchDocData).boundaryPaths).toEqual([{ vertices: SQUARE }]);
  });

  it('deleteHatch calls deleteDoc', async () => {
    const svc = createHatchFirestoreService(CONFIG);
    await svc.deleteHatch('hatch_x');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('HatchFirestoreService.subscribeHatches', () => {
  it('subscribes to FLOORPLAN_HATCHES with scope constraints (floorId preferred)', () => {
    const svc = createHatchFirestoreService(CONFIG_FLOOR);
    svc.subscribeHatches(() => {}, () => {});
    expect(subscribeCalls).toHaveLength(1);
    expect(subscribeCalls[0].key).toBe('FLOORPLAN_HATCHES');
    const constraints = subscribeCalls[0].options?.constraints ?? [];
    expect(constraints).toContainEqual(expect.objectContaining({ field: 'projectId', value: 'p1' }));
    expect(constraints).toContainEqual(expect.objectContaining({ field: 'floorId', value: 'flr_9' }));
  });
});

describe('pickHatchData', () => {
  it('drops undefined keys (Firestore rejects undefined)', () => {
    const data = pickHatchData({ ...HATCH, lineAngle: undefined, doubleCrossHatch: undefined });
    expect(data).not.toHaveProperty('lineAngle');
    expect(data).not.toHaveProperty('doubleCrossHatch');
    expect(data.boundaryPaths).toEqual([{ vertices: SQUARE }]);
  });

  it('serialises rings as { vertices } maps (Firestore nested-array guard) and round-trips', () => {
    const data = pickHatchData(HATCH);
    // No element of boundaryPaths is itself an array (would be rejected by Firestore).
    expect(Array.isArray(data.boundaryPaths[0])).toBe(false);
    expect(data.boundaryPaths[0]).toEqual({ vertices: SQUARE });
  });
});

describe('converters — entity ↔ doc round-trip', () => {
  const docOf = (): HatchDoc => ({
    id: 'hatch_existing',
    companyId: 'c1',
    projectId: 'p1',
    floorplanId: 'fp1',
    data: pickHatchData(HATCH),
    layerId: 'lyr_1',
    createdAt: '__ts__' as unknown as HatchDoc['createdAt'],
    createdBy: 'u1',
    updatedAt: '__ts__' as unknown as HatchDoc['updatedAt'],
    updatedBy: 'u1',
  });

  it('hatchDocToEntity rebuilds a type:hatch entity preserving boundaryPaths + fill', () => {
    const e = hatchDocToEntity(docOf());
    expect(e.type).toBe('hatch');
    expect(e.id).toBe('hatch_existing');
    expect(e.boundaryPaths).toEqual([SQUARE]);
    expect(e.fillColor).toBe('#808080');
    expect(e.layerId).toBe('lyr_1');
    expect(e.visible).toBe(true);
  });

  it('round-trip entity → saveInput.data → doc → entity preserves payload', () => {
    const saveInput = hatchEntityToSaveInput(HATCH);
    const rebuilt = hatchDocToEntity({ ...docOf(), data: saveInput.data });
    expect(rebuilt.boundaryPaths).toEqual(HATCH.boundaryPaths);
    expect(rebuilt.fillType).toBe(HATCH.fillType);
    expect(rebuilt.islandStyle).toBe(HATCH.islandStyle);
  });

  it('area of a doc-derived entity matches the source geometry (1000×1000 mm²)', () => {
    const e = hatchDocToEntity(docOf());
    expect(computeHatchAreaMm2(e)).toBe(1_000_000);
  });

  it('round-trips the gradient object (ADR-507 Φ5 — flat map, survives refresh)', () => {
    const gradHatch = {
      ...HATCH,
      fillType: 'gradient' as const,
      patternType: 'gradient' as const,
      gradient: { type: 'spherical' as const, color1: '#2980b9', color2: '#c0392b', angleDeg: 45 },
    };
    const data = pickHatchData(gradHatch);
    expect(data.gradient).toEqual(gradHatch.gradient);
    const rebuilt = hatchDocToEntity({ ...docOf(), data });
    expect(rebuilt.fillType).toBe('gradient');
    expect(rebuilt.gradient).toEqual(gradHatch.gradient);
  });

  it('round-trips the imageFill object (ADR-643 Φ6 — flat map, survives refresh)', () => {
    const imageHatch: HatchEntity = {
      ...HATCH,
      fillType: 'image',
      imageFill: {
        assetId: 'bmat_test000000000000000001',
        tileWidth: 600,
        tileHeight: 600,
        angle: 30,
        grout: { color: '#ffffff', widthMm: 5 },
      },
    };
    const data = pickHatchData(imageHatch);
    // Persisted verbatim (assetId reference + tile params + grout) — no inline pixels.
    expect(data.fillType).toBe('image');
    expect(data.imageFill).toEqual(imageHatch.imageFill);
    const rebuilt = hatchDocToEntity({ ...docOf(), data });
    expect(rebuilt.fillType).toBe('image');
    expect(rebuilt.imageFill).toEqual(imageHatch.imageFill);
  });

  it('NEVER persists the export-only dxfImageExport marker (ADR-643 §6 — transient)', () => {
    const withMarker = {
      ...HATCH,
      fillType: 'image' as const,
      imageFill: { assetId: 'bmat_x', tileWidth: 600, tileHeight: 600 },
      // Export-only marker (stamped by the DXF pre-pass) must never leak into Firestore.
      dxfImageExport: {
        filename: 'images/x.jpg', pixelWidth: 512, pixelHeight: 512,
        tileWorldWidth: 600, tileWorldHeight: 600, angleDeg: 0, inserts: [{ x: 0, y: 0 }],
      },
    };
    const data = pickHatchData(withMarker as unknown as HatchEntity);
    expect(data).not.toHaveProperty('dxfImageExport');
    // imageFill still survives (only the transient marker is dropped).
    expect(data.imageFill).toEqual(withMarker.imageFill);
  });
});
