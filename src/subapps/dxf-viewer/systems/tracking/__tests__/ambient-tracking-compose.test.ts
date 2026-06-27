/**
 * ADR-543 (COL traces 3D) — composeTrackingSnap shared SSoT (merge → resolve → quantize).
 * The brain both the 2D `drawing-hover-handler` and the 3D `use-bim3d-wall-placement` reuse.
 */

import { composeTrackingSnap } from '../ambient-tracking-compose';
import type { AcquiredTrackingPoint } from '../TrackingPointStore';
import type { TrackingPolarConfig } from '../tracking-resolver';

const HV_ONLY: TrackingPolarConfig = { incrementAngle: 0, additionalAngles: [], polarEnabled: false };

function pt(x: number, y: number): AcquiredTrackingPoint {
  return { x, y, acquiredAt: 0, sourceSnapType: 'tracking' };
}

describe('composeTrackingSnap', () => {
  it('returns null when there are no anchors', () => {
    expect(composeTrackingSnap({ x: 10, y: 10 }, [], [], { polar: HV_ONLY, worldTolerance: 5, worldPerPixel: 0 }))
      .toBeNull();
  });

  it('returns null when no alignment path is within tolerance', () => {
    // Cursor is 50 off both the H (y=0) and V (x=0) paths from the anchor.
    const r = composeTrackingSnap({ x: 50, y: 50 }, [pt(0, 0)], [], {
      polar: HV_ONLY, worldTolerance: 5, worldPerPixel: 0,
    });
    expect(r).toBeNull();
  });

  it('projects onto the horizontal path (no quantize when worldPerPixel = 0)', () => {
    const r = composeTrackingSnap({ x: 50, y: 1 }, [pt(0, 0)], [], {
      polar: HV_ONLY, worldTolerance: 5, worldPerPixel: 0,
    });
    expect(r).not.toBeNull();
    expect(r!.result.kind).toBe('projection');
    expect(r!.result.activePaths).toHaveLength(1);
    expect(r!.point.x).toBeCloseTo(50);
    expect(r!.point.y).toBeCloseTo(0);
  });

  it('quantizes the projection slide to the adaptive step', () => {
    // worldPerPixel = 2 → step = niceRound(2 * 25) = niceRound(50) = 50. t=53 → 50.
    const r = composeTrackingSnap({ x: 53, y: 1 }, [pt(0, 0)], [], {
      polar: HV_ONLY, worldTolerance: 5, worldPerPixel: 2,
    });
    expect(r).not.toBeNull();
    expect(r!.point.x).toBeCloseTo(50);
    expect(r!.point.y).toBeCloseTo(0);
  });

  it('resolves an intersection (2 active paths, never quantized)', () => {
    // H from (0,0): y=0 ; V from (100,100): x=100 → intersection (100,0).
    const r = composeTrackingSnap({ x: 101, y: 1 }, [pt(0, 0), pt(100, 100)], [], {
      polar: HV_ONLY, worldTolerance: 5, worldPerPixel: 2,
    });
    expect(r).not.toBeNull();
    expect(r!.result.kind).toBe('intersection');
    expect(r!.result.activePaths).toHaveLength(2);
    expect(r!.point.x).toBeCloseTo(100);
    expect(r!.point.y).toBeCloseTo(0);
  });

  it('feeds ambient anchors through the SAME resolver (Revit auto-tracking)', () => {
    // No acquired points — only an ambient anchor → still resolves a projection.
    const r = composeTrackingSnap({ x: 50, y: 1 }, [], [pt(0, 0)], {
      polar: HV_ONLY, worldTolerance: 5, worldPerPixel: 0,
    });
    expect(r).not.toBeNull();
    expect(r!.result.kind).toBe('projection');
    expect(r!.point.x).toBeCloseTo(50);
    expect(r!.point.y).toBeCloseTo(0);
  });
});
