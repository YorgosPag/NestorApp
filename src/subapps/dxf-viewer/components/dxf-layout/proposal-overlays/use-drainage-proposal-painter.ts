/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-554 BEFORE EDITING
 *
 * Sanitary-drainage auto-design proposal painter (ADR-427 Slice 2 → ADR-554 dispatch). Drainage is
 * a SINGLE classification, so the whole network shares one SSoT colour (`sanitary-drainage` → brown)
 * + its translucent `hexToRgba` fill, domain `pipe`. Paint verbatim from the former mount. `null` idle.
 */

import { useMemo } from 'react';
import type { OverlayDispatchPainter } from '../overlay-dispatch/overlay-dispatch-frame';
import { paintGhostSegments, type GhostSegmentDraw } from '../proposal-ghost-paint';
import { useDrainageProposal } from '../../../systems/mep-design/drainage/drainage-proposal-store';
import { DRAINAGE_CLASSIFICATION } from '../../../systems/mep-design/drainage/drainage-design-types';
import { resolveSegmentClassificationColor, hexToRgba } from '../../../bim/mep-systems/mep-system-color';
import { mmToSceneUnits } from '../../../utils/scene-units';

/** Neutral fallback if the SSoT ever returns null for the classification (defensive). */
const NEUTRAL_STROKE = '#6b7280';
const GHOST_FILL_ALPHA = 0.22;

export function useDrainageProposalPainter(): OverlayDispatchPainter | null {
  const review = useDrainageProposal();
  return useMemo<OverlayDispatchPainter | null>(() => {
    if (!review) return null;
    return (ctx, t, vp) => {
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
    };
  }, [review]);
}
