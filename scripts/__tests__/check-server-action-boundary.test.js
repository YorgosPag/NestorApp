/**
 * ⚓ CHECK 3.90 — η πύλη του ενός συνόρου (ADR-868)
 *
 * Δύο στρώματα, επειδή «πράσινο» σημαίνει δύο διαφορετικά πράγματα:
 *   Κ. **το κριτήριο** — η καθαρή `findServerDirectives` πάνω σε κείμενο: ποια μορφή
 *      ΕΙΝΑΙ οδηγία (πρόλογος αρχείου/συνάρτησης) και ποια όχι (σχόλιο, συμβολοσειρά
 *      μετά από εντολή, παρενθετική έκφραση). Τα αρνητικά είναι όσο σημαντικά όσο τα
 *      θετικά: μια σάρωση κειμένου θα καταδίκαζε τα σχόλια που τεκμηριώνουν τη βλάβη.
 *   Ε. **η εκτέλεση** — η ίδια η πύλη τρέχει σε προσωρινό αποθετήριο git και **κοκκινίζει**
 *      (exit 1) σε `'use server'`, **πρασινίζει** στη θεραπεία `server-only`, και βλέπει
 *      και **untracked** αρχείο (πριν το `git add`). Ένα anchor που δεν εκτελεί την πύλη
 *      δεν μπορεί να κοκκινίσει την πύλη (CHECK 3.54).
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const GATE = path.join(REPO, 'scripts', 'check-server-action-boundary.js');
const { findServerDirectives, isScannable } = require(GATE);

const found = (text, file = 'src/x.ts') => findServerDirectives(text, file);

// =============================================================================
// Κ. ΤΟ ΚΡΙΤΗΡΙΟ
// =============================================================================

describe('Κ. Τι είναι οδηγία', () => {
  it('Κ1 — οδηγία αρχείου', () => {
    expect(found("'use server';\nexport async function a() {}\n")).toEqual([{ line: 1, scope: 'module' }]);
  });

  it('Κ2 — μετά από docblock (τα σχόλια ΔΕΝ είναι εντολές — έτσι ήταν το AssignmentPolicyRepository)', () => {
    expect(found("/**\n * doc\n */\n\n'use server';\nimport 'x';\n")).toEqual([{ line: 5, scope: 'module' }]);
  });

  it('Κ3 — μέσα στον πρόλογο, μετά από άλλη οδηγία', () => {
    expect(found('"use strict";\n"use server";\n')).toEqual([{ line: 2, scope: 'module' }]);
  });

  it('Κ4 — inline action σε συνάρτηση, βέλος και μέθοδο', () => {
    const text = [
      'export function Page() {',
      '  async function save() { "use server"; }',
      '  const del = async () => { "use server"; };',
      '  return { m: { async go() { "use server"; } } };',
      '}',
    ].join('\n');
    expect(found(text, 'src/p.tsx').map(h => h.scope)).toEqual(['function', 'function', 'function']);
  });

  it('Κ5 — ΟΧΙ σε σχόλιο, ΟΧΙ μετά από εντολή, ΟΧΙ σε παρενθέσεις, ΟΧΙ `use client`', () => {
    const text = [
      "// 'use server' εδώ ήταν η βλάβη",
      "import 'server-only';",
      "'use server';",
      "export const note = 'use server';",
      "function f() { const x = 1; 'use server'; }",
      "function g() { ('use server'); }",
    ].join('\n');
    expect(found(text)).toEqual([]);
    expect(found("'use client';\n")).toEqual([]);
  });

  it('Κ6 — τα tests εξαιρούνται, ο κώδικας όχι', () => {
    expect(isScannable('src/a/__tests__/x.test.ts')).toBe(false);
    expect(isScannable('src/a/b.spec.tsx')).toBe(false);
    expect(isScannable('src/a/b.ts')).toBe(true);
    expect(isScannable('src/a/b.mjs')).toBe(true);
    expect(isScannable('src/a/b.json')).toBe(false);
  });
});

// =============================================================================
// Ε. Η ΕΚΤΕΛΕΣΗ
// =============================================================================

describe('Ε. Η πύλη εκτελείται και κρίνει', () => {
  let workdir;

  const write = (rel, text) => {
    const abs = path.join(workdir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  };
  const runGate = () => spawnSync('node', [path.join(workdir, 'scripts', 'check-server-action-boundary.js')], {
    cwd: workdir,
    encoding: 'utf8',
    env: { ...process.env, NODE_PATH: path.join(REPO, 'node_modules'), SKIP_SERVER_ACTION_BOUNDARY: '' },
  });
  const git = (...args) => execFileSync('git', args, { cwd: workdir, stdio: 'ignore' });

  beforeEach(() => {
    workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-3-90-'));
    write('scripts/check-server-action-boundary.js', fs.readFileSync(GATE, 'utf8'));
    git('init', '-q');
    git('config', 'user.email', 'gate@test.local');
    git('config', 'user.name', 'gate');
  });

  afterEach(() => {
    fs.rmSync(workdir, { recursive: true, force: true });
  });

  it('Ε1 — tracked `use server` ⇒ exit 1 και ονομάζει αρχείο:γραμμή', () => {
    write('src/services/leak.ts', "'use server';\nexport async function read(companyId?: string) {}\n");
    git('add', '.');

    const result = runGate();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/services/leak.ts:1');
  });

  it('Ε2 — η θεραπεία `server-only` ⇒ exit 0 (ίδιο αρχείο, ίδια λέξη σε σχόλιο)', () => {
    write('src/services/leak.ts', "// ήταν 'use server'\nimport 'server-only';\nexport async function read() {}\n");
    git('add', '.');

    expect(runGate().status).toBe(0);
  });

  it('Ε3 — UNTRACKED αρχείο (πριν το git add) ⇒ exit 1', () => {
    write('src/new-action.ts', "'use server';\nexport async function x() {}\n");

    expect(runGate().status).toBe(1);
  });

  it('Ε4 — `use server` μέσα σε test ⇒ exit 0 (δεν μπαίνει σε bundle)', () => {
    write('src/a/__tests__/fixture.test.ts', "'use server';\n");
    git('add', '.');

    expect(runGate().status).toBe(0);
  });
});
