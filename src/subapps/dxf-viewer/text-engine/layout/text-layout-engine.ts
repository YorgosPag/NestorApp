/**
 * ADR-344 Phase 3 — Layout engine orchestrator.
 *
 * layoutTextNode: runs the full layout pipeline for one DxfTextNode:
 *   1. format each paragraph (line-breaking, metrics)
 *   2. arrange into columns if present (R2007+)
 *   3. compute the world-space bounding box
 *   4. resolve the attachment-point offset
 *
 * getBoundingBox: thin wrapper that returns just the Rect — consumed by
 *   MissingFontHighlightLeaf (Phase 2) and TextSnapProvider (Phase 6).
 *
 * @module text-engine/layout/text-layout-engine
 */

import type { Font } from 'opentype.js';
import type { DxfTextNode } from '../types/text-ast.types';
import { DxfDocumentVersion, versionAtLeast } from '../types/text-toolbar.types';
import { formatParagraph, type FormattedParagraph, type ParagraphOptions } from './paragraph-formatter';
import { layoutColumns, type ColumnLayout, type ColumnConfig } from './column-layout';
import { offsetForJustification, type Rect, type Point2D } from './attachment-point';

// ── Public types ──────────────────────────────────────────────────────────────

/** Options for one layout pass. */
export interface TextLayoutOptions {
  /** DXF-space insertion point (group codes 10/20/30). */
  readonly insertionPoint: Point2D;
  /** MTEXT frame width in drawing units (group code 41). */
  readonly maxWidth: number;
  /** Base font size in drawing units (used when a run's height is 0). */
  readonly fontSize: number;
  /** Parsed font for glyph measurements. */
  readonly font: Font;
  /** Source DXF document version — gates R2007+ column support. */
  readonly version: DxfDocumentVersion;
}

/** Full layout result for one DxfTextNode. */
export interface TextLayout {
  readonly paragraphs: FormattedParagraph[];
  /** World-space bounding box of the entire text block. */
  readonly boundingBox: Rect;
  /** Offset (dx, dy) from insertion point to top-left of bounding box. */
  readonly attachmentOffset: { readonly dx: number; readonly dy: number };
  readonly columns?: ColumnLayout;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildParagraphOptions(node: DxfTextNode, opts: TextLayoutOptions): ParagraphOptions {
  return {
    maxWidth: opts.maxWidth,
    indent: 0,
    tabs: [],
    lineSpacing: node.lineSpacing.mode,
    lineSpacingFactor: node.lineSpacing.factor,
    font: opts.font,
  };
}

function columnsEnabled(node: DxfTextNode, version: DxfDocumentVersion): boolean {
  return (
    node.columns !== undefined &&
    node.columns.count > 1 &&
    versionAtLeast(version, DxfDocumentVersion.R2007)
  );
}

function toColumnConfig(node: DxfTextNode): ColumnConfig {
  const c = node.columns!;
  return { type: c.type, count: c.count, width: c.width, gutter: c.gutter };
}

function computeDimensions(
  paras: FormattedParagraph[],
  colLayout: ColumnLayout | undefined,
  maxWidth: number,
): { width: number; height: number } {
  if (colLayout) {
    return { width: colLayout.totalWidth, height: colLayout.totalHeight };
  }
  const height = paras.reduce((h, p) => h + p.totalHeight, 0);
  return { width: maxWidth, height };
}

function buildBoundingBox(
  insertionPoint: Point2D,
  dims: { width: number; height: number },
  offset: { dx: number; dy: number },
): Rect {
  return {
    x: insertionPoint.x + offset.dx,
    y: insertionPoint.y + offset.dy,
    width: dims.width,
    height: dims.height,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run the full layout pipeline for a single DxfTextNode.
 *
 * Returns world-space bounding box (usable by MissingFontHighlightLeaf,
 * TextSnapProvider) plus per-paragraph line data for the renderer.
 */
export function layoutTextNode(node: DxfTextNode, opts: TextLayoutOptions): TextLayout {
  const paraOpts = buildParagraphOptions(node, opts);
  const paragraphs = node.paragraphs.map(p => formatParagraph(p, paraOpts));

  const colLayout = columnsEnabled(node, opts.version)
    ? layoutColumns(paragraphs, toColumnConfig(node))
    : undefined;

  const dims = computeDimensions(paragraphs, colLayout, opts.maxWidth);
  const tempBounds: Rect = { x: 0, y: 0, width: dims.width, height: dims.height };
  const offset = offsetForJustification(node.attachment, tempBounds);
  const boundingBox = buildBoundingBox(opts.insertionPoint, dims, offset);

  return {
    paragraphs,
    boundingBox,
    attachmentOffset: offset,
    ...(colLayout ? { columns: colLayout } : {}),
  };
}

/**
 * Return just the world-space bounding box for `node`.
 * Consumed by MissingFontHighlightLeaf and TextSnapProvider.
 */
export function getBoundingBox(node: DxfTextNode, opts: TextLayoutOptions): Rect {
  return layoutTextNode(node, opts).boundingBox;
}
