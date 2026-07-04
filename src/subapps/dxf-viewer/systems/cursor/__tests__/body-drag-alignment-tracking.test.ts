/**
 * Tests — applyBodyDragAlignmentTracking (ADR-560).
 *
 * The body-drag reuses the SAME AutoAlign SSoT as the grip drag: it resolves the
 * single grabbed base point via `resolveActionAlignmentTracking`, publishes the
 * result to `GripAlignmentTrackingStore`, and overrides the effective world point.
 * These tests pin the wiring (anchor → resolver → store → override), mocking only
 * the resolver so no CAD-toggle / ambient config setup is needed.
 */
import { applyBodyDragAlignmentTracking } from '../grip-drag-alignment-tracking';
import { EntityBodyDragStore } from '../../drag/EntityBodyDragStore';
import { getGripAlignmentTracking } from '../GripAlignmentTrackingStore';
import { resolveActionAlignmentTracking } from '../../../hooks/dimensions/dim-alignment-tracking';

jest.mock('../../../hooks/dimensions/dim-alignment-tracking', () => ({
  resolveActionAlignmentTracking: jest.fn(),
}));

const mockResolve = resolveActionAlignmentTracking as jest.MockedFunction<
  typeof resolveActionAlignmentTracking
>;

// Minimal ComposedTracking-shaped stub — only `.point` is read by the adapter.
const trackingWith = (point: { x: number; y: number }) =>
  ({ point } as unknown as ReturnType<typeof resolveActionAlignmentTracking>);

describe('applyBodyDragAlignmentTracking (ADR-560)', () => {
  afterEach(() => {
    EntityBodyDragStore.clear();
    mockResolve.mockReset();
  });

  it('no active body-drag (anchor null) → returns raw, clears store, does not resolve', () => {
    const raw = { x: 5, y: 7 };
    const out = applyBodyDragAlignmentTracking(raw, null, 1);
    expect(out).toBe(raw);
    expect(getGripAlignmentTracking()).toBeNull();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('snapped → resolves with the grabbed base point as the sole ref anchor, overrides + publishes', () => {
    EntityBodyDragStore.arm({ anchor: { x: 10, y: 20 }, entityIds: ['line-1'], copy: false });
    const snapped = trackingWith({ x: 12, y: 20 });
    mockResolve.mockReturnValue(snapped);

    const out = applyBodyDragAlignmentTracking({ x: 12.3, y: 19.8 }, null, 2);

    // refPoints === [anchor] (base-point tracking, parity with the line grip MOVE).
    expect(mockResolve).toHaveBeenCalledWith(
      { x: 12.3, y: 19.8 }, [{ x: 10, y: 20 }], 2, null,
    );
    // Overrides the effective world to the aligned point (→ ghost delta) …
    expect(out).toEqual({ x: 12, y: 20 });
    // … and publishes the SAME result for the ghost paint.
    expect(getGripAlignmentTracking()).toBe(snapped);
  });

  it('no snap (resolver null) → keeps the raw point and publishes null', () => {
    EntityBodyDragStore.arm({ anchor: { x: 0, y: 0 }, entityIds: ['x'], copy: false });
    mockResolve.mockReturnValue(null);

    const raw = { x: 3, y: 4 };
    const out = applyBodyDragAlignmentTracking(raw, null, 1);

    expect(out).toBe(raw);
    expect(getGripAlignmentTracking()).toBeNull();
  });
});
