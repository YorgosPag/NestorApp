/**
 * ADR-557 — `text-grips` adapter tests (pure, Slice 1).
 *
 * Covers the SSoT text↔RectFrame bridge:
 *   - `getTextGrips` → exactly 10 grips (4 corners + 4 edges + move + rotation),
 *     correct kinds + world positions for an axis-aligned box,
 *   - `effectiveTextWidth` — MTEXT frame `width` vs simple-TEXT formula,
 *   - `textToRectFrame` ⇄ position round-trip (no drift, incl. rotated),
 *   - `applyTextGripDrag` — move / edge (width & height) / corner / rotation,
 *     and the MTEXT `width` vs TEXT `widthFactor` patch split.
 */

import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';
import {
  getTextGrips,
  effectiveTextWidth,
  textToRectFrame,
  applyTextGripDrag,
} from '../text-grips';
// ADR-557 Φ-attachment — the box now measures the real glyph advance; pin a stub font
// at the 0.6 monospace ratio so these hand-computed widths stay deterministic (the jest
// jsdom canvas would otherwise feed machine-dependent metrics into the tier-2 fallback).
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';

let __stubCleanup: () => void;
beforeAll(() => { __stubCleanup = installStubFont(); });
afterAll(() => __stubCleanup());

// CHAR_WIDTH_MONOSPACE = 0.6 (TEXT_METRICS_RATIOS). "DDD" (3) × height 10 × 0.6 = 18.
// ADR-557 Φ-attachment: the box is now attachment-aware. These adapter tests pin the
// classic baseline-left case explicitly (`textStyle` BL → box extends +x/+y, the old
// default), so the resize/rotation/patch math is verified on a known box; the full
// attachment matrix (TL..BR, 2D≡3D) is covered by `text-box.test.ts`.
function text(extra: Partial<DxfText> = {}): DxfText {
  return {
    id: 't1', type: 'text', visible: true, position: { x: 0, y: 0 }, text: 'DDD', height: 10,
    textStyle: { textAlign: 'left', textBaseline: 'bottom' }, ...extra,
  };
}

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const nearP = (p: { x: number; y: number }, x: number, y: number, eps = 1e-9) =>
  near(p.x, x, eps) && near(p.y, y, eps);

describe('effectiveTextWidth', () => {
  it('TEXT → len·height·0.6·widthFactor (default factor 1)', () => {
    expect(effectiveTextWidth(text())).toBeCloseTo(18, 9);
  });
  it('TEXT → honours widthFactor', () => {
    expect(effectiveTextWidth(text({ widthFactor: 2 }))).toBeCloseTo(36, 9);
  });
  it('MTEXT wide frame → HUGS the glyphs (Giorgio 2026-07-07: frame ignored when text is narrower)', () => {
    expect(effectiveTextWidth(text({ width: 50, text: 'X' }))).toBeCloseTo(6, 9); // content 'X' = 6, NOT 50
  });
  it('MTEXT narrow frame → the column frame wins (text wraps to it)', () => {
    expect(effectiveTextWidth(text({ width: 4, text: 'X' }))).toBeCloseTo(4, 9); // 4 < content 6
  });
});

describe('textToRectFrame', () => {
  it('axis-aligned box: centre + half-extents from lower-left position', () => {
    const f = textToRectFrame(text());
    expect(nearP(f.center, 9, 5)).toBe(true); // box extends +x (right) and +y (up)
    expect(f.halfWidth).toBeCloseTo(9, 9);
    expect(f.halfLength).toBeCloseTo(5, 9);
    expect(f.rotationDeg).toBe(0);
  });
  it('position round-trips through the frame for a rotated box', () => {
    const t = text({ rotation: 30, position: { x: 12, y: -7 } });
    const f = textToRectFrame(t);
    // Re-derive position via the same inverse the adapter uses (move with zero delta).
    const patch = applyTextGripDrag('text-move', { entity: t, delta: { x: 0, y: 0 } });
    expect(nearP(patch.position!, 12, -7)).toBe(true);
    // Sanity: centre is offset from the top-left by the rotated (w/2,−h/2).
    expect(near(Math.hypot(f.center.x - 12, f.center.y + 7), Math.hypot(9, 5))).toBe(true);
  });
});

