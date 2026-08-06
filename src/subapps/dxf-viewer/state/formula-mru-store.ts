'use client';

/**
 * ADR-763 §7 — **«Πιο πρόσφατη χρήση»**: οι τελευταίες συναρτήσεις που εισήγαγε ο χρήστης,
 * νεότερη πρώτη. Είναι η **προεπιλεγμένη** κατηγορία του διαλόγου του Excel.
 *
 * ## Γιατί υπάρχει καθόλου
 * Χωρίς αυτήν, η προεπιλογή θα ήταν «Όλες» — δηλαδή 375 ονόματα σε αλφαβητική σειρά, όπου το
 * `SUM` κάθεται στο 90% της κύλισης. Η κατανομή χρήσης σε φύλλο ποσοτήτων είναι ακραία: μια
 * χούφτα συναρτήσεις καλύπτουν σχεδόν τα πάντα. Η μνήμη τις φέρνει στην πρώτη οθόνη.
 *
 * ## 🔴 Γιατί ΔΕΝ είναι το `RecentColorsStore`
 * Ίδιο σχήμα (LRU 10 με `localStorage`), **άλλο περιεχόμενο και άλλη επικύρωση**: εκεί οι
 * τιμές είναι hex και ελέγχονται με regex· εδώ είναι ονόματα συναρτήσεων και ο μόνος έγκυρος
 * έλεγχος είναι «υπάρχει στο μητρώο κλήσεων;». Ένας γενικευμένος «LRU οτιδήποτε» θα έπαιρνε
 * τον έλεγχο ως παράμετρο και θα κέρδιζε δώδεκα γραμμές — με τίμημα ότι η **μία** ερώτηση που
 * έχει σημασία εδώ («μπορεί να κληθεί ακόμα;») θα ζούσε στον καλούντα, δηλαδή θα μπορούσε να
 * ξεχαστεί. Δες `formula-catalog-search.ts`: το φιλτράρισμα γίνεται και εκεί, ως δεύτερο σκέλος
 * (N.7.2 #4) — αυτό εδώ κρατά το αποθηκευμένο καθαρό, εκείνο προστατεύει την **οθόνη**.
 *
 * ## Ο σειριακός τύπος στο `localStorage` είναι `string[]`
 * Ένα κλειδί, ένας πίνακας: σε αντίθεση με τα δύο χρώματα του `table-toolbar-color-store.ts`,
 * εδώ υπάρχει **μία** χειρονομία που γράφει (η εισαγωγή συνάρτησης) και οι δέκα τιμές είναι
 * μία λίστα — δεν υπάρχει τίποτα να αποκλίνει αν χαλάσει.
 *
 * @module subapps/dxf-viewer/state/formula-mru-store
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §7
 */

import { createExternalStore } from '../stores/createExternalStore';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage-utils';

/**
 * Πόσες θυμάται. **Δέκα**, όπως το `RecentColorsStore` και όπως η λίστα του Excel — που δεν
 * είναι σύμπτωση: είναι όσες χωρούν στο ορατό κουτί χωρίς κύλιση.
 */
const MAX_RECENT = 10;

/**
 * Η αρχική λίστα σε **καθαρή** εγκατάσταση.
 *
 * Δεν είναι διακόσμηση: με κενή λίστα, η προεπιλεγμένη κατηγορία του διαλόγου θα άνοιγε
 * **άδεια** την πρώτη φορά — η χειρότερη δυνατή πρώτη εντύπωση για μια εντολή που υπάρχει για
 * να δείχνει τι υπάρχει. Το ίδιο κάνει το Excel, με τη δική του λίστα· αυτή εδώ είναι οι
 * συναρτήσεις ενός πίνακα ποσοτήτων.
 */
const SEED_RECENT: readonly string[] = [
  'SUM', 'IF', 'AVERAGE', 'COUNT', 'ROUND', 'SUMIF', 'VLOOKUP', 'SUBTOTAL',
  'CONCATENATE', 'MAX',
];

const store = createExternalStore<readonly string[]>(SEED_RECENT);

/**
 * 🔴 Το `localStorage` διαβάζεται **τεμπέλικα** — ίδιο σκεπτικό με το
 * `table-toolbar-color-store.ts`: ο κώδικας τρέχει και στον server (Next.js), και μια ανάγνωση
 * στην αρχικοποίηση του module θα έδινε στον server τη σπορά και στον client το αποθηκευμένο
 * ⇒ **hydration mismatch**. Η πρώτη ανάγνωση συμβαίνει σε χειρισμό συμβάντος ή σε effect.
 */
let hydrated = false;

function sanitize(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return SEED_RECENT;
  const names = raw.filter((name): name is string => typeof name === 'string');
  // Απο-διπλασιασμός **μετά** το φιλτράρισμα τύπου: ένα αλλοιωμένο κλειδί με δύο ίδια ονόματα
  // θα έδειχνε την ίδια συνάρτηση δύο φορές στη λίστα, που μοιάζει με σφάλμα απόδοσης.
  return [...new Set(names)].slice(0, MAX_RECENT);
}

function hydrateOnce(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const stored = storageGet<unknown>(STORAGE_KEYS.FORMULA_RECENT_FUNCTIONS, null);
  // `null` = **δεν έχει γραφτεί ποτέ** ⇒ κράτα τη σπορά. Ένα άδειο αποθηκευμένο `[]` είναι
  // άλλο πράγμα (ο χρήστης το καθάρισε) και το σέβεται το `sanitize`.
  if (stored === null) return;
  store.set(sanitize(stored));
}

/** Η λίστα **τη στιγμή της κλήσης** — για χειριστές συμβάντων (ADR-040: getter, όχι στιγμιότυπο). */
export function getRecentFormulaFunctions(): readonly string[] {
  hydrateOnce();
  return store.get();
}

/** Συνδρομή για φύλλα React. Συχνότητα: μία γραφή ανά εισαγωγή συνάρτησης — ανθρώπινη. */
export function subscribeRecentFormulaFunctions(listener: () => void): () => void {
  hydrateOnce();
  return store.subscribe(listener);
}

/**
 * Το snapshot του server — **η σπορά**, ώστε οι δύο αποδόσεις να συμφωνούν.
 *
 * Χωρίς αυτό το `useSyncExternalStore` θα καλούσε τον client getter κατά την απόδοση στον
 * server, δηλαδή θα άγγιζε το `localStorage` εκεί που δεν υπάρχει.
 */
export function getRecentFormulaFunctionsServerSnapshot(): readonly string[] {
  return SEED_RECENT;
}

/**
 * Θυμήσου ότι ο χρήστης εισήγαγε αυτή τη συνάρτηση: μπροστά, χωρίς διπλότυπο, με έξωση της
 * παλαιότερης πάνω από το όριο.
 *
 * Ιδεμποτής ως προς τη **σειρά**: δεύτερη κλήση με το ίδιο όνομα αφήνει τη λίστα ίδια, γιατί
 * ήταν ήδη πρώτο.
 */
export function rememberFormulaFunction(name: string): void {
  hydrateOnce();
  const current = store.get();
  const next = [name, ...current.filter((existing) => existing !== name)].slice(0, MAX_RECENT);
  if (next.length === current.length && next.every((item, index) => item === current[index])) {
    return;
  }
  store.set(next);
  storageSet(STORAGE_KEYS.FORMULA_RECENT_FUNCTIONS, next);
}

/** Test helper — μηδενίζει και τη σημαία ενυδάτωσης, αλλιώς το επόμενο test κληρονομεί. */
export function __resetFormulaMruForTests(): void {
  hydrated = false;
  store.set(SEED_RECENT);
}
