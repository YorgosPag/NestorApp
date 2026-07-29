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
import { gripKindOf } from '../../../hooks/grip-kinds';
// ADR-557 Φ-attachment — the box now measures the real glyph advance; pin a stub font
// at the 0.6 monospace ratio so these hand-computed widths stay deterministic (the jest
// jsdom canvas would otherwise feed machine-dependent metrics into the tier-2 fallback).
import { installStubFont, stubAdvanceWorld, stubEmSize } from '../../../text-engine/fonts/__tests__/_stub-font';

let __stubCleanup: () => void;
beforeAll(() => { __stubCleanup = installStubFont(); });
afterAll(() => __stubCleanup());

// ADR-635 Φ C.22 — ΚΑΜΙΑ σταθερή διάσταση εδώ. Ο κανόνας `em = ύψος × unitsPerEm / sCapHeight`
// σημαίνει ότι το κουτί ΔΕΝ έχει πια το ονομαστικό ύψος του κειμένου, οπότε κάθε «18» / «10»
// αυτού του αρχείου ήταν σιωπηλή υπόθεση «em == ύψος κειμένου». Παράγονται από το SSoT:
//   - ΠΛΑΤΟΣ → `stubAdvanceWorld(chars, height)` (πραγματικό advance του stub)
//   - ΥΨΟΣ κουτιού → `stubEmSize(height)`: το default stub έχει ink ≡ μετρικά (ascent 0.8 +
//     descent 0.2 = 1 em), άρα το ΟΠΤΙΚΟ κουτί είναι ακριβώς ένα em ψηλό.
// ⚠️ Καλούνται ΜΕΣΑ στο `it()` — η γραμματοσειρά δηλώνεται στο `beforeAll`.
/** Οπτικό ύψος κουτιού (world) για ύψος κειμένου `h` — default stub: ink ≡ em. */
const boxH = (h = 10) => stubEmSize(h);
/** Advance του «DDD» (3 χαρακτήρες) σε ύψος κειμένου `h`. */
const adv = (h = 10) => stubAdvanceWorld(3, h);

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
  it('TEXT → the real glyph advance at the em the height→em rule picks (factor 1)', () => {
    expect(effectiveTextWidth(text())).toBeCloseTo(adv(), 9);
  });
  it('TEXT → honours widthFactor', () => {
    expect(effectiveTextWidth(text({ widthFactor: 2 }))).toBeCloseTo(2 * adv(), 9);
  });
  it('MTEXT wide frame → HUGS the glyphs (Giorgio 2026-07-07: frame ignored when text is narrower)', () => {
    // content 'X' = the 1-char advance, NOT the 50-unit frame.
    expect(effectiveTextWidth(text({ width: 50, text: 'X' }))).toBeCloseTo(stubAdvanceWorld(1, 10), 9);
  });
  it('MTEXT narrow frame → the column frame wins (text wraps to it)', () => {
    // 4 < content('X') → frame-constrained.
    expect(stubAdvanceWorld(1, 10)).toBeGreaterThan(4);
    expect(effectiveTextWidth(text({ width: 4, text: 'X' }))).toBeCloseTo(4, 9);
  });
});

