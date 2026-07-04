/**
 * ADR-562 Φ8 — Arrowhead thumbnail generator για τα ribbon combobox previews.
 *
 * Παράγει τα δεδομένα ενός μικρού preview κεφαλής βέλους (AutoCAD DIMSTYLE
 * arrowhead icon / Revit) ΩΣ ΚΑΘΑΡΑ ΔΕΔΟΜΕΝΑ: normalized SVG primitives σε ένα
 * τετράγωνο viewBox. Το component (`RibbonComboboxThumbnail`) τα ζωγραφίζει σε
 * inline `<svg>` με `stroke`/`fill="currentColor"` (theme-correct, N.3).
 *
 * **FULL SSoT:** η γεωμετρία προέρχεται από το ΙΔΙΟ `ARROWHEAD_BLOCKS` unit-space
 * SSoT (apex `[0,0]`, σώμα κυρίως x∈[-1,0]) που τρέφει τον canvas renderer —
 * μηδέν δεύτερη arrow math. Σταθερά → memoize ανά `name|size`.
 *
 * @see systems/dimensions/dim-arrowhead-blocks.ts (ARROWHEAD_BLOCKS — geometry SSoT)
 * @see bim/hatch/hatch-pattern-thumbnail.ts (το πρότυπο pattern-thumbnail builder)
 */

import { getArrowheadBlock } from './dim-arrowhead-blocks';

export type ArrowheadThumbPrimitive =
  | { readonly kind: 'line'; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
  | { readonly kind: 'polygon'; readonly points: ReadonlyArray<readonly [number, number]>; readonly solid: boolean }
  | { readonly kind: 'circle'; readonly cx: number; readonly cy: number; readonly r: number; readonly solid: boolean };

export interface ArrowheadThumbnail {
  /** Πλευρά του τετράγωνου viewBox (px). */
  readonly size: number;
  readonly primitives: readonly ArrowheadThumbPrimitive[];
}

export const DEFAULT_ARROWHEAD_THUMB_SIZE = 20;
/** Περιθώριο (px) γύρω από τη γεωμετρία μέσα στο viewBox. */
const PADDING = 2;

const cache = new Map<string, ArrowheadThumbnail>();

/**
 * Thumbnail δεδομένα ενός arrowhead block (memoized). Κενή γεωμετρία (π.χ. `none`)
 * → `primitives: []` (ο caller δείχνει κενό).
 */
export function buildArrowheadThumbnail(
  name: string,
  size: number = DEFAULT_ARROWHEAD_THUMB_SIZE,
): ArrowheadThumbnail {
  const key = `${name}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const geometry = getArrowheadBlock(name).geometry;
  if (geometry.length === 0) {
    const empty: ArrowheadThumbnail = { size, primitives: [] };
    cache.set(key, empty);
    return empty;
  }

  // Bounding box σε ΟΛΑ τα σημεία (οι κύκλοι επεκτείνονται κατά radius).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x: number, y: number): void => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const p of geometry) {
    if (p.kind === 'line') {
      acc(p.from[0], p.from[1]);
      acc(p.to[0], p.to[1]);
    } else if (p.kind === 'triangle') {
      acc(p.v1[0], p.v1[1]);
      acc(p.v2[0], p.v2[1]);
      acc(p.v3[0], p.v3[1]);
    } else {
      acc(p.center[0] - p.radius, p.center[1] - p.radius);
      acc(p.center[0] + p.radius, p.center[1] + p.radius);
    }
  }

  const bboxW = maxX - minX || 1;
  const bboxH = maxY - minY || 1;
  // Uniform scale (χωρίς παραμόρφωση), centered· flip Y (SVG: y προς τα κάτω).
  const scale = (size - 2 * PADDING) / Math.max(bboxW, bboxH);
  const offX = (size - bboxW * scale) / 2;
  const offY = (size - bboxH * scale) / 2;
  const mapX = (x: number): number => offX + (x - minX) * scale;
  const mapY = (y: number): number => size - (offY + (y - minY) * scale);

  const primitives: ArrowheadThumbPrimitive[] = geometry.map((p): ArrowheadThumbPrimitive => {
    if (p.kind === 'line') {
      return { kind: 'line', x1: mapX(p.from[0]), y1: mapY(p.from[1]), x2: mapX(p.to[0]), y2: mapY(p.to[1]) };
    }
    if (p.kind === 'triangle') {
      return {
        kind: 'polygon',
        points: [
          [mapX(p.v1[0]), mapY(p.v1[1])],
          [mapX(p.v2[0]), mapY(p.v2[1])],
          [mapX(p.v3[0]), mapY(p.v3[1])],
        ],
        solid: p.solid,
      };
    }
    return { kind: 'circle', cx: mapX(p.center[0]), cy: mapY(p.center[1]), r: p.radius * scale, solid: p.solid };
  });

  const result: ArrowheadThumbnail = { size, primitives };
  cache.set(key, result);
  return result;
}
