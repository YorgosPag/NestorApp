/**
 * N.11 — UI hardcoded strings ratchet (`scripts/check-ui-hardcoded-strings.sh`).
 *
 * EXECUTES the real gate (bash) on temp files — a pattern test on a copy of the regex
 * would prove nothing about the script the hook runs.
 *
 * Why it exists (2026-09-21): the gate blanked only `/* … *\/` comments. A trailing
 * `code; // … <πεδίο> …` passed straight through and 7 correct files were blocked on
 * the SAME comment. The gate now asks the one SSoT `stripComments`
 * (`scripts/lib/i18n-namespace-extract.js`).
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const GATE = 'scripts/check-ui-hardcoded-strings.sh';

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-strings-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function runGate(source) {
  const file = path.join(tmp, 'Widget.tsx').replace(/\\/g, '/');
  fs.writeFileSync(file, source, 'utf8');
  const r = spawnSync('bash', [GATE, file], { cwd: ROOT, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('N.11 — the gate judges CODE, never comments', () => {
  test('trailing // comment with Greek between <…> ⇒ PASS (the 7-file false positive)', () => {
    const r = runGate('const idBase = useId(); // `${idBase}-<πεδίο>`: η <Label> ονομάζει το combobox\n');
    expect(r.code).toBe(0);
  });

  test('JSX block comment {/* <a>Γεια</a> */} ⇒ PASS', () => {
    const r = runGate('export const W = () => (\n  <div>\n    {/* <a>Γεια</a> */}\n  </div>\n);\n');
    expect(r.code).toBe(0);
  });

  test('real JSX text in Greek ⇒ BLOCK, with its line number', () => {
    const r = runGate('export const W = () => (\n  <span>Αποθήκευση</span>\n);\n');
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/\b2:\s*<span>Αποθήκευση<\/span>/);
  });

  test('the // of a URL inside a string does NOT blank the rest of the line ⇒ BLOCK', () => {
    const r = runGate("export const W = () => { const u = 'https://x.gr'; return <b>Γεια</b>; };\n");
    expect(r.code).toBe(1);
  });
});
