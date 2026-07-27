'use client';
/**
 * ADR-649 / ADR-662 §12 — «Ετικέτα Εμβαδού»: lifecycle hook (thin).
 *
 * ΔΕΝ χειρίζεται κλικ (αυτό το κάνει το `handleAreaLabelClick` πάνω στο store —
 * ADR-040 event-time read, χωρίς React snapshot). Ο hook κάνει ΜΟΝΟ lifecycle:
 * σε activate/deactivate επαναφέρει την FSM (`resetAreaLabel`, ώστε καμία stale
 * φάση να μη μεταφέρεται μεταξύ ενεργοποιήσεων) και ρυθμίζει το status-prompt.
 *
 * @see ../../systems/measure/area-label-store — FSM SSoT
 * @see ../canvas/canvas-click-tool-handlers — handleAreaLabelClick
 */
import { useCallback } from 'react';
import { i18n } from '@/i18n';
import { useToolLifecycle } from '../tools/useToolLifecycle';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { resetAreaLabel } from '../../systems/measure/area-label-store';
import { setHoveredEntity } from '../../systems/hover/HoverStore';

const NS = 'dxf-viewer-shell';

export function useAreaLabelTool(isActive: boolean): void {
  const activate = useCallback(() => {
    resetAreaLabel();
    toolHintOverrideStore.setOverride(i18n.t('areaLabel.status.awaitingEntity', { ns: NS }));
  }, []);

  const deactivate = useCallback(() => {
    resetAreaLabel();
    setHoveredEntity(null); // καθάρισε το hover-highlight όταν φεύγει το εργαλείο
    toolHintOverrideStore.setOverride(null);
  }, []);

  useToolLifecycle(isActive, activate, deactivate);
}
