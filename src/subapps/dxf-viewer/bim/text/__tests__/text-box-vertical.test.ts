/**
 * ADR-557 Φ-attachment (vertical) — the VISUAL box hugs the drawn glyphs.
 *
 * With a cap-height font (ink ascent 0.7·em, zero descender — like all-caps "TEST"), the
 * VISUAL box (`resolveTextBox`, the 2D grip / hover / hitTest box) must:
 *   - seat its bottom on the baseline and its top at the cap top (no em gap above),
 *   - be SHORTER than the NOMINAL em box (`resolveTextEmBox`, the 3D plane + culling box),
 *   - and survive a resize with no jump (the dragged box height round-trips through the
 *     nominal `height` inverse).
 *
 * Stub metrics: font ascent 0.8 / descent 0.2 (baseline anchor), advance 0.6·em·char.
 */

import type { DxfText, DxfTextStyle } from '../../../canvas-v2/dxf-canvas/dxf-types';
import {
  resolveTextBox,
  resolveTextEmBox,
  textBoxToPosition,
  textVisualExtentRatio,
} from '../text-box';
import { applyTextGripDrag } from '../text-grips';
import { installStubFont, stubAdvanceWorld, stubEmSize } from '../../../text-engine/fonts/__tests__/_stub-font';

/** Το ink ascent του stub ως κλάσμα του **em** (κεφαλαία, μηδέν descender). */
const CAP_INK_EM = 0.7;
/** Το ascent των **μετρικών** του stub ως κλάσμα του em — εκεί κάθεται η baseline. */
const FONT_ASCENT_EM = 0.8;

let __cleanup: () => void;
// Cap-height stub: glyph ink is 0.7·em above the baseline, nothing below (all-caps).
beforeAll(() => { __cleanup = installStubFont(0.6, 'arial', { inkAscentEm: CAP_INK_EM, inkDescentEm: 0 }); });
afterAll(() => __cleanup());

// ADR-635 Φ C.22 — ΚΑΘΕ κατακόρυφη τιμή εδώ παράγεται από το `stubEmSize(h)`: το κείμενο ΔΕΝ
// βάφεται πια σε em ίσο με το ύψος του, οπότε «baseline = −0.8·h» ήταν σιωπηλή υπόθεση
// «em == ύψος». Ο κανόνας είναι `em = ύψος × unitsPerEm / sCapHeight` (εδώ ×1.25).
// ⚠️ Κλήσεις ΜΕΣΑ στο `it()` — η γραμματοσειρά δηλώνεται στο `beforeAll`.
/** Η baseline (world y) για attachment γραμμής «T» και ύψος `h`, από το `position`. */
const baselineTop = (h = 10) => -FONT_ASCENT_EM * stubEmSize(h);
/** Το ΟΠΤΙΚΟ ύψος κουτιού (μόνο ink κεφαλαίων) για ύψος κειμένου `h`. */
const capBoxH = (h = 10) => CAP_INK_EM * stubEmSize(h);
/** Advance του «DDD» (3 χαρακτήρες) σε ύψος κειμένου `h`. */
const adv = (h = 10) => stubAdvanceWorld(3, h);

