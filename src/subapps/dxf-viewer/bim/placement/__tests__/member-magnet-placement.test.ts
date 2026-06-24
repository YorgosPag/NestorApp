/**
 * ADR-398 §3.13/§3.15 + ADR-514 — `resolveMemberMagnetPlacement`: το START γραμμικού μέλους κουμπώνει
 * σε πολικό (δίσκος) ή καρτεσιανό (ορθογώνιο) πλέγμα ΟΠΩΣ η κολώνα. Reuse των column point-snappers.
 * Επιπλέον: ο εγκέφαλος (`resolveBimCursorSnap`) εφαρμόζει το magnet ΜΟΝΟ όταν δοθεί `magnetOpts`
 * (δοκάρι) και ΜΟΝΟ ως fallback (member-face-first). Scene units = mm.
 */

import { resolveMemberMagnetPlacement } from '../member-magnet-placement';
import { resolveBimCursorSnap } from '../bim-cursor-snap';
import type { SceneSnapTargets } from '../../framing/scene-snap-targets';
import type { RectFrame } from '../../framing/rect-frame';

/** Δίσκος (κύκλος) ακτίνας 2m στο (0,0). */
const DISK = { center: { x: 0, y: 0 }, radius: 2000 };

/** Ορθογώνιο 4m×4m (axis-aligned) στο (0,0). */
const RECT: RectFrame = { center: { x: 0, y: 0 }, u: { x: 1, y: 0 }, v: { x: 0, y: 1 }, halfW: 2000, halfV: 2000 };

/** Τετράγωνη κολόνα 400×400 στο (10000,0) — μακριά από τον δίσκο. */
const FAR_COLUMN_FP = [
  { x: 10000, y: 0 }, { x: 10400, y: 0 }, { x: 10400, y: 400 }, { x: 10000, y: 400 },
];

function makeTargets(partial: Partial<SceneSnapTargets> = {}): SceneSnapTargets {
  return {
    footprints: [], beamTargets: [], wallTargets: [], slabTargets: [], lineTargets: [],
    diskTargets: [], rectTargets: [], wallEntities: [], openings: [], ...partial,
  };
}

const OPTS = { worldPerPixel: 10 };

describe('resolveMemberMagnetPlacement (pure)', () => {
  it('cursor στο κέντρο δίσκου → start = κέντρο + faceFrame (R/θ)', () => {
    const r = resolveMemberMagnetPlacement({ x: 5, y: 5 }, makeTargets({ diskTargets: [DISK] }), 'mm', OPTS);
    expect(r).not.toBeNull();
    expect(r!.start.x).toBeCloseTo(0);
    expect(r!.start.y).toBeCloseTo(0);
    expect(r!.status).toBe('neutral');
    expect(r!.faceFrame).toBeDefined();
    expect(r!.end.x).toBeGreaterThan(r!.start.x); // μικρό ghost προς +X
  });

  it('cursor μέσα σε ορθογώνιο → start σε καρτεσιανό σημείο πλέγματος (εντός ορίων)', () => {
    const r = resolveMemberMagnetPlacement({ x: 500, y: 300 }, makeTargets({ rectTargets: [RECT] }), 'mm', OPTS);
    expect(r).not.toBeNull();
    expect(Math.abs(r!.start.x)).toBeLessThanOrEqual(2000);
    expect(Math.abs(r!.start.y)).toBeLessThanOrEqual(2000);
  });

  it('κανένας δίσκος/ορθογώνιο → null', () => {
    const r = resolveMemberMagnetPlacement({ x: 5, y: 5 }, makeTargets(), 'mm', OPTS);
    expect(r).toBeNull();
  });

  it('worldPerPixel 0 (zoom άγνωστο) → null', () => {
    const r = resolveMemberMagnetPlacement({ x: 5, y: 5 }, makeTargets({ diskTargets: [DISK] }), 'mm', { worldPerPixel: 0 });
    expect(r).toBeNull();
  });
});

