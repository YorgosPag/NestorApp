/**
 * =============================================================================
 * ΤΙ ΣΗΜΑΙΝΕΙ ΑΥΤΟ ΤΟ ΠΛΗΚΤΡΟ ΣΕ ΕΝΑ ΠΛΕΓΜΑ ΔΕΔΟΜΕΝΩΝ; — καθαρό, χωρίς DOM (ADR-923 §5.10.4 Β1)
 * =============================================================================
 *
 * Το γενικό ισοδύναμο του `resolveTableCellKeyIntent` του DXF (`ui/table-cell-editor/table-cell-key-intent.ts`),
 * στο **ίδιο** ιδίωμα: συνάρτηση `(key, modifiers, mode) → πρόθεση`, χωρίς `KeyboardEvent`, ώστε κάθε κανόνας να
 * δοκιμάζεται χωρίς jsdom. Ο DXF μπορεί να περάσει εδώ (`pending-ratchet-work.md`).
 *
 * ## Οι τρεις καταστάσεις (Excel)
 * | `mode` | Πότε | Τα βέλη | `Esc` |
 * |---|---|---|---|
 * | `nav` | κελί επιλεγμένο, τίποτα δεν γράφεται | κινούν τον δρομέα / `Shift` επεκτείνει | **δεν** είναι δικό μας ⇒ `passthrough` (κλείνει ο διάλογος γύρω) |
 * | `enter` | άρχισες να γράφεις πάνω σε κελί | **δεσμεύουν** και κινούν | ακυρώνει το κελί |
 * | `edit` | `F2` / διπλό κλικ | κινούν τον κέρσορα μέσα στο κείμενο | ακυρώνει το κελί |
 *
 * ## 🔑 Esc δύο σταδίων (Figma · VS Code · Revit — το προηγούμενο του `use-numeric-field.ts`)
 * Πρώτο Esc ακυρώνει **μόνο** την επεξεργασία· με τίποτα σε εκκρεμότητα το πλήκτρο **φεύγει** προς τα έξω. Αυτό το
 * αρχείο κρατά το λεκτικό `'Escape'` **επίτηδες ανοιχτά** (allowlist `escape-command-bus`, με λόγο): ο bus ζει στο
 * dxf-viewer, δομικά απρόσιτος από την κύρια εφαρμογή, και ο καταναλωτής (`use-grid-keyboard`) καλεί
 * `stopPropagation` + `claimEscape` **μόνο** όταν η πρόθεση είναι `cancel`.
 *
 * ## Γιατί το `code` και όχι μόνο το `key`
 * Σε ελληνική διάταξη το `Ctrl+Z` φτάνει ως `key: 'ζ'`. Οι συντομεύσεις με `Ctrl` (Z/Y/A/D) διαβάζουν τη **φυσική**
 * θέση (`KeyZ`) — όπως ο DXF. Οι εκτυπώσιμοι χαρακτήρες **ποτέ** δεν ερμηνεύονται εδώ: πηγαίνουν στο πεδίο του
 * ενεργού κελιού (IME, ελληνικά, τόνοι — ό,τι ξέρει ο browser).
 *
 * @module lib/spreadsheet/grid-key-intent
 * @see lib/spreadsheet/grid-navigation — η σημασία κάθε κίνησης
 */

import type { GridMove } from './grid-navigation';

export type GridEditMode = 'nav' | 'enter' | 'edit';

export interface GridKeyModifiers {
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  /** Φυσική θέση (`KeyZ`) — ανεξάρτητη διάταξης. */
  readonly code?: string;
}

export type GridKeyIntent =
  /** Δέσμευσε ό,τι γράφτηκε (αν γράφτηκε) και κινήσου. */
  | { readonly kind: 'move'; readonly move: GridMove }
  /** `Shift+κίνηση` σε πλοήγηση: μεγάλωσε την επιλογή. */
  | { readonly kind: 'extend'; readonly move: GridMove }
  /** `F2`: εναλλαγή κατάστασης. */
  | { readonly kind: 'mode'; readonly to: GridEditMode }
  /** `Esc` σε γραφή: πέτα την επεξεργασία, μείνε στο κελί. */
  | { readonly kind: 'cancel' }
  /** `Delete` / `Backspace` σε πλοήγηση: άδειασε την επιλογή. */
  | { readonly kind: 'clear' }
  | { readonly kind: 'history'; readonly direction: 'undo' | 'redo' }
  | { readonly kind: 'selectAll' }
  /** `Ctrl+D`: γέμισμα προς τα κάτω (Excel). */
  | { readonly kind: 'fillDown' }
  /** `Alt+↓` σε πλοήγηση: άνοιξε τις επιλογές του κελιού (Excel data validation · APG combobox). */
  | { readonly kind: 'openChoices' }
  /**
   * `Space` σε πλοήγηση: εναλλαγή **αν** το κελί είναι διακόπτης (APG checkbox). Η πρόθεση δεν ξέρει τη στήλη ⇒ ο
   * καταναλωτής, σε στήλη που δεν είναι διακόπτης, την αφήνει να περάσει ως χαρακτήρα (Excel: το κενό αρχίζει γραφή).
   */
  | { readonly kind: 'toggle' }
  /** Καταπίνεται: το πεδίο θα έκανε κάτι που το μοντέλο δεν εκφράζει (π.χ. `Alt+Enter` = `\n` σε μονογραμμική τιμή). */
  | { readonly kind: 'suppress' }
  | { readonly kind: 'passthrough' };

