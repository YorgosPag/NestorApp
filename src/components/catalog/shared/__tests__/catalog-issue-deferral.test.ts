/**
 * ADR-744 §34 · ADR-923 — ΤΑ ΜΗΝΥΜΑΤΑ ΕΥΡΗΜΑΤΩΝ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ΔΕΝ ΤΑ ΠΛΗΡΩΝΕΙ ΤΟ ΠΡΩΤΟ ΚΑΡΕ.
 *
 * 🔴 Μετρημένο 2026-11-03: το slice της `/catalog/imports` ήταν 28.189 bytes, τα **19.652** `catalog.issues.*` — επειδή ο
 * πίνακας `κωδικός → κλειδί` ήταν στην κλειστότητα **κάθε** σελίδας καταλόγου. Τώρα ζει πίσω από `import()`.
 *
 * Δύο άγκυρες, γιατί σπάει με δύο τρόπους:
 *   1. **Η αιτία**: κάποιος εισάγει **στατικά** το module του πίνακα ⇒ ξαναμπαίνει στην κλειστότητα. Κοκκινίζει **χωρίς**
 *      γεννήτορα (το βλέπει αμέσως ο συγγραφέας του import).
 *   2. **Το αποτέλεσμα**: κάποιο slice καταλόγου περιέχει ξανά `issues` — από οποιονδήποτε δρόμο (π.χ. literal `t('issues.x')`
 *      σε πίνακα με υπολογισμένο δείκτη). Η φρεσκάδα των slices είναι δουλειά του CHECK 3.34.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../..');
const DEFERRED_MODULES = ['catalog-issue-keys', 'import-issue-keys'] as const;
/** Ό,τι μπορεί να μπει στην κλειστότητα σελίδας καταλόγου. */
const SCANNED = ['src/app', 'src/components', 'src/subapps/catalog', 'src/i18n', 'src/hooks', 'src/services/catalog'];
const ROUTES = path.join(ROOT, 'src/i18n/generated/routes');

function sourceFiles(dir: string): string[] {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(ts|tsx)$/.test(file) && !/(^|[\\/])__tests__[\\/]/.test(file))
    .map((file) => path.join(absolute, file));
}

/** `import … from '…/catalog-issue-keys'` ή `export … from` ή `require(…)` — ΟΧΙ `import('…')`. */
const staticEdge = (name: string) =>
  new RegExp(`(?:from\\s*|require\\(\\s*|^\\s*import\\s*)['"][^'"]*/${name}['"]`, 'm');

describe('ο πίνακας ευρημάτων φτάνει ΜΟΝΟ μέσω import()', () => {
  const files = SCANNED.flatMap(sourceFiles);

  it('σαρώνει πραγματικά αρχεία (όχι πράσινο επειδή δεν κοίταξε)', () => {
    expect(files.length).toBeGreaterThan(1000);
  });

  it.each(DEFERRED_MODULES)('κανένα στατικό import του %s', (name) => {
    const offenders = files.filter((file) => staticEdge(name).test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it.each(DEFERRED_MODULES)('το %s ζητείται με import() από ακριβώς έναν δηλωτή', (name) => {
    const dynamicEdge = new RegExp(`import\\(\\s*['"][^'"]*/${name}['"]\\s*\\)`);
    const declarers = files.filter((file) => dynamicEdge.test(fs.readFileSync(file, 'utf8')));
    expect(declarers).toHaveLength(1);
  });

  it('ο ανιχνευτής πιάνει στατικό import (αυτοέλεγχος)', () => {
    expect(staticEdge('catalog-issue-keys').test("import { ISSUE_KEYS } from './catalog-issue-keys';")).toBe(true);
    expect(staticEdge('catalog-issue-keys').test("export { ISSUE_KEYS } from '../shared/catalog-issue-keys';")).toBe(true);
    expect(staticEdge('catalog-issue-keys').test("  import('./catalog-issue-keys').then((m) => m.ISSUE_KEYS)")).toBe(false);
  });
});

describe('κανένα slice καταλόγου δεν κουβαλά ευρήματα', () => {
  const slices = fs.readdirSync(ROUTES).filter((file) => file.includes('catalog'));

  it('υπάρχουν slices καταλόγου να κριθούν', () => {
    expect(slices.length).toBeGreaterThanOrEqual(12);
  });

  it.each(slices)('%s: χωρίς `issues` στα catalog / catalog-import', (file) => {
    const slice = JSON.parse(fs.readFileSync(path.join(ROUTES, file), 'utf8')) as Record<string, Record<string, unknown>>;
    expect(slice.catalog?.issues).toBeUndefined();
    expect(slice['catalog-import']?.issues).toBeUndefined();
  });
});
