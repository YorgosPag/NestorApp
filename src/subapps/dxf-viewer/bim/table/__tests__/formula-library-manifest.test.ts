/**
 * ADR-739 §48 — **Η ΠΥΛΗ**: η διαμέριση της βιβλιοθήκης είναι πλήρης, καλέσιμη και
 * ντετερμινιστική.
 *
 * ## Γιατί είναι δοκιμή και όχι σαρωτής κειμένου
 * Το manifest είναι TypeScript. Ένας κόμβος-σαρωτής θα έπρεπε να το διαβάσει με regex —
 * ακριβώς η παγίδα που έχει ήδη πληρώσει αυτό το repo (CHECK 3.36: «το `parseConstArray`
 * είναι regex — γέννησε φάντασμα namespace»). Εδώ το διαβάζει ο **μεταγλωττιστής**, δηλαδή ο
 * μόνος αναγνώστης που δεν μπορεί να διαφωνήσει με τον κώδικα που εκτελείται.
 *
 * ## Τι θα πιάσει που τίποτε άλλο δεν πιάνει
 * Αναβάθμιση της βιβλιοθήκης σε 5.x που προσθέτει **νέα μη ντετερμινιστική** συνάρτηση: δεν
 * ανήκει σε κανέναν κάδο ⇒ κόκκινο, δηλαδή αναγκαστική ανθρώπινη απόφαση. **Καμία baseline:**
 * μια «ανεκτή απόκλιση» εδώ θα σήμαινε ακριβώς ότι κάποια συνάρτηση δεν κοιτάχτηκε ποτέ.
 */

import * as formulajs from '@formulajs/formulajs';
import { TABLE_FORMULA_FUNCTIONS } from '../formula/table-formula-functions';
import { TABLE_FORMULA_SPECIAL_FORMS } from '../formula/table-formula-special-forms';
import {
  ADMITTED_BY_EXCEL_NAME,
  EXPLAINED_REFUSAL_BY_EXCEL_NAME,
  FORMULA_LIBRARY_MANIFEST,
} from '../formula/library/formula-library-manifest';
import { REJECTED_LIBRARY_PATHS } from '../formula/library/formula-library-rejected';
import { resolveLibraryCallable } from '../formula/library/formula-library-registry';
import { FORMULA_LIBRARY_REJECTIONS } from '../formula/library/formula-library-taxonomy';
import type { TableFormulaArgument } from '../formula/table-formula-value';

/**
 * Η **πραγματική** επιφάνεια της βιβλιοθήκης, με αναδρομή στους ένθετους χώρους ονομάτων.
 *
 * Η αναδρομή δεν είναι υπερβολή: το `NORM.S.DIST` ζει σε **τρίτο** επίπεδο, και μια σάρωση
 * ενός επιπέδου θα το κατέγραφε ως «μη συνάρτηση» — δηλαδή θα έκρυβε δύο υπαρκτές συναρτήσεις
 * και θα κατηγορούσε το manifest για λάθος που δεν έκανε.
 */
