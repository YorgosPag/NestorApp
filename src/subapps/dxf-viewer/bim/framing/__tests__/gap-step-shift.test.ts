/**
 * resolveGapStepShift — pure «στρογγύλεμα του παρειά-προς-παρειά διάκενου προς τη μεριά κίνησης»
 * (ADR-363 §neighbor-gap-step, Giorgio 2026-07-02 επιλογή β). Καλύπτει: επιλογή ημιάξονα από moveDir,
 * fallback nearest, σωστό πρόσημο/άξονας shift, ήδη-στρογγυλό → {0,0}, ανενεργό βήμα/κανένας γείτονας.
 */

import { resolveGapStepShift } from '../neighbor-clearance-dims';
import type { SceneSnapTargets } from '../scene-snap-targets';
import type { Point2D } from '../../../rendering/types/Types';

/** Axis-aligned τετράγωνο footprint με κέντρο (cx,cy), μισό-πλάτος h. */
function sq(cx: number, cy: number, h: number): Point2D[] {
  return [
    { x: cx - h, y: cy - h },
    { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h },
    { x: cx - h, y: cy + h },
  ];
}

function makeTargets(over: Partial<SceneSnapTargets>): SceneSnapTargets {
  return {
    footprints: [],
    circularFootprints: [],
    beamTargets: [],
    wallTargets: [],
    slabTargets: [],
    footprintEdgeTargets: [],
    lineTargets: [],
    diskTargets: [],
    rectTargets: [],
    wallEntities: [],
    openings: [],
    ...over,
  };
}

const GHOST = sq(0, 0, 50); // κέντρο (0,0), bounds [-50,50]²
const MAX = 2000;

describe('resolveGapStepShift', () => {
  it('γείτονας δεξιά + κίνηση δεξιά → στρογγυλεύει το E διάκενο (100→90) μετακινώντας +X', () => {
    const targets = makeTargets({ footprints: [sq(200, 0, 50)] }); // E gap = 150 − 50 = 100
    const shift = resolveGapStepShift(GHOST, targets, 30, MAX, { x: 1, y: 0 });
    expect(shift).not.toBeNull();
    // quantize(100,30)=90 → delta=−10, widen(E)=(−1,0) → shift=(+10,0). Νέο gap: 150−(50+10)=90.
    expect(shift!.x).toBeCloseTo(10, 6);
    expect(shift!.y).toBeCloseTo(0, 6);
  });

  it('γείτονες αριστερά+δεξιά, κίνηση ΑΡΙΣΤΕΡΑ → επιλέγει τον W (όχι τον E)', () => {
    const targets = makeTargets({ footprints: [sq(200, 0, 50), sq(-200, 0, 50)] });
    const shift = resolveGapStepShift(GHOST, targets, 30, MAX, { x: -1, y: 0 });
    // W gap = −50 − (−150) = 100 → quantize 90 → delta −10, widen(W)=(+1,0) → shift=(−10,0).
    expect(shift!.x).toBeCloseTo(-10, 6);
    expect(shift!.y).toBeCloseTo(0, 6);
  });

  it('γείτονες αριστερά+δεξιά, κίνηση ΔΕΞΙΑ → επιλέγει τον E', () => {
    const targets = makeTargets({ footprints: [sq(200, 0, 50), sq(-200, 0, 50)] });
    const shift = resolveGapStepShift(GHOST, targets, 30, MAX, { x: 1, y: 0 });
    expect(shift!.x).toBeCloseTo(10, 6); // E → +X shift
  });

  it('γείτονας πάνω + κίνηση πάνω → shift στον άξονα Y', () => {
    const targets = makeTargets({ footprints: [sq(0, 200, 50)] }); // N gap = 150 − 50 = 100
    const shift = resolveGapStepShift(GHOST, targets, 30, MAX, { x: 0, y: 1 });
    expect(shift!.x).toBeCloseTo(0, 6);
    // widen(N)=(0,−1), delta=−10 → shift=(0,+10).
    expect(shift!.y).toBeCloseTo(10, 6);
  });

  it('χωρίς κίνηση (moveDir=null) → fallback στον πλησιέστερο γείτονα', () => {
    const targets = makeTargets({ footprints: [sq(200, 0, 50), sq(-400, 0, 50)] }); // E gap 100 < W gap 300
    const shift = resolveGapStepShift(GHOST, targets, 30, MAX, null);
    expect(shift!.x).toBeCloseTo(10, 6); // στρογγυλεύει τον E (πλησιέστερο)
  });

  it('κίνηση προς μεριά χωρίς γείτονα → fallback στον μόνο διαθέσιμο (πάντα στρογγυλό)', () => {
    const targets = makeTargets({ footprints: [sq(-200, 0, 50)] }); // μόνο W
    const shift = resolveGapStepShift(GHOST, targets, 30, MAX, { x: 1, y: 0 }); // κινείται δεξιά
    expect(shift!.x).toBeCloseTo(-10, 6); // στρογγυλεύει τον W ούτως ή άλλως
  });

  it('ήδη στρογγυλό διάκενο → {0,0}', () => {
    const targets = makeTargets({ footprints: [sq(250, 0, 50)] }); // E gap = 200 − 50 = 150
    const shift = resolveGapStepShift(GHOST, targets, 50, MAX, { x: 1, y: 0 }); // 150 = 3×50
    expect(shift).toEqual({ x: 0, y: 0 });
  });

  it('βήμα ≤ 0 → null (ανενεργό)', () => {
    const targets = makeTargets({ footprints: [sq(200, 0, 50)] });
    expect(resolveGapStepShift(GHOST, targets, 0, MAX, { x: 1, y: 0 })).toBeNull();
  });

  it('κανένας AABB γείτονας → null', () => {
    expect(resolveGapStepShift(GHOST, makeTargets({}), 30, MAX, { x: 1, y: 0 })).toBeNull();
  });

  it('γείτονας πέρα από maxClearance → null', () => {
    const targets = makeTargets({ footprints: [sq(200, 0, 50)] }); // gap 100
    expect(resolveGapStepShift(GHOST, targets, 30, 50, { x: 1, y: 0 })).toBeNull(); // 100 > 50
  });

  it('κυκλικός γείτονας (ως bbox) μετράει επίσης', () => {
    const targets = makeTargets({ circularFootprints: [sq(200, 0, 50)] });
    const shift = resolveGapStepShift(GHOST, targets, 30, MAX, { x: 1, y: 0 });
    expect(shift!.x).toBeCloseTo(10, 6);
  });
});
