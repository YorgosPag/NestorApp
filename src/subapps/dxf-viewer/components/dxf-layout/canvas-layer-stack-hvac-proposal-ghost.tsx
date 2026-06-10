'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * HvacProposalGhostPreviewMount (ADR-432 Slice 2) — supply-air duct auto-design proposal ghost.
 * Thin discipline mount: subscribes to `useHvacProposal()` and hands the SSoT
 * `ProposalGhostOverlay` a `paint` closure that strokes every proposed duct run (domain `duct`)
 * with the SSoT classification colour (supply-air light-blue; `undefined` ⇒ renderer default).
 */

import React, { useCallback } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { ProposalGhostOverlay, type ProposalGhostPaint } from './ProposalGhostOverlay';
import { paintGhostSegments, type GhostSegmentDraw } from './proposal-ghost-paint';
import { useHvacProposal } from '../../systems/mep-design/hvac/hvac-proposal-store';
import { resolveSegmentClassificationColor } from '../../bim/mep-systems/mep-system-color';
import { mmToSceneUnits } from '../../utils/scene-units';

export interface HvacProposalGhostPreviewMountProps {
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export const HvacProposalGhostPreviewMount = React.memo(
  function HvacProposalGhostPreviewMount({
    transform,
    viewport,
  }: HvacProposalGhostPreviewMountProps) {
    const review = useHvacProposal();
    const paint = useCallback<ProposalGhostPaint>(
      (ctx, t, vp) => {
        if (!review) return;
        const mmScale = mmToSceneUnits(review.sceneUnits);
        const segs: GhostSegmentDraw[] = [];
        for (const network of review.proposal.networks) {
          const stroke = resolveSegmentClassificationColor(network.classification) ?? undefined;
          for (const seg of network.segments) {
            segs.push({ start: seg.start, end: seg.end, diameterMm: seg.diameterMm, stroke });
          }
        }
        paintGhostSegments(ctx, segs, t, vp, mmScale, 'duct');
      },
      [review],
    );
    return (
      <ProposalGhostOverlay
        active={review !== null}
        transform={transform}
        viewport={viewport}
        paint={paint}
        dataOverlay="hvac-proposal"
      />
    );
  },
);
