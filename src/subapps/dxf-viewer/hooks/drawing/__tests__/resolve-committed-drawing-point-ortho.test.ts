/**
 * ADR-363 §ortho-wins — ORTHO (F8) must be a HARD override in the generic commit
 * resolver: object-snap / AutoAlign tracking may NOT drag the committed point off the
 * H/V axis. Regression guard for «η σχεδίαση πλάκας δεν σέβεται το ΟΡΘΟ» (2026-07-22):
 * with AutoAlign ON an ambient trace overrode the ortho lock → diagonal edge. Here we
 * pin that `resolveCommittedDrawingPoint` skips tracking under ORTHO and still applies
 * it when ORTHO is off. The preview path mirrors the SAME gate (`drawing-hover-handler`).
 */

import { resolveCommittedDrawingPoint } from '../drawing-handler-utils';
import { resolveAlignmentTracking } from '../../../systems/tracking/resolve-alignment-tracking';
import { ambientAlignmentConfigStore } from '../../../systems/tracking/ambient-alignment-config-store';

jest.mock('../../../systems/tracking/resolve-alignment-tracking', () => ({
  resolveAlignmentTracking: jest.fn(),
}));
jest.mock('../../../systems/tracking/ambient-alignment-config-store', () => ({
  ambientAlignmentConfigStore: { getSnapshot: jest.fn() },
}));

const mockTracking = resolveAlignmentTracking as jest.MockedFunction<typeof resolveAlignmentTracking>;
const mockAmbient = ambientAlignmentConfigStore.getSnapshot as jest.MockedFunction<
  typeof ambientAlignmentConfigStore.getSnapshot
>;

// A tracking result that would pull the point OFF the ortho axis (diagonal).
const OFF_AXIS = { x: 999, y: 999 };

beforeEach(() => {
  jest.clearAllMocks();
  mockAmbient.mockReturnValue({ enabled: true });
  // Any non-null tracking result shifts the point when applied.
  mockTracking.mockReturnValue({ point: OFF_AXIS } as unknown as ReturnType<typeof resolveAlignmentTracking>);
});

// ORTHO already locked the snapped point to (137, 0) upstream; slab = non-line-family
// tool so `resolveLineFamilyCommitPoint` is a pass-through → the result IS the tracking
// decision alone.
const ORTHO_LOCKED = { x: 137, y: 0 };

const baseOpts = {
  scale: 1,
  polar: false,
  sceneEntities: [] as never[],
  segmentBase: { x: 0, y: 0 },
  activeTool: 'slab' as const,
  tempPointsLength: 1,
  sceneUnits: 'mm' as const,
};

describe('resolveCommittedDrawingPoint — ORTHO wins over tracking', () => {
  it('ORTHO on → tracking is NOT consulted, ortho-locked point is kept', () => {
    const out = resolveCommittedDrawingPoint(ORTHO_LOCKED, { ...baseOpts, ortho: true });
    expect(mockTracking).not.toHaveBeenCalled();
    expect(out).toEqual(ORTHO_LOCKED);
  });

  it('ORTHO off → tracking IS applied (unchanged behaviour)', () => {
    const out = resolveCommittedDrawingPoint(ORTHO_LOCKED, { ...baseOpts, ortho: false });
    expect(mockTracking).toHaveBeenCalledTimes(1);
    expect(out).toEqual(OFF_AXIS);
  });

  it('ORTHO off → POLAR flag flows straight through (no longer AND-ed with !ortho here)', () => {
    resolveCommittedDrawingPoint(ORTHO_LOCKED, { ...baseOpts, ortho: false, polar: true });
    expect(mockTracking).toHaveBeenCalledWith(
      ORTHO_LOCKED,
      expect.objectContaining({ polarEnabled: true }),
    );
  });
});
