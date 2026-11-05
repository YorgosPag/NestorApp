'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 + ADR-732 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md
 *
 * useFloorplanBackgroundPainter — η raster κάτοψη ως pass του κοινού καμβά ζώνης Α.
 *
 * ADR-732 Batch 2 — δεν κατέχει `<canvas>`: επιστρέφει «painter ή null» (ADR-726 Φ2)
 * για τον `UnderlayDispatchCanvas`, ΠΑΝΩ από το grid pass (Giorgio 2026-06-05: ο κάναβος
 * ΚΑΤΩ από την κάτοψη).
 *
 * ADR-929 Φ5.2 — η ζώνη Α είναι πλέον **καθαρά ζωγραφική**. Η βαθμονόμηση ήταν η μόνη της διάδραση
 * (`onClick` στον καμβά z=0), αλλά ο `dxf-canvas` (z-10) από πάνω έπαιρνε κάθε κλικ ⇒ τα σημεία δεν
 * καταγράφονταν ποτέ. Το κλικ περνά πια από τον κεντρικό αγωγό (`hooks/canvas/canvas-click-calibration.ts`)
 * και τα σημάδια από δικό τους SVG leaf (`components/dxf-layout/CalibrationPickOverlay.tsx`).
 *
 * Ο μετασχηματισμός view διαβάζεται `getImmediateTransform()` στο draw time
 * (ADR-040 XXII.B) — ο painter αγνοεί το `t` όρισμα του primitive (η κάτοψη κουβαλά τον
 * δικό της BackgroundTransform μέσα στο `worldToCanvas`).
 */

import { useMemo } from 'react';
import type { OverlayDispatchPainter } from '../../components/dxf-layout/overlay-dispatch/overlay-dispatch-frame';
import { useFloorplanBackground } from '../hooks/useFloorplanBackground';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type { CadCoordinateAdaptation } from '../providers/types';

/**
 * «Painter ή null» για τον κοινό καμβά ζώνης Α.
 *
 * @param floorId null ⇒ κανένας ενεργός όροφος ⇒ painter null (η ζώνη δεν πληρώνει τίποτα).
 * @param cad Optional CAD adaptation (Y-flip + margins). Required for DXF integration.
 *   Πέρνα σταθερή αναφορά (module const / useMemo) — είναι dep του painter memo.
 */
export function useFloorplanBackgroundPainter(
  floorId: string | null,
  cad?: CadCoordinateAdaptation,
): OverlayDispatchPainter | null {
  // '' = ανύπαρκτο slot ⇒ background null (rules-of-hooks: η κλήση είναι άνευ όρων).
  const { background, provider } = useFloorplanBackground(floorId ?? '');

  // Reference-stable painter: νέα ταυτότητα ΜΟΝΟ σε πραγματική αλλαγή περιεχομένου.
  // ADR-726 Φ2 — χωρίς ορατή κάτοψη: null (ο καμβάς άθικτος).
  return useMemo<OverlayDispatchPainter | null>(() => {
    if (floorId == null || !background?.visible || !provider) return null;
    // `const` bindings ⇒ το narrowing επιβιώνει μέσα στο closure του painter (χωρίς `!`, N.2).
    const visibleBackground = background;
    const activeProvider = provider;
    return (ctx, _t, vp) => {
      activeProvider.render(ctx, {
        transform: visibleBackground.transform,
        // Zero-lag view transform από το SSoT στο draw time (XXII.B).
        worldToCanvas: getImmediateTransform(),
        viewport: vp,
        opacity: visibleBackground.opacity,
        cad,
      });
    };
  }, [floorId, background, provider, cad]);
}
