/**
 * ADR-570 Φ1b — «Στυλ Γραμμής» thumbnail generator για τα ribbon combobox previews.
 *
 * Ένα named LineStyle preview (Revit/Figma-grade swatch) συνδυάζει ΤΡΙΑ πράγματα:
 *   - το dash μοτίβο του linetype  → **reuse** του Unified Linetype SSoT
 *     (`buildLinetypeThumbnail`), μηδέν δεύτερη dash math·
 *   - το πάχος (lineweight, mm)     → σταθερό mm→px map για το fixed-size thumb·
 *   - το χρώμα πένας (penColor)     → hex, ή `null` για ByLayer ώστε ο caller να
 *     ζωγραφίσει `currentColor` (theme-correct, μηδέν hardcoded — N.3).
 *
 * ΩΣ ΚΑΘΑΡΑ ΔΕΔΟΜΕΝΑ — το component (`RibbonComboboxThumbnail`) τα ζωγραφίζει σε
 * inline `<svg>`. Σταθερά ανά (pattern|lw|color|w|h) → memoize.
 *
 * @see rendering/linetype-thumbnail.ts (dash SSoT — ίδιο με τον renderer)
 * @see ../../ui/ribbon/components/buttons/RibbonComboboxThumbnail.tsx (ζωγραφίζει το descriptor)
 */

import {
  buildLinetypeThumbnail,
  DEFAULT_LINETYPE_THUMB_WIDTH,
  DEFAULT_LINETYPE_THUMB_HEIGHT,
} from '../../rendering/linetype-thumbnail';
import { LINE_STYLE_BYLAYER_LWT, LINE_STYLE_BYLAYER_PEN } from './line-style-types';

export interface LineStyleThumbnail {
  readonly width: number;
  readonly height: number;
  /** SVG `stroke-dasharray` σε px (κενό = solid) — από το linetype SSoT. */
  readonly dash: readonly number[];
  /** Πάχος γραμμής σε px (fixed-size preview), παραγόμενο από το lineweight (mm). */
  readonly strokeWidth: number;
  /** Hex χρώμα πένας, ή `null` για ByLayer → ο caller ζωγραφίζει `currentColor`. */
  readonly color: string | null;
}

/** Στενό εύρος px ώστε η διαφορά πάχους να διακρίνεται σε thumb ύψους ~14px. */
const MIN_STROKE_PX = 0.75;
const MAX_STROKE_PX = 3;
/** ByLayer/άγνωστο πάχος → ίδιο default με το linetype thumb (οπτική συνέπεια). */
const DEFAULT_STROKE_PX = 1.25;
/** mm → px κλίση για το fixed-size thumbnail (0.5mm ≈ 1.5px, 2mm ≈ clamp 3px). */
const MM_TO_THUMB_PX = 1.5;

/** Lineweight (mm) → px πάχος για το preview. ByLayer (-2) → default. */
function strokeWidthPx(lineweightMm: number): number {
  if (lineweightMm === LINE_STYLE_BYLAYER_LWT || lineweightMm < 0) return DEFAULT_STROKE_PX;
  const px = MIN_STROKE_PX + lineweightMm * MM_TO_THUMB_PX;
  return Math.max(MIN_STROKE_PX, Math.min(MAX_STROKE_PX, px));
}

const cache = new Map<string, LineStyleThumbnail>();

/**
 * Thumbnail δεδομένα ενός line-style (memoized). Το dash έρχεται από το linetype
 * SSoT· solid/ByLayer pattern → `dash: []` (ο caller ζωγραφίζει συνεχή γραμμή).
 */
export function buildLineStyleThumbnail(
  pattern: string,
  lineweight: number,
  penColor: string,
  width: number = DEFAULT_LINETYPE_THUMB_WIDTH,
  height: number = DEFAULT_LINETYPE_THUMB_HEIGHT,
): LineStyleThumbnail {
  const key = `${pattern}|${lineweight}|${penColor}|${width}|${height}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const { dash } = buildLinetypeThumbnail(pattern, width, height);
  const result: LineStyleThumbnail = {
    width,
    height,
    dash,
    strokeWidth: strokeWidthPx(lineweight),
    color: penColor === LINE_STYLE_BYLAYER_PEN ? null : penColor,
  };
  cache.set(key, result);
  return result;
}
