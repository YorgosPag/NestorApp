'use client';

/**
 * BimPlacementOverlay2D — Canvas2D overlay που ζωγραφίζει το placement feedback της κολώνας
 * (πολικό/καρτεσιανό **μαγνητικό πλέγμα**, **δυναμικές διαστάσεις**, **γραμμές-οδηγοί**) στον 3D
 * καμβά με τον **ΙΔΙΟ ΑΚΡΙΒΩΣ 2D paint-κώδικα** (ADR-544). Mirror του `BimGripOverlay2D` /
 * `BimSnapIndicatorOverlay3D`: ένα `pointer-events-none` layer πάνω από το WebGL που, κάθε RAF
 * frame, διαβάζει τη live κάμερα και προβάλλει το αποθηκευμένο meta σε canvas-px.
 *
 * Μία πηγή αλήθειας: το meta παράγεται από το ΕΝΑ 2D `generateColumnPreview` (βλ.
 * `use-bim3d-column-placement`) και ζωγραφίζεται από τους ΙΔΙΟΥΣ painters μέσω του 3D
 * `OverlayProjector` (`makePlacementOverlayProjector`, κάμερα αντί transform) → ίδια εικόνα 2D↔3D.
 *
 * ADR-040 micro-leaf: subscribe ΜΟΝΟ στο low-frequency meta (ξεκινά/σταματά το RAF)· η per-frame
 * προβολή γίνεται imperative στο draw (zero high-freq React state). Occlusion («μόνο μπροστινά»,
 * ADR-542): ο ΙΔΙΟΣ `GripDepthOccluder` κρύβει όλο το overlay όταν το σημείο κουμπώματος είναι
 * πίσω από όγκο. Κατά την κίνηση κάμερας το overlay κρύβεται και επανέρχεται στο settle.
 */

import { useRef, useSyncExternalStore, useCallback, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import { sizeCanvasToContainerDpr } from '../../../rendering/canvas/withCanvasState';
import { getImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import { dxfPlanToWorld } from '../coordinate-transforms';
import { useRafWhile, useCameraMotionGate, useGripDepthOccluder } from '../overlay-raf';
import { usePlacement3DOverlayStore } from '../../stores/Placement3DOverlayStore';
import { makePlacementOverlayProjector } from '../../placement/placement-overlay-project';
import { scenePointToPlanMm } from '../../placement/world-to-scene-point';
import { paintPlacement3DOverlay } from './placement-overlay-paint';

export interface BimPlacementOverlay2DProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

export function BimPlacementOverlay2D({ managerRef }: BimPlacementOverlay2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // GPU depth-occluder — shared lifecycle SSoT (overlay-raf), ίδιο instance με grips/snap/crosshair.
  const occluderRef = useGripDepthOccluder();
  // Κρύψε το overlay κατά την κίνηση κάμερας (shared SSoT, ADR-542).
  const isCameraMoving = useCameraMotionGate();

  // ADR-040 — subscribe ΜΟΝΟ στο low-frequency meta (οδηγεί το RAF on/off).
  const meta = useSyncExternalStore(
    usePlacement3DOverlayStore.subscribe,
    () => usePlacement3DOverlayStore.getState().meta,
    () => null,
  );
  const active = meta !== null;

  // Ένα frame: μέγεθος canvas (DPR), occlusion-cull, προβολή & paint των ΙΔΙΩΝ 2D painters.
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const manager = managerRef.current;
    if (!canvas || !container || !manager) return;
    const camera = manager.getCamera();
    if (!camera) return;
    const ctx = sizeCanvasToContainerDpr(canvas, container);
    if (!ctx) return;
    if (isCameraMoving(camera)) return; // canvas ήδη καθαρό → κρυφό κατά την κίνηση
    const cur = usePlacement3DOverlayStore.getState().meta;
    if (!cur) return;

    // Occlusion («μόνο μπροστινά»): το σημείο κουμπώματος πίσω από όγκο → κρύψε όλο το overlay.
    const occluder = occluderRef.current;
    if (occluder) {
      const planMm = scenePointToPlanMm(cur.anchorScene, cur.sceneUnits);
      const world = dxfPlanToWorld(planMm.x, planMm.y, cur.elevMm);
      const vis = occluder.computeVisibility(manager.renderer, manager.scene, camera, [world]);
      if (vis && vis[0] === false) return;
    }

    const project = makePlacementOverlayProjector(camera, canvas, cur.sceneUnits, cur.elevMm);
    const viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    paintPlacement3DOverlay(ctx, cur, project, getImmediateTransform(), viewport);
  }, [managerRef, isCameraMoving]);

  // Καθάρισε τον καμβά όταν το meta αδειάζει / on unmount (shared overlay RAF SSoT, ADR-542).
  const onStop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);
  useRafWhile(active, draw, onStop, 'placement'); // 🔬 ADR-549 Phase 0

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
