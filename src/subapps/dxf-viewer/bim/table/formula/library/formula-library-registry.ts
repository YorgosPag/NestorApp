/**
 * ADR-739 §49 — **ο κατασκευαστής των εγγραφών**: manifest + βιβλιοθήκη → συναρτήσεις του
 * μητρώου. Η μοναδική θέση ολόκληρου του repo που εισάγει το `@formulajs/formulajs`.
 *
 * ## Γιατί στατική εισαγωγή ολόκληρου του χώρου ονομάτων
 * Μετρημένο με πραγματικό bundling: **142,7 KB** ελαχιστοποιημένα / **44,8 KB** gzip για τα
 * πάντα, έναντι **73,5 KB / 25,1 KB** για **μία μόνο** συνάρτηση. Δηλαδή υπάρχει δάπεδο ~73 KB
 * (το `jstat` δεν σπάει σε κομμάτια) και οι υπόλοιπες 339 συναρτήσεις κοστίζουν **19,7 KB
 * gzip συνολικά**. Το δυναμικό φόρτωμα θα αγόραζε αυτά τα 19,7 KB με το τίμημα μιας
 * **ασύγχρονης κατάστασης μέσα στον επαναϋπολογισμό** — δηλαδή κελιά που δείχνουν άλλο
 * νούμερο ανάλογα με το πότε πρόλαβε να φορτώσει ένα κομμάτι κώδικα. Σε μηχανή της οποίας η
 * μόνη υπόσχεση είναι ο ντετερμινισμός, αυτή η ανταλλαγή δεν συζητιέται.
 *
 * @module subapps/dxf-viewer/bim/table/formula/library/formula-library-registry
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §49
 */

import * as formulajs from '@formulajs/formulajs';
import { FORMULA_ERROR, type TableFormulaFunction } from '../table-formula-value';
import { fromNativeResult, toNativeArguments } from './formula-library-bridge';
import { ADMITTED_BY_EXCEL_NAME } from './formula-library-manifest';

/**
 * Μια συνάρτηση της βιβλιοθήκης όπως την καλούμε: μεταβλητά ορίσματα, άγνωστο αποτέλεσμα.
 *
 * Η μετατροπή προς αυτόν τον τύπο είναι το **ένα** σημείο όπου δηλώνουμε στον μεταγλωττιστή
 * κάτι που δεν μπορεί να συμπεράνει: ότι μια τιμή που βρέθηκε με **διαδρομή συμβολοσειράς**
 * είναι καλέσιμη. Η εναλλακτική θα ήταν 340 ονομαστικές εισαγωγές — δηλαδή η ίδια λίστα, τρίτη
 * φορά, εκτός manifest και εκτός πύλης.
 */
type LibraryCallable = (...args: readonly unknown[]) => unknown;

/** Η τιμή σε μια διαδρομή με τελείες, ή `undefined` όταν η διαδρομή δεν υπάρχει. */
function valueAtPath(path: string): unknown {
  let current: unknown = formulajs;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Η καλέσιμη σε μια διαδρομή, ή `null` — δες {@link LibraryCallable}. */
export function resolveLibraryCallable(path: string): LibraryCallable | null {
  const value = valueAtPath(path);
  return typeof value === 'function' ? (value as LibraryCallable) : null;
}

/**
 * Το μητρώο της βιβλιοθήκης: **όνομα Excel → συνάρτηση**, χτισμένο **μόνο** από τις
 * εγκεκριμένες.
 *
 * 🔑 Η φρουρά `resolveLibraryCallable === null` δεν είναι αμυντικός θόρυβος: μετρημένο ότι
 * στην 4.6.1 τα `STDEV` και `MODE` είναι **αντικείμενα** και τα `ERFPRECISE`/`ERFCPRECISE`
 * είναι `undefined`. Χωρίς αυτήν, μια λάθος γραμμή στο manifest θα κατέγραφε μη-συνάρτηση και
 * θα κατέρρεε στην πρώτη κλήση — αντί να δώσει `#NAME?`, που είναι η **σωστή** απάντηση για
 * όνομα που δεν αντιστοιχεί σε υλοποίηση. Η πύλη πληρότητας το πιάνει στο commit· αυτό εδώ
 * είναι το δεύτερο σκέλος (N.7.2 #4).
 */
export const FORMULA_LIBRARY_FUNCTIONS: Readonly<Record<string, TableFormulaFunction>> =
  Object.fromEntries(
    [...ADMITTED_BY_EXCEL_NAME].flatMap(([excelName, admitted]) => {
      const callable = resolveLibraryCallable(admitted.path);
      if (callable === null) return [];

      const call: TableFormulaFunction = (args) => {
        const native = toNativeArguments(args, admitted.shape);
        // Η βιβλιοθήκη **επιστρέφει** σφάλματα, δεν τα πετά — αλλά ένα όρισμα εκτός των
        // παραδοχών της μπορεί να πετάξει. Ένας τύπος κελιού δεν επιτρέπεται να ρίξει τον
        // επαναϋπολογισμό ολόκληρου του πίνακα: γίνεται `#VALUE!`, όπως κάθε άλλη αστοχία.
        try {
          return fromNativeResult(callable(...native));
        } catch {
          return FORMULA_ERROR.value;
        }
      };

      return [[excelName, call] as const];
    }),
  );
