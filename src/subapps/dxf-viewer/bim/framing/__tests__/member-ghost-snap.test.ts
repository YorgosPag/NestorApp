/**
 * ADR-508 — dispatcher (`resolveMemberGhostSnapFromStore`), column face snap, generic
 * collector (`collectMemberSnapTargets`) και flush justification. Scene units = mm.
 */

import { resolveMemberColumnFaceSnap } from '../member-column-face-snap';
import { resolveMemberGhostSnapFromStore } from '../member-ghost-snap';
import { collectMemberSnapTargets } from '../member-snap-targets';
import { resolveMemberColumnFlushJustification } from '../member-column-flush';
import type { Entity } from '../../../types/entities';

/** Τετράγωνη κολόνα 400×400 με κέντρο (200,200). */
const COLUMN_FP = [
  { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 },
];

describe('resolveMemberColumnFaceSnap — 12-θέσεων face snap', () => {
  it('Ανατολική παρειά, μεσαίο third → start στην παρειά (x=400), centerline=κέντρο', () => {
    const r = resolveMemberColumnFaceSnap({ x: 700, y: 200 }, [COLUMN_FP], {
      memberWidthScene: 200, ghostLenScene: 1200, captureScene: 600,
    });
    expect(r).not.toBeNull();
    expect(r!.face).toBe('E');
    expect(r!.third).toBe('mid');
    expect(r!.start).toEqual({ x: 400, y: 200 });
    expect(r!.end).toEqual({ x: 1600, y: 200 });
  });

  it('Μακριά από κολόνα (πέρα από capture) → null', () => {
    const r = resolveMemberColumnFaceSnap({ x: 5000, y: 5000 }, [COLUMN_FP], {
      memberWidthScene: 200, ghostLenScene: 1200, captureScene: 600,
    });
    expect(r).toBeNull();
  });
});

describe('resolveMemberGhostSnapFromStore — column-priority dispatcher', () => {
  const MEMBER = {
    id: 'm1',
    axis: [{ x: 0, y: 0 }, { x: 10000, y: 0 }],
    outline: [{ x: 0, y: -100 }, { x: 10000, y: -100 }, { x: 10000, y: 100 }, { x: 0, y: 100 }],
  };

  it('Κοντά σε κολόνα → status neutral (column wins)', () => {
    const r = resolveMemberGhostSnapFromStore({ x: 700, y: 200 }, [COLUMN_FP], [], 200, 'mm');
    expect(r).not.toBeNull();
    expect(r!.status).toBe('neutral');
  });

  it('Χωρίς κολόνα, πάνω σε μέλος → member-to-member framing (status beam)', () => {
    const r = resolveMemberGhostSnapFromStore({ x: 5000, y: 150 }, [], [MEMBER], 200, 'mm');
    expect(r!.status).toBe('beam');
  });

  it('Ούτε κολόνα ούτε μέλος εντός capture → null', () => {
    expect(resolveMemberGhostSnapFromStore({ x: 9e4, y: 9e4 }, [COLUMN_FP], [MEMBER], 200, 'mm')).toBeNull();
  });

  it('worldPerPixel → σταθερό zoom-adaptive βήμα ολίσθησης κατά μήκος της παρειάς', () => {
    // Οριζόντιο μέλος ⇒ start.x = centerAlong. cursor x=5237 (mid third → shift 0).
    const free = resolveMemberGhostSnapFromStore({ x: 5237, y: 150 }, [], [MEMBER], 200, 'mm');
    expect(free!.start.x).toBeCloseTo(5237); // χωρίς βήμα → συνεχής ολίσθηση
    // step = adaptiveDistanceStep(40) = niceRound(40·25=1000) = 1000 → κούμπωσε στο 5000.
    const stepped = resolveMemberGhostSnapFromStore({ x: 5237, y: 150 }, [], [MEMBER], 200, 'mm', 40);
    expect(stepped!.start.x).toBeCloseTo(5000);
  });

  it('beam path (χωρίς worldPerPixel) → συνεχής ολίσθηση αμετάβλητη', () => {
    // Το δοκάρι (alias) ΔΕΝ περνά worldPerPixel → καμία αλλαγή (byte-for-byte regression guard).
    const a = resolveMemberGhostSnapFromStore({ x: 5123, y: 150 }, [], [MEMBER], 200, 'mm');
    expect(a!.start.x).toBeCloseTo(5123);
  });
});

describe('collectMemberSnapTargets — generic scene collector', () => {
  const column = {
    id: 'c1', type: 'column',
    geometry: { footprint: { vertices: COLUMN_FP } },
  } as unknown as Entity;

  const beam = {
    id: 'b1', type: 'beam',
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }] },
      outline: { vertices: [{ x: 0, y: -100 }, { x: 5000, y: -100 }, { x: 5000, y: 100 }, { x: 0, y: 100 }] },
    },
  } as unknown as Entity;

  const wall = {
    id: 'w1', type: 'wall',
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }] },
      outerEdge: { points: [{ x: 0, y: 100 }, { x: 5000, y: 100 }] },
      innerEdge: { points: [{ x: 0, y: -100 }, { x: 5000, y: -100 }] },
    },
  } as unknown as Entity;

  it('Κολόνες πάντα footprints· walls μόνο όταν ζητηθούν', () => {
    const r = collectMemberSnapTargets([column, wall], { memberKinds: ['wall'] });
    expect(r.footprints).toHaveLength(1);
    expect(r.memberTargets).toHaveLength(1);
    expect(r.memberTargets[0].id).toBe('w1');
    // wall outline = outer + αντεστραμμένο inner → κλειστός δακτύλιος (≥3 κορυφές)
    expect(r.memberTargets[0].outline.length).toBeGreaterThanOrEqual(4);
  });

  it('memberKinds φιλτράρει: μόνο beam → ο τοίχος αγνοείται', () => {
    const r = collectMemberSnapTargets([beam, wall], { memberKinds: ['beam'] });
    expect(r.memberTargets.map((t) => t.id)).toEqual(['b1']);
  });

  it('Τοίχοι + δοκάρια μαζί', () => {
    const r = collectMemberSnapTargets([beam, wall, column], { memberKinds: ['beam', 'wall'] });
    expect(r.memberTargets.map((t) => t.id).sort()).toEqual(['b1', 'w1']);
    expect(r.footprints).toHaveLength(1);
  });

  it('excludeId παραλείπει το μέλος υπό επεξεργασία', () => {
    const r = collectMemberSnapTargets([wall], { memberKinds: ['wall'], excludeId: 'w1' });
    expect(r.memberTargets).toHaveLength(0);
  });
});

describe('resolveMemberColumnFlushJustification — geometric side-face flush', () => {
  it('Άκρο μέσα σε κολόνα, κέντρο πάνω από άξονα → προτίμηση πλευράς', () => {
    // Οριζόντιος άξονας (0,0)→(5000,0)· κολόνα γύρω από το start, κέντρο (200,200) (πάνω).
    const j = resolveMemberColumnFlushJustification(
      { x: 200, y: 0 }, { x: 5000, y: 0 }, [COLUMN_FP], 'left', 250,
    );
    expect(j === 'left' || j === 'right').toBe(true);
  });

  it('Χωρίς κολόνες → fallback', () => {
    expect(resolveMemberColumnFlushJustification({ x: 0, y: 0 }, { x: 5000, y: 0 }, [], 'left')).toBe('left');
  });
});
