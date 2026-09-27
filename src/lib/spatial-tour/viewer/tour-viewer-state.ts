/**
 * @fileoverview **ΠΟΥ ΕΙΝΑΙ Ο ΕΠΙΣΚΕΠΤΗΣ, ΚΑΙ ΠΟΥ ΠΗΓΑΙΝΕΙ** — η κατάσταση πλοήγησης του θεατή (ADR-884 Φ1 · §4.8). Καθαρό.
 * @related `tour-viewer-graph.ts` (ο όροφος **παράγεται** από τον κόμβο — δεν αποθηκεύεται δεύτερη φορά)
 * @module lib/spatial-tour/viewer/tour-viewer-state
 *
 * 🔑 **Καμία κούρσα**: όσο τρέχει μια μετάβαση, νέο αίτημα **δεν** τη διακόπτει (δύο πανοράματα που σβήνουν ταυτόχρονα =
 * σπασμένη εικόνα)· μπαίνει στην **ουρά μίας θέσης** — το τελευταίο κερδίζει, όπως στο Gmail το τελευταίο κλικ.
 * 🔑 **Ιδεμπότητο**: «πήγαινε εκεί που είσαι» ή «εκεί που ήδη πηγαίνεις» δεν αλλάζει τίποτα (ίδιο αντικείμενο κατάστασης ⇒
 * καμία επανασχεδίαση).
 */

export interface TourViewerState {
  /** Ο κόμβος που βλέπει ο επισκέπτης — `null` μόνο σε περιήγηση χωρίς στάσεις. */
  readonly nodeId: string | null;
  /** Ο προορισμός της μετάβασης που τρέχει. */
  readonly targetNodeId: string | null;
  /** Το επόμενο αίτημα, όσο τρέχει μετάβαση (ουρά μίας θέσης). */
  readonly queuedNodeId: string | null;
}

export type TourViewerAction =
  | { readonly kind: 'go'; readonly nodeId: string }
  | { readonly kind: 'arrived' }
  /** Η μετάβαση δεν ολοκληρώθηκε (το πανόραμα δεν φορτώθηκε): ο επισκέπτης **μένει** εκεί που ήταν. */
  | { readonly kind: 'abandoned' };

export function initialViewerState(nodeId: string | null): TourViewerState {
  return { nodeId, targetNodeId: null, queuedNodeId: null };
}

function go(state: TourViewerState, nodeId: string): TourViewerState {
  if (state.targetNodeId === null) {
    return nodeId === state.nodeId ? state : { ...state, targetNodeId: nodeId };
  }
  if (nodeId === state.targetNodeId) return state.queuedNodeId === null ? state : { ...state, queuedNodeId: null };
  return state.queuedNodeId === nodeId ? state : { ...state, queuedNodeId: nodeId };
}

function arrived(state: TourViewerState): TourViewerState {
  if (state.targetNodeId === null) return state;
  const nodeId = state.targetNodeId;
  const next = state.queuedNodeId === nodeId ? null : state.queuedNodeId;
  return { nodeId, targetNodeId: next, queuedNodeId: null };
}

function abandoned(state: TourViewerState): TourViewerState {
  if (state.targetNodeId === null) return state;
  const next = state.queuedNodeId === state.nodeId ? null : state.queuedNodeId;
  return { nodeId: state.nodeId, targetNodeId: next, queuedNodeId: null };
}

export function tourViewerReducer(state: TourViewerState, action: TourViewerAction): TourViewerState {
  switch (action.kind) {
    case 'go': return go(state, action.nodeId);
    case 'arrived': return arrived(state);
    case 'abandoned': return abandoned(state);
  }
}
