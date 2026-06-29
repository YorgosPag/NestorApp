"use client";

import type { MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
// ADR-555 — the ONE shared camera-projected overlay dispatch canvas. Folds the 5 former overlay
// leaves (grip ADR-535, DXF hover-glow ADR-538, wall-HUD ADR-543, tracking ADR-543, placement ADR-544)
// into ONE z-ordered multi-pass canvas. 3D sibling of the 2D PreviewCanvas dispatch (ADR-552/554).
import { BimOverlayDispatchCanvas } from './overlay-dispatch/BimOverlayDispatchCanvas';
// ADR-545 — unified 2D/3D CAD crosshair: follows the cursor, shows the "+"/"−" badge, and
// «κουμπώνει» to the active snap point. Reuses the SHARED CrosshairCompositor (one render code
// with the 2D canvas). Subsumes the old HoverAddBadge3D (badge now comes from the crosshair).
import { BimCrosshairOverlay3D } from './BimCrosshairOverlay3D';
// ADR-542 — 3D snap marker (column corner/midpoint/centroid) drawn with the EXACT 2D glyph + label.
import { BimSnapIndicatorOverlay3D } from './snap/BimSnapIndicatorOverlay3D';
// ADR-513/537 — 3D Radial Command Ring (wall dynamic input L/θ/πάχος/ύψος): the SAME 2D SSoT component.
import { DynamicInput3DLeaf } from './DynamicInput3DLeaf';

export interface BimViewport3DCanvasOverlaysProps {
  managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

/**
 * ADR-555/545/542/513 — the cluster of camera-projected overlays over the 3D WebGL viewport. The 5
 * former Canvas2D overlay leaves (grip/hover-glow/wall-HUD/tracking/placement) are now folded into the
 * ONE shared `BimOverlayDispatchCanvas` (ADR-555). The crosshair (HTML), snap marker (SVG), and radial
 * command ring (DOM) stay separate — they are NOT camera-projected Canvas2D layers (ADR-551 §5.3/§5.4).
 * Pure pass-through of `managerRef`, zero behavior change.
 */
export function BimViewport3DCanvasOverlays({ managerRef }: BimViewport3DCanvasOverlaysProps) {
  return (
    <>
      {/* ADR-555 — ONE shared dispatch canvas folding grips (ADR-535) + DXF hover-glow (ADR-538) +
          wall-HUD (ADR-543) + ambient tracking (ADR-543) + column placement (ADR-544), each drawn with
          the SAME 2D painter, z-ordered, projected through the perspective camera (5 overlay canvases → 1). */}
      <BimOverlayDispatchCanvas managerRef={managerRef} />
      {/* ADR-545 — unified CAD crosshair: follows the cursor, shows the "+"/"−" badge, and
          «κουμπώνει» to the active snap point, reusing the SHARED CrosshairCompositor. */}
      <BimCrosshairOverlay3D managerRef={managerRef} />
      {/* ADR-542 — snap marker (┘/▲/⊕): EXACT 2D glyph+label, same engine, projected, occlusion-culled. */}
      <BimSnapIndicatorOverlay3D managerRef={managerRef} />
      {/* ADR-513/537 — wall dynamic input: the SAME 2D Radial Command Ring (Μήκος/Γωνία/Πάχος/Ύψος),
          gated to wall `awaitingEnd`. The 2D DynamicInputSubscriber yields in 3D (one ring per view). */}
      <DynamicInput3DLeaf managerRef={managerRef} />
    </>
  );
}
