/**
 * ADR-929 Δ3 — η απεικόνιση px εικόνας ↔ σκηνή είναι ΜΙΑ, και ο ζωγράφος του υποβάθρου περνά από αυτήν.
 *
 * Τρία ερωτήματα, το καθένα με δική του απόδειξη:
 * 1. **Ισοδυναμία με το παρελθόν.** Ο νέος ένας πίνακας ζωγραφίζει την εικόνα ΑΚΡΙΒΩΣ εκεί που τη
 *    ζωγράφιζε η παλιά αλυσίδα `translate/scale/rotate/scale(1,−1)` + `drawImage(img, 0, −h)`. Η παλιά
 *    αλυσίδα είναι γραμμένη εδώ αυτούσια, ως **αναφορά** — όχι ως δεύτερη φωνή στον κώδικα παραγωγής.
 * 2. **Προεπισκόπηση ≡ αποτέλεσμα.** Το pixel που η αναγνώριση στέλνει στη σκηνή (`rasterPixelToScene`),
 *    περασμένο από τον ΠΡΑΓΜΑΤΙΚΟ `CoordinateTransforms.worldToScreen`, πέφτει στο pixel της οθόνης όπου
 *    ο καμβάς ζωγράφισε το ίδιο pixel της εικόνας.
 * 3. **Αντιστροφή.** Πήγαινε-έλα χωρίς απώλεια· εκφυλισμένη τοποθέτηση ⇒ `null`, ποτέ `NaN`.
 */

import { describe, it, expect } from '@jest/globals';
import type { Point2D, ViewTransform, Viewport } from '../../../rendering/types/Types';
import {
  type Affine2x3,
  IDENTITY_AFFINE,
  applyAffine,
  composeAffine,
} from '@/lib/geometry/affine-2x3';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import { DRAWING_AREA_CHROME } from '../../../rendering/core/drawing-area';
import { createPrng, type Prng } from '../../../utils/seeded-prng';
import {
  rasterPixelToScene,
  rasterToSceneAffine,
  sceneToRasterPixel,
  type RasterPlacement,
} from '../raster-scene-mapping';
import { applyRasterCanvasTransform } from '../../providers/provider-canvas-transforms';
import type { BackgroundTransform, ProviderRenderParams } from '../../providers/types';

// ─── Καταγραφέας καμβά: συνθέτει κάθε κλήση μετασχηματισμού σε έναν πίνακα ───

class MatrixRecorder {
  m: Affine2x3 = IDENTITY_AFFINE;
  private mul(n: Affine2x3): void { this.m = composeAffine(this.m, n); }
  translate(x: number, y: number): void { this.mul({ a: 1, b: 0, c: 0, d: 1, e: x, f: y }); }
  scale(x: number, y: number): void { this.mul({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); }
  rotate(r: number): void {
    this.mul({ a: Math.cos(r), b: Math.sin(r), c: -Math.sin(r), d: Math.cos(r), e: 0, f: 0 });
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.mul({ a, b, c, d, e, f });
  }
}

const asContext = (r: MatrixRecorder): CanvasRenderingContext2D =>
  r as unknown as CanvasRenderingContext2D;

/** Η αλυσίδα όπως ήταν ως το ADR-929 (provider-canvas-transforms, 2026-07-31) — ΑΝΑΦΟΡΑ. */
function legacyChain(r: MatrixRecorder, p: ProviderRenderParams): void {
  const { transform: t, worldToCanvas: w, viewport, cad } = p;
  if (cad) {
    r.translate(cad.chrome.leftRulerWidth, viewport.height - cad.chrome.bottomRulerHeight);
    r.scale(1, -1);
  }
  r.translate(w.offsetX, w.offsetY);
  r.scale(w.scale, w.scale);
  r.translate(t.translateX, t.translateY);
  r.rotate((t.rotation * Math.PI) / 180);
  r.scale(t.scaleX, t.scaleY);
  if (cad) r.scale(1, -1);
}

// ─── Τυχαίες αλλά αναπαραγώγιμες περιπτώσεις ────────────────────────────────

const VIEWPORT: Viewport = { width: 1280, height: 800 };
const BOUNDS = { width: 2400, height: 1700 };

function randomTransform(rng: Prng): BackgroundTransform {
  const s = 0.2 + rng() * 40;
  return {
    translateX: (rng() - 0.5) * 20000,
    translateY: (rng() - 0.5) * 20000,
    scaleX: s,
    scaleY: s * (0.9 + rng() * 0.2),
    rotation: (rng() - 0.5) * 360,
  };
}

function randomView(rng: Prng): ViewTransform {
  return { scale: 0.01 + rng() * 2, offsetX: (rng() - 0.5) * 3000, offsetY: (rng() - 0.5) * 3000 };
}

function renderParams(t: BackgroundTransform, w: ViewTransform, cad: boolean): ProviderRenderParams {
  return {
    transform: t,
    worldToCanvas: w,
    viewport: VIEWPORT,
    opacity: 1,
    cad: cad ? { mode: 'cad-y-up', chrome: DRAWING_AREA_CHROME } : undefined,
  };
}

const CORNERS_AND_INTERIOR: readonly Point2D[] = [
  { x: 0, y: 0 }, { x: BOUNDS.width, y: 0 }, { x: 0, y: BOUNDS.height },
  { x: BOUNDS.width, y: BOUNDS.height }, { x: 731.5, y: 1203.25 },
];

const CASES = 50;

function expectClose(actual: Point2D, expected: Point2D): void {
  const tol = 1e-6 * Math.max(1, Math.abs(expected.x), Math.abs(expected.y));
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tol);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tol);
}

