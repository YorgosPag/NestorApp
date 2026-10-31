/**
 * Το standalone ανοίγει PDF (ADR-923 §5.5.1). Ένα ψεύτικο standalone με το `pdf.mjs` **χωρίς** τον worker αναπαράγει ακριβώς
 * τη βλάβη της παραγωγής: ο smoke πρέπει να κοκκινίζει, και το vendor να τον πρασινίζει. Τρέχουν οι πραγματικές εντολές του CI.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { packageRoot } = require('../lib/standalone-package-root.cjs');

const REPO = path.resolve(__dirname, '..', '..');
const PDFJS_ENTRY = 'pdfjs-dist/legacy/build/pdf.mjs';
const SMOKE = 'scripts/pdf-runtime-smoke.cjs';
const VENDOR = 'scripts/vendor-pdf-worker.cjs';

const run = (script, target) => spawnSync(process.execPath, [script, target], { cwd: REPO, encoding: 'utf8', timeout: 90_000 });

function fakeStandalone() {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-standalone-'));
  const source = packageRoot('pdfjs-dist', REPO, PDFJS_ENTRY);
  const pdfjs = path.join(target, 'node_modules/pdfjs-dist');
  fs.mkdirSync(path.join(pdfjs, 'legacy/build'), { recursive: true });
  fs.copyFileSync(path.join(source, 'package.json'), path.join(pdfjs, 'package.json'));
  fs.copyFileSync(path.join(source, 'legacy/build/pdf.mjs'), path.join(pdfjs, 'legacy/build/pdf.mjs'));
  fs.mkdirSync(path.join(target, 'node_modules/@napi-rs'));
  fs.symlinkSync(packageRoot('@napi-rs/canvas', REPO), path.join(target, 'node_modules/@napi-rs/canvas'), 'junction');
  return target;
}

describe('PDF στο standalone', () => {
  let target;

  beforeAll(() => {
    target = fakeStandalone();
  });

  afterAll(() => {
    fs.rmSync(target, { recursive: true, force: true });
  });

  it('χωρίς τον worker ο smoke αποτυγχάνει με το σφάλμα της παραγωγής', () => {
    const result = run(SMOKE, target);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Setting up fake worker failed');
  });

  it('μετά το vendor ο ίδιος smoke περνά, και δεν αφήνει αρχείο στο standalone', () => {
    expect(run(VENDOR, target).status).toBe(0);
    const result = run(SMOKE, target);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(target, '.pdf-runtime-smoke.mjs'))).toBe(false);
  });

  it('το CI εκτελεί vendor και smoke πριν φτιαχτεί το image', () => {
    const workflow = fs.readFileSync(path.join(REPO, '.github/workflows/docker-build.yml'), 'utf8');
    const positions = [`node ${VENDOR} .next/standalone`, `node ${SMOKE} .next/standalone`, 'docker/build-push-action'].map((text) => workflow.indexOf(text));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
