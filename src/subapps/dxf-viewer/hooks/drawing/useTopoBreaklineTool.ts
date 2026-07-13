'use client';
/**
 * ADR-650 — lifecycle hooks των **pick-εργαλείων του τοπογραφικού** (thin).
 *
 * ΔΕΝ χειρίζονται κλικ (αυτό το κάνουν τα `handleTopoBreaklineClick` / `handleTopoBoundaryClick`
 * πάνω στο vanilla `TopoPointStore` — ADR-040 event-time read, χωρίς React snapshot). Κάνουν
 * ΜΟΝΟ lifecycle: status-prompt σε activate, καθαρισμός hover-highlight + prompt σε deactivate.
 *
 * Τα picked δεδομένα (breaklines M2-Β, όριο M6) **επιβιώνουν** της απενεργοποίησης — είναι
 * δεδομένα της αποτύπωσης, όχι φάση εργαλείου· γι' αυτό, σε αντίθεση με το
 * `useHatchAreaLabelTool`, δεν υπάρχει FSM reset εδώ.
 *
 * Τα δύο εργαλεία μοιράζονται ΕΝΑΝ πυρήνα (`useTopoPickTool`) — δύο πανομοιότυποι hooks με
 * διαφορετικό i18n key θα ήταν ακριβώς το sibling-clone που απαγορεύει ο N.18.
 *
 * @see ../canvas/canvas-click-tool-handlers — handleTopoBreaklineClick
 * @see ../canvas/canvas-click-topo-boundary — handleTopoBoundaryClick
 * @see ../../systems/topography/TopoPointStore — constraints + boundary SSoT
 */
import { useCallback } from 'react';
import { i18n } from '@/i18n';
import { useToolLifecycle } from '../tools/useToolLifecycle';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { setHoveredEntity } from '../../systems/hover/HoverStore';

const NS = 'dxf-viewer-shell';

/** Ο κοινός πυρήνας: prompt σε activate, καθάρισμα hover + prompt σε deactivate. */
function useTopoPickTool(isActive: boolean, idleHintKey: string): void {
  const activate = useCallback(() => {
    toolHintOverrideStore.setOverride(i18n.t(idleHintKey, { ns: NS }));
  }, [idleHintKey]);

  const deactivate = useCallback(() => {
    setHoveredEntity(null); // καθάρισε το hover-highlight όταν φεύγει το εργαλείο
    toolHintOverrideStore.setOverride(null);
  }, []);

  useToolLifecycle(isActive, activate, deactivate);
}

/** ADR-650 M2-Β — «Γραμμές ασυνέχειας» (breakline picking). */
export function useTopoBreaklineTool(isActive: boolean): void {
  useTopoPickTool(isActive, 'topoBreakline.status.awaitingEntity');
}

/** ADR-650 M6 (Γ) — «Όριο οικοπέδου» (volume boundary picking). */
export function useTopoBoundaryTool(isActive: boolean): void {
  useTopoPickTool(isActive, 'topoBoundary.status.awaitingEntity');
}