describe('getTextGrips', () => {
  // Lazy: computed in beforeAll so the stub font (outer beforeAll) is installed first —
  // a describe-body `const` would run at collection time, before the font, and hit the
  // non-deterministic tier-2 canvas metrics.
  let grips: ReturnType<typeof getTextGrips>;
  beforeAll(() => { grips = getTextGrips(text()); });

  it('emits exactly 10 grips', () => {
    expect(grips).toHaveLength(10);
  });

  it('emits every expected kind once', () => {
    const kinds = grips.map(g => g.textGripKind).sort();
    expect(kinds).toEqual([
      'text-corner-ne', 'text-corner-nw', 'text-corner-se', 'text-corner-sw',
      'text-edge-e', 'text-edge-n', 'text-edge-s', 'text-edge-w',
      'text-move', 'text-rotation',
    ]);
  });

  it('places corners at the box extremes (lower-left = position)', () => {
    const by = (k: string) => grips.find(g => g.textGripKind === k)!.position;
    expect(nearP(by('text-corner-sw'), 0, 0)).toBe(true);    // lower-left = position
    expect(nearP(by('text-corner-se'), 18, 0)).toBe(true);   // lower-right
    expect(nearP(by('text-corner-nw'), 0, 10)).toBe(true);   // upper-left
    expect(nearP(by('text-corner-ne'), 18, 10)).toBe(true);  // upper-right
  });

  it('places edge midpoints + move on the box centre lines', () => {
    const by = (k: string) => grips.find(g => g.textGripKind === k)!.position;
    expect(nearP(by('text-edge-e'), 18, 5)).toBe(true);
    expect(nearP(by('text-edge-w'), 0, 5)).toBe(true);
    expect(nearP(by('text-edge-n'), 9, 10)).toBe(true); // top edge
    expect(nearP(by('text-edge-s'), 9, 0)).toBe(true);  // bottom edge (baseline)
    expect(nearP(by('text-move'), 9, 5)).toBe(true);
  });

  it('rotation handle sits midway between centre and bottom edge (−height/4)', () => {
    const rot = grips.find(g => g.textGripKind === 'text-rotation')!.position;
    expect(nearP(rot, 9, 2.5)).toBe(true); // centre (9,5) − height/4 (2.5) → (9, 2.5)
  });

  it('the move grip is the only one that moves the entity', () => {
    expect(grips.filter(g => g.movesEntity).map(g => g.textGripKind)).toEqual(['text-move']);
  });
});

describe('applyTextGripDrag — move', () => {
  it('translates position only', () => {
    const patch = applyTextGripDrag('text-move', { entity: text(), delta: { x: 5, y: 7 } });
    expect(nearP(patch.position!, 5, 7)).toBe(true);
    expect(patch.width).toBeUndefined();
    expect(patch.height).toBeUndefined();
    expect(patch.rotation).toBeUndefined();
  });
});

describe('applyTextGripDrag — edge resize (opposite edge fixed)', () => {
  it('TEXT east edge → grows box width via widthFactor, height untouched, west edge fixed', () => {
    const patch = applyTextGripDrag('text-edge-e', { entity: text(), delta: { x: 6, y: 0 } });
    expect(patch.height).toBeCloseTo(10, 9);            // height untouched
    expect(patch.widthFactor).toBeCloseTo(24 / 18, 9);  // new box width 24 / natural 18
    expect(patch.width).toBeUndefined();                // TEXT patches widthFactor, not width
    expect(nearP(patch.position!, 0, 0)).toBe(true);    // west (left) edge held at x=0
  });

  it('TEXT north edge → grows height, box width held constant (widthFactor compensates)', () => {
    const patch = applyTextGripDrag('text-edge-n', { entity: text(), delta: { x: 0, y: 4 } });
    expect(patch.height).toBeCloseTo(14, 9);
    // box width stays 18 → widthFactor = 18 / (3·14·0.6) = 18/25.2
    expect(patch.widthFactor).toBeCloseTo(18 / 25.2, 9);
    expect(patch.position!.y).toBeCloseTo(0, 9);        // bottom edge (baseline) held at y=0
  });

  it('frame-constrained MTEXT east edge → patches width directly (no widthFactor)', () => {
    // width 4 < content('X')=6 → frame-constrained → the column frame resizes (not widthFactor).
    const patch = applyTextGripDrag('text-edge-e', { entity: text({ width: 4, text: 'X' }), delta: { x: 4, y: 0 } });
    expect(patch.width).toBeCloseTo(8, 9); // 4 + Δx 4
    expect(patch.widthFactor).toBeUndefined();
    expect(patch.height).toBeCloseTo(10, 9);
  });

  it('clamps at the minimum dimension on an over-shrink drag', () => {
    const patch = applyTextGripDrag('text-edge-e', { entity: text({ width: 5, text: 'X' }), delta: { x: -100, y: 0 } });
    expect(patch.width!).toBeGreaterThan(0);            // never collapses/inverts
  });
});

