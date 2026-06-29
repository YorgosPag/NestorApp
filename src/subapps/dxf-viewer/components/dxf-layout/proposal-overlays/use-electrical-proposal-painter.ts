/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-554 BEFORE EDITING
 *
 * Electrical-strong (+weak) auto-design proposal painter (ADR-430 Slice 2 → ADR-554 dispatch).
 * Strokes the proposed circuits' home-run wires via the shared `drawCircuitWires` (colour-by-system
 * ON: lighting amber, power blue). Paint verbatim from the former mount. `null` idle.
 */

import { useMemo } from 'react';
import type { OverlayDispatchPainter } from '../overlay-dispatch/overlay-dispatch-frame';
import { useElectricalProposal } from '../../../systems/mep-design/electrical/electrical-proposal-store';
import { drawCircuitWires } from '../../../bim/renderers/MepWireRenderer';

export function useElectricalProposalPainter(): OverlayDispatchPainter | null {
  const review = useElectricalProposal();
  return useMemo<OverlayDispatchPainter | null>(() => {
    if (!review) return null;
    return (ctx, t, vp) => {
      if (review.wirePaths.length === 0) return;
      drawCircuitWires(ctx, review.wirePaths, t, vp, null, true);
    };
  }, [review]);
}
