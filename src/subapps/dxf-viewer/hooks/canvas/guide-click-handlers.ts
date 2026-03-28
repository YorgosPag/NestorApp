/**
 * 🏢 ENTERPRISE: Guide Tool Click Handlers
 *
 * @description Pure functions handling ALL guide-* tool click events.
 * Extracted from useCanvasClickHandler for SRP compliance (ADR N.7.1).
 *
 * Entity-picking guide handlers are further delegated to guide-entity-handlers.ts.
 * Each handler returns `true` if it consumed the click, `false` otherwise.
 *
 * @see ADR-189: Construction Guide System
 * @see ADR-046: World Coordinate Click Pattern
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ViewTransform } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/entities';
import { dlog } from '../../debug';
import type { Guide } from '../../systems/guides/guide-types';
import { pointToSegmentDistance } from '../../systems/guides/guide-types';

import type { UseCanvasClickHandlerParams } from './canvas-click-types';
import {
  handleArcSegments, handleArcDistance,
  handleArcLineIntersect, handleCircleIntersect,
  handleLineMidpoint, handleCircleCenter,
  handleFromEntity, handleOffsetEntity,
} from './guide-entity-handlers';

// ============================================================================
// TYPES
// ============================================================================

/** Subset of UseCanvasClickHandlerParams needed by guide handlers */
export interface GuideClickContext {
  worldPoint: Point2D;
  shiftKey: boolean;
  transform: ViewTransform;
  levelManager: {
    currentLevelId: string | null;
    getLevelScene: (levelId: string) => SceneModel | null;
  };
}

// ============================================================================
// HELPER: Find nearest guide within tolerance
// ============================================================================

interface NearestGuideResult {
  guide: Guide;
  dist: number;
}

export function findNearestGuide(
  worldPoint: Point2D,
  guides: readonly Guide[],
  hitToleranceWorld: number,
  options?: { excludeXZ?: boolean; excludeLocked?: boolean },
): NearestGuideResult | null {
  let nearest: Guide | null = null;
  let nearestDist = hitToleranceWorld;

  for (const guide of guides) {
    if (!guide.visible) continue;
    if (options?.excludeLocked && guide.locked) continue;
    if (options?.excludeXZ && guide.axis === 'XZ') continue;

    let dist: number;
    if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
      dist = pointToSegmentDistance(worldPoint, guide.startPoint, guide.endPoint);
    } else {
      dist = guide.axis === 'X'
        ? Math.abs(worldPoint.x - guide.offset)
        : Math.abs(worldPoint.y - guide.offset);
    }
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = guide;
    }
  }

  return nearest ? { guide: nearest, dist: nearestDist } : null;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handles ALL guide-* tool clicks. Returns `true` if the click was consumed.
 */
export function handleGuideToolClick(
  ctx: GuideClickContext,
  params: UseCanvasClickHandlerParams,
): boolean {
  const { activeTool } = params;
  if (!activeTool.startsWith('guide-')) return false;

  switch (activeTool) {
    case 'guide-xz':       return handleDiagonalGuide(ctx, params);
    case 'guide-x':        return handleAxisGuide(ctx, params, 'X');
    case 'guide-z':        return handleAxisGuide(ctx, params, 'Y');
    case 'guide-delete':   return handleGuideDelete(ctx, params);
    case 'guide-parallel':      return handleGuideParallel(ctx, params);
    case 'guide-perpendicular': return handleGuidePerpendicular(ctx, params);
    case 'guide-add-point':     return handleAddPoint(ctx.worldPoint, params);
    case 'guide-delete-point':  return handleDeletePoint(ctx, params);
    case 'guide-segments':      return handleSegments(ctx.worldPoint, params);
    case 'guide-distance':      return handleDistance(ctx.worldPoint, params);
    // Entity-picking handlers (delegated to guide-entity-handlers.ts)
    case 'guide-arc-segments':       return handleArcSegments(ctx, params);
    case 'guide-arc-distance':       return handleArcDistance(ctx, params);
    case 'guide-arc-line-intersect': return handleArcLineIntersect(ctx, params);
    case 'guide-circle-intersect':   return handleCircleIntersect(ctx, params);
    case 'guide-line-midpoint':      return handleLineMidpoint(ctx, params);
    case 'guide-circle-center':      return handleCircleCenter(ctx, params);
    case 'guide-from-entity':        return handleFromEntity(ctx, params);
    case 'guide-offset-entity':      return handleOffsetEntity(ctx, params);
    // Simple guide tools
    case 'guide-rect-center':   return handleRectCenter(ctx.worldPoint, params);
    case 'guide-grid':          return handleGrid(ctx.worldPoint, params);
    case 'guide-rotate':        return handleGuideRotate(ctx, params);
    case 'guide-rotate-all':    return handleRotateAll(ctx.worldPoint, params);
    case 'guide-rotate-group':  return handleRotateGroup(ctx, params);
    case 'guide-equalize':      return handleEqualize(ctx, params);
    case 'guide-polar-array':   return handlePolarArray(ctx.worldPoint, params);
    case 'guide-scale':         return handleScale(ctx.worldPoint, params);
    case 'guide-angle':         return handleAngle(ctx.worldPoint, params);
    case 'guide-mirror':        return handleMirror(ctx, params);
    case 'guide-select':        return handleGuideSelect(ctx, params);
    default: return false;
  }
}