function libraryPaths(source: Readonly<Record<string, unknown>>, prefix = ''): string[] {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    // `utils` = εργαλειοθήκη, όχι συνάρτηση τύπου. `default` = η γέφυρα CommonJS του
    // μεταγλωττιστή, που **ξαναεκθέτει τα ίδια ακριβώς** ονόματα ένα επίπεδο πιο μέσα· χωρίς
    // αυτή την εξαίρεση κάθε συνάρτηση θα μετριόταν δύο φορές, με πρόθεμα που δεν πληκτρολογεί
    // κανείς. (Δεν εμφανίζεται σε καθαρό ESM — μόνο κάτω από τη μεταγλώττιση των δοκιμών.)
    if (prefix === '' && (key === 'utils' || key === 'default')) return [];
    if (typeof value === 'function') return [path];
    if (value !== null && typeof value === 'object') {
      return libraryPaths(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

const SURFACE = libraryPaths(formulajs as unknown as Record<string, unknown>).sort();

/**
 * **Κανάρι**: αν η σάρωση σαρώσει το τίποτα, όλοι οι έλεγχοι πληρότητας γίνονται πράσινοι
 * χωρίς να έχουν κοιτάξει τίποτα. Είναι το ίδιο σχήμα που έχει πληρώσει το repo τέσσερις
 * φορές («0 σημαίνει *κανείς δεν κοίταξε*, όχι *καθαρό*»). Οι δύο εξαιρέσεις παραπάνω το
 * κάνουν ρεαλιστικό: μια μετονομασία του `default` σε κάτι άλλο θα άδειαζε τη σάρωση.
 */
describe('κανάρι της σάρωσης', () => {
  it('η επιφάνεια δεν είναι άδεια και περιέχει γνωστά ονόματα', () => {
    expect(SURFACE.length).toBeGreaterThan(400);
    expect(SURFACE).toContain('VLOOKUP');
    expect(SURFACE).toContain('NORM.S.DIST');
    expect(SURFACE.filter((path) => path.startsWith('default.'))).toEqual([]);
  });
});

describe('πληρότητα της διαμέρισης', () => {
  it('🔑 κάθε εξαγωγή της βιβλιοθήκης έχει ετυμηγορία — καμία σιωπηλή παράλειψη', () => {
    const withoutVerdict = SURFACE.filter((path) => !FORMULA_LIBRARY_MANIFEST.has(path));
    expect(withoutVerdict).toEqual([]);
  });

  it('🔑 καμία ετυμηγορία για εξαγωγή που δεν υπάρχει — κανένα φάντασμα', () => {
    const onSurface = new Set(SURFACE);
    const orphans = [...FORMULA_LIBRARY_MANIFEST.keys()].filter((path) => !onSurface.has(path));
    expect(orphans).toEqual([]);
  });

  it('καμία διαδρομή σε δύο κάδους απόρριψης ταυτόχρονα', () => {
    const seen = new Set<string>();
    const twice: string[] = [];
    for (const paths of Object.values(REJECTED_LIBRARY_PATHS)) {
      for (const path of paths) {
        if (seen.has(path)) twice.push(path);
        seen.add(path);
      }
    }
    expect(twice).toEqual([]);
  });

  it('κάθε αιτία της ταξινομίας έχει λίστα — μια ετικέτα χωρίς περιεχόμενο είναι σχόλιο', () => {
    for (const reason of FORMULA_LIBRARY_REJECTIONS) {
      expect(REJECTED_LIBRARY_PATHS[reason]).toBeDefined();
    }
  });
});

describe('οι εγκεκριμένες είναι όντως καλέσιμες', () => {
  it('🔴 κάθε εγκεκριμένη διαδρομή δίνει συνάρτηση (πιάνει STDEV/MODE/ERFPRECISE)', () => {
    const broken = [...ADMITTED_BY_EXCEL_NAME].filter(
      ([, admitted]) => resolveLibraryCallable(admitted.path) === null,
    );
    expect(broken.map(([name]) => name)).toEqual([]);
  });

  it('κάθε εγκεκριμένο όνομα Excel υπάρχει στο μητρώο', () => {
    const missing = [...ADMITTED_BY_EXCEL_NAME.keys()].filter(
      (name) => TABLE_FORMULA_FUNCTIONS[name] === undefined,
    );
    expect(missing).toEqual([]);
  });

  it('τα παλαιά ψευδώνυμα δείχνουν στην ίδια υλοποίηση — δεν μπορούν να αποκλίνουν', () => {
    expect(ADMITTED_BY_EXCEL_NAME.get('STDEV')?.path).toBe('STDEV.S');
    expect(ADMITTED_BY_EXCEL_NAME.get('MODE')?.path).toBe('MODE.SNGL');
    expect(ADMITTED_BY_EXCEL_NAME.get('VAR')?.path).toBe('VAR.S');
  });
});

describe('οι απορριφθείσες δεν μπαίνουν από την πίσω πόρτα', () => {
  it('🔑 καμία μη ντετερμινιστική δεν είναι καλέσιμη από τύπο', () => {
    for (const name of ['NOW', 'TODAY', 'RAND', 'RANDBETWEEN']) {
      expect(TABLE_FORMULA_FUNCTIONS[name]).toBeUndefined();
      expect(TABLE_FORMULA_SPECIAL_FORMS[name]).toBeUndefined();
    }
  });

  it('καμία που επιστρέφει πίνακα, ούτε καμία αδιαφανής στον γράφο', () => {
    for (const name of ['TRANSPOSE', 'SORT', 'UNIQUE', 'ROW', 'COLUMN', 'ROWS', 'COLUMNS']) {
      expect(TABLE_FORMULA_FUNCTIONS[name]).toBeUndefined();
    }
  });

  it('οι ειδικές μορφές ΔΕΝ ζουν και στο μητρώο — μία σημασιολογία αξιολόγησης', () => {
    for (const name of Object.keys(TABLE_FORMULA_SPECIAL_FORMS)) {
      expect(TABLE_FORMULA_FUNCTIONS[name]).toBeUndefined();
    }
  });

  it('εξηγούνται μόνο όσες ο χρήστης δεν θα βρει — όχι όσες δουλεύουν', () => {
    expect(EXPLAINED_REFUSAL_BY_EXCEL_NAME.get('TODAY')).toBe('volatile');
    expect(EXPLAINED_REFUSAL_BY_EXCEL_NAME.get('SORT')).toBe('array-result');
    // Η `SUM` και η `IF` υπάρχουν και δουλεύουν: μήνυμα «δεν είναι διαθέσιμη» θα ήταν ψέμα.
    expect(EXPLAINED_REFUSAL_BY_EXCEL_NAME.has('SUM')).toBe(false);
    expect(EXPLAINED_REFUSAL_BY_EXCEL_NAME.has('IF')).toBe(false);
  });
});

/**
 * Η **απόδειξη** του ντετερμινισμού — ελέγχει την ιδιότητα, όχι τη λίστα ονομάτων.
 *
 * Μια λίστα απαγορευμένων ονομάτων προστατεύει μόνο από όσα ονόματα ήξερε αυτός που την
 * έγραψε. Αυτό εδώ ρωτά κάθε εγκεκριμένη συνάρτηση **δύο φορές με τα ίδια ορίσματα** και
 * απαιτεί την ίδια απάντηση: μια `RAND` που θα μετονομαζόταν αύριο θα έπεφτε πάνω του χωρίς
 * να χρειαστεί κανείς να το προβλέψει. Ούτε το Excel ούτε το Revit αποδεικνύουν κάτι τέτοιο —
 * το τεκμηριώνουν.
 */
describe('🔑 απόδειξη ντετερμινισμού (ADR-739 §48)', () => {
  const PROBES: readonly (readonly TableFormulaArgument[])[] = [
    [],
    [{ kind: 'value', value: 2 }],
    [{ kind: 'value', value: 2 }, { kind: 'value', value: 3 }],
    [{ kind: 'value', value: 2 }, { kind: 'value', value: 3 }, { kind: 'value', value: 4 }],
    [{ kind: 'list', values: [1, 2, 3, 4], rows: 2, cols: 2 }, { kind: 'value', value: 2 }],
    [{ kind: 'value', value: 'άλφα' }, { kind: 'value', value: 1 }],
  ];

  it('κάθε εγγραφή του μητρώου δίνει το ίδιο αποτέλεσμα δύο φορές', () => {
    const unstable: string[] = [];
    for (const [name, entry] of Object.entries(TABLE_FORMULA_FUNCTIONS)) {
      for (const probe of PROBES) {
        if (!Object.is(entry.call(probe), entry.call(probe))) unstable.push(name);
      }
    }
    expect([...new Set(unstable)]).toEqual([]);
  });

  it('καμία εγγραφή δεν πετά — ένας τύπος δεν ρίχνει τον επαναϋπολογισμό', () => {
    const thrown: string[] = [];
    for (const [name, entry] of Object.entries(TABLE_FORMULA_FUNCTIONS)) {
      for (const probe of PROBES) {
        try {
          entry.call(probe);
        } catch {
          thrown.push(name);
        }
      }
    }
    expect([...new Set(thrown)]).toEqual([]);
  });
});
