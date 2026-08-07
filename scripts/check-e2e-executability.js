#!/usr/bin/env node
/**
 * CHECK 3.46 — **εκτελεσιμότητα της σουίτας e2e** (ADR-775). ZERO TOLERANCE.
 *
 * Ρωτά ένα πράγμα: **«μπορεί αυτή η σουίτα e2e να περάσει;»** — πριν καν αναρωτηθεί κανείς αν
 * *περνάει*.
 *
 * ## ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * Μέχρι 08/08 **κανένα** workflow δεν έτρεχε `playwright test` (μετρημένο: η μόνη αναφορά
 * playwright σε όλο το `.github/workflows/` είναι ένα `playwright install` μέσα στο job του
 * CHECK 3.40). **369 tests σε 5 αρχεία δεν εκτελούνταν πουθενά** — άρα κανείς δεν μάθαινε αν
 * μπορούν να περάσουν. Δεν έλειπε μια πύλη· **έλειπε η εκτέλεση**, και μια σουίτα που δεν
 * τρέχει δεν έχει τρόπο να πει ότι είναι σπασμένη.
 *
 * Η υποψία ήταν ότι φταίει ο bot-blocker. **Η μέτρηση είπε το αντίθετο** και άλλαξε τον
 * σχεδιασμό — δες §Α παρακάτω. Η πραγματική βλάβη ήταν αλλού, και σοβαρότερη.
 *
 * ## Α. 🔴 Ο ΑΡΙΘΜΟΣ ΤΟΥ ADR ΗΤΑΝ ΛΑΘΟΣ — **0/7, ΟΧΙ 7/7**
 * Το ADR-770 §13 δήλωσε «τα **7** projects είναι δομικά σπασμένα, κανένα δεν θέτει
 * `userAgent`». Μετρημένο 2026-08-08: **μηδέν** από τα 7 μπλοκάρονται. Τα device descriptors
 * του Playwright **περιέχουν** `userAgent` (τεκμηρίωση: *«The User Agent is included in the
 * device»*), οπότε κάθε `...devices['Desktop Chrome']` στέλνει ήδη πραγματικό Chrome UA.
 * Η διάγνωση ήταν σωστή **για τον driver του 3.40** (καλεί `newContext()` χωρίς descriptor)
 * και λάθος γενικευμένη στα projects.
 *
 * ⚠️ **Αυτό δεν ακυρώνει την πύλη — τη δικαιολογεί**: η προστασία υπάρχει αλλά είναι **τυχαία**.
 * Κανείς δεν αποφάσισε «τα e2e μας πρέπει να περνούν τον bot-blocker»· προέκυψε επειδή κάποιος
 * ήθελε viewport. Μετρημένο με πραγματικό browser: σκέτο `newContext()` ⇒
 * `HeadlessChrome/143.0.7499.4` ⇒ **403 χωρίς σώμα**. Το επόμενο project που θα γραφτεί χωρίς
 * descriptor το παθαίνει σιωπηλά.
 *
 * ## Β. 🔴 Η ΠΡΑΓΜΑΤΙΚΗ ΒΛΑΒΗ — **το golden δεν ξέρει ποιανού είναι**
 * Το default `snapshotPathTemplate` του Playwright είναι
 * `{...}/{arg}-{projectName}-{platform}{ext}` — τα δύο tokens υπάρχουν **ακριβώς** επειδή
 * *«screenshots differ between browsers and platforms due to different rendering, fonts and
 * more»*. Το `playwright.config.ts` το παρέκαμψε και έσβησε **και τα δύο**, σε **δύο** projects.
 *
 * Συνέπεια, μετρημένη: **40 golden PNG** παραγμένα σε chromium/Windows, με ονόματα που δεν το
 * λένε. Τα projects `firefox`·`webkit`·`Mobile *` **δεν έχουν testMatch**, άρα τρέχουν κι αυτά
 * τα 43 visual tests και συγκρίνονται με τα **ίδια** αρχεία ⇒ **172 βέβαιες αποτυχίες**. Και σε
 * Linux runner αποτυγχάνει **ακόμα και το chromium**, γιατί λείπει και το `{platform}`.
 * Μια προεπιλογή που προστάτευε, παρακάμφθηκε χειροκίνητα, και **κανείς δεν το είδε επειδή
 * κανείς δεν έτρεξε δεύτερο project**.
 *
 * ## Γ. Ο ΤΡΙΤΟΣ ΤΡΟΠΟΣ — **εντολή που δείχνει στο πουθενά**
 * Τέσσερα npm scripts καλούν `playwright test e2e/…` ενώ **δεν υπάρχει φάκελος `e2e/`** στη
 * ρίζα. Το Playwright απαντά «No tests found»: μηδέν κάλυψη με μήνυμα που μοιάζει διαδικαστικό.
 *
 * ## ΤΙ ΔΕΝ ΚΑΝΕΙ — ΔΗΛΩΜΕΝΟ
 * Δεν **τρέχει** τα tests και δεν κρίνει αν περνούν· απαντά μόνο «μπορούν;». Δεν ελέγχει ότι
 * υπάρχει golden για την πλατφόρμα του runner — αυτό είναι ερώτημα εκτέλεσης, όχι ρύθμισης.
 * Δεν αγγίζει το `src/middleware.ts`: το διαβάζει ως **αυθεντία**.
 *
 * Usage:  node scripts/check-e2e-executability.js [--verbose]
 * Escape: SKIP_E2E_EXECUTABILITY=1
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');

const { readBotPatterns, PROJECT_ROOT, MIDDLEWARE_PATH } = require('./lib/e2e-executability/bot-patterns');
const { readProjects, CONFIG_PATH } = require('./lib/e2e-executability/project-identity');
const { evaluate, STATES } = require('./lib/e2e-executability/verdicts');
const { collectSourceFiles } = require('./lib/module-graph/scan-config');

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const SPEC_PATTERN = /(^|\/)e2e\/.*\.spec\.tsx?$|\.e2e\.spec\.tsx?$/;

/** Τα spec αρχεία, ως μονοπάτια σχετικά με τη ρίζα — ό,τι βλέπει και το `playwright test`. */
function readSpecPaths(root) {
  const rootPosix = root.split(path.sep).join('/');
  return collectSourceFiles(root, ['src'])
    .filter((file) => SPEC_PATTERN.test(file))
    .map((file) => (file.startsWith(rootPosix) ? file.slice(rootPosix.length + 1) : file));
}