// ============================================================================
// INDIVIDUAL GUIDE HANDLERS (non-entity-picking)
// ============================================================================

/** ADR-189 §3.3: Diagonal (XZ) guide — 3-click state machine */
function handleDiagonalGuide(ctx: GuideClickContext, p: UseCanvasClickHandlerParams): boolean {
  const { worldPoint } = ctx;
  const diagonalStep = p.diagonalStep ?? 0;

  if (diagonalStep === 0 && p.onDiagonalStartSet) {
    p.onDiagonalStartSet(worldPoint);
    dlog('guideClickHandlers', 'Diagonal step 0: start set', worldPoint);
    return true;
  }
  if (diagonalStep === 1 && p.onDiagonalDirectionSet) {
    p.onDiagonalDirectionSet(worldPoint);
    dlog('guideClickHandlers', 'Diagonal step 1: direction set', worldPoint);
    return true;
  }
  if (diagonalStep === 2 && p.diagonalStartPoint && p.diagonalDirectionPoint && p.guideAddDiagonalGuide) {
    const dx = p.diagonalDirectionPoint.x - p.diagonalStartPoint.x;
    const dy = p.diagonalDirectionPoint.y - p.diagonalStartPoint.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq > 0) {
      const t = ((worldPoint.x - p.diagonalStartPoint.x) * dx + (worldPoint.y - p.diagonalStartPoint.y) * dy) / lenSq;
      const endPoint = { x: p.diagonalStartPoint.x + t * dx, y: p.diagonalStartPoint.y + t * dy };
      p.guideAddDiagonalGuide(p.diagonalStartPoint, endPoint);
      dlog('guideClickHandlers', 'Diagonal step 2: guide created', { start: p.diagonalStartPoint, end: endPoint });
    }
    p.onDiagonalComplete?.();
  }
  return true;
}

/** guide-x / guide-z — simple axis guide placement */
function handleAxisGuide(ctx: GuideClickContext, p: UseCanvasClickHandlerParams, axis: 'X' | 'Y'): boolean {
  if (!p.guideAddGuide) return true;
  const offset = axis === 'X' ? ctx.worldPoint.x : ctx.worldPoint.y;
  p.guideAddGuide(axis, offset);
  dlog('guideClickHandlers', `Guide ${axis} added at offset`, offset);
  return true;
}

/** guide-delete — find and remove nearest guide */
function handleGuideDelete(ctx: GuideClickContext, p: UseCanvasClickHandlerParams): boolean {
  if (!p.guideRemoveGuide || !p.guides || p.guides.length === 0) return true;
  const result = findNearestGuide(ctx.worldPoint, p.guides, 30 / ctx.transform.scale);
  if (result) {
    p.guideRemoveGuide(result.guide.id);
    dlog('guideClickHandlers', 'Guide deleted:', result.guide.id);
  } else {
    dlog('guideClickHandlers', 'No guide within delete tolerance', {
      worldPoint: ctx.worldPoint, tolerance: 30 / ctx.transform.scale, guideCount: p.guides.length,
    });
  }
  return true;
}

