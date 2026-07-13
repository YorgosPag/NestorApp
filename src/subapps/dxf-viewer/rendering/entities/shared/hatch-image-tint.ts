/**
 * SSoT — hatch image duotone tint (ADR-653 Φ8).
 *
 * Επαναχρωματίζει μια decoded εικόνα υλικού σε **duotone**: φωτεινότητα κάθε pixel
 * (`luminance601`, ίδιο SSoT με το print path) → γραμμική ράμπα `colorA`(σκούρο) →
 * `colorB`(φωτεινό), μετά mix με το πρωτότυπο pixel κατά `strength`. Παράγει ΕΝΑ
 * offscreen `HTMLCanvasElement` στο intrinsic μέγεθος της εικόνας → ισοδύναμο
 * `CanvasImageSource` με το `<img>`, οπότε το ADR-643 render path (`computeImageTileMatrix`
 * → `fillHatchPattern` → `drawImageGrout`) το δέχεται **αυτούσιο** (μηδέν αλλαγή math).
 *
 * Καλείται **μία φορά ανά variant key** μέσα στο `HatchImageCache` (μετά το decode) —
 * ΠΟΤΕ per-frame (ADR-040). Alpha κανάλι διατηρείται (transparent PNG υλικά).
 *
 * Χρωματικό math: reuse `parseHex`/`luminance601`/`clamp01` (color-math SSoT, N.12).
 * Το per-pixel channel lerp είναι σκέτη αριθμητική (όχι hex-color μηχανισμός) → inline
 * στον hot loop (το `mixHex` θα alloc-άρε string ανά pixel — απαράδεκτο).
 *
 * @see ../../../config/color-math.ts — parseHex / luminance601 (SSoT)
 * @see ./hatch-image-variant-key.ts — το κλειδί που διαφοροποιεί tinted εκδοχές
 * @see docs/centralized-systems/reference/adrs/ADR-653-editable-and-procedural-hatch-materials.md §3.1
 */

import type { HatchImageTint } from '../../../types/entities';
import { parseHex, luminance601, type Rgb } from '../../../config/color-math';
import { clamp01 } from '../../../utils/scalar-math';
import { imageIntrinsicSize } from './image-intrinsic-size';

/** Γραμμική παρεμβολή ενός καναλιού (0..255) — σκέτη αριθμητική, hot-loop safe. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Duotone recolor: επιστρέφει νέο offscreen canvas ή `null` όταν αδύνατο (invalid hex,
 * degenerate μέγεθος, χωρίς 2D context, ή cross-origin taint στο `getImageData`). Ο
 * caller πέφτει στην ανέγγιχτη εικόνα σε `null`.
 */
export function applyDuotoneTint(
  img: CanvasImageSource,
  tint: HatchImageTint,
): HTMLCanvasElement | null {
  const a: Rgb | null = parseHex(tint.colorA);
  const b: Rgb | null = parseHex(tint.colorB);
  if (!a || !b) return null;
  const { w, h } = imageIntrinsicSize(img);
  if (w <= 0 || h <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, w, h);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return null; // cross-origin taint
  }

  const px = data.data;
  const s = clamp01(tint.strength);
  for (let i = 0; i < px.length; i += 4) {
    const r0 = px[i], g0 = px[i + 1], b0 = px[i + 2];
    // Φωτεινότητα → θέση στη ράμπα colorA→colorB.
    const l = luminance601({ r: r0, g: g0, b: b0 });
    const dr = lerp(a.r, b.r, l);
    const dg = lerp(a.g, b.g, l);
    const db = lerp(a.b, b.b, l);
    // Mix duotone με το πρωτότυπο κατά strength.
    px[i] = lerp(r0, dr, s);
    px[i + 1] = lerp(g0, dg, s);
    px[i + 2] = lerp(b0, db, s);
    // px[i+3] (alpha) αμετάβλητο.
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}
