/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-554 BEFORE EDITING
 *
 * Gas (φυσικό αέριο) auto-design proposal painter (ADR-434 Slice 2 → ADR-554 dispatch). Strokes
 * every proposed fuel-gas run (domain `fuel`) with the SSoT classification colour (`fuel-gas` →
 * yellow) + translucent fill. Paint verbatim from the former mount. `null` idle.
 */

import { useMemo } from 'react';
import type { OverlayDispatchPainter } from '../overlay-dispatch/overlay-dispatch-frame';
import { paintGhostSegments, type GhostSegmentDraw } from '../proposal-ghost-paint';
import { useGasProposal } from '../../../systems/mep-design/gas/gas-proposal-store';
import { resolveSegmentClassificationColor, hexToRgba } from '../../../bim/mep-systems/mep-system-color';
import { mmToSceneUnits } from '../../../utils/scene-units';

/** Translucent fill alpha for the proposal ghost outline (matches the segment ghost). */
const GAS_GHOST_FILL_ALPHA = 0.25;

export function useGasProposalPainter(): OverlayDispatchPainter | null {
  const review = useGasProposal();
  return useMemo<OverlayDispatchPainter | null>(() => {
    if (!review) return null;
    return (ctx, t, vp) => {
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
    };
  }, [review]);
}
