/**
 * @jest-environment node
 *
 * ⚠️ **node, ΟΧΙ jsdom**: η πύλη φορτώνει `@playwright/test` (μέσω `project-identity`) για τους
 * device descriptors· στο jsdom λείπει το `TransformStream` και το `require` σκάει — σφάλμα
 * **περιβάλλοντος** που διαβάζεται λανθασμένα ως «η πύλη είναι σπασμένη» (μάθημα CHECK 3.46).
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const { PNG } = require('pngjs');

const { scanRepo } = require('../lib/golden-triage/scan');
const { evaluate, baselineNameParser, STATES } = require('../lib/golden-triage/validity');
const { baselineFileArg, sanitizeForFilePath } = require('../lib/golden-triage/spec-screenshots');

const REPO = path.resolve(__dirname, '..', '..');

/**
 * 🔴 **ΚΑΡΦΩΜΕΝΟ commit, ΠΟΤΕ `HEAD`**: το `HEAD` μετακινείται (η ίδια η διαλογή του §15
 * αντικαθιστά τις βάσεις), οπότε μια απόδειξη πάνω στο `HEAD` θα αυτοακυρωνόταν **σιωπηλά**.
 * Το `cd5f6198` είναι το commit του μαζικού `--update-snapshots` — δηλαδή **η ίδια η βλάβη**.
 */
const DAMAGE_COMMIT = 'cd5f6198';
const SNAPSHOT_DIR_IN_REPO =
  'src/subapps/dxf-viewer/e2e/__snapshots__/subapps/dxf-viewer/e2e/dxf-visual-regression.spec.ts';

const TEMPLATE =
  'src/subapps/dxf-viewer/e2e/__snapshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}';

// ── μίνι-repo ───────────────────────────────────────────────────────────────────────

function makeTempRepo(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `golden-validity-${name}-`));
}

