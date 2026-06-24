/**
 * ADR-508 — `resolveWallEndpointSnap`: το ΑΚΡΟ του τοίχου κουμπώνει flush σε παρειά μέλους/κολώνας
 * (point snap, reuse του κοινού dispatcher). Scene units = mm. Η precedence vs length/angle lock
 * ζει στον caller (`useWallTool`) — εδώ ελέγχουμε μόνο το pure snap/no-snap.
 */

import { resolveWallEndpointSnap, resolveWallEndpointWithFineStep } from '../wall-endpoint-snap';
import type { GhostFaceFrame, LinearMemberSnapTarget } from '../../framing/linear-member-face-snap';
import { ShiftKeyTracker } from '../../../keyboard/ShiftKeyTracker';
import { immediateSceneScale } from '../../../systems/cursor/ImmediateSceneScaleStore';

/** Τετράγωνη κολόνα 400×400 στο (0,0)-(400,400). */
const COLUMN_FP = [
  { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 },
];

/** Οριζόντιο μέλος (τοίχος/δοκάρι) μήκους 10m, πάχους 200 (y ∈ [-100,100]). */
const MEMBER: LinearMemberSnapTarget = {
  id: 'm1',
  axis: [{ x: 0, y: 0 }, { x: 10000, y: 0 }],
  outline: [{ x: 0, y: -100 }, { x: 10000, y: -100 }, { x: 10000, y: 100 }, { x: 0, y: 100 }],
};

describe('resolveWallEndpointSnap', () => {
  it('Άκρο κοντά σε ΚΟΛΩΝΑ → κουμπώνει flush στην παρειά (point = snap.start) + faceFrame', () => {
    const r = resolveWallEndpointSnap({ x: 500, y: 200 }, [COLUMN_FP], [], 200, 'mm');
    expect(r.point).toEqual({ x: 400, y: 200 }); // ανατολική παρειά κολόνας
    expect(r.faceFrame).toBeDefined();
  });

  it('Άκρο κοντά σε ΜΕΛΟΣ → κουμπώνει flush στην παρειά (ολίσθηση κατά μήκος)', () => {
    const r = resolveWallEndpointSnap({ x: 5000, y: 150 }, [], [MEMBER], 200, 'mm');
    expect(r.point.x).toBeCloseTo(5000); // ολισθαίνει στο σημείο του cursor κατά μήκος
    expect(Math.abs(r.point.y)).toBeCloseTo(100); // κουμπωμένο στη μακρινή παρειά (±100)
    expect(r.faceFrame).toBeDefined();
  });

  it('Άκρο ΕΚΤΟΣ capture → επιστρέφει το rawEnd αυτούσιο, χωρίς faceFrame', () => {
    const raw = { x: 50000, y: 50000 };
    const r = resolveWallEndpointSnap(raw, [COLUMN_FP], [MEMBER], 200, 'mm');
    expect(r.point).toEqual(raw);
    expect(r.faceFrame).toBeUndefined();
  });

  it('Κολόνα → proportional fine βήμα στο endpoint (όχι 12-jump)', () => {
    // κολόνα 400, πλάτος 200, dominantUnit=1cm → N=40 → βήμα 5mm. cursor y=252 → 250.
    const r = resolveWallEndpointSnap({ x: 500, y: 252 }, [COLUMN_FP], [], 200, 'mm');
    expect(r.point.x).toBeCloseTo(400);
    expect(r.point.y).toBeCloseTo(250); // 252 → πλησιέστερο πολλαπλάσιο του 5mm
  });
});

describe('resolveWallEndpointWithFineStep — Shift 1cm βήμα στο ελεύθερο (face-snap νικά)', () => {
  const START = { x: 1000, y: 0 };
  // Minimal truthy faceFrame — η συνάρτηση ελέγχει μόνο την ύπαρξή του.
  const FACE = {} as GhostFaceFrame;

  afterEach(() => {
    ShiftKeyTracker._setForTest(false);
    immediateSceneScale.set(1);
  });

  it('face-snap υπάρχει → επιστρέφει το flush σημείο αυτούσιο ακόμη και με Shift', () => {
    ShiftKeyTracker._setForTest(true);
    immediateSceneScale.set(1);
    const out = resolveWallEndpointWithFineStep({ point: { x: 1043, y: 0 }, faceFrame: FACE }, START);
    expect(out).toEqual({ x: 1043, y: 0 }); // face νικά → ΟΧΙ 1cm
  });

  it('ελεύθερο + Shift κάτω → no-op (raw endpoint)', () => {
    ShiftKeyTracker._setForTest(false);
    const out = resolveWallEndpointWithFineStep({ point: { x: 1047, y: -23 } }, START);
    expect(out).toEqual({ x: 1047, y: -23 });
  });

  it('ελεύθερο + Shift πάνω → βήμα 1cm σχετικά με το start (47→50, 23→20)', () => {
    immediateSceneScale.set(1); // mm scene
    ShiftKeyTracker._setForTest(true);
    const out = resolveWallEndpointWithFineStep({ point: { x: 1047, y: -23 } }, START);
    expect(out).toEqual({ x: 1050, y: -20 }); // delta 47→50, -23→-20 γύρω από το 1000
  });

  it('ελεύθερο + Shift πάνω → μετατροπή 1cm σε scene units (metre-scale)', () => {
    immediateSceneScale.set(0.001); // 1 canvas unit = 1 m → 10mm = 0.01
    ShiftKeyTracker._setForTest(true);
    const out = resolveWallEndpointWithFineStep({ point: { x: 1.047, y: 0 } }, { x: 1.0, y: 0 });
    expect(out.x).toBeCloseTo(1.05);
    expect(out.y).toBeCloseTo(0);
  });
});
