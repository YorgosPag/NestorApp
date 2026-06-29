/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-554 BEFORE EDITING
 *
 * Fire-protection (sprinkler) auto-design proposal painter (ADR-433 Slice 2 → ADR-554 dispatch).
 * Strokes every proposed wet-pipe run (domain `pipe`) with the SSoT classification colour
 * (`fire-sprinkler` → fire-red). Paint verbatim from the former mount. `null` idle.
 */

import { useMemo } from 'react';
import type { OverlayDispatchPainter } from '../overlay-dispatch/overlay-dispatch-frame';
import { paintGhostSegments, type GhostSegmentDraw } from '../proposal-ghost-paint';
import { useFireProposal } from '../../../systems/mep-design/fire/fire-proposal-store';
import { resolveSegmentClassificationColor } from '../../../bim/mep-systems/mep-system-color';
import { mmToSceneUnits } from '../../../utils/scene-units';

export function useFireProposalPainter(): OverlayDispatchPainter | null {
  const review = useFireProposal();
  return useMemo<OverlayDispatchPainter | null>(() => {
    if (!review) return null;
    return (ctx, t, vp) => {
      const mmScale = mmToSceneUnits(review.sceneUnits);
      const segs: GhostSegmentDraw[] = [];
      for (const network of review.proposal.networks) {
        const stroke = resolveSegmentClassificationColor(network.classification) ?? undefined;
        for (const seg of network.segments) {
          segs.push({ start: seg.start, end: seg.end, diameterMm: seg.diameterMm, stroke });
        }
      }
      paintGhostSegments(ctx, segs, t, vp, mmScale, 'pipe');
    };
  }, [review]);
}
