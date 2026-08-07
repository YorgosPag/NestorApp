#!/usr/bin/env node
/**
 * CHECK 3.43 / ADR-774 — **η αρχή του χρώματος στα CSS Modules**.
 *
 * ΤΟ ΜΕΤΡΗΜΕΝΟ ΓΕΓΟΝΟΣ (2026-08-07): στα `.css` του `src/` υπάρχουν **711** κλήσεις `var()`.
 * Οι **210** δείχνουν σε custom property που **δεν ορίζεται πουθενά** — και οι **126** από
 * αυτές έχουν **σταθερό χρώμα** ως fallback. Δηλαδή 126 σημεία όπου ένα σκληρό hex είναι
 * **πάντα** η τιμή, δεν αλλάζει ποτέ με το θέμα, και **μοιάζει κεντρικοποιημένο**.
 *
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΝΕΑ ΠΥΛΗ — τι ΔΕΝ κάλυπτε τίποτα:
 *   · Το ADR-773 χαρτογράφησε **επτά** αρχές χρώματος. Τα CSS Modules **δεν είναι καμία από
 *     τις επτά**: η #1 είναι το `globals.css` + `variables.css`, όχι τα 34 `.module.css` του
 *     δέντρου. Είναι η **όγδοη**, αχαρτογράφητη.
 *   · CHECK 3.38 ρωτά για Tailwind **κλάσεις**· εδώ δεν υπάρχει κλάση.
 *   · CHECK 3.39 διαβάζει **δηλώσεις TS**· εδώ η δήλωση είναι CSS.
 *   · CHECK 3.40 **εκτελεί** τα token modules στον browser και βρίσκει `dangling-var` — αλλά
 *     μόνο για το `layoutUtilities.cssVars.*`. Ένα `.module.css` δεν είναι token module.
 *   · CHECK 3.32 μετρά παλέτα **γραφημάτων**.
 *
 * 🔑 ΚΑΙ ΓΙΑΤΙ ΕΙΜΑΣΤΕ **ΑΥΣΤΗΡΟΤΕΡΟΙ ΑΠΟ ΤΟ ΒΙΟΜΗΧΑΝΙΚΟ ΠΡΟΤΥΠΟ**
 * Ο κανόνας `no-unknown-custom-properties` του stylelint — η κανονική απάντηση της βιομηχανίας
 * σε αυτή την ερώτηση — τεκμηριώνει κατά λέξη ότι το `var(--foo, #f00)` **δεν** είναι πρόβλημα.
 * Θεωρεί το fallback απόδειξη πρόθεσης. Άρα το εργαλείο των μεγάλων θα έβγαζε **PASS και στις
 * 126**. Σε εφαρμογή δύο θεμάτων το fallback είναι ακριβώς το αντίθετο: ο λόγος που η βλάβη
 * είναι αόρατη. Δες `lib/css-vars/custom-property-index.js` για την πλήρη τεκμηρίωση.
 *
 * ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ — **ποτέ ένας με «ή»** (μάθημα CHECK 3.41):
 *
 *   Κ1  ZERO-TOL  `var(--αόριστο)` **χωρίς** fallback.
 *                 *Invalid at computed-value time* ⇒ το στοιχείο **κληρονομεί** ⇒ βάφεται με
 *                 χρώμα που δεν είναι λάθος, είναι **αυθαίρετο**. Σήμερα **0** στο δέντρο —
 *                 γι' αυτό το zero-tolerance είναι και εφικτό και ουσιαστικό: κλειδώνει μια
 *                 κατάσταση που **δεν υπάρχει ακόμα**, αντί να την κυνηγήσει μετά.
 *
 *   Κ2  RATCHET   `var(--αόριστο, <σταθερό χρώμα>)`.
 *                 Το hex είναι η τιμή, πάντα. Μονοθεματικό. 126 σήμερα.
 *
 *   Κ3  RATCHET   `@media (prefers-color-scheme: …)` που **βάφει**.
 *                 Απαντά στο **λειτουργικό σύστημα**, ενώ ο χρήστης αλλάζει θέμα με την κλάση
 *                 `.dark` (`defaultTheme="dark"`, `src/app/layout.tsx:70`). Δύο πηγές αλήθειας
 *                 για το ίδιο πράγμα ⇒ **αποκλίνουν εξ ορισμού**, και η μία δεν ακούει τον
 *                 χρήστη. 3 αρχεία σήμερα.
 *
 * Οι τρεις **δεν συμψηφίζονται**: το Κ1 δεν έχει χρωματική διέξοδο, το Κ2 δεν διορθώνεται με
 * fallback, το Κ3 δεν διορθώνεται με σωστό token — ένα σωστό token κάτω από λάθος ερώτηση
 * παραμένει λάθος απάντηση.
 *
 * ΔΗΛΩΜΕΝΑ ΟΡΙΑ (καμία σιωπηλή απόρριψη — δες `USAGE_STATES`):
 *   `dangling-token-fallback`  αόριστο όνομα, αλλά fallback = **άλλο** `var()` ⇒ η τιμή
 *                              έρχεται από πραγματικό token, άρα ακολουθεί το θέμα. Το όνομα
 *                              είναι νεκρό, το χρώμα **δεν** είναι. Αναφέρεται, δεν μπλοκάρει.
 *   `dangling-non-color`       fallback μήκους/γραμματοσειράς ⇒ **άλλη ερώτηση**.
 *   `runtime-namespace`        `--radix-*`, `--tw-*`, `--rmg-*`, `--gantt-*` ⇒ τα γράφει
 *                              τρίτος σε χρόνο εκτέλεσης. Ρητά, με λόγο.
 *
 * ΔΥΟ ΣΤΡΩΜΑΤΑ ΚΟΣΤΟΥΣ:
 *   Layer 1  — pre-commit, **σκανδάλη: σταδιοποιημένο `.css`** (ή τα ίδια τα αρχεία της πύλης).
 *              Τα `.css` αλλάζουν σπάνια, οπότε πληρώνουμε τον **πλήρη** δείκτη (~3 s) και
 *              παίρνουμε **σωστή** απάντηση, αντί για φθηνή προσέγγιση.
 *   Layer 2  — CI, `--all`, **άνευ όρων**, μέσα στο υπάρχον `ui-contrast-ratchet.yml`.
 *
 * ⚠️ ΔΗΛΩΜΕΝΟ ΟΡΙΟ: ο δείκτης ορισμών είναι **καθολικός** — μια διαγραφή στο `globals.css`
 * κάνει αδέσποτα αρχεία που κανείς δεν σταδιοποίησε. Το Layer 1 σαρώνει μόνο τα staged, άρα
 * αυτό το βλέπει **μόνο** το `--all`. Χωρίς αυτή τη δήλωση το πράσινο θα σήμαινε «δεν κοίταξα».
 *
 * CLI:
 *   node scripts/check-css-token-authority.js                  # staged (Layer 1)
 *   node scripts/check-css-token-authority.js --all            # πλήρες δέντρο (Layer 2/CI)
 *   node scripts/check-css-token-authority.js --report         # αναφορά με ΠΑΡΟΝΟΜΑΣΤΗ
 *   node scripts/check-css-token-authority.js --write-baseline # reseed (πάντα πλήρες)
 *
 * Env:  SKIP_CSS_TOKEN_AUTHORITY=1 · STAGED_CSS_FILES · CSS_TOKEN_AUTHORITY_BASELINE_FILE
 * Exit: 0 = εντάξει · 1 = baseline λείπει/χαλασμένη, Κ1 παραβίαση, ή παλινδρόμηση.
 */

