/**
 * @fileoverview **ΤΟ ΓΡΑΜΜΑ ΜΙΑΣ ΣΥΝΤΟΜΕΥΣΗΣ, ΑΝΕΞΑΡΤΗΤΑ ΑΠΟ ΤΗ ΔΙΑΤΑΞΗ** — ένας κριτής για όλες τις συντομεύσεις
 * ενός γράμματος (Inbox ειδοποιήσεων, DXF viewer).
 * @related ADR-927 §12 · subapps/dxf-viewer/config/keyboard-shortcuts.ts (`matchesShortcut`)
 * @module lib/keyboard/latin-letter
 *
 * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ (μετρημένο στην παραγωγή 2026-11-03)**: το Inbox συνέκρινε `event.key === 'j'`. Με **ελληνική**
 *    διάταξη το ίδιο πλήκτρο δίνει `ξ` — καμία συντόμευση δεν δούλευε για τον χρήστη αυτής της εφαρμογής. Και το
 *    `event.key === 'I'` (για Shift+I) ταίριαζε και με **Caps Lock** χωρίς Shift.
 *
 * 🔑 **Ο κανόνας** (πρότυπο PeerTube/VS Code για μη λατινικές διατάξεις):
 *    1. Λατινικό γράμμα στο `event.key` ⇒ αυτό — σέβεται Dvorak/AZERTY (ο άνθρωπος πατά το γράμμα που **βλέπει**).
 *    2. Αλλιώς (ελληνικά, κυριλλικά…) ⇒ η **φυσική θέση** από το `event.code` (`KeyJ` ⇒ `j`).
 *    Πάντα **πεζό**: το Shift το κρίνει ο καλών από το `shiftKey`, ποτέ από τη μορφή του γράμματος (Caps Lock).
 */

const LATIN_LETTER = /^[a-z]$/i;
const PHYSICAL_LETTER = /^Key([A-Z])$/;

/** Το ελάχιστο σχήμα γεγονότος — ταιριάζει σε DOM `KeyboardEvent` και σε React `KeyboardEvent`. */
export interface LetterKeyEvent {
  readonly key: string;
  readonly code: string;
}

/** Το λατινικό γράμμα (πεζό) που σημαίνει το πλήκτρο, ή `null` αν δεν είναι γράμμα. */
export function latinLetterOf(event: LetterKeyEvent): string | null {
  if (typeof event.key === 'string' && LATIN_LETTER.test(event.key)) return event.key.toLowerCase();
  const physical = typeof event.code === 'string' ? PHYSICAL_LETTER.exec(event.code) : null;
  return physical ? physical[1].toLowerCase() : null;
}
