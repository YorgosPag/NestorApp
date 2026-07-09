/**
 * @module drawing-preview-generator
 * @description Pure functions for generating real-time drawing preview entities.
 * Extracted from useUnifiedDrawing.tsx for separation of concerns and testability.
 *
 * Functions:
 * - generatePreviewEntity(): Creates a preview entity based on tool, existing points, and cursor position
 * - applyPreviewStyling(): Decorates a preview entity with flags, grip points, and measurement info
 */
import type { Point2D } from '../../rendering/types/Types';
import type { PolylineEntity } from '../../types/scene';
import type {
  DrawingTool,
  ExtendedSceneEntity,
  ExtendedPolylineEntity,
  ExtendedCircleEntity,
  ExtendedLineEntity,
  ExtendedArcEntity,
  PreviewPoint,
  PreviewText,
} from './drawing-types';
// ADR-358 Phase 5a — stair preview extracted to stair-preview-helpers.ts (N.7.1 file-size SRP).
import { generateStairPreview } from './stair-preview-helpers';
import type { SceneUnits } from './stair-completion';
// ADR-363 Phase 1C — wall preview extracted to wall-preview-helpers.ts.
import { generateWallPreview } from './wall-preview-helpers';
// ADR-508 §line-cyan — line flush/κάθετο κούμπωμα + κυανές listening dims (ίδιος εγκέφαλος με τον τοίχο).
// ADR-508 §text-parity — annotation ghost placement (position ⊕ κυανές από ΕΝΑ κοινό snap).
import { generateLinePreview, resolveLineListeningPlacement } from './line-preview-helpers';
// ADR-508 §text-parity — 2-click place→rotate: το κλειδωμένο σημείο εισαγωγής (rotation phase) +
// flag «πεδίο ανοιχτό» (κανένα stray ghost ενώ γράφει ο χρήστης).
import { getTextRotationOrigin, isTextEditingActive } from '../../systems/cursor/TextRotationStore';
// ADR-363 Phase 6.5.B — slab preview.
import { generateSlabPreview } from './slab-preview-helpers';
// ADR-514 Φ6 — face-snap κορυφών στο preview (flush + edge-slide): ΙΔΙΟΣ resolver + ΙΔΙΟ store με
// το commit (`useSlabTool`/`useRoofTool.onCanvasClick`) → preview ≡ commit by construction.
import { resolveEffectivePreviewCursor, toWysiwygPreviewEntity } from './wysiwyg-preview-shared';
// ADR-583 Φ2.3 — scale-bar WYSIWYG rubber-band ghost: SAME builder as commit (SSoT
// mapping lives in the store module — N.18, never cloned).
import { buildScaleBarEntityFromLiveOptions } from '../../state/scale-bar-options-store';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { resolvePolygonVertexSnap } from '../../bim/placement/polygon-vertex-snap';
import { polygonVertexLockStore } from '../../bim/placement/polygon-vertex-lock-store';
import { generateWallCoveringPreview } from './wall-covering-preview-helpers';
// ADR-363 Phase 5.5P — beam preview.
import { generateBeamPreview } from './beam-preview-helpers';
// ADR-398 §3.8 — column WYSIWYG preview (real ColumnRenderer ghost).
import { generateColumnPreview } from './column-preview-helpers';
// ADR-436 Slice 2 — foundation line-tool preview (strip / tie-beam band ghost).
// ADR-514 Φ6c — foundation pad live ghost (flush σε παρειά κολόνας ζωντανά).
import { generateFoundationPreview, generateFoundationPadPreview } from './foundation-preview-helpers';
import { LINEWEIGHT_SPECIAL } from '../../config/lineweight-iso-catalog';
import {
  arcFrom3Points,
  arcFromCenterStartEnd,
  arcFromStartCenterEnd,
  circleFrom3Points,
  circleFromChordAndSagitta,
  circleFrom2PointsAndRadius,
  circleBestFit,
  calculateDistance,
  calculateAngle,
  pointOnCircle,
} from '../../rendering/entities/shared';
import { GEOMETRY_PRECISION } from '../../config/tolerance-config';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { getDefaultLayerId } from '../../stores/LayerStore';
// ADR-359 Phase 3 — XLine / Ray preview helpers (extracted).
import { generateXLinePreview, generateRayPreview } from './xline-ray-preview-helpers';
// ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped (schema flip deferred to 9D-5b).
// ─── Callback types for dependency injection ───────────────────────────────
/** Creates an entity from tool + points. Injected to avoid circular dependency. */
export type CreateEntityFn = (tool: DrawingTool, points: Point2D[]) => ExtendedSceneEntity | null;
/** Applies ColorPalettePanel preview settings to an entity. Injected because it depends on hook state. */
export type ApplySettingsFn = (entity: Record<string, unknown>) => void;
// ─── Helper: create a rubber-band polyline preview ─────────────────────────
function makeRubberBandPolyline(id: string, vertices: Point2D[]): ExtendedPolylineEntity {
  const base: PolylineEntity = {
    id,
    type: 'polyline',
    vertices,
    closed: false,
    visible: true,
    layerId: getDefaultLayerId(),
    color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
    lineweight: LINEWEIGHT_SPECIAL.BYLAYER,
    opacity: 1.0,
    lineType: 'solid' as const,
  };
  return {
    ...base,
    preview: true,
    showEdgeDistances: true,
    showPreviewGrips: true,
  } as ExtendedPolylineEntity;
}
/**
 * ADR-514 Φ6 — face-snap της ζωντανής κορυφής (πλάκα/στέγη) για το ghost outline. Ο cursor
 * περνά πρώτα από το ήδη-OSNAP-snapped σημείο (`resolveEffectivePreviewCursor`, mirror του commit
 * `bimPoint`) και μετά από τον ΙΔΙΟ polygon-vertex resolver + ΙΔΙΟ lock store με το commit → flush
 * + edge-slide ΑΚΡΙΒΩΣ όπως θα κλειδώσει το κλικ (preview ≡ commit). Στόχοι από το κοινό store.
 */