describe('applyTextGripDrag — corner resize (opposite corner fixed)', () => {
  it('SE corner grows both dims; NW corner (opposite) stays pinned at (0,10)', () => {
    const t = text();
    const patch = applyTextGripDrag('text-corner-se', { entity: t, delta: { x: 6, y: -4 } });
    expect(patch.height).toBeCloseTo(14, 9);
    // box width 24 → widthFactor = 24 / (3·14·0.6) = 24/25.2
    expect(patch.widthFactor).toBeCloseTo(24 / 25.2, 9);
    // Re-frame the patched entity: the opposite (NW, upper-left) corner must hold.
    const f = textToRectFrame({ ...t, ...patch });
    const nw = { x: f.center.x - f.halfWidth, y: f.center.y + f.halfLength };
    expect(nearP(nw, 0, 10)).toBe(true);
  });
});

describe('applyTextGripDrag — rotation (pivot = bbox-centre)', () => {
  it('sweeps rotation by the cursor angle and holds the centre fixed', () => {
    const t = text();
    const center = textToRectFrame(t).center; // BL box → (9, 5)
    // start angle 0° (east of centre), current 90° (north of centre) → sweep +90°.
    const start = { x: center.x + 10, y: center.y };
    const currentPos = { x: center.x, y: center.y + 10 };
    const delta = { x: currentPos.x - start.x, y: currentPos.y - start.y };
    const patch = applyTextGripDrag('text-rotation', { entity: t, delta, currentPos });
    expect(patch.rotation).toBeCloseTo(90, 6);
    // Re-frame the patched entity: the centre must be unchanged (re-homed position).
    const after = textToRectFrame({ ...t, ...patch });
    expect(nearP(after.center, center.x, center.y, 1e-6)).toBe(true);
  });

  it('Shift (ortho) snaps the sweep to 45°', () => {
    const t = text();
    const center = textToRectFrame(t).center;
    const start = { x: center.x + 10, y: center.y };
    // ~50° current → snaps to 45°.
    const ang = (50 * Math.PI) / 180;
    const currentPos = { x: center.x + 10 * Math.cos(ang), y: center.y + 10 * Math.sin(ang) };
    const delta = { x: currentPos.x - start.x, y: currentPos.y - start.y };
    const patch = applyTextGripDrag('text-rotation', { entity: t, delta, currentPos, ortho: true });
    expect(patch.rotation).toBeCloseTo(45, 6);
  });

  // ADR-557 — the text-rotation hot-grip lets the user PICK a rotation centre (parity
  // with the column). A `pivot` override makes the box ORBIT that point instead of
  // spinning in place around its bbox-centre — the pipeline threads it from the
  // hot-grip (ghost via `rotatePivot`, commit via `BimRotateHotGripStore`).
  it('honors a picked pivot override — the box centre ORBITS the pivot', () => {
    const t = text();
    const center = textToRectFrame(t).center; // BL box → (9, 5)
    const pivot = { x: 0, y: 0 };
    // start east of the pivot, current north of the pivot → sweep +90° about the PIVOT.
    const start = { x: pivot.x + 10, y: pivot.y };
    const currentPos = { x: pivot.x, y: pivot.y + 10 };
    const delta = { x: currentPos.x - start.x, y: currentPos.y - start.y };
    const patch = applyTextGripDrag('text-rotation', { entity: t, delta, currentPos, pivot });
    expect(patch.rotation).toBeCloseTo(90, 6);
    // rel = (center − pivot) rotated +90° = (−cy, cx) → new centre = pivot + rel = (−5, 9).
    const after = textToRectFrame({ ...t, ...patch });
    expect(nearP(after.center, -(center.y - pivot.y), center.x - pivot.x, 1e-6)).toBe(true);
  });
});
