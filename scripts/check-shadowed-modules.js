#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.79 — Η ΠΥΛΗ ΤΟΥ ΣΚΙΑΣΜΕΝΟΥ ΑΡΧΕΙΟΥ (ADR-858)
 * =============================================================================
 *
 * Ερώτημα: *«λύνουν **δύο** αρχεία στο **ίδιο** specifier — και ξέρει κάποιος ποιο κερδίζει;»*
 *
 * 🔴 **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ (2026-09-12).** Ο φάκελος `dxf-viewer/debug/` είχε
 * **και** `index.ts` **και** `index.tsx`. Το πρώτο έγραφε στην κορυφή του *«Pure TypeScript
 * exports for non-React contexts»*· το δεύτερο επανεξήγαγε React panels και QA runners. Το
 * webpack του Next.js λύνει **`.tsx` πριν `.ts`** ⇒ **το `index.ts` δεν φορτώθηκε ΠΟΤΕ**, και
 * **52** αρχεία που ζητούσαν δύο συναρτήσεις logging τραβούσαν ολόκληρο το debug UI.
 *
 * Αυτό **γέννησε κύκλο** (`storage-utils → debug → SnapDebugLogger → γεωμετρία → table-ink →
 * table-surface-mode → storage-utils`) που έκλεινε πάνω σε `STORAGE_KEYS` και έριξε την
 * **παραγωγή**: `Cannot access 'o' before initialization` στο `/sales/available-properties`
 * — σελίδα που δεν ανοίγει καν τον viewer.
 *
 * 🔴 **ΚΑΙ ΔΕΥΤΕΡΗ ΕΜΦΑΝΙΣΗ, ΧΕΙΡΟΤΕΡΗ**: `systems/dynamic-input/index.tsx` ήταν **stub που
 * επέστρεφε `null`** (*«το πλήρες DynamicInputSystem θα μεταφερθεί αργότερα»*) και σκίαζε τον
 * barrel που εξάγει το **αληθινό** component. Δηλαδή η σκίαση δεν φουσκώνει μόνο bundles:
 * **σβήνει λειτουργία σιωπηλά**.
 *
 * 🏆 **ΓΙΑΤΙ ZERO-TOLERANCE ΚΑΙ ΟΧΙ RATCHET.** Η κλάση είναι **κλειστή και μετρήσιμη**: όλο
 * το `src/` είχε **δύο** εμφανίσεις, και οι δύο έφυγαν στο ίδιο commit. Ένα ratchet εδώ θα
 * ήταν baseline με το μηδέν μέσα — δηλαδή zero-tolerance με επιπλέον αρχείο. Ο πήχης της
 * Google για blocking checks (≤10% false positives) περνιέται με άνεση: το κριτήριο είναι
 * **ντετερμινιστικό** (δύο αρχεία, ένα όνομα), όχι ευρετικό.
 *
 * ⚠️ **ΔΕΝ ΑΡΚΕΙ ΤΟ `index.ts` vs `index.tsx`.** Η πύλη ελέγχει **κάθε** σύγκρουση στη
 * μηχανή επίλυσης, σε **δύο** μορφές — έχουν διαφορετική θεραπεία:
 *
 *   Κ1 ⛔ `extension-shadow`  — `x/foo.ts` + `x/foo.tsx`      → σβήσε/μετονόμασε το ένα
 *   Κ2 ⛔ `directory-shadow`  — `x/foo.ts` + `x/foo/index.ts` → το αρχείο κερδίζει· ο φάκελος
 *                                                              είναι αόρατος. Διάλεξε ένα.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΔΕΔΟΜΕΝΟ, ΟΧΙ ΓΝΩΜΗ**: `RESOLVE_ORDER` παρακάτω είναι η σειρά του
 * Next.js. Η πύλη δεν κρίνει «ποιο ΕΠΡΕΠΕ να κερδίσει» — **λέει ποιο ΚΕΡΔΙΖΕΙ**, ώστε η
 * αναφορά να είναι χρήσιμη ακόμη κι όταν ο άνθρωπος διαφωνεί με το αποτέλεσμα.
 *
 * Εκτέλεση:  npm run test:shadowed-modules
 * Παράκαμψη: SKIP_SHADOWED_MODULES=1   (δικαιολόγησέ την στον Giorgio)
 * 📘 docs/gates/3.79.md
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCAN_ROOT = path.join(PROJECT_ROOT, 'src');

