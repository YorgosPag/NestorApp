/**
 * @fileoverview **Κάθε κωδικός ευρήματος φτάνει στην οθόνη με τη ΔΙΚΗ του λέξη** (ADR-923 §5.10.4 · N.11).
 *
 * Η άγκυρα `catalog-issue-labels.test.ts` αποδεικνύει ότι κάθε κωδικός έχει ετικέτα στα locale. Δεν αποδεικνύει ότι η
 * οθόνη **τη ζητά**: ο χάρτης `ISSUE_KEYS` είναι ο δρόμος από τον κωδικό στο κλειδί. 🔴 Μετρημένο 2026-10-26: οι 8
 * κωδικοί της 2γ (`fileNotFound` … `renditionsFailed`) είχαν ετικέτες σε el/en αλλά **καμία** γραμμή στον χάρτη ⇒ το
 * `FieldIssues` θα καλούσε `t(undefined)` — και κανένα test δεν κοκκίνιζε, γιατί το `tsc` δεν τρέχει σε κάθε αλλαγή.
 */

import { CATALOG_ISSUE_CODES } from '@/subapps/catalog/schema/catalog-issues';
import { ISSUE_KEYS } from '../catalog-labels';

jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));

describe('ISSUE_KEYS — ο δρόμος από τον κωδικό στη λέξη', () => {
  it.each(CATALOG_ISSUE_CODES.map((code) => [code]))('%s ⇒ issues.<κωδικός>', (code) => {
    expect(ISSUE_KEYS[code]).toBe(`issues.${code}`);
  });

  it('καμία γραμμή για κωδικό που δεν υπάρχει', () => {
    const known = new Set<string>(CATALOG_ISSUE_CODES);
    expect(Object.keys(ISSUE_KEYS).filter((code) => !known.has(code))).toEqual([]);
  });
});
