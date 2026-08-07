#!/usr/bin/env node
/**
 * CHECK 3.38 / ADR-770 — Η στατική πύλη αντίθεσης UI, Στρώμα 1.
 *
 * ΤΟ ΜΕΤΡΗΜΕΝΟ ΓΕΓΟΝΟΣ (ADR-759 §4.12.2): στο **προεπιλεγμένο** (σκοτεινό) θέμα το
 * `--primary` λύνεται σε `217 33% 17%` — **ταυτόσημο με το `--card`**. Άρα το
 * `text-primary` εκεί δεν είναι δυσανάγνωστο· είναι **ανύπαρκτο**: αποτυγχάνει σε
 * **23/23** επιφάνειες του θέματος, με τέσσερις να δίνουν ακριβώς **1,00:1**.
 *
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΝΕΑ ΠΥΛΗ — τι ΔΕΝ κάλυπτε τίποτα:
 *   · CHECK 3.32 (ADR-710 §10) μετρά **μόνο** την παλέτα γραφημάτων.
 *   · ADR-598 G11 (a11y coverage) ρωτά **αν υπάρχει test**, όχι τι λέει.
 *   · `jsx-a11y` ratchet είναι lint **σήμανσης**, όχι χρώματος.
 *   · Ο μεταγλωττιστής και ο Tailwind δεν έχουν λόγο: μια κλάση είναι συμβολοσειρά.
 * Δηλαδή κάθε νέα αόρατη χρήση περνούσε **με όλες τις πύλες πράσινες**. Έτσι έφτασαν
 * οι 424.
 *
 * ΔΥΟ ΣΤΡΩΜΑΤΑ ΚΟΣΤΟΥΣ (πρότυπο 3.29/3.30/3.34):
 *   Layer 1  — pre-commit, **μόνο τα staged** (~50-150ms).
 *   Layer 1b — CI, `--all`, πλήρες δέντρο (~2,7s).
 * ⚠️ ΔΗΛΩΜΕΝΟ ΟΡΙΟ: το Layer 1 **δεν ξαναταξινομεί μη-staged αρχεία**. Ένα νέο scoped
 * override του `--primary` αλλάζει την κατάταξη αρχείων που δεν άγγιξες — αυτό το
 * βλέπει **μόνο** το `--all`. Χωρίς αυτή τη δήλωση το πράσινο θα σήμαινε «δεν κοίταξα».
 *
 * ΤΡΕΙΣ ΚΑΤΗΓΟΡΙΕΣ ΕΤΥΜΗΓΟΡΙΑΣ — καμία σιωπηλή απόρριψη:
 *   RATCHETED  theme-surface · file-light-bg · element-light-bg
 *              Ο σαρωτής **δεν ονομάζει καμία κατάσταση «εντάξει»** (βλ. την
 *              τεκμηρίωσή του): αποδεικνύει βλάβη, δεν αποδεικνύει υγεία, γιατί το
 *              φόντο είναι ερώτημα **προγόνων** στον browser. Άρα ratchet-άρονται και
 *              οι τρεις. Από τις 426, οι **424 είναι αποδεδειγμένα σπασμένες** και οι
 *              2 (`element-light-bg`) εξετάστηκαν με το μάτι και είναι σωστές.
 *   ZERO-TOL   inert-class · κολλημένες utilities (glued-class.js)
 *              Δεν υπάρχει νόμιμη περίπτωση: ΠΟΤΕ baseline. Το δέντρο είναι στο 0.
 *   IGNORED    in-comment — δεν αποδίδεται από τον browser.
 *
 * ⚠️ ΤΟ ΠΛΗΘΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ. Είναι «πόσα σημεία δεν μπορεί να αποδείξει
 * υγιή η στατική ανάλυση». Η θεραπεία δεν είναι «μείωσε τον αριθμό» αλλά ρόλοι `on-*`
 * (Material 3) — ADR-759 §4.12.2. **Άνοιξε τη baseline πριν επικαλεστείς αριθμό.**
 *
 * ΓΙΑΤΙ ΑΝΑ ΑΡΧΕΙΟ ΚΑΙ ΑΝΑ ΚΑΤΑΣΤΑΣΗ, ΟΧΙ ΕΝΑΣ ΑΡΙΘΜΟΣ: το ADR-749 απέδειξε ότι ένα
 * καθαρά αριθμητικό ratchet αφήνει αρχείο να **ανταλλάξει** παραβιάσεις και να περάσει.
 * Ο αριθμός γραμμής **δεν** μπαίνει στην ταυτότητα — θα κοκκίνιζε σε κάθε μετακίνηση
 * από πάνω. Δηλωμένο κενό: ανταλλαγή μέσα στο **ίδιο** αρχείο, **ίδια** κατάσταση
 * περνάει· οι δύο χρήσεις είναι εξίσου αόρατες.
 *
 * CLI:
 *   node scripts/check-text-primary-ratchet.js                  # staged (Layer 1)
 *   node scripts/check-text-primary-ratchet.js --all            # πλήρες δέντρο (Layer 1b/CI)
 *   node scripts/check-text-primary-ratchet.js --write-baseline # reseed (πάντα πλήρες)
 *
 * Env: SKIP_TEXT_PRIMARY_RATCHET=1 · STAGED_SRC_TS_FILES · TEXT_PRIMARY_BASELINE_FILE
 * Exit: 0 = εντάξει · 1 = baseline λείπει/χαλασμένη ή εμφανίστηκε παλινδρόμηση.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { scanFiles, walkSourceFiles } = require('./lib/contrast/text-primary-sites');
const { readThemes } = require('./lib/contrast/css-token-themes');
const { findGluedClasses } = require('./lib/contrast/glued-class');
const { PROJECT_ROOT, loadBaseline, writeBaselineFile } = require('./lib/ratchet-baseline');

/** Καταστάσεις που μπαίνουν στη baseline. Δες την επικεφαλίδα για το «γιατί και οι τρεις». */
const RATCHETED_STATES = ['theme-surface', 'file-light-bg', 'element-light-bg'];
/** Αποδεδειγμένα σπασμένες — το υποσύνολο που αναφέρεται ως «αόρατες». */
const PROVEN_BROKEN_STATES = ['theme-surface', 'file-light-bg'];
const SOURCE_RE = /^src\/.*\.tsx?$/;

