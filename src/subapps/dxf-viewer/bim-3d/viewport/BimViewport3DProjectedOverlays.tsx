"use client";

import React, { type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { ClashMarkers3DOverlay } from '../coordination/ClashMarkers3DOverlay';
import { ProposalGhost3DMount } from '../proposal/ProposalGhost3DMount';
import { ColumnDiagram3DOverlay } from '../diagrams/ColumnDiagram3DOverlay';
import { BeamDiagram3DOverlay } from '../diagrams/BeamDiagram3DOverlay';

export interface BimViewport3DProjectedOverlaysProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

/**
 * BimViewport3DProjectedOverlays — DOM overlays projected via the scene camera,
 * all driven by the same `managerRef`. Extracted from BimViewport3D (N.7.1) so the
 * viewport orchestrator stays under the 500-line budget. Pure passthrough mount.
 */
export function BimViewport3DProjectedOverlays({
  managerRef,
}: BimViewport3DProjectedOverlaysProps): React.ReactElement {
  return (
    <>
      {/* ADR-435 Slice 1b — 3D clash markers (DOM ⊙ projected via camera; same glyph as 2D). */}
      <ClashMarkers3DOverlay managerRef={managerRef} />
      {/* MEP auto-design 3D proposal ghost (SSoT twin of the 2D ProposalGhostOverlay). */}
      <ProposalGhost3DMount managerRef={managerRef} />
      {/* ADR-483 Slice 5 — 3D column M/V/N diagrams (κατακόρυφος άξονας· twin του 2Δ). */}
      <ColumnDiagram3DOverlay managerRef={managerRef} />
      {/* ADR-483 Slice 6 — 3D beam M/V/N diagrams (κάθετο επίπεδο ανοίγματος). */}
      <BeamDiagram3DOverlay managerRef={managerRef} />
    </>
  );
}
