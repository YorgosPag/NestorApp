'use client';

/**
 * SSoT — «ποιο στοιχείο DOM είναι ο κύριος καμβάς του σχεδίου».
 *
 * 🔴 **Γιατί υπάρχει (μετρημένο ζωντανά, 2026-07-31):** η ερώτηση απαντιόταν με **τρεις** διαφορετικές
 * γραφές, και η μία ήταν **νεκρή**:
 *
 * | Σημείο | Γραφή | Κατάσταση |
 * |---|---|---|
 * | `canvas-v2/dxf-canvas/DxfCanvas.tsx` | ορίζει `data-canvas-type="dxf"` | η αλήθεια |
 * | `app/useDxfViewerCallbacks.ts` | `[data-canvas-type="dxf"]` | δούλευε |
 * | `systems/selection/use-selection-cycling.ts` | `getElementById('dxf-canvas')` | **ΠΑΝΤΑ `null`** |
 *
 * Ο καμβάς **δεν έχει `id`** — μόνο το `data-canvas-type`. Άρα ο τρίτος έβγαινε `null`, έκανε
 * `return` και το Shift+Space (κύκλος επιλογής, ADR-659) **δεν πυροδοτούσε ποτέ**. Καμία εξαίρεση,
 * κανένα κόκκινο test, καμία ένδειξη στην οθόνη: μια σιωπηλή πρόωρη έξοδος μοιάζει με
 * «δεν βρέθηκαν υποψήφιοι».
 *
 * Ένα `id` που δεν υπάρχει είναι ακριβώς το είδος σφάλματος που **δεν** πιάνεται στατικά — ο
 * τύπος επιστροφής είναι νόμιμα `| null` και κάθε καλών το χειρίζεται «σωστά». Γι' αυτό η λύση
 * δεν είναι «διόρθωσε τον selector» αλλά **αφαίρεσε τη δυνατότητα να γραφτεί δεύτερος**.
 *
 * @see ../../canvas-v2/dxf-canvas/DxfCanvas.tsx — το μόνο σημείο που ΘΕΤΕΙ το attribute
 */

/** Η τιμή του `data-canvas-type` που φοράει ο κύριος καμβάς σχεδίου. */
export const MAIN_DXF_CANVAS_TYPE = 'dxf';

/** Ο επιλογέας του κύριου καμβά — μία γραφή, εδώ. */
export const MAIN_DXF_CANVAS_SELECTOR = `canvas[data-canvas-type="${MAIN_DXF_CANVAS_TYPE}"]`;

/**
 * Ο κύριος καμβάς σχεδίου, ή `null` όταν δεν έχει γίνει ακόμη mount.
 *
 * `null` είναι **πραγματική** κατάσταση (πριν το πρώτο layout, ή εκτός του viewer), οπότε ο
 * καλών οφείλει να το χειριστεί. Αυτό που **δεν** είναι πραγματικό είναι ένα μόνιμο `null` από
 * λάθος selector — και αυτό το κλείνει το γεγονός ότι υπάρχει ένας.
 */
export function getMainDxfCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLCanvasElement>(MAIN_DXF_CANVAS_SELECTOR);
}