/** guide-parallel — 2-step: select reference, then choose side */
function handleGuideParallel(ctx: GuideClickContext, p: UseCanvasClickHandlerParams): boolean {
  if (!p.guides || p.guides.length === 0) return true;

  if (!p.parallelRefGuideId && p.onParallelRefSelected) {
    const result = findNearestGuide(ctx.worldPoint, p.guides, 30 / ctx.transform.scale);
    if (result) {
      p.onParallelRefSelected(result.guide.id);
      dlog('guideClickHandlers', 'Parallel step 1: reference selected', result.guide.id, result.guide.axis);
    }
    return true;
  }

  if (p.parallelRefGuideId && p.onParallelSideChosen) {
    const refGuide = p.guides.find(g => g.id === p.parallelRefGuideId);
    if (refGuide) {
      let sign: 1 | -1;
      if (refGuide.axis === 'XZ' && refGuide.startPoint && refGuide.endPoint) {
        const dx = refGuide.endPoint.x - refGuide.startPoint.x;
        const dy = refGuide.endPoint.y - refGuide.startPoint.y;
        const cx = ctx.worldPoint.x - refGuide.startPoint.x;
        const cy = ctx.worldPoint.y - refGuide.startPoint.y;
        sign = (cx * dy - cy * dx) >= 0 ? 1 : -1;
      } else {
        sign = refGuide.axis === 'X'
          ? (ctx.worldPoint.x >= refGuide.offset ? 1 : -1)
          : (ctx.worldPoint.y >= refGuide.offset ? 1 : -1);
      }
      p.onParallelSideChosen(refGuide.id, sign);
      dlog('guideClickHandlers', 'Parallel step 2: side chosen', sign > 0 ? '+' : '-', refGuide.axis);
    }
  }
  return true;
}

/** guide-perpendicular — 2-step: select reference, then place */
function handleGuidePerpendicular(ctx: GuideClickContext, p: UseCanvasClickHandlerParams): boolean {
  if (!p.guides || p.guides.length === 0) return true;

  if (!p.perpRefGuideId && p.onPerpRefSelected) {
    const result = findNearestGuide(ctx.worldPoint, p.guides, 30 / ctx.transform.scale);
    if (result) {
      p.onPerpRefSelected(result.guide.id);
      dlog('guideClickHandlers', 'Perpendicular step 0: reference selected', result.guide.id, result.guide.axis);
    }
    return true;
  }

  if (p.perpRefGuideId) {
    const refGuide = p.guides.find(g => g.id === p.perpRefGuideId);
    if (refGuide) {
      if (refGuide.axis === 'X' && p.guideAddGuide) {
        p.guideAddGuide('Y', ctx.worldPoint.y);
      } else if (refGuide.axis === 'Y' && p.guideAddGuide) {
        p.guideAddGuide('X', ctx.worldPoint.x);
      } else if (refGuide.axis === 'XZ' && refGuide.startPoint && refGuide.endPoint && p.guideAddDiagonalGuide) {
        const dx = refGuide.endPoint.x - refGuide.startPoint.x;
        const dy = refGuide.endPoint.y - refGuide.startPoint.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq > 0) {
          const len = Math.sqrt(lenSq);
          const t = Math.max(0, Math.min(1,
            ((ctx.worldPoint.x - refGuide.startPoint.x) * dx + (ctx.worldPoint.y - refGuide.startPoint.y) * dy) / lenSq,
          ));
          const base = { x: refGuide.startPoint.x + t * dx, y: refGuide.startPoint.y + t * dy };
          const nx = -dy / len;
          const ny = dx / len;
          const halfLen = len / 2;
          p.guideAddDiagonalGuide(
            { x: base.x - nx * halfLen, y: base.y - ny * halfLen },
            { x: base.x + nx * halfLen, y: base.y + ny * halfLen },
          );
        }
      }
    }
    p.onPerpPlaced?.();
  }
  return true;
}

/** guide-add-point */
function handleAddPoint(worldPoint: Point2D, p: UseCanvasClickHandlerParams): boolean {
  if (!p.cpAddPoint) return true;
  p.cpAddPoint(worldPoint);
  dlog('guideClickHandlers', 'Construction point added at', worldPoint);
  return true;
}

/** guide-delete-point */
function handleDeletePoint(ctx: GuideClickContext, p: UseCanvasClickHandlerParams): boolean {
  if (!p.cpDeletePoint || !p.cpFindNearest) return true;
  const nearest = p.cpFindNearest(ctx.worldPoint, 30 / ctx.transform.scale);
  if (nearest) {
    p.cpDeletePoint(nearest.id);
    dlog('guideClickHandlers', 'Construction point deleted:', nearest.id);
  }
  return true;
}