/**
 * Η σειρά επίλυσης του Next.js για client bundles. **Η ΙΔΙΑ** που δηλώνει πλέον και το
 * `.dependency-cruiser.cjs` — αν αποκλίνουν, η μία από τις δύο πύλες αναλύει γράφο που δεν
 * εκτελείται (αυτό ακριβώς συνέβη μέχρι τις 2026-09-12).
 */
const RESOLVE_ORDER = ['.js', '.mjs', '.tsx', '.ts', '.jsx', '.json', '.wasm'];

/** Φάκελοι που δεν μπαίνουν ποτέ σε bundle. */
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'coverage', '__snapshots__',
  'archive', 'patches', 'test.BACK',
]);

/**
 * Καταλήξεις που **δεν** είναι υποψήφιες επίλυσης: ένα `foo.d.ts` δεν ανταγωνίζεται το
 * `foo.ts` (διαφορετικό κλειδί), αλλά ένα `foo.stories.tsx` δίπλα σε `foo.stories.ts` θα
 * ήταν γνήσια σύγκρουση — γι' αυτό εξαιρούμε **μόνο** τα declaration files.
 */
const isDeclaration = (name) => name.endsWith('.d.ts') || name.endsWith('.d.mts');

/** Όλα τα αρχεία του `src/`, ως μονοπάτια σχετικά με τη ρίζα του έργου. */
function collectFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectFiles(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

const rel = (abs) => path.relative(PROJECT_ROOT, abs).split(path.sep).join('/');

/**
 * Ποιο αρχείο κερδίζει, κατά `RESOLVE_ORDER`. Άγνωστη επέκταση ⇒ στο τέλος (δεν θα ήταν
 * ποτέ υποψήφια ούτως ή άλλως, αλλά η σύγκριση πρέπει να είναι ολική).
 */
function rankOf(file) {
  const idx = RESOLVE_ORDER.indexOf(path.extname(file));
  return idx === -1 ? RESOLVE_ORDER.length : idx;
}

function winnerOf(files) {
  return [...files].sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b))[0];
}

/**
 * Κάθε specifier που αναφέρεται από import/require/dynamic-import μέσα στο `src/`.
 *
 * 🔑 **ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ — ΤΟ ΚΡΙΤΗΡΙΟ ΔΕΝ ΕΙΝΑΙ «ΔΥΟ ΑΡΧΕΙΑ», ΕΙΝΑΙ «ΑΠΡΟΣΙΤΟ ΑΡΧΕΙΟ».**
 * Η πρώτη εκδοχή αυτής της πύλης κατήγγειλε το `accounting/data/greek-kad-codes.json` επειδή
 * δίπλα του ζει `greek-kad-codes.ts` — αλλά το `.ts` εισάγει το `.json` **με ρητή επέκταση**
 * (`from './greek-kad-codes.json'`), δηλαδή είναι σκόπιμο ζεύγος δεδομένων+τύπων και **κανένα
 * αρχείο δεν είναι αόρατο**. Ένα σκιασμένο αρχείο που κάποιος φτάνει ρητά (με επέκταση, ή με
 * `/index`) **δεν είναι παραβίαση** — είναι επιλογή.
 *
 * Μετρημένο: το κριτήριο αυτό έριξε τα ευρήματα από **18** σε **17** και αφαίρεσε το
 * **μοναδικό** ψευδώς θετικό — δηλαδή το σύνολο που μένει είναι γνήσιο κατά **100%**.
 */
function collectExplicitSpecifiers(files) {
  const IMPORT_RE = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
  /** Απόλυτα μονοπάτια-στόχοι, **όπως τα έγραψε ο καλών** (με ό,τι επέκταση έβαλε ή δεν έβαλε). */
  const targets = new Set();
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // δυαδικό ή απρόσιτο — δεν περιέχει imports
    }
    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[1];
      let abs;
      if (spec.startsWith('.')) {
        // 🔑 Επίλυση ΩΣ ΠΡΟΣ ΤΟ ΑΡΧΕΙΟ ΠΟΥ ΤΗ ΓΡΑΦΕΙ — όχι ταίριασμα κατάληξης.
        // Η πρώτη εκδοχή έκανε `endsWith(specifier)` και ένα οποιοδήποτε `from './index'`
        // κήρυσσε **κάθε** `index.*` του repo προσιτό: 18 ευρήματα → 0, δηλαδή πύλη που
        // «περνά» επειδή δεν κοίταξε. Ακριβώς το σχήμα που κυνηγά το CLAUDE.md N.11/N.12.
        abs = path.resolve(path.dirname(file), spec);
      } else if (spec.startsWith('@/')) {
        abs = path.join(PROJECT_ROOT, 'src', spec.slice(2));
      } else {
        continue; // πακέτο node_modules
      }
      targets.add(path.normalize(abs));
    }
  }
  return targets;
}

