'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-483 (T3-UI / Slices 4 + 4b) — Static-analysis diagram overlay (Revit/Robot
 * moment-shear-axial diagrams πάνω στο μοντέλο).
 *
 * Read-only overlay canvas που, όταν είναι ON το toggle «Διαγράμματα Μ/V/N», σχεδιάζει
 * για κάθε φέρον **δοκάρι** του ενεργού ορόφου το διάγραμμα του επιλεγμένου εντατικού
 * μεγέθους (`diagramComponent`: ροπή Μ / τέμνουσα V / αξονική Ν) — καμπύλη offset κάθετα
 * στον άξονα, auto-fit κλίμακα, ετικέτα ακραίας τιμής. Slice 4b προσθέτει: ζώνες
 * εφελκυσμού/θλίψης (ροπή), βέλη ομοιόμορφου φορτίου (UDL), caution σε αστάθεια. Τα
 * δεδομένα είναι **derived** (ADR-481 solver) — μηδέν persistence, μηδέν επανυπολογισμός.
 *
 * ADR-040 micro-leaf: subscribes ΜΟΝΟ εδώ — `useAnalysisDiagramViewStore`
 * (showAnalysisDiagrams + diagramComponent), `ViewMode3DStore` (mode),
 * `AnalysisResultsStore` + `AnalyticalModelStore` (LOW-FREQ — γράφονται μόνο στην
 * «Ανάλυση»). Ο shell `CanvasLayerStack` δεν αποκτά νέο subscription (CHECK 6C safe).
 * Ξεχωριστό canvas + `pointer-events-none` → καμία επίδραση σε selection/hit-test/cache.
 *
 * @see ../../bim/structural/analytical/diagrams/member-diagram-geometry.ts — pure SSoT
 * @see ../../bim/structural/analytical/diagrams/member-load-arrows.ts — UDL βέλη (4b)
 * @see docs/centralized-systems/reference/adrs/ADR-483-static-analysis-canvas-diagrams.md
 */

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { useAnalysisDiagramViewStore } from '../../state/analysis-diagram-view-store';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { AnalysisResultsStore } from '../../bim/structural/analytical/solver/analysis-results-store';
import { AnalyticalModelStore } from '../../bim/structural/analytical/analytical-model-store';
import {
  buildMemberDiagramPaths,
  type DiagramComponent,
  type MemberDiagramSet,
} from '../../bim/structural/analytical/diagrams/member-diagram-geometry';
import {
  drawMemberDiagram,
  drawDiagramExtremum,
  drawDiagramEndValues,
  drawInflectionMarkers,
  drawTensionZoneLabels,
  type DiagramDrawStyle,
} from '../../bim/structural/analytical/diagrams/member-diagram-draw';
import { drawMemberLoadArrows } from '../../bim/structural/analytical/diagrams/member-load-arrows';
import { drawSupportGlyph } from '../../bim/structural/analytical/diagrams/support-glyphs';
import { buildBeamSectionContext } from '../../bim/structural/section-context';
import type { AnalyticalSupportType } from '../../bim/structural/analytical/analytical-model-types';
import { isBeamEntity } from '../../types/entities';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { resolveSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';

/**
 * Ύψος της μέγιστης τιμής ως ποσοστό του μέσου μήκους μέλους (model space). Το
 * διάγραμμα ζει στο model space → κλιμακώνεται **μαζί** με το μοντέλο στο zoom
 * (Revit/Robot moment diagrams), σταθερή αναλογία με το δοκάρι — όχι σταθερό pixel.
 */
const DIAGRAM_HEIGHT_FRACTION = 0.35;

/** Στυλ ανά εντατικό μέγεθος — Robot σύμβαση: Μ κόκκινο / V πράσινο / N μπλε. */
const COMPONENT_STYLE: Record<DiagramComponent, DiagramDrawStyle> = {
  // Ροπή: ζώνες T/C — θετική (sagging) κόκκινο/εφελκ. κάτω, αρνητική (hogging) μπλε/εφελκ. άνω.
  moment: { stroke: 'rgba(200,30,40,0.95)', fill: 'rgba(200,30,40,0.16)', fillNegative: 'rgba(40,90,200,0.16)' },
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

export interface StructuralDiagramOverlayProps {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

export function StructuralDiagramOverlay({ transform, viewport }: StructuralDiagramOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  // Active-floor scene only to resolve units + read beam line-loads (4b arrows). Read
  // directly (mirror HeatLoadOverlay) so a scene replacement is picked up.
  const levelsCtx = useLevelsOptional();
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;
  const scene = active && currentLevelId && getLevelScene ? getLevelScene(currentLevelId) : null;
  const units = resolveSceneUnits(scene);

  const diagramSet = useMemo<MemberDiagramSet | null>(() => {
    if (!active) return null;
    return buildMemberDiagramPaths(model, result, {
      component,
      toCanvasFromMeters: 1 / sceneUnitsToMeters(units),
    });
  }, [active, model, result, units, component]);

  // ADR-483 Slice 4b — γραμμικό φορτίο w_Ed ανά δοκάρι (entityId → kN/m) από το scene
  // (μέλος.id === entityId, 1:1, ADR-480). designLineLoadKnM = ULS UDL (ADR-472).
  const loadByEntityId = useMemo<ReadonlyMap<string, number>>(() => {
    const map = new Map<string, number>();
    if (!active || !scene) return map;
    for (const e of scene.entities) {
      if (!isBeamEntity(e)) continue;
      const w = buildBeamSectionContext(e).designLineLoadKnM ?? 0;
      if (w > 0) map.set(e.id, w);
    }
    return map;
  }, [active, scene]);

  // ADR-483 Slice 4b+ — δεσμευμένοι κόμβοι (στηρίξεις) προβεβλημένοι σε canvas units
  // (μέτρα × toCanvasFromMeters, ίδια μετατροπή με τα paths). Robot boundary glyphs.
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

    if (!active || !diagramSet || diagramSet.globalMaxAbs <= 0 || diagramSet.referenceLengthCanvas <= 0) return;
    // Model-space ύψος (canvas units) της μέγιστης τιμής → screen px μέσω
    // `transform.scale` ⇒ κλιμακώνεται με το zoom (σταθερή αναλογία με το δοκάρι).
    const modelHeightForMax = diagramSet.referenceLengthCanvas * DIAGRAM_HEIGHT_FRACTION;
    const pxScale = (modelHeightForMax / diagramSet.globalMaxAbs) * transform.scale;

    const baseStyle = COMPONENT_STYLE[diagramSet.component];
    const reliable = diagramSet.reliable;
    const style: DiagramDrawStyle = reliable ? baseStyle : { ...baseStyle, stroke: CAUTION_STROKE };
    const unit = COMPONENT_UNIT[diagramSet.component];
    const tcLabels = {
      tensionBottom: t('ribbon.commands.analysisDiagrams.tensionBottom'),
      tensionTop: t('ribbon.commands.analysisDiagrams.tensionTop'),
    };

    ctx.save();
    ctx.setLineDash([]);

    // Σύμβολα στηρίξεων (κάτω από τις καμπύλες/pills) + caption συνδυασμού.
    for (const sp of supportPoints) {
      drawSupportGlyph(ctx, CoordinateTransforms.worldToScreen({ x: sp.x, y: sp.y }, transform, viewport), sp.type);
    }
    if (diagramSet.combinationKind) {
      drawCombinationCaption(ctx, t('ribbon.commands.analysisDiagrams.combinationCaption', { kind: diagramSet.combinationKind }));
    }

    for (const path of diagramSet.paths) {
      const si = CoordinateTransforms.worldToScreen(path.iCanvas, transform, viewport);
      const sj = CoordinateTransforms.worldToScreen(path.jCanvas, transform, viewport);
      drawMemberDiagram(ctx, si, sj, path, pxScale, style, { dashed: !reliable });
      // Σημεία μηδενισμού (M=0) πάνω στον άξονα — κάτω από τα pills.
      drawInflectionMarkers(ctx, si, sj, path);
      // Ζώνες εφελκυσμού/θλίψης μόνο για τη ροπή & μόνο όταν τα αποτελέσματα είναι έγκυρα.
      if (diagramSet.component === 'moment' && reliable) {
        drawTensionZoneLabels(ctx, si, sj, path, tcLabels, TC_TENSION_BOTTOM_COLOR, TC_TENSION_TOP_COLOR);
      }
      const wKnM = loadByEntityId.get(path.memberId);
      if (wKnM) drawMemberLoadArrows(ctx, si, sj, wKnM, UNIT_LINE_LOAD, LOAD_ARROW_STYLE);
      // Τιμές στα άκρα (M_i/M_j) + ακραία στο άνοιγμα — pills πάνω από όλα.
      drawDiagramEndValues(ctx, si, sj, path, pxScale, unit);
      drawDiagramExtremum(ctx, si, sj, path, pxScale, unit);
    }
    ctx.restore();
  }, [active, diagramSet, loadByEntityId, supportPoints, transform, viewport, t]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="analysis-diagrams"
      className="pointer-events-none absolute inset-0 h-full w-full z-10"
      aria-hidden="true"
    />
  );
}
