/**
 * =============================================================================
 * ΑΝΑΙΡΕΣΗ / ΕΠΑΝΑΛΗΨΗ — γενική, αμετάβλητη στοίβα (ADR-923 §5.10.4 Β1)
 * =============================================================================
 *
 * Μία **ενέργεια του ανθρώπου = μία μονάδα**: μια επικόλληση 7 × 12 κελιών, ένα `Ctrl+D`, μια «δημιουργία
 * παραλλαγών» αναιρούνται με **ένα** `Ctrl+Z` (Excel · Figma). Η στοίβα κρατά **ζεύγη** `{ before, after }` του
 * καταναλωτή — όχι αντίγραφα όλου του εγγράφου — ώστε ο ίδιος τύπος να υπηρετεί πλέγμα, φόρμα ή καμβά.
 *
 * Δεν υπήρχε γενική στο repo (μετρημένο 2026-10-26): η `useAddressUndo` είναι δεμένη σε διευθύνσεις +
 * `sessionStorage`, η `useCommandHistory` του DXF σε εντολές καμβά.
 *
 * Αμετάβλητη ⇒ ζει άνετα μέσα σε `useState`/`useReducer` και δοκιμάζεται χωρίς React.
 *
 * @module lib/spreadsheet/grid-history
 */

export interface HistoryEntry<P> {
  /** Ό,τι επαναφέρει η αναίρεση. */
  readonly before: P;
  /** Ό,τι επαναφέρει η επανάληψη. */
  readonly after: P;
}

export interface History<P> {
  readonly past: readonly HistoryEntry<P>[];
  readonly future: readonly HistoryEntry<P>[];
  readonly limit: number;
}

/** Όριο από προεπιλογή — όσο του Excel (100). */
export const DEFAULT_HISTORY_LIMIT = 100;

export function emptyHistory<P>(limit: number = DEFAULT_HISTORY_LIMIT): History<P> {
  return { past: [], future: [], limit: Math.max(1, limit) };
}

/** Νέα ενέργεια: μπαίνει στο παρελθόν, **σβήνει** το μέλλον (κάθε επεξεργαστής το κάνει έτσι). */
export function recordHistory<P>(history: History<P>, entry: HistoryEntry<P>): History<P> {
  const past = [...history.past, entry];
  return { past: past.length > history.limit ? past.slice(past.length - history.limit) : past, future: [], limit: history.limit };
}

export interface HistoryStep<P> {
  readonly history: History<P>;
  /** Τι πρέπει να εφαρμόσει ο καταναλωτής — `null` ⇒ τίποτα να αναιρεθεί/επαναληφθεί. */
  readonly apply: P | null;
}

export function undoHistory<P>(history: History<P>): HistoryStep<P> {
  const entry = history.past[history.past.length - 1];
  if (!entry) return { history, apply: null };
  return {
    history: { past: history.past.slice(0, -1), future: [entry, ...history.future], limit: history.limit },
    apply: entry.before,
  };
}

export function redoHistory<P>(history: History<P>): HistoryStep<P> {
  const entry = history.future[0];
  if (!entry) return { history, apply: null };
  return {
    history: { past: [...history.past, entry], future: history.future.slice(1), limit: history.limit },
    apply: entry.after,
  };
}

export const canUndo = <P>(history: History<P>): boolean => history.past.length > 0;
export const canRedo = <P>(history: History<P>): boolean => history.future.length > 0;
