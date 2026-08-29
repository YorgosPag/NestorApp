/**
 * @module drawing-tool-arming
 *
 * # ADR-032 §1 — Η ΜΙΑ ερώτηση: «είναι η μηχανή οπλισμένη για το εργαλείο που δηλώνει ο άνθρωπος;»
 *
 * ## Το περιστατικό που το γέννησε (2026-08-29)
 * «*Φαίνεται το φάντασμα του πίνακα, αλλά όταν κάνω κλικ δεν εμφανίζεται πίνακας.*»
 * Μετρημένο ζωντανά: `canAddPoint === false`, `toolType === null`, ενώ η κορδέλα έγραφε
 * `Εργαλείο: table` και το φάντασμα ακολουθούσε τον κέρσορα.
 *
 * ## Γιατί: ΔΥΟ γραφείς με ΑΝΤΙΘΕΤΗ πρόθεση, με σειρά που εξαρτιόταν από την τύχη
 * | ποιος | πότε | τι έκανε |
 * |---|---|---|
 * | `useToolbarState.handleToolChange` → `onCancel()` | **σύγχρονα, στο event** | **ΑΦΟΠΛΙΖΕΙ — πάντα** |
 * | `useCanvasEffects` effect `[activeTool]` | στο commit | **ΟΠΛΙΖΕΙ — μόνο αν άλλαξε η ΤΙΜΗ** |
 *
 * Αλλάζει η τιμή ⇒ αφοπλισμός + οπλισμός ⇒ δουλεύει. **Δεν** αλλάζει (ίδιο εργαλείο ξανά,
 * φόρτωση με το εργαλείο ήδη επιλεγμένο, μετά από `Escape`, μετά από ολοκλήρωση) ⇒
 * **αφοπλισμός ΧΩΡΙΣ οπλισμό** ⇒ νεκρό εργαλείο. Θανατηφόρο στα 1-κλικ (`table`,
 * `opening-info-tag`): ένα 2-κλικ εργαλείο δίνει σήμα ζωής στο πρώτο σημείο· ένα 1-κλικ
 * απλά δεν κάνει τίποτα.
 *
 * ## Η αρχή που παραβιαζόταν (από την έρευνα στους μεγάλους παίκτες)
 * Το tldraw κάνει **και αυτό** short-circuit στο «ήδη ενεργό» (`if (prevChildState?.id !==
 * nextChildState.id)`) — και είναι **ασφαλές**, γιατί εκεί το `getCurrentToolId()` είναι
 * **παράγωγο** του ίδιου state chart που κρατά τον οπλισμό: η ταυτότητα και ο οπλισμός
 * είναι **το ίδιο γεγονός**. Το Excalidraw το λύνει αλλιώς: `appState.activeTool` είναι
 * **ένα** αντικείμενο, κανένας δεύτερος κάτοχος ταυτότητας, άρα τίποτα να ξαναοπλιστεί.
 * Το AutoCAD/BricsCAD το προσπερνά τελείως: κάθε macro κορδέλας ξεκινά με **`^C^C`** —
 * *άκυρο, μετά ξεκίνα, χωρίς όρους*.
 *
 * 🔑 **Ο κανόνας**: το short-circuit «ήδη ενεργό, μην κάνεις τίποτα» επιτρέπεται **ΜΟΝΟ**
 * όταν αυτό που συγκρίνεις **ΕΙΝΑΙ** αυτό που κρατά τον οπλισμό. Εμείς συγκρίναμε το
 * `toolStateStore` ενώ ο οπλισμός ζούσε στο `DrawingStateMachine`.
 *
 * ## Τι λύνει αυτό το αρχείο
 * Το `core/state-machine/index.ts` **ήδη δήλωνε** τον σωστό διαχωρισμό:
 * > *ToolStateManager: **WHICH** tool is active · DrawingStateMachine: **WHAT** the tool is doing.*
 *
 * Ο κώδικας δεν τον τηρούσε. Εδώ ζει η **μία** συνάρτηση που απαντά «οπλίζω ή όχι;», και
 * την καλούν **και οι δύο** διαδρομές (δήλωση + κλικ) — ώστε να μην ξαναγεννηθεί δεύτερος
 * κριτής. Είναι **καθαρή**: καμία React, κανένα store, κανένα singleton ⇒ η άγκυρα την
 * **εκτελεί**, δεν την περιγράφει.
 *
 * ⚠️ **Η εμβέλεια είναι ΣΚΟΠΙΜΑ ΤΑΥΤΟΣΗΜΗ με τη σημερινή** (`ownsDrawingMachine`): κανένα
 * εργαλείο δεν αποκτά οπλισμό που δεν είχε, κανένα δεν τον χάνει. Αλλάζει **μόνο** το
 * *πότε* ρωτάμε και *ποιος* απαντά.
 *
 * @see hooks/drawing/useDrawingMachineArming — ο ΕΝΑΣ React δεσμός (πρωτεύουσα διαδρομή)
 * @see hooks/drawing/useDrawingHandlers — το δίχτυ ασφαλείας τη στιγμή του κλικ
 * @see docs/centralized-systems/reference/adrs/ADR-032-drawing-state-machine.md §1
 */