function text(extra: Partial<DxfText> = {}): DxfText {
  return { id: 't1', type: 'text', visible: true, position: { x: 0, y: 0 }, text: 'DDD', height: 10, ...extra };
}
function style(att: string): DxfTextStyle {
  const row = att[0], col = att[1];
  return {
    textAlign: col === 'C' ? 'center' : col === 'R' ? 'right' : 'left',
    textBaseline: row === 'M' ? 'middle' : row === 'B' ? 'bottom' : 'top',
  };
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('VISUAL box hugs the caps (TL, height 10)', () => {
  const t = text({ textStyle: style('TL') });

  it('bottom sits on the baseline, top at the cap top — no em gap above', () => {
    const f = resolveTextBox(t);
    // TL: baseline = position.y − fontAscent·em. Cap top = baseline + capInk·em.
    const boxTop = f.center.y + f.halfLength;
    const boxBottom = f.center.y - f.halfLength;
    expect(near(boxBottom, baselineTop())).toBe(true);              // baseline (glyph bottom)
    expect(near(boxTop, baselineTop() + capBoxH())).toBe(true);     // cap top (glyph top)
    expect(f.halfLength).toBeCloseTo(capBoxH() / 2, 9);             // extent = cap ink only
    expect(f.halfWidth).toBeCloseTo(adv() / 2, 9);                  // width = the real advance
  });

  it('is SHORTER than the nominal em box (which the 3D plane + culling still use)', () => {
    const em = resolveTextEmBox(t);
    // ⚠️ ADR-635 Φ C.22 — το ΟΝΟΜΑΣΤΙΚΟ κουτί ΔΕΝ ακολουθεί τον κανόνα καθ' ύψος: μένει στο
    // ύψος κειμένου (0.5·h), γιατί το 3D επίπεδο + το culling είναι em-based με το δικό τους
    // κελί. Είναι ΣΧΕΔΙΑΣΗ (τεκμηριωμένη στο `text-box.ts`), όχι σφάλμα — μην το «διορθώσεις».
    expect(em.halfLength).toBeCloseTo(5, 9);          // em box unchanged (0.5·10)
    expect(em.center.y).toBeCloseTo(-5, 9);           // em centre (position.y − h/2)
    expect(resolveTextBox(t).halfLength).toBeLessThan(em.halfLength);
  });
});

describe('textVisualExtentRatio', () => {
  it('is the ink extent (cap height) ÷ TEXT HEIGHT, not 1', () => {
    // ADR-635 Φ C.22 — ο διαιρέτης του resize μετρά ανά ΥΨΟΣ ΚΕΙΜΕΝΟΥ (αυτό πολλαπλασιάζει ο
    // `text-box`), όχι ανά em: cap ink 0.7·em × (em/ύψος) = 0.875 με αυτό το stub.
    expect(textVisualExtentRatio(text({ textStyle: style('TL') }))).toBeCloseTo(capBoxH() / 10, 9);
    expect(textVisualExtentRatio(text({ textStyle: style('TL') }))).not.toBeCloseTo(CAP_INK_EM, 3);
  });
});

describe('resize round-trips with no jump (visual → nominal → visual)', () => {
  it('north-edge grow: the box holds the dragged height + pins the baseline', () => {
    const t0 = text({ textStyle: style('TL') });
    const f0 = resolveTextBox(t0);
    const baseBottom = f0.center.y - f0.halfLength; // baseline, must stay pinned (opposite edge)

    // Grow the top edge by +7 world → visual (cap) box height + 7.
    const grown = capBoxH() + 7;
    const patch = applyTextGripDrag('text-edge-n', { entity: t0, delta: { x: 0, y: 7 } });
    // Η ΑΝΕΞΑΡΤΗΤΗ αλήθεια: το ονομαστικό `height` που γράφτηκε είναι εκείνο που ΞΑΝΑΠΑΡΑΓΕΙ
    // το συρμένο κουτί μέσα από τον κανόνα ύψους→em — όχι μια αντιγραφή του τύπου.
    expect(capBoxH(patch.height!)).toBeCloseTo(grown, 9);

    const t1 = { ...t0, ...patch } as DxfText;
    const f1 = resolveTextBox(t1);
    expect(f1.halfLength).toBeCloseTo(grown / 2, 6); // dragged height held — NO jump on release
    expect(f1.halfWidth).toBeCloseTo(adv() / 2, 6);  // width held (widthFactor compensated)
    expect(near(f1.center.y - f1.halfLength, baseBottom, 1e-6)).toBe(true); // baseline pinned
  });

  it('position inverse round-trips (no drift) for a rotated cap box', () => {
    const t = text({ textStyle: style('BR'), rotation: 30, position: { x: 4, y: 9 } });
    const p = textBoxToPosition(resolveTextBox(t), t);
    expect(near(p.x, 4, 1e-6) && near(p.y, 9, 1e-6)).toBe(true);
  });
});
