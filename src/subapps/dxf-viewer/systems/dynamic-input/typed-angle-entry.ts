/**
 * ADR-397/513 (Giorgio 2026-07-06) — SSoT για την **inline πληκτρολόγηση αριθμού** (typed numeric entry).
 *
 * Big-player parity (Revit / Maxon Cinema-4D / AutoCAD / Figma συγκλίνουν): αφού οριστεί το context
 * (κέντρο περιστροφής, ή προηγούμενο σημείο γραμμής), ο χρήστης **πληκτρολογεί την τιμή inline**
 * (ζωντανό preview) και **Enter** οριστικοποιεί — ΟΧΙ modal dialog. Η ίδια input-λογική ΠΡΕΠΕΙ να
 * ισχύει σε ΚΑΘΕ σημείο αριθμητικής πληκτρολόγησης της εφαρμογής (γωνία, απόσταση, …).
 *
 * `applyTypedNumericKey` = η **ΜΟΝΑΔΙΚΗ** pure πηγή του «πώς ένα πλήκτρο χτίζει έναν αριθμό»:
 *   · ψηφία / `.` / `,` / `-` → buffer (κόμμα ≡ τελεία, ελληνική/ευρωπαϊκή σύμβαση 45,5 ≡ 45.5),
 *   · `Backspace` → επεξεργασία buffer,
 *   · `Enter` → σήμα οριστικοποίησης (ο caller αποφασίζει ΤΙ οριστικοποιεί).
 * Το `allowNegative` (default `true`) ελέγχει αν το `-` γίνεται δεκτό: **γωνίες** το θέλουν (signed
 * +CCW/−CW)· **αποστάσεις** (AutoCAD DDE — κατεύθυνση από τον κέρσορα) το απορρίπτουν.
 *
 * Πάνω σε `DirectDistanceEntry` (ADR-344 SSoT buffer· το `Number(buffer)` μένει έγκυρο γιατί
 * κανονικοποιούμε «,» → «.»). Consumers (διαφορετικές state machines, ΙΔΙΑ input-λογική — μηδέν διπλότυπο):
 *   · grip hot-grip rotate-free (`grip-hotgrip-actions.runHotGripKeyDown`) — γωνία,
 *   · 2-click ROTATE tool awaiting-angle (`useRotationTool.handleRotationKeyDown`) — γωνία,
 *   · LINE Direct Distance Entry (`useCanvasKeyboardShortcuts`, ADR-357) — απόσταση (`allowNegative:false`).
 *
 * `applyTypedAngleKey` = thin angle-flavoured alias (allowNegative default) — διατηρείται για τους 2
 * rotation consumers· byte-identical συμπεριφορά.
 *
 * Zero React / DOM dependencies — fully unit-testable.
 *
 * @see ../../text-engine/interaction/DirectDistanceEntry.ts — ο buffer SSoT
 */

import type { DirectDistanceEntry } from '../../text-engine/interaction/DirectDistanceEntry';

export interface TypedNumericKeyResult {
  /** `true` → ο caller πρέπει να καταναλώσει το πλήκτρο (`preventDefault` + `stopImmediatePropagation`). */
  readonly consumed: boolean;
  /**
   * · `'buffer'` → ενημερώθηκε το buffer· ο caller κάνει preview με το `value`.
   * · `'commit'` → πατήθηκε Enter· ο caller οριστικοποιεί (typed `value`, ή, αν null, τη δική του live τιμή).
   * · `'none'`   → το πλήκτρο δεν αφορά την αριθμητική πληκτρολόγηση (ΔΕΝ καταναλώνεται).
   */
  readonly kind: 'buffer' | 'commit' | 'none';
  /** Τρέχον buffer string (για readout). */
  readonly buffer: string;
  /** Parsed αριθμός (signed αν επιτρέπεται, ΧΩΡΙΣ normalize) ή null όταν το buffer είναι μερικό/κενό. */
  readonly value: number | null;
}

/** @deprecated χρησιμοποίησε `TypedNumericKeyResult`. Alias για backward-compat στους angle consumers. */
export type TypedAngleKeyResult = TypedNumericKeyResult;

export interface TypedNumericKeyOptions {
  /** Αν `false`, το `-` απορρίπτεται (αποστάσεις). Default `true` (γωνίες, signed). */
  readonly allowNegative?: boolean;
}

const NONE: TypedNumericKeyResult = { consumed: false, kind: 'none', buffer: '', value: null };

/**
 * Επεξεργάσου ΕΝΑ keystroke για inline αριθμητική εισαγωγή πάνω στο `dde`. Pure ως προς το DDE (μεταλλάσσει
 * το buffer του, όπως και το legacy inline code). Ο caller wire-άρει preview (`'buffer'`) + commit (`'commit'`).
 */
export function applyTypedNumericKey(
  dde: DirectDistanceEntry,
  key: string,
  opts?: TypedNumericKeyOptions,
): TypedNumericKeyResult {
  const allowNegative = opts?.allowNegative ?? true;
  // Enter → σήμα commit (καταναλώνεται ΑΚΟΜΗ κι όταν το buffer είναι κενό, ώστε ένα αδέσποτο Enter
  // να μη διαρρέει στο drawing-finish όσο συνεχίζεται το context· ο caller αποφασίζει τι κάνει).
  if (key === 'Enter') {
    const s = dde.snapshot();
    return { consumed: true, kind: 'commit', buffer: s.buffer, value: s.value };
  }
  // Backspace → επεξεργασία buffer (μόνο όσο υπάρχει ενεργό buffer· αλλιώς no-op ΩΣΤΕ το smart-delete
  // να λειτουργεί κανονικά εκτός αριθμητικής εισαγωγής).
  if (key === 'Backspace') {
    if (dde.snapshot().status !== 'buffering') return NONE;
    dde.pressKey('Backspace');
    const s = dde.snapshot();
    return { consumed: true, kind: 'buffer', buffer: s.buffer, value: s.value };
  }
  // `-` απορρίπτεται όταν allowNegative=false (αποστάσεις): ΔΕΝ καταναλώνεται → πέφτει στο επόμενο handler.
  if (key === '-' && !allowNegative) return NONE;
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

/**
 * Angle-flavoured alias του `applyTypedNumericKey` (allowNegative default = signed γωνία). Διατηρείται
 * για τους 2 rotation consumers (grip hot-grip ⊕ 2-click ROTATE) — byte-identical συμπεριφορά.
 */
export function applyTypedAngleKey(dde: DirectDistanceEntry, key: string): TypedNumericKeyResult {
  return applyTypedNumericKey(dde, key);
}
