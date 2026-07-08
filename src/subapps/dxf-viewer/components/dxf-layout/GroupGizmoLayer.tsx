/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * GroupGizmoLayer — ADR-575 §8 / ADR-040 micro-leaf: the whole-group interactive GIZMO.
 *
 * When one or more GROUP containers are selected, paints — per group — the shared
 * gizmo (ONE move cross + ONE rotation handle at the bbox centre, Revit / Cinema 4D)
 * on its own canvas, using the SAME `UnifiedGripRenderer` + `gripGlyphShape` +
 * temperature vocabulary as EVERY other grip (pixel-identical, Giorgio's choice). The
 * grips themselves are ALSO published to `AllGripsStore` by `GripRegistryPublisher`
 * (the hit-test / drag source) — this leaf only DRAWS them; hit-testing + commit live
 * in the unified grip pipeline (`getGroupGizmoGrips` → hot-grip flow → commit).
 *
 * Why a dedicated canvas (not the per-entity DxfRenderer grip pass): a group is
 * EXPANDED into its members before rendering, so there is no `type:'group'` entity in
 * the render scene to hang grips on, and its members are grip-suppressed. This leaf is
 * the group's render home, mirroring `GroupSelectionOverlaySubscriber` (the SVG box +
 * pill) — it self-subscribes to selection + the reactive scene, so the CanvasLayerStack
 * shell stays subscription-free (ADR-040 cardinal rule #1).
 *
 * Repaint is low-frequency (selection / scene / transform / grip-hover change) — NO RAF:
 * the gizmo is static until a drag, and during a drag the live ghost + pivot marker take
 * over (`useGripGhostPreview`). A plain layout effect repaints on those deps only.
 *
 * @see systems/group/group-gizmo-grips.ts — `getGroupGizmoGrips` (the grips, SSoT)
 * @see rendering/grips/UnifiedGripRenderer.ts — the SAME glyph renderer every grip uses
 * @see components/dxf-layout/GroupSelectionOverlaySubscriber.tsx — sibling box+pill leaf
 */
'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useSelectedEntityIds } from '../../systems/selection/useSelectedEntities';
import { useLevelScene } from '../../systems/scene/useSceneSelectors';
import {
  resolveSelectedGroups,
  computeGroupSelectionBounds,
} from '../../systems/group/group-selection-bounds';
import { getGroupGizmoGrips } from '../../systems/group/group-gizmo-grips';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { UnifiedGripRenderer } from '../../rendering/grips/UnifiedGripRenderer';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import type { GripInfo } from '../../hooks/grip-types';
import type { GripRenderConfig, GripTemperature } from '../../rendering/grips/types';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { DxfGripInteractionState } from '../../hooks/grip-computation';

interface GroupGizmoLayerProps {
  /** Active level id — the reactive scene slice this leaf subscribes to (ADR-040). */
  sceneLevelId: string | null;
  transform: ViewTransform;
  viewport: { width: number; height: number };
  /** Hovered/active grip refs → warm/hot temperature (pixel parity with every grip). */
  gripInteractionState: DxfGripInteractionState | undefined;
  /** Optional configured grip size (falls back to the renderer default). */
  gripSize?: number;
  className?: string;
}

/** Warm on hover, hot while active/dragging, cold otherwise — the SSoT grip temperatures. */
function resolveGizmoTemperature(
  grip: GripInfo,
  state: DxfGripInteractionState | undefined,
): GripTemperature {
  const active = state?.activeGrip;
  if (active && active.entityId === grip.entityId && active.gripIndex === grip.gripIndex) return 'hot';
  const hovered = state?.hoveredGrip;
  if (hovered && hovered.entityId === grip.entityId && hovered.gripIndex === grip.gripIndex) return 'warm';
  return 'cold';
}

export const GroupGizmoLayer = React.memo(function GroupGizmoLayer({
  sceneLevelId,
  transform,
  viewport,
  gripInteractionState,
  gripSize,
  className,
}: GroupGizmoLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedEntityIds = useSelectedEntityIds();
  const sceneModel = useLevelScene(sceneLevelId);

  // The gizmo grips for every selected group (move cross + rotation handle @ bbox centre).
  const grips: GripInfo[] = useMemo(() => {
    const selectedGroups = resolveSelectedGroups(sceneModel?.entities, selectedEntityIds);
    if (selectedGroups.length === 0) return [];
    const out: GripInfo[] = [];
    for (const group of selectedGroups) {
      const bounds = computeGroupSelectionBounds(group);
      if (bounds) out.push(...getGroupGizmoGrips(group, bounds));
    }
    return out;
  }, [sceneModel, selectedEntityIds]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = viewport;
    const dpr = getDevicePixelRatio();
    // Bitmap size = viewport × DPR; the CSS box size comes from the `w-full h-full`
    // className (the SAME positioning every sibling overlay uses — no inline style, N.3).
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (grips.length === 0) return;

    const t2 = transform as { scale: number; offsetX: number; offsetY: number };
    const worldToScreen = (p: Point2D): Point2D =>
      CoordinateTransforms.worldToScreen(p, t2, viewport);
    const renderer = new UnifiedGripRenderer(ctx, worldToScreen);
    const configs: GripRenderConfig[] = grips.map((g) => ({
      position: g.position,
      type: g.type,
      shape: gripGlyphShape(gripKindOf(g, 'group')),
      temperature: resolveGizmoTemperature(g, gripInteractionState),
      entityId: g.entityId,
      gripIndex: g.gripIndex,
    }));
    // dpiScale = 1: the ctx is already DPR-transformed, so sizes stay in CSS px (parity
    // with the main grip pass, which resolves the SAME `gripSize` base).
    renderer.renderGripSetBatched(configs, gripSize != null ? { gripSize } : undefined);
  }, [grips, transform, viewport, gripInteractionState, gripSize]);

  if (grips.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
    />
  );
});
