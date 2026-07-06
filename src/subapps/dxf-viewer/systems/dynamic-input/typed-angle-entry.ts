/**
 * ADR-397/513 (Giorgio 2026-07-06) — SSoT για την **inline πληκτρολόγηση γωνίας** (typed rotation angle).
 *
 * Big-player parity (Revit / Maxon Cinema-4D / AutoCAD / Figma συγκλίνουν): αφού οριστεί κέντρο
 * περιστροφής, ο χρήστης **πληκτρολογεί τη γωνία inline** (ζωντανό preview) και **Enter** οριστικοποιεί —
 * ΟΧΙ modal dialog. Η ίδια συμπεριφορά ΠΡΕΠΕΙ να ισχύει σε ΚΑΘΕ σημείο περιστροφής της εφαρμογής.
 *
 * Αυτή η pure συνάρτηση είναι η **ΜΟΝΑΔΙΚΗ** πηγή του «πώς ένα πλήκτρο χτίζει μια γωνία»:
 *   · ψηφία / `.` / `,` / `-` → buffer (κόμμα ≡ τελεία, ελληνική/ευρωπαϊκή σύμβαση 45,5 ≡ 45.5),
 *   · `Backspace` → επεξεργασία buffer,
 *   · `Enter` → σήμα οριστικοποίησης (ο caller αποφασίζει ΤΙ οριστικοποιεί).
 *
 * Πάνω σε `DirectDistanceEntry` (ADR-344 SSoT buffer· το `Number(buffer)` μένει έγκυρο γιατί
 * κανονικοποιούμε «,» → «.»). Την καταναλώνουν **ΔΥΟ** consumers, ο καθένας wire-άρει το δικό του
 * preview/commit (διαφορετικές state machines, ΙΔΙΑ input-λογική — μηδέν διπλότυπο):
 *   · grip hot-grip rotate-free (`grip-hotgrip-actions.runHotGripKeyDown`),
 *   · 2-click ROTATE tool awaiting-angle (`useRotationTool.handleRotationKeyDown`).
 *
 * Zero React / DOM dependencies — fully unit-testable.
 *
 * @see ../../text-engine/interaction/DirectDistanceEntry.ts — ο buffer SSoT
 */

import type { DirectDistanceEntry } from '../../text-engine/interaction/DirectDistanceEntry';

export interface TypedAngleKeyResult {
  /** `true` → ο caller πρέπει να καταναλώσει το πλήκτρο (`preventDefault` + `stopImmediatePropagation`). */
  readonly consumed: boolean;
  /**
   * · `'buffer'` → ενημερώθηκε το buffer· ο caller κάνει preview με το `value`.
   * · `'commit'` → πατήθηκε Enter· ο caller οριστικοποιεί (typed `value`, ή, αν null, τη δική του live γωνία).
   * · `'none'`   → το πλήκτρο δεν αφορά την πληκτρολόγηση γωνίας (ΔΕΝ καταναλώνεται).
   */
  readonly kind: 'buffer' | 'commit' | 'none';
  /** Τρέχον buffer string (για readout). */
  readonly buffer: string;
  /** Parsed γωνία (μοίρες, signed +CCW, ΧΩΡΙΣ normalize) ή null όταν το buffer είναι μερικό/κενό. */
  readonly value: number | null;
}

const NONE: TypedAngleKeyResult = { consumed: false, kind: 'none', buffer: '', value: null };

/**
 * Επεξεργάσου ΕΝΑ keystroke για inline εισαγωγή γωνίας πάνω στο `dde`. Pure ως προς το DDE (μεταλλάσσει
 * το buffer του, όπως και το legacy inline code). Ο caller wire-άρει preview (`'buffer'`) + commit (`'commit'`).
 */
export function applyTypedAngleKey(dde: DirectDistanceEntry, key: string): TypedAngleKeyResult {
  // Enter → σήμα commit (καταναλώνεται ΑΚΟΜΗ κι όταν το buffer είναι κενό, ώστε ένα αδέσποτο Enter
  // να μη διαρρέει στο drawing-finish όσο η οντότητα περιστρέφεται· ο caller αποφασίζει τι κάνει).
  if (key === 'Enter') {
    const s = dde.snapshot();
    return { consumed: true, kind: 'commit', buffer: s.buffer, value: s.value };
  }
  // Backspace → επεξεργασία buffer (μόνο όσο υπάρχει ενεργό buffer· αλλιώς no-op ΩΣΤΕ το smart-delete
  // να λειτουργεί κανονικά εκτός εισαγωγής γωνίας).
  if (key === 'Backspace') {
    if (dde.snapshot().status !== 'buffering') return NONE;
    dde.pressKey('Backspace');
    const s = dde.snapshot();
    return { consumed: true, kind: 'buffer', buffer: s.buffer, value: s.value };
  }
  // Ψηφία / `.` / `,` / `-` → buffer. Κόμμα ≡ τελεία (κανονικοποίηση ώστε `Number(buffer)` να μείνει έγκυρο).
  if (/^[\d.,-]$/.test(key)) {
    const decimalKey = key === ',' ? '.' : key;
    if (dde.snapshot().status !== 'buffering') dde.begin();
    dde.pressKey(decimalKey);                 // απορρίπτει παράνομα keystrokes εσωτερικά
    const s = dde.snapshot();
    return { consumed: true, kind: 'buffer', buffer: s.buffer, value: s.value };
  }
  return NONE;
}
