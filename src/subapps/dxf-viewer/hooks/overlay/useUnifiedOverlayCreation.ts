/**
 * Unified Overlay Creation Hook
 * Χρησιμοποιεί το DXF polyline tool για τη δημιουργία overlay polygon,
 * ώστε η εμπειρία να είναι 1:1 με τα DXF tools (rubber-band, snaps, dynamic input).
 */
import { useCallback } from 'react';
import { isFeatureEnabled } from '../../config/experimental-features';
import { toolStyleStore } from '../../stores/ToolStyleStore';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useUnifiedDrawing } from '../drawing/useUnifiedDrawing';
import type { Status, OverlayKind } from '../../overlays/types';
// DISABLED: Legacy Grips import - using Unified Grips System instead
// import { Grips } from '../../grips/Grips';

type StartOpts = {
  status?: Status;
  kind?: OverlayKind;
  onComplete?: (overlayId: string) => void;
  onCancel?: () => void;
};

export function useUnifiedOverlayCreation() {
  const { add } = useOverlayStore();
  const { startPolygon } = useUnifiedDrawing();

  const startOverlayCreation = useCallback(async (opts: StartOpts) => {

    if (!isFeatureEnabled('USE_UNIFIED_DRAWING_ENGINE')) {
      console.warn('[useUnifiedOverlayCreation] USE_UNIFIED_DRAWING_ENGINE is disabled - skipping overlay creation');
      return;
    }

    const polylineControl = startPolygon({
      isOverlay: true, // 🔺 ΚΛΕΙΔΙ: Σημαία για overlay styling
      onComplete: async (points) => {

        const style = toolStyleStore.get();

        // 🔺 ΝΕΑ ΛΟΓΙΚΗ: Χρήση επιλεγμένου status και kind από το OverlayToolbar
        const overlayId = await add({
          levelId: '', // will be set by overlay store based on currentLevelId
          kind: opts.kind || 'unit', // Χρήση επιλεγμένου kind ή default
          polygon: points.map(p => [p.x, p.y] as [number, number]),
          status: opts.status || 'for-sale', // Χρήση επιλεγμένου status ή default
          style: {
            stroke: style.strokeColor,
            fill: style.fillColor,
            lineWidth: style.lineWidth,
            opacity: style.opacity,
          }
        });
        // Συνδέουμε ΤΟ ΙΔΙΟ grips system μετά το commit
        // DISABLED: Legacy Grips - using Unified Grips System instead
        // Grips.attachTo(overlayId, 'overlay');
        opts.onComplete?.(overlayId);
      },
      onCancel: () => {
        opts.onCancel?.();
      }
    });

    // 🔺 ΔΙΟΡΘΩΣΗ: Επιστροφή του stop callback για double-click handling
    return polylineControl;
  }, [add, startPolygon]);

  return { startOverlayCreation, isUsingUnifiedEngine: isFeatureEnabled('USE_UNIFIED_DRAWING_ENGINE') };
}
