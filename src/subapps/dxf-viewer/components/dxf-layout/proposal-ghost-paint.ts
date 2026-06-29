/**
 * proposal-ghost-paint — SSoT 2D paint helper for the MEP auto-design proposal ghosts.
 *
 * The six pipe/duct/fuel disciplines (water, drainage, heating, HVAC, fire, gas) all paint
 * their proposed run the SAME way: one `MepSegmentGhostRenderer.render` per segment, in the
 * discipline's domain, with a per-segment stroke/fill the discipline resolves from the SSoT
 * classification colour. This helper owns that single loop so the seven mounts stay thin and
 * the renderer wiring lives in ONE place (the electrical discipline paints wires instead, via
 * `drawCircuitWires`, so it does not use this helper).
 *
 * @see ./proposal-overlays/ProposalDispatchCanvas.tsx — the dispatch canvas that calls the painter hooks (ADR-554)
 * @see ../../bim/mep-segments/MepSegmentGhostRenderer.ts — the shared pure renderer
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { MepSegmentDomain } from '../../bim/types/mep-segment-types';
import { MepSegmentGhostRenderer } from '../../bim/mep-segments/MepSegmentGhostRenderer';

/** One proposed run flattened to its draw inputs (the discipline resolves the colour). */
export interface GhostSegmentDraw {
  readonly start: Readonly<Point2D>;
  readonly end: Readonly<Point2D>;
  /** Sized diameter (mm) — the outline half-width tracks it via `mmScale`. */
  readonly diameterMm: number;
  /** SSoT stroke colour, or `undefined` to let the renderer use its domain default. */
  readonly stroke?: string;
  /** SSoT translucent fill, or `undefined` for the renderer default. */
  readonly fill?: string;
}

/**
 * Stroke every proposed segment onto `ctx` (already dpr-scaled + cleared by the overlay).
 * `mmScale` = `mmToSceneUnits(sceneUnits)` so a mm diameter reads as canvas units.
 */
export function paintGhostSegments(
  ctx: CanvasRenderingContext2D,
  segments: readonly GhostSegmentDraw[],
  transform: ViewTransform,
  viewport: { readonly width: number; readonly height: number },
  mmScale: number,
  domain: MepSegmentDomain,
): void {
  if (segments.length === 0) return;
  const renderer = new MepSegmentGhostRenderer(ctx);
  for (const s of segments) {
    renderer.render({
      startPoint: s.start,
      cursor: s.end,
      sectionWidthCanvas: s.diameterMm * mmScale,
      domain,
      strokeOverride: s.stroke,
      fillOverride: s.fill,
      transform,
      viewport,
    });
  }
}
