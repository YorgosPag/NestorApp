/**
 * ADR-739 Φ.Δ βήμα 4 — **εντολές που δεν είναι εργαλεία**.
 *
 * ## Το κενό που καλύπτει
 * Το {@link CommandAliasRegistry} χαρτογραφεί `alias → ToolType`, και ο εκτελεστής του
 * κάνει ένα πράγμα: `toolStateStore.selectTool(toolId)`. Αυτό είναι σωστό για τις ~150
 * εντολές του AutoCAD που **οπλίζουν εργαλείο** (`L`, `REC`, `TRIM`…), και δομικά ανίκανο
 * για εντολές που **ενεργούν πάνω στην τρέχουσα επιλογή** χωρίς να αλλάξουν εργαλείο.
 * Το `TABLEDIT` είναι ακριβώς τέτοια: «μπες στον πίνακα που είναι ήδη επιλεγμένος».
 *
 * ⚠️ Η προφανής «λύση» — να δηλωθεί ένα ψεύτικο `ToolType` με όνομα `table-edit` — θα
 * μόλυνε το SSoT των εργαλείων με κάτι που δεν έχει εικονίδιο, κατηγορία, δρομέα, ούτε
 * συμπεριφορά κλικ, και θα εμφανιζόταν σε κάθε καταναλωτή του `TOOL_DEFINITIONS`.
 *
 * ## Γιατί εγγραφή εκτελεστή σε χρόνο εκτέλεσης
 * Η ενέργεια χρειάζεται τη **σκηνή** και την **επιλογή** — πράγματα που ζουν σε React
 * hooks, όχι σε καθαρό module. Ίδιο σχήμα με τον `EscapeCommandBus` (ADR-364): το μητρώο
 * κρατά τα **ονόματα** (δεδομένα, στατικά, ελέγξιμα σε test), και ο ιδιοκτήτης της
 * δυνατότητας εγγράφει το **πώς** όσο ζει. Ένα module που θα «τραβούσε» μόνο του
 * levelManager θα ήταν κρυφή εξάρτηση σε παγκόσμια κατάσταση.
 *
 * ## 🔴 Ο έλεγχος σύγκρουσης είναι TEST, όχι σύμβαση
 * Δύο μητρώα ονομάτων στον ίδιο χώρο ονομάτων είναι ακριβώς το σχήμα που αποκλίνει
 * σιωπηλά: κάποιος προσθέτει `TE` ως συντόμευση του `TEXT` και το `TABLEDIT` παύει να
 * φτάνει ποτέ, χωρίς κανένα σφάλμα πουθενά. Το `__tests__/command-alias-namespace.test.ts`
 * αποδεικνύει **μηδενική τομή** μεταξύ των δύο συνόλων. Δες εκεί.
 *
 * @module subapps/dxf-viewer/systems/command-line/CommandActionRegistry
 * @see CommandAliasRegistry.ts — το αδελφό μητρώο, για εντολές που οπλίζουν εργαλείο
 * @see systems/escape-bus/EscapeCommandBus.ts — το πρότυπο της εγγραφής εκτελεστή
 */

import { compareByLocale } from '@/lib/intl-formatting';

/** Οι ενέργειες που γνωρίζει η γραμμή εντολών. Κλειστό σύνολο — καμία δυναμική συμβολοσειρά. */
export type CommandActionId = 'table.edit';

export interface CommandActionEntry {
  readonly alias: string;
  readonly actionId: CommandActionId;
}

/**
 * `alias → ενέργεια`. ASCII, όπως και τα aliases εργαλείων (πολυγλωσσικά ασφαλές).
 *
 * `TABLEDIT` είναι το όνομα του AutoCAD· `TE` η σύντομη μορφή. Και τα δύο ελέγχονται για
 * σύγκρουση με τα ~150 aliases εργαλείων — δες την κεφαλίδα.
 */
const ACTION_ALIASES: ReadonlyArray<readonly [string, CommandActionId]> = [
  ['TABLEDIT', 'table.edit'],
  ['TE', 'table.edit'],
] as const;

const _byAlias = new Map<string, CommandActionId>(
  ACTION_ALIASES.map(([alias, id]) => [alias.toUpperCase(), id]),
);

/** Ό,τι πρέπει να ξέρει το μητρώο για να εκτελέσει μια ενέργεια. */
export interface CommandActionRunner {
  /** `false` ⇒ η ενέργεια δεν έχει νόημα τώρα (π.χ. δεν είναι επιλεγμένος πίνακας). */
  readonly canRun: () => boolean;
  /** Εκτέλεσε. Καλείται μόνο όταν το {@link canRun} επέστρεψε `true`. */
  readonly run: () => void;
}

const _runners = new Map<CommandActionId, CommandActionRunner>();

/**
 * Δηλώνει ποιος εκτελεί μια ενέργεια, όσο ζει ο ιδιοκτήτης της.
 *
 * @returns συνάρτηση αποδέσμευσης — επιστρέψτε την κατευθείαν από το `useEffect`.
 *   **Ιδεμποτής**, και αποδεσμεύει **μόνο τον δικό της** εκτελεστή: σε διπλό effect του
 *   React StrictMode ο δεύτερος εκτελεστής έχει ήδη αντικαταστήσει τον πρώτο, και η
 *   καθυστερημένη αποδέσμευση του πρώτου δεν επιτρέπεται να τον σβήσει.
 */
export function registerCommandAction(
  actionId: CommandActionId,
  runner: CommandActionRunner,
): () => void {
  _runners.set(actionId, runner);
  return () => {
    if (_runners.get(actionId) === runner) _runners.delete(actionId);
  };
}

/** Η ενέργεια πίσω από ένα alias, ή `null`. Case-insensitive, όπως τα aliases εργαλείων. */
export function resolveCommandAction(alias: string): CommandActionId | null {
  return _byAlias.get(alias.trim().toUpperCase()) ?? null;
}

/**
 * Εκτελεί την ενέργεια. `false` όταν κανείς δεν την έχει εγγράψει ή όταν δεν έχει νόημα
 * τώρα — τότε ο καλών οφείλει να **μην** καταναλώσει την εντολή σιωπηλά.
 */
export function runCommandAction(actionId: CommandActionId): boolean {
  const runner = _runners.get(actionId);
  if (!runner || !runner.canRun()) return false;
  runner.run();
  return true;
}

/** Όλα τα aliases ενεργειών, ταξινομημένα. Για tests και για το autocomplete. */
export function getAllCommandActionAliases(): readonly CommandActionEntry[] {
  return ACTION_ALIASES.map(([alias, actionId]) => ({ alias, actionId }))
    .sort((a, b) => compareByLocale(a.alias, b.alias));
}

/** Fuzzy-prefix, ίδια σημασιολογία με το `getMatchingAliases` των εργαλείων. */
export function getMatchingCommandActions(prefix: string, limit = 10): readonly CommandActionEntry[] {
  if (!prefix) return [];
  const upper = prefix.trim().toUpperCase();
  return getAllCommandActionAliases()
    .filter((e) => e.alias.startsWith(upper))
    .slice(0, limit);
}

/** Test-only — μηδενισμός των εκτελεστών μεταξύ tests. Ο κώδικας παραγωγής ΔΕΝ το καλεί. */
export function __resetCommandActionRunnersForTests(): void {
  _runners.clear();
}