'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  USAGE_STATES,
  OS_THEME_STATES,
  buildDefinitionIndex,
  listCssFiles,
  scanCssUsages,
  scanOsThemeBlocks,
} = require('./lib/css-vars/custom-property-index');
const { PROJECT_ROOT, loadBaseline, writeBaselineFile } = require('./lib/ratchet-baseline');

/** Οι καταστάσεις που μπαίνουν στη baseline — **ανά (αρχείο, κατάσταση)**, όχι ένας αριθμός. */
const RATCHETED_STATES = [USAGE_STATES.DANGLING_LITERAL_COLOR, OS_THEME_STATES.CHROMATIC];
/** Καμία baseline, ποτέ. */
const ZERO_TOLERANCE_STATE = USAGE_STATES.DANGLING_NO_FALLBACK;

const CSS_RE = /^src\/.*\.css$/;
const normalize = (f) => f.trim().replace(/\\/g, '/');

function baselineFile() {
  return (
    process.env.CSS_TOKEN_AUTHORITY_BASELINE_FILE ||
    path.join(PROJECT_ROOT, '.css-token-authority-baseline.json')
  );
}

/**
 * Τα staged `.css`, με τρεις πηγές κατά σειρά προτεραιότητας — ίδια σύμβαση με τα CHECK
 * 3.26/3.35/3.38, ώστε ο Phase 1 worker να τα περνά ως ορίσματα χωρίς κρυφή κατάσταση.
 */
