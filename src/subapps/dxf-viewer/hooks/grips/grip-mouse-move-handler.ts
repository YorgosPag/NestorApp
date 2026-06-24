/**
 * Grip mouse-move handler — extracted from `useUnifiedGripInteraction.ts` for
 * file-size compliance (<500 lines); behavior-preserving. Sibling of
 * `grip-mouse-handlers.ts` (runGripMouseDown / runGripMouseUp).
 *
 * Owns the hover/follow logic of the unified grip state machine plus the
 * ADR-397 Φ2 per-arm MOVE-glyph hover highlight.
 *
 * @module hooks/grips/grip-mouse-move-handler
 * @see ./useUnifiedGripInteraction.ts
 * @see ./grip-mouse-handlers.ts
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { lockGripSnapPosition, unlockGripSnapPosition } from '../../systems/cursor/GripSnapStore';
import { gripStyleStore } from '../../stores/GripStyleStore';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { DXF_TIMING } from '../../config/dxf-timing';
import type { UnifiedGripInfo, UnifiedGripPhase, GripHoverThrottle } from './unified-grip-types';
import { findNearestGrip } from './grip-hit-testing';
import { setGripStepAnchor, clearGripStepAnchor } from '../../systems/cursor/GripStepAnchorStore';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { MoveGlyphZoneStore } from '../../bim/grips/move-glyph-zone-store';
import { resolveMoveGlyphZoneForGrip } from '../../bim/grips/move-glyph-zones';
import { markSystemsDirty } from '../../rendering/core/UnifiedFrameScheduler';

const WARM_DELAY_MS = DXF_TIMING.gesture.WARM_DELAY; // ADR-516
const GRIP_HOVER_THROTTLE_MS = PANEL_LAYOUT.TIMING.GRIP_HOVER_THROTTLE_MS; // SSoT (ADR-040 Φ10)
// ADR-363 Phase 1G — squared world-distance threshold above which the hot-grip
// cursor counts as "moved from the anchor". Tiny (essentially "moved at all"):
// any real cursor move dwarfs it, while an exact same-spot release stays below.
const HOT_GRIP_MOVE_EPS_SQ = 1e-12;

export interface GripMouseMoveCtx {
  isGripMode: boolean;
  allGrips: UnifiedGripInfo[];
  phase: UnifiedGripPhase;
  activeGrip: UnifiedGripInfo | null;
  hoveredGrip: UnifiedGripInfo | null;
  effectiveTolerance: number;
  /** (gripSize ?? 5) * (dpiScale ?? 1) — precomputed for the move-glyph zone classifier. */
  gripSizePx: number;
  gripHoverThrottleRef: MutableRefObject<GripHoverThrottle>;
  anchorRef: MutableRefObject<Point2D | null>;
  hotGripStepRef: MutableRefObject<import('./wall-hot-grip-fsm').HotGripStep>;
  hotGripMovedRef: MutableRefObject<boolean>;
  hotGripRotateBaseRef: MutableRefObject<Point2D | null>;
  hotGripBaseRef: MutableRefObject<Point2D | null>;
  warmTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setCurrentWorldPos: Dispatch<SetStateAction<Point2D | null>>;
  setDragPreviewPosition: Dispatch<SetStateAction<Point2D | null>>;
  setHoveredGrip: Dispatch<SetStateAction<UnifiedGripInfo | null>>;
  setPhase: Dispatch<SetStateAction<UnifiedGripPhase>>;
}

// ADR-397 Φ2 — per-arm MOVE-glyph hover highlight: classify the cursor into a move
// arm (entity WORLD frame) and publish it so the renderer lights only that arm.
function updateMoveGlyphHoverZone(grip: UnifiedGripInfo, worldPos: Point2D, gripSizePx: number): void {
  const frame = grip.moveGlyphFrame;
  if (!frame || !grip.entityId) {
    if (MoveGlyphZoneStore.clear()) markSystemsDirty(['dxf-canvas']);
    return;
  }
  const zone = resolveMoveGlyphZoneForGrip({
    cursorWorld: worldPos,
    centerWorld: grip.position,
    frame,
    gripSizePx,
    scale: getImmediateTransform().scale,
  });
  const changed = zone
    ? MoveGlyphZoneStore.set(grip.entityId, grip.gripIndex, zone)
    : MoveGlyphZoneStore.clear();
  if (changed) markSystemsDirty(['dxf-canvas']);
}

