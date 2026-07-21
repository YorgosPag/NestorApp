/**
 * ADR-684 Φ4-C / ADR-539 — round-trip της βαφής εδρών (`faceAppearance`) στο persistence.
 *
 * Το `faceAppearance` ζει στο `BimEntity` envelope (όχι στα params, όχι σε zod), οπότε το συμβόλαιο
 * που πρέπει να ελεγχθεί είναι: (α) τα save/update payloads το γράφουν όταν υπάρχει και το παραλείπουν
 * όταν λείπει (Firestore-safe), (β) οι δύο καθαροί mappers entity↔doc το μεταφέρουν. Αν σπάσει, οι
 * βαμμένες έδρες χάνονται σιωπηλά στο πρώτο reload. Mirror `foundation-firestore-service.test.ts`.
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

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ..._segments: string[]) => ({ id: _segments[_segments.length - 1] })),
  setDoc: (...args: Parameters<typeof mockSetDoc>) => mockSetDoc(...args),
  updateDoc: (...args: Parameters<typeof mockUpdateDoc>) => mockUpdateDoc(...args),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(() => '__server_timestamp__'),
  where: jest.fn((field: string, op: string, value: unknown) => ({ __where: true, field, op, value })),
}));
jest.mock('@/lib/firebase', () => ({ db: { __mockDb: true } }));
jest.mock('@/services/firestore', () => ({
  firestoreQueryService: { subscribe: jest.fn(() => jest.fn()) },
}));
let mockIdCounter = 0;
jest.mock('@/services/enterprise-id-convenience', () => ({
  generateGenericSolidId: () => {
    mockIdCounter += 1;
    return `gsol_test${String(mockIdCounter).padStart(18, '0')}`;
  },
}));

// SUT imports AFTER mocks
import {
  GenericSolidFirestoreService,
  genericSolidEntityToSaveInput,
  type GenericSolidDoc,
} from '../generic-solid-firestore-service';
import { genericSolidDocToEntity } from '../../../../hooks/data/generic-solid-persistence-helpers';
import {
  buildDefaultGenericSolidParams,
  buildGenericSolidEntity,
} from '../../../../hooks/drawing/generic-solid-completion';
import type { GenericSolidEntity } from '../generic-solid-types';
import type { FaceAppearanceMap } from '../../../types/face-appearance-types';

function solid(): GenericSolidEntity {
  const res = buildGenericSolidEntity(buildDefaultGenericSolidParams({ x: 0, y: 0 }), '0');
  if (!res.ok) throw new Error('generic-solid fixture invalid');
  return res.entity;
}

const PAINT: FaceAppearanceMap = {
  top: { colorHex: '#C0392B' },
  'side:1': { materialId: 'bmat_oak' },
};

const service = new GenericSolidFirestoreService({
  companyId: 'co1',
  projectId: 'pr1',
  floorplanId: 'fp1',
  userId: 'user1',
});

beforeEach(() => {
  store.clear();
  mockSetDoc.mockClear();
  mockUpdateDoc.mockClear();
});

describe('generic-solid faceAppearance persistence round-trip', () => {
  it('saveGenericSolid γράφει το faceAppearance στο doc όταν υπάρχει', async () => {
    const saved = await service.saveGenericSolid(
      genericSolidEntityToSaveInput({ ...solid(), faceAppearance: PAINT }),
    );
    expect(store.get(saved.id)?.data['faceAppearance']).toEqual(PAINT);
  });

  it('saveGenericSolid ΔΕΝ γράφει faceAppearance όταν λείπει (Firestore-safe)', async () => {
    const saved = await service.saveGenericSolid(genericSolidEntityToSaveInput(solid()));
    expect('faceAppearance' in (store.get(saved.id)?.data ?? {})).toBe(false);
  });

  it('updateGenericSolid persist-άρει τη βαφή σε υπάρχον doc', async () => {
    await service.updateGenericSolid('gsol_existing', { faceAppearance: PAINT });
    expect(store.get('gsol_existing')?.data['faceAppearance']).toEqual(PAINT);
  });

  it('entity → saveInput μεταφέρει/παραλείπει το faceAppearance', () => {
    expect(genericSolidEntityToSaveInput({ ...solid(), faceAppearance: PAINT }).faceAppearance).toEqual(PAINT);
    expect('faceAppearance' in genericSolidEntityToSaveInput(solid())).toBe(false);
  });

  it('πλήρες round-trip: painted entity → doc → entity διατηρεί τη βαφή', () => {
    const doc = {
      id: 'gsol_rt',
      kind: 'generic',
      params: solid().params,
      validation: solid().validation,
      layerId: '0',
      faceAppearance: PAINT,
    } as GenericSolidDoc;
    expect(genericSolidDocToEntity(doc).faceAppearance).toEqual(PAINT);
  });

  it('doc χωρίς faceAppearance → η οντότητα δεν το φέρει', () => {
    const doc = {
      id: 'gsol_plain',
      kind: 'generic',
      params: solid().params,
      validation: solid().validation,
      layerId: '0',
    } as GenericSolidDoc;
    expect(genericSolidDocToEntity(doc).faceAppearance).toBeUndefined();
  });
});