function baselineFile() {
  return process.env.TEXT_PRIMARY_BASELINE_FILE || path.join(PROJECT_ROOT, '.text-primary-baseline.json');
}

function primaryOverrideClasses(root) {
  return (readThemes(root).primaryOverrides || []).map((o) => o.cssClass).filter(Boolean);
}

/**
 * Τα staged αρχεία πηγής, με τρεις πηγές κατά σειρά προτεραιότητας:
 *   1. ορίσματα γραμμής εντολών — έτσι τα δίνει ο Phase 1 worker (`addThread(..., srcTsFiles)`),
 *      όπως τα CHECK 3.15/3.17/3.26/3.35· ρητό, ελέγξιμο, χωρίς κρυφή κατάσταση.
 *   2. `STAGED_SRC_TS_FILES` — για χειροκίνητη κλήση με το ίδιο περιβάλλον του hook.
 *   3. `git diff --cached` — για σκέτο `node scripts/check-text-primary-ratchet.js`.
 */
function stagedSourceFiles(cliFiles = []) {
  if (cliFiles.length > 0) return cliFiles.map(normalize).filter((f) => SOURCE_RE.test(f));
  const fromHook = process.env.STAGED_SRC_TS_FILES;
  const raw = fromHook !== undefined
    ? fromHook.split(/\s+/)
    : execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
        encoding: 'utf8', cwd: PROJECT_ROOT,
      }).split('\n');
  return raw.map(normalize).filter((f) => SOURCE_RE.test(f));
}

const normalize = (f) => f.trim().replace(/\\/g, '/');

/** `{ 'src/a.tsx': { 'theme-surface': 2 }, … }` — μόνο οι ratchet-αρόμενες καταστάσεις. */
function tallyByFile(sites) {
  const out = {};
  for (const s of sites) {
    if (!RATCHETED_STATES.includes(s.state)) continue;
    (out[s.file] ||= {})[s.state] = (out[s.file][s.state] || 0) + 1;
  }
  return out;
}

