'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 + ADR-552 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-552-analytical-overlay-dispatch-canvas.md
 *
 * ADR-552 — Analytical overlay dispatch canvas (7 → 1).
 *
 * ΕΝΑΣ read-only, pointer-events-none canvas που αντικαθιστά τα 7 ξεχωριστά analytical
 * overlays (ADR-551 §5.2 #1). Καλεί τους 7 painter hooks (καθένας self-subscribes +
 * self-gates στο δικό του store) και ζωγραφίζει με σειρά z-order σε ΕΝΑ frame: size+clear
 * ΜΙΑ φορά, μετά κάθε ενεργό painter. Σε 3D mode όλοι οι painters → `null` → άδειος καμβάς.
 *
 * ADR-040: leaf component (παιδί του 2d-overlays group) — ο shell `CanvasLayerStack` ΔΕΝ
 * αποκτά νέο `useSyncExternalStore` (CHECK 6C safe). Αθροιστικά οι ίδιες subscriptions με
 * τα 7 παλιά overlays, σε ΕΝΑ component· όλες low-freq (toggles/analysis), όχι 60fps.
 */

import { useCallback, useEffect, useRef } from 'react';
import { paintAnalyticalFrame } from './analytical-painter';
import { useRiserThroughPainter } from './use-riser-through-painter';
import { useHeatLoadPainter } from './use-heat-load-painter';
import { usePipeSizingPainter } from './use-pipe-sizing-painter';
import { useHydraulicBalancingPainter } from './use-hydraulic-balancing-painter';
import { useStructuralUtilizationPainter } from './use-structural-utilization-painter';
import { useStructuralDiagramPainter } from './use-structural-diagram-painter';
import { useStructuralWarningPainter } from './use-structural-warning-painter';
// ADR-040 Phase XXII.B — zero-lag: transform από το SSoT στο draw time + scheduler frame
// αντί για React prop (ιδίωμα HomeRunWiresOverlay).
import { getImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../../../rendering/core/immediate-transform-frame';
import type { Viewport } from '../../../rendering/types/Types';

export interface AnalyticalDispatchCanvasProps {
  readonly viewport: Viewport;
}

export function AnalyticalDispatchCanvas({ viewport }: AnalyticalDispatchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // z-order (ίδιο με την πρώην σειρά render των 7 overlays): riser → heat-load →
  // pipe-sizing → hydraulic-balancing → utilization → diagrams → warnings (topmost).
  const riser = useRiserThroughPainter();
  const heatLoad = useHeatLoadPainter();
  const pipeSizing = usePipeSizingPainter();
  const balancing = useHydraulicBalancingPainter();
  const utilization = useStructuralUtilizationPainter();
  const diagrams = useStructuralDiagramPainter();
  const warnings = useStructuralWarningPainter();

  // Volatile low-freq inputs μέσω ref (ιδίωμα HomeRunWires: ref bundle + 2 effects).
  const drawStateRef = useRef({ riser, heatLoad, pipeSizing, balancing, utilization, diagrams, warnings, viewport });
  drawStateRef.current = { riser, heatLoad, pipeSizing, balancing, utilization, diagrams, warnings, viewport };

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = drawStateRef.current;
    paintAnalyticalFrame(
      canvas,
      [s.riser, s.heatLoad, s.pipeSizing, s.balancing, s.utilization, s.diagrams, s.warnings],
      getImmediateTransform(),
      s.viewport,
    );
  }, []);

  // (α) Repaint σε content change (painters/viewport) με ΑΚΙΝΗΤΟ transform.
  useEffect(() => {
    repaint();
  }, [riser, heatLoad, pipeSizing, balancing, utilization, diagrams, warnings, viewport, repaint]);

  // (β) Zero-lag pan/zoom — scheduler frame gated στο immediate transform (XXII.B).
  useEffect(() => {
    return subscribeImmediateTransformFrame('analytical-dispatch', 'Analytical Dispatch', repaint);
  }, [repaint]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="analytical"
      className="pointer-events-none absolute inset-0 h-full w-full z-10"
      aria-hidden="true"
    />
  );
}
