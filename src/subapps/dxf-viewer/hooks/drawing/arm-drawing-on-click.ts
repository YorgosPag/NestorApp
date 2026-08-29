/**
 * @module arm-drawing-on-click
 *
 * # ADR-032 §1 — ΤΟ ΔΙΧΤΥ ΑΣΦΑΛΕΙΑΣ ΤΗΣ ΣΤΙΓΜΗΣ ΤΟΥ ΚΛΙΚ (N.7.2 #4)
 *
 * Ο πρωτεύων δρόμος (`useDrawingMachineArming`) οπλίζει στο **commit του React**. Αυτό
 * εδώ ρωτά **τη στιγμή που πέφτει το δάχτυλο** — δηλαδή είναι δομικά ανεπηρέαστο από
 * σειρά render, παραλειπόμενα re-renders και μπαγιάτικα snapshots. Είναι ο **ΙΔΙΟΣ**
 * κανόνας που το ADR-040 #2 επιβάλλει ήδη στον καμβά (*«event-time reads via getter,
 * όχι snapshot»*): το `canAddPoint` που φρουρεί το `addPoint` **είναι** snapshot
 * render-time.
 *
 * ⚠️ **Ίδιος κριτής με τον δεσμό** — {@link resolveDrawingArming}. Ιδempotent: όταν οι
 * δύο αλήθειες συμφωνούν δεν αγγίζει τίποτα, άρα **δεν τρώει** τα σημεία πολυγραμμής
 * στο 2ο+ κλικ. Δεύτερος κριτής εδώ = δεύτερη αυθεντία, δηλαδή το ίδιο bug ξανά.
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΖΕΙ ΜΕΣΑ ΣΤΟ `drawing-tool-arming.ts`**: εκείνο είναι **καθαρό**
 * επίτηδες — καμία React, κανένα store, κανένα singleton, ώστε η άγκυρα να το
 * **εκτελεί**. Εδώ ζει η **ανάγνωση της αυθεντίας** (`toolStateStore`), δηλαδή ακριβώς
 * το κομμάτι που δεν επιτρέπεται να μπει εκεί.
 *
 * @see systems/tools/drawing-tool-arming — ο κριτής
 * @see hooks/drawing/useDrawingMachineArming — ο πρωτεύων δρόμος
 */

import { resolveDrawingArming } from '../../systems/tools/drawing-tool-arming';
import { toolStateStore } from '../../stores/ToolStateStore';
import type { DrawingTool } from './drawing-types';

export interface ArmDrawingOnClickParams {
  /** Τι νομίζει η μηχανή τώρα (`drawingState.currentTool`). */
  readonly machineTool: string;
  /** Μπορεί η μηχανή να δεχτεί κλικ τώρα (`drawingState.isDrawing`). */
  readonly machineAcceptsPoints: boolean;
  /** Οπλίζει τη μηχανή (`useUnifiedDrawing.startDrawing`). */
  readonly startDrawing: (tool: DrawingTool) => void;
}

/**
 * Οπλίζει τη μηχανή **αν χρειάζεται**, τη στιγμή του κλικ — και σιωπά αν δεν χρειάζεται.
 *
 * ⚠️ Το `activeTool` **δεν** περνά ως παράμετρος: η αυθεντία διαβάζεται **εδώ, τώρα**.
 * Μια τιμή που ταξίδεψε ως όρισμα είναι ξανά snapshot — δηλαδή ακριβώς αυτό που το
 * δίχτυ υπάρχει για να μη συμβεί.
 */
export function armDrawingOnClick({
  machineTool,
  machineAcceptsPoints,
  startDrawing,
}: ArmDrawingOnClickParams): void {
  const declaredTool = toolStateStore.get().activeTool;
  if (resolveDrawingArming(declaredTool, machineTool, machineAcceptsPoints) === 'arm') {
    startDrawing(declaredTool as DrawingTool);
  }
}