/**
 * Φτάνει κάποιος αυτό το αρχείο **ρητά**, παρακάμπτοντας τη σκίαση;
 *
 * Δύο μόνο τρόποι, και οι δύο απαιτούν ο καλών να **έγραψε** κάτι που δείχνει αποκλειστικά
 * εδώ: το πλήρες μονοπάτι με επέκταση (`./foo.json`), ή το μονοπάτι χωρίς επέκταση όταν
 * αυτό δεν είναι το σκιασμένο κλειδί (`./foo/index`).
 */
function isReachedExplicitly(shadowedAbs, targets) {
  const withExt = path.normalize(shadowedAbs);
  const noExt = withExt.slice(0, -path.extname(withExt).length);
  return targets.has(withExt) || targets.has(noExt);
}

function measure() {
  const files = collectFiles(SCAN_ROOT).filter((f) => {
    const base = path.basename(f);
    return RESOLVE_ORDER.includes(path.extname(f)) && !isDeclaration(base);
  });

  // ── Κ1: δύο επεκτάσεις, ένα κλειδί (`x/foo.ts` + `x/foo.tsx`) ──────────────────────────
  const byStem = new Map();
  for (const f of files) {
    const stem = f.slice(0, -path.extname(f).length);
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(f);
  }

  const violations = [];
  for (const [stem, group] of byStem) {
    if (group.length < 2) continue;
    const winner = winnerOf(group);
    violations.push({
      rule: 'extension-shadow',
      specifier: rel(stem),
      winner: rel(winner),
      shadowed: group.filter((f) => f !== winner).map(rel),
    });
  }

  // ── Κ2: αρχείο vs φάκελος (`x/foo.ts` + `x/foo/index.ts`) ─────────────────────────────
  // Το αρχείο κερδίζει πάντα· ό,τι ζει στον φάκελο γίνεται απρόσιτο μέσω του specifier.
  const stems = new Set([...byStem.keys()]);
  for (const stem of stems) {
    if (path.basename(stem) !== 'index') continue;
    const dirAsSpecifier = path.dirname(stem);
    if (!stems.has(dirAsSpecifier)) continue;
    violations.push({
      rule: 'directory-shadow',
      specifier: rel(dirAsSpecifier),
      winner: rel(winnerOf(byStem.get(dirAsSpecifier))),
      shadowed: byStem.get(stem).map(rel),
    });
  }

  // Φιλτράρισμα προσιτότητας — **μόνο** αν υπάρχουν υποψήφιοι, ώστε το συνηθισμένο πράσινο
  // πέρασμα να μη διαβάζει ποτέ 16.000 αρχεία.
  let survivors = violations;
  if (violations.length > 0) {
    const specifiers = collectExplicitSpecifiers(files);
    survivors = [];
    for (const v of violations) {
      const stillHidden = v.shadowed.filter(
        (s) => !isReachedExplicitly(path.join(PROJECT_ROOT, s), specifiers),
      );
      if (stillHidden.length > 0) survivors.push({ ...v, shadowed: stillHidden });
    }
  }

  survivors.sort((a, b) => a.specifier.localeCompare(b.specifier));
  return { scanned: files.length, violations: survivors };
}

const BASELINE = path.join(PROJECT_ROOT, '.shadowed-modules-baseline.json');

/** Σταθερή ταυτότητα παραβίασης — ό,τι χρειάζεται για «είναι ΑΥΤΗ η ίδια;». */
const identityOf = (v) => `${v.rule}|${v.specifier}|${v.shadowed.slice().sort().join(',')}`;

function loadBaseline() {
  if (!fs.existsSync(BASELINE)) return new Set();
  const raw = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  return new Set(raw.violations.map(identityOf));
}

