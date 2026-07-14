/**
 * ADR-651 Φάση Ι — **μαζική επεξεργασία φύλλων** (must-have #3): οι καθαρές πράξεις πάνω
 * στις pending αλλαγές του πίνακα φύλλων.
 *
 * Μετά τη Φάση Θ, ό,τι είναι **κοινό** στα φύλλα (πρότυπο, στοιχεία έργου/μελετητή, σφραγίδα,
 * αναθεώρηση) λύνεται ήδη από **ΕΝΑ** έγγραφο ⇒ μία διόρθωση αλλάζει ήδη όλα τα φύλλα, ζωντανά.
 * Άρα «batch» εδώ σημαίνει **μόνο** τα δύο πεδία που **διαφέρουν** ανά φύλλο: **αριθμός** και
 * **τίτλος**. Η μαζική πράξη που όντως χρειάζεται ο μηχανικός είναι η **επαναρίθμηση** επιλεγμένων
 * φύλλων (AutoCAD SSM «Rename & Renumber» / ArchiCAD «Renumber Layouts») — ο τίτλος είναι εξ
 * ορισμού μοναδικός ανά φύλλο, οπότε γράφεται inline στη γραμμή του.
 *
 * Καθαρές συναρτήσεις, μηδέν I/O: το UI παράγει patches, ο host τα κάνει **ένα** write ανά
 * αλλαγμένο όροφο μέσω του ΥΠΑΡΧΟΝΤΟΣ `updateLevelContext` (ADR-286 gateway). Μηδέν νέο data path.
 *
 * @see ./sheet-set.ts — `resolveSheetIdentity` (η ΜΟΝΗ σειρά προτεραιότητας: pending → persisted → auto)
 */

import { autoSheetNumber } from './sheet-numbering';
import type { SheetIdentityEdit, SheetIdentityEdits, SheetRow } from './sheet-set';

/** Το write payload ενός φύλλου — υποσύνολο του `LevelContextUpdate` (μηδέν νέο κανάλι). */
export interface SheetLevelUpdate {
  readonly levelId: string;
  /** Ο τίτλος φύλλου = η ετικέτα του ορόφου· `null` ⇒ πίσω στο όνομα ορόφου. */
  readonly entityLabel: string | null;
  /** Ο χειρόγραφος αριθμός· `null` ⇒ πίσω στην αυτόματη αρίθμηση θέσης. */
  readonly sheetNumberOverride: string | null;
}

/** Κενό κείμενο (ή μόνο κενά) ⇒ `null` = «αυτόματο» (η σημασιολογία του `resolveSheetIdentity`). */
function toStored(text: string): string | null {
  return text.trim() || null;
}

/**
 * Συγχωνεύει ένα patch στις pending αλλαγές. **Ίδια αναφορά όταν τίποτα δεν αλλάζει** — ώστε
 * η ίδια πράξη δύο φορές να είναι πραγματικά idempotent και το React να μην ξανα-render-άρει.
 */
export function mergeSheetEdits(
  edits: SheetIdentityEdits,
  patch: SheetIdentityEdits,
): SheetIdentityEdits {
  const changed = Object.entries(patch).filter(([levelId, edit]) => {
    const current = edits[levelId];
    return current?.sheetNumber !== edit.sheetNumber || current?.title !== edit.title;
  });
  if (changed.length === 0) return edits;

  const next: Record<string, SheetIdentityEdit> = { ...edits };
  for (const [levelId, edit] of changed) {
    next[levelId] = { ...next[levelId], ...edit };
  }
  return next;
}

/** Η pending τιμή μιας γραμμής (ό,τι δείχνει το πεδίο): pending edit, αλλιώς το persisted κείμενο. */
export function sheetEditValues(
  row: SheetRow,
  edits: SheetIdentityEdits,
): { readonly sheetNumber: string; readonly title: string } {
  const edit = edits[row.levelId];
  return {
    sheetNumber: edit?.sheetNumber ?? row.numberText,
    title: edit?.title ?? row.titleText,
  };
}

export interface RenumberOptions {
  /** Πρόθεμα αρίθμησης (π.χ. «Α» ⇒ Α-1, Α-2…). */
  readonly prefix: string;
  /** Ο πρώτος αριθμός της ακολουθίας (1-based· ο μηχανικός ξεκινά συχνά από αλλού). */
  readonly start: number;
}

/**
 * **Επαναρίθμηση επιλεγμένων** — ακολουθία `prefix-start`, `prefix-(start+1)`… στη **σειρά του
 * σετ** (όχι στη σειρά επιλογής): η αρίθμηση ενός τεύχους ακολουθεί πάντα τη σειρά των φύλλων.
 * Μη επιλεγμένες γραμμές δεν αγγίζονται· άγνωστο `levelId` στην επιλογή αγνοείται (ποτέ crash).
 */
export function renumberSheets(
  rows: readonly SheetRow[],
  selected: ReadonlySet<string>,
  options: RenumberOptions,
): SheetIdentityEdits {
  const patch: Record<string, SheetIdentityEdit> = {};
  let n = options.start;
  for (const row of rows) {
    if (!selected.has(row.levelId)) continue;
    patch[row.levelId] = { sheetNumber: autoSheetNumber(n - 1, options.prefix) };
    n += 1;
  }
  return patch;
}

/**
 * **Πίσω στην αυτόματη αρίθμηση** για τα επιλεγμένα (κενό κείμενο ⇒ ο αριθμός ξαναγίνεται
 * συνάρτηση της θέσης). Η αντίστροφη πράξη της `renumberSheets` — ο χρήστης δεν κλειδώνεται ποτέ.
 */
export function autoNumberSheets(
  rows: readonly SheetRow[],
  selected: ReadonlySet<string>,
): SheetIdentityEdits {
  const patch: Record<string, SheetIdentityEdit> = {};
  for (const row of rows) {
    if (selected.has(row.levelId)) patch[row.levelId] = { sheetNumber: '' };
  }
  return patch;
}

/**
 * Τι πρέπει **όντως** να γραφτεί στους ορόφους: μόνο οι γραμμές που άλλαξαν σε σχέση με το
 * persisted κείμενο (N.7.2 #3 — idempotent: δεύτερη υποβολή χωρίς αλλαγές ⇒ **μηδέν writes**).
 * Άγνωστο `levelId` στα edits αγνοείται.
 */
export function sheetLevelUpdates(
  rows: readonly SheetRow[],
  edits: SheetIdentityEdits,
): readonly SheetLevelUpdate[] {
  const updates: SheetLevelUpdate[] = [];
  for (const row of rows) {
    const { sheetNumber, title } = sheetEditValues(row, edits);
    if (sheetNumber.trim() === row.numberText.trim() && title.trim() === row.titleText.trim()) {
      continue;
    }
    updates.push({
      levelId: row.levelId,
      entityLabel: toStored(title),
      sheetNumberOverride: toStored(sheetNumber),
    });
  }
  return updates;
}
