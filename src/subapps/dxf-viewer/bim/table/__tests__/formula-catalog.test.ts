/**
 * ADR-763 §4 — **η πύλη πληρότητας του καταλόγου**.
 *
 * Ίδιο σχήμα με το `formula-library-manifest.test.ts` του §49, και για τον ίδιο λόγο: μια
 * «ανεκτή απόκλιση» εδώ θα σήμαινε ότι κάποια συνάρτηση δεν κοιτάχτηκε ποτέ. **Καμία baseline.**
 *
 * @see bim/table/formula/catalog/formula-catalog.ts
 */

import {
  FORMULA_CATALOG,
  FORMULA_CATALOG_BY_NAME,
  duplicateCatalogNames,
  orphanDocumentedNames,
  phantomCatalogNames,
  uncataloguedFunctionNames,
} from '../formula/catalog/formula-catalog';
import {
  DOCUMENTED_FUNCTION_NAMES,
  FORMULA_CATEGORY_MEMBERS,
} from '../formula/catalog/formula-catalog-data';
import {
  FORMULA_CATEGORIES,
  FORMULA_CATEGORY_FILTERS,
  formulaCatalogKey,
} from '../formula/catalog/formula-catalog-taxonomy';
import { TABLE_FORMULA_FUNCTIONS } from '../formula/table-formula-functions';
import { TABLE_FORMULA_SPECIAL_FORMS } from '../formula/table-formula-special-forms';

describe('ADR-763 §4 — πληρότητα καταλόγου συναρτήσεων', () => {
  it('καμία καλέσιμη δεν λείπει από τον κατάλογο', () => {
    // Αν σπάσει: μια συνάρτηση **δουλεύει** αλλά δεν ανακαλύπτεται από πουθενά. Πρόσθεσέ την
    // σε μία κατηγορία του `formula-catalog-data.ts` — μην αφαιρέσεις τον έλεγχο.
    expect(uncataloguedFunctionNames()).toEqual([]);
  });

  it('καμία εγγραφή του καταλόγου δεν δείχνει σε ανύπαρκτη συνάρτηση', () => {
    // Αν σπάσει: ο διάλογος θα διαφήμιζε όνομα που δίνει `#NAME?`. Ο πιο πιθανός λόγος είναι η
    // γραφή Excel — `CEILINGMATH` αντί για `CEILING.MATH` (δες `EXCEL_NAME_OVERRIDES`).
    expect(phantomCatalogNames()).toEqual([]);
  });

  it('κανένα όνομα δεν ανήκει σε δύο κατηγορίες', () => {
    expect(duplicateCatalogNames()).toEqual([]);
  });

  it('κάθε τεκμηριωμένο όνομα υπάρχει στον κατάλογο', () => {
    expect(orphanDocumentedNames()).toEqual([]);
  });

  it('ο κατάλογος καλύπτει ΑΚΡΙΒΩΣ την ένωση των δύο μητρώων κλήσης', () => {
    const callable = new Set([
      ...Object.keys(TABLE_FORMULA_FUNCTIONS),
      ...Object.keys(TABLE_FORMULA_SPECIAL_FORMS),
    ]);
    expect(FORMULA_CATALOG).toHaveLength(callable.size);
    for (const entry of FORMULA_CATALOG) expect(callable.has(entry.name)).toBe(true);
  });

  it('κάθε εγγραφή ανήκει σε δηλωμένη κατηγορία', () => {
    for (const entry of FORMULA_CATALOG) {
      expect(FORMULA_CATEGORIES).toContain(entry.category);
    }
  });

  it('η λίστα είναι αλφαβητική — η σειρά είναι αυτή που βλέπει ο χρήστης', () => {
    const names = FORMULA_CATALOG.map((entry) => entry.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('το ευρετήριο ονομάτων συμφωνεί με τη λίστα', () => {
    expect(FORMULA_CATALOG_BY_NAME.size).toBe(FORMULA_CATALOG.length);
    expect(FORMULA_CATALOG_BY_NAME.get('SUM')?.category).toBe('mathTrig');
    expect(FORMULA_CATALOG_BY_NAME.get('VLOOKUP')?.category).toBe('lookup');
    expect(FORMULA_CATALOG_BY_NAME.get('IF')?.category).toBe('logical');
    expect(FORMULA_CATALOG_BY_NAME.get('STDEV')?.category).toBe('compatibility');
  });

  it('η σημαία `documented` παράγεται από τη λίστα και όχι από εικασία', () => {
    const documented = new Set(DOCUMENTED_FUNCTION_NAMES);
    for (const entry of FORMULA_CATALOG) {
      expect(entry.documented).toBe(documented.has(entry.name));
    }
    expect(FORMULA_CATALOG.filter((entry) => entry.documented)).toHaveLength(documented.size);
  });

  it('καμία κατηγορία δεν είναι άδεια — μια άδεια θα ήταν νεκρή επιλογή στο μενού', () => {
    for (const category of FORMULA_CATEGORIES) {
      expect(FORMULA_CATEGORY_MEMBERS[category].length).toBeGreaterThan(0);
    }
  });

  it('τα φίλτρα είναι οι δύο εικονικές επιλογές συν όλες οι κατηγορίες, με τη σειρά του Excel', () => {
    expect(FORMULA_CATEGORY_FILTERS).toEqual(['recent', 'all', ...FORMULA_CATEGORIES]);
  });

  it('το κλειδί i18n ισοπεδώνει την τελεία — αλλιώς ο i18next θα την έβλεπε ως ένθεση', () => {
    expect(formulaCatalogKey('CHISQ.DIST')).toBe('CHISQ_DIST');
    expect(formulaCatalogKey('NORM.S.INV')).toBe('NORM_S_INV');
    expect(formulaCatalogKey('SUM')).toBe('SUM');
  });
});
