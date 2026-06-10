'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * HeatingProposalGhostPreviewMount (ADR-428 Slice 2) — heating (hydronic) auto-design proposal
 * ghost. Thin discipline mount: subscribes to `useHeatingProposal()` and hands the SSoT
 * `ProposalGhostOverlay` a `paint` closure. Heating is a TWO-pipe loop, so the colour is
 * resolved PER SEGMENT from the SSoT (`hydronic-supply` → red, `hydronic-return` → blue) +
 * its translucent `hexToRgba` fill, domain `pipe`.
 */

import React, { useCallback } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { ProposalGhostOverlay, type ProposalGhostPaint } from './ProposalGhostOverlay';
import { paintGhostSegments, type GhostSegmentDraw } from './proposal-ghost-paint';
import { useHeatingProposal } from '../../systems/mep-design/heating/heating-proposal-store';
import {
  resolveSegmentClassificationColor,
  hexToRgba,
} from '../../bim/mep-systems/mep-system-color';
import { mmToSceneUnits } from '../../utils/scene-units';

/** Neutral fallback if the SSoT ever returns null for the classification (defensive). */
const NEUTRAL_STROKE = '#6b7280';
const GHOST_FILL_ALPHA = 0.22;

export interface HeatingProposalGhostPreviewMountProps {
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export const HeatingProposalGhostPreviewMount = React.memo(
  function HeatingProposalGhostPreviewMount({
    transform,
    viewport,
  }: HeatingProposalGhostPreviewMountProps) {
    const review = useHeatingProposal();
    const paint = useCallback<ProposalGhostPaint>(
      (ctx, t, vp) => {
        if (!review) return;
        const mmScale = mmToSceneUnits(review.sceneUnits);
        const segs: GhostSegmentDraw[] = [];
        for (const network of review.proposal.networks) {
          for (const seg of network.segments) {
            const stroke = resolveSegmentClassificationColor(seg.classification) ?? NEUTRAL_STROKE;
            segs.push({
              start: seg.start,
              end: seg.end,
              diameterMm: seg.diameterMm,
              stroke,
              fill: hexToRgba(stroke, GHOST_FILL_ALPHA),
            });
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
        dataOverlay="heating-proposal"
      />
    );
  },
);
