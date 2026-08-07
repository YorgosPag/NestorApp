/**
 * CHECK 3.45 / ADR-771 Φ.3 — η πύλη εφικτότητας υποσχέσεων ελέγχεται από τη ΔΙΚΗ της σουίτα.
 *
 * ΔΟΜΗ (ίδια με τα CHECK 3.35/3.41/3.43/3.44):
 *   Μ0      — το ΖΩΝΤΑΝΟ δέντρο περνά καθαρό
 *   Μ1..Μ9  — μία ΜΕΤΑΛΛΑΞΗ ανά ρητή κατάσταση· αν η πύλη δεν την πιάσει, δεν είναι πύλη
 *   Π1..Π3  — ο ΠΡΑΓΜΑΤΙΚΟΣ ιστορικός κώδικας από το git: το ελάττωμα υπήρχε στ' αλήθεια
 *   Κ1..Κ8  — κοκκίωση: τι ΔΕΝ πιάνει, δηλωμένο ως test και όχι ως ελπίδα
 *
 * ⚠️ **Οι μεταλλάξεις είναι στις ΕΙΣΟΔΟΥΣ, όχι στην πύλη**: μίνι-repo από τα **πραγματικά**
 * αρχεία, μία γραμμή αλλαγή. Και το {@link mutate} **ουρλιάζει** αν η μετάλλαξη δεν άλλαξε
 * τίποτα — αλλιώς ένα test που «πέρασε» θα σήμαινε ότι η πύλη δεν κοίταξε καν.
 *
 * ⚠️ **Καρφωμένο commit, ΟΧΙ `HEAD`**: το `HEAD` μετακινείται και τα Π θα αυτοακυρώνονταν
 * σιωπηλά τη μέρα που κάποιος αλλάξει ξανά τα ίδια αρχεία.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  calibrate, customSurfaceCeiling, maxAchievableOn, presentableSurfaces, reachabilityLimits,
} = require('../lib/contrast-promise/presentable-surfaces');
const {
  ADAPTIVE_MODULE, createReader, isTestFile, mayContainPromise, readAdaptiveApi, sitesInFile,
} = require('../lib/contrast-promise/promise-sites');
const {
  BLOCKING, STATES, classify, reachabilityGap, shouldRunFull,
} = require('../check-contrast-promise-reachability');

const REPO_ROOT = path.join(__dirname, '..', '..');

/** Το commit πριν από τη Φ.3 — εκεί ζει ο ΠΡΑΓΜΑΤΙΚΟΣ κώδικας της σιωπηλής παράδοσης. */
const PRE_PHASE3_COMMIT = '1cafeb6a';

const WALL_RENDERER = 'src/subapps/dxf-viewer/bim/renderers/WallRenderer.ts';
const WALL_PALETTE = 'src/subapps/dxf-viewer/bim/walls/wall-render-palette.ts';
const CANVAS_THEME = 'src/subapps/dxf-viewer/config/canvas-theme.ts';
const TABLE_INK = 'src/subapps/dxf-viewer/bim/table/table-ink.ts';
const VARIABLES_CSS = 'src/styles/design-system/generated/variables.css';

/** Τα αρχεία που χρειάζεται η μηχανή για να απαντήσει — τίποτα παραπάνω. */
const MINI_REPO_FILES = [ADAPTIVE_MODULE, CANVAS_THEME, TABLE_INK, WALL_PALETTE, WALL_RENDERER, VARIABLES_CSS];

