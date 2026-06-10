'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * WaterProposalGhostPreviewMount (ADR-426 Slice 2) — water-supply (cold/hot) auto-design
 * proposal ghost. Thin discipline mount: subscribes to `useWaterProposal()` and hands the SSoT
 * `ProposalGhostOverlay` a `paint` closure that strokes every proposed pipe run with a
 * per-service palette (cold = teal, hot = warm-red), domain `pipe`.
 */

import React, { useCallback } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { ProposalGhostOverlay, type ProposalGhostPaint } from './ProposalGhostOverlay';
import { paintGhostSegments, type GhostSegmentDraw } from './proposal-ghost-paint';
import { useWaterProposal } from '../../systems/mep-design/water/water-proposal-store';
import { mmToSceneUnits } from '../../utils/scene-units';

// ─── Per-service ghost palette (proposed runs) ─────────────────────────────────
const COLD_STROKE = '#0891b2';
const COLD_FILL = 'rgba(34, 211, 238, 0.22)';
const HOT_STROKE = '#dc2626';
const HOT_FILL = 'rgba(248, 113, 113, 0.22)';

export interface WaterProposalGhostPreviewMountProps {
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export const WaterProposalGhostPreviewMount = React.memo(
  function WaterProposalGhostPreviewMount({
    transform,
    viewport,
  }: WaterProposalGhostPreviewMountProps) {
    const review = useWaterProposal();
    const paint = useCallback<ProposalGhostPaint>(
      (ctx, t, vp) => {
        if (!review) return;
        const mmScale = mmToSceneUnits(review.sceneUnits);
        const segs: GhostSegmentDraw[] = [];
        for (const network of review.proposal.networks) {
          const isHot = network.service === 'hot';
          const stroke = isHot ? HOT_STROKE : COLD_STROKE;
          const fill = isHot ? HOT_FILL : COLD_FILL;
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
        dataOverlay="water-proposal"
      />
    );
  },
);
