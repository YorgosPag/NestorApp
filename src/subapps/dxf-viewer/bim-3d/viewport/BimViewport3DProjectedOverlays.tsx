"use client";

import React, { type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { ClashMarkers3DOverlay } from '../coordination/ClashMarkers3DOverlay';
import { TopoQaMarkers3DOverlay } from '../coordination/TopoQaMarkers3DOverlay';
import { ProposalGhost3DMount } from '../proposal/ProposalGhost3DMount';
import { ColumnDiagram3DOverlay } from '../diagrams/ColumnDiagram3DOverlay';
import { BeamDiagram3DOverlay } from '../diagrams/BeamDiagram3DOverlay';
import { BimViewport3DTextEditorLeaf } from '../text/BimViewport3DTextEditorLeaf';
import { useViewFocus3D } from './use-view-focus-3d';

export interface BimViewport3DProjectedOverlaysProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  /** ADR-344 Φ-3D — ο renderer canvas, όπου δένεται ο `dblclick` του text editor. */
  readonly canvasEl: HTMLCanvasElement | null;
}

/**
 * BimViewport3DProjectedOverlays — DOM overlays projected via the scene camera,
 * all driven by the same `managerRef`. Extracted from BimViewport3D (N.7.1) so the
 * viewport orchestrator stays under the 500-line budget. Pure passthrough mount.
 */
export function BimViewport3DProjectedOverlays({
  managerRef,
  canvasEl,
}: BimViewport3DProjectedOverlaysProps): React.ReactElement {
  // ADR-435 / ADR-650 M5α.2 — «zoom to X» from ANY report panel, for as long as 3D is mounted.
  // Lives here (not in a report overlay) because the camera framing was never report-specific.
  useViewFocus3D(managerRef);

  return (
    <>
      {/* ADR-435 Slice 1b — 3D clash markers (DOM ⊙ projected via camera; same glyph as 2D). */}
      <ClashMarkers3DOverlay managerRef={managerRef} />
      {/* ADR-650 M5α.2 — 3D topography-QA markers (same ⊙ glyph + layer as the 2D twin). */}
      <TopoQaMarkers3DOverlay managerRef={managerRef} />
      {/* MEP auto-design 3D proposal ghost (SSoT twin of the 2D ProposalGhostOverlay). */}
      <ProposalGhost3DMount managerRef={managerRef} />
      {/* ADR-483 Slice 5 — 3D column M/V/N diagrams (κατακόρυφος άξονας· twin του 2Δ). */}
      <ColumnDiagram3DOverlay managerRef={managerRef} />
      {/* ADR-483 Slice 6 — 3D beam M/V/N diagrams (κάθετο επίπεδο ανοίγματος). */}
      <BeamDiagram3DOverlay managerRef={managerRef} />
      {/* ADR-344 Φ-3D — in-place TipTap editor κειμένου (ο ΙΔΙΟΣ με το 2D· αγκυρωμένος
          στην προβολή της κάμερας, οριζόντιος + ευανάγνωστος κατά AutoCAD MTEXTFIXED=2). */}
      <BimViewport3DTextEditorLeaf managerRef={managerRef} canvasEl={canvasEl} />
    </>
  );
}
