"use client";

/**
 * ADR-688 / ADR-371 — δημόσια επιφάνεια του 3D viewport.
 *
 * Το σώμα ζει στο `BimViewport3DInner` (N.7.1: το αρχείο ήταν στις 499/500 γραμμές).
 * Εδώ μένει ΜΟΝΟ η εγγύηση εξάρτησης: το viewport καλεί άνευ όρων
 * `useUniversalSelectionStable` (μέσω `useBim3DEditInteraction` + `useBim3DEntityClipboard`),
 * άρα ΑΠΑΙΤΕΙ `SelectionContext`. Ο μόνος `<SelectionSystem>` του δέντρου ζει στο
 * `DxfViewerApp`, οπότε κάθε άλλο mount site έριχνε τη σελίδα:
 *   - `Bim3DReadOnlyOverlay` (Properties → `?view=floorplan`)
 *   - `Bim3DHarness` (`/test-harness/bim-3d`)
 *
 * Το `SelectionBoundary` παρέχει τον provider ΜΟΝΟ αν λείπει — μέσα στο `/dxf/viewer`
 * κρατά τον υπάρχοντα αυτούσιο (ο `SelectedEntitiesStore` έχει ΕΝΑΝ legacy sink·
 * φωλιασμένος δεύτερος provider θα τον άρπαζε). Η εξάρτηση εγγυάται πλέον από το
 * ΙΔΙΟ το component, όχι από κάθε καλούντα.
 */

import { SelectionBoundary } from '../../systems/selection/SelectionBoundary';
import { BimViewport3DInner, type BimViewport3DProps } from './BimViewport3DInner';

export type { BimViewport3DProps };

export function BimViewport3D(props: BimViewport3DProps = {}) {
  return (
    <SelectionBoundary>
      <BimViewport3DInner {...props} />
    </SelectionBoundary>
  );
}