function writeBaseline(violations) {
  const payload = {
    description:
      'ADR-858 — baseline της CHECK 3.79 (σκιασμένα αρχεία). ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ, όχι κατά αριθμό: ' +
      'νέα σκίαση μπλοκάρει ακόμη κι αν το πλήθος έπεσε. Κ1 (extension-shadow) ΔΕΝ μπαίνει ποτέ ' +
      'εδώ — είναι zero-tolerance. Ratchet DOWN-only: σβήσε γραμμές όταν καθαρίζεις, ποτέ πρόσθεσε.',
    generatedBy: 'node scripts/check-shadowed-modules.js --write-baseline',
    adr: 'ADR-858',
    gate: '3.79',
    total: violations.length,
    violations,
  };
  fs.writeFileSync(BASELINE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`✅ Baseline γράφτηκε: ${violations.length} σκιάσεις → ${rel(BASELINE)}`);
}

function main() {
  if (process.env.SKIP_SHADOWED_MODULES === '1') {
    console.log('⏭️  CHECK 3.79 — παρακάμφθηκε (SKIP_SHADOWED_MODULES=1)');
    return;
  }

  const { scanned, violations } = measure();

  if (process.argv.includes('--write-baseline')) {
    // Κ1 ΠΟΤΕ στη baseline: αν υπάρχει, πρέπει να λυθεί, όχι να κλειδωθεί.
    return writeBaseline(violations.filter((v) => v.rule !== 'extension-shadow'));
  }

  const known = loadBaseline();
  // ⛔ Κ1 — zero-tolerance ΠΑΝΤΑ (`x/foo.ts` + `x/foo.tsx`): η ρίζα του περιστατικού, και
  //        μετρημένα **μηδέν** εμφανίσεις μετά τον καθαρισμό της 2026-09-12.
  // 🔴 Κ2 — ratchet κατά ταυτότητα (`x/foo.ts` + `x/foo/index.ts`): **13** προϋπάρχουσες,
  //        άσχετες με το περιστατικό. Zero-tolerance εδώ θα μπλόκαρε κάθε commit για χρέος
  //        που κανείς δεν δημιούργησε σήμερα — φρουρός που πυροδοτεί χωρίς θεραπεία είναι
  //        ακριβώς το λάθος του αποσυρμένου `not-to-dxf-internals` (ADR-796).
  const blocking = violations.filter(
    (v) => v.rule === 'extension-shadow' || !known.has(identityOf(v)),
  );

  console.log(
    `📐 CHECK 3.79 — σκιασμένα: ${violations.length} (baseline ${known.size}) · ` +
    `σαρώθηκαν ${scanned} · σειρά ${RESOLVE_ORDER.join(' → ')}`,
  );

  if (blocking.length === 0) {
    console.log('✅ Καμία ΝΕΑ σκίαση. Κ1 (extension-shadow): 0.');
    return;
  }

  console.error(`\n❌ CHECK 3.79 — ${blocking.length} ΝΕΑ σκίαση(εις):\n`);
  for (const v of blocking) {
    console.error(`   🚫 [${v.rule}] '${v.specifier}'`);
    console.error(`      ✅ κερδίζει:  ${v.winner}`);
    for (const s of v.shadowed) console.error(`      👻 ΑΟΡΑΤΟ:    ${s}`);
  }
  console.error('\n   Θεραπεία: διάλεξε ΕΝΑ. Μετονόμασε ή σβήσε το σκιασμένο — δεν το φορτώνει κανείς.');
  console.error('   ⚠️ Το σκιασμένο αρχείο ΔΕΝ είναι αβλαβές: γεννά κύκλους εισαγωγών (TDZ στην');
  console.error('      παραγωγή, 2026-09-12) και μπορεί να σβήσει λειτουργία σιωπηλά (null stub).');
  console.error('   ⛔ ΜΗΝ τρέξεις --write-baseline για να «περάσει»: το Κ1 δεν μπαίνει ποτέ εκεί,');
  console.error('      και το Κ2 baseline είναι DOWN-only.');
  console.error('   📘 docs/gates/3.79.md · ADR-858');
  process.exit(1);
}

if (require.main === module) main();

module.exports = {
  measure, RESOLVE_ORDER, winnerOf, rankOf, SCAN_ROOT,
  identityOf, loadBaseline, BASELINE,
};
