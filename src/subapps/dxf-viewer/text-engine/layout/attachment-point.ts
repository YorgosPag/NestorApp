/**
 * ADR-344 Phase 3 — 9-point attachment grid for MTEXT positioning.
 *
 * resolveAttachmentPoint → absolute (x, y) of the named anchor within a Rect.
 * offsetForJustification → (dx, dy) to add to an insertion point to get the
 *   top-left corner of the text block, so the named anchor lands exactly on
 *   the insertion point.
 *
 * Coordinate system: y increases downward (standard Canvas 2D).
 *
 * @module text-engine/layout/attachment-point
 */

import type { TextJustification } from '../types/text-ast.types';

// ── Shared geometry types (exported for use by text-layout-engine) ─────────────

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

// ── Attachment point resolution ───────────────────────────────────────────────

/**
 * Return the absolute canvas coordinates of the named attachment point
 * within `bounds`.
 *
 * Layout (y ↓):
 *   TL ──── TC ──── TR
 *   │               │
 *   ML ──── MC ──── MR
 *   │               │
 *   BL ──── BC ──── BR
 */
export function resolveAttachmentPoint(
  justification: TextJustification,
  bounds: Rect,
): Point2D {
  const { x, y, width, height } = bounds;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const xr = x + width;
  const yb = y + height;

  switch (justification) {
    case 'TL': return { x, y };
    case 'TC': return { x: cx, y };
    case 'TR': return { x: xr, y };
    case 'ML': return { x, y: cy };
    case 'MC': return { x: cx, y: cy };
    case 'MR': return { x: xr, y: cy };
    case 'BL': return { x, y: yb };
    case 'BC': return { x: cx, y: yb };
    case 'BR': return { x: xr, y: yb };
  }
}

// ── Justification offset ──────────────────────────────────────────────────────

/**
 * Return (dx, dy) to add to an insertion point so the named anchor of the
 * text block lands on that insertion point.
 *
 * Example: justification='MC', bounds={w:100,h:50}
 *   → dx = -50, dy = -25  (shift text left/up so its center is at origin)
 */
export function offsetForJustification(
  justification: TextJustification,
  bounds: Rect,
): { readonly dx: number; readonly dy: number } {
  const { width, height } = bounds;

  switch (justification) {
    case 'TL': return { dx: 0, dy: 0 };
    case 'TC': return { dx: -width / 2, dy: 0 };
    case 'TR': return { dx: -width, dy: 0 };
    case 'ML': return { dx: 0, dy: -height / 2 };
    case 'MC': return { dx: -width / 2, dy: -height / 2 };
    case 'MR': return { dx: -width, dy: -height / 2 };
    case 'BL': return { dx: 0, dy: -height };
    case 'BC': return { dx: -width / 2, dy: -height };
    case 'BR': return { dx: -width, dy: -height };
  }
}
