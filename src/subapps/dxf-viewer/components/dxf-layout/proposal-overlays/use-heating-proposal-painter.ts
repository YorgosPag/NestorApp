/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-554 BEFORE EDITING
 *
 * Heating (hydronic) auto-design proposal painter (ADR-428 Slice 2 → ADR-554 dispatch). Two-pipe
 * loop → colour resolved PER SEGMENT from the SSoT (`hydronic-supply` → red, `hydronic-return` →
 * blue) + translucent fill, domain `pipe`. Paint verbatim from the former mount. `null` idle.
 */

import { useMemo } from 'react';
import type { OverlayDispatchPainter } from '../overlay-dispatch/overlay-dispatch-frame';
import { paintGhostSegments, type GhostSegmentDraw } from '../proposal-ghost-paint';
import { useHeatingProposal } from '../../../systems/mep-design/heating/heating-proposal-store';
import { resolveSegmentClassificationColor, hexToRgba } from '../../../bim/mep-systems/mep-system-color';
import { mmToSceneUnits } from '../../../utils/scene-units';

/** Neutral fallback if the SSoT ever returns null for the classification (defensive). */
const NEUTRAL_STROKE = '#6b7280';
const GHOST_FILL_ALPHA = 0.22;

export function useHeatingProposalPainter(): OverlayDispatchPainter | null {
  const review = useHeatingProposal();
  return useMemo<OverlayDispatchPainter | null>(() => {
    if (!review) return null;
    return (ctx, t, vp) => {
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
    };
  }, [review]);
}
