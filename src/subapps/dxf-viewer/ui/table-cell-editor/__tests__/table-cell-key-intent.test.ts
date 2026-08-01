/**
 * ADR-739 Φ.Δ βήμα 2 — `resolveTableCellKeyIntent`: ο πίνακας προδιαγραφής του πληκτρολογίου.
 *
 * Διαβάζεται σαν προδιαγραφή επίτηδες. Κάθε γραμμή είναι απόφαση που ερευνήθηκε σε
 * Excel / AutoCAD-BricsCAD / WAI-ARIA APG (ADR-739 §20.1) — **όχι** αποτύπωμα υλοποίησης.
 *
 * Τα δύο ρίσκα που στοχεύει:
 *  1. Τα βέλη σε κατάσταση `edit` να κλέβονται από την πλοήγηση ⇒ αδύνατη η διόρθωση ενός
 *     γράμματος στη μέση (η μισή διαφορά Excel `Enter` vs `Edit` mode).
 *  2. Το κελί να καταβροχθίσει `Ctrl+Z` ⇒ ο χρήστης χάνει το undo όσο γράφει.
 */

import { resolveTableCellKeyIntent } from '../table-cell-key-intent';
import type { TableCellCursorMode } from '../../../state/table-cell-cursor-store';

const NO_MODS = { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false } as const;
const SHIFT = { ...NO_MODS, shiftKey: true } as const;
const CTRL = { ...NO_MODS, ctrlKey: true } as const;

const ALL_MODES: readonly TableCellCursorMode[] = ['nav', 'enter', 'edit'];

// ── Κινήσεις που ισχύουν σε ΚΑΘΕ κατάσταση ─────────────────────────────────

describe('Tab / Enter — δεσμεύουν και μετακινούν σε κάθε κατάσταση', () => {
  it.each(ALL_MODES)('Tab σε κατάσταση %s ⇒ next', (mode) => {
    expect(resolveTableCellKeyIntent('Tab', NO_MODS, mode)).toEqual({ kind: 'move', move: 'next' });
  });

  it.each(ALL_MODES)('Shift+Tab σε κατάσταση %s ⇒ previous', (mode) => {
    expect(resolveTableCellKeyIntent('Tab', SHIFT, mode)).toEqual({ kind: 'move', move: 'previous' });
  });

  it.each(ALL_MODES)('Enter σε κατάσταση %s ⇒ commitDown (κανόνας αγκύρωσης)', (mode) => {
    expect(resolveTableCellKeyIntent('Enter', NO_MODS, mode)).toEqual({ kind: 'move', move: 'commitDown' });
  });

  it.each(ALL_MODES)('Shift+Enter σε κατάσταση %s ⇒ commitUp', (mode) => {
    expect(resolveTableCellKeyIntent('Enter', SHIFT, mode)).toEqual({ kind: 'move', move: 'commitUp' });
  });
});

// ── Η διάκριση Excel: enter vs edit ────────────────────────────────────────

describe('βέλη — η ΜΙΑ διαφορά ανάμεσα σε «enter» και «edit» (Excel)', () => {
  it.each([
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['ArrowUp', 'up'],
    ['ArrowDown', 'down'],
  ] as const)('%s σε πλοήγηση ⇒ μετακίνηση κελιού (%s)', (key, move) => {
    expect(resolveTableCellKeyIntent(key, NO_MODS, 'nav')).toEqual({ kind: 'move', move });
  });

  it('βέλος σε «enter» (πληκτρολόγησες) ⇒ δεσμεύει ΚΑΙ μετακινεί', () => {
    expect(resolveTableCellKeyIntent('ArrowRight', NO_MODS, 'enter')).toEqual({ kind: 'move', move: 'right' });
  });

  it('βέλος σε «edit» (F2) ⇒ passthrough — ο κέρσορας του κειμένου το κρατά', () => {
    expect(resolveTableCellKeyIntent('ArrowRight', NO_MODS, 'edit')).toEqual({ kind: 'passthrough' });
  });
});

describe('F2 — το «διπλό F2» του Excel', () => {
  it.each([
    ['nav', 'edit'],
    ['enter', 'edit'],
    ['edit', 'enter'],
  ] as const)('F2 από %s ⇒ %s', (from, to) => {
    expect(resolveTableCellKeyIntent('F2', NO_MODS, from)).toEqual({ kind: 'mode', to });
  });
});

// ── Home / End (WAI-ARIA APG) ──────────────────────────────────────────────

