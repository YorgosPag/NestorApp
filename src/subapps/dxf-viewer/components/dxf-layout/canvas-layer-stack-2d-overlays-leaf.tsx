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
import { RegionGapMarkersOverlay } from './RegionGapMarkersOverlay';
import { TopoAutoBreaklinePreviewOverlay } from './TopoAutoBreaklinePreviewOverlay';
import { AnalyticalDispatchCanvas } from './analytical-overlays/AnalyticalDispatchCanvas';
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
      {/* ADR-419 Layer 5b — κόκκινοι κύκλοι στα ανοιχτά άκρα όταν το region/perimeter
          pick δεν κλείνει βρόχο (AutoCAD BOUNDARY red-circles). Self-subscribes στο
          RegionGapMarkersStore· read-only, pointer-events-none. STAGE ADR-040 + ADR-419. */}
      <RegionGapMarkersOverlay transform={transform} viewport={viewport} />
      {/* ADR-650 M8β/Γ — προτεινόμενες γραμμές ασυνέχειας (auto-breaklines) υπό έγκριση:
          πράσινο = τσεκαρισμένη, γκρι διακεκομμένο = απορριφθείσα. Self-subscribes στο
          LOW-freq auto-breakline store· read-only, pointer-events-none. STAGE ADR-650. */}
      <TopoAutoBreaklinePreviewOverlay transform={transform} viewport={viewport} />
      {/* ADR-552 — ΕΝΑΣ analytical dispatch canvas αντικαθιστά τα 7 ξεχωριστά
          analytical overlays (riser-through ADR-408 Φ15 · heat-load ADR-422 L1 ·
          pipe-sizing ADR-422 L3 · hydraulic-balancing ADR-422 L4 · utilization
          ADR-485 · M/V/N diagrams ADR-483 · warnings ADR-490). Κάθε painter
          self-subscribes + self-gates· ο dispatch κάνει size+clear ΜΙΑ φορά και
          ζωγραφίζει με σειρά z-order (warnings topmost). Read-only,
          pointer-events-none. STAGE ADR-040 + ADR-552. */}
      <AnalyticalDispatchCanvas transform={transform} viewport={viewport} />
    </>
  );
}
