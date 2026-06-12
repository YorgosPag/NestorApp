/**
 * @module drawing-hover-handler
 * @description Pure function for processing drawing hover events.
 * Extracted from useDrawingHandlers.ts (ADR-363 Phase 1C).
 */
import type React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { ToolType } from '../../ui/toolbar/types';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import type { PolarSnapResult } from '../../systems/constraints/polar-utils';
import type { ExtendedSceneEntity } from './drawing-types';
import {
  TrackingPointStore,
  ACQUISITION_DURATION_MS,
} from '../../systems/tracking/TrackingPointStore';
import { resolveTrackingSnap } from '../../systems/tracking/tracking-resolver';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import { applyPolar, formatPolarLabel } from '../../systems/constraints/polar-utils';
import { polarTrackingStore } from '../../systems/constraints/polar-tracking-store';
import { SnapOverrideOrchestrator } from '../../snapping/overrides/SnapOverrideOrchestrator';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { hardOrtho } from './drawing-handler-utils';
// ADR-363: BIM tools (wall/stair/beam/slab) keep their points in dedicated
// preview stores, not in `tempPoints`. Resolve the ortho/polar anchor from
// there so the rubber-band preview honours F8/F10 (preview == commit).
import { getBimOrthoReference } from './bim-ortho-reference';
// ADR-362 hotfix: DetectableEntity for smart dim type detection via snap entityId
import type { DetectableEntity } from '../../systems/dimensions/dim-smart-detector';
// ADR-362 hotfix (2026-05-19): skip-snap helper for dimLineRef phase — preview
// must follow the raw cursor (not snap) so it agrees with the commit.
import { isDimLineRefPhase } from '../dimensions/dim-skip-snap';
// ADR-357 Phase 13 G14: length/angle lock geometry constraint
import { DynamicInputLockStore } from '../../systems/dynamic-input/DynamicInputLockStore';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';

const DEBUG_DRAWING_HANDLERS = false;

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
      const snap = findSnapPointRef.current?.(p.x, p.y);
      if (snap?.entityId) hoveredEntity = resolveEntity(snap.entityId);
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
    const afterOrtho = orthoOnRef.current && lastRefPt ? hardOrtho(p, lastRefPt) : p;
    let polarSnapResult: PolarSnapResult | null = null;
    let previewPt = afterOrtho;
    if (!orthoOnRef.current && polarOnRef.current && lastRefPt) {
      polarSnapResult = applyPolar(afterOrtho, lastRefPt, {
        incrementAngle: polarTrackingStore.incrementAngle,
        additionalAngles: polarTrackingStore.additionalAngles,
        angleTolerance: 3,
      });
      previewPt = polarSnapResult.point;
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
    const acquired = TrackingPointStore.getPoints();
    const liveScale = getTransformScale();
    const worldTolerance = 3 / Math.max(liveScale, 0.001);
    const trackingResult = acquired.length > 0
      ? resolveTrackingSnap(previewPt, acquired, {
          incrementAngle: polarTrackingStore.incrementAngle,
          additionalAngles: polarTrackingStore.additionalAngles,
          polarEnabled: polarOnRef.current && !orthoOnRef.current,
        }, worldTolerance)
      : null;
    if (trackingResult) {
      previewPt = trackingResult.point;
    }

    // ADR-357 Phase 13 G14: length/angle lock — constrain preview geometry to locked value.
    // Runs after all snaps so the lock takes priority (matches AutoCAD/BricsCAD behaviour).
    if (lastRefPt && activeTool === 'line') {
      const { lockedField, lockedValue } = DynamicInputLockStore.getLocked();
      if (lockedField && lockedValue !== null) {
        const dx = previewPt.x - lastRefPt.x;
        const dy = previewPt.y - lastRefPt.y;
        const dist = Math.hypot(dx, dy);
        if (lockedField === 'length' && dist > 0.001) {
          const scale = lockedValue / dist;
          previewPt = { x: lastRefPt.x + dx * scale, y: lastRefPt.y + dy * scale };
        } else if (lockedField === 'angle') {
          const rad = degToRad(lockedValue);
          previewPt = { x: lastRefPt.x + dist * Math.cos(rad), y: lastRefPt.y + dist * Math.sin(rad) };
        }
      }
    }

    // Update the preview entity (calculates geometry, updates ref)
    updatePreview(previewPt, transformUtils);
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
        // ADR-357 Phase 1: Polar tracking line overlay (dashed alignment path + tooltip)
        if (polarSnapResult?.isSnapped && lastRefPt && polarSnapResult.snappedAngle !== null) {
          previewCanvasRef.current.drawPolarTrackingLine(
            lastRefPt,
            polarSnapResult.snappedAngle,
            formatPolarLabel(polarSnapResult.snappedAngle, polarSnapResult.distance),
            previewPt,
          );
        }
        // ADR-357 Phase 4: Object Snap Tracking alignment overlay (dashed
        // paths from acquired points + intersection halo + distance label).
        if (trackingResult) {
          const label = trackingResult.snappedAngle !== null
            ? `${trackingResult.snappedAngle.toFixed(0)}° / ${Math.hypot(
                trackingResult.point.x - trackingResult.anchorPoint.x,
                trackingResult.point.y - trackingResult.anchorPoint.y,
              ).toFixed(1)}`
            : null;
          previewCanvasRef.current.drawTrackingAlignment(
            trackingResult.alignmentPaths,
            trackingResult.intersections,
            trackingResult.point,
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
      // 🔍 PERF DEBUG: Log timing only when explicitly enabled
      if (DEBUG_DRAWING_HANDLERS) {
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
