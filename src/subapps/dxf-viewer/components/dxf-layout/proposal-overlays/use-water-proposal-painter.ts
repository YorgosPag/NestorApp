/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-554 BEFORE EDITING
 *
 * Water-supply (cold/hot) auto-design proposal painter (ADR-426 Slice 2 → ADR-554 dispatch).
 * Leaf hook: subscribes to the low-freq `useWaterProposal()` store and returns a memoized painter
 * (paint code verbatim from the former `WaterProposalGhostPreviewMount`). `null` while idle.
 */

import { useMemo } from 'react';
import type { OverlayDispatchPainter } from '../overlay-dispatch/overlay-dispatch-frame';
import { paintGhostSegments, type GhostSegmentDraw } from '../proposal-ghost-paint';
import { useWaterProposal } from '../../../systems/mep-design/water/water-proposal-store';
import { mmToSceneUnits } from '../../../utils/scene-units';
// 🏢 ADR-571: MEP water/plumbing cyan SSoT + hexToRgba SSoT (color-math.ts)
import { MEP_WATER_COLOR, MEP_WATER_GHOST_FILL } from '../../../config/color-config';
import { hexToRgba } from '../../../config/color-math';

// ─── Per-service ghost palette (proposed runs) ─────────────────────────────────
const COLD_STROKE = MEP_WATER_COLOR;
const COLD_FILL = hexToRgba(MEP_WATER_GHOST_FILL, 0.22);
const HOT_STROKE = '#dc2626';
const HOT_FILL = 'rgba(248, 113, 113, 0.22)';

export function useWaterProposalPainter(): OverlayDispatchPainter | null {
  const review = useWaterProposal();
  return useMemo<OverlayDispatchPainter | null>(() => {
    if (!review) return null;
    return (ctx, t, vp) => {
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
    };
  }, [review]);
}
