/**
 * polygon-clipboard-key — ADR-539 Φ4a. Pure keydown → clipboard-action mapping για το
 * Cinema 4D «Polygon Mode» copy/paste. Καθαρή λογική (μηδέν React / DOM / levels) ώστε να
 * unit-test-άρεται απομονωμένα — mirror του `shortcut-dispatcher` (pure) vs `use3DShortcuts`.
 *
 * @see ./use-polygon-clipboard-shortcuts.ts — ο React leaf που το wiring-άρει
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

/** Η ενέργεια clipboard που αντιστοιχεί σε ένα keydown, ή null όταν δεν ταιριάζει. */
export type FaceClipboardAction = 'copy-face' | 'paste-face' | 'copy-entity' | 'paste-entity';

/** Τα μόνα keydown πεδία που χρειάζεται ο classifier (testable χωρίς DOM). */
export interface FaceClipboardKey {
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/**
 * Pure: αντιστοιχίζει ένα keydown σε ενέργεια clipboard. Χρησιμοποιεί `event.code`
 * (layout-independent — δουλεύει σε ελληνικό πληκτρολόγιο, όπως το Ctrl+Z).
 * Shift → entity-level· χωρίς Shift → per-face. Alt → ποτέ (αποφυγή σύγκρουσης).
 */
export function classifyFaceClipboardKey(e: FaceClipboardKey): FaceClipboardAction | null {
  if (e.altKey) return null;
  if (!e.ctrlKey && !e.metaKey) return null;
  const isCopy = e.code === 'KeyC';
  const isPaste = e.code === 'KeyV';
  if (!isCopy && !isPaste) return null;
  if (e.shiftKey) return isCopy ? 'copy-entity' : 'paste-entity';
  return isCopy ? 'copy-face' : 'paste-face';
}
