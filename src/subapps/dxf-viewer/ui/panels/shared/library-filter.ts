/**
 * ADR-652 M3 — Το φιλτράρισμα μιας βιβλιοθήκης περιεχομένου (pure SSoT).
 *
 * Κάθε content browser των μεγάλων (Revit family browser, ArchiCAD Library Manager, Figma
 * assets) έχει ΤΑ ΙΔΙΑ ΤΡΙΑ: αναζήτηση κειμένου + κατηγορία + «ποια βιβλιοθήκη» (scope).
 * Εδώ ζει ΜΙΑ φορά αυτός ο κανόνας — τον καταναλώνουν και το palette των block (ADR-652)
 * και το panel των υλικών (ADR-363 §6.5), αντί για δύο πανομοιότυπα `useMemo` φίλτρα
 * (N.18: όχι sibling clone).
 *
 * Pure + agnostic: ο καλών λέει ΠΟΙΑ ονόματα ψάχνονται (ένα υλικό έχει el+en όνομα, ένα
 * block έχει όνομα + i18n ετικέτα), και δίνει την κατηγορία/scope του αντικειμένου ως
 * strings. Καμία γνώση domain εδώ.
 *
 * @see ./LibraryFilterBar.tsx — το UI που παράγει το {@link LibraryFilterState}
 */

/** Η τιμή «όλα» — κοινή για κατηγορία και scope (και τα δύο dropdowns/chips). */
export const LIBRARY_FILTER_ALL = 'all';

export interface LibraryFilterState {
  /** Ελεύθερο κείμενο· κενό = χωρίς περιορισμό. */
  readonly query: string;
  /** Κατηγορία ή {@link LIBRARY_FILTER_ALL}. */
  readonly category: string;
  /** Scope/βιβλιοθήκη ή {@link LIBRARY_FILTER_ALL}. */
  readonly scope: string;
}

/** Το αρχικό (καθαρό) φίλτρο — τίποτα δεν κρύβεται. */
export const EMPTY_LIBRARY_FILTER: LibraryFilterState = {
  query: '',
  category: LIBRARY_FILTER_ALL,
  scope: LIBRARY_FILTER_ALL,
};

/** Ό,τι χρειάζεται το φίλτρο για να κρίνει ένα αντικείμενο βιβλιοθήκης. */
export interface LibraryFilterSubject {
  /** Όλα τα ψάξιμα ονόματα (π.χ. `[nameEl, nameEn]` ή `[blockName, μεταφρασμένη ετικέτα]`). */
  readonly names: readonly (string | null | undefined)[];
  /** `null` όταν το αντικείμενο δεν έχει κατηγορία (π.χ. block της συνεδρίας). */
  readonly category: string | null;
  readonly scope: string;
}

/** Περνά το αντικείμενο το φίλτρο; (case-insensitive substring στο όνομα) */
export function matchesLibraryFilter(
  subject: LibraryFilterSubject,
  filter: LibraryFilterState,
): boolean {
  if (filter.category !== LIBRARY_FILTER_ALL && subject.category !== filter.category) {
    return false;
  }
  if (filter.scope !== LIBRARY_FILTER_ALL && subject.scope !== filter.scope) {
    return false;
  }

  const q = filter.query.trim().toLowerCase();
  if (!q) return true;

  return subject.names.some((name) => (name ?? '').toLowerCase().includes(q));
}
