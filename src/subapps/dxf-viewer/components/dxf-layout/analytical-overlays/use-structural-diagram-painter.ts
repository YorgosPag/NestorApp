/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-552 BEFORE EDITING
 *
 * ADR-483 (T3-UI Slices 4 + 4b) — static-analysis M/V/N diagrams, ως analytical painter
 * (ADR-552 dispatch). Πηγή λογικής: ο πρώην `StructuralDiagramOverlay.tsx` (verbatim paint).
 *
 * Όταν ON το toggle «Διαγράμματα Μ/V/N»: για κάθε φέρον δοκάρι διάγραμμα του επιλεγμένου
 * εντατικού μεγέθους (Μ/V/N) — καμβά offset κάθετα στον άξονα, auto-fit, ζώνες T/C, βέλη
 * UDL, στηρίξεις. Derived (ADR-481 solver), μηδέν persistence. Gate: `showDiagrams && 2d`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-483-static-analysis-canvas-diagrams.md
 */

import { useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import { useAnalysisDiagramViewStore } from '../../../state/analysis-diagram-view-store';
import { useCurrentLevelScene } from '../../../systems/levels';
import { AnalysisResultsStore } from '../../../bim/structural/analytical/solver/analysis-results-store';
import { AnalyticalModelStore } from '../../../bim/structural/analytical/analytical-model-store';
import {
  buildMemberDiagramPaths,
  type MemberDiagramSet,
} from '../../../bim/structural/analytical/diagrams/member-diagram-geometry';
import {
  drawMemberDiagram,
  drawDiagramExtremum,
  drawDiagramEndValues,
  drawInflectionMarkers,
  drawTensionZoneLabels,
  type DiagramDrawStyle,
} from '../../../bim/structural/analytical/diagrams/member-diagram-draw';
import { drawMemberLoadArrows } from '../../../bim/structural/analytical/diagrams/member-load-arrows';
import { drawSupportGlyph } from '../../../bim/structural/analytical/diagrams/support-glyphs';
import type { DiagramComponent } from '../../../bim/structural/analytical/diagrams/member-diagram-geometry';
import type { AnalyticalSupportType } from '../../../bim/structural/analytical/analytical-model-types';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import { resolveSceneUnits, sceneUnitsToMeters } from '../../../utils/scene-units';
import type { AnalyticalPainter } from './analytical-painter';

/**
 * Ύψος της μέγιστης τιμής ως ποσοστό του μέσου μήκους μέλους (model space). Το
 * διάγραμμα ζει στο model space → κλιμακώνεται **μαζί** με το μοντέλο στο zoom.
 */
const DIAGRAM_HEIGHT_FRACTION = 0.35;

/** Στυλ ανά εντατικό μέγεθος — Robot σύμβαση: Μ κόκκινο / V πράσινο / N μπλε. */
const COMPONENT_STYLE: Record<DiagramComponent, DiagramDrawStyle> = {
  moment: { stroke: 'rgba(200,30,40,0.95)', fill: 'rgba(40,90,200,0.16)', fillNegative: 'rgba(200,30,40,0.16)' },
  shear: { stroke: 'rgba(30,150,70,0.95)', fill: 'rgba(30,150,70,0.16)' },
  axial: { stroke: 'rgba(40,90,200,0.95)', fill: 'rgba(40,90,200,0.16)' },
};
/** SI σύμβολο μονάδας ανά εντατικό μέγεθος (kNm ροπή / kN τέμνουσα-αξονική). */
const COMPONENT_UNIT: Record<DiagramComponent, string> = { moment: 'kNm', shear: 'kN', axial: 'kN' };
/** Caution (αστάθεια): αμπέρ διακεκομμένη χωρίς γέμισμα. */
const CAUTION_STROKE = 'rgba(217,119,6,0.96)';
/** Χρώματα ετικετών ζωνών T/C (συμφωνούν με τα fills της ροπής). */
const TC_TENSION_BOTTOM_COLOR = 'rgba(200,30,40,0.95)';
const TC_TENSION_TOP_COLOR = 'rgba(40,90,200,0.95)';
/** Στυλ βελών φορτίου (ουδέτερο γκρι ώστε να μην συγχέεται με τα χρώματα Μ/V/N). */
const LOAD_ARROW_STYLE = { stroke: 'rgba(80,80,90,0.85)', fill: 'rgba(80,80,90,0.85)' };
const UNIT_LINE_LOAD = 'kN/m';
/** Caption συνδυασμού — σταθερή θέση HUD πάνω-αριστερά. */
const CAPTION_FONT = '11px sans-serif';
const CAPTION_BG = 'rgba(255,255,255,0.92)';
const CAPTION_TEXT = 'rgb(40,44,52)';
const CAPTION_PAD = 6;
const CAPTION_MARGIN = 14;

/** Προβεβλημένος κόμβος στήριξης (canvas units) + τύπος. */
interface SupportPoint {
  readonly x: number;
  readonly y: number;
  readonly type: AnalyticalSupportType;
}

/** Ετικέτα συνδυασμού (Robot caption) σε pill πάνω-αριστερά. */
function drawCombinationCaption(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.font = CAPTION_FONT;
  const boxW = ctx.measureText(text).width + CAPTION_PAD * 2;
  const boxH = 18;
  ctx.fillStyle = CAPTION_BG;
  ctx.fillRect(CAPTION_MARGIN, CAPTION_MARGIN, boxW, boxH);
  ctx.fillStyle = CAPTION_TEXT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CAPTION_MARGIN + CAPTION_PAD, CAPTION_MARGIN + boxH / 2);
}

