/**
 * Άγκυρες για το `scripts/lib/framework-types.js` — ADR-787 §5.3 (Β3.2 / Γ0.5).
 *
 * ΤΙ ΦΥΛΑΝΕ: ότι κανένας έλεγχος τύπων δεν τρέχει σε κόσμο όπου λείπουν οι τύποι
 * που παράγει το framework — και, το κρίσιμο, ότι η **επαύξηση** του `next/link`
 * δεν μπορεί να λείψει σιωπηλά όταν το `typedRoutes` είναι ενεργό.
 *
 * ⚠️ ΚΑΘΕ ΟΜΑΔΑ ΕΧΕΙ ΠΑΡΟΝΟΜΑΣΤΗ. Ένα test που βγαίνει πράσινο επειδή δεν υπήρξε
 * ποτέ βλάβη δεν αποδεικνύει φρουρό — αποδεικνύει ήσυχη μέρα. Όπου ελέγχεται
 * απουσία (0 εφήμερα, καμία διαρροή), υπάρχει δίπλα το αντίστροφο σενάριο που
 * **πρέπει** να αποτύχει.
 *
 * @jest-environment node
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const ft = require('../lib/framework-types');
const tsc = require('../lib/tsc-runner');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ─── βοηθήματα ───────────────────────────────────────────────────────────────

/** Μίνι-δέντρο με ΜΟΝΟ τα αρχεία που ζητάει η εγγύηση — μεταλλάξεις στις ΕΙΣΟΔΟΥΣ. */
function miniRepo({ nextEnv = true, routes = true, link = false, distDir = '.next' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-'));
  fs.mkdirSync(path.join(root, distDir, 'types'), { recursive: true });
  if (nextEnv) fs.writeFileSync(path.join(root, 'next-env.d.ts'), '/// <reference types="next" />\n');
  if (routes) fs.writeFileSync(path.join(root, distDir, 'types', 'routes.d.ts'), 'type AppRoutes = "/"\n');
  if (link) fs.writeFileSync(path.join(root, distDir, 'types', 'link.d.ts'), "declare module 'next/link' {}\n");
  return root;
}

/** Τρέχει την εγγύηση ΧΩΡΙΣ να παραχθεί τίποτα — τα μίνι-repo δεν έχουν Next. */
const inspect = (root, expectAugmentation) =>
  ft.ensureFrameworkTypesSync({ projectRoot: root, expectAugmentation, generate: false });

/** Πόσα αρχεία μπαίνουν στο πρόγραμμα από εφήμερο κατάλογο build; */
function countEphemeral(rawConfig) {
  const parsed = ts.parseJsonConfigFileContent(rawConfig, ts.sys, REPO_ROOT);
  return parsed.fileNames
    .map((f) => f.split(path.sep).join('/'))
    .filter((f) => /\/\.next-[^/]+\//.test(f)).length;
}

const readRepoTsconfig = () =>
  ts.readConfigFile(path.join(REPO_ROOT, 'tsconfig.json'), ts.sys.readFile).config;

// ─── Μ0 — το ζωντανό δέντρο ──────────────────────────────────────────────────

describe('Μ0 — ζωντανή αγκύρωση', () => {
  test('Μ0α — το πραγματικό δέντρο έχει τους τύπους του, χωρίς να παραχθεί τίποτα', () => {
    const r = ft.ensureFrameworkTypesSync({ projectRoot: REPO_ROOT, generate: false });
    expect(r.state).toBe(ft.TYPES_STATE.PRESENT);
    expect(ft.isUsable(r.state)).toBe(true);
  });

  test('Μ0β — οι πέντε καταστάσεις είναι παγωμένες, μοναδικές, ΚΑΙ ονομαστικές', () => {
    const values = Object.values(ft.TYPES_STATE);
    expect(values).toHaveLength(5);
    expect(new Set(values).size).toBe(5);
    expect(Object.isFrozen(ft.TYPES_STATE)).toBe(true);
    // Ονομαστικά: μια ΑΝΤΑΛΛΑΓΗ (σβήνω μία, προσθέτω άλλη — 5 → 5) δεν περνά
    // αθόρυβα. Το πλήθος μόνο του δεν είναι ταυτότητα (ADR-749).
    expect(values.sort()).toEqual(
      ['augmentation-missing', 'generated', 'generation-failed', 'present', 'still-missing'].sort()
    );
  });

  test('Μ0γ — ο εκτελεστής tsc μιλά την ίδια γλώσσα (η κατάσταση υπάρχει στο λεξιλόγιό του)', () => {
    expect(tsc.TSC_OUTCOME.FRAMEWORK_TYPES_MISSING).toBe('framework-types-missing');
  });

  test('Μ0δ — ο ΕΚΤΕΛΕΣΤΗΣ σταματά ΠΡΙΝ τον μεταγλωττιστή όταν λείπουν οι τύποι', () => {
    // ⚠️ ΕΚΤΕΛΕΣΗ, ΟΧΙ ΚΕΙΜΕΝΟ. Η πρώτη γραφή αυτής της άγκυρας έψαχνε τη λέξη
    // `ensureFrameworkTypesSync` στην πηγή και έμεινε ΠΡΑΣΙΝΗ όταν η μετάλλαξη
    // `Μ6` έκανε τον κλάδο `if (false)` — οι λέξεις έμειναν, ο φρουρός έφυγε.
    // Το ίδιο μάθημα με τη `Μ6` του CHECK 3.8: κριτής κειμένου δεν είναι κριτής.
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-empty-'));
    const t0 = Date.now();
    const run = tsc.runTsc({
      args: ['--noEmit'],
      // `generate: false` ⇒ καμία απόπειρα `npx next typegen` σε φάκελο χωρίς Next.
      frameworkTypes: { projectRoot: empty, generate: false },
    });
    expect(run.outcome).toBe(tsc.TSC_OUTCOME.FRAMEWORK_TYPES_MISSING);
    // Ο μεταγλωττιστής ΔΕΝ έτρεξε: καμία έξοδος, καμία κατάσταση εξόδου.
    expect(run.combined).toBe('');
    expect(run.status).toBeUndefined();
    // …και δεν πλήρωσε τον χρόνο ενός type-check (N.17: ούτε κατά λάθος).
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  test('Μ0δ2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: με τους τύπους παρόντες, ο ΙΔΙΟΣ κλάδος δεν μπλοκάρει', () => {
    // Χωρίς αυτό, το Μ0δ θα μπορούσε να είναι πράσινο επειδή το `runTsc`
    // επιστρέφει πάντα αυτή την κατάσταση — δηλαδή επειδή είναι σπασμένο.
    const ok = miniRepo({ link: false });
    const types = ft.ensureFrameworkTypesSync({ projectRoot: ok, generate: false });
    expect(ft.isUsable(types.state)).toBe(true);
  });

  test('Μ0ε — ο κόσμος του ΑΝΘΡΩΠΟΥ περνά κι αυτός από τον γεννήτορα', () => {
    // Η επίσημη σύσταση της Vercel, αυτολεξεί: `next typegen && tsc --noEmit`.
    // Χωρίς αυτό, ο τοπικός έλεγχος του Giorgio κρίνει άλλο δέντρο από τις πύλες.
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.typecheck).toMatch(/next typegen\s*&&/);
    expect(pkg.scripts['typecheck:strict']).toMatch(/next typegen\s*&&/);
  });
});

// ─── Κ — τα κριτήρια ─────────────────────────────────────────────────────────

describe('Κ — κριτήρια', () => {
  test('Κ1 — λείπει το next-env.d.ts ⇒ ΔΕΝ είναι χρησιμοποιήσιμο', () => {
    const r = inspect(miniRepo({ nextEnv: false }), false);
    expect(ft.isUsable(r.state)).toBe(false);
    expect(r.missing.map((m) => m.id)).toContain('next-env');
  });

  test('Κ2 — λείπει ο κατάλογος διαδρομών ⇒ ΔΕΝ είναι χρησιμοποιήσιμο', () => {
    const r = inspect(miniRepo({ routes: false }), false);
    expect(ft.isUsable(r.state)).toBe(false);
    expect(r.missing.map((m) => m.id)).toContain('route-types');
  });

  test('Κ3 — typedRoutes ΕΝΕΡΓΟ + λείπει η επαύξηση ⇒ ΞΕΧΩΡΙΣΤΗ κατάσταση', () => {
    // Χωριστή από το `still-missing` επειδή έχει ΑΛΛΗ θεραπεία και είναι η μόνη
    // που ο μεταγλωττιστής δεν θα κατήγγειλε ποτέ μόνος του: λείπει η ΕΡΩΤΗΣΗ.
    const r = inspect(miniRepo({ link: false }), true);
    expect(r.state).toBe(ft.TYPES_STATE.AUGMENTATION_MISSING);
    expect(r.missing.map((m) => m.id)).toEqual(['link-augmentation']);
  });

  test('Κ4 — ΠΑΡΟΝΟΜΑΣΤΗΣ του Κ3: με typedRoutes ΑΝΕΝΕΡΓΟ, το ίδιο δέντρο περνά', () => {
    // Χωρίς αυτό, το Κ3 θα μπορούσε να είναι πράσινο επειδή το μίνι-repo είναι
    // ελλιπές γενικά — όχι επειδή η επαύξηση κρίνεται.
    const root = miniRepo({ link: false });
    expect(inspect(root, true).state).toBe(ft.TYPES_STATE.AUGMENTATION_MISSING);
    expect(inspect(root, false).state).toBe(ft.TYPES_STATE.PRESENT);
  });

  test('Κ5 — η ΣΕΙΡΑ είναι συμβόλαιο: η επαύξηση ονομάζεται ακόμη κι όταν λείπουν κι άλλα', () => {
    const r = inspect(miniRepo({ nextEnv: false, link: false }), true);
    expect(r.state).toBe(ft.TYPES_STATE.AUGMENTATION_MISSING);
    expect(r.missing.map((m) => m.id).sort()).toEqual(['link-augmentation', 'next-env']);
  });

  test('Κ6 — ο φθηνός δρόμος ΔΕΝ κρίνει την επαύξηση — και το ΔΗΛΩΝΕΙ', () => {
    // Αυτή η άγκυρα γεννήθηκε ΚΟΚΚΙΝΗ και βρήκε πραγματικό ελάττωμα: το `null`
    // σήμαινε ταυτόχρονα «μη ρωτάς» και «δεν ξέρω», με ΑΝΤΙΘΕΤΗ σωστή
    // συμπεριφορά, και το σχόλιο έλεγε «fail-closed» πάνω από κώδικα fail-open.
    const r = inspect(miniRepo({ link: false }), ft.NOT_ASKED);
    expect(r.state).toBe(ft.TYPES_STATE.PRESENT);
    // …αλλά ΠΟΤΕ σιωπηλά: το αποτέλεσμα κουβαλά ότι δεν κοιτάχτηκε.
    expect(r.augmentationJudged).toBe(false);
  });

  test('Κ6β — η ΑΓΝΟΙΑ είναι fail-closed, και εκφράζεται ΡΗΤΑ', () => {
    // Όταν το config δεν διαβάζεται, ο καλών περνά `true` — δεν το μαντεύει το
    // module από μια σιωπηλή προεπιλογή.
    const r = inspect(miniRepo({ link: false }), true);
    expect(r.state).toBe(ft.TYPES_STATE.AUGMENTATION_MISSING);
    expect(r.augmentationJudged).toBe(true);
  });

  test('Κ6γ — τρίτη, ανώνυμη τιμή ⇒ ΣΚΑΕΙ· δεν σιωπά τον φρουρό', () => {
    // Ένας παλιός καλών που περνά `null` δεν επιτρέπεται να απενεργοποιήσει
    // αθόρυβα την κρίση της επαύξησης.
    expect(() => inspect(miniRepo({ link: false }), null)).toThrow(TypeError);
    expect(() => inspect(miniRepo({ link: false }), 'yes')).toThrow(TypeError);
  });

  test('Κ6δ — ο ΠΡΑΓΜΑΤΙΚΟΣ εκτελεστής χρησιμοποιεί τον φθηνό δρόμο', () => {
    // Αν το `runTsc` περνούσε `true`, θα μπλόκαρε ΚΑΘΕ έλεγχο τύπων σήμερα
    // (typedRoutes ανενεργό ⇒ link.d.ts δεν υπάρχει). Αυτό ΔΕΝ είναι λεπτομέρεια
    // απόδοσης: είναι η ίδια η διαίρεση ευθυνών.
    const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'lib', 'tsc-runner.js'), 'utf8');
    expect(src).not.toMatch(/expectAugmentation\s*:/);
  });

  test('Κ7 — `generate: false` δεν αγγίζει τον δίσκο', () => {
    const root = miniRepo({ routes: false });
    const before = fs.readdirSync(path.join(root, '.next', 'types'));
    inspect(root, false);
    expect(fs.readdirSync(path.join(root, '.next', 'types'))).toEqual(before);
  });

  test('Κ8 — κάθε απαιτούμενο κουβαλά ΓΡΑΠΤΟ λόγο (κλειστό σύνολο με αιτιολογία)', () => {
    for (const a of ft.requiredArtifacts({ typedRoutes: true })) {
      expect(typeof a.why).toBe('string');
      expect(a.why.length).toBeGreaterThan(20);
    }
  });

  test('Κ9 — το μήνυμα λέει UNKNOWN και ονομάζει τη θεραπεία, ποτέ «0 σφάλματα»', () => {
    const r = inspect(miniRepo({ link: false }), true);
    const msg = ft.formatFrameworkTypesFailure(r);
    expect(msg).toContain('UNKNOWN');
    expect(msg).toContain('next typegen');
    expect(msg).toContain('link.d.ts');
    expect(msg).not.toMatch(/0 σφάλματα|0 errors/);
  });
});

// ─── Τ — ο ΔΟΜΙΚΟΣ φρουρός του tsconfig ──────────────────────────────────────

describe('Τ — το tsconfig δεν σβήνει τη μοναδική φρέσκια αυθεντία', () => {
  test('Τ1 — ο ΚΑΝΟΝΙΚΟΣ κατάλογος build μπαίνει στο πρόγραμμα', () => {
    const parsed = ts.parseJsonConfigFileContent(readRepoTsconfig(), ts.sys, REPO_ROOT);
    const canonical = parsed.fileNames
      .map((f) => f.split(path.sep).join('/'))
      .filter((f) => /\/\.next\/types\//.test(f));
    expect(canonical.length).toBeGreaterThan(0);
  });

  test('Τ2 — κανένας ΕΦΗΜΕΡΟΣ κατάλογος δεν μπαίνει', () => {
    expect(countEphemeral(readRepoTsconfig())).toBe(0);
  });

  test('Τ3 — αντιστέκεται στις ΤΕΣΣΕΡΙΣ μορφές αυτόματης επανεγγραφής', () => {
    // Το `next dev|build|typegen` ΞΑΝΑΓΡΑΦΕΙ μόνο του το include όποτε τρέχει με
    // άλλο distDir («reconfigured your tsconfig.json file for you»). Έτσι μπήκαν
    // οι 3 μπαγιάτικες εγγραφές που κάποιος μετά κομμιτάρισε.
    for (const injected of [
      ['.next-3100/types/**/*.ts'],
      ['.next-3100/types/**/*.ts', '.next-oracle/types/**/*.ts', '.next-bundlecheck/types/**/*.ts'],
      ['.next-*/types/**/*.ts'],
      ['.next-typegenprobe/types/**/*.ts'],
    ]) {
      const cfg = JSON.parse(JSON.stringify(readRepoTsconfig()));
      cfg.include.push(...injected);
      expect(countEphemeral(cfg)).toBe(0);
    }
  });

  test('Τ4 — ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς τον φρουρό στο exclude, η ίδια επανεγγραφή ΠΕΡΝΑΕΙ', () => {
    // Χωρίς αυτό, το «0» του Τ3 θα μπορούσε να σημαίνει «δεν υπάρχουν τέτοιοι
    // φάκελοι στον δίσκο» αντί για «ο φρουρός τους σβήνει».
    const cfg = JSON.parse(JSON.stringify(readRepoTsconfig()));
    cfg.exclude = cfg.exclude.filter((e) => e !== '.next-*');
    cfg.include.push('.next-3100/types/**/*.ts');
    expect(countEphemeral(cfg)).toBeGreaterThan(0);
  });

  test('Τ5 — το exclude ΔΕΝ σβήνει τον κανονικό κατάλογο (η αρχική αντίφαση)', () => {
    // Από το Initial commit ως τις 2026-08-23 το include ζητούσε `.next/types`
    // και το exclude έγραφε `.next` — δηλαδή το έσβηνε. Καμία πύλη δεν ρωτούσε.
    expect(readRepoTsconfig().exclude).not.toContain('.next');
  });
});