function stagedCssFiles(cliFiles = []) {
  if (cliFiles.length > 0) return cliFiles.map(normalize).filter((f) => CSS_RE.test(f));
  const fromHook = process.env.STAGED_CSS_FILES;
  const raw =
    fromHook !== undefined
      ? fromHook.split(/\s+/)
      : execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
          encoding: 'utf8',
          cwd: PROJECT_ROOT,
        }).split('\n');
  return raw.map(normalize).filter((f) => CSS_RE.test(f));
}

/** `{ 'src/a.css': { 'dangling-literal-color': 3, 'os-theme-chromatic': 1 } }` */
function tallyByFile(records) {
  const out = {};
  for (const r of records) {
    if (!RATCHETED_STATES.includes(r.state)) continue;
    (out[r.file] ||= {})[r.state] = (out[r.file][r.state] || 0) + 1;
  }
  return out;
}

/** Σαρώνει τα δοσμένα αρχεία και επιστρέφει **κάθε** κατάσταση — ο παρονομαστής μαζί. */
function inspect(repoRoot, files, definedNames) {
  const usages = scanCssUsages(repoRoot, files, definedNames);
  const osBlocks = scanOsThemeBlocks(repoRoot, files);
  const all = [...usages, ...osBlocks];

  const census = {};
  for (const r of all) census[r.state] = (census[r.state] || 0) + 1;

  return {
    usages,
    osBlocks,
    census,
    tally: tallyByFile(all),
    zeroTolerance: usages.filter((u) => u.state === ZERO_TOLERANCE_STATE),
  };
}

/**
 * Σύγκριση **ανά αρχείο και ανά κατάσταση** (σχήμα v2, ADR-749): ένας σκέτος αριθμός αφήνει
 * αρχείο να **ανταλλάξει** παραβιάσεις και να περάσει. Ο αριθμός γραμμής δεν μπαίνει στην
 * ταυτότητα — θα κοκκίνιζε σε κάθε μετακίνηση από πάνω.
 *
 * `scope: 'staged'` — απουσία αρχείου σημαίνει «δεν στάλθηκε», ΟΧΙ «καθαρίστηκε».
 * `scope: 'all'`    — έχει δει τα πάντα, άρα η απουσία **είναι** πρόοδος.
 */
function compare(current, baselineFiles, scope) {
  const regressions = [];
  const progress = [];
  for (const [file, states] of Object.entries(current)) {
    const before = baselineFiles[file] || {};
    for (const state of RATCHETED_STATES) {
      const now = states[state] || 0;
      const was = before[state] || 0;
      if (now > was) regressions.push({ file, state, was, now, isNewFile: !baselineFiles[file] });
      else if (now < was) progress.push({ file, state, was, now });
    }
  }
  if (scope === 'all') {
    for (const [file, states] of Object.entries(baselineFiles)) {
      if (current[file]) continue;
      for (const state of RATCHETED_STATES) {
        if (states[state]) progress.push({ file, state, was: states[state], now: 0 });
      }
    }
  }
  return { regressions, progress };
}

function totals(tally) {
  let dangling = 0;
  let osTheme = 0;
  for (const states of Object.values(tally)) {
    dangling += states[USAGE_STATES.DANGLING_LITERAL_COLOR] || 0;
    osTheme += states[OS_THEME_STATES.CHROMATIC] || 0;
  }
  return { dangling, osTheme, files: Object.keys(tally).length };
}

// ---------------------------------------------------------------------------
// Έξοδος
// ---------------------------------------------------------------------------

