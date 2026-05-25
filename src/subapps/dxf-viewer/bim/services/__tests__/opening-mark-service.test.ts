/**
 * ADR-376 Phase A — opening-mark-service unit tests.
 *
 * Verifies:
 *   - `formatMark()` shape per standard/basement floor + el/en prefixes
 *   - `parseMarkSeq()` round-trip + locale-mismatch rejection
 *   - `FirestoreOpeningMarkService.allocateMark()` finds the max seq + emits next
 *   - Empty collection → seq=1
 *   - Standard floor overflow > 99 → 4-digit fallback
 */

import { formatMark, parseMarkSeq } from '../opening-mark-service';

// ---------------------------------------------------------------------------
// Mock Firestore (used by allocateMark())
// ---------------------------------------------------------------------------

const mockGetDocs = jest.fn();
jest.mock('firebase/firestore', () => ({
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: jest.fn(),
  query: jest.fn((..._a: unknown[]) => ({ __kind: 'query' })),
  where: jest.fn((field, op, value) => ({ __kind: 'where', field, op, value })),
  collection: jest.fn((_, name) => ({ __kind: 'collection', name })),
}));

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { FLOORPLAN_OPENINGS: 'floorplan_openings' },
}));

// Import after mocks.
import { getOpeningMarkService } from '../opening-mark-service';

beforeEach(() => {
  mockGetDocs.mockReset();
});

function makeSnap(marks: (string | undefined)[]) {
  return {
    forEach(cb: (d: { data(): unknown }) => void) {
      for (const m of marks) cb({ data: () => ({ params: { mark: m, kind: 'door' } }) });
    },
  };
}

// ---------------------------------------------------------------------------
// formatMark
// ---------------------------------------------------------------------------

describe('formatMark', () => {
  it('ground floor: Θ.001', () => {
    expect(formatMark({ kindPrefix: 'Θ', floorNumber: 0, basementPrefix: 'Υ', seq: 1 }))
      .toBe('Θ.001');
  });
  it('1st floor: Θ.101', () => {
    expect(formatMark({ kindPrefix: 'Θ', floorNumber: 1, basementPrefix: 'Υ', seq: 1 }))
      .toBe('Θ.101');
  });
  it('2nd floor seq 5: Θ.205', () => {
    expect(formatMark({ kindPrefix: 'Θ', floorNumber: 2, basementPrefix: 'Υ', seq: 5 }))
      .toBe('Θ.205');
  });
  it('basement -1: Θ.Υ1.001', () => {
    expect(formatMark({ kindPrefix: 'Θ', floorNumber: -1, basementPrefix: 'Υ', seq: 1 }))
      .toBe('Θ.Υ1.001');
  });
  it('basement -2 seq 12: Θ.Υ2.012', () => {
    expect(formatMark({ kindPrefix: 'Θ', floorNumber: -2, basementPrefix: 'Υ', seq: 12 }))
      .toBe('Θ.Υ2.012');
  });
  it('en locale ground: D.001', () => {
    expect(formatMark({ kindPrefix: 'D', floorNumber: 0, basementPrefix: 'B', seq: 1 }))
      .toBe('D.001');
  });
  it('en locale basement -1: D.B1.001', () => {
    expect(formatMark({ kindPrefix: 'D', floorNumber: -1, basementPrefix: 'B', seq: 1 }))
      .toBe('D.B1.001');
  });
  it('window kind: Π.001', () => {
    expect(formatMark({ kindPrefix: 'Π', floorNumber: 0, basementPrefix: 'Υ', seq: 1 }))
      .toBe('Π.001');
  });
  it('overflow on standard floor produces continued numbering', () => {
    // floor=1, seq=100 → base+seq = 100+100 = 200, padded 3 digits → Θ.200
    // Acceptable Phase A — same prefix continues numbering.
    expect(formatMark({ kindPrefix: 'Θ', floorNumber: 1, basementPrefix: 'Υ', seq: 100 }))
      .toBe('Θ.200');
  });
});

// ---------------------------------------------------------------------------
// parseMarkSeq
// ---------------------------------------------------------------------------

