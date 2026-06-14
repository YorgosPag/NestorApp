/**
 * ADR-457 Slice 3 — Column Reinforcement Detail Sheet · raster decode helper.
 *
 * Decodes every raster primitive's data URL in a {@link DetailSheetModel} into a
 * ready-to-draw `HTMLImageElement`, keyed by data URL. The dialog awaits this
 * once per model so the actual `renderDetailSheet` paint stays synchronous
 * (Canvas `drawImage` requires a fully-decoded image).
 *
 * DOM-dependent (uses `Image`) → kept out of the pure model/renderer modules.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/detail-raster-decode
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { DetailSheetModel } from '../detail-sheet-types';

/** Collects the distinct, non-null raster data URLs referenced by the model. */
function collectRasterUrls(model: DetailSheetModel): string[] {
  const urls = new Set<string>();
  for (const region of model.regions) {
    for (const prim of region.primitives) {
      if (prim.kind === 'raster' && prim.dataUrl) urls.add(prim.dataUrl);
    }
  }
  return [...urls];
}

/** Decodes a single data URL into an `HTMLImageElement`, or `null` on failure. */
async function decodeImage(dataUrl: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = dataUrl;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/**
 * Decodes all raster images in the model. Failed decodes are dropped so the rest
 * of the sheet still paints. Returns an empty map when the model has no rasters.
 */
export async function decodeModelRasters(
  model: DetailSheetModel,
): Promise<Map<string, CanvasImageSource>> {
  const urls = collectRasterUrls(model);
  const images = new Map<string, CanvasImageSource>();
  await Promise.all(
    urls.map(async (url) => {
      const img = await decodeImage(url);
      if (img) images.set(url, img);
    }),
  );
  return images;
}
