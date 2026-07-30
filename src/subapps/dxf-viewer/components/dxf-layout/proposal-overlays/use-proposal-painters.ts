'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 + ADR-554 + ADR-732 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-554-proposal-dispatch-canvas.md
 * docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md
 *
 * ADR-732 Batch 1 — οι 7 MEP proposal painters ως ΕΝΑ hook.
 *
 * Ο πρώην `ProposalDispatchCanvas` (ADR-554, 7→1) κατείχε δικό του `<canvas>` (z14). Με το
 * ADR-732 ο καμβάς της ζώνης Β είναι ΕΝΑΣ (`Overlay2DDispatchCanvas`)· τα proposals είναι το
 * ΤΕΛΕΥΤΑΙΟ (topmost) pass της ζώνης — διατηρούν τη σημερινή θέση τους πάνω από analytical/
 * envelope/mep-wires και ΚΑΤΩ από το PreviewCanvas (z15). Κάθε painter hook self-subscribes +
 * self-gates στο δικό του low-freq proposal store (αμετάβλητο από ADR-554).
 */

import { useMemo } from 'react';
import type { OverlayDispatchPainter } from '../overlay-dispatch/overlay-dispatch-frame';
import { useWaterProposalPainter } from './use-water-proposal-painter';
import { useDrainageProposalPainter } from './use-drainage-proposal-painter';
import { useHeatingProposalPainter } from './use-heating-proposal-painter';
import { useElectricalProposalPainter } from './use-electrical-proposal-painter';
import { useHvacProposalPainter } from './use-hvac-proposal-painter';
import { useFireProposalPainter } from './use-fire-proposal-painter';
import { useGasProposalPainter } from './use-gas-proposal-painter';

/**
 * z-order (ίδιο με την πρώην σειρά mount — ADR-554): water → drainage → heating → electrical →
 * hvac → fire → gas (topmost). Τα proposals είναι πρακτικά αμοιβαία αποκλειόμενα· αν ποτέ
 * συνυπάρξουν δύο, οι μεταγενέστεροι painters ζωγραφίζουν από πάνω — ίδιο με το παλιό stacking.
 * Reference-stable array: νέα ταυτότητα ΜΟΝΟ όταν αλλάξει κάποιος painter.
 */
export function useProposalPainters(): ReadonlyArray<OverlayDispatchPainter | null> {
  const water = useWaterProposalPainter();
  const drainage = useDrainageProposalPainter();
  const heating = useHeatingProposalPainter();
  const electrical = useElectricalProposalPainter();
  const hvac = useHvacProposalPainter();
  const fire = useFireProposalPainter();
  const gas = useGasProposalPainter();

  return useMemo(
    () => [water, drainage, heating, electrical, hvac, fire, gas],
    [water, drainage, heating, electrical, hvac, fire, gas],
  );
}
