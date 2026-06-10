'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * DrainageProposalGhostPreviewMount (ADR-427 Slice 2) — sanitary-drainage auto-design proposal
 * ghost. Thin discipline mount: subscribes to `useDrainageProposal()` and hands the SSoT
 * `ProposalGhostOverlay` a `paint` closure. Drainage is a SINGLE classification, so the whole
 * network shares one SSoT colour (`sanitary-drainage` → brown) + its translucent `hexToRgba`
 * fill, domain `pipe`.
 */

import React, { useCallback } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { ProposalGhostOverlay, type ProposalGhostPaint } from './ProposalGhostOverlay';
import { paintGhostSegments, type GhostSegmentDraw } from './proposal-ghost-paint';
import { useDrainageProposal } from '../../systems/mep-design/drainage/drainage-proposal-store';
import { DRAINAGE_CLASSIFICATION } from '../../systems/mep-design/drainage/drainage-design-types';
import {
  resolveSegmentClassificationColor,
  hexToRgba,
} from '../../bim/mep-systems/mep-system-color';
import { mmToSceneUnits } from '../../utils/scene-units';

/** Neutral fallback if the SSoT ever returns null for the classification (defensive). */
const NEUTRAL_STROKE = '#6b7280';
const GHOST_FILL_ALPHA = 0.22;

export interface DrainageProposalGhostPreviewMountProps {
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export const DrainageProposalGhostPreviewMount = React.memo(
  function DrainageProposalGhostPreviewMount({
    transform,
    viewport,
  }: DrainageProposalGhostPreviewMountProps) {
    const review = useDrainageProposal();
    const paint = useCallback<ProposalGhostPaint>(
      (ctx, t, vp) => {
        if (!review) return;
        const mmScale = mmToSceneUnits(review.sceneUnits);
        const stroke = resolveSegmentClassificationColor(DRAINAGE_CLASSIFICATION) ?? NEUTRAL_STROKE;
        const fill = hexToRgba(stroke, GHOST_FILL_ALPHA);
        const segs: GhostSegmentDraw[] = [];
        for (const network of review.proposal.networks) {
          for (const seg of network.segments) {
            segs.push({ start: seg.start, end: seg.end, diameterMm: seg.diameterMm, stroke, fill });
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
        dataOverlay="drainage-proposal"
      />
    );
  },
);
