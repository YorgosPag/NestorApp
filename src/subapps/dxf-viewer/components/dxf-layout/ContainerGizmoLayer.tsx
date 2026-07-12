/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ContainerGizmoLayer — ADR-575 §8 / ADR-640 / ADR-040 SHARED micro-leaf: the whole-
 * container interactive GIZMO canvas (the ONE painter for a GROUP's and a BLOCK's gizmo).
 *
 * When one or more composite CONTAINERS are selected, paints — per container — the shared
 * gizmo (ONE move cross + ONE rotation handle at the bbox centre, Revit / Cinema 4D / AutoCAD
 * INSERT) on its own canvas, using the SAME `UnifiedGripRenderer` + `gripGlyphShape` +
 * temperature vocabulary as EVERY other grip (pixel-identical). The grips themselves are ALSO
 * published to `AllGripsStore` by `GripRegistryPublisher` (the hit-test / drag source) — this
 * leaf only DRAWS them.
 *
 * Container-agnostic: the ONLY per-container difference is HOW the grips are resolved from the
 * scene (`resolveSelectedGroups` + `getGroupGizmoGrips` vs `resolveSelectedBlocks` +
 * `getBlockGizmoGrips`), injected via the `resolveGrips` prop. The glyph shape reads each grip's
 * tagged `gripKind.kind` directly (entity-agnostic, mirror `hotGripKindOf`), so there is ZERO
 * container-specific branching here and ZERO duplicated canvas/DPR/paint logic (N.18).
 *
 * Self-subscribes to selection + the reactive scene, so the CanvasLayerStack shell stays
 * subscription-free (ADR-040 cardinal rule #1). Repaint is low-frequency (selection / scene /
 * transform / grip-hover change) — NO RAF.
 *
 * @see components/dxf-layout/GroupGizmoLayer.tsx — the GROUP wrapper (ADR-575 §8).
 * @see components/dxf-layout/BlockGizmoLayer.tsx — the BLOCK wrapper (ADR-640).
 */
'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useSelectedEntityIds } from '../../systems/selection/useSelectedEntities';
import { useLevelScene } from '../../systems/scene/useSceneSelectors';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
// ADR-641 / ADR-559 — the ONE grip-type display predicate, shared with the hit-test path
// (`grip-registry`), so a container's edge-midpoint handles (block selection box) are drawn
// iff they are pickable («visible ≡ pickable»). Low-freq settings read → ADR-040-safe leaf.
import { isGripTypeVisible } from '../../hooks/grips/grip-type-visibility';
import { useGripStyle } from '../../stores/GripStyleStore';
import { UnifiedGripRenderer } from '../../rendering/grips/UnifiedGripRenderer';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import type { Entity } from '../../types/entities';
import type { GripInfo } from '../../hooks/grip-types';
import type { GripRenderConfig, GripTemperature } from '../../rendering/grips/types';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { DxfGripInteractionState } from '../../hooks/grip-computation';

/** Resolve the gizmo grips for every selected container in a scene (container-specific). */
export type ContainerGripResolver = (
  entities: readonly Entity[] | undefined,
  selectedIds: string[],
) => GripInfo[];

interface ContainerGizmoLayerProps {
  /** Active level id — the reactive scene slice this leaf subscribes to (ADR-040). */
  sceneLevelId: string | null;
  transform: ViewTransform;
  viewport: { width: number; height: number };
  /** Hovered/active grip refs → warm/hot temperature (pixel parity with every grip). */
  gripInteractionState: DxfGripInteractionState | undefined;
  /** Optional configured grip size (falls back to the renderer default). */
  gripSize?: number;
  className?: string;
  /** Container-specific grip resolution (group vs block). MUST be a stable identity. */
  resolveGrips: ContainerGripResolver;
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

export const ContainerGizmoLayer = React.memo(function ContainerGizmoLayer({
  sceneLevelId,
  transform,
  viewport,
  gripInteractionState,
  gripSize,
  className,
  resolveGrips,
}: ContainerGizmoLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedEntityIds = useSelectedEntityIds();
  const sceneModel = useLevelScene(sceneLevelId);
  // ADR-641 / ADR-559 — the «Grip Types» display prefs; the ONLY reason a resolved gizmo grip is
  // filtered is the edge-midpoint (block box) handles honouring «Midpoints» (wall parity). The
  // move/rotation gizmo handles are `vertex` → always pass, so a GROUP (2 handles) is untouched.
  const { showMidpoints, showCenters, showQuadrants } = useGripStyle();

  // The gizmo grips for every selected container (move cross + rotation handle @ bbox centre,
  // plus — for a block — the 8 perimeter box handles), filtered by the grip-type prefs so the
  // DRAWN set matches the pickable set published to `AllGripsStore` (ADR-559).
  const grips: GripInfo[] = useMemo(
    () => resolveGrips(sceneModel?.entities, selectedEntityIds).filter((g) =>
      isGripTypeVisible(g.type, { showMidpoints, showCenters, showQuadrants }),
    ),
    [sceneModel, selectedEntityIds, resolveGrips, showMidpoints, showCenters, showQuadrants],
  );

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
      // Entity-agnostic glyph: the grip's tagged `gripKind.kind` (`group-*` / `block-*`)
      // resolves to its glyph via the ONE registry, no container branch (mirror hotGripKindOf).
      shape: gripGlyphShape(g.gripKind?.kind),
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
