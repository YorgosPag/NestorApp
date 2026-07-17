/**
 * ADR-673 — frozen-baseline guard for the opening BOQ auto-sync.
 *
 * Once a signature-group BOQ row leaves draft/submitted (approved/certified/locked)
 * it is a contractual snapshot. The BIM auto-sync must NEVER delete or overwrite it —
 * mirrors the Firestore `boq_items` delete rule + 5D-BIM cost practice (certified
 * quantity immutable; model drift = variance for human review, not auto-mutation).
 * Before ADR-673 the delete-when-empty path attempted a `deleteDoc` on such rows →
 * "Missing or insufficient permissions" console error.
 *
 * Mirrors the stair-boq-sync Firestore-mock pattern.
 */

import { deleteOpeningFromGroup } from '../opening-boq-sync';
import { isBoqAutoManagedStatus } from '@/types/boq/units';
import type { OpeningParams } from '../../types/opening-types';

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  getDoc: (...a: unknown[]) => mockGetDoc(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  deleteDoc: (...a: unknown[]) => mockDeleteDoc(...a),
  doc: (_: unknown, __: unknown, id: unknown) => ({ id }),
  collection: (_: unknown, name: unknown) => ({ name }),
  query: (...a: unknown[]) => ({ a }),
  where: (...a: unknown[]) => ({ a }),
}));

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { BOQ_ITEMS: 'boq_items', FLOORPLAN_OPENINGS: 'floorplan_openings' },
}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn() }) }));

const context = { companyId: 'c1', projectId: 'p1', buildingId: 'b1', floorplanId: 'file' };

function makeParams(): OpeningParams {
  return {
    kind: 'double-door',
    wallId: 'wall-1',
    offsetFromStart: 0,
    width: 4000,
    height: 2200,
    sillHeight: 0,
  } as unknown as OpeningParams;
}

/** getDocs → empty group (no members) → triggers the delete-when-empty branch. */
function mockEmptyGroup(): void {
  mockGetDocs.mockResolvedValue({ forEach: () => {} });
}

function mockExistingRow(status: string | undefined, extra: Record<string, unknown> = {}): void {
  mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ status, companyId: 'c1', ...extra }) });
}

beforeEach(() => {
  mockGetDoc.mockReset();
  mockGetDocs.mockReset();
  mockSetDoc.mockReset();
  mockDeleteDoc.mockReset();
});

describe('ADR-673 — isBoqAutoManagedStatus', () => {
  it('true only for draft/submitted', () => {
    expect(isBoqAutoManagedStatus('draft')).toBe(true);
    expect(isBoqAutoManagedStatus('submitted')).toBe(true);
  });
  it('false for frozen baselines + unknown', () => {
    for (const s of ['approved', 'certified', 'locked', undefined, null, 'x']) {
      expect(isBoqAutoManagedStatus(s)).toBe(false);
    }
  });
});

describe('ADR-673/675 — opening BOQ sync frozen-baseline guard + drift surfacing', () => {
  it('records model drift (never deletes/overwrites) on a certified baseline emptied by the model', async () => {
    mockEmptyGroup();
    mockExistingRow('certified', { estimatedQuantity: 10, liveQuantity: null });
    await deleteOpeningFromGroup(makeParams(), context);
    // Baseline immutable: never deleted, never fully overwritten.
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    // ADR-675: the drift is recorded as SEPARATE metadata via a merge write
    // (live=0 vs signed baseline 10) — estimatedQuantity is left untouched.
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, payload, options] = mockSetDoc.mock.calls[0] as [unknown, Record<string, unknown>, unknown];
    expect(options).toEqual({ merge: true });
    expect(payload).toMatchObject({ liveQuantity: 0 });
    expect(payload).not.toHaveProperty('estimatedQuantity');
  });

  it('records drift but never deletes an empty group whose row is approved or locked', async () => {
    for (const status of ['approved', 'locked']) {
      mockSetDoc.mockClear();
      mockDeleteDoc.mockClear();
      mockEmptyGroup();
      mockExistingRow(status, { estimatedQuantity: 5 });
      await deleteOpeningFromGroup(makeParams(), context);
      expect(mockDeleteDoc).not.toHaveBeenCalled();
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ liveQuantity: 0 }),
        { merge: true },
      );
    }
  });

  it('DOES delete an empty group whose row is still draft (auto-managed lifecycle)', async () => {
    mockEmptyGroup();
    mockExistingRow('draft');
    await deleteOpeningFromGroup(makeParams(), context);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});
