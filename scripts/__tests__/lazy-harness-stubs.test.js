/**
 * ADR-280 §11.8 Β4.3 — οι σελίδες δοκιμών φορτώνουν το harness τους από το μητρώο (`src/utils/lazyHarnessRoutes.tsx`),
 * και το **stub παραγωγής** του `next.config.js` (`harnessStubs`) πρέπει να εξακολουθεί να το πιάνει.
 *
 * 🔴 Γιατί υπάρχει: το alias έχει κλειδί το **απόλυτο** `<dir>/<name>.tsx`. Αν το `import()` του μητρώου δείξει σε άλλο
 * αρχείο (π.χ. ένα barrel ή μετακομισμένο harness), το alias αστοχεί **σιωπηλά** και όλο το δέντρο DXF/BIM μπαίνει στο
 * bundle παραγωγής — συνέβη ήδη μία φορά με στατικό import (2026-09-10, αποτυχία build). Το webpack εφαρμόζει το alias
 * και στο στάδιο `file` (μετά τη λύση του `@/…`), άρα αρκεί το spec να λύνεται στο ίδιο αρχείο.
 *
 * Μετάλλαξη: spec του `HarnessDxfCanvas` → `…/DxfCanvasHarness.module` ⇒ Η1 κοκκινίζει· σελίδα με στατικό import ⇒ Η2.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const { readRegistry } = require('../lib/i18n-shell-slice/lazy-registry-read');

const HARNESS_REGISTRY = 'src/utils/lazyHarnessRoutes.tsx';

/** Οι γραμμές `{ dir: '…', name: '…' }` του `harnessStubs` — το ίδιο κείμενο που διαβάζει το webpack config. */
function harnessStubs() {
  const source = fs.readFileSync(path.join(ROOT, 'next.config.js'), 'utf8');
  const block = source.slice(source.indexOf('const harnessStubs = ['), source.indexOf('for (const harness of harnessStubs)'));
  return [...block.matchAll(/dir:\s*'([^']+)',\s*name:\s*'([^']+)'/g)].map(([, dir, name]) => ({ dir, name }));
}

const specToFile = spec => `${spec.replace(/^@\//, 'src/')}.tsx`;

describe('Η — τα harness του μητρώου μένουν κάτω από το stub παραγωγής', () => {
  const entries = readRegistry(ROOT, HARNESS_REGISTRY);
  const stubs = harnessStubs();

  it('Η0: το μητρώο και ο πίνακας stubs διαβάζονται (καμία άγκυρα που δεν κοίταξε τίποτα)', () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(stubs.length).toBeGreaterThan(0);
  });

  it('Η1 🔴: κάθε εγγραφή που φορτώνει αρχείο φακέλου με stub λύνεται ΑΚΡΙΒΩΣ στο κλειδί του alias', () => {
    const covered = [];
    for (const entry of entries) {
      const stub = stubs.find(candidate => specToFile(entry.spec).startsWith(`${candidate.dir}/`));
      if (!stub) continue;
      covered.push(entry.key);
      expect(specToFile(entry.spec)).toBe(`${stub.dir}/${stub.name}.tsx`);
      expect(fs.existsSync(path.join(ROOT, stub.dir, `${stub.name}.prod.ts`))).toBe(true);
    }
    expect(covered.sort()).toEqual(['HarnessBim3D', 'HarnessDxfCanvas']);
  });

  it('Η2 🔴: η σελίδα ενός harness του μητρώου ΔΕΝ το εισάγει στατικά (αλλιώς το όριο χάνεται)', () => {
    for (const entry of entries) {
      const stub = stubs.find(candidate => specToFile(entry.spec) === `${candidate.dir}/${candidate.name}.tsx`);
      if (!stub) continue;
      const page = fs.readFileSync(path.join(ROOT, stub.dir, 'page.tsx'), 'utf8');
      expect(page).not.toMatch(new RegExp(`from\\s+['"]\\./${stub.name}['"]`));
      expect(page).toContain(`LazyHarnessRoutes.${entry.key}`);
    }
  });
});
