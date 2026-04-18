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

// Type-only import keeps tsc happy without triggering the resvg WASM blob at
// module-load time. Firebase's deploy-time analyzer imports every exported
// symbol with a 10s budget; pulling `@resvg/resvg-js` here (≈6MB native/WASM
// bundle + bindings) exceeds that budget cold and produces
// "User code failed to load. Cannot determine backend specification" during
// `firebase deploy`. Lazy-require inside the function call site avoids the
// cold-start tax until an object actually triggers the handler.
import type { Resvg as ResvgType, ResvgRenderOptions } from '@resvg/resvg-js';

import {
  serializeDxfSceneToSvg,
  type DxfSceneInput,
  type SvgRenderOptions,
  type SvgRenderResult,
} from './svg-from-dxf-scene';

type ResvgCtor = new (svg: string, options?: ResvgRenderOptions) => ResvgType;

function loadResvg(): ResvgCtor {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return (require('@resvg/resvg-js') as { Resvg: ResvgCtor }).Resvg;
}

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

  const Resvg = loadResvg();
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
