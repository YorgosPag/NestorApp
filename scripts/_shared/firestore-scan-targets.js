/**
 * **ΟΙ ΣΤΟΧΟΙ ΤΩΝ ΣΑΡΩΤΩΝ FIRESTORE** (ADR-924 Φ3) — ποια αρχεία κρίνουν οι CHECK 3.35 (tenant scope) και 3.91
 * (δείκτες Admin SDK). Ήταν δύο δίδυμα αντίγραφα: ίδιο κριτήριο «σαρώσιμου», ίδιος περιπατητής `readdirSync`, ίδιο
 * `git diff --cached` χωρίς `-z`. Εδώ κάθε στόχος έρχεται από την **είσοδο** της πύλης: με `--index` κρίνεται το commit.
 *
 * @module scripts/_shared/firestore-scan-targets
 */

'use strict';

const path = require('node:path');

const { PROJECT_ROOT, projectInput } = require('./firestore-ast-loaders');
const { commitInput } = require('../lib/gate-input');

const rel = (f) => path.relative(PROJECT_ROOT, f).replace(/\\/g, '/');

/** Ο σαρωτής κρίνει **παραγωγικό** κώδικα του `src/`· τα tests έχουν δικά τους συμβόλαια. */
function isScannable(p) {
  const r = rel(p);
  if (!r.startsWith('src/') || !/\.(ts|tsx)$/.test(r)) return false;
  if (/\.(test|spec|d)\.tsx?$/.test(r)) return false;
  return !r.includes('__tests__/') && !r.includes('__mocks__/');
}

/** Κρυφός φάκελος (`.foo/`) — εκτός σάρωσης, όπως πάντα. */
const hiddenDir = (dir) => path.posix.basename(dir).startsWith('.');

/**
 * Οι στόχοι: με μία από τις `fullFlags` ⇒ κάθε σαρώσιμο του `src/` · αλλιώς τα ορίσματα · αλλιώς τα σταδιοποιημένα
 * (`input.staged`). Όσα λείπουν από την όψη ή δεν είναι σαρώσιμα πέφτουν.
 * @param {string[]} argv
 * @param {object} [input] η είσοδος της πύλης — προεπιλογή ο δίσκος του repo
 * @param {string[]} fullFlags
 * @returns {string[]}
 */
function resolveScanTargets(argv, input = projectInput(), fullFlags = ['--all']) {
  if (fullFlags.some((flag) => argv.includes(flag))) {
    return input.files(['src'], { accept: (r) => isScannable(path.join(PROJECT_ROOT, r)), pruneDir: hiddenDir });
  }
  const explicit = argv.filter((a) => !a.startsWith('--'));
  const chosen = explicit.length > 0 ? explicit.map((p) => path.resolve(PROJECT_ROOT, p)) : input.staged();
  return chosen.filter((p) => input.exists(p) && isScannable(p));
}

/**
 * Το κοινό `main` των δύο σαρωτών (ήταν δίδυμο): παράκαμψη · είσοδος (`--index` ⇒ το commit) · στόχοι · και ΜΙΑ από
 * τις τρεις λειτουργίες — γεννήτορας baseline (`baselineFlag`) · αναφορά (`--report`) · κρίση (προεπιλογή).
 * @param {{skipEnv: string, baselineFlag: string, generate: Function, report: Function, check: Function}} spec
 *   κάθε λειτουργία παίρνει `(targets, input)` — η `check` `(targets, { full, input })`
 */
function runScanCli({ skipEnv, baselineFlag, generate, report, check }, argv = process.argv.slice(2)) {
  if (process.env[skipEnv] === '1') process.exit(0);
  const input = commitInput(PROJECT_ROOT, argv);
  const targets = resolveScanTargets(argv, input, ['--all', '--report', baselineFlag]);
  if (targets.length === 0) process.exit(0);
  if (argv.includes(baselineFlag)) {
    generate(targets, input);
    process.exit(0);
  }
  if (argv.includes('--report')) {
    report(targets, input);
    process.exit(0);
  }
  check(targets, { full: argv.includes('--all'), input });
}

module.exports = { isScannable, resolveScanTargets, runScanCli, rel };
