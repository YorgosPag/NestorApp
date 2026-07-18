/**
 * ADR-676 ΒΗΜΑ 2 — OpeningFrameProfileLibraryService swept-section persistence.
 *
 * Closes the write-path gap: the realistic `section` outline must round-trip
 * through `saveProfile` (payload) and `updateProfile` (patch), be validated by the
 * shared `FrameSectionSchema` (≥3 vertices), and stay ABSENT (Firestore-clean)
 * when unset — pre-ADR-676 openings never gain a `section` key.
 *
 * Firestore SDK fully mocked — mirrors `stair-presets-service.test.ts` (the sibling
 * service this one is modelled on), plus `updateDoc`/`getDoc` for the mutate path.
 */

import type {
  FrameSectionPoint,
  OpeningFrameProfile,
} from '../../types/opening-frame-profile';

// ---------------------------------------------------------------------------
// Firestore mock — in-memory store with per-query filter capture
// ---------------------------------------------------------------------------

interface StoreDoc {
  readonly id: string;
  readonly data: Record<string, unknown>;
}
interface MockWhere {
  readonly __type: 'where';
  readonly field: string;
  readonly value: unknown;
}
interface MockQuery {
  readonly __query: true;
  readonly filters: readonly MockWhere[];
}

const store = new Map<string, StoreDoc>();

const mockSetDoc = jest.fn(async (ref: { id: string }, data: Record<string, unknown>) => {
  store.set(ref.id, { id: ref.id, data });
});
const mockUpdateDoc = jest.fn(async (ref: { id: string }, patch: Record<string, unknown>) => {
  const cur = store.get(ref.id);
  store.set(ref.id, { id: ref.id, data: { ...(cur?.data ?? {}), ...patch } });
});
const mockDeleteDoc = jest.fn(async (ref: { id: string }) => {
  store.delete(ref.id);
});
const mockGetDoc = jest.fn(async (ref: { id: string }) => {
  const d = store.get(ref.id);
  return { exists: () => d !== undefined, data: () => d?.data };
});
const mockGetDocs = jest.fn(async (q: MockQuery) => {
  const matches = [...store.values()].filter((e) =>
    q.filters.every(({ field, value }) => e.data[field] === value),
  );
  return { empty: matches.length === 0, docs: matches.map((m) => ({ id: m.id, data: () => m.data })) };
});

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ __collection: true })),
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ id: segments[segments.length - 1] })),
  setDoc: (...args: Parameters<typeof mockSetDoc>) => mockSetDoc(...args),
  updateDoc: (...args: Parameters<typeof mockUpdateDoc>) => mockUpdateDoc(...args),
  deleteDoc: (...args: Parameters<typeof mockDeleteDoc>) => mockDeleteDoc(...args),
  getDoc: (...args: Parameters<typeof mockGetDoc>) => mockGetDoc(...args),
  getDocs: (q: MockQuery) => mockGetDocs(q),
  query: jest.fn((_col: unknown, ...constraints: unknown[]): MockQuery => ({
    __query: true,
    filters: constraints.filter(
      (c): c is MockWhere =>
        typeof c === 'object' && c !== null && (c as { __type?: string }).__type === 'where',
    ),
  })),
  where: jest.fn((field: string, _op: string, value: unknown): MockWhere => ({ __type: 'where', field, value })),
  serverTimestamp: jest.fn(() => '__server_timestamp__'),
}));

jest.mock('@/lib/firebase', () => ({ db: { __mockDb: true } }));

let mockIdCounter = 0;
jest.mock('@/services/enterprise-id.service', () => ({
  generateOpeningFramePresetId: () => {
    mockIdCounter += 1;
    return `frmpst_test${String(mockIdCounter).padStart(18, '0')}`;
  },
}));

// SUT import AFTER mocks
import { createOpeningFrameProfileLibraryService } from '../opening-frame-profile-library-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RECT: readonly FrameSectionPoint[] = [
  { x: -35, y: -35 }, { x: 35, y: -35 }, { x: 35, y: 35 }, { x: -35, y: 35 },
];
const PROFILE: Omit<OpeningFrameProfile, 'id'> = {
  manufacturer: 'MyBrand', series: 'Custom', role: 'frame', faceWidth: 70, depth: 70,
};

function svc(projectId?: string) {
  return createOpeningFrameProfileLibraryService({ companyId: 'c1', userId: 'u1', projectId });
}

beforeEach(() => {
  store.clear();
  mockIdCounter = 0;
  [mockSetDoc, mockUpdateDoc, mockDeleteDoc, mockGetDoc, mockGetDocs].forEach((m) => m.mockClear());
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('OpeningFrameProfileLibraryService — section persistence (ADR-676 ΒΗΜΑ 2)', () => {
  it('saveProfile persists the section outline', async () => {
    const preset = await svc().saveProfile({
      name: 'Rebate', scope: 'user', origin: 'user', profile: { ...PROFILE, section: RECT },
    });
    expect(preset.id).toMatch(/^frmpst_test\d{18}$/);
    expect(store.get(preset.id)!.data.section).toEqual(RECT);
  });

  it('saveProfile WITHOUT a section leaves the key absent (Firestore-clean, zero regression)', async () => {
    const preset = await svc().saveProfile({
      name: 'Plain', scope: 'user', origin: 'user', profile: PROFILE,
    });
    expect('section' in store.get(preset.id)!.data).toBe(false);
  });

  it('saveProfile rejects a degenerate section (<3 vertices) via the shared schema', async () => {
    await expect(
      svc().saveProfile({
        name: 'Bad', scope: 'user', origin: 'user',
        profile: { ...PROFILE, section: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      }),
    ).rejects.toThrow('OPENING_FRAME_PRESET_INVALID_INPUT');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('listProfiles reads the section back (full read round-trip)', async () => {
    store.set('frmpst_seed1', {
      id: 'frmpst_seed1',
      data: { id: 'frmpst_seed1', scope: 'company', companyId: 'c1', ownerId: 'u9', name: 'Seeded', ...PROFILE, section: RECT },
    });
    const list = await svc().listProfiles();
    expect(list.map((p) => p.id)).toEqual(['frmpst_seed1']);
    expect(list[0].section).toEqual(RECT);
  });

  it('updateProfile patches the section onto a mutable doc', async () => {
    store.set('frmpst_up1', {
      id: 'frmpst_up1',
      data: { id: 'frmpst_up1', scope: 'user', companyId: 'c1', ownerId: 'u1', name: 'Editable', builtin: false, ...PROFILE },
    });
    await svc().updateProfile('frmpst_up1', { profile: { section: RECT } });
    expect(store.get('frmpst_up1')!.data.section).toEqual(RECT);
  });
});
