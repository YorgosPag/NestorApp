/**
 * ADR-770 · ADR-757 — «τρέχει αυτό το βήμα **χωρίς** `node_modules`;» (`scripts/lib/ci/preinstall-steps.js`)
 *
 * Το `ui-contrast-ratchet.yml` ήταν κόκκινο **37 φορές** (27/08 → 21/09) επειδή το CHECK 3.38 έτρεχε
 * πριν από το `pnpm install` και φόρτωνε `tailwindcss/loadConfig` — ο κανόνας ζούσε σε σχόλιο και
 * είχε ήδη αποτύχει μία φορά (08/08, `typescript`). Εδώ τον κρατά μηχανή, σε **όλα** τα workflows.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { packageRequires, preinstallViolations, implicitCacheViolations } = require('../lib/ci/preinstall-steps');
const { listWorkflowFiles, readWorkflowRunSteps, readWorkflowSteps } = require('../lib/ci/workflow-meta');

const ROOT = path.join(__dirname, '..', '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const workflowPaths = () => listWorkflowFiles(WORKFLOWS_DIR).map((f) => (path.isAbsolute(f) ? f : path.join(WORKFLOWS_DIR, f)));

/** Μίνι-repo: `files` = { σχετική διαδρομή: περιεχόμενο }. */
function miniRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preinstall-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

const workflow = (steps) => `name: x\non: push\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n${steps}`;

describe('🌍 ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΔΕΝΤΡΟ', () => {
  it('κανένα βήμα πριν από το install δεν φορτώνει πακέτο — σε ΚΑΝΕΝΑ workflow', () => {
    expect(workflowPaths().length).toBeGreaterThan(10); // 0 workflows = κανείς δεν κοίταξε
    expect(preinstallViolations(workflowPaths(), ROOT)).toEqual([]);
  });

  it('θετικός μάρτυρας: το CHECK 3.38 ΦΟΡΤΩΝΕΙ tailwindcss — μέσω require.resolve (το περιστατικό)', () => {
    expect(packageRequires('scripts/check-text-primary-ratchet.js', ROOT))
      .toContainEqual({ pkg: 'tailwindcss', via: 'scripts/lib/contrast/tailwind-class-resolver.js' });
  });

  it('το τοπικό composite action firebase-identity ΜΕΤΡΑ ως install (αλλιώς 3 ψευδώς θετικά)', () => {
    const drift = path.join(WORKFLOWS_DIR, 'firebase-drift.yml');
    expect(readWorkflowSteps(drift).some((s) => s.uses === './.github/actions/firebase-identity')).toBe(true);
    expect(packageRequires('scripts/firestore-deploy/verify-live.js', ROOT).map((p) => p.pkg)).toContain('google-auth-library');
    expect(preinstallViolations([drift], ROOT)).toEqual([]);
  });
});

describe('ο κριτής σε μίνι-repo', () => {
  const lib = { 'scripts/lib/a.js': "require('node:fs');\nrequire.resolve('tailwindcss/loadConfig', {});\n",
    'scripts/gate.js': "const a = require('./lib/a');\nrequire('path');\n" };

  it('🔴 βήμα ΠΡΙΝ από το install με μεταβατικό πακέτο ⇒ εύρημα, με το αρχείο που το ζητά', () => {
    const dir = miniRepo({ ...lib, 'w.yml': workflow('      - run: node scripts/gate.js --all\n      - run: pnpm install --frozen-lockfile\n') });
    expect(preinstallViolations([path.join(dir, 'w.yml')], dir))
      .toEqual([{ workflow: 'w.yml', job: 'j', script: 'scripts/gate.js', pkg: 'tailwindcss', via: 'scripts/lib/a.js' }]);
  });

  it('το ΙΔΙΟ βήμα ΜΕΤΑ το install ⇒ καθαρό (η σειρά είναι όλο το ερώτημα)', () => {
    const dir = miniRepo({ ...lib, 'w.yml': workflow('      - run: pnpm install --frozen-lockfile\n      - run: node scripts/gate.js --all\n') });
    expect(preinstallViolations([path.join(dir, 'w.yml')], dir)).toEqual([]);
  });

  it('built-ins (node:fs · path) δεν είναι πακέτα', () => {
    const dir = miniRepo({ 'scripts/gate.js': "require('node:fs'); require('path'); require('fs/promises');\n" });
    expect(packageRequires('scripts/gate.js', dir)).toEqual([]);
  });

  it('scoped πακέτο ⇒ @scope/name', () => {
    const dir = miniRepo({ 'scripts/gate.js': "require('@actions/core/lib/x');\n" });
    expect(packageRequires('scripts/gate.js', dir)).toEqual([{ pkg: '@actions/core', via: 'scripts/gate.js' }]);
  });
});