/**
 * Σαρώνει μια λίστα αρχείων και επιστρέφει και τις τρεις κατηγορίες ετυμηγορίας.
 *
 * ⚠️ ΓΝΩΣΤΗ, ΣΥΝΕΙΔΗΤΗ ΣΠΑΤΑΛΗ: κάθε αρχείο διαβάζεται **δύο** φορές (μία από τον
 * σαρωτή, μία για τις κολλημένες). Στο staged μονοπάτι αφορά 3-10 αρχεία ⇒ αμελητέο.
 * Στο `--all` κοστίζει ~3s από τα ~8,3s. Δεν ενοποιήθηκε επίτηδες: θα απαιτούσε να
 * δεχτεί το SSoT `scanFiles` προ-διαβασμένα κείμενα, δηλαδή **επιφάνεια API για 3s
 * σε ένα CI job** — το `--all` του CHECK 3.35 είναι ~2 λεπτά για σύγκριση.
 */
function inspect(files, overrides) {
  const sites = scanFiles(files.map((f) => path.join(PROJECT_ROOT, f)), overrides);
  const relative = sites.map((s) => ({ ...s, file: path.relative(PROJECT_ROOT, path.resolve(s.file)).replace(/\\/g, '/') }));
  const glued = [];
  for (const f of files) {
    const abs = path.join(PROJECT_ROOT, f);
    if (!fs.existsSync(abs)) continue;
    for (const hit of findGluedClasses(fs.readFileSync(abs, 'utf8'))) glued.push({ file: f, ...hit });
  }
  return {
    tally: tallyByFile(relative),
    inert: relative.filter((s) => s.state === 'inert-class'),
    glued,
  };
}

