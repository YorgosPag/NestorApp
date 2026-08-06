/**
 * ADR-763 §6 — **φιλτράρισμα και κατάταξη της λίστας**.
 *
 * @see bim/table/formula/catalog/formula-catalog-search.ts
 */

import { queryFormulaCatalog } from '../formula/catalog/formula-catalog-search';
import type { FormulaCatalogEntry } from '../formula/catalog/formula-catalog-taxonomy';

const ENTRIES: readonly FormulaCatalogEntry[] = [
  { name: 'AVERAGE', category: 'statistical', documented: true },
  { name: 'COUNT', category: 'statistical', documented: true },
  { name: 'COUNTIF', category: 'statistical', documented: true },
  { name: 'COUNTIFS', category: 'statistical', documented: true },
  { name: 'DISCOUNT', category: 'financial', documented: false },
  { name: 'LEFT', category: 'text', documented: true },
  { name: 'SUM', category: 'mathTrig', documented: true },
];

const HELP: Readonly<Record<string, string>> = {
  SUM: 'Αθροίζει όλους τους αριθμούς μιας περιοχής κελιών.',
  LEFT: 'Επιστρέφει τους πρώτους χαρακτήρες ενός κειμένου.',
  AVERAGE: 'Επιστρέφει τον μέσο όρο των ορισμάτων.',
};

const describe_ = (name: string): string => HELP[name] ?? '';

const run = (
  category: Parameters<typeof queryFormulaCatalog>[0]['category'],
  query: string,
  recent: readonly string[] = [],
): readonly string[] =>
  queryFormulaCatalog({ entries: ENTRIES, category, query, recent, describe: describe_ })
    .map((entry) => entry.name);

describe('ADR-763 §6 — αναζήτηση καταλόγου', () => {
  it('«Όλες» χωρίς όρο ⇒ ολόκληρη η λίστα, αμετάβλητη', () => {
    expect(run('all', '')).toEqual(ENTRIES.map((entry) => entry.name));
  });

  it('κατηγορία χωρίς όρο ⇒ μόνο τα μέλη της', () => {
    expect(run('statistical', '')).toEqual(['AVERAGE', 'COUNT', 'COUNTIF', 'COUNTIFS']);
    expect(run('text', '')).toEqual(['LEFT']);
  });

  it('«Πιο πρόσφατη χρήση» κρατά τη ΣΕΙΡΑ ΧΡΗΣΗΣ, όχι την αλφαβητική', () => {
    expect(run('recent', '', ['LEFT', 'SUM', 'COUNT'])).toEqual(['LEFT', 'SUM', 'COUNT']);
  });

  it('πρόσφατο που δεν καλείται πια πετιέται αντί να διαφημιστεί ως #NAME?', () => {
    expect(run('recent', '', ['SUM', 'TODAY', 'COUNT'])).toEqual(['SUM', 'COUNT']);
  });

  it('🔴 ο όρος ΑΚΥΡΩΝΕΙ την κατηγορία — αλλιώς η αναζήτηση θα επέστρεφε κενό', () => {
    // «Κείμενο» + «SUM»: χωρίς την ακύρωση, μηδέν αποτελέσματα για συνάρτηση που υπάρχει.
    expect(run('text', 'SUM')).toEqual(['SUM']);
  });

  it('🔴 η ΑΚΡΙΒΗΣ αντιστοιχία προηγείται των παραλλαγών της', () => {
    // Αλφαβητικά το COUNTIF/COUNTIFS θα κρύβανε το COUNT — αυτό ακριβώς αποτρέπει η κατάταξη.
    expect(run('all', 'COUNT')).toEqual(['COUNT', 'COUNTIF', 'COUNTIFS', 'DISCOUNT']);
  });

  it('το πρόθεμα προηγείται της ενδιάμεσης εμφάνισης', () => {
    expect(run('all', 'COUN')).toEqual(['COUNT', 'COUNTIF', 'COUNTIFS', 'DISCOUNT']);
  });

  it('η αναζήτηση φτάνει στην ΠΕΡΙΓΡΑΦΗ — εκεί ζει η ελληνική λέξη', () => {
    expect(run('all', 'αθροίζει')).toEqual(['SUM']);
    expect(run('all', 'χαρακτήρες')).toEqual(['LEFT']);
  });

  it('η περιγραφή έρχεται ΜΕΤΑ από κάθε αντιστοιχία ονόματος', () => {
    // Ο όρος «ΜΕΣΟ» υπάρχει στην περιγραφή του AVERAGE και πουθενά ως όνομα.
    expect(run('all', 'μέσο όρο')).toEqual(['AVERAGE']);
  });

  it('πεζά/κεφαλαία και τονισμός δεν αλλάζουν το αποτέλεσμα', () => {
    expect(run('all', 'sum')).toEqual(['SUM']);
    expect(run('all', 'ΑΘΡΟΊΖΕΙ')).toEqual(run('all', 'αθροίζει'));
  });

  it('κενά γύρω από τον όρο αγνοούνται — αλλιώς μια επικόλληση θα μηδένιζε τη λίστα', () => {
    expect(run('all', '  SUM  ')).toEqual(['SUM']);
    expect(run('statistical', '   ')).toEqual(['AVERAGE', 'COUNT', 'COUNTIF', 'COUNTIFS']);
  });

  it('όρος χωρίς αντιστοιχία ⇒ κενή λίστα, όχι ολόκληρος ο κατάλογος', () => {
    expect(run('all', 'ΞΞΞ')).toEqual([]);
  });
});