describe('το σιωπηρό cache του setup-node@v5 (Node 24) — η απόφαση cache είναι ΡΗΤΗ', () => {
  const judge = (steps) => {
    const dir = miniRepo({ 'w.yml': workflow(steps) });
    return implicitCacheViolations([path.join(dir, 'w.yml')]);
  };

  it('🌍 το πραγματικό δέντρο: κανένα setup-node ≥ v5 χωρίς ρητή απόφαση cache', () => {
    const setupNodeSteps = workflowPaths()
      .flatMap((file) => readWorkflowSteps(file))
      .filter((s) => s.uses !== null && s.uses.startsWith('actions/setup-node@'));
    expect(setupNodeSteps.length).toBeGreaterThan(50); // 0 = κανείς δεν κοίταξε
    expect(implicitCacheViolations(workflowPaths())).toEqual([]);
  });

  it.each([
    ['μπλοκ χωρίς cache', "      - uses: actions/setup-node@v5\n        with:\n          node-version: '20'\n"],
    ['flow χωρίς cache', "      - uses: actions/setup-node@v5\n        with: { node-version: '20' }\n"],
    ['χωρίς with καθόλου', '      - uses: actions/setup-node@v6\n'],
  ])('🔴 %s ⇒ εύρημα', (_shape, steps) => {
    expect(judge(steps)).toHaveLength(1);
  });

  it.each([
    ['cache: pnpm', "      - uses: actions/setup-node@v5\n        with:\n          node-version: '20'\n          cache: 'pnpm'\n"],
    ['package-manager-cache: false (μπλοκ)', "      - uses: actions/setup-node@v5\n        with:\n          node-version: '20'\n          package-manager-cache: false\n"],
    ['package-manager-cache: false (flow)', "      - uses: actions/setup-node@v5\n        with: { node-version: '20', package-manager-cache: false }\n"],
    ['v4 — δεν έχει σιωπηρό cache', "      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n"],
  ])('✅ %s ⇒ καθαρό', (_shape, steps) => {
    expect(judge(steps)).toEqual([]);
  });

  it('οι γραμμές ενός `script: |` μέσα στο with ΔΕΝ είναι κλειδιά του with', () => {
    const dir = miniRepo({ 'w.yml': workflow("      - uses: actions/github-script@v8\n        with:\n          script: |\n            cache: 'fake'\n") });
    expect(readWorkflowSteps(path.join(dir, 'w.yml'))[0].with).toEqual({ script: '|' });
  });
});

describe('ο αναγνώστης βημάτων (workflow-meta)', () => {
  it('readWorkflowRunSteps μένει ΜΟΝΟ run: και χωρίς πεδίο uses (συμβατότητα καταναλωτών)', () => {
    const file = path.join(WORKFLOWS_DIR, 'firebase-drift.yml');
    const steps = readWorkflowRunSteps(file);
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) {
      expect(typeof s.run).toBe('string');
      expect(s).not.toHaveProperty('uses');
    }
  });
});