export function runGripMouseMove(worldPos: Point2D, ctx: GripMouseMoveCtx): void {
  const {
    isGripMode, allGrips, phase, activeGrip, hoveredGrip, effectiveTolerance, gripSizePx,
    gripHoverThrottleRef, anchorRef, hotGripStepRef, hotGripMovedRef, hotGripRotateBaseRef,
    hotGripBaseRef, warmTimerRef, setCurrentWorldPos, setDragPreviewPosition, setHoveredGrip, setPhase,
  } = ctx;
  if (!isGripMode || allGrips.length === 0) return;
  const now = performance.now();
  const throttle = gripHoverThrottleRef.current;
  // ADR-363 Phase 1G — hotGrip follows the cursor at full rate like dragging
  // (no hover throttle), so the rubber-band + ghost track smoothly.
  const isFollowing = phase === 'dragging' || phase === 'hotGrip';
  if (!isFollowing && now - throttle.lastCheckTime < GRIP_HOVER_THROTTLE_MS) return;
  if (!isFollowing) throttle.lastCheckTime = now;
  throttle.lastWorldPoint = worldPos;
  if (isFollowing && activeGrip) {
    setCurrentWorldPos(worldPos);
    // ADR-363 — publish the constant drag anchor (same one that feeds the ghost
    // via `buildDxfDragPreview`) so the cursor leaf can snap the crosshair onto
    // the step grid with the fresh world pos each frame (zero-lag, WYSIWYG).
    if (anchorRef.current) setGripStepAnchor(anchorRef.current);
    else clearGripStepAnchor();
    if (phase === 'hotGrip') {
      // ADR-363 Phase 1G.2/1G.3 — any pick step (waiting for a deliberate
      // click: base/centre/ref/align) marks "moved" on a real mousemove so the
      // next click advances/commits. The same-tick double mouseup (canvas+
      // container) produces NO mousemove, so its stray fire2 stays moved=false
      // → 'stay', and a single click can never burn two steps. The terminal
      // 'tracking' step (move/corner) uses the anchor-distance check below.
      if (hotGripStepRef.current !== 'tracking') {
        hotGripMovedRef.current = true;
        // ADR-397 — free rotate: lock the sweep baseline at the FIRST move after
        // the centre (at centre-pick the cursor is ON the pivot → angle undefined).
        // Require a minimum distance from the pivot so refDir is never degenerate.
        if (
          hotGripStepRef.current === 'rotate-free' &&
          hotGripRotateBaseRef.current === null &&
          hotGripBaseRef.current
        ) {
          const pdx = worldPos.x - hotGripBaseRef.current.x;
          const pdy = worldPos.y - hotGripBaseRef.current.y;
          if (pdx * pdx + pdy * pdy > HOT_GRIP_MOVE_EPS_SQ) hotGripRotateBaseRef.current = worldPos;
        }
      }
      // Tracking (move/corner): once the cursor leaves the anchor, mark moved
      // so the next deliberate click commits (a stray same-spot release stays hot).
      if (anchorRef.current) {
        const adx = worldPos.x - anchorRef.current.x;
        const ady = worldPos.y - anchorRef.current.y;
        if (adx * adx + ady * ady > HOT_GRIP_MOVE_EPS_SQ) hotGripMovedRef.current = true;
      }
    }
    if (activeGrip.source === 'overlay') setDragPreviewPosition(worldPos);
    return;
  }
  // ADR-040 XXII.A: live SSoT read — no stale-closure on rapid zoom.
  const nearGrip = findNearestGrip(worldPos, allGrips, effectiveTolerance, getImmediateTransform().scale);
  if (nearGrip) {
    if (!hoveredGrip || hoveredGrip.id !== nearGrip.id) {
      setHoveredGrip(nearGrip);
      if (gripStyleStore.get().snapToGrips) lockGripSnapPosition(nearGrip.position);
      setPhase('hovering');
      if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
      warmTimerRef.current = setTimeout(() => { setPhase('warm'); warmTimerRef.current = null; }, WARM_DELAY_MS);
    }
    // ADR-397 Φ2 — per-arm hover highlight. Runs even when the grip id is
    // unchanged (cursor moving BETWEEN arms of the same MOVE handle), so the lit
    // arm tracks the cursor. Only MOVE grips carry a frame; classify in the
    // entity's WORLD frame and publish + repaint on change (the grip id alone
    // would not re-trigger React, and a plain cursor move marks no canvas dirty).
    updateMoveGlyphHoverZone(nearGrip, worldPos, gripSizePx);
  } else if (hoveredGrip && phase !== 'dragging') {
    setHoveredGrip(null);
    unlockGripSnapPosition();
    setPhase('idle');
    if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
    if (MoveGlyphZoneStore.clear()) markSystemsDirty(['dxf-canvas']);
  }
}
