'use client';

/**
 * usePreviewSurface — η ζωντανή επιφάνεια κάτω από τις ζώνες προεπισκόπησης (ADR-911 §Φ3β-palette).
 *
 * Συνδρομή ΜΟΝΟ στο χαμηλόσυχνο store υποβάθρου (ορατότητα · διαφάνεια του ενεργού ορόφου), με selector που επιστρέφει
 * **αριθμό** (ποτέ νέο αντικείμενο ⇒ κανένας βρόχος). Το χρώμα του καμβά διαβάζεται τη στιγμή του render από το SSoT
 * `liveDrawingSurfaceHex` (ADR-509). Τη χρησιμοποιούν ΜΟΝΟ φύλλα (ADR-040): οι επικαλύψεις και το δείγμα τόνου του πάνελ.
 *
 * @see ./preview-surface.ts — η καθαρή απόφαση
 */

import { useMemo } from 'react';
import { liveDrawingSurfaceHex } from '../../config/adaptive-entity-color';
import { useFloorplanBackgroundStore } from '../../floorplan-background/stores/floorplanBackgroundStore';
import { choosePreviewSurface, effectivePreviewSurfaceHex } from './preview-surface';
import type { PreviewSurface } from './preview-zone-style';

/** Διαφάνεια του ορατού υποβάθρου του ενεργού ορόφου· `0` όταν δεν υπάρχει ή είναι κρυμμένο. */
function useActiveUnderlayOpacity(): number {
  return useFloorplanBackgroundStore((s) => {
    const background = s.activeFloorId ? s.floors[s.activeFloorId]?.background ?? null : null;
    return background !== null && background.visible ? background.opacity : 0;
  });
}

export function usePreviewSurface(): PreviewSurface {
  const opacity = useActiveUnderlayOpacity();
  const canvasHex = liveDrawingSurfaceHex();
  return useMemo(
    () => choosePreviewSurface(effectivePreviewSurfaceHex(canvasHex, opacity > 0 ? { opacity } : null)),
    [canvasHex, opacity],
  );
}
