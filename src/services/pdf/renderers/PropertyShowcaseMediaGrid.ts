/**
 * =============================================================================
 * Property Showcase PDF — media grid primitives (ADR-312)
 * =============================================================================
 *
 * The photo grid and the floorplan grid share almost identical geometry
 * (N-column × M-row layout, fixed aspect, `addImage` fallback to a grey rect
 * on failure, diagnostic logging) so they ship as a single SSoT helper here.
 * `PropertyShowcaseRenderer` consumes this for both:
 *   - Photos page: 3×2 grid, 4:3 cells.
 *   - Floorplans page: 2×2 grid, 3:2 cells (larger — plans need legibility
 *     more than density).
 *
 * Extracted from `PropertyShowcaseRenderer.ts` to keep it under the Google
 * 500-LOC SRP ceiling (CLAUDE.md N.7.1).
 *
 * @module services/pdf/renderers/PropertyShowcaseMediaGrid
 */

import type { IPDFDoc, Margins } from '../contracts';
import type { ShowcasePhotoAsset } from './PropertyShowcaseRenderer';
import { COLORS, FONT_SIZES, FONT_STYLES, FONTS } from '../layout';

export interface MediaGridConfig {
  cols: number;
  gap: number;
  aspect: number;
  assetKind: 'photo' | 'floorplan';
}

export interface DrawMediaGridArgs {
  doc: IPDFDoc;
  margins: Margins;
  pageWidth: number;
  contentWidth: number;
  assets: ShowcasePhotoAsset[];
  sectionTitle: string;
  drawSectionTitle: (
    doc: IPDFDoc, y: number, margins: Margins, pageWidth: number,
    contentWidth: number, text: string
  ) => number;
  config: MediaGridConfig;
}

export const PHOTO_GRID_CONFIG: MediaGridConfig = {
  cols: 3,
  gap: 4,
  aspect: 0.75,
  assetKind: 'photo',
};

export const FLOORPLAN_GRID_CONFIG: MediaGridConfig = {
  cols: 2,
  gap: 6,
  aspect: 2 / 3,
  assetKind: 'floorplan',
};

export function drawMediaGridPage(args: DrawMediaGridArgs): void {
  const { doc, margins, pageWidth, contentWidth, assets, sectionTitle, drawSectionTitle, config } = args;
  if (assets.length === 0) {
    console.info(`[PropertyShowcaseRenderer] ${config.assetKind} grid skipped — no assets`);
    return;
  }

  console.info(`[PropertyShowcaseRenderer] ${config.assetKind} grid`, {
    count: assets.length,
    totalBytes: assets.reduce((sum, a) => sum + a.bytes.byteLength, 0),
    formats: assets.map((a) => a.format),
  });

  doc.addPage();
  let y = margins.top;
  y = drawSectionTitle(doc, y, margins, pageWidth, contentWidth, sectionTitle);
  y += 4;

  const cellWidth = (contentWidth - config.gap * (config.cols - 1)) / config.cols;
  const cellHeight = cellWidth * config.aspect;
  // Reserved vertical space under each cell for the displayName caption.
  // Mirrors the web <figcaption> under every photo/floorplan tile so the PDF
  // reads the same as ShowcasePhotoGrid.tsx / ShowcaseFloorplans.tsx.
  const captionHeight = 5;
  const pageHeight = doc.pageSize.height;
  const maxBottom = pageHeight - margins.bottom - 10;

  let col = 0;
  let rowY = y;

  for (const asset of assets) {
    const x = margins.left + col * (cellWidth + config.gap);
    if (rowY + cellHeight + captionHeight > maxBottom) break;
    try {
      doc.addImage(asset.bytes, asset.format, x, rowY, cellWidth, cellHeight, asset.id, 'FAST');
    } catch (err) {
      console.error(`[PropertyShowcaseRenderer] ${config.assetKind} addImage failed`, {
        assetId: asset.id,
        format: asset.format,
        bytesLen: asset.bytes.byteLength,
        magic: Array.from(asset.bytes.slice(0, 8))
          .map((b) => b.toString(16).padStart(2, '0')).join(' '),
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      doc.setDrawColor(...COLORS.GRAY);
      doc.rect(x, rowY, cellWidth, cellHeight, 'S');
    }

    if (asset.displayName) {
      drawAssetCaption(doc, asset.displayName, x, rowY + cellHeight + 3, cellWidth);
    }

    col += 1;
    if (col >= config.cols) {
      col = 0;
      rowY += cellHeight + captionHeight + config.gap;
    }
  }
}

function drawAssetCaption(
  doc: IPDFDoc,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  doc.setFont(FONTS.UNICODE, FONT_STYLES.NORMAL);
  doc.setFontSize(FONT_SIZES.SMALL);
  doc.setTextColor(90, 90, 90);
  const split = doc.splitTextToSize(text, maxWidth);
  const firstLine = Array.isArray(split) ? split[0] : String(split);
  const textWidth = doc.getTextWidth(firstLine);
  doc.text(firstLine, x + (maxWidth - textWidth) / 2, y);
  doc.setTextColor(...COLORS.BLACK);
}
