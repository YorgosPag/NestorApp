/**
 * ADR-739 §48 — **το manifest**: η μία διαμέριση της βιβλιοθήκης, συναρμολογημένη από τα δύο
 * αρχεία δεδομένων. Καθαρό module — **δεν φορτώνει τη βιβλιοθήκη**, ώστε η πληρότητα της
 * διαμέρισης να μπορεί να ελεγχθεί χωριστά από τη σύνδεσή της.
 *
 * Απαντά σε τρεις ερωτήσεις, καθεμιά με έναν καταναλωτή:
 * 1. «Ποιες διαδρομές μπαίνουν στο μητρώο και πώς;» → `formula-library-registry.ts`
 * 2. «Έχει κάθε εξαγωγή ετυμηγορία;» → η πύλη πληρότητας
 * 3. «Γιατί λείπει το `TODAY`;» → ο επεξεργαστής, όταν εξηγεί στον χρήστη
 *
 * @module subapps/dxf-viewer/bim/table/formula/library/formula-library-manifest
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §48
 */

import {
  ADMITTED_LIBRARY_PATHS,
  EXCEL_NAME_OVERRIDES,
  GRID_SHAPED_LIBRARY_PATHS,
  LEGACY_EXCEL_ALIASES,
} from './formula-library-admitted';
import { REJECTED_LIBRARY_PATHS } from './formula-library-rejected';
import type {
  FormulaLibraryRejection,
  FormulaLibraryShape,
  FormulaLibraryVerdict,
} from './formula-library-taxonomy';

/** Το όνομα που πληκτρολογεί ο χρήστης για μια διαδρομή της βιβλιοθήκης. */
export function excelNameOf(path: string): string {
  return EXCEL_NAME_OVERRIDES[path] ?? path;
}

const GRID_PATHS: ReadonlySet<string> = new Set(GRID_SHAPED_LIBRARY_PATHS);

const shapeOf = (path: string): FormulaLibraryShape => (GRID_PATHS.has(path) ? 'grid' : 'flat');

/**
 * Η ετυμηγορία **κάθε** εξαγωγής, με κλειδί τη διαδρομή στη βιβλιοθήκη.
 *
 * Η πύλη πληρότητας συγκρίνει τα κλειδιά αυτού του χάρτη με την πραγματική επιφάνεια της
 * βιβλιοθήκης: ίσα σύνολα ή κόκκινο. Δεν υπάρχει τρίτη κατάσταση, και **δεν υπάρχει
 * baseline** — μια «ανεκτή απόκλιση» εδώ θα σήμαινε ότι κάποια συνάρτηση δεν κοιτάχτηκε ποτέ.
 */
export const FORMULA_LIBRARY_MANIFEST: ReadonlyMap<string, FormulaLibraryVerdict> = new Map([
  ...ADMITTED_LIBRARY_PATHS.map(
    (path): readonly [string, FormulaLibraryVerdict] => [
      path,
      { kind: 'admit', excel: excelNameOf(path), shape: shapeOf(path) },
    ],
  ),
  ...Object.entries(REJECTED_LIBRARY_PATHS).flatMap(([reason, paths]) =>
    paths.map(
      (path): readonly [string, FormulaLibraryVerdict] => [
        path,
        { kind: 'reject', reason: reason as FormulaLibraryRejection, excel: excelNameOf(path) },
      ],
    ),
  ),
]);

/** Μια εγγραφή του μητρώου, όπως τη ζητά ο κατασκευαστής του. */
export interface AdmittedLibraryFunction {
  /** Η διαδρομή μέσα στη βιβλιοθήκη (με τελείες για ένθετους χώρους ονομάτων). */
  readonly path: string;
  readonly shape: FormulaLibraryShape;
}

/**
 * Όνομα Excel → η εγκεκριμένη υλοποίησή του, **μαζί με τα παλαιά ψευδώνυμα**.
 *
 * Ένα ψευδώνυμο δείχνει στην **ίδια** διαδρομή, οπότε `=STDEV(A1:A9)` και
 * `=STDEV.S(A1:A9)` δεν μπορούν ποτέ να δώσουν διαφορετικό αριθμό.
 */
export const ADMITTED_BY_EXCEL_NAME: ReadonlyMap<string, AdmittedLibraryFunction> = new Map([
  ...ADMITTED_LIBRARY_PATHS.map(
    (path): readonly [string, AdmittedLibraryFunction] => [
      excelNameOf(path),
      { path, shape: shapeOf(path) },
    ],
  ),
  ...Object.entries(LEGACY_EXCEL_ALIASES).flatMap(([path, aliases]) =>
    aliases.map(
      (alias): readonly [string, AdmittedLibraryFunction] => [
        alias,
        { path, shape: shapeOf(path) },
      ],
    ),
  ),
]);

/**
 * Οι αιτίες που έχει νόημα να **εξηγηθούν στον χρήστη**.
 *
 * 🔴 Οι `native` και `special-form` **δεν** είναι εδώ, και αυτό δεν είναι παράλειψη: αυτές οι
 * συναρτήσεις **δουλεύουν κανονικά** — απλώς τις υλοποιεί ο πίνακας αντί για τη βιβλιοθήκη.
 * Ένα μήνυμα «η SUM δεν είναι διαθέσιμη» θα ήταν ψέμα που το ίδιο το κελί διαψεύδει.
 * Η `duplicate` επίσης λείπει: το κανονικό όνομα υπάρχει και δουλεύει.
 */
const EXPLAINED_REJECTIONS: ReadonlySet<FormulaLibraryRejection> = new Set<FormulaLibraryRejection>(
  ['volatile', 'graph-opaque', 'array-result', 'locale-unsafe'],
);

/**
 * Όνομα Excel → η αιτία που **δεν** θα το βρει ο χρήστης, ή `undefined` όταν δεν χρειάζεται
 * εξήγηση. Ο επεξεργαστής το ρωτά με ό,τι πληκτρολογήθηκε.
 */
export const EXPLAINED_REFUSAL_BY_EXCEL_NAME: ReadonlyMap<string, FormulaLibraryRejection> =
  new Map(
    Object.entries(REJECTED_LIBRARY_PATHS)
      .filter(([reason]) => EXPLAINED_REJECTIONS.has(reason as FormulaLibraryRejection))
      .flatMap(([reason, paths]) =>
        paths.map(
          (path): readonly [string, FormulaLibraryRejection] => [
            excelNameOf(path),
            reason as FormulaLibraryRejection,
          ],
        ),
      ),
  );
