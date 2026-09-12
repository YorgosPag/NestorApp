/**
 * Άγκυρες της CHECK 3.80 — Η ΠΥΛΗ ΤΟΥ ΘΑΝΑΣΙΜΟΥ ΚΥΚΛΟΥ (ADR-858 Δ4).
 *
 * 🔴 **ΑΥΤΗ Η ΠΥΛΗ ΠΑΡΑΛΙΓΟ ΝΑ ΓΕΝΝΗΘΕΙ ΩΣ ΣΧΟΛΙΟ — ΔΥΟ ΦΟΡΕΣ.**
 *
 * Το self-test («επανάφερε το περιστατικό, ρώτησε την πύλη») έμεινε στον **ίδιο αριθμό**
 * δύο φορές, δηλαδή η πύλη ήταν **αδύνατο να πυροδοτήσει** πάνω στο ελάττωμα που τη γέννησε:
 *   1. Ο γράφος διάβαζε μόνο `import`, **όχι `export … from`** — και το σκιασμένο barrel
 *      ήταν **ΟΛΟ** re-exports, άρα καμία ακμή του δεν υπήρχε και το SCC δεν σχηματιζόταν.
 *   2. Το `parseImports` διάβαζε **σχόλια**: κάθε JSDoc `@example import { X } from '…'`
 *      γινόταν πραγματική ακμή ⇒ **5 στα 6** ευρήματα ήταν φαντάσματα.
 *
 * Και ένα τρίτο, ακρίβειας: οι `export function` **ανυψώνονται** (δεν έχουν TDZ) — χωρίς
 * αυτόν τον έλεγχο, **5 στα 6** ήταν ψευδώς θετικά.
 *
 * Τα Groups 1-3 καρφώνουν **ακριβώς** αυτά τα τρία, ώστε καμία «απλοποίηση» να μην τα
 * ξαναφέρει σιωπηλά.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const graph = require('../lib/module-init/graph');
const judge = require('../lib/module-init/judge');
const gate = require('../check-module-init');

const T = (name, text) => ({ name, text });

describe('CHECK 3.80 — Group 1: ο γράφος βλέπει ΚΑΘΕ runtime ακμή', () => {
  test('🔴 τα `export … from` είναι ακμές — χωρίς αυτό το barrel είναι αόρατο', () => {
    const specs = graph.parseImports('/x/index.ts', `
      export { SnapDebugLogger } from './loggers/SnapDebugLogger';
      export * from './core/types';
    `).map((i) => i.spec);
    expect(specs).toContain('./loggers/SnapDebugLogger');
    expect(specs).toContain('./core/types');
  });

  test('`export type { … } from` ΔΕΝ είναι ακμή (σβήνεται στη μεταγλώττιση)', () => {
    const specs = graph.parseImports('/x/a.ts', `export type { Foo } from './types';`).map((i) => i.spec);
    expect(specs).not.toContain('./types');
  });

  test('side-effect import είναι ακμή χωρίς ονόματα', () => {
    const found = graph.parseImports('/x/a.ts', `import './polyfill';`);
    expect(found).toEqual([{ spec: './polyfill', names: [] }]);
  });

  test('`import type` και inline `type X` δεν φέρνουν runtime ονόματα', () => {
    const [first] = graph.parseImports('/x/a.ts', `import type { A } from './a';`);
    expect(first).toBeUndefined();
    const [second] = graph.parseImports('/x/b.ts', `import { type A, B } from './b';`);
    expect(second.names).toEqual(['B']);
  });
});

describe('CHECK 3.80 — Group 2: τα ΣΧΟΛΙΑ δεν είναι κώδικας', () => {
  test('🔴 JSDoc `@example import { X } from …` ΔΕΝ γεννά ακμή', () => {
    const specs = graph.parseImports('/x/Spinner.tsx', `
      /**
       * @example import { Spinner } from '@/components/ui/spinner';
       */
      import React from 'react';
    `).map((i) => i.spec);
    expect(specs).not.toContain('@/components/ui/spinner');
  });

  test('σχόλιο γραμμής αγνοείται, κώδικας μετά από αυτό ΟΧΙ', () => {
    const specs = graph.parseImports('/x/a.ts', `
      // import { Dead } from './dead';
      import { Live } from './live';
    `).map((i) => i.spec);
    expect(specs).toEqual(['./live']);
  });

  test('⚠️ `//` ΜΕΣΑ σε συμβολοσειρά δεν κόβει κώδικα (γι\' αυτό δεν είναι regex)', () => {
    const stripped = graph.stripComments(`const url = 'https://x.dev'; import { A } from './a';`);
    expect(stripped).toContain("'https://x.dev'");
    expect(stripped).toContain("from './a'");
  });

  test('template literal με `${}` και `//` επιβιώνει', () => {
    const stripped = graph.stripComments('const u = `${base}//path`; const after = 1;');
    expect(stripped).toContain('//path');
    expect(stripped).toContain('const after = 1;');
  });
});

