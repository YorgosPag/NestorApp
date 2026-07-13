'use client';
/**
 * ADR-649 — «Ετικέτα Εμβαδού Γραμμοσκίασης»: lifecycle hook (thin).
 *
 * ΔΕΝ χειρίζεται κλικ (αυτό το κάνει το `handleHatchAreaLabelClick` πάνω στο store —
 * ADR-040 event-time read, χωρίς React snapshot). Ο hook κάνει ΜΟΝΟ lifecycle:
 * σε activate/deactivate επαναφέρει την FSM (`resetHatchAreaLabel`, ώστε καμία stale
 * φάση να μη μεταφέρεται μεταξύ ενεργοποιήσεων) και ρυθμίζει το status-prompt.
 *
 * @see ../../bim/hatch/hatch-area-label-store — FSM SSoT
 * @see ../canvas/canvas-click-tool-handlers — handleHatchAreaLabelClick
 */
import { useCallback } from 'react';
import { i18n } from '@/i18n';
import { useToolLifecycle } from '../tools/useToolLifecycle';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { resetHatchAreaLabel } from '../../bim/hatch/hatch-area-label-store';

const NS = 'dxf-viewer-shell';

export function useHatchAreaLabelTool(isActive: boolean): void {
  const activate = useCallback(() => {
    resetHatchAreaLabel();
    toolHintOverrideStore.setOverride(i18n.t('hatchAreaLabel.status.awaitingHatch', { ns: NS }));
  }, []);

  const deactivate = useCallback(() => {
    resetHatchAreaLabel();
    toolHintOverrideStore.setOverride(null);
  }, []);

  useToolLifecycle(isActive, activate, deactivate);
}
