/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-552 BEFORE EDITING
 *
 * ADR-485 (T3-UI Slice 4c) — reinforcement-utilization fill (As,req/As,prov) + υπόμνημα,
 * ως analytical painter (ADR-552 dispatch). Πηγή: ο πρώην `StructuralUtilizationOverlay.tsx`.
 *
 * Όταν ON το toggle «Επάρκεια»: footprint κάθε φέροντος μέλους (δοκάρι & κολόνα) βαμμένο
 * πράσινο/πορτοκαλί/κόκκινο ανά ratio + υπόμνημα κάτω-αριστερά. Derived (reuse asStrength +
 * ενεργός οπλισμός), μηδέν persistence. Gate: `showUtilization && 2d`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-485-utilization-overlay.md
 */

import { useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import { useAnalysisDiagramViewStore } from '../../../state/analysis-diagram-view-store';
import { AnalysisResultsStore } from '../../../bim/structural/analytical/solver/analysis-results-store';
import { useStructuralSettingsStore } from '../../../state/structural-settings-store';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { isColumnEntity, isBeamEntity } from '../../../types/entities';
import {
  beamUtilization,
  columnUtilization,
} from '../../../bim/structural/utilization/member-utilization';
import {
  utilizationFillColor,
  utilizationLegendColor,
  type UtilizationBand,
} from '../../../bim/structural/utilization/utilization-color';
import {
  resolveActiveBeamReinforcementForEntity,
  resolveActiveColumnReinforcementForEntity,
  resolveActiveColumnDesignMoment,
  resolveActiveBeamSupportType,
  resolveActiveBeamSpanMm,
} from '../../../bim/structural/active-reinforcement';
import { resolveMemberFootprintVertices } from '../../../bim/structural/member-footprint-2d';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import type { ViewTransform, Viewport, Point2D } from '../../../rendering/types/Types';
import type { AnalyticalPainter } from './analytical-painter';

/** Ένα βαφόμενο μέλος: footprint (world) + χρώμα επάρκειας. */
interface UtilizationFill {
  readonly vertices: ReadonlyArray<Point2D>;
  readonly color: string;
}

const LEGEND_FONT = '11px sans-serif';
const LEGEND_SWATCH = 11;
const LEGEND_GAP = 6;
const LEGEND_ROW_H = 17;
const LEGEND_PAD = 8;
const LEGEND_MARGIN = 14;
const LEGEND_BG = 'rgba(255,255,255,0.92)';
const LEGEND_TEXT = 'rgb(40,44,52)';

/** Γέμισμα κλειστού footprint (world coords → screen). */
function fillFootprint(
  ctx: CanvasRenderingContext2D,
  vertices: ReadonlyArray<Point2D>,
  color: string,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  if (vertices.length < 3) return;
  ctx.beginPath();
  const first = CoordinateTransforms.worldToScreen(vertices[0]!, transform, viewport);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < vertices.length; i++) {
    const s = CoordinateTransforms.worldToScreen(vertices[i]!, transform, viewport);
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Υπόμνημα (πράσινο/πορτοκαλί/κόκκινο) κάτω-αριστερά — σταθερή θέση screen. */
function drawLegend(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  rows: ReadonlyArray<{ band: UtilizationBand; text: string }>,
): void {
  ctx.font = LEGEND_FONT;
  const textW = Math.max(...rows.map((r) => ctx.measureText(r.text).width));
  const boxW = LEGEND_PAD * 2 + LEGEND_SWATCH + LEGEND_GAP + textW;
  const boxH = LEGEND_PAD * 2 + rows.length * LEGEND_ROW_H;
  const x = LEGEND_MARGIN;
  const y = viewport.height - LEGEND_MARGIN - boxH;

  ctx.fillStyle = LEGEND_BG;
  ctx.fillRect(x, y, boxW, boxH);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  rows.forEach((row, i) => {
    const rowY = y + LEGEND_PAD + i * LEGEND_ROW_H;
    ctx.fillStyle = utilizationLegendColor(row.band);
    ctx.fillRect(x + LEGEND_PAD, rowY + (LEGEND_ROW_H - LEGEND_SWATCH) / 2, LEGEND_SWATCH, LEGEND_SWATCH);
    ctx.fillStyle = LEGEND_TEXT;
    ctx.fillText(row.text, x + LEGEND_PAD + LEGEND_SWATCH + LEGEND_GAP, rowY + LEGEND_ROW_H / 2);
  });
}

/** Structural-utilization analytical painter (`null` όταν ανενεργό/κενό). */
export function useStructuralUtilizationPainter(): AnalyticalPainter | null {
  const { t } = useTranslation('dxf-viewer-shell');

  // Leaf subscriptions (ADR-040): toggle + render mode + active code (repaint).
  const showUtilization = useAnalysisDiagramViewStore((s) => s.showUtilization);
  const mode = useViewMode3DStore((s) => s.mode);
  const codeId = useStructuralSettingsStore((s) => s.codeId);
  const active = showUtilization && mode === '2d';
  // ADR-491 — leaf subscription στο FEM store (low-freq → ADR-040 safe): όταν λύνει η
  // «Ανάλυση», η As,req/As,prov κολόνας γίνεται FEM-aware μέσω των active resolvers· εδώ
  // απλώς ξανα-βάφουμε (read-only, μηδέν persisted mutation → μηδέν βρόχος).
  const analysisResult = useSyncExternalStore(
    AnalysisResultsStore.subscribe,
    AnalysisResultsStore.get,
    AnalysisResultsStore.get,
  );

  // Active-floor scene — read DIRECTLY (mirror heat-load painter) so a scene replacement
  // is picked up. Members carry geometry footprint + reinforcement intent.
  const levelsCtx = useLevelsOptional();
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;
  const scene = active && currentLevelId && getLevelScene ? getLevelScene(currentLevelId) : null;

  const fills = useMemo<readonly UtilizationFill[]>(() => {
    if (!active || !scene) return [];
    const out: UtilizationFill[] = [];
    for (const e of scene.entities) {
      // ADR-490 — footprint resolution = κοινό SSoT (`resolveMemberFootprintVertices`).
      if (isColumnEntity(e)) {
        // ADR-491 — η ΙΔΙΑ engaged-gated FEM ροπή τροφοδοτεί As,prov ΚΑΙ As,req (3ο arg) →
        // req & prov συμφωνούν (πρόβολος: >1 πριν, ≤1 μετά τον M-N οπλισμό).
        const util = columnUtilization(
          e,
          resolveActiveColumnReinforcementForEntity(e),
          resolveActiveColumnDesignMoment(e.id),
        );
        const verts = resolveMemberFootprintVertices(e);
        if (util && verts) out.push({ vertices: verts, color: utilizationFillColor(util.ratio) });
      } else if (isBeamEntity(e)) {
        const util = beamUtilization(
          e, resolveActiveBeamReinforcementForEntity(e),
          resolveActiveBeamSupportType(e.id), resolveActiveBeamSpanMm(e.id),
        );
        const verts = resolveMemberFootprintVertices(e);
        if (util && verts) out.push({ vertices: verts, color: utilizationFillColor(util.ratio) });
      }
    }
    return out;
    // codeId: ο ενεργός κανονισμός (active-reinforcement reads getState) → repaint σε αλλαγή.
    // analysisResult: φρέσκο FEM solve → repaint με FEM-aware utilization (ADR-491).
  }, [active, scene, codeId, analysisResult]);

  return useMemo<AnalyticalPainter | null>(() => {
    if (!active || fills.length === 0) return null;
    const rows: ReadonlyArray<{ band: UtilizationBand; text: string }> = [
      { band: 'ok', text: t('ribbon.commands.utilization.legendOk') },
      { band: 'warn', text: t('ribbon.commands.utilization.legendWarn') },
      { band: 'over', text: t('ribbon.commands.utilization.legendOver') },
    ];
    return (ctx, transform, viewport) => {
      ctx.save();
      ctx.setLineDash([]);
      for (const fill of fills) fillFootprint(ctx, fill.vertices, fill.color, transform, viewport);
      drawLegend(ctx, viewport, rows);
      ctx.restore();
    };
  }, [active, fills, t]);
}