describe('Home / End — πλέγμα σε πλοήγηση, κείμενο σε γραφή', () => {
  it.each([
    ['Home', NO_MODS, 'rowStart'],
    ['End', NO_MODS, 'rowEnd'],
    ['Home', CTRL, 'gridStart'],
    ['End', CTRL, 'gridEnd'],
  ] as const)('%s (ctrl=%p) σε πλοήγηση ⇒ %s', (key, mods, move) => {
    expect(resolveTableCellKeyIntent(key, mods, 'nav')).toEqual({ kind: 'move', move });
  });

  it.each(['enter', 'edit'] as const)('Home σε κατάσταση %s ⇒ passthrough (αρχή της λέξης σου)', (mode) => {
    expect(resolveTableCellKeyIntent('Home', NO_MODS, mode)).toEqual({ kind: 'passthrough' });
  });
});

// ── Delete ─────────────────────────────────────────────────────────────────

describe('Delete / Backspace', () => {
  it.each(['Delete', 'Backspace'] as const)('%s σε πλοήγηση ⇒ άδειασμα κελιού (Excel)', (key) => {
    expect(resolveTableCellKeyIntent(key, NO_MODS, 'nav')).toEqual({ kind: 'clear' });
  });

  it.each(['enter', 'edit'] as const)('Delete σε κατάσταση %s ⇒ passthrough (σβήνεις κείμενο)', (mode) => {
    expect(resolveTableCellKeyIntent('Delete', NO_MODS, mode)).toEqual({ kind: 'passthrough' });
  });
});

// ── 🔴 Ό,τι ΔΕΝ επιτρέπεται να κλαπεί ──────────────────────────────────────

describe('τα πλήκτρα που το κελί ΔΕΝ κλέβει ποτέ', () => {
  it('Ctrl+C ⇒ passthrough', () => {
    expect(resolveTableCellKeyIntent('c', CTRL, 'nav')).toEqual({ kind: 'passthrough' });
  });

  it('Ctrl+Tab (εναλλαγή καρτέλας browser) ⇒ passthrough, ΟΧΙ μετακίνηση κελιού', () => {
    expect(resolveTableCellKeyIntent('Tab', CTRL, 'nav')).toEqual({ kind: 'passthrough' });
  });

  it.each(['ArrowDown', 'F2', 'a', 'Home'])(
    'Alt+%s ⇒ passthrough — το Alt ανήκει στους επιταχυντές της εφαρμογής',
    (key) => {
      expect(resolveTableCellKeyIntent(key, { ...NO_MODS, altKey: true }, 'enter')).toEqual({
        kind: 'passthrough',
      });
    },
  );

  // ── 🔴 ADR-739 Φ.Δ βήμα 6 — η ΜΙΑ εξαίρεση, και γιατί αντιστράφηκε ──
  //
  // Μέχρι το βήμα 5 αυτό ήταν `passthrough` με ρητή αιτιολογία: «δεν το υλοποιούμε, αλλά ούτε
  // το κλέβουμε». Ήταν σωστό **όσο** το στοιχείο ήταν `<input>`, που δεν δέχεται αλλαγή
  // γραμμής: η αδράνεια ήταν δωρεάν. Το βήμα 6 το έκανε `<textarea>` (δεύτερη οπτική γραμμή),
  // οπότε η ΙΔΙΑ αδράνεια γράφει τώρα πραγματικό `\n` μέσα στο `TableCell.value` — που είναι
  // απλό `string` (ADR-739 Φ.Α). Η αρχή δεν άλλαξε· άλλαξε ποια ενέργεια την υπηρετεί.
  it('Alt+Enter ⇒ suppress — το <textarea> ΘΑ έγραφε \\n σε μοντέλο μονής γραμμής', () => {
    expect(resolveTableCellKeyIntent('Enter', { ...NO_MODS, altKey: true }, 'enter')).toEqual({
      kind: 'suppress',
    });
  });

  it('Alt+Enter ⇒ suppress και σε πλοήγηση — καμία κατάσταση δεν γράφει αλλαγή γραμμής', () => {
    expect(resolveTableCellKeyIntent('Enter', { ...NO_MODS, altKey: true }, 'nav')).toEqual({
      kind: 'suppress',
    });
  });

  it.each(ALL_MODES)('Escape σε κατάσταση %s ⇒ passthrough — ανήκει ΠΑΝΤΑ στον escape-bus', (mode) => {
    expect(resolveTableCellKeyIntent('Escape', NO_MODS, mode)).toEqual({ kind: 'passthrough' });
  });

  it.each(['α', 'A', '7', 'ω', ' '])('εκτυπώσιμος χαρακτήρας «%s» ⇒ passthrough (μπαίνει φυσικά στο input)', (key) => {
    expect(resolveTableCellKeyIntent(key, NO_MODS, 'nav')).toEqual({ kind: 'passthrough' });
  });

  it('«Dead» (νεκρός τόνος ελληνικού πληκτρολογίου) ⇒ passthrough', () => {
    expect(resolveTableCellKeyIntent('Dead', NO_MODS, 'nav')).toEqual({ kind: 'passthrough' });
  });
});