describe('ADR-929 Δ3 — ο ζωγράφος του υποβάθρου είναι ΙΣΟΔΥΝΑΜΟΣ με την παλιά αλυσίδα', () => {
  it.each([true, false])('cad=%s: κάθε pixel πέφτει στο ίδιο σημείο του καμβά', (cad) => {
    const rng = createPrng(cad ? 929 : 930);
    for (let i = 0; i < CASES; i++) {
      const params = renderParams(randomTransform(rng), randomView(rng), cad);
      const legacy = new MatrixRecorder();
      legacyChain(legacy, params);
      const current = new MatrixRecorder();
      applyRasterCanvasTransform(asContext(current), params, BOUNDS);
      for (const px of CORNERS_AND_INTERIOR) {
        // Η παλιά αλυσίδα ζωγράφιζε στο (0, −h) σε CAD και στο (0, 0) σε οθόνη· η νέα πάντα στο (0, 0).
        const legacyLocal = cad ? { x: px.x, y: px.y - BOUNDS.height } : px;
        expectClose(applyAffine(current.m, px), applyAffine(legacy.m, legacyLocal));
      }
    }
  });
});

describe('ADR-929 Δ3 — προεπισκόπηση ≡ αποτέλεσμα', () => {
  it('pixel → σκηνή → οθόνη (worldToScreen) ≡ pixel → οθόνη του ζωγράφου', () => {
    const rng = createPrng(3);
    for (let i = 0; i < CASES; i++) {
      const transform = randomTransform(rng);
      const view = randomView(rng);
      const painter = new MatrixRecorder();
      applyRasterCanvasTransform(asContext(painter), renderParams(transform, view, true), BOUNDS);
      const placement: RasterPlacement = { transform, naturalBounds: BOUNDS };
      for (const px of CORNERS_AND_INTERIOR) {
        const viaScene = CoordinateTransforms.worldToScreen(rasterPixelToScene(px, placement), view, VIEWPORT);
        expectClose(viaScene, applyAffine(painter.m, px));
      }
    }
  });
});

describe('ADR-929 Δ3 — η σύμβαση αξόνων της σκηνής (cad-y-up)', () => {
  const identity: RasterPlacement = {
    transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    naturalBounds: BOUNDS,
  };

  it('η κάτω-αριστερή γωνία της εικόνας κάθεται στην αρχή, το Y ανεβαίνει', () => {
    expect(rasterPixelToScene({ x: 0, y: BOUNDS.height }, identity)).toEqual({ x: 0, y: 0 });
    expect(rasterPixelToScene({ x: 0, y: 0 }, identity)).toEqual({ x: 0, y: BOUNDS.height });
    expect(rasterPixelToScene({ x: 10, y: BOUNDS.height }, identity)).toEqual({ x: 10, y: 0 });
  });

  it('περιστροφή 90°: ο άξονας X της εικόνας γίνεται +Y της σκηνής', () => {
    const rotated: RasterPlacement = { ...identity, transform: { ...identity.transform, rotation: 90 } };
    expectClose(rasterPixelToScene({ x: 100, y: BOUNDS.height }, rotated), { x: 0, y: 100 });
  });

  it('screen-y-down: καμία αναστροφή', () => {
    expect(rasterToSceneAffine(identity, 'screen-y-down')).toEqual(IDENTITY_AFFINE);
  });
});

describe('ADR-929 Δ3 — αντιστροφή', () => {
  it('σκηνή → pixel → σκηνή χωρίς απώλεια', () => {
    const rng = createPrng(17);
    for (let i = 0; i < CASES; i++) {
      const placement: RasterPlacement = { transform: randomTransform(rng), naturalBounds: BOUNDS };
      for (const px of CORNERS_AND_INTERIOR) {
        const back = sceneToRasterPixel(rasterPixelToScene(px, placement), placement);
        expect(back).not.toBeNull();
        expectClose(back as Point2D, px);
      }
    }
  });

  it('εκφυλισμένη τοποθέτηση (scaleX = 0) ⇒ null, ποτέ NaN', () => {
    const flat: RasterPlacement = {
      transform: { translateX: 5, translateY: 5, scaleX: 0, scaleY: 1, rotation: 30 },
      naturalBounds: BOUNDS,
    };
    expect(sceneToRasterPixel({ x: 1, y: 1 }, flat)).toBeNull();
  });

  it('μικρή αλλά έγκυρη κλίμακα (1e-3) ΔΕΝ θεωρείται εκφυλισμένη', () => {
    const tiny: RasterPlacement = {
      transform: { translateX: 0, translateY: 0, scaleX: 1e-3, scaleY: 1e-3, rotation: 0 },
      naturalBounds: BOUNDS,
    };
    expect(sceneToRasterPixel({ x: 1, y: 1 }, tiny)).not.toBeNull();
  });
});
