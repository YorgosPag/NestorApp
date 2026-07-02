/**
 * @module drawing-hover-handler
 * @description Pure function for processing drawing hover events.
 * Extracted from useDrawingHandlers.ts (ADR-363 Phase 1C).
 */
import type React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ToolType } from '../../ui/toolbar/types';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import type { PolarSnapResult } from '../../systems/constraints/polar-utils';
import type { ExtendedSceneEntity } from './drawing-types';
import {
  TrackingPointStore,
  ACQUISITION_DURATION_MS,
} from '../../systems/tracking/TrackingPointStore';
// ADR-357 / ADR-397 — κοινός SSoT resolver του alignment tracking (acquired ⊕ ambient),
// μοιραζόμενος με την περιστροφή (rotation-tracking-overlay). Πριν ήταν inline μόνο εδώ.
import { resolveAlignmentTracking } from '../../systems/tracking/resolve-alignment-tracking';
import { ambientAlignmentConfigStore } from '../../systems/tracking/ambient-alignment-config-store';
import { formatLengthForDisplay } from '../../config/display-length-format';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
// ADR-362 — dim entity pick reads the entity-under-cursor from the hit-test SSoT
// (HoverStore), matching AutoCAD DIMRADIUS (pick the body, not an OSNAP point).
import { getHoveredEntity } from '../../systems/hover/HoverStore';
import { formatPolarLabel, faceRelativeDisplayAngle } from '../../systems/constraints/polar-utils';
import { SnapOverrideOrchestrator } from '../../snapping/overrides/SnapOverrideOrchestrator';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { resolveOrthoPolarStep } from './drawing-handler-utils';
// ADR-363: BIM tools (wall/stair/beam/slab) keep their points in dedicated
// preview stores, not in `tempPoints`. Resolve the ortho/polar anchor from
// there so the rubber-band preview honours F8/F10 (preview == commit).
import { getBimOrthoReference, resolveWallFaceRelativePolar } from './bim-ortho-reference';
// ADR-363 §wall-ortho-tracking — OTRACK acquire (osnap-σε-οντότητα → tracking anchor) + Q-νικά-μαγνήτη.
import { setPlacementTrackingAnchor } from '../../systems/cursor/PlacementTrackingAnchorStore';
import { isGripStepActive } from '../../bim/grips/grip-step-quantize';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
// ADR-544 — ΕΝΑΣ canonical type για τα overlay-meta πεδία του placement ghost (πλέγμα/διαστάσεις/
// οδηγός)· SSoT κοινός με τον 3D reader (placement-overlay-meta) — μηδέν διπλή γνώση πεδίων.
import type { PlacementOverlayFields } from '../../bim/placement/placement-overlay-fields';
import type { WallHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';
import { buildWallHudSpecLabel } from './wall-hud-spec-label';
// ADR-564 §footprint-hud — footprint HUD κολόνας/πέδιλου κατά την τοποθέτηση (πλάτος/βάθος/∠/ύψος).
import { buildColumnHudSpecLabel } from './column-hud-spec-label';
import type { ColumnParams } from '../../bim/types/column-types';
// ADR-564 §foundation-hud — entity-agnostic footprint HUD descriptor (πέδιλο-pad ξαναχρησιμοποιεί τον
// ΙΔΙΟ pure painter με την κολόνα μέσω ελάχιστου περιγραφέα, χωρίς ColumnParams).
import type { FootprintHudDescriptor } from '../../canvas-v2/preview-canvas/column-hud-paint';
// ADR-508 §column place+rotate — πορτοκαλί γραμμή στρέψης + γωνία κατά το awaitingRotation.
import { getColumnRotationLock } from '../../systems/cursor/ColumnRotationStore';
import { resolveColumnRotationDeg } from '../../bim/columns/column-rotation';
// ADR-362 hotfix: DetectableEntity for smart dim type detection via snap entityId
import type { DetectableEntity } from '../../systems/dimensions/dim-smart-detector';
// ADR-362 hotfix (2026-05-19): skip-snap helper for dimLineRef phase — preview
// must follow the raw cursor (not snap) so it agrees with the commit.
import { isDimLineRefPhase } from '../dimensions/dim-skip-snap';
// ADR-513 / ADR-357 Phase 13 G14: length/angle lock geometry constraint (SSoT helper —
// shared με το wall click-commit ώστε preview ≡ committed).
import { applyLengthAngleLock } from '../../systems/dynamic-input/length-angle-lock';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
// ADR-508 §opening-conflict — i18n instance (non-React) για το 🔴 tooltip «κόβει άνοιγμα».
import { i18n } from '@/i18n';

const DEBUG_DRAWING_HANDLERS = false;

// 🔬 ADR-516 perf trace (wall-tool lag diagnosis): when true, logs a per-op
// breakdown ONLY for laggy frames (≥ PERF_DRAWHOVER_WARN_MS). Set to false again
// once measured. Separate from DEBUG_DRAWING_HANDLERS so it adds no other noise.
const PERF_DRAWHOVER_TRACE = true;
const PERF_DRAWHOVER_WARN_MS = 4; // ~1/4 frame @60fps — flag anything above this

type Pt = Point2D;
type TransformUtils = { worldToScreen: (pt: Pt) => Pt; screenToWorld: (pt: Pt) => Pt };
type FindSnapResult = { found?: boolean; activeMode?: string | null; snappedPoint?: Pt; entityId?: string };

export interface DrawingHoverCtx {
  activeTool: ToolType;
  isDimTool: boolean;
  /** ADR-362 hotfix: entity param added so smart dim detector sees the hovered entity. */
  handleDimHover: (p: Pt | null, hoveredEntity?: DetectableEntity) => void;
  isCenterMarkTool: boolean;
  handleCenterMarkHover: (p: Pt | null) => void;
  tempPoints: readonly Pt[];
  applySnap: (p: Pt) => Pt;
  getTransformUtils: () => TransformUtils;
  getTransformScale: () => number;
  previewCanvasRef?: React.RefObject<PreviewCanvasHandle>;
  orthoOnRef: React.MutableRefObject<boolean>;
  polarOnRef: React.MutableRefObject<boolean>;
  findSnapPointRef: React.MutableRefObject<((x: number, y: number) => FindSnapResult | null) | undefined>;
  trackingHoverRef: React.MutableRefObject<{ point: Pt | null; snapType: string | null; hoverStartedAt: number }>;
  updatePreview: (pt: Pt, transformUtils: TransformUtils) => void;
  getLatestPreviewEntity: () => ExtendedSceneEntity | null;
  /** ADR-362 hotfix: resolve snap entityId → DetectableEntity for smart dim type detection. */
  resolveEntity: (id: string) => DetectableEntity | undefined;
  /** ADR-357 ambient alignment: event-time scene entities (floor-scoped, no subscription). */
  getSceneEntities: () => readonly Entity[];
  /** ADR-357 ambient alignment: mm→scene-units factor for the (zoom-independent) radius. */
  getSceneUnitsScale: () => number;
}

export function processDrawingHover(p: Pt | null, ctx: DrawingHoverCtx): void {
  const {
    activeTool, isDimTool, handleDimHover,
    isCenterMarkTool, handleCenterMarkHover,
    tempPoints, applySnap,
    getTransformUtils, getTransformScale,
    previewCanvasRef, orthoOnRef, polarOnRef,
    findSnapPointRef, trackingHoverRef,
    updatePreview, getLatestPreviewEntity,
    resolveEntity,
    getSceneEntities, getSceneUnitsScale,
  } = ctx;
  // 🏢 ADR-362 Phase D1: route dim tools through the dedicated orchestrator.
  if (isDimTool) {
    // ADR-362 hotfix (2026-05-19): symmetric to onDrawingPoint — skip snap on
    // the dim-line-offset hover so preview position equals committed position.
    const skipSnap = isDimLineRefPhase();
    const snapped = p ? (skipSnap ? p : applySnap(p)) : null;
    // ADR-362 hotfix: pass hovered entity to smart dim detector so it can resolve
    // correct dim type (line→aligned, circle→diameter, arc→radius, etc.)
    // Skip entity resolution on dimLineRef phase — no entity to hit anyway.
    let hoveredEntity: DetectableEntity | undefined;
    if (p && !skipSnap) {
      // Primary: entity under the cursor via the hit-test SSoT (HoverStore, filled
      // by the hover-highlight pass now that dim tools are in `entityPickingActive`).
      // Fallback: snap.entityId when the cursor snapped onto an entity's OSNAP point.
      const snap = findSnapPointRef.current?.(p.x, p.y);
      const hoveredId = getHoveredEntity() ?? snap?.entityId;
      if (hoveredId) hoveredEntity = resolveEntity(hoveredId);
    }
    handleDimHover(snapped, hoveredEntity);
    return;
  }
  // ADR-362 Phase L2: center mark hover (rubber-band preview).
  if (isCenterMarkTool) {
    handleCenterMarkHover(p ? applySnap(p) : null);
    return;
  }
  // 🔍 STOP 1 DEBUG TRACE (2026-02-01): Comprehensive preview flow tracing
  if (DEBUG_DRAWING_HANDLERS) {
    console.debug('🔍 [onDrawingHover] ENTRY', {
      activeTool,
      hasPoint: !!p,
      worldPos: p ? `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})` : 'null',
      hasPreviewRef: !!previewCanvasRef?.current,
      timestamp: performance.now().toFixed(1)
    });
  }
  if (p) {
    // 🔍 PERF DEBUG (2026-02-02): Measure where the bottleneck is
    const t0 = performance.now();
    // 🚀 PERFORMANCE (2026-01-27): REMOVED RAF throttling for synchronous preview rendering
    // Now that CrosshairOverlay uses ImmediatePositionStore for zero-latency updates,
    // the preview grips must also update synchronously to avoid visible lag.
    // The mouse event handler is already called on each mousemove - no need to batch.
    const transformUtils = getTransformUtils();
    const t1 = performance.now();
    // Apply ortho (F8) or polar (F10) constraint before preview — mutually exclusive.
    // BIM tools have an empty `tempPoints`; fall back to their preview-store anchor
    // so the ghost follows F8/F10 exactly like the committed geometry will.
    const lastRefPt = tempPoints[tempPoints.length - 1] ?? getBimOrthoReference(activeTool) ?? undefined;
    let polarSnapResult: PolarSnapResult | null = null;
    let previewPt = p;
    // ADR-508 — wall 2nd click anchored to a member face → relative-polar-to-face magnet
    // (auto, supersedes world polar) + its own zoom-adaptive length step. Returns null when
    // ORTHO is on or the start is not face-anchored. Shares the SSoT with the commit path.
    // ADR-363 §wall-ortho-tracking — Q (F9+Q) ΝΙΚΑ τον μαγνήτη (ίδιο με το commit path) ώστε το
    // ρητό βήμα του χρήστη να εφαρμόζεται αντί του zoom-adaptive step του magnet.
    const faceRel = isGripStepActive() ? null : resolveWallFaceRelativePolar(p, worldPerPixel(getTransformScale()));
    if (faceRel) {
      polarSnapResult = faceRel.result;
      previewPt = faceRel.result.point;
    } else if (lastRefPt) {
      // ADR-363 — ORTHO(F8) → POLAR(F10) → fixed-step(F9+Q) via the shared SSoT
      // (`resolveOrthoPolarStep`), the EXACT pipeline both commit paths use
      // (`onDrawingPoint` generic + `applyBimDrawingConstraint` BIM) → ghost ≡ committed
      // geometry (WYSIWYG), zero duplication. Step is a no-op unless F9 armed + Q held.
      const opStep = resolveOrthoPolarStep(p, lastRefPt, { ortho: orthoOnRef.current, polar: polarOnRef.current });
      polarSnapResult = opStep.polarResult;
      previewPt = opStep.stepped;
    }
    // ADR-357 Phase 7: Snap Override — filter preview snap to override engine.
    // Only applies to single-use engine overrides (not 'from'/'m2p' which have
    // their own multi-click flow). The preview rubber-band locks to the override
    // engine's snap point when found; otherwise falls back to cursor position.
    const snapOverrideForHover = SnapOverrideOrchestrator.getOverride();
    const findSnapFnForHover = findSnapPointRef.current;
    if (snapOverrideForHover && snapOverrideForHover !== 'from' && snapOverrideForHover !== 'm2p' && findSnapFnForHover) {
      const engineTarget = snapOverrideForHover === 'app'
        ? ExtendedSnapType.INTERSECTION
        : snapOverrideForHover as ExtendedSnapType;
      try {
        const overrideResult = findSnapFnForHover(previewPt.x, previewPt.y);
        if (overrideResult?.found && overrideResult.activeMode === engineTarget && overrideResult.snappedPoint) {
          previewPt = overrideResult.snappedPoint;
        }
      } catch { /* snap error — keep previewPt unchanged */ }
    }
    // ADR-357 Phase 4: Object Snap Tracking — acquisition timer + resolver.
    // Acquisition: when ImmediateSnapStore reports a stable snap candidate
    // for ACQUISITION_DURATION_MS, the point joins the FIFO. Resolution:
    // alignment paths from acquired points override `previewPt` when the
    // cursor crosses one (priority intersection > projection).
    const trackingState = trackingHoverRef.current;
    const immediateSnap = getImmediateSnap();
    const isDrawingTool = activeTool !== 'select' && activeTool !== 'pan';
    // ADR-363 §wall-ortho-tracking (OTRACK acquire) — «κλείδωσε» το osnap-σε-οντότητα σημείο ως tracking
    // αναφορά για το 1ο σημείο του τοίχου (ΟΡΘΟ/Q ως προς τη διπλανή κολόνα). `mode!=='grid'` → μόνο
    // πραγματικές οντότητες (όχι το πλέγμα). Sticky: κρατά την τελευταία όσο ο κέρσορας είναι ελεύθερος.
    if (isDrawingTool && immediateSnap?.found && immediateSnap.mode !== 'grid') {
      setPlacementTrackingAnchor(immediateSnap.point);
    }
    if (isDrawingTool && immediateSnap?.found) {
      const sameAsLast = trackingState.point
        && trackingState.snapType === immediateSnap.mode
        && Math.hypot(trackingState.point.x - immediateSnap.point.x, trackingState.point.y - immediateSnap.point.y) < 0.5;
      if (sameAsLast) {
        if (performance.now() - trackingState.hoverStartedAt >= ACQUISITION_DURATION_MS) {
          TrackingPointStore.acquirePoint(immediateSnap.point, immediateSnap.mode);
          trackingState.point = null;
          trackingState.snapType = null;
          trackingState.hoverStartedAt = 0;
        }
      } else {
        trackingState.point = { x: immediateSnap.point.x, y: immediateSnap.point.y };
        trackingState.snapType = immediateSnap.mode;
        trackingState.hoverStartedAt = performance.now();
      }
    } else {
      trackingState.point = null;
      trackingState.snapType = null;
      trackingState.hoverStartedAt = 0;
      if (isDrawingTool) TrackingPointStore.touch();
    }
    // Resolve tracking snap — alignment paths from acquired points. Polar
    // angles participate when F10 is on (so 45°/30° increments emanate from
    // every acquired point in addition to the H/V baseline).
    // ADR-357 ambient alignment (Revit-style): auto-emit transient anchors from the
    // members near the cursor — a SECOND source merged with the acquired (AutoCAD)
    // points into the SAME resolver. Gate the (perf-sensitive) scene read behind the
    // AutoAlign toggle so it stays lazy (resolved once for the collector + the trace).
    const ambientCfg = ambientAlignmentConfigStore.getSnapshot();
    const ambientEntities = (isDrawingTool && ambientCfg.enabled) ? getSceneEntities() : null;
    // ADR-357 / ADR-397 — merge (acquired ⊕ ambient) → resolve alignment path →
    // adaptive-distance quantize, via the SHARED tracking SSoT (`resolveAlignmentTracking`),
    // the EXACT same brain the rotation overlay (ADR-397) reuses → preview ≡ rotation parity.
    // Returns null when no anchor / no path within tolerance (caller keeps the raw cursor).
    const _trkT0 = performance.now();
    const composedTracking = resolveAlignmentTracking(previewPt, {
      scale: getTransformScale(),
      polarEnabled: polarOnRef.current && !orthoOnRef.current,
      sceneEntities: ambientEntities,
    });
    const _trkMs = performance.now() - _trkT0;
    const trackingResult = composedTracking?.result ?? null;
    const trackingPoint = composedTracking?.point ?? null;
    if (trackingResult && trackingPoint) {
      previewPt = trackingPoint;
    }

    // ADR-513 / ADR-357 Phase 13 G14: length/angle lock — constrain preview geometry to
    // the locked value. Runs after all snaps so the lock takes priority (AutoCAD/BricsCAD).
    // SSoT helper (no-op when nothing locked) — ίδιος περιορισμός με το wall click-commit.
    // 'line' = γραμμικό Dynamic Input· 'wall' = «Δαχτυλίδι Εντολών» (Radial Command Ring).
    if (lastRefPt && (activeTool === 'line' || activeTool === 'wall')) {
      previewPt = applyLengthAngleLock(previewPt, lastRefPt);
    }

    // Update the preview entity (calculates geometry, updates ref)
    const _prevT0 = performance.now();
    updatePreview(previewPt, transformUtils);
    const _prevMs = performance.now() - _prevT0;
    const t2 = performance.now();
    // 🏢 ADR-040: Direct rendering to PreviewCanvas (ZERO React overhead)
    if (previewCanvasRef?.current) {
      const previewEntity = getLatestPreviewEntity();
      const t3 = performance.now();
      // 🔍 DEBUG TRACE: Log preview entity details
      if (DEBUG_DRAWING_HANDLERS) {
        console.debug('🔍 [onDrawingHover] PREVIEW ENTITY', {
          entityType: previewEntity?.type,
          hasEntity: !!previewEntity,
          callingDrawPreview: !!previewEntity,
          timestamp: performance.now().toFixed(1)
        });
      }
      if (previewEntity) {
        previewCanvasRef.current.drawPreview(previewEntity);
        // ADR-508 §dim: wall-ghost listening dimensions overlay (gap-left / gap-right /
        // centre-to-centre along the existing member's face). Attached as ghost metadata.
        // ADR-544 — ΕΝΑ structural read των overlay πεδίων (πλέγμα/διαστάσεις/οδηγός) μέσω canonical type.
        const overlay = previewEntity as PlacementOverlayFields;
        const faceDims = overlay.faceDimensions;
        if (faceDims) {
          previewCanvasRef.current.drawGhostFaceDimensions(faceDims);
        }
        // ADR-508 §wall-hud — ζωντανή ταυτότητα τοίχου: aligned διάσταση μήκους + γωνία + πάχος·ύψος.
        // Τα νούμερα/μετάφραση εδώ (i18n + display units)· το paint είναι pure (numbers in).
        const wallHud = (previewEntity as { wallHud?: WallHudMeta }).wallHud;
        if (wallHud) {
          // ADR-508 §wall-hud — ΚΟΙΝΗ πηγή της ετικέτας «πάχος·ύψος» (ίδια με το grip-drag HUD).
          // ADR-564 §linear-hud — το ghost μπορεί να φέρει προ-μεταφρασμένη ετικέτα ανά μέλος (π.χ.
          // δοκάρι «b·h»)· όταν λείπει (τοίχος) → fallback στην ετικέτα τοίχου (μηδέν αλλαγή τοίχου).
          const specLabel = (previewEntity as { hudSpecLabel?: string }).hudSpecLabel
            ?? buildWallHudSpecLabel(wallHud);
          previewCanvasRef.current.drawWallHud(wallHud, specLabel);
        }
        // ADR-564 §footprint-hud — κολόνα/πέδιλο (footprint μέλος): live πλάτος/βάθος ανά παρειά + ∠
        // γωνία + ύψος, ΙΔΙΟΣ pure painter με το grip-drag (`paintColumnHud`). Το ghost φέρει
        // footprint+params ως `columnHud` meta (ADR-398 assembly)· ο handler ζωγραφίζει + μεταφράζει
        // την ετικέτα ύψους (i18n, N.11). Δουλεύει σε ΟΛΕΣ τις φάσεις (awaitingPosition/Rotation/Lean).
        const columnHud = (previewEntity as {
          columnHud?: { footprint: readonly Point2D[]; params: ColumnParams };
        }).columnHud;
        if (columnHud) {
          previewCanvasRef.current.drawColumnHud(
            columnHud.footprint,
            columnHud.params,
            buildColumnHudSpecLabel(columnHud.params.height),
          );
        }
        // ADR-564 §foundation-hud — πέδιλο-pad (footprint μέλος): ΙΔΙΟΣ pure painter με την κολόνα
        // (`paintFootprintHud`) αλλά μέσω ελάχιστου `FootprintHudDescriptor` + προ-μεταφρασμένης
        // ετικέτας βάθους (το πέδιλο έχει `FoundationParams`, όχι `ColumnParams` → entity-agnostic
        // seam, μηδέν type-lie). Το ghost φέρει footprint+descriptor+label ως `footprintHud` meta.
        const footprintHud = (previewEntity as {
          footprintHud?: { footprint: readonly Point2D[]; descriptor: FootprintHudDescriptor; heightSpecLabel: string };
        }).footprintHud;
        if (footprintHud) {
          previewCanvasRef.current.drawFootprintHud(
            footprintHud.footprint,
            footprintHud.descriptor,
            footprintHud.heightSpecLabel,
          );
        }
        // ADR-508 §line-hud — η ΓΡΑΜΜΗ δείχνει το ΙΔΙΟ live HUD μήκους+γωνίας με τον τοίχο, μέσω
        // του ΚΟΙΝΟΥ painter (drawWallHud → paintWallHudCore). Δεν έχει BIM ταυτότητα (πάχος/ύψος)
        // → κενό specLabel (παραλείπεται). Το `liveDimHud` τέθηκε στο applyPreviewStyling (line tool).
        const lineHud = (previewEntity as { liveDimHud?: WallHudMeta }).liveDimHud;
        if (lineHud) {
          previewCanvasRef.current.drawWallHud(lineHud, '');
        }
        // ADR-397 §15 (wall) / ADR-564 §linear-hud (beam) — μετά το 1ο κλικ γραμμικού μέλους:
        // χρωματισμένο τόξο ΦΟΡΑΣ από την αρχή (lastRefPt) με άξονα αναφοράς τον world-X προς τον
        // κέρσορα (previewPt). 🟢 πάνω / 🔴 κάτω από τον x-άξονα + βελάκι + baseline 0° + χρωματιστές
        // μοίρες — ΙΔΙΟ SSoT painter με την περιστροφή. bearing = atan2(dy,dx) σε world (Y-up) → πάνω
        // = θετικό = πράσινο. Το δοκάρι κρατά την αρχή του στο dedicated preview store (ADR-363), οπότε
        // το `lastRefPt` (= getBimOrthoReference) δείχνει την αρχή του δοκαριού ΟΠΩΣ και του τοίχου.
        // ADR-564 §foundation-hud — τα γραμμικά πέδιλα (strip/tie-beam) είναι καθρέφτης του δοκαριού
        // → ίδιο τόξο ΦΟΡΑΣ. pivot = αρχή band (lastRefPt = getBimOrthoReference, foundation case).
        if (
          (activeTool === 'wall' || activeTool === 'beam' ||
            activeTool === 'foundation-strip' || activeTool === 'foundation-tie-beam') && lastRefPt
        ) {
          const bearingDeg = (Math.atan2(previewPt.y - lastRefPt.y, previewPt.x - lastRefPt.x) * 180) / Math.PI;
          previewCanvasRef.current.drawDirectionArc(
            lastRefPt,
            { x: lastRefPt.x + 1, y: lastRefPt.y },
            previewPt,
            bearingDeg,
          );
        }
        // ADR-363 §wall-ortho-tracking — ΟΡΑΤΗ γραμμή-οδηγός στο 1ο σημείο του τοίχου (awaitingStart):
        // διακεκομμένη από το hover-acquired anchor (π.χ. κέντρο διπλανής κολόνας) προς την αρχή + γωνία/
        // απόσταση, ώστε να ΦΑΙΝΕΤΑΙ το ΟΡΘΟ/Q κλείδωμα (το hard ΟΡΘΟ δεν παράγει `polarSnapResult` → χωρίς
        // αυτό καμία ένδειξη — Giorgio «δεν λειτουργεί»). Μόνο awaitingStart (startPoint=null) & όταν δεν
        // υπάρχει ήδη polar line (μη διπλή). ΙΔΙΟ SSoT painter με την πολική/στρέψης γραμμή.
        if (
          activeTool === 'wall' && lastRefPt && !polarSnapResult?.isSnapped &&
          wallPreviewStore.get().startPoint === null
        ) {
          const bearingDeg = (Math.atan2(previewPt.y - lastRefPt.y, previewPt.x - lastRefPt.x) * 180) / Math.PI;
          const distMm = Math.hypot(previewPt.x - lastRefPt.x, previewPt.y - lastRefPt.y) / Math.max(getSceneUnitsScale(), 1e-9);
          previewCanvasRef.current.drawPolarTrackingLine(
            lastRefPt,
            bearingDeg,
            `${bearingDeg.toFixed(0)}° / ${formatLengthForDisplay(distMm)}`,
            previewPt,
          );
        }
        // ADR-508 §opening-conflict — 🔴 tooltip: ο κάθετος τοίχος κόβει άνοιγμα host σε εύρος ύψους
        // (3D έλεγχος αόρατος στην κάτοψη). Reuse `formatLengthForDisplay` (display units) + i18n key.
        const openingConflict = (previewEntity as { openingConflict?: { bandMm: readonly [number, number] } }).openingConflict;
        if (openingConflict) {
          const [lo, hi] = openingConflict.bandMm;
          const range = `${formatLengthForDisplay(lo, { withUnit: false })}–${formatLengthForDisplay(hi)}`;
          const label = i18n.t('tools.wall.openingCutConflict', { range, ns: 'dxf-viewer-shell' });
          previewCanvasRef.current.drawGhostConflictTooltip(label, previewPt);
        }
        // ADR-398 §3.13 — Polar Magnet: όταν ο cursor είναι μέσα σε κυκλικό δίσκο, overlay πολικό
        // πλέγμα (κέντρο/δακτύλιοι/ακτίνες). Attached ως ghost metadata από το `generateColumnPreview`.
        const polarGrid = overlay.polarDiskGrid;
        if (polarGrid) {
          previewCanvasRef.current.drawPolarDisk(polarGrid);
        }
        // ADR-398 §3.15 — Cartesian Magnet: cursor μέσα σε ορθογώνιο → overlay καρτεσιανό πλέγμα.
        const rectGrid = overlay.rectGrid;
        if (rectGrid) {
          previewCanvasRef.current.drawRectGrid(rectGrid);
        }
        // ADR-398 §3.20/§3.20d — alignment guide(s): dashed οδηγός στο άκρο/μέσον παρειάς ή πλευρά(ές)
        // ορθογωνίου (έως 2 στη γωνία). Ο renderer κάνει normalize σε array.
        const alignGuide = overlay.alignmentGuide;
        if (alignGuide) {
          previewCanvasRef.current.drawAlignmentGuide(alignGuide);
        }
        // ADR-508 §column place+rotate — μετά το 1ο κλικ: ΠΟΡΤΟΚΑΛΙ γραμμή στρέψης + γωνία (ίδιο
        // SSoT `drawPolarTrackingLine` = drawingGuide χρώμα) από την κλειδωμένη θέση προς τον κέρσορα.
        const colRot = getColumnRotationLock();
        if (colRot) {
          const snappedDeg = resolveColumnRotationDeg(colRot.origin, previewPt, worldPerPixel(getTransformScale()));
          previewCanvasRef.current.drawPolarTrackingLine(colRot.origin, snappedDeg, `${Math.round(snappedDeg)}°`, previewPt);
          // ADR-564 §rotation-arc (Giorgio «και τα δύο») — ΔΙΠΛΑ στην πορτοκαλί ευθεία, το έγχρωμο τόξο
          // ΦΟΡΑΣ (🟢 πάνω / 🔴 κάτω από τον world-X) + βελάκι + baseline — ΙΔΙΟ SSoT painter με τοίχο/
          // grip-rotate. pivot = κλειδωμένη θέση, ref = world-X, bearing = φορά προς τον κέρσορα.
          const arcBearingDeg = (Math.atan2(previewPt.y - colRot.origin.y, previewPt.x - colRot.origin.x) * 180) / Math.PI;
          previewCanvasRef.current.drawDirectionArc(
            colRot.origin,
            { x: colRot.origin.x + 1, y: colRot.origin.y },
            previewPt,
            arcBearingDeg,
          );
        }
        // ADR-357 Phase 1: Polar tracking line overlay (dashed alignment path + tooltip)
        if (polarSnapResult?.isSnapped && lastRefPt && polarSnapResult.snappedAngle !== null) {
          // ADR-508 — face-relative wall snap: label the angle RELATIVE to the face
          // (perpendicular ⇒ 90°), not the absolute world heading (which read e.g.
          // "41.9°" while the wall was visibly perpendicular). The ray itself still
          // points along the absolute snapped angle.
          const labelAngle = faceRel
            ? faceRelativeDisplayAngle(polarSnapResult.snappedAngle, faceRel.baseAngle)
            : polarSnapResult.snappedAngle;
          previewCanvasRef.current.drawPolarTrackingLine(
            lastRefPt,
            polarSnapResult.snappedAngle,
            formatPolarLabel(labelAngle, polarSnapResult.distance),
            previewPt,
          );
        }
        // ADR-357 Phase 4: Object Snap Tracking alignment overlay (dashed
        // paths from acquired points + intersection halo + distance label).
        if (trackingResult && trackingPoint) {
          // Distance from anchor to the (quantized) snap point → display unit
          // (mm internal → cm/m/… via the live displayUnitState SSoT).
          const distWorld = Math.hypot(
            trackingPoint.x - trackingResult.anchorPoint.x,
            trackingPoint.y - trackingResult.anchorPoint.y,
          );
          const distMm = distWorld / Math.max(getSceneUnitsScale(), 1e-9);
          // SSoT: value + active display-unit label in ONE call (no manual
          // formatDisplayValue + DISPLAY_UNIT_LABELS combo).
          const label = trackingResult.snappedAngle !== null
            ? `${trackingResult.snappedAngle.toFixed(0)}° / ${formatLengthForDisplay(distMm)}`
            : null;
          // ADR-357 ambient: draw ONLY the cursor-aligned path(s), not every
          // built path — mirrors Revit/AutoCAD and prevents ambient-source clutter.
          previewCanvasRef.current.drawTrackingAlignment(
            trackingResult.activePaths,
            trackingResult.intersections,
            trackingPoint,
            label,
          );
        }
      } else {
        // 🔧 FIX (2026-01-27): Clear canvas when preview entity is null
        // This happens when drawing is completed (2nd click on line/measure-distance)
        // Without this, the old preview distance label stays visible
        previewCanvasRef.current.clear();
      }
      const t4 = performance.now();
      // 🔬 ADR-516 perf trace: log the per-op breakdown ONLY for laggy frames, so the
      // wall-tool lag is attributable to ambient-scan vs tracking vs preview vs draw.
      if (PERF_DRAWHOVER_TRACE) {
        const total = t4 - t0;
        if (total >= PERF_DRAWHOVER_WARN_MS) {
          const members = ambientEntities ? ambientEntities.length : 0;
          console.warn(
            `[PERF_DRAWHOVER] ${total.toFixed(1)}ms — tracking=${_trkMs.toFixed(1)} (members=${members}) preview=${_prevMs.toFixed(1)} draw=${(t4 - t3).toFixed(1)} tool=${activeTool}`,
          );
        }
      } else if (DEBUG_DRAWING_HANDLERS) {
        const total = t4 - t0;
        console.debug(`PERF_DRAWHOVER ${total.toFixed(1)}ms transform=${(t1-t0).toFixed(1)} preview=${(t2-t1).toFixed(1)} entity=${(t3-t2).toFixed(1)} draw=${(t4-t3).toFixed(1)}`);
      }
    }
  } else {
    // 🏢 ADR-040: Clear preview when mouse leaves
    if (previewCanvasRef?.current) {
      previewCanvasRef.current.clear();
    }
  }
}
