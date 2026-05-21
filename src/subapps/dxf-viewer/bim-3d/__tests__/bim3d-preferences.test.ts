/**
 * ADR-366 Phase 4.3 — Bim3DPreferencesService + generateBim3DPrefId unit tests.
 */

import { generateBim3DPrefId } from '@/services/enterprise-id.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _col, id) => ({ id })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
}));

jest.mock('@/lib/firebase', () => ({ db: {} }));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { BIM_3D_PREFERENCES: 'bim_3d_preferences' },
}));

// Import after mocks are set up
// eslint-disable-next-line import/first
import { Bim3DPreferencesService } from '../services/Bim3DPreferencesService';
import { getDoc, setDoc } from 'firebase/firestore';

const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;

// ── Generator tests ───────────────────────────────────────────────────────────

describe('generateBim3DPrefId', () => {
  it('returns b3dpref_<userId> format', () => {
    expect(generateBim3DPrefId('user123')).toBe('b3dpref_user123');
  });

  it('throws when userId is empty', () => {
    expect(() => generateBim3DPrefId('')).toThrow('generateBim3DPrefId: userId is required');
  });
});

// ── Bim3DPreferencesService tests ─────────────────────────────────────────────

describe('Bim3DPreferencesService.load', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns null when doc does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never);
    const result = await Bim3DPreferencesService.load('user1');
    expect(result).toBeNull();
  });

  it('returns prefs data when doc exists', async () => {
    const prefs = { userId: 'user1', compassRingVisible: false, updatedAt: null };
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => prefs,
    } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never);
    const result = await Bim3DPreferencesService.load('user1');
    expect(result?.compassRingVisible).toBe(false);
  });
});

describe('Bim3DPreferencesService.save', () => {
  afterEach(() => jest.clearAllMocks());

  it('calls setDoc with merge and correct fields', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    await Bim3DPreferencesService.save('user1', { compassRingVisible: false });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, data, opts] = mockSetDoc.mock.calls[0]!;
    expect((data as Record<string, unknown>).compassRingVisible).toBe(false);
    expect((data as Record<string, unknown>).userId).toBe('user1');
    expect(opts).toEqual({ merge: true });
  });

  it('uses deterministic doc ID via generateBim3DPrefId', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    await Bim3DPreferencesService.save('user2', { compassRingVisible: true });
    const [ref] = mockSetDoc.mock.calls[0]!;
    expect((ref as { id: string }).id).toBe('b3dpref_user2');
  });
});