/** Structural-diagram analytical painter (`null` όταν ανενεργό/κενό). */
export function useStructuralDiagramPainter(): AnalyticalPainter | null {
  const { t } = useTranslation('dxf-viewer-shell');

  // Leaf subscriptions (ADR-040): toggle + component + render mode + low-freq stores.
  const showDiagrams = useAnalysisDiagramViewStore((s) => s.showAnalysisDiagrams);
  const component = useAnalysisDiagramViewStore((s) => s.diagramComponent);
  const mode = useViewMode3DStore((s) => s.mode);
  const result = useSyncExternalStore(
    AnalysisResultsStore.subscribe, AnalysisResultsStore.get, AnalysisResultsStore.get,
  );
  const model = useSyncExternalStore(
    AnalyticalModelStore.subscribe, AnalyticalModelStore.get, AnalyticalModelStore.get,
  );
  const active = showDiagrams && mode === '2d';

  // Active-floor scene only to resolve units + read beam line-loads (4b arrows).
  // SSoT hook (ADR-557) so a scene replacement is picked up.
  const liveScene = useCurrentLevelScene();
  const scene = active ? liveScene : null;
  const units = resolveSceneUnits(scene);

  const diagramSet = useMemo<MemberDiagramSet | null>(() => {
    if (!active) return null;
    return buildMemberDiagramPaths(model, result, {
      component,
      toCanvasFromMeters: 1 / sceneUnitsToMeters(units),
    });
  }, [active, model, result, units, component]);

  // ADR-483 Slice 4b+ — δεσμευμένοι κόμβοι (στηρίξεις) προβεβλημένοι σε canvas units.
  const supportPoints = useMemo<readonly SupportPoint[]>(() => {
    if (!active) return [];
    const toCanvas = 1 / sceneUnitsToMeters(units);
    const posById = new Map(model.nodes.map((n) => [n.id, n.position]));
    const out: SupportPoint[] = [];
    for (const s of model.supports) {
      const pos = posById.get(s.nodeId);
      if (!pos) continue;
      out.push({ x: pos.xM * toCanvas, y: pos.yM * toCanvas, type: s.supportType });
    }
    return out;
  }, [active, model, units]);

  return useMemo<AnalyticalPainter | null>(() => {
    if (!active || !diagramSet || diagramSet.globalMaxAbs <= 0 || diagramSet.referenceLengthCanvas <= 0) {
      return null;
    }
    const baseStyle = COMPONENT_STYLE[diagramSet.component];
    const reliable = diagramSet.reliable;
    const style: DiagramDrawStyle = reliable ? baseStyle : { ...baseStyle, stroke: CAUTION_STROKE };
    const unit = COMPONENT_UNIT[diagramSet.component];
    const tensionBottomLabel = t('ribbon.commands.analysisDiagrams.tensionBottom');
    const tensionTopLabel = t('ribbon.commands.analysisDiagrams.tensionTop');
    const combinationCaption = diagramSet.combinationKind
      ? t('ribbon.commands.analysisDiagrams.combinationCaption', { kind: diagramSet.combinationKind })
      : null;

    return (ctx, transform, viewport) => {
      // Model-space ύψος (canvas units) της μέγιστης τιμής → screen px μέσω
      // `transform.scale` ⇒ κλιμακώνεται με το zoom (σταθερή αναλογία με το δοκάρι).
      const modelHeightForMax = diagramSet.referenceLengthCanvas * DIAGRAM_HEIGHT_FRACTION;
      const pxScale = (modelHeightForMax / diagramSet.globalMaxAbs) * transform.scale;

      ctx.save();
      ctx.setLineDash([]);

      if (combinationCaption) drawCombinationCaption(ctx, combinationCaption);

      for (const path of diagramSet.paths) {
        const si = CoordinateTransforms.worldToScreen(path.iCanvas, transform, viewport);
        const sj = CoordinateTransforms.worldToScreen(path.jCanvas, transform, viewport);
        drawMemberDiagram(ctx, si, sj, path, pxScale, style, { dashed: !reliable });
        drawInflectionMarkers(ctx, si, sj, path);
        if (diagramSet.component === 'moment' && reliable) {
          drawTensionZoneLabels(
            ctx, si, sj, path,
            tensionTopLabel, TC_TENSION_TOP_COLOR,
            tensionBottomLabel, TC_TENSION_BOTTOM_COLOR,
          );
        }
        if (path.appliedUdlKnM > 0) drawMemberLoadArrows(ctx, si, sj, path.appliedUdlKnM, UNIT_LINE_LOAD, LOAD_ARROW_STYLE);
        drawDiagramEndValues(ctx, si, sj, path, pxScale, unit);
        drawDiagramExtremum(ctx, si, sj, path, pxScale, unit);
      }

      // Σύμβολα στηρίξεων ΤΕΛΕΥΤΑΙΑ → πάνω από το γέμισμα (αλλιώς κρύβονται).
      for (const sp of supportPoints) {
        drawSupportGlyph(ctx, CoordinateTransforms.worldToScreen({ x: sp.x, y: sp.y }, transform, viewport), sp.type);
      }
      ctx.restore();
    };
  }, [active, diagramSet, supportPoints, t]);
}
