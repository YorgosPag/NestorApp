/**
 * =============================================================================
 * SSoT: DXF scene → PNG rasterizer (server-side)
 * =============================================================================
 *
 * Single funnel for turning a parsed DXF scene into a PNG buffer suitable for
 * storage and PDF embedding. Composed of two SSoT primitives:
 *
 *   1. `serializeDxfSceneToSvg()` — scene → SVG 1.1 string
 *   2. `@resvg/resvg-js` — pure WASM SVG → PNG (no native deps, works in the
 *      Cloud Functions sandbox without cloudbuild tweaks)
 *
 * Every caller that wants a DXF thumbnail goes through this module.
 * No inline `new Resvg(...)` anywhere else — the registry ratchet enforces it.
 *
 * **SSoT mirror**: kept byte-for-byte in sync with
 * `functions/src/shared/dxf-raster-generator.ts`. Change one → change both.
 *
 * @module services/dxf-raster/dxf-raster-generator
 * @enterprise ADR-033 (Floorplan Processing), ADR-312 Phase 3 (Property Showcase)
 */

import { Resvg, type ResvgRenderOptions } from '@resvg/resvg-js';

import {
  serializeDxfSceneToSvg,
  type DxfSceneInput,
  type SvgRenderOptions,
  type SvgRenderResult,
} from './svg-from-dxf-scene';

export interface RasterizeDxfOptions extends SvgRenderOptions {
  /** PNG pixel width (defaults to the SVG width). */
  rasterWidth?: number;
}

export interface RasterizeDxfResult {
  png: Buffer;
  width: number;
  height: number;
  svgStats: Pick<SvgRenderResult, 'renderedEntities' | 'skippedEntities'>;
}

/** Default thumbnail dimensions — matches the browser generator. */
export const DXF_THUMBNAIL_WIDTH = 1200;
export const DXF_THUMBNAIL_HEIGHT = 800;

export function rasterizeDxfScene(
  scene: DxfSceneInput,
  options: RasterizeDxfOptions = {}
): RasterizeDxfResult {
  const width = options.width ?? DXF_THUMBNAIL_WIDTH;
  const height = options.height ?? DXF_THUMBNAIL_HEIGHT;
  const { svg, renderedEntities, skippedEntities } = serializeDxfSceneToSvg(scene, {
    ...options,
    width,
    height,
  });

  const resvgOpts: ResvgRenderOptions = {
    fitTo: { mode: 'width', value: options.rasterWidth ?? width },
    background: options.background ?? '#f8f9fa',
    font: { loadSystemFonts: false },
  };

  const resvg = new Resvg(svg, resvgOpts);
  const rendered = resvg.render();
  const png = rendered.asPng();
  return {
    png,
    width: rendered.width,
    height: rendered.height,
    svgStats: { renderedEntities, skippedEntities },
  };
}
