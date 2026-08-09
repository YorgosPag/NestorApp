'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 + ADR-726 + ADR-732 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-726-frame-budget-instrumentation-and-attribution.md
 * docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md
 *
 * ADR-732 Batch 2 — Ο ΕΝΑΣ καμβάς της ζώνης Α (2 → 1).
 *
 * Αντικαθιστά τα 2 κάτω full-viewport canvases (z0, ΚΑΤΩ από LayerCanvas/DxfCanvas):
 * grid-underlay → floorplan-background. Η σειρά ζωγραφικής ΜΕΣΑ στον καμβά διατηρεί την
 * απόφαση «κάναβος ΚΑΤΩ από την κάτοψη» (Giorgio 2026-06-05, ADR-040): grid pass πρώτο,
 * floorplan pass από πάνω.
 *
 * ΔΕΝ συγχωνεύονται εδώ (τεκμηρίωση ADR-732 §3):
 * - `FloorUnderlayOverlay` (z5): ο xref-fade του είναι `destination-out` σε ΟΛΟ τον καμβά —
 *   σε κοινό καμβά θα έσβηνε το grid/κάτοψη· επιπλέον κάθεται ΠΑΝΩ από το LayerCanvas (z0,
 *   DOM-μετά) στο z-συμβόλαιο. Έγινε mount-on-demand αντί για merge.
 * - `LayerCanvas` (z0): imperative renderer — δική του απόφαση (ADR-732 §6 παγίδα 4).
 *
 * Διάδραση: η ζώνη Α είναι pointer-events-none ΕΚΤΟΣ από τη διάρκεια calibration session
 * της κάτοψης (point picking) — ίδια συμπεριφορά με τον πρώην FloorplanBackgroundCanvas.
 * ADR-040: ZERO useSyncExternalStore εδώ πέρα από όσα κουβαλούν τα painter hooks (low-freq)·
 * transform ΜΟΝΟ μέσω `getImmediateTransform()` σε scheduler frame (XXII.B).
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useOverlayZoneDispatch } from './use-overlay-zone-dispatch';
import { useGridUnderlayPainter } from '../GridUnderlayCanvas';
import { useBasemapPainter } from '../useBasemapPainter';
// Deep import (ΟΧΙ το barrel `floorplan-background/index`): το barrel τραβά τη
// levels/firestore αλυσίδα — περιττή εδώ και δηλητήριο για τα jsdom tests του shell.
import { useFloorplanBackgroundPainter } from '../../../floorplan-background/components/FloorplanBackgroundCanvas';
import type { CadCoordinateAdaptation } from '../../../floorplan-background/providers/types';
import type { GridSettings } from '../../../canvas-v2';
import type { Viewport } from '../../../rendering/types/Types';

export interface UnderlayDispatchCanvasProps {
  readonly gridSettings: GridSettings;
  readonly viewport: Viewport;
  /** Ενεργός όροφος κάτοψης — null ⇒ το floorplan pass είναι ανενεργό. */
  readonly floorId: string | null;
  /** CAD adaptation της κάτοψης — πέρνα ΣΤΑΘΕΡΗ αναφορά (module const). */
  readonly cad?: CadCoordinateAdaptation;
  /** Consumer sets z-index appropriate for the stacking context (ADR-002). */
  readonly className?: string;
}

export function UnderlayDispatchCanvas({
  gridSettings,
  viewport,
  floorId,
  cad,
  className,
}: UnderlayDispatchCanvasProps) {
  const basemap = useBasemapPainter();
  const grid = useGridUnderlayPainter(gridSettings);
  const floorplan = useFloorplanBackgroundPainter(floorId, cad);

  // z-συμβόλαιο ζώνης Α: χάρτης ΤΕΛΕΥΤΑΙΟΣ ΑΠΟ ΚΑΤΩ, μετά grid, κάτοψη ΠΑΝΩ
  // (Giorgio 2026-06-05 για τα δύο τελευταία — ΜΗΝ αντιστρέψεις).
  //
  // Ο χάρτης μπαίνει ΠΡΩΤΟΣ γιατί είναι υπόβαθρο **αναφοράς**: ο κάνναβος σχεδίασης και η
  // κάτοψη είναι εργαλεία δουλειάς και οφείλουν να μένουν αναγνώσιμα από πάνω του. Αντίστροφη
  // σειρά θα έκρυβε τον κάναβο κάτω από αεροφωτογραφία τη μέρα που θα προστεθεί πάροχος με
  // `kind: 'aerial'` — δηλαδή η βλάβη θα γεννιόταν από αλλαγή που δεν αγγίζει αυτό το αρχείο.
  const painters = useMemo(
    () => [basemap, grid, floorplan.painter],
    [basemap, grid, floorplan.painter],
  );

  // Κοινός zone μηχανισμός (SSoT — use-overlay-zone-dispatch): ΕΝΑ scheduler frame
  // subscription για ΟΛΗ τη ζώνη Α (πρώην 2 ids: grid-underlay / floorplan-background).
  const canvasRef = useOverlayZoneDispatch(painters, viewport, 'underlay-dispatch', 'Underlay Dispatch');

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="underlay-dispatch"
      onClick={floorplan.isCalibrating ? floorplan.onCalibrationClick : undefined}
      style={floorplan.isCalibrating ? { pointerEvents: 'auto' } : undefined}
      className={cn(
        'pointer-events-none',
        floorplan.isCalibrating && 'cursor-crosshair',
        className,
      )}
      aria-hidden="true"
    />
  );
}