describe('textToRectFrame', () => {
  it('axis-aligned box: centre + half-extents from lower-left position', () => {
    const f = textToRectFrame(text());
    expect(nearP(f.center, adv() / 2, boxH() / 2)).toBe(true); // box extends +x (right) and +y (up)
    expect(f.halfWidth).toBeCloseTo(adv() / 2, 9);
    expect(f.halfLength).toBeCloseTo(boxH() / 2, 9);
    expect(f.rotationDeg).toBe(0);
  });
  it('position round-trips through the frame for a rotated box', () => {
    const t = text({ rotation: 30, position: { x: 12, y: -7 } });
    const f = textToRectFrame(t);
    // Re-derive position via the same inverse the adapter uses (move with zero delta).
    const patch = applyTextGripDrag('text-move', { entity: t, delta: { x: 0, y: 0 } });
    expect(nearP(patch.position!, 12, -7)).toBe(true);
    // Sanity: centre is offset from the top-left by the rotated (w/2,−h/2).
    expect(near(Math.hypot(f.center.x - 12, f.center.y + 7), Math.hypot(adv() / 2, boxH() / 2))).toBe(true);
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
    const kinds = grips.map(g => gripKindOf(g, 'text')).sort();
    expect(kinds).toEqual([
      'text-corner-ne', 'text-corner-nw', 'text-corner-se', 'text-corner-sw',
      'text-edge-e', 'text-edge-n', 'text-edge-s', 'text-edge-w',
      'text-move', 'text-rotation',
    ]);
  });

  it('places corners at the box extremes (lower-left = position)', () => {
    const by = (k: string) => grips.find(g => gripKindOf(g, 'text') === k)!.position;
    expect(nearP(by('text-corner-sw'), 0, 0)).toBe(true);                // lower-left = position
    expect(nearP(by('text-corner-se'), adv(), 0)).toBe(true);            // lower-right
    expect(nearP(by('text-corner-nw'), 0, boxH())).toBe(true);           // upper-left
    expect(nearP(by('text-corner-ne'), adv(), boxH())).toBe(true);       // upper-right
  });

  it('places edge midpoints + move on the box centre lines', () => {
    const by = (k: string) => grips.find(g => gripKindOf(g, 'text') === k)!.position;
    expect(nearP(by('text-edge-e'), adv(), boxH() / 2)).toBe(true);
    expect(nearP(by('text-edge-w'), 0, boxH() / 2)).toBe(true);
    expect(nearP(by('text-edge-n'), adv() / 2, boxH())).toBe(true); // top edge
    expect(nearP(by('text-edge-s'), adv() / 2, 0)).toBe(true);      // bottom edge (baseline)
    expect(nearP(by('text-move'), adv() / 2, boxH() / 2)).toBe(true);
  });

  it('rotation handle sits midway between centre and bottom edge (−height/4)', () => {
    const rot = grips.find(g => gripKindOf(g, 'text') === 'text-rotation')!.position;
    // centre (adv/2, boxH/2) − boxH/4 → (adv/2, boxH/4)
    expect(nearP(rot, adv() / 2, boxH() / 4)).toBe(true);
  });

  it('the move grip is the only one that moves the entity', () => {
    expect(grips.filter(g => g.movesEntity).map(g => gripKindOf(g, 'text'))).toEqual(['text-move']);
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
    expect(patch.height).toBeCloseTo(10, 9);                        // height untouched
    expect(patch.widthFactor).toBeCloseTo((adv() + 6) / adv(), 9);  // new box width / natural advance
    expect(patch.width).toBeUndefined();                            // TEXT patches widthFactor, not width
    expect(nearP(patch.position!, 0, 0)).toBe(true);                // west (left) edge held at x=0
  });

  it('TEXT north edge → grows height, box width held constant (widthFactor compensates)', () => {
    const t0 = text();
    const patch = applyTextGripDrag('text-edge-n', { entity: t0, delta: { x: 0, y: 4 } });
    // ADR-635 Φ C.22 — η ΑΝΕΞΑΡΤΗΤΗ αλήθεια: το ονομαστικό `height` που γράφτηκε είναι εκείνο
    // που ΞΑΝΑΠΑΡΑΓΕΙ το συρμένο κουτί. Γραμμένο έτσι, το test σπάει και αν χαθεί η μετατροπή
    // ύψους→em και αν αλλάξει ο κανόνας — χωρίς να αντιγράφει τον τύπο της υλοποίησης.
    expect(stubEmSize(patch.height!)).toBeCloseTo(boxH() + 4, 9);
    // box width held → widthFactor compensates the taller (wider) natural advance.
    expect(patch.widthFactor).toBeCloseTo(adv() / stubAdvanceWorld(3, patch.height!), 9);
    expect(patch.position!.y).toBeCloseTo(0, 9);        // bottom edge (baseline) held at y=0
    // …and the box actually holds on release (no jump): height dragged, width unchanged.
    const f = textToRectFrame({ ...t0, ...patch } as DxfText);
    expect(f.halfLength).toBeCloseTo((boxH() + 4) / 2, 6);
    expect(f.halfWidth).toBeCloseTo(adv() / 2, 6);
  });

  it('frame-constrained MTEXT east edge → patches width directly (no widthFactor)', () => {
    // width 4 < content('X') → frame-constrained → the column frame resizes (not widthFactor).
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
  it('SE corner grows both dims; NW corner (opposite) stays pinned at the box top-left', () => {
    const t = text();
    const patch = applyTextGripDrag('text-corner-se', { entity: t, delta: { x: 6, y: -4 } });
    // Dragging SE down by 4 grows the box by 4 → the nominal height that reproduces it.
    expect(stubEmSize(patch.height!)).toBeCloseTo(boxH() + 4, 9);
    expect(patch.widthFactor).toBeCloseTo((adv() + 6) / stubAdvanceWorld(3, patch.height!), 9);
    // Re-frame the patched entity: the opposite (NW, upper-left) corner must hold.
    const f = textToRectFrame({ ...t, ...patch });
    const nw = { x: f.center.x - f.halfWidth, y: f.center.y + f.halfLength };
    expect(nearP(nw, 0, boxH(), 1e-6)).toBe(true);
  });
});

describe('applyTextGripDrag — rotation (pivot = bbox-centre)', () => {
  it('sweeps rotation by the cursor angle and holds the centre fixed', () => {
    const t = text();
    const center = textToRectFrame(t).center; // BL box centre
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
    const center = textToRectFrame(t).center; // BL box centre
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
