'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 + ADR-552 + ADR-732 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-552-analytical-overlay-dispatch-canvas.md
 * docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md
 *
 * ADR-732 Batch 1 — οι 7 analytical painters ως ΕΝΑ hook.
 *
 * Ο πρώην `AnalyticalDispatchCanvas` (ADR-552, 7→1) κατείχε δικό του `<canvas>`. Με το ADR-732
 * ο καμβάς της ζώνης Β είναι ΕΝΑΣ (`Overlay2DDispatchCanvas`)· αυτό το hook κρατά ΜΟΝΟ τη
 * σύνθεση των 7 analytical painter hooks στη σειρά z-order τους. Κάθε painter hook
 * self-subscribes + self-gates στο δικό του low-freq store (αμετάβλητο από ADR-552).
 */

import { useMemo } from 'react';
import type { OverlayDispatchPainter } from '../overlay-dispatch/overlay-dispatch-frame';
import { useRiserThroughPainter } from './use-riser-through-painter';
import { useHeatLoadPainter } from './use-heat-load-painter';
import { usePipeSizingPainter } from './use-pipe-sizing-painter';
import { useHydraulicBalancingPainter } from './use-hydraulic-balancing-painter';
import { useStructuralUtilizationPainter } from './use-structural-utilization-painter';
import { useStructuralDiagramPainter } from './use-structural-diagram-painter';
import { useStructuralWarningPainter } from './use-structural-warning-painter';

/**
 * z-order (ίδιο με την πρώην σειρά render των 7 overlays — ADR-552): riser → heat-load →
 * pipe-sizing → hydraulic-balancing → utilization → diagrams → warnings (topmost).
 * Reference-stable array: νέα ταυτότητα ΜΟΝΟ όταν αλλάξει κάποιος painter.
 */
export function useAnalyticalPainters(): ReadonlyArray<OverlayDispatchPainter | null> {
  const riser = useRiserThroughPainter();
  const heatLoad = useHeatLoadPainter();
  const pipeSizing = usePipeSizingPainter();
  const balancing = useHydraulicBalancingPainter();
  const utilization = useStructuralUtilizationPainter();
  const diagrams = useStructuralDiagramPainter();
  const warnings = useStructuralWarningPainter();

  return useMemo(
    () => [riser, heatLoad, pipeSizing, balancing, utilization, diagrams, warnings],
    [riser, heatLoad, pipeSizing, balancing, utilization, diagrams, warnings],
  );
}