/** guide-segments — 2-click + dialog */
function handleSegments(worldPoint: Point2D, p: UseCanvasClickHandlerParams): boolean {
  const step = p.segmentsStep ?? 0;
  if (step === 0 && p.onSegmentsStartSet) {
    p.onSegmentsStartSet(worldPoint);
    dlog('guideClickHandlers', 'Segments step 0: start set', worldPoint);
  } else if (step === 1 && p.segmentsStartPoint && p.onSegmentsComplete) {
    p.onSegmentsComplete(p.segmentsStartPoint, worldPoint);
    dlog('guideClickHandlers', 'Segments step 1: end set', worldPoint);
  }
  return true;
}

/** guide-distance — 2-click + dialog */
function handleDistance(worldPoint: Point2D, p: UseCanvasClickHandlerParams): boolean {
  const step = p.distanceStep ?? 0;
  if (step === 0 && p.onDistanceStartSet) {
    p.onDistanceStartSet(worldPoint);
    dlog('guideClickHandlers', 'Distance step 0: start set', worldPoint);
  } else if (step === 1 && p.distanceStartPoint && p.onDistanceComplete) {
    p.onDistanceComplete(p.distanceStartPoint, worldPoint);
    dlog('guideClickHandlers', 'Distance step 1: end set', worldPoint);
  }
  return true;
}

/** guide-rect-center — click inside guide rectangle */
function handleRectCenter(worldPoint: Point2D, p: UseCanvasClickHandlerParams): boolean {
  if (!p.guides || p.guides.length < 4 || !p.onRectCenterPlace) return true;

  const xOffsets = p.guides.filter(g => g.visible && g.axis === 'X').map(g => g.offset).sort((a, b) => a - b);
  const yOffsets = p.guides.filter(g => g.visible && g.axis === 'Y').map(g => g.offset).sort((a, b) => a - b);

  let leftX: number | null = null;
  let rightX: number | null = null;
  for (const x of xOffsets) { if (x <= worldPoint.x) leftX = x; }
  for (const x of xOffsets) { if (x >= worldPoint.x) { rightX = x; break; } }

  let bottomY: number | null = null;
  let topY: number | null = null;
  for (const y of yOffsets) { if (y <= worldPoint.y) bottomY = y; }
  for (const y of yOffsets) { if (y >= worldPoint.y) { topY = y; break; } }

  if (leftX !== null && rightX !== null && bottomY !== null && topY !== null
    && leftX !== rightX && bottomY !== topY) {
    const center: Point2D = { x: (leftX + rightX) / 2, y: (bottomY + topY) / 2 };
    p.onRectCenterPlace(center);
    dlog('guideClickHandlers', 'Rect center placed', { center });
  }
  return true;
}

/** guide-grid — 1-click origin */
function handleGrid(worldPoint: Point2D, p: UseCanvasClickHandlerParams): boolean {
  if (!p.onGridOriginSet) return true;
  p.onGridOriginSet(worldPoint);
  dlog('guideClickHandlers', 'Grid origin set', worldPoint);
  return true;
}

/** guide-rotate — 2-step: select guide, then set pivot */
function handleGuideRotate(ctx: GuideClickContext, p: UseCanvasClickHandlerParams): boolean {
  if (!p.guides || p.guides.length === 0) return true;

  if (!p.rotateRefGuideId && p.onRotateRefSelected) {
    const result = findNearestGuide(ctx.worldPoint, p.guides, 30 / ctx.transform.scale, { excludeLocked: true });
    if (result) {
      p.onRotateRefSelected(result.guide.id);
      dlog('guideClickHandlers', 'Rotate step 0: guide selected', result.guide.id);
    }
    return true;
  }

  if (p.rotateRefGuideId && p.onRotatePivotSet) {
    p.onRotatePivotSet(p.rotateRefGuideId, ctx.worldPoint);
    dlog('guideClickHandlers', 'Rotate step 1: pivot set', ctx.worldPoint);
  }
  return true;
}

/** guide-rotate-all — 1-click pivot */
function handleRotateAll(worldPoint: Point2D, p: UseCanvasClickHandlerParams): boolean {
  if (!p.onRotateAllPivotSet || !p.guides || p.guides.length === 0) return true;
  p.onRotateAllPivotSet(worldPoint);
  dlog('guideClickHandlers', 'Rotate-all: pivot set', worldPoint);
  return true;
}