describe('resolveBimCursorSnap — beam magnet (ADR-514 member branch)', () => {
  it('beam + magnetOpts, cursor σε κέντρο δίσκου, χωρίς μέλη → member-placement στο magnet', () => {
    const r = resolveBimCursorSnap({
      toolKind: 'beam',
      cursor: { x: 5, y: 5 },
      targets: makeTargets({ diskTargets: [DISK] }),
      sceneUnits: 'mm',
      memberWidthMm: 250,
      memberKinds: ['beam', 'slab'],
      magnetOpts: OPTS,
    });
    expect(r.kind).toBe('member-placement');
    if (r.kind === 'member-placement') {
      expect(r.point).toEqual(r.placement.start);
      expect(r.placement.start.x).toBeCloseTo(0);
      expect(r.placement.start.y).toBeCloseTo(0);
    }
  });

  it('beam ΧΩΡΙΣ magnetOpts (τοίχος-style), cursor σε δίσκο → ΟΧΙ magnet → point fallback', () => {
    const r = resolveBimCursorSnap({
      toolKind: 'beam',
      cursor: { x: 5, y: 5 },
      targets: makeTargets({ diskTargets: [DISK] }),
      sceneUnits: 'mm',
      memberWidthMm: 250,
      memberKinds: ['beam', 'slab'],
    });
    expect(r.kind).toBe('point'); // χωρίς magnetOpts ο εγκέφαλος δεν εφαρμόζει magnet
    if (r.kind === 'point') expect(r.point).toEqual({ x: 5, y: 5 });
  });

  it('Giorgio 2026-06-24 — beam κοντά σε ΤΟΙΧΟ → snap (σιελ dims) όταν "wall" στα kinds', () => {
    // Οριζόντιος τοίχος 10m, πάχος 200 (y ∈ [-100,100]). Cursor στο σώμα του.
    const WALL = {
      id: 'w1',
      axis: [{ x: 0, y: 0 }, { x: 10000, y: 0 }],
      outline: [{ x: 0, y: -100 }, { x: 10000, y: -100 }, { x: 10000, y: 100 }, { x: 0, y: 100 }],
    };
    const base = {
      toolKind: 'beam' as const,
      cursor: { x: 5000, y: 150 },
      targets: makeTargets({ wallTargets: [WALL] }),
      sceneUnits: 'mm' as const,
      memberWidthMm: 250,
    };
    // ΜΕ 'wall' (το fix) → κουμπώνει στον τοίχο (member-placement + faceFrame για σιελ dims).
    const withWall = resolveBimCursorSnap({ ...base, memberKinds: ['wall', 'beam', 'slab', 'line'] });
    expect(withWall.kind).toBe('member-placement');
    if (withWall.kind === 'member-placement') expect(withWall.placement.faceFrame).toBeDefined();
    // ΧΩΡΙΣ 'wall' (παλιά συμπεριφορά) → ο τοίχος αγνοείται → point fallback (καμία ένδειξη).
    const withoutWall = resolveBimCursorSnap({ ...base, memberKinds: ['beam', 'slab'] });
    expect(withoutWall.kind).toBe('point');
  });

  it('member-face-first: κοντά σε κολόνα → face νικά το magnet (magnet = fallback μόνο)', () => {
    // cursor κοντά σε κολόνα ΚΑΙ μέσα σε (επικαλυπτόμενο) δίσκο: το face placement προηγείται.
    const r = resolveBimCursorSnap({
      toolKind: 'beam',
      cursor: { x: 10500, y: 200 },
      targets: makeTargets({
        footprints: [FAR_COLUMN_FP],
        diskTargets: [{ center: { x: 10200, y: 200 }, radius: 2000 }],
      }),
      sceneUnits: 'mm',
      memberWidthMm: 250,
      memberKinds: ['beam', 'slab'],
      magnetOpts: OPTS,
    });
    expect(r.kind).toBe('member-placement');
    if (r.kind === 'member-placement') {
      // κουμπωμένο στην ανατολική παρειά της κολόνας (x=10400), ΟΧΙ στο magnet κέντρο.
      expect(r.placement.start.x).toBeCloseTo(10400);
    }
  });
});
