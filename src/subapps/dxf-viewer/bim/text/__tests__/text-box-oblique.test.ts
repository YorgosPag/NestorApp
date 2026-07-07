/**
 * ADR-557 — the grip/hover box follows the AutoCAD OBLIQUE angle: with `obliqueAngle` set,
 * `resolveTextBox` carries `shearX = tan θ` and `textBoxCornersWorld` is a PARALLELOGRAM
 * whose top edge leans +X (forward «/») relative to the bottom, so the grips + hover frame
 * track the sheared glyphs instead of staying an upright rectangle (Giorgio 2026-07-08).
 * Zero oblique → plain rect (no `shearX`), byte-identical to the pre-shear path.
 */

import type { DxfText, DxfTextStyle } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { resolveTextBox, textBoxCornersWorld } from '../text-box';
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';

let __cleanup: () => void;
beforeAll(() => { __cleanup = installStubFont(0.6, 'arial'); });
afterAll(() => __cleanup());

const styleTL: DxfTextStyle = { textAlign: 'left', textBaseline: 'top' };
function text(extra: Partial<DxfText> = {}): DxfText {
  return { id: 't1', type: 'text', visible: true, position: { x: 0, y: 0 }, text: 'DD', height: 10, textStyle: styleTL, ...extra };
}

describe('oblique → sheared (parallelogram) text box', () => {
  it('no oblique → plain rect: top and bottom corners share X, no shearX', () => {
    const f = resolveTextBox(text());
    expect(f.shearX).toBeUndefined();
    const [ne, , , se] = textBoxCornersWorld(text());
    expect(ne.x).toBeCloseTo(se.x, 9); // top-right ≡ bottom-right in X → upright
  });

  it('obliqueAngle 30° → shearX = tan 30°, top edge leans +X by tan θ per unit height', () => {
    const angle = 30;
    const t = text({ textStyle: { ...styleTL, obliqueAngle: angle } });
    const f = resolveTextBox(t);
    expect(f.shearX).toBeCloseTo(Math.tan((angle * Math.PI) / 180), 9);

    const [ne, nw, sw, se] = textBoxCornersWorld(t);
    // Top corners shifted +X relative to the bottom → forward lean.
    expect(ne.x).toBeGreaterThan(se.x);
    expect(nw.x).toBeGreaterThan(sw.x);
    // The lean rate = Δx / Δy of a vertical side = tan θ (independent of box height).
    expect((ne.x - se.x) / (ne.y - se.y)).toBeCloseTo(Math.tan((angle * Math.PI) / 180), 6);
    expect((nw.x - sw.x) / (nw.y - sw.y)).toBeCloseTo(Math.tan((angle * Math.PI) / 180), 6);
  });

  it('negative oblique → opposite lean (top shifts −X)', () => {
    const t = text({ textStyle: { ...styleTL, obliqueAngle: -20 } });
    const [ne, , , se] = textBoxCornersWorld(t);
    expect(ne.x).toBeLessThan(se.x);
  });
});