function printCensus(census) {
  const order = [
    USAGE_STATES.DEFINED,
    USAGE_STATES.RUNTIME_NAMESPACE,
    USAGE_STATES.DANGLING_TOKEN_FALLBACK,
    USAGE_STATES.DANGLING_NON_COLOR,
    USAGE_STATES.DANGLING_LITERAL_COLOR,
    USAGE_STATES.DANGLING_NO_FALLBACK,
    OS_THEME_STATES.NON_CHROMATIC,
    OS_THEME_STATES.CHROMATIC,
  ];
  console.log('   απογραφή (κάθε εύρημα σε ΜΙΑ ρητή κατάσταση):');
  for (const state of order) {
    if (!(state in census)) continue;
    console.log(`     ${String(census[state]).padStart(5)}  ${state}`);
  }
}

function printFailure({ regressions, zeroTolerance }) {
  console.error('❌ CHECK 3.43 (ADR-774) — η αρχή του χρώματος στα CSS Modules χειροτέρεψε\n');

  for (const z of zeroTolerance) {
    console.error(`   🚫 Κ1 ΧΩΡΙΣ FALLBACK  ${z.file}:${z.line} → ${z.name}`);
    console.error('      Το όνομα δεν ορίζεται πουθενά ΚΑΙ δεν υπάρχει fallback.');
    console.error('      Η δήλωση είναι *invalid at computed-value time*: το στοιχείο');
    console.error('      ΚΛΗΡΟΝΟΜΕΙ — βάφεται με αυθαίρετο χρώμα, όχι με λάθος χρώμα.');
  }
  for (const r of regressions) {
    const how = r.isNewFile ? 'ΝΕΟ ΑΡΧΕΙΟ' : `${r.was} → ${r.now}`;
    const rule = r.state === OS_THEME_STATES.CHROMATIC ? 'Κ3' : 'Κ2';
    console.error(`   🚫 ${rule} ${r.file} [${r.state}] ${how}`);
  }

  console.error('\n   Κ2 — `var(--x, #hex)` όπου το `--x` δεν υπάρχει ΔΕΝ είναι token:');
  console.error('        το hex είναι η τιμή, πάντα, σε ΚΑΙ ΤΑ ΔΥΟ θέματα.');
  console.error('        Λύση: όρισε το token στο globals.css, ή χρησιμοποίησε υπάρχον');
  console.error('        (`hsl(var(--foreground))`, `hsl(var(--border))`, …).');
  console.error('   Κ3 — `prefers-color-scheme` ρωτά το ΛΕΙΤΟΥΡΓΙΚΟ. Το θέμα εδώ το ορίζει');
  console.error('        η κλάση `.dark` (src/app/layout.tsx:70). Χρησιμοποίησε `.dark &`.');
  console.error('\n   Αναφορά: npm run css-token-authority:report');
  console.error('   Διαφυγή (αιτιολόγησε στον Giorgio): SKIP_CSS_TOKEN_AUTHORITY=1 git commit ...');
}

function report(repoRoot) {
  const definedNames = buildDefinitionIndex(repoRoot);
  const files = listCssFiles(repoRoot);
  const { census, tally, usages, osBlocks } = inspect(repoRoot, files, definedNames);
  const t = totals(tally);

  console.log(`\nCHECK 3.43 — αρχή του χρώματος στα CSS Modules (ADR-774)\n`);
  console.log(`   ${definedNames.size} ορισμένα custom properties · ${files.length} αρχεία .css\n`);
  printCensus(census);

  const byName = new Map();
  for (const u of usages) {
    if (u.state !== USAGE_STATES.DANGLING_LITERAL_COLOR) continue;
    if (!byName.has(u.name)) byName.set(u.name, []);
    byName.get(u.name).push(`${u.file}:${u.line}`);
  }
  console.log(`\n   Κ2 — ${t.dangling} χρήσεις / ${byName.size} ονόματα:\n`);
  for (const [name, uses] of [...byName].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`     ${String(uses.length).padStart(3)}  ${name.padEnd(34)} ${uses[0]}`);
  }
  console.log(`\n   Κ3 — μπλοκ prefers-color-scheme:\n`);
  for (const b of osBlocks) {
    const mark = b.state === OS_THEME_STATES.CHROMATIC ? '🚫' : '  ';
    console.log(`     ${mark} ${b.file}:${b.line}  βάφει: ${b.chromatic}${b.sample.length ? ` (${b.sample.join(', ')})` : ''}`);
  }
  console.log('');
}

