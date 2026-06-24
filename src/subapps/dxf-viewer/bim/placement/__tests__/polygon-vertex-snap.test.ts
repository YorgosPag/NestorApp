/**
 * ADR-514 Φ6 — `resolvePolygonVertexSnap` (face-snap κορυφών πλάκας/στέγης).
 * Επιβεβαιώνει: Φ6a per-vertex flush, Φ6b edge-slide (κατά μήκος locked παρειάς) + corner-turn +
 * release, και ελεύθερο σημείο όταν δεν υπάρχει στόχος. ΜΕΣΑ από τον εγκέφαλο (toolKind 'polygon-vertex').
 */

import { resolvePolygonVertexSnap, type PolygonVertexLock } from '../polygon-vertex-snap';
import type { SceneSnapTargets } from '../../framing/scene-snap-targets';
import type { GhostFaceFrame, LinearMemberSnapTarget } from '../../framing/linear-member-face-snap';

function makeTargets(partial: Partial<SceneSnapTargets> = {}): SceneSnapTargets {
  return {
    footprints: [], beamTargets: [], wallTargets: [], slabTargets: [], lineTargets: [],
    diskTargets: [], rectTargets: [], wallEntities: [], openings: [], ...partial,
  };
}

/** Οριζόντιος τοίχος W1 με σώμα ±50 γύρω από τον άξονα (0,0)→(1000,0). */
const WALL_W1: LinearMemberSnapTarget = {
  id: 'W1',
  axis: [{ x: 0, y: 0 }, { x: 1000, y: 0 }],
  outline: [{ x: 0, y: -50 }, { x: 1000, y: -50 }, { x: 1000, y: 50 }, { x: 0, y: 50 }],
};

/** Κλειδωμένη οριζόντια παρειά στην ευθεία y=0 (Φ6b previous-vertex lock). */
const LOCK_FACE: GhostFaceFrame = {
  origin: { x: 0, y: 0 }, axisDir: { x: 1, y: 0 }, perpDir: { x: 0, y: 1 },
  facePerp: 0, outwardSign: 1, faceAlongMin: 0, faceAlongMax: 1000,
  ghostCenterAlong: 300, ghostHalfWidth: 0,
};
const LOCK: PolygonVertexLock = { faceFrame: LOCK_FACE, targetId: 'P1' };

describe('resolvePolygonVertexSnap — Φ6a per-vertex flush', () => {
  it('κοντά σε παρειά τοίχου → κορυφή flush ΠΑΝΩ στην παρειά (faceFrame + targetId)', () => {
    const r = resolvePolygonVertexSnap({ x: 500, y: 30 }, makeTargets({ wallTargets: [WALL_W1] }), 'mm');
    expect(r.faceFrame).toBeDefined();
    expect(r.targetId).toBe('W1');
    // κούμπωσε στη βόρεια παρειά (y=50), όχι στο raw 30.
    expect(r.point.y).toBeCloseTo(50);
  });

  it('μακριά από κάθε στόχο → ελεύθερο σημείο (cursor αυτούσιος, χωρίς faceFrame)', () => {
    const r = resolvePolygonVertexSnap({ x: 9000, y: 9000 }, makeTargets({ wallTargets: [WALL_W1] }), 'mm');
    expect(r.faceFrame).toBeUndefined();
    expect(r.point).toEqual({ x: 9000, y: 9000 });
  });
});

describe('resolvePolygonVertexSnap — Φ6b edge-slide', () => {
  it('lock + cursor κοντά στην κλειδωμένη παρειά → ολίσθηση ΚΑΤΑ ΜΗΚΟΣ (perp κρατιέται)', () => {
    // Κενοί στόχοι → κανένα φρέσκο snap· ο lock οδηγεί. cursor (300,5) → προβολή στη γραμμή y=0.
    const r = resolvePolygonVertexSnap({ x: 300, y: 5 }, makeTargets(), 'mm', LOCK);
    expect(r.point.x).toBeCloseTo(300);
    expect(r.point.y).toBeCloseTo(0);
    expect(r.faceFrame).toBe(LOCK_FACE);
    expect(r.targetId).toBe('P1');
  });

  it('lock + cursor τραβηγμένος ΜΑΚΡΙΑ κάθετα → release (επιστρέφει τον cursor αυτούσιο)', () => {
    const r = resolvePolygonVertexSnap({ x: 300, y: 100000 }, makeTargets(), 'mm', LOCK);
    expect(r.faceFrame).toBeUndefined();
    expect(r.point).toEqual({ x: 300, y: 100000 });
  });

  it('lock + φρέσκο snap σε ΔΙΑΦΟΡΕΤΙΚΗ παρειά → corner-turn (νέος lock στη νέα παρειά)', () => {
    const r = resolvePolygonVertexSnap({ x: 500, y: 30 }, makeTargets({ wallTargets: [WALL_W1] }), 'mm', LOCK);
    expect(r.targetId).toBe('W1'); // παραχώρησε στον φρέσκο τοίχο, όχι στο P1
    expect(r.faceFrame).toBeDefined();
    expect(r.point.y).toBeCloseTo(50);
  });
});
