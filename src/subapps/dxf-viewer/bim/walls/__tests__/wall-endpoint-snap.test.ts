/**
 * ADR-508 — `resolveWallEndpointSnap`: το ΑΚΡΟ του τοίχου κουμπώνει flush σε παρειά μέλους/κολώνας
 * (point snap, reuse του κοινού dispatcher). Scene units = mm. Η precedence vs length/angle lock
 * ζει στον caller (`useWallTool`) — εδώ ελέγχουμε μόνο το pure snap/no-snap.
 */

import { resolveWallEndpointSnap } from '../wall-endpoint-snap';
import type { LinearMemberSnapTarget } from '../../framing/linear-member-face-snap';

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

  it('Κολόνα με worldPerPixel → magnet στο κέντρο της παρειάς (συνεχές + magnet, όχι 12-jump)', () => {
    const r = resolveWallEndpointSnap({ x: 500, y: 250 }, [COLUMN_FP], [], 200, 'mm', 40);
    expect(r.point.x).toBeCloseTo(400);
    expect(r.point.y).toBeCloseTo(200); // magnet στο κέντρο
  });
});