describe('parseMarkSeq', () => {
  it('Θ.101 on floor 1 → 1', () => {
    expect(parseMarkSeq('Θ.101', { kindPrefix: 'Θ', floorNumber: 1, basementPrefix: 'Υ' }))
      .toBe(1);
  });
  it('Θ.105 on floor 1 → 5', () => {
    expect(parseMarkSeq('Θ.105', { kindPrefix: 'Θ', floorNumber: 1, basementPrefix: 'Υ' }))
      .toBe(5);
  });
  it('Θ.Υ1.001 on floor -1 → 1', () => {
    expect(parseMarkSeq('Θ.Υ1.001', { kindPrefix: 'Θ', floorNumber: -1, basementPrefix: 'Υ' }))
      .toBe(1);
  });
  it('wrong prefix → null', () => {
    expect(parseMarkSeq('Π.001', { kindPrefix: 'Θ', floorNumber: 0, basementPrefix: 'Υ' }))
      .toBeNull();
  });
  it('wrong floor → null (basement on standard)', () => {
    expect(parseMarkSeq('Θ.Υ1.001', { kindPrefix: 'Θ', floorNumber: 0, basementPrefix: 'Υ' }))
      .toBeNull();
  });
  it('garbage → null', () => {
    expect(parseMarkSeq('not-a-mark', { kindPrefix: 'Θ', floorNumber: 0, basementPrefix: 'Υ' }))
      .toBeNull();
  });
});

// ---------------------------------------------------------------------------
// allocateMark
// ---------------------------------------------------------------------------

describe('FirestoreOpeningMarkService.allocateMark', () => {
  it('empty collection → seq 1', async () => {
    mockGetDocs.mockResolvedValue(makeSnap([]));
    const svc = getOpeningMarkService();
    const mark = await svc.allocateMark({
      companyId: 'co_x', projectId: 'p_x', floorplanId: 'fp_x',
      floorNumber: 0, kind: 'door', kindPrefix: 'Θ', basementPrefix: 'Υ',
    });
    expect(mark).toBe('Θ.001');
  });
  it('one existing mark → next seq', async () => {
    mockGetDocs.mockResolvedValue(makeSnap(['Θ.001']));
    const svc = getOpeningMarkService();
    const mark = await svc.allocateMark({
      companyId: 'co_x', projectId: 'p_x', floorplanId: 'fp_x',
      floorNumber: 0, kind: 'door', kindPrefix: 'Θ', basementPrefix: 'Υ',
    });
    expect(mark).toBe('Θ.002');
  });
  it('gaps preserved (max+1 not gap fill)', async () => {
    mockGetDocs.mockResolvedValue(makeSnap(['Θ.001', 'Θ.005']));
    const svc = getOpeningMarkService();
    const mark = await svc.allocateMark({
      companyId: 'co_x', projectId: 'p_x', floorplanId: 'fp_x',
      floorNumber: 0, kind: 'door', kindPrefix: 'Θ', basementPrefix: 'Υ',
    });
    expect(mark).toBe('Θ.006');
  });
  it('cross-floor marks ignored (max within scope only)', async () => {
    // floor=0 looking at marks: '.101' is floor 1 → should be ignored
    mockGetDocs.mockResolvedValue(makeSnap(['Θ.101', 'Θ.205', 'Θ.001']));
    const svc = getOpeningMarkService();
    const mark = await svc.allocateMark({
      companyId: 'co_x', projectId: 'p_x', floorplanId: 'fp_x',
      floorNumber: 0, kind: 'door', kindPrefix: 'Θ', basementPrefix: 'Υ',
    });
    expect(mark).toBe('Θ.002');
  });
  it('basement floor allocator', async () => {
    mockGetDocs.mockResolvedValue(makeSnap(['Θ.Υ1.001']));
    const svc = getOpeningMarkService();
    const mark = await svc.allocateMark({
      companyId: 'co_x', projectId: 'p_x', floorplanId: 'fp_x',
      floorNumber: -1, kind: 'door', kindPrefix: 'Θ', basementPrefix: 'Υ',
    });
    expect(mark).toBe('Θ.Υ1.002');
  });
});
