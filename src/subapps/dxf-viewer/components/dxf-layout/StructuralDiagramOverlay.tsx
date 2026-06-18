'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-483 (T3-UI / Slice 4) — Static-analysis diagram overlay (Revit/Robot
 * moment-shear diagrams πάνω στο μοντέλο).
 *
 * Read-only overlay canvas που, όταν είναι ON το toggle «Διαγράμματα Μ/V/N», σχεδιάζει
 * για κάθε φέρον **δοκάρι** του ενεργού ορόφου το διάγραμμα ροπών — καμπύλη offset
 * κάθετα στον άξονα, auto-fit κλίμακα ώστε η μέγιστη ροπή να αντιστοιχεί σε σταθερό
 * pixel ύψος, + ετικέτα ακραίας τιμής. Τα δεδομένα είναι **derived** (ADR-481 solver)
 * — μηδέν persistence, μηδέν επανυπολογισμός εδώ.
 *
 * ADR-040 micro-leaf: subscribes ΜΟΝΟ εδώ — `useAnalysisDiagramViewStore`
 * (showAnalysisDiagrams), `ViewMode3DStore` (mode), `AnalysisResultsStore` +
 * `AnalyticalModelStore` (LOW-FREQ — γράφονται μόνο στην «Ανάλυση»). Ο shell
 * `CanvasLayerStack` δεν αποκτά νέο subscription (CHECK 6C safe). Ξεχωριστό canvas +
 * `pointer-events-none` → καμία επίδραση σε selection/hit-test/bitmap cache.
 *
 * @see ../../bim/structural/analytical/diagrams/member-diagram-geometry.ts — pure SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-483-static-analysis-canvas-diagrams.md
 */

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { useAnalysisDiagramViewStore } from '../../state/analysis-diagram-view-store';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { AnalysisResultsStore } from '../../bim/structural/analytical/solver/analysis-results-store';
import { AnalyticalModelStore } from '../../bim/structural/analytical/analytical-model-store';
import {
  buildMemberDiagramPaths,
  type MemberDiagramSet,
} from '../../bim/structural/analytical/diagrams/member-diagram-geometry';
import {
  drawMemberDiagram,
  drawDiagramExtremum,
  type DiagramDrawStyle,
} from '../../bim/structural/analytical/diagrams/member-diagram-draw';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { resolveSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';

/** Ακραία ροπή → σταθερό ύψος διαγράμματος (px) ανεξαρτήτως zoom. */
const TARGET_OFFSET_PX = 60;
/** Στυλ διαγράμματος ροπής (κόκκινο — Robot bending moment convention). */
const MOMENT_STYLE: DiagramDrawStyle = {
  stroke: 'rgba(200,30,40,0.95)',
  fill: 'rgba(200,30,40,0.16)',
};
/** SI σύμβολο μονάδας ανά εντατικό μέγεθος (kNm ροπή / kN τέμνουσα-αξονική). */
const UNIT_MOMENT = 'kNm';

export interface StructuralDiagramOverlayProps {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

export function StructuralDiagramOverlay({ transform, viewport }: StructuralDiagramOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Leaf subscriptions (ADR-040): toggle + render mode + low-freq derived stores.
  const showDiagrams = useAnalysisDiagramViewStore((s) => s.showAnalysisDiagrams);
  const mode = useViewMode3DStore((s) => s.mode);
  const result = useSyncExternalStore(
    AnalysisResultsStore.subscribe, AnalysisResultsStore.get, AnalysisResultsStore.get,
  );
  const model = useSyncExternalStore(
    AnalyticalModelStore.subscribe, AnalyticalModelStore.get, AnalyticalModelStore.get,
  );
  const active = showDiagrams && mode === '2d';

  // Active-floor scene only to resolve units (meters → canvas-units factor). Read
  // directly (mirror HeatLoadOverlay) so a scene replacement is picked up.
  const levelsCtx = useLevelsOptional();
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;
  const scene = active && currentLevelId && getLevelScene ? getLevelScene(currentLevelId) : null;
  const units = resolveSceneUnits(scene);

  const diagramSet = useMemo<MemberDiagramSet | null>(() => {
    if (!active) return null;
    return buildMemberDiagramPaths(model, result, {
      component: 'moment',
      toCanvasFromMeters: 1 / sceneUnitsToMeters(units),
    });
  }, [active, model, result, units]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = getDevicePixelRatio();
    const w = Math.max(1, Math.round(viewport.width * dpr));
    const h = Math.max(1, Math.round(viewport.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    if (!active || !diagramSet || diagramSet.globalMaxAbs <= 0) return;
    const pxScale = TARGET_OFFSET_PX / diagramSet.globalMaxAbs;

    ctx.save();
    ctx.setLineDash([]);
    for (const path of diagramSet.paths) {
      const si = CoordinateTransforms.worldToScreen(path.iCanvas, transform, viewport);
      const sj = CoordinateTransforms.worldToScreen(path.jCanvas, transform, viewport);
      drawMemberDiagram(ctx, si, sj, path, pxScale, MOMENT_STYLE);
      drawDiagramExtremum(ctx, si, sj, path, pxScale, UNIT_MOMENT);
    }
    ctx.restore();
  }, [active, diagramSet, transform, viewport]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="analysis-diagrams"
      className="pointer-events-none absolute inset-0 h-full w-full z-10"
      aria-hidden="true"
    />
  );
}
