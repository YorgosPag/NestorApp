'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * Read-only 2D overlay group (ADR-040 micro-leaf grouping).
 *
 * Thin pass-through που συγκεντρώνει τα read-only, pointer-events-none 2D overlays
 * που δέχονται ΜΟΝΟ `transform` + `viewport`. Ο shell `CanvasLayerStack` περνά τα
 * δύο props ως έχουν (από τον TransformBridge) — αυτό το component ΔΕΝ προσθέτει
 * `useSyncExternalStore`· κάθε child self-subscribes + self-gates στο δικό του store.
 * Εξαγωγή από τον `CanvasLayerStack` ώστε ο shell να μένει εντός του ορίου 500
 * γραμμών (N.7.1) χωρίς αλλαγή στο data flow ή στη σειρά render (z-order).
 */

import { AutoAreaPreviewOverlay } from './AutoAreaPreviewOverlay';
import { RegionPerimeterPreviewOverlay } from './RegionPerimeterPreviewOverlay';
import { RiserThroughOverlay } from './RiserThroughOverlay';
import { HeatLoadOverlay } from './HeatLoadOverlay';
import { PipeSizingOverlay } from './PipeSizingOverlay';
import { HydraulicBalancingOverlay } from './HydraulicBalancingOverlay';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';

export interface CanvasLayerStack2DOverlaysProps {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

/**
 * Render group — η σειρά διατηρείται ίδια με τον προηγούμενο inline κώδικα του
 * `CanvasLayerStack` ώστε το z-order να μένει αμετάβλητο.
 */
export function CanvasLayerStack2DOverlays({ transform, viewport }: CanvasLayerStack2DOverlaysProps) {
  return (
    <>
      <AutoAreaPreviewOverlay transform={transform} viewport={viewport} />
      <RegionPerimeterPreviewOverlay transform={transform} viewport={viewport} />
      {/* ADR-408 Φ15 Task B — cross-floor «riser through» glyphs (derived from
          other floors' vertical risers crossing the active FFL). Read-only,
          pointer-events-none. Self-gated to mode==='2d'. STAGE ADR-040. */}
      <RiserThroughOverlay transform={transform} viewport={viewport} />
      {/* ADR-422 L1 — analytical heat-load heat-map + Φ labels per thermal
          space. Read-only, pointer-events-none. Self-gated to
          showHeatLoad && mode==='2d'. STAGE ADR-040. */}
      <HeatLoadOverlay transform={transform} viewport={viewport} />
      {/* ADR-422 L3 — pipe-sizing badges (προτεινόμενη DN + ταχύτητα) ανά
          σωλήνα θέρμανσης. Read-only, pointer-events-none. Self-gated to
          showPipeSizing && mode==='2d'. STAGE ADR-040. */}
      <PipeSizingOverlay transform={transform} viewport={viewport} />
      {/* ADR-422 L4 — hydraulic-balancing badges (ΔP κυκλώματος + kv balancing
          valve) ανά καλοριφέρ + index-circuit highlight + μανομετρικό στην πηγή.
          Read-only, pointer-events-none. Self-gated to showBalancing && mode==='2d'.
          STAGE ADR-040. */}
      <HydraulicBalancingOverlay transform={transform} viewport={viewport} />
    </>
  );
}