/** guide-rotate-group — click guides to toggle, click empty for pivot */
function handleRotateGroup(ctx: GuideClickContext, p: UseCanvasClickHandlerParams): boolean {
  if (!p.guides || p.guides.length === 0) return true;

  const result = findNearestGuide(ctx.worldPoint, p.guides, 30 / ctx.transform.scale, { excludeLocked: true });

  if (result && p.onRotateGroupToggle) {
    p.onRotateGroupToggle(result.guide.id);
    dlog('guideClickHandlers', 'Rotate-group: toggled guide', result.guide.id);
    return true;
  }

  if (!result && p.rotateGroupSelectedIds && p.rotateGroupSelectedIds.size > 0 && p.onRotateGroupPivotSet) {
    p.onRotateGroupPivotSet(Array.from(p.rotateGroupSelectedIds), ctx.worldPoint);
    dlog('guideClickHandlers', 'Rotate-group: pivot set', ctx.worldPoint);
  }
  return true;
}

/** guide-equalize — click guides to toggle, click empty to apply */
function handleEqualize(ctx: GuideClickContext, p: UseCanvasClickHandlerParams): boolean {
  if (!p.guides || p.guides.length === 0) return true;

  const result = findNearestGuide(ctx.worldPoint, p.guides, 30 / ctx.transform.scale, { excludeXZ: true, excludeLocked: true });

  if (result && p.onEqualizeToggle) {
    p.onEqualizeToggle(result.guide.id);
    dlog('guideClickHandlers', 'Equalize: toggled guide', result.guide.id);
    return true;
  }

  if (!result && p.equalizeSelectedIds && p.equalizeSelectedIds.size >= 3 && p.onEqualizeApply) {
    p.onEqualizeApply(Array.from(p.equalizeSelectedIds));
    dlog('guideClickHandlers', 'Equalize: applied', p.equalizeSelectedIds.size, 'guides');
  }
  return true;
}

/** guide-polar-array — 1-click center */
function handlePolarArray(worldPoint: Point2D, p: UseCanvasClickHandlerParams): boolean {
  if (!p.onPolarArrayCenterSet) return true;
  p.onPolarArrayCenterSet(worldPoint);
  dlog('guideClickHandlers', 'Polar array: center set', worldPoint);
  return true;
}

/** guide-scale — 1-click origin */
function handleScale(worldPoint: Point2D, p: UseCanvasClickHandlerParams): boolean {
  if (!p.onScaleOriginSet) return true;
  p.onScaleOriginSet(worldPoint);
  dlog('guideClickHandlers', 'Scale grid: origin set', worldPoint);
  return true;
}

/** guide-angle — 1-click origin */
function handleAngle(worldPoint: Point2D, p: UseCanvasClickHandlerParams): boolean {
  if (!p.onGuideAngleOriginSet) return true;
  p.onGuideAngleOriginSet(worldPoint);
  dlog('guideClickHandlers', 'Guide at angle: origin set', worldPoint);
  return true;
}

/** guide-mirror — 1-click on X/Y guide as axis */
function handleMirror(ctx: GuideClickContext, p: UseCanvasClickHandlerParams): boolean {
  if (!p.guides || p.guides.length === 0 || !p.onMirrorAxisSelected) return true;

  const result = findNearestGuide(ctx.worldPoint, p.guides, 30 / ctx.transform.scale, { excludeXZ: true });
  if (result) {
    p.onMirrorAxisSelected(result.guide.id);
    dlog('guideClickHandlers', 'Mirror: axis guide selected', result.guide.id, result.guide.axis);
  }
  return true;
}

/** guide-select — multi-select guides */
function handleGuideSelect(ctx: GuideClickContext, p: UseCanvasClickHandlerParams): boolean {
  if (!p.guides) return true;

  const result = findNearestGuide(ctx.worldPoint, p.guides, 30 / ctx.transform.scale);
  if (result && p.onGuideSelectToggle) {
    p.onGuideSelectToggle(result.guide.id, ctx.shiftKey);
    dlog('guideClickHandlers', 'B14: Guide select toggle', result.guide.id, 'shift:', ctx.shiftKey);
  } else if (p.onGuideDeselectAll) {
    p.onGuideDeselectAll();
    dlog('guideClickHandlers', 'B14: Guide deselect all (empty click)');
  }
  return true;
}