function resolvePolygonPreviewCursor(cursorPoint: Point2D, sceneUnits: SceneUnits): Point2D {
  const eff = resolveEffectivePreviewCursor(cursorPoint);
  const snap = resolvePolygonVertexSnap(eff, sceneSnapTargetsStore.get(), sceneUnits, polygonVertexLockStore.get() ?? undefined);
  return snap.point;
}

/**
 * ADR-508 §text-parity — φάντασμα annotation (Κείμενο/Πολυγραμμικό Κείμενο). Το σημείο εισαγωγής
 * κουμπώνει flush σε παρειά μέλους (όταν υπάρχει εντός capture) και φέρει τις ΙΔΙΕΣ κυανές listening
 * dims με τη γραμμή — αμφότερα από το ΕΝΑ κοινό `resolveLineListeningPlacement` snap. Η ίδια η λέξη
 * ΔΕΝ αποθηκεύεται (pure fn· N.11) — ο painter (`preview-text-paint`) την επιλύει μέσω `i18n.t('tools.text')`.
 */
function generateTextPreview(cursorPoint: Point2D, sceneUnits: SceneUnits): PreviewText | null {
  // ── Πεδίο ανοιχτό (μετά το 2ο κλικ, γράφει ο χρήστης): κανένα stray φάντασμα-λέξη στη θέση cursor.
  if (isTextEditingActive()) return null;
  // ── Rotation phase (μετά το 1ο κλικ): το σημείο εισαγωγής είναι ΚΛΕΙΔΩΜΕΝΟ· το φάντασμα-λέξη
  //    περιστρέφεται προς τον κέρσορα. Ο `cursorPoint` έρχεται ΗΔΗ ΟΡΘΟ/Polar-snapped (F8/F10) από
  //    το hover pipeline (μέσω `getBimOrthoReference('text') = origin`) → η γωνία κουμπώνει σε
  //    0°/90°/45°... Ίδια CCW σύμβαση με το commit → preview ≡ commit. Καμία κυανή εδώ (η θέση κλείδωσε).
  const rotationOrigin = getTextRotationOrigin();
  if (rotationOrigin) {
    const rotationDeg = (Math.atan2(cursorPoint.y - rotationOrigin.y, cursorPoint.x - rotationOrigin.x) * 180) / Math.PI;
    return {
      id: 'preview_text_ghost',
      type: 'text',
      position: rotationOrigin,
      rotationDeg,
      visible: true,
      layerId: getDefaultLayerId(),
      preview: true,
    };
  }
  // ── Φάση τοποθέτησης (πριν το 1ο κλικ): φάντασμα στη θέση εισαγωγής (flush) + κυανές listening dims.
  const { point, faceDimensions } = resolveLineListeningPlacement(cursorPoint, sceneUnits);
  return {
    id: 'preview_text_ghost',
    type: 'text',
    position: point,
    visible: true,
    layerId: getDefaultLayerId(),
    preview: true,
    ...(faceDimensions ? { faceDimensions } : {}),
  };
}

