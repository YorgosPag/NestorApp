/**
 * ADR-344 Phase 3 — Stacked fraction / tolerance layout (\S inline code).
 *
 * Computes Path2D objects and bounding metrics for three stacking styles:
 *   tolerance (^)  — numerator above, denominator below, no separator
 *   diagonal  (/)  — numerator top-left, denominator bottom-right, slash line
 *   horizontal (#) — numerator above, denominator below, horizontal rule
 *
 * Sub-text is rendered at 65 % of the surrounding character height (AutoCAD
 * convention). Paths are built in a local coordinate system (y ↓, origin at
 * top-left of the combined bounding box).
 *
 * @module text-engine/layout/stacking-renderer
 */

import type { Font } from 'opentype.js';
import type { TextStack } from '../types/text-ast.types';
import { measureText } from '../fonts/glyph-renderer';
import { stringToPath2D } from '../fonts/glyph-renderer';

// ── Public types ──────────────────────────────────────────────────────────────

/** Geometry result for one \S stack element. */
export interface StackLayout {
  readonly numeratorPath: Path2D;
  readonly denominatorPath: Path2D;
  /** Horizontal rule or slash, null for tolerance stacks. */
  readonly separatorPath: Path2D | null;
  /** Total advance width of the combined stack in drawing units. */
  readonly width: number;
  /** Total height of the combined stack in drawing units. */
  readonly height: number;
}

// ── Scaling constant ──────────────────────────────────────────────────────────

const STACK_SCALE = 0.65;
const LINE_GAP_FACTOR = 0.08;

// ── Internal builders ─────────────────────────────────────────────────────────

function buildToleranceStack(
  font: Font,
  top: string,
  bottom: string,
  subSize: number,
): StackLayout {
  const nm = measureText(font, top, subSize);
  const dm = measureText(font, bottom, subSize);
  const gap = subSize * LINE_GAP_FACTOR;
  const width = Math.max(nm.width, dm.width);

  const numX = (width - nm.width) / 2;
  const denX = (width - dm.width) / 2;
  const numBaseline = nm.ascent;
  const denBaseline = nm.ascent + nm.descent + gap + dm.ascent;

  return {
    numeratorPath: stringToPath2D(font, top, numX, numBaseline, subSize),
    denominatorPath: stringToPath2D(font, bottom, denX, denBaseline, subSize),
    separatorPath: null,
    width,
    height: denBaseline + dm.descent,
  };
}

function buildHorizontalStack(
  font: Font,
  top: string,
  bottom: string,
  subSize: number,
): StackLayout {
  const nm = measureText(font, top, subSize);
  const dm = measureText(font, bottom, subSize);
  const gap = subSize * LINE_GAP_FACTOR;
  const width = Math.max(nm.width, dm.width);

  const numBaseline = nm.ascent;
  const lineY = nm.ascent + nm.descent + gap / 2;
  const denBaseline = lineY + gap / 2 + dm.ascent;

  const sep = new Path2D();
  sep.moveTo(0, lineY);
  sep.lineTo(width, lineY);

  return {
    numeratorPath: stringToPath2D(font, top, (width - nm.width) / 2, numBaseline, subSize),
    denominatorPath: stringToPath2D(font, bottom, (width - dm.width) / 2, denBaseline, subSize),
    separatorPath: sep,
    width,
    height: denBaseline + dm.descent,
  };
}

function buildDiagonalStack(
  font: Font,
  top: string,
  bottom: string,
  subSize: number,
): StackLayout {
  const nm = measureText(font, top, subSize);
  const dm = measureText(font, bottom, subSize);
  const slashGap = subSize * 0.25;
  const width = nm.width + slashGap + dm.width;

  const numBaseline = nm.ascent;
  const denBaseline = nm.ascent + dm.ascent * 0.5;

  const sep = new Path2D();
  sep.moveTo(nm.width, 0);
  sep.lineTo(nm.width + slashGap, nm.ascent + nm.descent);

  return {
    numeratorPath: stringToPath2D(font, top, 0, numBaseline, subSize),
    denominatorPath: stringToPath2D(font, bottom, nm.width + slashGap, denBaseline, subSize),
    separatorPath: sep,
    width,
    height: nm.ascent + nm.descent,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the Path2D geometry for a `\S` stacked element.
 *
 * `size` is the surrounding character height in drawing units. Sub-text is
 * automatically scaled to 65 % of that height (AutoCAD convention).
 */
export function layoutStack(stack: TextStack, font: Font, size: number): StackLayout {
  const subSize = size * STACK_SCALE;
  switch (stack.type) {
    case 'tolerance': return buildToleranceStack(font, stack.top, stack.bottom, subSize);
    case 'horizontal': return buildHorizontalStack(font, stack.top, stack.bottom, subSize);
    case 'diagonal':   return buildDiagonalStack(font, stack.top, stack.bottom, subSize);
  }
}
