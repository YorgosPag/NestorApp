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
 * `useAreaLabelTool`, δεν υπάρχει FSM reset εδώ.
 *
 * Τα δύο εργαλεία μοιράζονται ΕΝΑΝ πυρήνα (`useTopoPickTool`) — δύο πανομοιότυποι hooks με
 * διαφορετικό i18n key θα ήταν ακριβώς το sibling-clone που απαγορεύει ο N.18.
 *
 * @see ../canvas/canvas-click-tool-handlers — handleTopoBreaklineClick
 * @see ../canvas/canvas-click-topo-boundary — handleTopoBoundaryClick
 * @see ../../systems/topography/TopoPointStore — constraints + boundary SSoT
 */
import { useEffect } from 'react';
import { i18n } from '@/i18n';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { setHoveredEntity } from '../../systems/hover/HoverStore';
import { startTopoBreaklineHintSync } from '../canvas/topo-breakline-hint';

const NS = 'dxf-viewer-shell';

/** Ξεκινά το prompt του εργαλείου· επιστρέφει ό,τι πρέπει να σταματήσει στην απενεργοποίηση. */
type StartHint = () => () => void;

/**
 * Ο κοινός πυρήνας: prompt όσο είναι ενεργό, καθάρισμα hover + prompt στην απενεργοποίηση.
 *
 * ADR-920 Β4.8 Γ — cleanup αντί για `useToolLifecycle`: καθαρίζει ΜΟΝΟ όποιος ήταν ενεργός. Το παλιό
 * `deactivate` έτρεχε και στο mount ως ανενεργό (`setOverride(null)`) και μπορούσε να σβήσει prompt ξένου
 * εργαλείου· επίσης η ζωντανή συνδρομή του hint χρειάζεται ζεύγος start/stop.
 */
function useTopoPickTool(isActive: boolean, startHint: StartHint): void {
  useEffect(() => {
    if (!isActive) return undefined;
    const stopHint = startHint();
    return () => {
      stopHint();
      setHoveredEntity(null); // καθάρισε το hover-highlight όταν φεύγει το εργαλείο
      toolHintOverrideStore.setOverride(null);
    };
  }, [isActive, startHint]);
}

const noop = (): void => undefined;

/** ADR-650 M6 — στατικό prompt του ορίου (το πλήθος δεν έχει νόημα: ένα όριο). */
const startBoundaryHint: StartHint = () => {
  toolHintOverrideStore.setOverride(i18n.t('topoBoundary.status.awaitingEntity', { ns: NS }));
  return noop;
};

/** ADR-650 M2-Β — «Γραμμές ασυνέχειας» (breakline picking)· prompt πάντα με το ζωντανό πλήθος. */
export function useTopoBreaklineTool(isActive: boolean): void {
  useTopoPickTool(isActive, startTopoBreaklineHintSync);
}

/** ADR-650 M6 (Γ) — «Όριο οικοπέδου» (volume boundary picking). */
export function useTopoBoundaryTool(isActive: boolean): void {
  useTopoPickTool(isActive, startBoundaryHint);
}
