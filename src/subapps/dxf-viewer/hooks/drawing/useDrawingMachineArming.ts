'use client';

/**
 * @module useDrawingMachineArming
 *
 * # ADR-032 §1 — Ο ΕΝΑΣ δεσμός «δηλωμένο εργαλείο → οπλισμένη μηχανή»
 *
 * Ήταν ένα ανώνυμο `useEffect` βαθιά μέσα στο `useCanvasEffects` με εξάρτηση
 * **`[activeTool]`** — δηλαδή αντιδρούσε στην **αλλαγή τιμής**, ενώ ο αφοπλισμός
 * (`useToolbarState:44 → onCancel()`) γινόταν **χωρίς** αλλαγή τιμής. Δύο γεγονότα, μία
 * μόνο σκανδάλη: ό,τι δεν περνούσε από αλλαγή τιμής, δεν ξαναοπλιζόταν ποτέ.
 *
 * ## Τι άλλαξε δομικά
 * Ο δεσμός δεν παρακολουθεί πια **τη δήλωση**· παρακολουθεί **τη ΔΙΑΦΩΝΙΑ** ανάμεσα στη
 * δήλωση και στη μηχανή. Ο αφοπλισμός γυρίζει το `machineAcceptsPoints` σε `false` ⇒
 * **αυτό** είναι πλέον αλλαγή εξάρτησης ⇒ ο δεσμός ξανατρέχει και ξαναοπλίζει, **χωρίς
 * να χρειαστεί να αλλάξει το `activeTool`**. Γι' αυτό ακριβώς είναι τρεις οι εξαρτήσεις
 * και όχι μία.
 *
 * 🔴 **ΜΗΝ ξαναγυρίσεις την εξάρτηση σε `[activeTool]`.** Αυτή είναι η μετάλλαξη που
 * γέννησε το bug· την **εκτελεί** το `__tests__/useDrawingMachineArming.test.tsx`
 * (και κοκκινίζει).
 *
 * ⚠️ **ΜΗΝ βάλεις εδώ φρουρό.** Ο φρουρός ζει στο καθαρό
 * {@link resolveDrawingArming} — ένας κριτής, δύο καλούντες (αυτός ο δεσμός + το δίχτυ
 * ασφαλείας στο κλικ). Δεύτερος φρουρός εδώ = δεύτερη αυθεντία, δηλαδή το ίδιο bug ξανά.
 *
 * @see systems/tools/drawing-tool-arming — ο κριτής (καθαρός, εκτελέσιμος)
 * @see docs/centralized-systems/reference/adrs/ADR-032-drawing-state-machine.md §1
 */

import { useEffect } from 'react';
import { resolveDrawingArming } from '../../systems/tools/drawing-tool-arming';
import type { DrawingTool } from './drawing-types';

export interface UseDrawingMachineArmingParams {
  /** Η αυθεντία: τι εργαλείο δηλώνει η κορδέλα (`toolStateStore.activeTool`). */
  readonly declaredTool: string;
  /** Τι νομίζει η μηχανή (`drawingState.currentTool`). */
  readonly machineTool: string;
  /** Μπορεί η μηχανή να δεχτεί κλικ τώρα (`drawingState.isDrawing`). */
  readonly machineAcceptsPoints: boolean;
  /** Οπλίζει τη μηχανή (`drawingHandlers.startDrawing`). */
  readonly startDrawing: (tool: DrawingTool) => void;
}

/**
 * Κρατά τη μηχανή σχεδίασης οπλισμένη για ό,τι δηλώνει η αυθεντία.
 *
 * Ιδempotent εξ ορισμού: όσο οι δύο αλήθειες συμφωνούν, το σώμα δεν κάνει τίποτα — άρα
 * το μη-idempotent `startDrawing` (γράφει νέο `localState`) δεν μπορεί να γεννήσει βρόχο.
 */
export function useDrawingMachineArming({
  declaredTool,
  machineTool,
  machineAcceptsPoints,
  startDrawing,
}: UseDrawingMachineArmingParams): void {
  useEffect(() => {
    if (resolveDrawingArming(declaredTool, machineTool, machineAcceptsPoints) === 'arm') {
      startDrawing(declaredTool as DrawingTool);
    }
    // `startDrawing` εκτός εξαρτήσεων ΕΠΙΤΗΔΕΣ: είναι φρέσκο αντικείμενο σε κάθε render
    // (`useCallback` με ασταθείς deps) — στις εξαρτήσεις θα έκανε τον δεσμό να τρέχει σε
    // κάθε render. Ο φρουρός το κάνει ακίνδυνο· η ταυτότητα της συνάρτησης δεν είναι
    // πληροφορία που αλλάζει την απόφαση.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [declaredTool, machineTool, machineAcceptsPoints]);
}
