"use client";

import type { MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
// ADR-535 Φ5 — 3D reshape grips drawn as a Canvas2D overlay (one render code with the 2D canvas).
import { BimGripOverlay2D } from './grips/BimGripOverlay2D';
// ADR-538 — 3D hover: DXF entity glow (Canvas2D, same 2D code) + the "+"/"−" hover badge.
import { DxfHoverGlowOverlay2D } from './grips/DxfHoverGlowOverlay2D';
// ADR-545 — unified 2D/3D CAD crosshair: follows the cursor, shows the "+"/"−" badge, and
// «κουμπώνει» to the active snap point. Reuses the SHARED CrosshairCompositor (one render code
// with the 2D canvas). Subsumes the old HoverAddBadge3D (badge now comes from the crosshair).
import { BimCrosshairOverlay3D } from './BimCrosshairOverlay3D';
// ADR-542 — 3D snap marker (column corner/midpoint/centroid) drawn with the EXACT 2D glyph + label.
import { BimSnapIndicatorOverlay3D } from './snap/BimSnapIndicatorOverlay3D';
// ADR-543 — 3D wall HUD (length/angle/thickness·height) drawn with the SAME 2D paintWallHudCore.
import { WallHudOverlay3D } from './wall-hud/WallHudOverlay3D';
// ADR-543 (COL traces 3D) — 3D Object-Snap-Tracking alignment lines drawn with the SAME 2D tracking-paint.
import { Tracking3DOverlay } from './tracking/Tracking3DOverlay';
// ADR-544 — 3D column placement overlay (magnetic grid / live dims / guides) drawn with the SAME 2D painters.
import { BimPlacementOverlay2D } from './placement/BimPlacementOverlay2D';
// ADR-513/537 — 3D Radial Command Ring (wall dynamic input L/θ/πάχος/ύψος): the SAME 2D SSoT component.
import { DynamicInput3DLeaf } from './DynamicInput3DLeaf';

export interface BimViewport3DCanvasOverlaysProps {
  managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

/**
 * ADR-535/538/542/543/544/545 — the cluster of Canvas2D overlays projected through the
 * perspective camera. Each is a micro-leaf that mirrors a 2D painter (one render code with
 * the 2D canvas). Extracted from `BimViewport3D` for N.7.1 (≤500 lines); pure pass-through
 * of `managerRef`, zero behavior change.
 */
export function BimViewport3DCanvasOverlays({ managerRef }: BimViewport3DCanvasOverlaysProps) {
  return (
    <>
      {/* ADR-535 Φ5 — 3D reshape grips: Canvas2D overlay drawn with the SAME 2D UnifiedGripRenderer. */}
      <BimGripOverlay2D managerRef={managerRef} />
      {/* ADR-538 — hovered RAW DXF entity lights up with the EXACT 2D yellow glow (projected). */}
      <DxfHoverGlowOverlay2D managerRef={managerRef} />
      {/* ADR-545 — unified CAD crosshair: follows the cursor, shows the "+"/"−" badge, and
          «κουμπώνει» to the active snap point, reusing the SHARED CrosshairCompositor. */}
      <BimCrosshairOverlay3D managerRef={managerRef} />
      {/* ADR-542 — snap marker (┘/▲/⊕): EXACT 2D glyph+label, same engine, projected, occlusion-culled. */}
      <BimSnapIndicatorOverlay3D managerRef={managerRef} />
      {/* ADR-543 — live wall HUD (length/angle/thickness·height) while drawing a wall in 3D, painted
          with the SAME paintWallHudCore as the 2D canvas (projected through the perspective camera). */}
      <WallHudOverlay3D managerRef={managerRef} />
      {/* ADR-543 (COL traces 3D) — Revit-style ambient alignment lines while drawing a wall in 3D,
          painted with the SAME 2D tracking-paint painters projected through the perspective camera. */}
      <Tracking3DOverlay managerRef={managerRef} />
      {/* ADR-544 — column placement overlay (magnetic grid / live dims / alignment guides) while drawing
          a column in 3D, painted with the SAME 2D painters projected through the perspective camera. */}
      <BimPlacementOverlay2D managerRef={managerRef} />
      {/* ADR-513/537 — wall dynamic input: the SAME 2D Radial Command Ring (Μήκος/Γωνία/Πάχος/Ύψος),
          gated to wall `awaitingEnd`. The 2D DynamicInputSubscriber yields in 3D (one ring per view). */}
      <DynamicInput3DLeaf managerRef={managerRef} />
    </>
  );
}