const PASSTHROUGH: GridKeyIntent = { kind: 'passthrough' };

const ARROWS: Readonly<Record<string, readonly [GridMove, GridMove]>> = {
  ArrowLeft: ['left', 'edgeLeft'],
  ArrowRight: ['right', 'edgeRight'],
  ArrowUp: ['up', 'edgeUp'],
  ArrowDown: ['down', 'edgeDown'],
};

const ctrlOf = (mod: GridKeyModifiers): boolean => mod.ctrlKey || mod.metaKey;

function moveOrExtend(move: GridMove, mod: GridKeyModifiers, mode: GridEditMode): GridKeyIntent {
  return mod.shiftKey && mode === 'nav' ? { kind: 'extend', move } : { kind: 'move', move };
}

/** Συντομεύσεις `Ctrl` — μόνο σε πλοήγηση· σε γραφή ανήκουν στο πεδίο (αναίρεση κειμένου, επιλογή κειμένου). */
function ctrlIntent(mod: GridKeyModifiers, mode: GridEditMode): GridKeyIntent | null {
  if (!ctrlOf(mod) || mode !== 'nav') return null;
  switch (mod.code) {
    case 'KeyZ': return { kind: 'history', direction: mod.shiftKey ? 'redo' : 'undo' };
    case 'KeyY': return { kind: 'history', direction: 'redo' };
    case 'KeyA': return { kind: 'selectAll' };
    case 'KeyD': return { kind: 'fillDown' };
    default: return null;
  }
}

function arrowIntent(key: string, mod: GridKeyModifiers, mode: GridEditMode): GridKeyIntent | null {
  const pair = ARROWS[key];
  if (!pair) return null;
  if (mode === 'edit') return PASSTHROUGH;
  if (mod.altKey) return key === 'ArrowDown' && mode === 'nav' ? { kind: 'openChoices' } : PASSTHROUGH;
  return moveOrExtend(ctrlOf(mod) ? pair[1] : pair[0], mod, mode);
}

function homeEndIntent(key: string, mod: GridKeyModifiers, mode: GridEditMode): GridKeyIntent | null {
  if (key !== 'Home' && key !== 'End') return null;
  if (mode !== 'nav') return PASSTHROUGH;
  const jumps = ctrlOf(mod);
  const move: GridMove = key === 'Home' ? (jumps ? 'gridStart' : 'rowStart') : (jumps ? 'gridEnd' : 'rowEnd');
  return moveOrExtend(move, mod, mode);
}

function pageIntent(key: string, mod: GridKeyModifiers, mode: GridEditMode): GridKeyIntent | null {
  if (key !== 'PageUp' && key !== 'PageDown') return null;
  return moveOrExtend(key === 'PageUp' ? 'pageUp' : 'pageDown', mod, mode);
}

function commitIntent(key: string, mod: GridKeyModifiers): GridKeyIntent | null {
  if (key === 'Tab') return { kind: 'move', move: mod.shiftKey ? 'previous' : 'next' };
  if (key !== 'Enter') return null;
  if (mod.altKey) return { kind: 'suppress' };
  return { kind: 'move', move: mod.shiftKey ? 'commitUp' : 'commitDown' };
}

function navOnlyIntent(key: string, mod: GridKeyModifiers, mode: GridEditMode): GridKeyIntent | null {
  if (mode !== 'nav' || ctrlOf(mod) || mod.altKey) return null;
  if (key === 'Delete' || key === 'Backspace') return { kind: 'clear' };
  if (key === ' ') return { kind: 'toggle' };
  return null;
}

/** Η πρόθεση ενός πλήκτρου. Ό,τι δεν αναγνωρίζεται ⇒ `passthrough` (το πεδίο ή ο browser το χειρίζεται). */
export function resolveGridKeyIntent(key: string, mod: GridKeyModifiers, mode: GridEditMode): GridKeyIntent {
  if (key === 'Escape') return mode === 'nav' ? PASSTHROUGH : { kind: 'cancel' };
  if (key === 'F2') return { kind: 'mode', to: mode === 'edit' ? 'enter' : 'edit' };
  return ctrlIntent(mod, mode)
    ?? arrowIntent(key, mod, mode)
    ?? homeEndIntent(key, mod, mode)
    ?? pageIntent(key, mod, mode)
    ?? commitIntent(key, mod)
    ?? navOnlyIntent(key, mod, mode)
    ?? PASSTHROUGH;
}

/** Ποιος κατέχει το πρόχειρο: σε πλοήγηση το **εύρος** (TSV), σε γραφή το **κείμενο** του πεδίου. */
export function gridClipboardScope(mode: GridEditMode): 'range' | 'text' {
  return mode === 'nav' ? 'range' : 'text';
}