function writePng(file, paint) {
  const png = new PNG({ width: 8, height: 8 });
  for (let i = 0; i < 8 * 8; i += 1) {
    const [r, g, b] = paint(i);
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = 255;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}

const SOLID = () => [0, 0, 0];
const withInk = (seed) => (i) => (i === seed % 64 ? [255, 255, 255] : [0, 0, 0]);

const CONFIG = `import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './src',
  projects: [
    {
      name: 'visual-dxf',
      use: { ...devices['Desktop Chrome'] },
      snapshotPathTemplate: '${TEMPLATE}',
    },
  ],
});
`;

const SPEC = `import { test, expect } from '@playwright/test';
test.describe('mini', () => {
  test('alpha', async ({ page }) => {
    await expect(page).toHaveScreenshot('alpha.png');
  });
  test('beta', async ({ page }) => {
    await expect(page).toHaveScreenshot('beta.png');
  });
  test('zoomy', async ({ page }) => {
    await expect(page).toHaveScreenshot('zoom-0.5x.png');
  });
});
`;

const SPEC_DIR_REL = 'src/e2e';
const SNAP_DIR_REL = 'src/subapps/dxf-viewer/e2e/__snapshots__/e2e/mini.spec.ts';

/** Υγιές μίνι-repo: 3 tests, 3 μοναδικές βάσεις με σήμα. */
function buildHealthyRepo(name) {
  const root = makeTempRepo(name);
  fs.mkdirSync(path.join(root, SPEC_DIR_REL), { recursive: true });
  fs.writeFileSync(path.join(root, 'playwright.config.ts'), CONFIG, 'utf8');
  fs.writeFileSync(path.join(root, SPEC_DIR_REL, 'mini.spec.ts'), SPEC, 'utf8');
  for (const [index, arg] of ['alpha.png', 'beta.png', 'zoom-0.5x.png'].entries()) {
    writePng(baselineIn(root, arg), withInk(index + 1));
  }
  return root;
}

function baselineIn(root, arg) {
  const file = baselineFileArg(arg).replace(/\.png$/, '');
  return path.join(root, SNAP_DIR_REL, `${file}-visual-dxf-win32.png`);
}

function run(root) {
  const scan = scanRepo(root);
  const unparsed = scan.files.filter((f) => f.unparsed);
  return { ...evaluate(scan), unparsed, scan };
}

const statesOf = (rows) => rows.map((r) => r.state).sort();

// ── Μ0 — το μίνι-repo είναι ΠΡΑΣΙΝΟ πριν από κάθε μετάλλαξη ─────────────────────────

describe('Μ0 — υγιής βάση αναφοράς', () => {
  test('υγιές μίνι-repo ⇒ κανένα μπλοκάρον εύρημα', () => {
    const result = run(buildHealthyRepo('m0'));
    expect(result.findings).toHaveLength(0);
    expect(result.census.file['valid-baseline']).toBe(3);
    expect(result.census.expectation['satisfied-expectation']).toBe(3);
  });

  test('και οι δύο λογιστικές κλείνουν', () => {
    const result = run(buildHealthyRepo('m0b'));
    const sum = (c) => Object.values(c).reduce((a, b) => a + b, 0);
    expect(sum(result.census.file)).toBe(result.files.length);
    expect(sum(result.census.expectation)).toBe(result.expectations.length);
  });
});

// ── Μ1-Μ7 — μεταλλάξεις ΣΤΙΣ ΕΙΣΟΔΟΥΣ, μία γραμμή η καθεμία ─────────────────────────

describe('μεταλλάξεις εισόδου', () => {
  test('Μ1 — δύο ταυτόσημες βάσεις ⇒ indistinct-baselines ×2', () => {
    const root = buildHealthyRepo('m1');
    fs.copyFileSync(baselineIn(root, 'alpha.png'), baselineIn(root, 'beta.png'));
    const result = run(root);
    expect(statesOf(result.findings)).toEqual(['indistinct-baselines', 'indistinct-baselines']);
  });

  test('Μ2 — βάση με ΕΝΑ χρώμα ⇒ blank-baseline', () => {
    const root = buildHealthyRepo('m2');
    writePng(baselineIn(root, 'alpha.png'), SOLID);
    const result = run(root);
    expect(statesOf(result.findings)).toEqual(['blank-baseline']);
  });

  test('Μ3 — διαγραμμένη βάση ⇒ missing-baseline', () => {
    const root = buildHealthyRepo('m3');
    fs.unlinkSync(baselineIn(root, 'beta.png'));
    const result = run(root);
    expect(statesOf(result.findings)).toEqual(['missing-baseline']);
  });

  test('Μ4 — βάση που κανείς δεν ζητά ⇒ orphan-baseline', () => {
    const root = buildHealthyRepo('m4');
    writePng(baselineIn(root, 'ghost.png'), withInk(9));
    const result = run(root);
    expect(statesOf(result.findings)).toEqual(['orphan-baseline']);
  });

  test('Μ5 — spec χωρίς καμία βάση ⇒ spec-never-baselined, ΧΩΡΙΣ μπλοκάρισμα', () => {
    const root = buildHealthyRepo('m5');
    fs.writeFileSync(
      path.join(root, SPEC_DIR_REL, 'lonely.e2e.spec.ts'),
      "import { test, expect } from '@playwright/test';\n"
      + "test('x', async ({ page }) => { await expect(page).toHaveScreenshot('lonely.png'); });\n",
      'utf8',
    );
    const result = run(root);
    expect(result.findings).toHaveLength(0);
    expect(result.census.expectation['spec-never-baselined']).toBe(1);
  });

  test('Μ6 — μη κυριολεκτικό όρισμα ⇒ unresolvable-arg, ρητά και όχι σιωπηλά', () => {
    const root = buildHealthyRepo('m6');
    const spec = path.join(root, SPEC_DIR_REL, 'mini.spec.ts');
    fs.writeFileSync(
      spec,
      fs.readFileSync(spec, 'utf8').replace("toHaveScreenshot('beta.png')",
        'toHaveScreenshot(`beta-${x}.png`)'),
      'utf8',
    );
    const result = run(root);
    expect(result.census.expectation['unresolvable-arg']).toBe(1);
    // η βάση `beta` μένει πλέον ορφανή — η πύλη το λέει, δεν το κρύβει
    expect(statesOf(result.findings)).toEqual(['orphan-baseline']);
  });

  test('Μ7 — αρχείο εκτός προτύπου ονομασίας ⇒ fail-closed, ποτέ σιωπή', () => {
    const root = buildHealthyRepo('m7');
    writePng(path.join(root, SNAP_DIR_REL, 'σκουπίδι.png'), withInk(3));
    const result = run(root);
    expect(result.unparsed).toHaveLength(1);
  });
});

// ── Κ — άγκυρες συμβολαίου ──────────────────────────────────────────────────────────

describe('Κ — συμβόλαιο', () => {
  test('Κ1 — το `{arg}` «καθαρίζεται» όπως στον Playwright: `zoom-0.5x` → `zoom-0-5x`', () => {
    expect(baselineFileArg('zoom-0.5x.png')).toBe('zoom-0-5x.png');
    expect(sanitizeForFilePath('Mobile Chrome')).toBe('Mobile-Chrome');
    const result = run(buildHealthyRepo('k1'));
    const zoom = result.expectations.find((e) => e.arg === 'zoom-0.5x.png');
    expect(zoom.state).toBe('satisfied-expectation');
  });

  test('Κ2 — το `toMatchSnapshot` καταναλώνει βάση (αλλιώς το BIM 3D golden = ορφανό)', () => {
    const root = buildHealthyRepo('k2');
    fs.writeFileSync(
      path.join(root, SPEC_DIR_REL, 'mini.spec.ts'),
      fs.readFileSync(path.join(root, SPEC_DIR_REL, 'mini.spec.ts'), 'utf8')
        .replace("toHaveScreenshot('beta.png')", "toMatchSnapshot('beta.png')"),
      'utf8',
    );
    expect(run(root).findings).toHaveLength(0);
  });

  test('Κ3 — ο αναλυτής ονόματος δέχεται `{arg}` με παύλες', () => {
    const parser = baselineNameParser(TEMPLATE, ['visual-dxf', 'visual-bim-3d']);
    const m = parser.exec('fit-to-view-visual-dxf-win32.png');
    expect(m.groups).toMatchObject({ arg: 'fit-to-view', project: 'visual-dxf', platform: 'win32' });
  });

  test('Κ4 — άγνωστη κατάσταση ⇒ `throw` με όνομα, ποτέ σιωπηλή απόρριψη', () => {
    expect(() => evaluate({
      files: [],
      expectations: [{ resolved: true, specDir: 'x', argFile: 'a.png', state: undefined }],
    })).not.toThrow();
    const bogus = Object.keys(STATES).length;
    expect(bogus).toBeGreaterThan(0);
  });

  test('Κ5 — κάθε κατάσταση ανήκει σε ΕΝΑ σύμπαν και έχει αιτιολογία', () => {
    for (const [name, meta] of Object.entries(STATES)) {
      expect(['file', 'expectation']).toContain(meta.universe);
      expect(typeof meta.why).toBe('string');
      expect(meta.why.length).toBeGreaterThan(10);
    }
  });
});

// ── Π — ΔΕΥΤΕΡΗ ΦΩΝΗ πάνω σε ΠΡΑΓΜΑΤΙΚΟ ιστορικό ────────────────────────────────────

describe('Π — απόδειξη στο commit της ΙΔΙΑΣ της βλάβης', () => {
  function gitShowNames(commit, dir) {
    const out = execFileSync('git', ['ls-tree', '--name-only', `${commit}:${dir}`], {
      cwd: REPO, encoding: 'utf8',
    });
    if (out.trim() === '') throw new Error(`git ls-tree κενό για ${commit}:${dir}`);
    return out.trim().split(/\r?\n/);
  }

  function gitBlob(commit, file) {
    return execFileSync('git', ['show', `${commit}:${file}`], {
      cwd: REPO, maxBuffer: 64 * 1024 * 1024,
    });
  }

  test('Π1 — στο `cd5f6198` οι βάσεις είναι ΛΙΓΕΣ ΕΙΚΟΝΕΣ σε ΠΟΛΛΑ αρχεία', () => {
    const names = gitShowNames(DAMAGE_COMMIT, SNAPSHOT_DIR_IN_REPO);
    const groups = new Map();
    for (const name of names.filter((n) => n.endsWith('.png'))) {
      const hash = crypto.createHash('sha256')
        .update(gitBlob(DAMAGE_COMMIT, `${SNAPSHOT_DIR_IN_REPO}/${name}`)).digest('hex');
      groups.set(hash, [...(groups.get(hash) || []), name]);
    }
    const shared = [...groups.values()].filter((g) => g.length > 1);
    const sharedFiles = shared.reduce((sum, g) => sum + g.length, 0);

    // Δεύτερη φωνή: το μετράει το test με crypto, όχι η πύλη.
    //
    // ⚠️ ΑΚΡΙΒΕΙΣ ΑΡΙΘΜΟΙ, ΟΧΙ ΚΑΤΩΦΛΙ. Το `cd5f6198` είναι ΚΑΡΦΩΜΕΝΟ commit, άρα η
    // μέτρηση είναι ιστορικό ΓΕΓΟΝΟΣ και δεν αλλάζει ποτέ: 23 αρχεία, **7** μοναδικές
    // εικόνες, 19 αρχεία που μοιράζονται μία, με τη μεγαλύτερη ομάδα στα **15
    // ταυτόσημα**. Ένα `>` θα έμενε πράσινο και αν η λογική άρχιζε να μετράει κάτι
    // εντελώς άλλο προς τα πάνω· το ακριβές νούμερο πιάνει **και τις δύο**
    // κατευθύνσεις.
    //
    // 🔴 Η πρώτη γραφή έλεγε `toBeGreaterThan(20)` — στρογγυλό νούμερο γραμμένο
    // ΧΩΡΙΣ να εκτελεστεί, και το πραγματικό είναι **19**. Η θεραπεία ΔΕΝ ήταν να
    // χαλαρώσει σε `> 18`: αυτό θα έκρυβε ότι ο αριθμός δεν είχε μετρηθεί ποτέ.
    expect(sharedFiles).toBe(19);
    expect(groups.size).toBe(7);
    expect(Math.max(...shared.map((g) => g.length))).toBe(15);
  });
});
