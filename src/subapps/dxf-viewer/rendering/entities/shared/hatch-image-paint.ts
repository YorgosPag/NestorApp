/**
 * SSoT — hatch image paint (ADR-643 Φ1).
 *
 * Pure 2D paint helpers για το γέμισμα μιας γραμμοσκίασης με ΕΙΚΟΝΑ υλικού (μοντέλο
 * ArchiCAD «Image Fill»). Η εικόνα ζωγραφίζεται ως tiled `CanvasPattern` κομμένο στο
 * boundary (even-odd → νησίδες = τρύπες), με κλίμακα δεμένη στην ΠΡΑΓΜΑΤΙΚΗ διάσταση
 * tile (mm) → σωστό μέγεθος πλακιδίου σε κάθε zoom (Revit/ArchiCAD standard).
 *
 * Μοιράζεται (όπως το αδελφό `hatch-gradient-paint.ts`) από τον committed `HatchRenderer`
 * και μπορεί να τραφεί το live grip-drag ghost → preview === commit, μηδέν δεύτερη math.
 *
 * Το {@link fillHatchPattern} είναι **ΓΕΝΙΚΟ**: ΕΝΑ μονοπάτι «γέμισε boundary με
 * transformed CanvasPattern», κοινό για image fill (ADR-643) ΚΑΙ screen-raster hatch
 * (ADR-531) → μηδέν sibling clone (N.12/N.18).
 *
 * DOM-lite: χτίζει καθαρή `DOMMatrix` math· το image loading/cache ζει στο
 * `hatch-image-cache.ts`. Το {@link averageImageColor} αγγίζει offscreen 1×1 canvas.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D } from '../../types/Types';
import type { HatchImageFill } from '../../../types/entities';
import { hatchBounds } from '../../../bim/hatch/hatch-grips';
import { traceHatchBoundary, type ToScreen } from './hatch-gradient-paint';

/** Intrinsic pixel μέγεθος μιας decoded εικόνας (HTMLImageElement / ImageBitmap / canvas). */
function imageIntrinsicSize(img: CanvasImageSource): { w: number; h: number } {
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return { w: img.naturalWidth, h: img.naturalHeight };
  }
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
    return { w: img.width, h: img.height };
  }
  const sized = img as { width?: number; height?: number };
  return { w: sized.width ?? 0, h: sized.height ?? 0 };
}

/**
 * Σημείο αγκύρωσης (phase) του tiling: ρητό `origin`, αλλιώς κάτω-αριστερή γωνία του
 * bbox (SSoT `hatchBounds`) → σταθερή φάση όσο μετακινείται το view (το μοτίβο
 * «κουμπώνει» στη γεωμετρία, δεν σέρνεται). `null` αν το bbox είναι degenerate.
 */
export function resolveImageFillOrigin(
  paths: ReadonlyArray<ReadonlyArray<Point2D>>,
  imageFill: HatchImageFill,
): Point2D | null {
  if (imageFill.origin) return imageFill.origin;
  const b = hatchBounds(paths);
  if (!b) return null;
  return { x: b.minX, y: b.minY };
}

/**
 * World-space tile matrix: κλιμακώνει το tile ώστε `tileWidth/Height`(mm) → σωστά
 * pixels στο τρέχον zoom (`scale` = px ανά world unit), + rotation `angle`, + anchor
 * στο screen position του origin. Ίδιο idiom με το screen-raster `setTransform`, αλλά
 * WORLD-space scale αντί σταθερού screen-px. `null` αν λείπει DOMMatrix ή degenerate image.
 */
export function computeImageTileMatrix(
  img: CanvasImageSource,
  imageFill: HatchImageFill,
  originScreen: Point2D,
  scale: number,
): DOMMatrix | null {
  if (typeof DOMMatrix !== 'function') return null;
  const { w, h } = imageIntrinsicSize(img);
  if (w <= 0 || h <= 0) return null;
  const sx = (imageFill.tileWidth * scale) / w;
  const sy = ((imageFill.tileHeight || imageFill.tileWidth) * scale) / h;
  if (sx <= 0 || sy <= 0) return null;
  return new DOMMatrix()
    .translateSelf(originScreen.x, originScreen.y)
    .rotateSelf(imageFill.angle ?? 0)
    .scaleSelf(sx, sy);
}

/**
 * ΓΕΝΙΚΟ SSoT — γεμίζει το boundary (even-odd) με ένα (προαιρετικά transformed)
 * `CanvasPattern`. Κοινό μονοπάτι για image fill (ADR-643) ΚΑΙ screen-raster hatch
 * (ADR-531) → μηδέν διπλή «fill boundary with pattern» υλοποίηση. Pure: ο caller
 * προ-ρυθμίζει alpha εφόσον χρειάζεται (το save/restore κρατά το fillStyle τοπικό).
 */
export function fillHatchPattern(
  ctx: CanvasRenderingContext2D,
  paths: ReadonlyArray<ReadonlyArray<Point2D>>,
  pattern: CanvasPattern,
  matrix: DOMMatrix | null,
  toScreen: ToScreen,
): void {
  if (matrix && typeof pattern.setTransform === 'function') pattern.setTransform(matrix);
  ctx.save();
  ctx.fillStyle = pattern;
  traceHatchBoundary(ctx, paths, toScreen);
  ctx.fill('evenodd');
  ctx.restore();
}

/**
 * Μέσο χρώμα μιας εικόνας (offscreen 1×1 downsample) — για το density-LOD tint fallback
 * (zoom-out). `null` σε αποτυχία ή cross-origin taint (SecurityError) → ο caller πέφτει
 * στο hatch color.
 */
export function averageImageColor(img: CanvasImageSource): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const cx = canvas.getContext('2d');
  if (!cx) return null;
  try {
    cx.drawImage(img, 0, 0, 1, 1);
    const [r, g, b] = cx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return null;
  }
}
