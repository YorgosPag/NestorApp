'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ElectricalProposalGhostPreviewMount (ADR-430 Slice 2) — the electrical-strong (+weak)
 * auto-design proposal ghost. Thin discipline mount: subscribes to the LOW-FREQUENCY
 * `useElectricalProposal()` store and hands the SSoT `ProposalGhostOverlay` a `paint` closure
 * that strokes the proposed circuits' home-run wires via the shared `drawCircuitWires`. The
 * overlay owns the dedicated canvas + persistence (so the ghost no longer vanishes when the
 * pointer stops — it used to share the transient PreviewCanvas).
 *
 * Always mounted; renders `null` while no proposal is under review.
 */

import React, { useCallback } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { ProposalGhostOverlay, type ProposalGhostPaint } from './ProposalGhostOverlay';
import { useElectricalProposal } from '../../systems/mep-design/electrical/electrical-proposal-store';
import { drawCircuitWires } from '../../bim/renderers/MepWireRenderer';

export interface ElectricalProposalGhostPreviewMountProps {
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export const ElectricalProposalGhostPreviewMount = React.memo(
  function ElectricalProposalGhostPreviewMount({
    transform,
    viewport,
  }: ElectricalProposalGhostPreviewMountProps) {
    const review = useElectricalProposal();
    const paint = useCallback<ProposalGhostPaint>(
      (ctx, t, vp) => {
        if (!review || review.wirePaths.length === 0) return;
        // colour-by-system ON: each path carries its circuit colour (lighting amber, power blue).
        drawCircuitWires(ctx, review.wirePaths, t, vp, null, true);
      },
      [review],
    );
    return (
      <ProposalGhostOverlay
        active={review !== null}
        transform={transform}
        viewport={viewport}
        paint={paint}
        dataOverlay="electrical-proposal"
      />
    );
  },
);
