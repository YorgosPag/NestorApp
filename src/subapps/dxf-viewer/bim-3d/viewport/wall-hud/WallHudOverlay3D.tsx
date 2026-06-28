'use client';

/**
 * WallHudOverlay3D — draws the live wall HUD (length / angle / thickness·height) in the
 * 3D viewport with the SAME `paintWallHudCore` the 2D canvas uses (ADR-543). Mirror of
 * `BimGripOverlay2D`: a `pointer-events-none` Canvas2D layer over the WebGL viewport that,
 * each RAF frame, reads the LIVE camera and projects the stored HUD points to canvas px.
 *
 * One source of truth with the 2D drawing HUD: the layout math (offsets, perpendicular,
 * label positions) + the number formatters (`formatLengthForDisplay`, `formatAngleLocale`)
 * + the labels (`drawOverlayLabel`) live ONCE in `paintWallHudCore`; only the projection
 * (perspective camera vs affine transform) and the aligned-dim line primitive are injected.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the low-frequency activation inputs (active tool,
 * 3D view, FSM phase) to start / stop the RAF. The high-frequency HUD payload (changes on
 * every cursor move) is read imperatively from the non-reactive `wall3DHudData` each frame
 * (zero re-render). During camera motion the HUD hides and snaps back on settle, mirror of
 * the grip / snap overlays.
 */

import { useRef, useCallback, useSyncExternalStore, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import type { Point2D } from '../../../rendering/types/Types';
import { toolStateStore } from '../../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../../stores/ViewMode3DStore';
import { useWallPreview } from '../../../bim/walls/wall-preview-store';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { formatLengthForDisplay } from '../../../config/display-length-format';
import { i18n } from '@/i18n';
import { sizeCanvasToContainerDpr } from '../../../rendering/canvas/withCanvasState';
import { makeGripPlanToCanvas } from '../../grips/grip-3d-screen-project';
import { dxfPlanToWorld, getPixelWorldSize } from '../coordinate-transforms';
import { useRafWhile, useCameraMotionGate } from '../overlay-raf';
import {
  paintWallHudCore,
  paintProjectedAlignedDim,
  type WallHudProjector,
} from '../../../canvas-v2/preview-canvas/wall-hud-paint';
import { wall3DHudData } from './wall-3d-hud-store';

export interface WallHudOverlay3DProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

export function WallHudOverlay3D({ managerRef }: WallHudOverlay3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isCameraMoving = useCameraMotionGate();

  // ADR-040 — low-frequency activation gate only. The wall HUD shows during `awaitingEnd`
  // (a start point is set), matching the 2D `wantHud` rule; subscribe to the FSM preview
  // store (changes on clicks, not on moves) + the active tool + the 3D view flag.
  const activeTool = useSyncExternalStore(
    toolStateStore.subscribe,
    () => toolStateStore.get().activeTool,
    () => toolStateStore.get().activeTool,
  );
  const is3D = useViewMode3DStore((s) => selectIs3D(s));
  const hasStart = useWallPreview().startPoint !== null;
  const active = is3D && activeTool === 'wall' && hasStart;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const manager = managerRef.current;
    if (!canvas || !container || !manager) return;
    const camera = manager.getCamera();
    if (!camera) return;

    // Size the overlay canvas to the viewport at DPR + clear (shared SSoT, CSS px).
    const ctx = sizeCanvasToContainerDpr(canvas, container);
    if (!ctx) return;

    // Hide the HUD while the camera moves (orbit/zoom/pan); reappears on settle.
    if (isCameraMoving(camera)) return; // canvas already cleared above

    const { meta, floorElevationMm, sceneUnits } = wall3DHudData;
    if (!meta) return;

    // The HUD meta points are in SCENE units; the projector works in plan mm — convert once.
    const mmFactor = 1 / mmToSceneUnits(sceneUnits);
    const mmProject = makeGripPlanToCanvas(camera, canvas, () => floorElevationMm);
    const toScreen = (pScene: Point2D): Point2D =>
      mmProject({ x: pScene.x * mmFactor, y: pScene.y * mmFactor });

    // Scene units per screen pixel, derived from the camera at the wall midpoint (so the
    // HUD clearances stay screen-constant exactly like the 2D `worldPerPixel`).
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

    // SAME spec label the 2D handler builds (i18n «πάχος X · ύψος Y», display units) — the
    // EXACT `tools.wall.hudSpec` key + `formatLengthForDisplay`, zero new key (N.11).
    const specLabel = i18n.t('tools.wall.hudSpec', {
      thickness: formatLengthForDisplay(meta.thicknessMm),
      height: formatLengthForDisplay(meta.heightMm),
      ns: 'dxf-viewer-shell',
    });
    paintWallHudCore(ctx, meta, specLabel, projector);
  }, [managerRef, isCameraMoving]);

  const onStop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);
  useRafWhile(active, draw, onStop, 'wall-hud'); // 🔬 ADR-549 Phase 0

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
