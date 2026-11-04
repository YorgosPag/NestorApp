/**
 * @fileoverview **Το πληκτρολόγιο της ουράς ελέγχου** — καθαρό, χωρίς DOM (ADR-928 Φ3γ-0).
 * @module subapps/procurement/subcontracts/library/review-keyboard
 *
 * 🔑 J/K = επόμενη/προηγούμενη (Gmail, Linear) · A = έγκριση · R = απόρριψη · Enter = άνοιγμα στις ρήτρες. Το
 *    πληκτρολόγιο **ανοίγει τον διάλογο**, δεν αποφασίζει: η έγκριση θέλει ορατό κείμενο και ρητή επιβεβαίωση.
 * 🔑 Ποτέ μέσα σε πεδίο κειμένου ή με τροποποιητή (Ctrl/Alt/Meta): το «a» στο πεδίο λόγου είναι γράμμα, και το Ctrl+R
 *    είναι ανανέωση του browser. Το Shift περνά (Caps Lock / «Shift+J» στα ίδια πλήκτρα). Το Enter πάνω σε κουμπί ανήκει
 *    στο κουμπί.
 * 🔑 Η κίνηση **δεν** τυλίγει: στο τέλος της ουράς το J μένει στη θέση του (όπως το Gmail) — κανένα άλμα στην αρχή που
 *    θα έκανε τον άνθρωπο να ξαναδιαβάσει ρήτρα που μόλις έλεγξε.
 */

export type ReviewCommand = 'next' | 'previous' | 'approve' | 'reject' | 'open';

export interface ReviewKeyEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  /** Ο στόχος είναι πεδίο που δέχεται κείμενο (input · textarea · select · contenteditable). */
  readonly typing: boolean;
  /** Ο στόχος είναι στοιχείο ελέγχου που **του ανήκει** το Enter (κουμπί · σύνδεσμος · καρτέλα). */
  readonly onControl: boolean;
}

const COMMANDS: Readonly<Record<string, ReviewCommand>> = {
  j: 'next',
  k: 'previous',
  a: 'approve',
  r: 'reject',
  enter: 'open',
};

export function reviewCommandOf(event: ReviewKeyEvent): ReviewCommand | null {
  if (event.typing || event.ctrlKey || event.altKey || event.metaKey) return null;
  const command = COMMANDS[event.key.toLowerCase()] ?? null;
  // Enter σε κουμπί της λίστας = «επίλεξε αυτό» (το κλικ του browser), όχι «άνοιξε στις ρήτρες».
  return command === 'open' && event.onControl ? null : command;
}

/** Η θέση μετά από κίνηση· `-1` = καμία επιλογή ⇒ το πρώτο J/K επιλέγει το πρώτο στοιχείο. */
export function movedIndex(current: number, command: 'next' | 'previous', length: number): number {
  if (length === 0) return -1;
  if (current < 0 || current >= length) return 0;
  return command === 'next' ? Math.min(current + 1, length - 1) : Math.max(current - 1, 0);
}

/**
 * Μετά από απόφαση η ρήτρα **φεύγει** από την ουρά (ζωντανή ανάγνωση): η επιλογή πηγαίνει στη ρήτρα που πήρε τη θέση
 * της — όπως το «archive → next» του Gmail. `null` όταν η ουρά άδειασε.
 */
export function successorOf(previousIds: readonly string[], currentIds: readonly string[], selectedId: string): string | null {
  if (currentIds.includes(selectedId)) return selectedId;
  const position = previousIds.indexOf(selectedId);
  const remaining = new Set(currentIds);
  const after = previousIds.slice(position + 1).find((id) => remaining.has(id));
  if (after !== undefined) return after;
  const before = previousIds.slice(0, Math.max(position, 0)).reverse().find((id) => remaining.has(id));
  return before ?? currentIds[0] ?? null;
}
