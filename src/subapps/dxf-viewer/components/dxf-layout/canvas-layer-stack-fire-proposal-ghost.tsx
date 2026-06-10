'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * FireProposalGhostPreviewMount (ADR-433 Slice 2) — fire-protection (sprinkler) auto-design
 * proposal ghost. Thin discipline mount: subscribes to `useFireProposal()` and hands the SSoT
 * `ProposalGhostOverlay` a `paint` closure that strokes every proposed wet-pipe run (domain
 * `pipe`) with the SSoT classification colour (`fire-sprinkler` → fire-red).
 */

import React, { useCallback } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { ProposalGhostOverlay, type ProposalGhostPaint } from './ProposalGhostOverlay';
import { paintGhostSegments, type GhostSegmentDraw } from './proposal-ghost-paint';
import { useFireProposal } from '../../systems/mep-design/fire/fire-proposal-store';
import { resolveSegmentClassificationColor } from '../../bim/mep-systems/mep-system-color';
import { mmToSceneUnits } from '../../utils/scene-units';

export interface FireProposalGhostPreviewMountProps {
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export const FireProposalGhostPreviewMount = React.memo(
  function FireProposalGhostPreviewMount({
    transform,
    viewport,
  }: FireProposalGhostPreviewMountProps) {
    const review = useFireProposal();
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
        paintGhostSegments(ctx, segs, t, vp, mmScale, 'pipe');
      },
      [review],
    );
    return (
      <ProposalGhostOverlay
        active={review !== null}
        transform={transform}
        viewport={viewport}
        paint={paint}
        dataOverlay="fire-proposal"
      />
    );
  },
);
