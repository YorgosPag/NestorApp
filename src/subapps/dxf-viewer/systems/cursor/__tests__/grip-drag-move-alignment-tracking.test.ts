/**
 * ADR-557/560 — applyGripDragAlignmentTracking: ANY whole-entity MOVE grip tracks its base point.
 *
 * A text/mtext centre-move (or column-center / group gizmo) hot-grip is neither a plain-line grip
 * nor an Alt-move, so it used to fall through to `null` → the cyan neighbour pull + AutoAlign + Polar
 * traces never fired while a text was dragged (Giorgio browser-verify 2026-07-07). The `movesEntity`
 * flag on the `ActiveDragGripInfo` now routes EVERY mover through the SAME base-point brain
 * (`resolveActionAlignmentTracking([dragAnchor])`) the line MOVE grip + the body-drag already use.
 *
 * The resolver is mocked (no CAD-toggle / ambient setup); these pin the wiring: movesEntity + anchor
 * → base-point resolve → store publish → cursor override, with NO regression to the non-mover path.
 */
import {
  applyGripDragAlignmentTracking,
} from '../grip-drag-alignment-tracking';
import { setActiveDragGrip, clearActiveDragGrip } from '../GripDragStore';
import { getGripAlignmentTracking } from '../GripAlignmentTrackingStore';
import { resolveActionAlignmentTracking } from '../../../hooks/dimensions/dim-alignment-tracking';

jest.mock('../../../hooks/dimensions/dim-alignment-tracking', () => ({
  resolveActionAlignmentTracking: jest.fn(),
}));

const mockResolve = resolveActionAlignmentTracking as jest.MockedFunction<
  typeof resolveActionAlignmentTracking
>;

const trackingWith = (point: { x: number; y: number }) =>
  ({ point } as unknown as ReturnType<typeof resolveActionAlignmentTracking>);

describe('ADR-557 — applyGripDragAlignmentTracking whole-entity MOVE (movesEntity)', () => {
  afterEach(() => {
    clearActiveDragGrip();
    mockResolve.mockReset();
  });

  it('text-move grip (movesEntity, non-line, non-Alt) → base-point track from [dragAnchor]', () => {
    // The record a text centre-move hot-grip publishes after the base point is picked.
    setActiveDragGrip({
      entityId: 'text-1',
      gripKind: 'text-move',
      dragAnchor: { x: 10, y: 20 },
      movesEntity: true,
    });
    const snapped = trackingWith({ x: 12, y: 20 });
    mockResolve.mockReturnValue(snapped);

    const out = applyGripDragAlignmentTracking({ x: 12.4, y: 19.7 }, null, 2);

    // Resolves against the SINGLE grabbed base point (parity with body-drag + line MOVE), and
    // ADR-557 — excludes the dragged text itself from the ambient scan (no self-OTRACK).
    expect(mockResolve).toHaveBeenCalledWith(
      { x: 12.4, y: 19.7 }, [{ x: 10, y: 20 }], 2, null, new Set(['text-1']),
    );
    // Overrides the effective world to the aligned point (→ ghost delta) …
    expect(out).toEqual({ x: 12, y: 20 });
    // … and publishes the SAME result for the trace paint.
    expect(getGripAlignmentTracking()).toBe(snapped);
  });

  it('movesEntity but base point NOT yet picked (no dragAnchor) → no track (waits for 2nd click)', () => {
    setActiveDragGrip({ entityId: 'text-1', gripKind: 'text-move', movesEntity: true });
    const raw = { x: 3, y: 4 };
    const out = applyGripDragAlignmentTracking(raw, null, 1);
    expect(out).toBe(raw);
    expect(getGripAlignmentTracking()).toBeNull();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('non-mover grip on a non-line entity (e.g. text corner resize) → no base-point track', () => {
    setActiveDragGrip({
      entityId: 'text-1',
      gripKind: 'text-corner-ne',
      dragAnchor: { x: 1, y: 1 },
      movesEntity: false,
    });
    const raw = { x: 9, y: 9 };
    const out = applyGripDragAlignmentTracking(raw, null, 1);
    // Resize is not a whole-entity move → falls through the base-point branch, and the non-line
    // entity yields no line anchors → cleared, raw returned (unchanged behaviour).
    expect(out).toBe(raw);
    expect(mockResolve).not.toHaveBeenCalled();
  });
});
