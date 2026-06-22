/**
 * SSoT — hatch gradient paint (ADR-507 Φ5 / A3).
 *
 * Pure 2D paint helpers για το gradient γέμισμα μιας γραμμοσκίασης, εξαγμένα από
 * το `HatchRenderer.fillGradient` ώστε να τα μοιράζονται:
 *   - ο committed renderer (`HatchRenderer.render` → `fillGradient`)
 *   - το live grip-drag ghost (`draw-ghost-entity` → `case 'hatch'`)
 *
 * Έτσι το ghost κατά το drag της gradient-origin λαβής δείχνει **ακριβώς** το ίδιο
 * γέμισμα με το release — μηδέν δεύτερη gradient math (preview === commit). Ίδιο
 * SSoT idiom με τα `drawColumnRebar2D` / `drawBeamRebar2D` (pure paint, ghost +
 * committed pass).
 *
 * Το `worldToScreen` (`BaseEntityRenderer.worldToScreen`) είναι ταυτόσημο με το
 * `CoordinateTransforms.worldToScreen` που χρησιμοποιεί το ghost (`toScreen`),
 * οπότε ο helper είναι context-agnostic — δέχεται τον mapper + το `scale` ρητά.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §2.3, Φ5 A3
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D } from '../../types/Types';
import {
  resolveGradientStops, isRadialGradientType, normalizeGradientShift, type HatchGradient,
} from '../../../bim/hatch/hatch-gradient';
import { hatchBounds } from '../../../bim/hatch/hatch-grips';
import { degToRad } from './geometry-angle-utils';

/** Συνάρτηση προβολής world → screen (ίδιο contract με `CoordinateTransforms.worldToScreen`). */
export type ToScreen = (p: Point2D) => Point2D;

/** Παράμετροι του gradient paint (transform δίνεται ρητά → context-agnostic). */
export interface HatchGradientPaintContext {
  /** Seed/origin (ADR-507 Φ5 A3) — patternOrigin όταν υπάρχει, αλλιώς κέντρο bbox. */
  readonly origin?: Point2D;
  /** world → screen mapper (live transform). */
  readonly toScreen: ToScreen;
  /** Τρέχον zoom scale (px ανά world unit) — για το radial screen radius. */
  readonly scale: number;
}

/**
 * Χτίζει ΕΝΑ canvas path με ΟΛΑ τα boundary paths ως subpaths (για even-odd fill).
 * Pure SSoT: μοιράζεται από fill (gradient/solid/LOD) + outline stroke.
 */
export function traceHatchBoundary(
  ctx: CanvasRenderingContext2D,
  paths: ReadonlyArray<ReadonlyArray<Point2D>>,
  toScreen: ToScreen,
): void {
  ctx.beginPath();
  for (const path of paths) {
    if (path.length < 2) continue;
    const first = toScreen({ x: path[0].x, y: path[0].y });
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < path.length; i += 1) {
      const s = toScreen({ x: path[i].x, y: path[i].y });
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
  }
}

/**
 * Γέμισμα gradient (ADR-507 Φ5). Χτίζει `CanvasGradient` σε screen space: linear κατά
 * τη γωνία (world, μέσω 2 `toScreen` endpoints — το uniform transform διατηρεί τη
 * γραμμικότητα)· radial από το κέντρο. Stops μέσω του SSoT `resolveGradientStops`.
 * even-odd → νησίδες μένουν κενές (όπως solid). Pure: ο caller προ-ρυθμίζει alpha.
 */
export function fillHatchGradient(
  ctx: CanvasRenderingContext2D,
  paths: ReadonlyArray<ReadonlyArray<Point2D>>,
  gradient: HatchGradient,
  context: HatchGradientPaintContext,
): void {
  const { origin, toScreen, scale } = context;
  // SSoT bbox (κοινό με το gradient-origin grip default).
  const b = hatchBounds(paths);
  if (!b || b.maxX <= b.minX || b.maxY <= b.minY) return;
  // origin (seed, ADR-507 Φ5 A3) = το patternOrigin όταν υπάρχει, αλλιώς κέντρο bbox.
  const cx = origin?.x ?? (b.minX + b.maxX) / 2;
  const cy = origin?.y ?? (b.minY + b.maxY) / 2;
  const w = b.maxX - b.minX; const h = b.maxY - b.minY;

  // shift (DXF 461) → μετατοπίζει τη γεωμετρία κατά τον άξονα της γωνίας (όχι τα
  // stops → μηδέν degenerate offset). 0=centered· →1 το 1ο χρώμα κυριαρχεί.
  const shiftN = normalizeGradientShift(gradient.shift);
  const r = degToRad(gradient.angleDeg ?? 0);
  const dx = Math.cos(r); const dy = Math.sin(r);

  let grad: CanvasGradient;
  if (isRadialGradientType(gradient.type)) {
    const rWorld = 0.5 * Math.hypot(w, h);
    // shift → μετακινεί το «κέντρο φωτισμού» εκτός κέντρου κατά τη γωνία.
    const c = toScreen({ x: cx + dx * shiftN * rWorld, y: cy + dy * shiftN * rWorld });
    const rScreen = Math.max(1, rWorld * scale);
    grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rScreen);
  } else {
    const half = 0.5 * (Math.abs(w * dx) + Math.abs(h * dy)) || 0.5 * Math.hypot(w, h);
    // shift → «γλιστράει» τον άξονα κατά shiftN*half· το CanvasGradient κάνει
    // clamp στα άκρα → το 1ο χρώμα γεμίζει περισσότερο το bbox.
    const s = shiftN * half;
    const p0 = toScreen({ x: cx - dx * half + dx * s, y: cy - dy * half + dy * s });
    const p1 = toScreen({ x: cx + dx * half + dx * s, y: cy + dy * half + dy * s });
    grad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
  }
  for (const stop of resolveGradientStops(gradient)) grad.addColorStop(stop.offset, stop.color);

  ctx.fillStyle = grad;
  traceHatchBoundary(ctx, paths, toScreen);
  ctx.fill('evenodd');
}