import { isDrawingTool, isMeasurementTool } from './ToolStateManager';

/**
 * Εργαλεία γωνίας που **επιλέγουν οντότητες** αντί να μαζεύουν σημεία: τρέχουν δική τους
 * μηχανή (`useAngleEntityMeasurement`) και **δεν** περνούν από το drawing pipeline.
 *
 * ⚠️ Ζούσε ως `new Set([...])` **μέσα στο σώμα** του `useCanvasEffects` — δηλαδή
 * ξαναχτιζόταν σε **κάθε render** και ήταν αόρατο σε κάθε άλλον καταναλωτή. Εδώ είναι
 * module-level: ένα αντικείμενο, μία δήλωση.
 */
export const ENTITY_PICKING_TOOLS: ReadonlySet<string> = new Set([
  'measure-angle-constraint',
  'measure-angle-line-arc',
  'measure-angle-two-arcs',
]);

/**
 * Ανήκει αυτό το εργαλείο στη μηχανή σχεδίασης (`DrawingStateMachine`);
 *
 * ⚠️ **Ταυτόσημο κατηγόρημα με το προ-ADR-032-§1 `useCanvasEffects`** — σκόπιμα. Η
 * διόρθωση δεν μετακινεί εργαλεία μέσα/έξω από τη μηχανή· διορθώνει **πότε** ρωτάμε.
 *
 * @param tool το εργαλείο που δηλώνει η κορδέλα (`toolStateStore.activeTool`)
 */
export function ownsDrawingMachine(tool: string | null | undefined): boolean {
  if (!tool) return false;
  if (ENTITY_PICKING_TOOLS.has(tool)) return false;
  return isDrawingTool(tool) || isMeasurementTool(tool);
}

/** Η απόφαση. Δύο τιμές — δεν υπάρχει τρίτη ερώτηση να κρυφτεί εδώ μέσα. */
export type DrawingArmingDecision = 'arm' | 'none';

/**
 * Η **μία** απόφαση: πρέπει να οπλιστεί η μηχανή για το δηλωμένο εργαλείο;
 *
 * @param declaredTool  τι λέει η **αυθεντία** (`toolStateStore.activeTool`) — η κορδέλα,
 *   τα πλήκτρα, ο κύκλος ζωής του εργαλείου. Αυτό βλέπει ο άνθρωπος.
 * @param machineTool   τι νομίζει η **μηχανή** (`drawingState.currentTool`, δηλαδή
 *   `machineContext.toolType || 'select'`).
 * @param machineAcceptsPoints μπορεί η μηχανή να δεχτεί κλικ **τώρα**
 *   (`drawingState.isDrawing` ≡ `TOOL_READY | COLLECTING_POINTS | PREVIEWING | COMPLETING`
 *   ≡ `DRAWING_STATES[state].allowsAddPoint`). **Αυτή** είναι η ερώτηση του ανθρώπου:
 *   «αν πατήσω τώρα, θα γραφτεί;»
 *
 * ## Γιατί ο φρουρός είναι ΜΕΡΟΣ ΤΗΣ ΛΥΣΗΣ, όχι λεπτομέρεια (N.7.2 #3 — ιδempotency)
 * Το `startDrawing` **δεν** είναι idempotent: κάνει `setLocalState({...})` με **νέο
 * αντικείμενο** ⇒ re-render ⇒ αν το ξανακαλούσε ο δεσμός θα γεννιόταν **ατέρμονος
 * βρόχος**. Κι ένας δεύτερος λόγος, σοβαρότερος: `SELECT_TOOL` **μηδενίζει τα σημεία**
 * — οπλισμός στη μέση πολυγραμμής θα **έτρωγε** τη δουλειά του ανθρώπου.
 *
 * 🔑 Ο φρουρός ρωτά `machineAcceptsPoints` **πρώτα**, κι όχι μόνο `machineTool ===
 * declaredTool`: η «άοπλη» μηχανή διαβάζεται ως `'select'` (το `useUnifiedDrawing:105`
 * κάνει `|| 'select'`), άρα σύγκριση **μόνο** ονομάτων θα έλεγε ψέματα για το `'select'`.
 * Το `machineAcceptsPoints` δεν λέει ψέματα ποτέ.
 */
export function resolveDrawingArming(
  declaredTool: string | null | undefined,
  machineTool: string | null | undefined,
  machineAcceptsPoints: boolean,
): DrawingArmingDecision {
  if (!ownsDrawingMachine(declaredTool)) return 'none';
  // Ήδη οπλισμένη για ΑΥΤΟ το εργαλείο ⇒ μην αγγίξεις: ούτε βρόχος, ούτε φαγωμένα σημεία.
  if (machineAcceptsPoints && machineTool === declaredTool) return 'none';
  return 'arm';
}