/** Κάθε npm script, ως {name, command}. */
function readScripts(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  return Object.entries(pkg.scripts || {}).map(([name, command]) => ({ name, command }));
}

function report({ findings, census }, { verbose, projects, specPaths }) {
  console.log(C.dim(`  πηγή patterns : ${MIDDLEWARE_PATH}`));
  console.log(C.dim(`  πηγή projects : ${CONFIG_PATH} (${projects.length}) · ${specPaths.length} spec αρχεία`));

  if (verbose) {
    console.log('');
    for (const [state, count] of Object.entries(census)) {
      const mark = STATES[state].blocking ? '⛔' : '✅';
      console.log(C.dim(`    ${mark} ${state.padEnd(18)} ${String(count).padStart(3)}  ${STATES[state].why}`));
    }
    console.log('');
    for (const p of projects) {
      console.log(C.dim(`    ${p.name.padEnd(16)} UA:${p.userAgentSource.padEnd(26)} golden:${p.snapshotTemplate ?? '<default>'}`));
    }
  }

  if (findings.length === 0) {
    console.log(C.green('\n  [PASS] Α ταυτότητα πελάτη   κάθε project περνά τα BLOCKED_BOT_PATTERNS'));
    console.log(C.green('  [PASS] Β ταυτότητα golden   κάθε ρητό πρότυπο ξεχωρίζει project + πλατφόρμα'));
    console.log(C.green('  [PASS] Γ στόχος εντολής     κάθε `playwright test` δείχνει σε υπαρκτό spec'));
    console.log(C.green('\n✓ CHECK 3.46 PASS\n'));
    return 0;
  }

  console.log('');
  for (const f of findings) {
    console.error(C.red(`  [FAIL] ${f.state.padEnd(18)} ${f.subject}`));
    console.error(C.dim(`         ${f.detail}`));
  }
  console.error(C.red(`\n✗ CHECK 3.46 FAIL — ${findings.length} εύρημα(τα)\n`));
  console.error(C.yellow('  bot-blocked / agent-unresolved'));
  console.error(C.dim('    → δώσε στο project ένα device descriptor (`...devices[\'Desktop Chrome\']`)'));
  console.error(C.dim('      ή ρητό userAgent. ΜΗΝ αφαιρέσεις pattern από το middleware.\n'));
  console.error(C.yellow('  ambiguous-golden'));
  console.error(C.dim('    → βάλε {projectName} και {platform} στο snapshotPathTemplate (είναι το'));
  console.error(C.dim('      DEFAULT του Playwright) και ΜΕΤΟΝΟΜΑΣΕ τα υπάρχοντα golden αντίστοιχα.\n'));
  console.error(C.yellow('  phantom-target'));
  console.error(C.dim('    → διόρθωσε το μονοπάτι του npm script ή σβήσε το script.\n'));
  return 1;
}

function main() {
  const verbose = process.argv.includes('--verbose');
  const root = PROJECT_ROOT;

  const { patterns } = readBotPatterns(root);
  const { projects } = readProjects({ root });
  const specPaths = readSpecPaths(root);
  const scripts = readScripts(root);

  const result = evaluate({ projects, patterns, scripts, specPaths });
  return report(result, { verbose, projects, specPaths });
}

if (require.main === module) process.exit(main());

module.exports = { readSpecPaths, readScripts, main, SPEC_PATTERN };
