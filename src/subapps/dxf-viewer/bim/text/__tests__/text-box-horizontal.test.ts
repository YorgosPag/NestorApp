/**
 * ADR-557 Φ-attachment (horizontal) — the VISUAL box hugs the glyphs left+right too.
 *
 * With a font that has side bearings (ink x ∈ [0.12, 1.08]·em for a 2-char "DD" whose
 * advance is 1.2·em → 0.12 leading + 0.12 trailing bearing), the VISUAL box (`resolveTextBox`)
 * must inset the advance box by those bearings, be NARROWER than the em/advance box
 * (`resolveTextEmBox`), and survive an E-edge resize with no jump (the opposite edge pins).
 *
 * Vertical ink is left at the default (== font metrics) so this isolates the horizontal axis.
 */

import type { DxfText, DxfTextStyle } from '../../../canvas-v2/dxf-canvas/dxf-types';
import {
  resolveTextBox,
  resolveTextEmBox,
  textVisualWidthRatio,
} from '../text-box';
import { applyTextGripDrag } from '../text-grips';
import { installStubFont, stubAdvanceWorld } from '../../../text-engine/fonts/__tests__/_stub-font';

let __cleanup: () => void;
// Side bearings: "DD" advance 1.2·em, ink x∈[0.12, 1.08]·em → 0.12 bearing each side (10%).
beforeAll(() => { __cleanup = installStubFont(0.6, 'arial', { inkLeftEm: 0.12, inkRightEm: 1.08 }); });
afterAll(() => __cleanup());

/** Το κλάσμα του advance που τρώει ΚΑΘΕ πλευρικό bearing: 0.12 από advance 1.2·em = 10%. */
const BEARING_FRAC = 0.12 / 1.2;
/** Το κλάσμα του advance που ΚΡΑΤΑΕΙ το οπτικό κουτί (1 − τα δύο bearings). */
const INK_FRAC = 1 - 2 * BEARING_FRAC;

// ADR-635 Φ C.22 — το ΠΛΑΤΟΣ ακολουθεί τον κανόνα ύψους→em (το advance μετριέται στο em που
// επιλέγει το SSoT), άρα κανένα literal: `advDD()` είναι το πραγματικό advance του stub.
// ⚠️ Κλήση ΜΕΣΑ στο `it()` — η γραμματοσειρά δηλώνεται στο `beforeAll`.
/** Advance του «DD» (2 χαρακτήρες) σε ύψος κειμένου `h`. */
const advDD = (h = 10) => stubAdvanceWorld(2, h);

function text(extra: Partial<DxfText> = {}): DxfText {
  return { id: 't1', type: 'text', visible: true, position: { x: 0, y: 0 }, text: 'DD', height: 10, ...extra };
}
function style(att: string): DxfTextStyle {
  const row = att[0], col = att[1];
  return {
    textAlign: col === 'C' ? 'center' : col === 'R' ? 'right' : 'left',
    textBaseline: row === 'M' ? 'middle' : row === 'B' ? 'bottom' : 'top',
  };
}
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe('VISUAL box insets the side bearings (TL, height 10)', () => {
  const t = text({ textStyle: style('TL') });

  it('hugs the glyph ink left+right — narrower than the em/advance box, symmetric bearings', () => {
    const f = resolveTextBox(t);
    const em = resolveTextEmBox(t);
    expect(em.halfWidth).toBeCloseTo(advDD() / 2, 9);            // the full pen advance
    expect(f.halfWidth).toBeCloseTo((advDD() * INK_FRAC) / 2, 9); // inset by both bearings
    // Symmetric bearings → same centre; ink edges inset by bearingFrac·advance.
    expect(near(f.center.x, em.center.x)).toBe(true);
    expect(near(f.center.x - f.halfWidth, BEARING_FRAC * advDD())).toBe(true);       // left ink edge
    expect(near(f.center.x + f.halfWidth, (1 - BEARING_FRAC) * advDD())).toBe(true); // right ink edge
  });

  it('textVisualWidthRatio = 1 − total bearing fraction', () => {
    // Ο λόγος είναι ΚΑΘΑΡΑ οριζόντιος (κλάσμα του advance), άρα ο κανόνας ύψους→em τον αφήνει
    // αμετάβλητο: κλιμακώνει και το advance και το ink με τον ΙΔΙΟ παράγοντα.
    expect(textVisualWidthRatio(t)).toBeCloseTo(INK_FRAC, 9);
  });
});

describe('E-edge resize round-trips with no jump (visual width → widthFactor → visual)', () => {
  it('grows the box + pins the west (opposite) edge', () => {
    const t0 = text({ textStyle: style('TL') });
    const f0 = resolveTextBox(t0);
    const westEdge = f0.center.x - f0.halfWidth; // must stay pinned

    // Grow the east edge by +4 world → visual width 9.6 → 13.6 (halfWidth 4.8 → 6.8).
    const patch = applyTextGripDrag('text-edge-e', { entity: t0, delta: { x: 4, y: 0 } });
    const t1 = { ...t0, ...patch } as DxfText;
    const f1 = resolveTextBox(t1);
    expect(f1.halfWidth).toBeCloseTo(6.8, 6);                        // dragged width held — no jump
    expect(near(f1.center.x - f1.halfWidth, westEdge)).toBe(true);   // west edge pinned
    expect(patch.width).toBeUndefined();                            // TEXT patches widthFactor
  });
});