function writeBaseline(repoRoot) {
  const definedNames = buildDefinitionIndex(repoRoot);
  const files = listCssFiles(repoRoot);
  const { tally, census } = inspect(repoRoot, files, definedNames);
  const t = totals(tally);

  writeBaselineFile(baselineFile(), {
    _meta: {
      check: 'CHECK 3.43',
      adr: 'ADR-774',
      description:
        'Αρχή του χρώματος στα CSS Modules — `var()` που δείχνει σε ανύπαρκτο custom property με σταθερό χρώμα ως fallback (Κ2), και μπλοκ `prefers-color-scheme` που βάφουν (Κ3). Ανά αρχείο και ανά κατάσταση.',
      generatedBy: 'node scripts/check-css-token-authority.js --write-baseline',
      totalDanglingLiteralColor: t.dangling,
      totalOsThemeChromatic: t.osTheme,
      totalFiles: t.files,
      definedCustomProperties: definedNames.size,
      census,
      note:
        'ΤΟ ΠΛΗΘΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ — είναι «πόσα χρώματα δεν ελέγχει η αρχή θεμάτων». Η θεραπεία είναι ΟΡΙΣΜΟΣ του token στο globals.css (ή χρήση υπάρχοντος), όχι μικρότερος αριθμός. Το stylelint θα έβγαζε PASS σε ΟΛΑ αυτά. Άνοιξε ΑΥΤΟ το αρχείο πριν επικαλεστείς αριθμό.',
    },
    files: tally,
  });
  console.log(`✅ Baseline: ${path.relative(PROJECT_ROOT, baselineFile())}`);
  console.log(`   Κ2 ${t.dangling} χρήσεις · Κ3 ${t.osTheme} μπλοκ · ${t.files} αρχεία`);
}

function main(argv = process.argv) {
  if (process.env.SKIP_CSS_TOKEN_AUTHORITY) {
    console.log('CHECK 3.43 — παρακάμφθηκε (SKIP_CSS_TOKEN_AUTHORITY=1)');
    return process.exit(0);
  }
  const args = argv.slice(2);
  if (args.includes('--report')) {
    report(PROJECT_ROOT);
    return process.exit(0);
  }
  if (args.includes('--write-baseline')) {
    writeBaseline(PROJECT_ROOT);
    return process.exit(0);
  }

  const scope = args.includes('--all') ? 'all' : 'staged';
  const files =
    scope === 'all' ? listCssFiles(PROJECT_ROOT) : stagedCssFiles(args.filter((a) => !a.startsWith('--')));

  if (files.length === 0) {
    console.log('✅ CHECK 3.43 — κανένα staged αρχείο .css.');
    return process.exit(0);
  }

  const baseline = loadBaseline(baselineFile());
  if (!baseline || baseline.__invalid || typeof baseline.files !== 'object') {
    console.error(
      `❌ CHECK 3.43 — baseline ${baseline ? baseline.__invalid || 'χωρίς πεδίο "files"' : 'λείπει'}: ${path.relative(PROJECT_ROOT, baselineFile())}`,
    );
    console.error('   Δημιούργησε: node scripts/check-css-token-authority.js --write-baseline');
    return process.exit(1); // fail-closed: χαλασμένη baseline ΠΟΤΕ δεν διαβάζεται ως «0 παραβιάσεις»
  }

  const definedNames = buildDefinitionIndex(PROJECT_ROOT);
  const { tally, census, zeroTolerance } = inspect(PROJECT_ROOT, files, definedNames);
  const { regressions, progress } = compare(tally, baseline.files, scope);

  if (regressions.length || zeroTolerance.length) {
    printFailure({ regressions, zeroTolerance });
    return process.exit(1);
  }

  const t = totals(tally);
  const seen = scope === 'all' ? `Κ2 ${t.dangling} · Κ3 ${t.osTheme} · ${t.files} αρχεία` : `${files.length} staged .css`;
  console.log(`✅ CHECK 3.43 (ADR-774) — καμία νέα ανεξέλεγκτη χρωματική τιμή (${seen}).`);
  if (scope === 'all') printCensus(census);
  if (progress.length) {
    console.log(`   📉 ${progress.length} βελτίωση/-εις — κλείδωσέ τες: npm run css-token-authority:baseline`);
  }
  return process.exit(0);
}

module.exports = {
  RATCHETED_STATES,
  ZERO_TOLERANCE_STATE,
  tallyByFile,
  inspect,
  compare,
  totals,
  stagedCssFiles,
  baselineFile,
  main,
};

if (require.main === module) main();