/**
 * Generates a preview entity based on the active tool, existing clicked points, and cursor position.
 *
 * This is a pure function — it produces a new entity object without side effects.
 *
 * @param tool - The active drawing tool
 * @param tempPoints - Points already clicked by the user (from state machine)
 * @param cursorPoint - Current cursor position in world space
 * @param arcFlipped - Whether the arc direction is flipped
 * @param createEntity - Callback to create standard entities (injected from hook)
 * @returns A preview entity, or null if no preview should be shown
 */
export function generatePreviewEntity(
  tool: DrawingTool,
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  arcFlipped: boolean,
  createEntity: CreateEntityFn,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  // ── ADR-358 Phase 5a — Stair tool preview branch ─────────────────────────
  if (tool === 'stair') {
    return generateStairPreview(tempPoints, cursorPoint, {}, sceneUnits);
  }
  // ── ADR-363 Phase 1C — Wall tool preview branch ──────────────────────────
  if (tool === 'wall') {
    return generateWallPreview(tempPoints, cursorPoint, sceneUnits);
  }
  // ── ADR-363 Phase 6.5.B — Slab tool preview branch ───────────────────────
  // ADR-514 Φ6 — η ζωντανή κορυφή κουμπώνει flush σε παρειά μέλους (+ edge-slide) πριν χτιστεί το
  // ghost outline → preview ≡ commit. (Μόνο slab/roof· floor-finish/hatch/underfloor αμετάβλητα.)
  if (tool === 'slab') {
    return generateSlabPreview(tempPoints, resolvePolygonPreviewCursor(cursorPoint, sceneUnits));
  }
  // ── ADR-417 — Roof tool preview branch (footprint polygon ghost, reuses the
  //    slab polygon-outline preview — both are closed footprints). ───────────
  if (tool === 'roof') {
    return generateSlabPreview(tempPoints, resolvePolygonPreviewCursor(cursorPoint, sceneUnits));
  }
  // ── ADR-419 — Floor Finish tool preview branch (closed footprint polygon,
  //    same rubber-band outline as slab/roof). ───────────────────────────────
  if (tool === 'floor-finish') {
    return generateSlabPreview(tempPoints, cursorPoint);
  }
  // ── ADR-511 — Wall Covering tool preview branch. Computes the live face strip
  //    from the locked draw-context store + projected cursor (not from tempPoints). ─
  if (tool === 'wall-covering') {
    return generateWallCoveringPreview(cursorPoint);
  }
  // ── ADR-507 S2 — Hatch tool preview branch (closed boundary polygon, same
  //    rubber-band outline as slab/floor-finish). ─────────────────────────────
  if (tool === 'hatch') {
    return generateSlabPreview(tempPoints, cursorPoint);
  }
  // ── ADR-408 Εύρος Β #3 — Underfloor heating tool preview branch (closed
  //    footprint polygon, same rubber-band outline as slab/roof/floor-finish). ─
  if (tool === 'mep-underfloor') {
    return generateSlabPreview(tempPoints, cursorPoint);
  }
  // ── ADR-363 Phase 5.5P — Beam tool preview branch ────────────────────────
  if (tool === 'beam') {
    return generateBeamPreview(tempPoints, cursorPoint, sceneUnits);
  }
  // ── ADR-363 §column-polygon-sketch — «Κολώνα από σχεδιασμένο πολύγωνο» branch ─
  //    N-click closed-footprint polygon (ΙΔΙΟ vertex-chain engine με slab) → reuse
  //    του tool-agnostic `generateSlabPreview` rubber-band outline + του ΙΔΙΟΥ
  //    face-snap cursor (`resolvePolygonPreviewCursor`) → preview ≡ commit. Ελέγχεται
  //    ΠΡΙΝ το single-click 'column' branch (διαφορετικό placement mode).
  if (tool === 'column-from-polygon') {
    return generateSlabPreview(tempPoints, resolvePolygonPreviewCursor(cursorPoint, sceneUnits));
  }
  // ── ADR-398 §3.8 — Column tool WYSIWYG preview branch ─────────────────────
  //    Single-click member → no rubber-band tempPoints; the ghost is built from
  //    the snapped cursor + the live column-tool bridge/face-snap SSoT (preview
  //    === commit). Replaces the legacy 9-anchor schematic ghost.
  if (tool === 'column') {
    return generateColumnPreview(cursorPoint, sceneUnits);
  }
  // ── ADR-508 §line-cyan — Line tool flush/κάθετο κούμπωμα σε υφιστάμενη γραμμή/μέλος + κυανές
  //    listening dimensions (ΙΔΙΟΣ εγκέφαλος έλξης με τον τοίχο → preview ≡ commit). Επιστρέφει το
  //    stub/awaiting-end ghost ΜΟΝΟ όταν υπάρχει παρειά εντός capture· αλλιώς `null` → fall-through
  //    στη γενική διαδρομή (τελεία αφετηρίας / κανονική ελεύθερη γραμμή). ──────────────────────────
  if (tool === 'line') {
    const lineGhost = generateLinePreview(tempPoints, cursorPoint, sceneUnits);
    if (lineGhost) return lineGhost;
  }
  // ── ADR-060 — «Κάθετη γραμμή» state-0 (πριν το 1ο κλικ): ΤΑΥΤΟΣΗΜΟ hover φάντασμα + κυανές με τη
  //    γραμμή (ΙΔΙΟΣ tool-agnostic `generateLinePreview`). Το state-1 (μετά το 1ο κλικ) πέφτει στο
  //    generic `createEntity(...)` fallback — ο `cursorPoint` έρχεται ΗΔΗ κάθετα-κλειδωμένος από το
  //    `drawing-hover-handler` (hard axis lock) → preview ≡ commit, μηδέν νέα γεωμετρία εδώ. ──────────
  if (tool === 'line-perpendicular') {
    const lineGhost = generateLinePreview(tempPoints, cursorPoint, sceneUnits);
    if (lineGhost) return lineGhost;
  }
  // ── ADR-508 §polyline-parity (Giorgio 2026-07-07) — Πολυγραμμή state-0 (πριν το 1ο κλικ):
  //    ΤΑΥΤΟΣΗΜΟ hover φάντασμα (κάθετο stub) + κυανές listening dims με τη ΓΡΑΜΜΗ, μέσω του ΙΔΙΟΥ
  //    tool-agnostic `generateLinePreview` (zero-width member face-snap). Μετά το 1ο κλικ → `null`
  //    (fall-through στο generic rubber-band, γρ. ~247)· οι κυανές/HUD/βελάκια του ενεργού segment
  //    προστίθενται τότε στο `applyPreviewStyling` + overlays. Μηδέν νέος painter/μηχανισμός. ────────
  if (tool === 'polyline' && tempPoints.length === 0) {
    const lineGhost = generateLinePreview(tempPoints, cursorPoint, sceneUnits);
    if (lineGhost) return lineGhost;
  }
  // ── ADR-436 Slice 2 — Foundation line tools (strip / tie-beam) preview branch.
  //    from-wall (1-click pick) has no rubber-band band (mirror beam-from-wall). ──
  if (tool === 'foundation-strip' || tool === 'foundation-tie-beam') {
    return generateFoundationPreview(tempPoints, cursorPoint, sceneUnits);
  }
  // ── ADR-514 Φ6c — Foundation pad live ghost (single-click): WYSIWYG pad που κουμπώνει ΖΩΝΤΑΝΑ
  //    flush σε παρειά/άξονα κολόνας/μέλους (ΙΔΙΟΣ εγκέφαλος με το commit → preview ≡ commit). ──
  if (tool === 'foundation-pad') {
    return generateFoundationPadPreview(cursorPoint, sceneUnits);
  }
  // ── ADR-359 Phase 3 — XLine preview ──────────────────────────────────────
  if (tool === 'xline') {
    return generateXLinePreview(tempPoints, cursorPoint);
  }
  // ── ADR-359 Phase 3 — Ray preview ────────────────────────────────────────
  if (tool === 'ray') {
    return generateRayPreview(tempPoints, cursorPoint);
  }
  // ── ADR-508 §text-parity (Giorgio 2026-07-07) — «Κείμενο»/«Πολυγραμμικό Κείμενο» (single-click):
  //    ζωντανό φάντασμα-λέξη στη θέση εισαγωγής + ΙΔΙΕΣ ενδείξεις τοποθέτησης με τη γραμμή. Οι λευκές
  //    γραμμές ευθυγράμμισης έρχονται δωρεάν (ο cursorPoint είναι ήδη post-tracking) μόλις υπάρξει
  //    non-null previewEntity· οι κυανές flush-to-face + το flush σημείο εισαγωγής προκύπτουν από τον
  //    ΙΔΙΟ εγκέφαλο έλξης της γραμμής (zero-width member). Η λέξη επιλύεται i18n στον painter (N.11). ─
  if (tool === 'text' || tool === 'mtext') {
    return generateTextPreview(cursorPoint, sceneUnits);
  }
  // ── ADR-583 Φ2.3 — Scale-bar WYSIWYG rubber-band ghost («origin» κλειδωμένο,
  //    live cursor = axis angle + dragged length). Πριν το 1ο κλικ
  //    (`tempPoints.length === 0`) πέφτει στο κοινό start-dot branch παρακάτω
  //    (`needsStartDot`). Εδώ χτίζεται η ΠΛΗΡΗΣ `ScaleBarEntity` μέσω του ΙΔΙΟΥ
  //    builder με το commit (`buildScaleBarEntityFromLiveOptions`, preview≡commit
  //    ADR-574) + flag `wysiwygPreview` ώστε ο `PreviewCanvas` να τη ζωγραφίσει
  //    μέσω του πραγματικού `ScaleBarRenderer` — ζωντανό nice-number μήκος +
  //    checkerboard/hollow/ticks + ετικέτες, όχι σχηματικό περίγραμμα. ──────────
  if (tool === 'scale-bar' && tempPoints.length >= 1) {
    const scaleBarGhost = buildScaleBarEntityFromLiveOptions(
      tempPoints[0],
      cursorPoint,
      'preview_scale_bar_ghost',
      getDefaultLayerId(),
    );
    return toWysiwygPreviewEntity(scaleBarGhost, 'preview_scale_bar_ghost');
  }
  // ── Zero-point preview: show start indicator ─────────────────────────────
  if (tempPoints.length === 0) {
    const isMeasurementTool =
      tool === 'measure-distance' ||
      tool === 'measure-distance-continuous' ||
      tool === 'measure-area' ||
      tool === 'measure-angle' ||
      tool === 'measure-angle-measuregeom';
    // All tools that need a starting dot
    const needsStartDot =
      tool === 'line' || tool === 'line-perpendicular' || tool === 'measure-distance' || tool === 'measure-distance-continuous' ||
      tool === 'rectangle' || tool === 'circle' || tool === 'circle-diameter' ||
      tool === 'circle-2p-diameter' || tool === 'circle-3p' || tool === 'circle-chord-sagitta' ||
      tool === 'circle-2p-radius' || tool === 'polygon' || tool === 'polyline' ||
      tool === 'measure-area' || tool === 'measure-angle' ||
      tool === 'measure-angle-measuregeom' ||
      tool === 'arc-3p' || tool === 'arc-cse' || tool === 'arc-sce' ||
      tool === 'scale-bar'; // ADR-583 Φ2 — 2-click tool, mirror 'line'
    if (needsStartDot) {
      return {
        id: 'preview_start',
        type: 'point',
        position: cursorPoint,
        size: 4,
        visible: true,
        layerId: getDefaultLayerId(),
        preview: true,
        showPreviewGrips: true,
        ...(isMeasurementTool && { measurement: true }),
      } as PreviewPoint;
    }
    return null;
  }
  // ── Multi-point preview: show shape being drawn ──────────────────────────
  const worldPoints = [...tempPoints, cursorPoint];
  // ── Circle-3p ────────────────────────────────────────────────────────────
  if (tool === 'circle-3p') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_circle3p_rubberband', worldPoints);
    }
    if (tempPoints.length >= 2) {
      const circleResult = circleFrom3Points(worldPoints[0], worldPoints[1], worldPoints[2]);
      if (circleResult) {
        return {
          id: 'preview_circle3p',
          type: 'circle',
          center: circleResult.center,
          radius: circleResult.radius,
          visible: true,
          layerId: getDefaultLayerId(),
          preview: true,
          showPreviewGrips: true,
        } as ExtendedCircleEntity;
      }
      // Collinear fallback
      return makeRubberBandPolyline('preview_circle3p_rubberband', worldPoints);
    }
  }
  // ── Circle-chord-sagitta ─────────────────────────────────────────────────
  if (tool === 'circle-chord-sagitta') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_chord_sagitta_rubberband', worldPoints);
    }
    if (tempPoints.length >= 2) {
      const circleResult = circleFromChordAndSagitta(worldPoints[0], worldPoints[1], worldPoints[2]);
      if (circleResult) {
        return {
          id: 'preview_chord_sagitta',
          type: 'circle',
          center: circleResult.center,
          radius: circleResult.radius,
          visible: true,
          layerId: getDefaultLayerId(),
          preview: true,
          showPreviewGrips: true,
        } as ExtendedCircleEntity;
      }
      return makeRubberBandPolyline('preview_chord_sagitta_rubberband', worldPoints);
    }
  }
  // ── Circle-2p-radius ─────────────────────────────────────────────────────
  if (tool === 'circle-2p-radius') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_2p_radius_rubberband', worldPoints);
    }
    if (tempPoints.length >= 2) {
      const circleResult = circleFrom2PointsAndRadius(worldPoints[0], worldPoints[1], worldPoints[2]);
      if (circleResult) {
        return {
          id: 'preview_2p_radius',
          type: 'circle',
          center: circleResult.center,
          radius: circleResult.radius,
          visible: true,
          layerId: getDefaultLayerId(),
          preview: true,
          showPreviewGrips: true,
        } as ExtendedCircleEntity;
      }
      return makeRubberBandPolyline('preview_2p_radius_rubberband', worldPoints);
    }
  }
  // ── Circle-best-fit ──────────────────────────────────────────────────────
  if (tool === 'circle-best-fit') {
    if (tempPoints.length === 1 || tempPoints.length === 2) {
      return makeRubberBandPolyline('preview_bestfit_rubberband', worldPoints);
    }
    // 3+ clicked points + cursor
    const circleResult = circleBestFit(worldPoints);
    if (circleResult) {
      return {
        id: 'preview_bestfit',
        type: 'circle',
        center: circleResult.center,
        radius: circleResult.radius,
        visible: true,
        layerId: getDefaultLayerId(),
        preview: true,
        showPreviewGrips: true,
      } as ExtendedCircleEntity;
    }
    return makeRubberBandPolyline('preview_bestfit_rubberband', worldPoints);
  }
  // ── Arc tools (arc-3p, arc-cse, arc-sce) ─────────────────────────────────
  if (tool === 'arc-3p' || tool === 'arc-cse' || tool === 'arc-sce') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_arc_rubberband', worldPoints);
    }
    if (tempPoints.length >= 2) {
      // Calculate arc based on tool type
      let arcResult: {
        center: Point2D;
        radius: number;
        startAngle: number;
        endAngle: number;
        counterclockwise?: boolean;
      } | null = null;
      if (tool === 'arc-3p') {
        arcResult = arcFrom3Points(worldPoints[0], worldPoints[1], worldPoints[2]);
      } else if (tool === 'arc-cse') {
        arcResult = arcFromCenterStartEnd(worldPoints[0], worldPoints[1], worldPoints[2]);
      } else if (tool === 'arc-sce') {
        arcResult = arcFromStartCenterEnd(worldPoints[0], worldPoints[1], worldPoints[2]);
      }
      if (arcResult) {
        // Calculate construction vertices based on tool type
        let constructionVerts: Point2D[];
        if (tool === 'arc-cse') {
          const center = worldPoints[0];
          const start = worldPoints[1];
          const cursor = worldPoints[2];
          const dist = calculateDistance(center, cursor);
          const projectedEnd = dist > GEOMETRY_PRECISION.POINT_MATCH
            ? pointOnCircle(center, arcResult.radius, calculateAngle(center, cursor))
            : start;
          constructionVerts = [center, start, projectedEnd];
        } else if (tool === 'arc-sce') {
          const start = worldPoints[0];
          const center = worldPoints[1];
          const cursor = worldPoints[2];
          const dist = calculateDistance(center, cursor);
          const projectedEnd = dist > GEOMETRY_PRECISION.POINT_MATCH
            ? pointOnCircle(center, arcResult.radius, calculateAngle(center, cursor))
            : start;
          constructionVerts = [start, center, projectedEnd];
        } else {
          // arc-3p: all points define the circumference
          constructionVerts = worldPoints;
        }
        const finalCounterclockwise = arcFlipped
          ? !arcResult.counterclockwise
          : arcResult.counterclockwise;
        const arcPreview: ExtendedArcEntity = {
          id: 'preview_arc',
          type: 'arc',
          center: arcResult.center,
          radius: arcResult.radius,
          startAngle: arcResult.startAngle,
          endAngle: arcResult.endAngle,
          visible: true,
          layerId: getDefaultLayerId(),
          preview: true,
          showPreviewGrips: true,
          constructionVertices: constructionVerts,
          showConstructionLines: true,
          showEdgeDistances: true,
          counterclockwise: finalCounterclockwise,
          constructionLineMode: tool === 'arc-3p' ? 'polyline' : 'radial',
        };
        return arcPreview;
      }
      // Arc calculation failed (collinear) — show polyline fallback
      return makeRubberBandPolyline('preview_arc_rubberband', worldPoints);
    }
  }
  // ── All other tools: delegate to createEntity ────────────────────────────
  return createEntity(tool, worldPoints);
}
// Re-export from extracted module for backward compatibility
export { applyPreviewStyling, createPartialPreview } from './drawing-preview-partial';