describe('CHECK 3.80 — Group 3: τι ΕΧΕΙ TDZ και τι όχι', () => {
  test('🔴 `export function` ΑΝΥΨΩΝΕΤΑΙ — δεν μπορεί να είναι σε TDZ', () => {
    const h = judge.collectHoistedExports('/x/a.ts', `export function calculateLineBounds() {}`);
    expect(h.has('calculateLineBounds')).toBe(true);
  });

  test('`export const` (ακόμη κι αν είναι arrow) ΔΕΝ ανυψώνεται', () => {
    const h = judge.collectHoistedExports('/x/a.ts', `export const f = () => {}; export const K = { a: 1 };`);
    expect(h.has('f')).toBe(false);
    expect(h.has('K')).toBe(false);
  });

  test('`export class` ΔΕΝ ανυψώνεται (έχει TDZ όπως το const)', () => {
    const h = judge.collectHoistedExports('/x/a.ts', `export class Service {}`);
    expect(h.has('Service')).toBe(false);
  });

  test('`function foo(){}` + `export { foo }` ανυψώνεται το ίδιο', () => {
    const h = judge.collectHoistedExports('/x/a.ts', `function foo() {} export { foo };`);
    expect(h.has('foo')).toBe(true);
  });
});

describe('CHECK 3.80 — Group 4: τι μετράει ως ανάγνωση σε ΧΡΟΝΟ ΑΞΙΟΛΟΓΗΣΗΣ', () => {
  test('🔴 αρχικοποιητής top-level `const` ΜΕΤΡΑΕΙ — το σχήμα του περιστατικού', () => {
    const r = judge.collectTopLevelReads('/x/a.ts', `const store = create(storageGet(STORAGE_KEYS.X));`);
    expect(r.has('STORAGE_KEYS')).toBe(true);
    expect(r.has('storageGet')).toBe(true);
  });

  test('🔴 μέσα σε σώμα συνάρτησης ΔΕΝ μετράει — εκεί ζει η θεραπεία', () => {
    const r = judge.collectTopLevelReads('/x/a.ts', `function hydrate() { return storageGet(STORAGE_KEYS.X); }`);
    expect(r.has('STORAGE_KEYS')).toBe(false);
  });

  test('arrow function body ΔΕΝ μετράει', () => {
    const r = judge.collectTopLevelReads('/x/a.ts', `const f = () => DEEP_VALUE;`);
    expect(r.has('DEEP_VALUE')).toBe(false);
  });

  test('default τιμή παραμέτρου ΔΕΝ μετράει (αποτιμάται στην κλήση)', () => {
    const r = judge.collectTopLevelReads('/x/a.ts', `function f(x = DEFAULT_X) { return x; }`);
    expect(r.has('DEFAULT_X')).toBe(false);
  });

  test('spread top-level ΜΕΤΡΑΕΙ — το σχήμα του lazyRoutes', () => {
    const r = judge.collectTopLevelReads('/x/a.ts', `export const All = { ...otherRoutes };`);
    expect(r.has('otherRoutes')).toBe(true);
  });

  test('όνομα ιδιότητας δεν είναι ανάγνωση bindings', () => {
    const r = judge.collectTopLevelReads('/x/a.ts', `const o = { STORAGE_KEYS: 1 };`);
    expect(r.has('STORAGE_KEYS')).toBe(false);
  });
});

describe('CHECK 3.80 — Group 5: η πύλη ΕΚΤΕΛΕΙΤΑΙ στο πραγματικό δέντρο', () => {
  let m;
  beforeAll(() => { m = gate.measure(); }, 180000);

  test('ο παρονομαστής είναι πραγματικός (πύλη που σάρωσε μηδέν είναι επίσης «πράσινη»)', () => {
    expect(m.scanned).toBeGreaterThan(5000);
    expect(m.cyclicGroups).toBeGreaterThan(0); // αλλιώς ο ανιχνευτής SCC έσπασε σιωπηλά
  });

  test('κάθε εύρημα ονομάζει ΤΙ διαβάζεται, όχι μόνο ποιος', () => {
    for (const f of m.findings) {
      expect(f.names.length).toBeGreaterThan(0);
      expect(f.from).not.toBe(f.to);
    }
  });

  test('καμία τρέχουσα ακμή εκτός baseline', () => {
    const known = gate.loadBaseline();
    expect(known).not.toBeNull();
    const added = m.findings.filter((f) => !known.has(gate.identityOf(f)));
    expect(added.map((f) => `${f.from}→${f.to}`)).toEqual([]);
  });
});

describe('CHECK 3.80 — Group 6: ΜΙΑ σειρά επίλυσης, όχι δύο', () => {
  test('🔴 ο γράφος δανείζεται το RESOLVE_ORDER της 3.79 — δεν κρατά αντίγραφο', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'module-init', 'graph.js'), 'utf8');
    expect(src).toMatch(/require\(.*check-shadowed-modules.*\)/);
    // Καμία δεύτερη λίστα επεκτάσεων μέσα στο αρχείο.
    expect(src).not.toMatch(/RESOLVE_ORDER\s*=\s*\[/);
  });
});
