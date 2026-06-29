'use client';

/**
 * use-wall-hud-pass — the live wall-HUD layer of the unified overlay dispatch (ADR-555). Carries the
 * EXACT draw of the former `WallHudOverlay3D` (ADR-543): the length / angle / thickness·height HUD
 * drawn with the SAME `paintWallHudCore` the 2D canvas uses, projected through the live camera. One
 * source of truth with the 2D drawing HUD — the layout math + number formatters + labels live ONCE in
 * `paintWallHudCore`; only the projection (perspective camera) and the aligned-dim primitive are
 * injected.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the low-frequency activation inputs (active tool, 3D view,
 * FSM `hasStart`); the high-frequency HUD payload is read imperatively from the non-reactive
 * `wall3DHudData` each frame.
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../../rendering/types/Types';
import { toolStateStore } from '../../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../../stores/ViewMode3DStore';
import { useWallPreview } from '../../../bim/walls/wall-preview-store';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { formatLengthForDisplay } from '../../../config/display-length-format';
import { i18n } from '@/i18n';
import { makeGripPlanToCanvas } from '../../grips/grip-3d-screen-project';
import { dxfPlanToWorld, getPixelWorldSize } from '../coordinate-transforms';
import {
  paintWallHudCore,
  paintProjectedAlignedDim,
  type WallHudProjector,
} from '../../../canvas-v2/preview-canvas/wall-hud-paint';
import { wall3DHudData } from '../wall-hud/wall-3d-hud-store';
import type { BimOverlayFrame, BimOverlayPass } from './bim-overlay-pass';

/** One dispatch frame for the wall-HUD layer — SAME `paintWallHudCore`, fed the 3D camera projector. */
function paintWallHudOverlay({ ctx, camera, canvas }: BimOverlayFrame): void {
  const { meta, floorElevationMm, sceneUnits } = wall3DHudData;
  if (!meta) return;

  // The HUD meta points are in SCENE units; the projector works in plan mm — convert once.
  const mmFactor = 1 / mmToSceneUnits(sceneUnits);
  const mmProject = makeGripPlanToCanvas(camera, canvas, () => floorElevationMm);
  const toScreen = (pScene: Point2D): Point2D =>
    mmProject({ x: pScene.x * mmFactor, y: pScene.y * mmFactor });

  // Scene units per screen pixel, derived from the camera at the wall midpoint (screen-constant).
  const midWorld = dxfPlanToWorld(
    ((meta.start.x + meta.end.x) / 2) * mmFactor,
    ((meta.start.y + meta.end.y) / 2) * mmFactor,
    floorElevationMm,
  );
  const dist = camera.position.distanceTo(midWorld);
  const scenePerPx = getPixelWorldSize(dist, camera, canvas) * 1000 * mmToSceneUnits(sceneUnits);

  const projector: WallHudProjector = {
    toScreen,
    worldPerPixel: scenePerPx,
    drawAlignedDim: (p1, p2, dimRef, label, color) =>
      paintProjectedAlignedDim(ctx, p1, p2, dimRef, label, toScreen, color),
  };

  // SAME spec label the 2D handler builds (i18n «πάχος X · ύψος Y», display units), zero new key (N.11).
  const specLabel = i18n.t('tools.wall.hudSpec', {
    thickness: formatLengthForDisplay(meta.thicknessMm),
    height: formatLengthForDisplay(meta.heightMm),
    ns: 'dxf-viewer-shell',
  });
  paintWallHudCore(ctx, meta, specLabel, projector);
}

/**
 * The wall-HUD layer as a dispatch pass. Shows during `awaitingEnd` (a start point is set), matching
 * the 2D `wantHud` rule: `is3D && activeTool === 'wall' && hasStart`.
 */
export function useWallHudPass(): BimOverlayPass {
  const activeTool = useSyncExternalStore(
    toolStateStore.subscribe,
    () => toolStateStore.get().activeTool,
    () => toolStateStore.get().activeTool,
  );
  const is3D = useViewMode3DStore((s) => selectIs3D(s));
  const hasStart = useWallPreview().startPoint !== null;
  return {
    active: is3D && activeTool === 'wall' && hasStart,
    hideOnMotion: true,
    paint: paintWallHudOverlay,
  };
}
