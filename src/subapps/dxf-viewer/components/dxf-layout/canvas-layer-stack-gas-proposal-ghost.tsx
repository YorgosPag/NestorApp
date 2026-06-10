'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * GasProposalGhostPreviewMount (ADR-434 Slice 2) — gas (φυσικό αέριο) auto-design proposal
 * ghost. Thin discipline mount: subscribes to `useGasProposal()` and hands the SSoT
 * `ProposalGhostOverlay` a `paint` closure that strokes every proposed fuel-gas run (domain
 * `fuel`) with the SSoT classification colour (`fuel-gas` → yellow) + its translucent fill.
 */

import React, { useCallback } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { ProposalGhostOverlay, type ProposalGhostPaint } from './ProposalGhostOverlay';
import { paintGhostSegments, type GhostSegmentDraw } from './proposal-ghost-paint';
import { useGasProposal } from '../../systems/mep-design/gas/gas-proposal-store';
import {
  resolveSegmentClassificationColor,
  hexToRgba,
} from '../../bim/mep-systems/mep-system-color';
import { mmToSceneUnits } from '../../utils/scene-units';

/** Translucent fill alpha for the proposal ghost outline (matches the segment ghost). */
const GAS_GHOST_FILL_ALPHA = 0.25;

export interface GasProposalGhostPreviewMountProps {
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export const GasProposalGhostPreviewMount = React.memo(
  function GasProposalGhostPreviewMount({
    transform,
    viewport,
  }: GasProposalGhostPreviewMountProps) {
    const review = useGasProposal();
    const paint = useCallback<ProposalGhostPaint>(
      (ctx, t, vp) => {
        if (!review) return;
        const mmScale = mmToSceneUnits(review.sceneUnits);
        const segs: GhostSegmentDraw[] = [];
        for (const network of review.proposal.networks) {
          const colour = resolveSegmentClassificationColor(network.classification);
          const stroke = colour ?? undefined;
          const fill = colour ? hexToRgba(colour, GAS_GHOST_FILL_ALPHA) : undefined;
          for (const seg of network.segments) {
            segs.push({ start: seg.start, end: seg.end, diameterMm: seg.diameterMm, stroke, fill });
          }
        }
        paintGhostSegments(ctx, segs, t, vp, mmScale, 'fuel');
      },
      [review],
    );
    return (
      <ProposalGhostOverlay
        active={review !== null}
        transform={transform}
        viewport={viewport}
        paint={paint}
        dataOverlay="gas-proposal"
      />
    );
  },
);
