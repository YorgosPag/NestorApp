/**
 * ADR-763 §3 — **η σημαία `documented` δεν επιτρέπεται να λέει ψέματα.**
 *
 * 🔴 Χωρίς αυτό το test, ένα όνομα στη `DOCUMENTED_FUNCTION_NAMES` χωρίς κλειδί στα locale θα
 * έβαφε `table.insertFunction.help.AVEDEV` **μέσα στον διάλογο** — ωμό κλειδί στην οθόνη, το
 * ακριβές σφάλμα που απαγορεύει ο N.11 και που κανένας στατικός σαρωτής δεν πιάνει εδώ (το
 * κλειδί χτίζεται δυναμικά από το όνομα).
 *
 * Ανοίγει τα **πραγματικά** JSON και στις δύο γλώσσες, γιατί το σφάλμα «υπάρχει στα ελληνικά,
 * λείπει στα αγγλικά» είναι ακριβώς αυτό που παρήγαγε τις δύο αποκλίνουσες λίστες namespace
 * του CHECK 3.34.
 *
 * @see src/i18n/locales/el/dxf-viewer.json — `table.insertFunction`
 */

import el from '@/i18n/locales/el/dxf-viewer.json';
import en from '@/i18n/locales/en/dxf-viewer.json';
import { FORMULA_CATALOG } from '../formula/catalog/formula-catalog';
import {
  FORMULA_CATEGORY_FILTERS,
  formulaCatalogKey,
} from '../formula/catalog/formula-catalog-taxonomy';

type Bundle = {
  readonly args: Record<string, string>;
  readonly help: Record<string, string>;
  readonly category: Record<string, string>;
} & Record<string, unknown>;

const LOCALES: ReadonlyArray<readonly [string, Bundle]> = [
  ['el', (el as { table: { insertFunction: Bundle } }).table.insertFunction],
  ['en', (en as { table: { insertFunction: Bundle } }).table.insertFunction],
];

const DOCUMENTED = FORMULA_CATALOG.filter((entry) => entry.documented);

/** Τα κλειδιά του κελύφους — ό,τι ΔΕΝ είναι ανά συνάρτηση. */
const SHELL_KEYS: readonly string[] = [
  'title', 'searchLabel', 'searchPlaceholder', 'go', 'categoryLabel', 'listLabel',
  'listAriaLabel', 'ok', 'cancel', 'close', 'empty', 'undocumented', 'unknownArgs',
  'openAriaLabel', 'acceptAriaLabel', 'rejectAriaLabel',
];

describe('ADR-763 §3 — τεκμηρίωση συναρτήσεων στα δύο locale', () => {
  it.each(LOCALES)('%s: κάθε τεκμηριωμένη έχει ΚΑΙ υπογραφή ΚΑΙ περιγραφή', (_lang, bundle) => {
    const missing = DOCUMENTED
      .map((entry) => formulaCatalogKey(entry.name))
      .filter((key) => typeof bundle.args[key] !== 'string' || typeof bundle.help[key] !== 'string');
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('%s: καμία περιγραφή δεν είναι κενή', (_lang, bundle) => {
    const empty = DOCUMENTED
      .map((entry) => formulaCatalogKey(entry.name))
      .filter((key) => (bundle.help[key] ?? '').trim().length === 0);
    expect(empty).toEqual([]);
  });

  it.each(LOCALES)('%s: κανένα ορφανό κλειδί — τεκμηρίωση χωρίς συνάρτηση', (_lang, bundle) => {
    const documented = new Set(DOCUMENTED.map((entry) => formulaCatalogKey(entry.name)));
    expect(Object.keys(bundle.args).filter((key) => !documented.has(key))).toEqual([]);
    expect(Object.keys(bundle.help).filter((key) => !documented.has(key))).toEqual([]);
  });

  it.each(LOCALES)('%s: κάθε επιλογή του μενού κατηγοριών έχει ετικέτα', (_lang, bundle) => {
    for (const filter of FORMULA_CATEGORY_FILTERS) {
      expect(typeof bundle.category[filter]).toBe('string');
      expect((bundle.category[filter] ?? '').length).toBeGreaterThan(0);
    }
    expect(Object.keys(bundle.category).sort()).toEqual([...FORMULA_CATEGORY_FILTERS].sort());
  });

  it.each(LOCALES)('%s: το κέλυφος του διαλόγου είναι πλήρες', (_lang, bundle) => {
    for (const key of SHELL_KEYS) {
      expect(typeof bundle[key]).toBe('string');
    }
  });

  it('τα δύο locale έχουν ΑΚΡΙΒΩΣ τα ίδια κλειδιά — απόκλιση = ωμό κλειδί σε μία γλώσσα', () => {
    const [, greek] = LOCALES[0];
    const [, english] = LOCALES[1];
    expect(Object.keys(english.args).sort()).toEqual(Object.keys(greek.args).sort());
    expect(Object.keys(english.help).sort()).toEqual(Object.keys(greek.help).sort());
  });

  it('η υπογραφή δεν περιέχει άγκιστρα — θα τα διάβαζε ο ICU ως μεταβλητή (CHECK 3.9)', () => {
    for (const [, bundle] of LOCALES) {
      for (const value of [...Object.values(bundle.args), ...Object.values(bundle.help)]) {
        expect(value).not.toMatch(/[{}]/);
      }
    }
  });
});
