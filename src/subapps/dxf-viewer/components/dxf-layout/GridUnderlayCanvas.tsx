/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 + ADR-732 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md
 *
 * useGridUnderlayPainter — the adaptive grid as the BOTTOM-MOST pass of the underlay zone.
 *
 * Why bottom-most: the visible κάτοψη (floorplan background) must sit ON TOP of the grid
 * (Giorgio 2026-06-05 — see ADR-040 changelog). Πριν το ADR-732 αυτό απαιτούσε ΞΕΧΩΡΙΣΤΟ
 * canvas mounted πριν το floorplan canvas· τώρα είναι απλώς το ΠΡΩΤΟ pass του κοινού
 * καμβά ζώνης Α (`UnderlayDispatchCanvas`) — ίδια σειρά, ένα στρώμα λιγότερο.
 *
 * ADR-732 Batch 2 — δεν κατέχει `<canvas>`: επιστρέφει «painter ή null» (ADR-726 Φ2)·
 * με τον κάναβο σβηστό ο κοινός καμβάς δεν πληρώνει τίποτα γι' αυτό το pass.
 */

'use client';

import { useMemo, useRef } from 'react';
import { GridRenderer } from '../../rendering/ui/grid/GridRenderer';
import type { OverlayDispatchPainter } from './overlay-dispatch/overlay-dispatch-frame';
import type { GridSettings as GridRendererSettings } from '../../rendering/ui/grid/GridTypes';
// Same GridSettings type the rest of the canvas stack passes around (layer-types).
// The runtime object carries the full GridTypes shape (built by useCanvasSettings),
// hence the cast to GridRendererSettings at the renderDirect boundary — mirrors DxfCanvas.
import type { GridSettings } from '../../canvas-v2';

/**
 * «Painter ή null» για τον κοινό καμβά της ζώνης Α. Το transform έρχεται ανά καρέ από το
 * primitive (zero-lag, ADR-040 XXII.B) — ο painter δεν κρατά δικό του snapshot.
 */
export function useGridUnderlayPainter(gridSettings: GridSettings): OverlayDispatchPainter | null {
  // One GridRenderer instance for this hook's lifetime (lazy init).
  const rendererRef = useRef<GridRenderer | null>(null);
  if (!rendererRef.current) rendererRef.current = new GridRenderer();

  // Reference-stable painter: νέα ταυτότητα ΜΟΝΟ σε αλλαγή settings — το content-change
  // effect του κοινού καμβά repaint-άρει πάνω σε αυτή την ταυτότητα.
  return useMemo<OverlayDispatchPainter | null>(
    () =>
      gridSettings.enabled
        ? (ctx, t, pvp) => {
            rendererRef.current?.renderDirect(
              ctx,
              pvp,
              gridSettings as unknown as GridRendererSettings,
              { scale: t.scale, offsetX: t.offsetX, offsetY: t.offsetY },
            );
          }
        : null,
    [gridSettings],
  );
}
