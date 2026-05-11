/**
 * ADR-344 Phase 3 — Multi-column layout (R2007+ MTEXT columns).
 *
 * Static columns: paragraphs distributed contiguously across N columns
 *   (first ⌈len/N⌉ → col 0, next → col 1, …).
 *
 * Dynamic columns: paragraphs fill each column top-to-bottom until the
 *   target height (totalContentHeight / count) is reached, then overflow
 *   to the next column. A paragraph that alone exceeds the target height
 *   occupies a full column regardless.
 *
 * @module text-engine/layout/column-layout
 */

import type { FormattedParagraph } from './paragraph-formatter';

// ── Public types ──────────────────────────────────────────────────────────────

/** Column configuration extracted from the DxfTextNode.columns field. */
export interface ColumnConfig {
  readonly type: 'static' | 'dynamic';
  readonly count: number;
  /** Width of each column in drawing units. */
  readonly width: number;
  /** Gutter (gap between columns) in drawing units. */
  readonly gutter: number;
}

/** One rendered column with its paragraphs and top-left position. */
export interface ColumnEntry {
  readonly paragraphs: FormattedParagraph[];
  /** X position (left edge) of this column in the text-block's local space. */
  readonly x: number;
  /** Y position (top edge) of this column in the text-block's local space. */
  readonly y: number;
}

/** Result of the column layout pass. */
export interface ColumnLayout {
  readonly columns: ColumnEntry[];
  /** Total width including all columns and gutters. */
  readonly totalWidth: number;
  /** Tallest column height. */
  readonly totalHeight: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function columnHeight(col: FormattedParagraph[]): number {
  return col.reduce((h, p) => h + p.totalHeight, 0);
}

function columnX(index: number, config: ColumnConfig): number {
  return index * (config.width + config.gutter);
}

function makeEntry(paragraphs: FormattedParagraph[], index: number, config: ColumnConfig): ColumnEntry {
  return { paragraphs, x: columnX(index, config), y: 0 };
}

function contiguousSlices(items: FormattedParagraph[], count: number): FormattedParagraph[][] {
  if (count <= 0) return [items];
  const size = Math.ceil(items.length / count);
  const result: FormattedParagraph[][] = [];
  for (let i = 0; i < count; i++) {
    result.push(items.slice(i * size, (i + 1) * size));
  }
  return result;
}

function layoutStaticColumns(paragraphs: FormattedParagraph[], config: ColumnConfig): ColumnLayout {
  const slices = contiguousSlices(paragraphs, config.count);
  const columns = slices.map((slice, i) => makeEntry(slice, i, config));
  const totalWidth = config.count * config.width + Math.max(0, config.count - 1) * config.gutter;
  const totalHeight = Math.max(0, ...columns.map(c => columnHeight(c.paragraphs)));
  return { columns, totalWidth, totalHeight };
}

function layoutDynamicColumns(paragraphs: FormattedParagraph[], config: ColumnConfig): ColumnLayout {
  const totalContentHeight = paragraphs.reduce((h, p) => h + p.totalHeight, 0);
  const targetHeight = totalContentHeight / Math.max(1, config.count);

  const columns: ColumnEntry[] = [];
  let currentBucket: FormattedParagraph[] = [];
  let currentHeight = 0;

  for (const para of paragraphs) {
    const wouldExceed = currentHeight + para.totalHeight > targetHeight && currentBucket.length > 0;
    if (wouldExceed) {
      columns.push(makeEntry(currentBucket, columns.length, config));
      currentBucket = [];
      currentHeight = 0;
    }
    currentBucket.push(para);
    currentHeight += para.totalHeight;
  }

  if (currentBucket.length > 0) {
    columns.push(makeEntry(currentBucket, columns.length, config));
  }

  const totalWidth = config.count * config.width + Math.max(0, config.count - 1) * config.gutter;
  const totalHeight = Math.max(0, ...columns.map(c => columnHeight(c.paragraphs)));
  return { columns, totalWidth, totalHeight };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Arrange formatted paragraphs into a multi-column layout.
 *
 * For `static` columns, paragraphs are distributed contiguously.
 * For `dynamic` columns, each column fills to ≈ totalHeight/count.
 */
export function layoutColumns(
  paragraphs: FormattedParagraph[],
  config: ColumnConfig,
): ColumnLayout {
  return config.type === 'static'
    ? layoutStaticColumns(paragraphs, config)
    : layoutDynamicColumns(paragraphs, config);
}
