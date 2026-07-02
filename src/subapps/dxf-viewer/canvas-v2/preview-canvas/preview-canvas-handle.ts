/**
 * Preview canvas imperative handle factory — SRP split out of `PreviewCanvas.tsx` (ADR-040).
 *
 * Maps the `PreviewCanvasHandle` API surface (drawPreview + all the post-preview overlay draws)
 * onto the live `PreviewRenderer`, reading transform/viewport/options from the component refs at
 * call time (NO React re-render). The component keeps only the lifecycle wiring; this module owns
 * the API→renderer mapping. Kept as a pure factory so the handle object stays identical to the
 * previous inline `useImperativeHandle` body.
 */

import type { MutableRefObject, RefObject } from 'react';
import type { PreviewRenderer, PreviewRenderOptions } from './PreviewRenderer';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from '../../hooks/drawing/useUnifiedDrawing';
import type { AcquiredTrackingPoint } from '../../systems/tracking/TrackingPointStore';
import type { TrackingAlignmentPath } from '../../systems/tracking/tracking-resolver';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import type { WallHudMeta } from './wall-hud-paint';
import type { ColumnParams } from '../../bim/types/column-types';
import type { FootprintHudDescriptor } from './column-hud-paint';
import type { PolarDiskGrid } from '../../bim/columns/polar-disk-snap';
import type { RectGrid } from '../../bim/columns/rect-cartesian-snap';
import type { PlacementAlignmentGuide } from '../../bim/columns/column-tangent-snap';
import type { PreviewCanvasHandle } from './PreviewCanvas';

/** Refs the handle reads at call time — owned by the `PreviewCanvas` component. */
export interface PreviewCanvasHandleRefs {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rendererRef: MutableRefObject<PreviewRenderer | null>;
  transformRef: MutableRefObject<ViewTransform>;
  viewportRef: MutableRefObject<{ width: number; height: number }>;
  optionsRef: MutableRefObject<PreviewRenderOptions | undefined>;
}

/**
 * Build the imperative handle. Identical behaviour to the previous inline body — every method reads
 * the current transform/viewport from `refs` so overlays stay world-locked without a React re-render.
 */
export function createPreviewCanvasHandle(refs: PreviewCanvasHandleRefs): PreviewCanvasHandle {
  const { canvasRef, rendererRef, transformRef, viewportRef, optionsRef } = refs;
  return {
    /**
     * 🏢 ENTERPRISE: Draw preview directly
     * NO REACT RE-RENDER - direct canvas call!
     */
    drawPreview: (entity: ExtendedSceneEntity | null, options?: PreviewRenderOptions) => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      // Merge default options with provided options
      const mergedOptions = {
        ...optionsRef.current,
        ...options,
      };

      // 🏢 ADR-040: Pass viewport for Y-axis inversion. Transform is NOT passed —
      // the renderer reads it live from the SSoT at paint time (world-locked ghost).
      renderer.drawPreview(entity, viewportRef.current, mergedOptions);
    },

    /**
     * 🏢 ENTERPRISE: Clear preview
     */
    clear: () => {
      rendererRef.current?.clear();
    },

    /**
     * 🏢 ENTERPRISE: Get canvas element
     */
    getCanvas: () => canvasRef.current,

    /** ADR-357 Phase 1: Polar tracking alignment path overlay */
    drawPolarTrackingLine: (
      ref: Point2D,
      snappedAngle: number,
      label: string,
      cursorWorld: Point2D,
    ) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.drawPolarTrackingLine(
        ref,
        snappedAngle,
        label,
        cursorWorld,
        transformRef.current,
        viewportRef.current,
      );
    },

    /** ADR-357 Phase 4: Object Snap Tracking persistent markers */
    setTrackingMarkers: (markers: readonly AcquiredTrackingPoint[]) => {
      rendererRef.current?.setTrackingMarkers(markers);
    },

    /** ADR-357 Phase 4: Object Snap Tracking alignment + intersection overlay */
    drawTrackingAlignment: (
      paths: readonly TrackingAlignmentPath[],
      intersections: readonly Point2D[],
      snappedPoint: Point2D,
      label: string | null,
    ) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.drawTrackingAlignment(
        paths,
        intersections,
        snappedPoint,
        label,
        transformRef.current,
        viewportRef.current,
      );
    },

    /** ADR-508 §dim: wall-ghost listening dimensions overlay */
    drawGhostFaceDimensions: (meta: GhostFaceDimensionsMeta) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.drawGhostFaceDimensions(meta, transformRef.current, viewportRef.current);
    },

    /** ADR-508 §wall-hud: live wall identity HUD (aligned length dim + angle + spec) */
    drawWallHud: (meta: WallHudMeta, specLabel: string) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.drawWallHud(meta, specLabel, transformRef.current, viewportRef.current);
    },

    /** ADR-564 §footprint-hud: live column/pad footprint HUD (per-face dims + angle + height) */
    drawColumnHud: (footprint: readonly Point2D[], params: ColumnParams, heightSpecLabel: string) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.drawColumnHud(footprint, params, heightSpecLabel, transformRef.current, viewportRef.current);
    },

    /** ADR-564 §foundation-hud: entity-agnostic footprint HUD (pad) via minimal descriptor */
    drawFootprintHud: (footprint: readonly Point2D[], descriptor: FootprintHudDescriptor, heightSpecLabel: string) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.drawFootprintHud(footprint, descriptor, heightSpecLabel, transformRef.current, viewportRef.current);
    },

    /** ADR-397 §15 (wall): colored angle direction arc (shared SSoT with rotation) */
    drawDirectionArc: (pivotW: Point2D, anchorW: Point2D, cursorW: Point2D, sweepDeg: number) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.drawDirectionArc(pivotW, anchorW, cursorW, sweepDeg, transformRef.current, viewportRef.current);
    },

    /** ADR-508 §opening-conflict: 🔴 tooltip explaining the height-band opening cut */
    drawGhostConflictTooltip: (label: string, anchorWorld: Point2D) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.drawGhostConflictTooltip(label, anchorWorld, transformRef.current, viewportRef.current);
    },

    /** ADR-398 §3.13: Polar Magnet grid overlay (center / rings / spokes) */
    drawPolarDisk: (grid: PolarDiskGrid) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.drawPolarDisk(grid, transformRef.current, viewportRef.current);
    },

    /** ADR-398 §3.15: Cartesian Magnet grid overlay (u/v grid lines + center) */
    drawRectGrid: (grid: RectGrid) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.drawRectGrid(grid, transformRef.current, viewportRef.current);
    },

    /** ADR-398 §3.20/§3.20d: alignment guide(s) overlay (έως 2 πλευρές στη γωνία ορθογωνίου) */
    drawAlignmentGuide: (guide: PlacementAlignmentGuide | readonly PlacementAlignmentGuide[]) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.drawAlignmentGuide(guide, transformRef.current, viewportRef.current);
    },
  };
}