/**
 * Συγκρίνει τρέχον vs baseline **ανά αρχείο και ανά κατάσταση**.
 *
 * `scope: 'staged'` κοιτάζει μόνο τα αρχεία που σαρώθηκαν — ένα αρχείο που λείπει από
 * το `current` σημαίνει «δεν στάλθηκε», ΟΧΙ «καθαρίστηκε», άρα δεν μετράει ως πρόοδος.
 * `scope: 'all'` έχει δει τα πάντα, οπότε εκεί η απουσία **είναι** πρόοδος.
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
  let invisible = 0;
  for (const states of Object.values(tally)) {
    for (const state of PROVEN_BROKEN_STATES) invisible += states[state] || 0;
  }
  return { invisible, files: Object.keys(tally).length };
}

function printFailure({ regressions, inert, glued }) {
  console.error('❌ CHECK 3.38 (ADR-770) — η αντίθεση UI χειροτέρεψε\n');
  for (const g of glued) {
    console.error(`   🚫 ΚΟΛΛΗΜΕΝΗ ΚΛΑΣΗ [${g.rule}] ${g.file}:${g.line}`);
    console.error(`      ${g.snippet}`);
    console.error('      Λείπει ένα κενό. Χάνονται ΚΑΙ το χρώμα ΚΑΙ η διάταξη — σιωπηλά.');
  }
  for (const s of inert) {
    console.error(`   🚫 ΑΝΥΠΑΡΚΤΗ ΚΛΑΣΗ ${s.file}:${s.line} → "${s.matched}" δεν είναι utility.`);
  }
  for (const r of regressions) {
    const how = r.isNewFile ? 'ΝΕΟ ΑΡΧΕΙΟ' : `${r.was} → ${r.now}`;
    console.error(`   🚫 ${r.file} [${r.state}] ${how}`);
  }
  console.error('\n   Το `text-primary` είναι χρώμα ΕΠΙΦΑΝΕΙΑΣ: στο σκοτεινό θέμα είναι');
  console.error('   ταυτόσημο με το --card (1,00:1). Για μελάνι χρησιμοποίησε token ΣΚΟΠΟΥ:');
  console.error('   text-foreground · text-[hsl(var(--text-info))] · --text-success · --text-warning');
  console.error('\n   Μέτρησε: npm run measure:text-primary');
  console.error('   Έμμεση διαφυγή (αιτιολόγησε στον Giorgio): SKIP_TEXT_PRIMARY_RATCHET=1 git commit ...');
}

function writeBaseline(overrides) {
  const files = walkSourceFiles(path.join(PROJECT_ROOT, 'src'));
  const sites = scanFiles(files, overrides).map((s) => ({ ...s, file: s.file.replace(/\\/g, '/') }));
  const tally = tallyByFile(sites);
  const { invisible, files: fileCount } = totals(tally);
  writeBaselineFile(baselineFile(), {
    _meta: {
      check: 'CHECK 3.38',
      adr: 'ADR-770',
      description: 'Στατική πύλη αντίθεσης UI — χρήσεις του `text-primary` που η στατική ανάλυση ΔΕΝ μπορεί να αποδείξει υγιείς, ανά αρχείο και ανά κατάσταση.',
      generatedBy: 'node scripts/check-text-primary-ratchet.js --write-baseline',
      totalInvisible: invisible,
      totalFiles: fileCount,
      note: 'ΤΟ ΠΛΗΘΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ. Ο σαρωτής αποδεικνύει βλάβη, όχι υγεία (το φόντο είναι ερώτημα προγόνων ⇒ browser). Η θεραπεία είναι ρόλοι on-* (Material 3), όχι μικρότερος αριθμός — ADR-759 §4.12.2. Άνοιξε ΑΥΤΟ το αρχείο πριν επικαλεστείς αριθμό.',
    },
    files: tally,
  });
  console.log(`✅ Baseline: ${path.relative(PROJECT_ROOT, baselineFile())}`);
  console.log(`   ${invisible} αόρατες σε ${fileCount} αρχεία (+ element-light-bg που θέλουν ματιά)`);
}

function main(argv = process.argv) {
  if (process.env.SKIP_TEXT_PRIMARY_RATCHET) return process.exit(0);
  const args = argv.slice(2);
  const overrides = primaryOverrideClasses(PROJECT_ROOT);
  if (args.includes('--write-baseline')) return writeBaseline(overrides);

  const scope = args.includes('--all') ? 'all' : 'staged';
  const files = scope === 'all'
    ? walkSourceFiles(path.join(PROJECT_ROOT, 'src')).map((f) => path.relative(PROJECT_ROOT, f).replace(/\\/g, '/'))
    : stagedSourceFiles(args.filter((a) => !a.startsWith('--')));
  if (files.length === 0) {
    console.log('✅ CHECK 3.38 — κανένα staged αρχείο πηγής.');
    return process.exit(0);
  }

  const baseline = loadBaseline(baselineFile());
  if (!baseline || baseline.__invalid || typeof baseline.files !== 'object') {
    console.error(`❌ CHECK 3.38 — baseline ${baseline ? baseline.__invalid || 'χωρίς πεδίο "files"' : 'λείπει'}: ${path.relative(PROJECT_ROOT, baselineFile())}`);
    console.error('   Δημιούργησε: node scripts/check-text-primary-ratchet.js --write-baseline');
    return process.exit(1); // fail-closed: χαλασμένη baseline ΠΟΤΕ δεν διαβάζεται ως «0 παραβιάσεις»
  }

  const { tally, inert, glued } = inspect(files, overrides);
  const { regressions, progress } = compare(tally, baseline.files, scope);

  if (regressions.length || inert.length || glued.length) {
    printFailure({ regressions, inert, glued });
    return process.exit(1);
  }
  const seen = scope === 'all' ? `${totals(tally).invisible} αόρατες / ${totals(tally).files} αρχεία` : `${files.length} staged αρχεία`;
  console.log(`✅ CHECK 3.38 (ADR-770) — καμία νέα αόρατη χρήση (${seen}).`);
  if (progress.length) {
    console.log(`   📉 ${progress.length} βελτίωση/-εις — κλείδωσέ τες: npm run text-primary:baseline`);
  }
  return process.exit(0);
}

module.exports = {
  RATCHETED_STATES, PROVEN_BROKEN_STATES,
  tallyByFile, inspect, compare, totals,
  primaryOverrideClasses, stagedSourceFiles, baselineFile, main,
};

if (require.main === module) main();