const read = (repoRoot, rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

/**
 * Τραβά ένα αρχείο από **καρφωμένο** commit. Μονοπάτια πάντα με `/` (στα Windows το
 * `path.join` δίνει `\` και το git απαντά «exists on disk, but not in <commit>») και
 * **σκάει σε κενή απάντηση** — μια σιωπηλή κενή συμβολοσειρά θα έβαφε τα Π πράσινα.
 */
function gitShow(commit, relPosix) {
  const out = execFileSync('git', ['show', `${commit}:${relPosix}`], {
    cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  if (typeof out !== 'string' || out.trim().length === 0) {
    throw new Error(`git show ${commit}:${relPosix} → κενό· το Π δεν αποδεικνύει τίποτα`);
  }
  return out;
}

/** Μετάλλαξη που **ουρλιάζει** αν δεν βρήκε στόχο ή δεν άλλαξε τίποτα (μάθημα ADR-772). */
function mutate(source, from, to) {
  if (!source.includes(from)) throw new Error(`Η μετάλλαξη δεν βρήκε στόχο: «${from}»`);
  const out = source.split(from).join(to);
  if (out === source) throw new Error(`Η μετάλλαξη δεν άλλαξε τίποτα: «${from}»`);
  return out;
}

/** Μίνι-repo από τα πραγματικά αρχεία· `overrides` αντικαθιστά περιεχόμενο ανά μονοπάτι. */
function miniRepo(overrides = {}, sourceOf = (rel) => read(REPO_ROOT, rel)) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sc45-'));
  for (const rel of MINI_REPO_FILES) {
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, overrides[rel] ?? sourceOf(rel));
  }
  // Το `tsconfig.base.json` τροφοδοτεί τα aliases του resolveSpecifier (ADR-700 SSoT).
  fs.copyFileSync(path.join(REPO_ROOT, 'tsconfig.base.json'), path.join(root, 'tsconfig.base.json'));
  return root;
}

/** Τρέχει ΟΛΗ τη μηχανή πάνω σε ένα repo και επιστρέφει τις ετυμηγορίες ανά κλήση. */
function analyze(root, files = [WALL_RENDERER, TABLE_INK]) {
  const reader = createReader(root);
  const api = readAdaptiveApi(root, reader);
  const limits = reachabilityLimits(presentableSurfaces(root));
  const sites = [];
  for (const rel of files) {
    const abs = path.join(root, rel).split(path.sep).join('/');
    for (const site of sitesInFile(abs, rel, api, reader)) {
      sites.push({ ...site, state: classify(site, limits) });
    }
  }
  return { api, limits, sites, blocking: sites.filter((s) => BLOCKING.has(s.state)) };
}

const statesOf = (result) => [...new Set(result.sites.map((s) => s.state))].sort();

// ── Μ0 — ΤΟ ΖΩΝΤΑΝΟ ΔΕΝΤΡΟ ───────────────────────────────────────────────────────────────

describe('Μ0 — το ζωντανό δέντρο', () => {
  it('η βαθμονόμηση περνά (λευκό/μαύρο = 21 · φράγμα custom = κλειστός τύπος)', () => {
    expect(calibrate()).toBeNull();
  });

  it('καμία αθετημένη υπόσχεση στον ζωντανό WallRenderer', () => {
    expect(analyze(miniRepo()).blocking).toEqual([]);
  });

  it('οι τρεις κλήσεις τοίχου είναι ΑΝΕΦΙΚΤΕΣ και ΔΙΑΣΩΣΜΕΝΕΣ — όχι «εφικτές»', () => {
    const rescued = analyze(miniRepo()).sites.filter((s) => s.state === STATES.UNREACHABLE_RESCUED);
    expect(rescued).toHaveLength(3);
    for (const s of rescued) expect(s.file).toBe(WALL_RENDERER);
  });

  it('το φράγμα είναι μετρημένο: cinema4d 7,46:1 · custom 4,58:1', () => {
    const limits = reachabilityLimits(presentableSurfaces(REPO_ROOT));
    expect(limits.worstPreset.key).toBe('cinema4d');
    expect(limits.worstPreset.max).toBeCloseTo(7.46, 1);
    expect(limits.customCeiling).toBeCloseTo(4.58, 2);
  });

  /**
   * 🔴 **ADR-771 Φ.2 — Η ΕΠΙΦΑΝΕΙΑ ΠΟΥ ΘΑ ΕΙΧΕ ΞΕΦΥΓΕΙ.**
   *
   * Μέχρι τη Φ.2 ο σαρωτής ζητούσε **ονομαστικά** το `TABLE_PAPER_HEX`. Η Φ.2 πρόσθεσε το
   * `TABLE_SHEET_HEX` **στο ίδιο αρχείο**, και ένας σαρωτής που απαριθμεί ονόματα θα έμενε
   * πράσινος πάνω σε επιφάνεια που **κανείς δεν έκρινε** — η «δεύτερη αυθεντία που αποκλίνει
   * σιωπηλά» που προειδοποιεί η κεφαλίδα του `presentable-surfaces.js`, εμφανιζόμενη μέσα
   * στο αρχείο που την προειδοποιεί.
   *
   * Το κριτήριο έγινε **ανακάλυψη** (`TABLE_<X>_HEX`). Αυτό το test το κλειδώνει: μια
   * επιστροφή στην απαρίθμηση αφήνει το `sheet` έξω και πέφτει εδώ.
   */
  it('🔴 ΚΑΘΕ σταθερή επιφάνεια πίνακα κρίνεται — ανακάλυψη, όχι απαρίθμηση', () => {
    const keys = presentableSurfaces(REPO_ROOT)
      .filter((s) => s.origin === TABLE_INK)
      .map((s) => s.key)
      .sort();
    expect(keys).toEqual(['paper', 'sheet']);
  });

  it('η ανακάλυψη είναι fail-closed: καμία σταθερά ⇒ σκάει, ποτέ «0 επιφάνειες»', () => {
    const ink = read(REPO_ROOT, TABLE_INK).split('export const TABLE_').join('const TABLE_');
    expect(() => presentableSurfaces(miniRepo({ [TABLE_INK]: ink }))).toThrow(/TABLE_\*_HEX/);
  });
});

// ── Μ1..Μ9 — ΜΙΑ ΜΕΤΑΛΛΑΞΗ ΑΝΑ ΡΗΤΗ ΚΑΤΑΣΤΑΣΗ ───────────────────────────────────────────

describe('Μ — μεταλλάξεις στις ΕΙΣΟΔΟΥΣ', () => {
  it('Μ1: επιστροφή στο χρωματικό API ⇒ unreachable-preset (η αρχική βλάβη)', () => {
    const wall = mutate(read(REPO_ROOT, WALL_RENDERER),
      'adaptStructuralLineInkForCanvas', 'adaptStructuralLineColorForCanvas');
    const result = analyze(miniRepo({ [WALL_RENDERER]: wall }));
    expect(result.blocking.length).toBeGreaterThan(0);
    expect(statesOf(result)).toContain(STATES.UNREACHABLE_PRESET);
  });

  it('Μ2: κατώφλι 5.0 (κάτω από cinema4d, πάνω από custom) ⇒ unreachable-custom', () => {
    const wall = mutate(read(REPO_ROOT, WALL_RENDERER),
      'adaptStructuralLineInkForCanvas', 'adaptStructuralLineColorForCanvas');
    const palette = mutate(read(REPO_ROOT, WALL_PALETTE), 'WALL_LINE_CONTRAST = 9.0', 'WALL_LINE_CONTRAST = 5.0');
    const result = analyze(miniRepo({ [WALL_RENDERER]: wall, [WALL_PALETTE]: palette }));
    expect(statesOf(result)).toContain(STATES.UNREACHABLE_CUSTOM);
    expect(statesOf(result)).not.toContain(STATES.UNREACHABLE_PRESET);
  });

  it('Μ3: κατώφλι από άγνωστο σύμβολο ⇒ unanalyzable-threshold (fail-closed)', () => {
    const wall = mutate(read(REPO_ROOT, WALL_RENDERER), 'WALL_LINE_CONTRAST)', 'someRuntimeThreshold)');
    const result = analyze(miniRepo({ [WALL_RENDERER]: wall }));
    expect(statesOf(result)).toContain(STATES.UNANALYZABLE);
    expect(result.blocking.length).toBeGreaterThan(0);
  });

  it('Μ4: η ετυμηγορία πεταμένη με `.ink` ⇒ ΔΕΝ σώζει — ίδιο με το χρωματικό API', () => {
    const wall = mutate(read(REPO_ROOT, WALL_RENDERER),
      'adaptStructuralLineInkForCanvas(wall.color ?? \'#000000\', WALL_LINE_CONTRAST)',
      'adaptStructuralLineInkForCanvas(wall.color ?? \'#000000\', WALL_LINE_CONTRAST).ink');
    const result = analyze(miniRepo({ [WALL_RENDERER]: wall }));
    expect(statesOf(result)).toContain(STATES.UNREACHABLE_PRESET);
  });

  it('Μ5: ΝΕΟ μεσοτονικό preset θέμα κάνει ανέφικτο κατώφλι που ήταν εφικτό', () => {
    const theme = mutate(read(REPO_ROOT, CANVAS_THEME),
      "{ key: 'nestorApp1',", "{ key: 'muddy', cssValue: '#787878', swatchClass: '', textClass: '' },\n  { key: 'nestorApp1',");
    const limits = reachabilityLimits(presentableSurfaces(miniRepo({ [CANVAS_THEME]: theme })));
    expect(limits.worstPreset.key).toBe('muddy');
    expect(limits.worstPreset.max).toBeLessThan(5);
  });

  it('Μ6: ανεπίλυτη επιφάνεια θέματος ⇒ ΣΦΑΛΜΑ, ποτέ σιωπηλή παράλειψη', () => {
    const theme = mutate(read(REPO_ROOT, CANVAS_THEME),
      'var(--canvas-themes-cinema4d)', 'var(--canvas-themes-does-not-exist)');
    expect(() => presentableSurfaces(miniRepo({ [CANVAS_THEME]: theme }))).toThrow(/Ανεπίλυτη επιφάνεια/);
  });

  it('Μ7: μετονομασία ΚΑΘΕ παραμέτρου «contrast» ⇒ η πύλη ΣΚΑΕΙ (fail-closed)', () => {
    const api = read(REPO_ROOT, ADAPTIVE_MODULE)
      .split('minContrast').join('minThing')
      .split('brightContrast').join('brightThing');
    const root = miniRepo({ [ADAPTIVE_MODULE]: api });
    expect(() => readAdaptiveApi(root, createReader(root))).toThrow(/Καμία προσαρμοστική συνάρτηση/);
  });

  it('Μ8: αν σπάσει ο προσαρμογέας μονάδων, το πιάνει η ΒΑΘΜΟΝΟΜΗΣΗ πριν από κάθε ετυμηγορία', () => {
    // Ο ίδιος ο μηχανισμός που έσωσε την πύλη στην πρώτη της εκτέλεση: κανάλια 0..1 σε
    // συνάρτηση που θέλει 0..255 δίνει ~20,9 για ΚΑΘΕ επιφάνεια — «όλα εντάξει, πάντα».
    const wrongUnits = maxAchievableOn('#555555');
    expect(wrongUnits).toBeCloseTo(7.46, 1);
    expect(wrongUnits).toBeLessThan(customSurfaceCeiling() * 2);
  });

  it('Μ9: το PRESET_THEMES χωρίς array literal ⇒ ΣΦΑΛΜΑ, όχι «καμία επιφάνεια»', () => {
    const theme = mutate(read(REPO_ROOT, CANVAS_THEME),
      'export const PRESET_THEMES: ThemeConfig[] = [', 'export const PRESET_THEMES: ThemeConfig[] = buildThemes([');
    expect(() => presentableSurfaces(miniRepo({ [CANVAS_THEME]: theme }))).toThrow(/PRESET_THEMES/);
  });
});

// ── Π1..Π3 — Ο ΠΡΑΓΜΑΤΙΚΟΣ ΙΣΤΟΡΙΚΟΣ ΚΩΔΙΚΑΣ ────────────────────────────────────────────

describe('Π — ο ιστορικός κώδικας, από καρφωμένο commit', () => {
  it('Π0: το ιστορικό είναι διαθέσιμο (αλλιώς τα Π από κάτω δεν αποδεικνύουν τίποτα)', () => {
    expect(gitShow(PRE_PHASE3_COMMIT, ADAPTIVE_MODULE)).toContain('adaptColorToBackground');
  });

  it('Π1: η σιωπηλή παράδοση ΥΠΗΡΧΕ αυτούσια — `return target` χωρίς καμία ειδοποίηση', () => {
    const src = gitShow(PRE_PHASE3_COMMIT, ADAPTIVE_MODULE);
    expect(src).toContain('if (contrastRatio(target, bgHex) < minContrast) return target;');
    expect(src).not.toContain('InkVerdict');
  });

  it('Π2: ο WallRenderer ζητούσε 9.0 μέσα από API που ΔΕΝ μπορούσε να πει «απέτυχα»', () => {
    const src = gitShow(PRE_PHASE3_COMMIT, WALL_RENDERER);
    expect(src).toContain('adaptStructuralLineColorForCanvas');
    expect(src).not.toContain('adaptStructuralLineInkForCanvas');
    expect(gitShow(PRE_PHASE3_COMMIT, WALL_PALETTE)).toContain('WALL_LINE_CONTRAST = 9.0');
  });

  it('Π3: η πύλη ΜΠΛΟΚΑΡΕΙ τον ιστορικό κώδικα — το ελάττωμα ήταν αληθινό, όχι υποθετικό', () => {
    const root = miniRepo({}, (rel) => gitShow(PRE_PHASE3_COMMIT, rel));
    const result = analyze(root, [WALL_RENDERER]);
    expect(result.blocking.length).toBeGreaterThan(0);
    expect(statesOf(result)).toContain(STATES.UNREACHABLE_PRESET);
  });
});

// ── Κ1..Κ8 — ΚΟΚΚΙΩΣΗ ΚΑΙ ΔΗΛΩΜΕΝΑ ΟΡΙΑ ─────────────────────────────────────────────────

describe('Κ — τι πιάνει και τι ΔΕΝ πιάνει, δηλωμένο', () => {
  it('Κ1: το ίδιο το αρχείο ορισμού ΔΕΝ κρίνεται — ο wrapper οφείλει να πετά την ετυμηγορία', () => {
    const result = analyze(miniRepo(), [ADAPTIVE_MODULE]);
    expect(result.sites.length).toBeGreaterThan(0);
    for (const s of result.sites) expect(s.state).toBe(STATES.DEFINITION);
  });

  it('Κ2: τα tests δεν είναι υποσχέσεις προϊόντος — μετριούνται, δεν μπλοκάρουν', () => {
    expect(isTestFile('src/a/__tests__/b.ts')).toBe(true);
    expect(isTestFile('src/a/b.test.tsx')).toBe(true);
    expect(isTestFile('src/a/b.spec.ts')).toBe(true);
    expect(isTestFile('src/a/b.ts')).toBe(false);
  });

  it('Κ3: το φράγμα διακρίνει preset από custom — δύο ερωτήσεις, δύο απαντήσεις', () => {
    const limits = { worstPreset: { key: 'cinema4d', max: 7.46 }, customCeiling: 4.58 };
    expect(reachabilityGap(3.0, limits)).toBeNull();
    expect(reachabilityGap(4.5, limits)).toBeNull();
    expect(reachabilityGap(5.0, limits)).toBe('custom');
    expect(reachabilityGap(9.0, limits)).toBe('preset');
  });

  it('Κ4: η ΠΡΟΕΠΙΛΟΓΗ παραμέτρου διαβάζεται — μια κλήση χωρίς όρισμα ΔΕΝ είναι αόρατη', () => {
    const root = miniRepo();
    const api = readAdaptiveApi(root, createReader(root));
    const entry = api.get('adaptEntityColorForCanvas');
    expect(entry.hasDefault).toBe(true);
    expect(entry.defaultThreshold).toBe(3);
  });

  it('Κ5: ο τύπος επιστροφής καθορίζει ποιος «μπορεί να μάθει» — όχι λίστα ονομάτων', () => {
    const root = miniRepo();
    const api = readAdaptiveApi(root, createReader(root));
    expect(api.get('adaptStructuralLineInkForCanvas').returnsVerdict).toBe(true);
    expect(api.get('adaptInkForSurface').returnsVerdict).toBe(true);
    expect(api.get('adaptStructuralLineColorForCanvas').returnsVerdict).toBe(false);
    expect(api.get('adaptColorToBackground').returnsVerdict).toBe(false);
  });

  it('Κ6: κάθε κλήση πέφτει σε ΜΙΑ κατάσταση — κλειστή λογιστική, κανένα κενό', () => {
    const known = new Set(Object.values(STATES));
    for (const s of analyze(miniRepo()).sites) expect(known.has(s.state)).toBe(true);
  });

  it('Κ7: ΔΗΛΩΜΕΝΟ ΟΡΙΟ — η πύλη ΔΕΝ αποδεικνύει ότι ζωγραφίζεται casing', () => {
    // Ο καλών παίρνει την ετυμηγορία και μπορεί να την αγνοήσει· εκεί απαντά η ΑΓΚΥΡΑ
    // (`wall-contrast-casing.test.ts`), που καταγράφει τα πραγματικά περάσματα σχεδίασης.
    const wall = mutate(read(REPO_ROOT, WALL_RENDERER),
      'strokeWithContrastCasing(this.ctx, _edgeInk, _edgePx, () => this.ctx.stroke());',
      'void _edgeInk; this.ctx.stroke();');
    expect(analyze(miniRepo({ [WALL_RENDERER]: wall })).blocking).toEqual([]);
  });

  it('Κ8: ο σαρωτής βλέπει ΚΑΙ `mod.f(…)` — όχι μόνο γυμνό αναγνωριστικό', () => {
    const wall = mutate(read(REPO_ROOT, WALL_RENDERER),
      'adaptStructuralLineInkForCanvas(wall.color', 'adaptiveNs.adaptStructuralLineColorForCanvas(wall.color');
    expect(statesOf(analyze(miniRepo({ [WALL_RENDERER]: wall })))).toContain(STATES.UNREACHABLE_PRESET);
  });

  it('Κ9: ΕΙΣΑΓΩΓΗ ΜΕ ΨΕΥΔΩΝΥΜΟ δεν κρύβει την υπόσχεση (`import { f as g }`)', () => {
    // Χωρίς τον χάρτη τοπικών ονομάτων, το `g(…)` δεν είναι στο API ⇒ σιωπηλή απουσία,
    // δηλαδή η πύλη θα ανακοίνωνε «καθαρό» για κώδικα που δεν κοίταξε καθόλου.
    const wall = read(REPO_ROOT, WALL_RENDERER)
      .split('adaptStructuralLineInkForCanvas } from').join('adaptStructuralLineColorForCanvas as adaptLine } from')
      .split('adaptStructuralLineInkForCanvas(').join('adaptLine(');
    const result = analyze(miniRepo({ [WALL_RENDERER]: wall }));
    expect(statesOf(result)).toContain(STATES.UNREACHABLE_PRESET);
  });

  it('Κ10: το προφίλτρο κειμένου είναι ΑΣΦΑΛΕΣ — απορρίπτει μόνο αρχεία χωρίς κανένα όνομα API', () => {
    const root = miniRepo();
    const api = readAdaptiveApi(root, createReader(root));
    expect(mayContainPromise('const x = 1;', api)).toBe(false);
    expect(mayContainPromise('import { adaptColorForSurface as z } from "x";', api)).toBe(true);
    // Κάθε αρχείο με έστω μία κλήση περνά το φίλτρο — αλλιώς το «γρήγορο» θα ήταν «τυφλό».
    for (const rel of [WALL_RENDERER, TABLE_INK, ADAPTIVE_MODULE]) {
      expect(mayContainPromise(read(REPO_ROOT, rel), api)).toBe(true);
    }
  });

  it('Κ11: η σκανδάλη πυροδοτεί σε SSoT input, σε καταναλωτή, ΚΑΙ στα ίδια τα αρχεία της πύλης', () => {
    const root = miniRepo();
    const reader = createReader(root);
    const api = readAdaptiveApi(root, reader);
    const runFull = (files) => shouldRunFull(files, api, createReader(REPO_ROOT));
    expect(runFull([VARIABLES_CSS])).toBe(true);
    expect(runFull([CANVAS_THEME])).toBe(true);
    expect(runFull([WALL_RENDERER])).toBe(true);
    expect(runFull(['scripts/lib/contrast-promise/presentable-surfaces.js'])).toBe(true);
    expect(runFull(['src/subapps/dxf-viewer/bim/table/table-layout-place.ts'])).toBe(false);
    expect(runFull(['README.md'])).toBe(false);
    void reader;
  });
});