// ── ADR-739 Φ.Δ βήμα 4 — Ctrl+Z / Ctrl+Y: η σημασιολογία του Excel ─────────

/**
 * 🔴 Η ΑΠΟΦΑΣΗ ΠΟΥ ΑΝΤΙΣΤΡΑΦΗΚΕ. Μέχρι το βήμα 3, το `Ctrl+Z` ήταν `passthrough` σε **κάθε**
 * κατάσταση, με αιτιολογία «μη φας το undo του χρήστη». Στο βήμα 4 ο καμβάς μπήκε πίσω από
 * τον δομικό φύλακα και **παραιτείται** μέσα σε λειτουργία πίνακα — οπότε η ίδια αρχή απαιτεί
 * το αντίθετο: αν δεν το διεκδικήσει το κελί, το `Ctrl+Z` δεν κάνει **τίποτα**.
 *
 * Η γραμμή είναι η κατάσταση, όχι το πλήκτρο:
 *   · πλοήγηση → αναίρεση της τελευταίας **επεξεργασίας κελιού** (ιστορικό εντολών)
 *   · γραφή    → αναίρεση της **πληκτρολόγησης**, την οποία κάνει ο browser στο `<input>`
 *                — άρα `passthrough`, γιατί κάθε συνθετικό undo θα έσπαγε τη στοίβα του πεδίου.
 */
describe('Ctrl+Z / Ctrl+Y — αναίρεση με σημασιολογία Excel', () => {
  /** ⚠️ `code`, ΟΧΙ `key`: σε ελληνική διάταξη το `key` του ίδιου πλήκτρου είναι «ζ». */
  const ctrlCode = (code: string, shiftKey = false) => ({ ...NO_MODS, ctrlKey: true, shiftKey, code });

  it('Ctrl+Z σε πλοήγηση ⇒ αναίρεση', () => {
    expect(resolveTableCellKeyIntent('z', ctrlCode('KeyZ'), 'nav')).toEqual({
      kind: 'history', direction: 'undo',
    });
  });

  it('🔴 ΕΛΛΗΝΙΚΗ ΔΙΑΤΑΞΗ: key=«ζ» με code=KeyZ ⇒ αναίρεση (θα χανόταν με έλεγχο στο key)', () => {
    expect(resolveTableCellKeyIntent('ζ', ctrlCode('KeyZ'), 'nav')).toEqual({
      kind: 'history', direction: 'undo',
    });
  });

  it.each([
    ['Ctrl+Y', ctrlCode('KeyY')],
    ['Ctrl+Shift+Z', ctrlCode('KeyZ', true)],
  ])('%s σε πλοήγηση ⇒ επανάληψη', (_label, mods) => {
    expect(resolveTableCellKeyIntent('y', mods, 'nav')).toEqual({
      kind: 'history', direction: 'redo',
    });
  });

  it.each(['enter', 'edit'] as const)(
    'Ctrl+Z σε κατάσταση %s ⇒ passthrough — το undo ανήκει στο <input> (Excel)',
    (mode) => {
      expect(resolveTableCellKeyIntent('z', ctrlCode('KeyZ'), mode)).toEqual({ kind: 'passthrough' });
    },
  );

  it('χωρίς Ctrl, το «z» παραμένει εκτυπώσιμος χαρακτήρας', () => {
    expect(resolveTableCellKeyIntent('z', { ...NO_MODS, code: 'KeyZ' }, 'nav')).toEqual({
      kind: 'passthrough',
    });
  });

  it('Ctrl+άλλο γράμμα (π.χ. Ctrl+B) ⇒ passthrough, δεν γίνεται κατά λάθος ιστορικό', () => {
    expect(resolveTableCellKeyIntent('b', ctrlCode('KeyB'), 'nav')).toEqual({ kind: 'passthrough' });
  });

  it('Ctrl+Home παραμένει άκρη πλέγματος — προηγείται του ιστορικού', () => {
    expect(resolveTableCellKeyIntent('Home', ctrlCode('Home'), 'nav')).toEqual({
      kind: 'move', move: 'gridStart',
    });
  });
});
