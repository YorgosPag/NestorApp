#!/usr/bin/env node
/**
 * CHECK 12 / ADR-598 G13 — ΜΗΧΑΝΗ ΠΟΛΙΤΙΚΗΣ ΑΔΕΙΩΝ (CLAUDE.md N.5). Ένα CLI για hook ΚΑΙ CI.
 *
 * «Επιτρέπει η πολιτική κάθε άδεια του γράφου prod που θα γίνει commit — και το ξέρουμε, ή
 *  απλώς δεν κοιτάξαμε;»
 *
 * Σειρά (κάθε βήμα που δεν μετρά ⇒ UNKNOWN, ποτέ «καθαρό»):
 *   1. πολιτική   `.license-policy.json` διαβάζεται και επικυρώνεται
 *   2. lockfile   του commit (`--lockfile=staged` στον hook · `worktree` στο CI) = εγκατεστημένο
 *   3. απογραφή   `pnpm licenses list --json --prod` — ΟΛΟΣ ο γράφος, στη μνήμη
 *   4. κρίση      κάθε πακέτο + κάθε απόφαση πολιτικής, ακριβώς μία κατάσταση
 *
 * Έξοδοι (σύμβαση Snyk CLI / Monitoring Plugins):
 *   0 — μετρήθηκε, καθαρό
 *   1 — μετρήθηκε, ΠΑΡΑΒΑΣΗ πολιτικής
 *   2 — UNKNOWN: η μέτρηση ΔΕΝ έγινε (εργαλείο, απόκλιση lockfile, πολιτική άκυρη)
 *
 * CLI:
 *   node scripts/check-license-policy.js [--lockfile=staged|worktree]
 *   node scripts/check-license-policy.js --report     # πλήρης λογιστική
 *   node scripts/check-license-policy.js --propose    # σκελετοί απόφασης (ΔΕΝ γράφει τίποτα)
 */

'use strict';

const path = require('node:path');

const P = require('./lib/license-policy/policy');
const I = require('./lib/license-policy/inventory');
const { judge } = require('./lib/license-policy/judge');
const R = require('./lib/license-policy/report');
const { EXIT } = require('./lib/license-policy/states');
const { SPAWN_OUTCOME } = require('./lib/spawn-outcome');

function parseArgs(argv) {
  const out = { lockfile: 'worktree', report: false, propose: false, help: false };
  for (const a of argv) {
    if (a === '--report') out.report = true;
    else if (a === '--propose') out.propose = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--lockfile=staged' || a === '--lockfile=worktree') out.lockfile = a.split('=')[1];
    else throw new Error(`άγνωστο όρισμα: ${a}`);
  }
  return out;
}

/**
 * Εγχύσεις για τη σουίτα ως υποδιεργασία. ⚠️ Γίνονται δεκτές **μόνο** μέσα σε jest
 * (`JEST_WORKER_ID`): ένα env που δείχνει σε ψεύτικο εργαλείο με «καθαρή» έξοδο θα ήταν
 * σιωπηλή παράκαμψη της πύλης — δηλαδή `SKIP_*` με άλλο όνομα.
 */
function testInjections(env) {
  if (!env.JEST_WORKER_ID) return {};
  const out = {};
  if (env.LICENSE_POLICY_REPO_ROOT) out.repoRoot = env.LICENSE_POLICY_REPO_ROOT;
  if (env.LICENSE_POLICY_FILE) out.policyFile = env.LICENSE_POLICY_FILE;
  if (env.LICENSE_POLICY_INVENTORY_COMMAND) out.command = JSON.parse(env.LICENSE_POLICY_INVENTORY_COMMAND);
  if (env.LICENSE_POLICY_NOW) out.now = Date.parse(env.LICENSE_POLICY_NOW);
  return out;
}

function measure(deps) {
  const loaded = P.loadPolicy(deps.policyFile);
  if (!loaded.ok) {
    return { unknown: { outcome: 'policy-invalid', detail: loaded.error, command: `read ${deps.policyFile}`,
      remedy: `διόρθωσε το ${P.POLICY_FILE_NAME} — μια πολιτική που δεν διαβάζεται δεν είναι «καμία παράβαση»` } };
  }
  const drift = I.checkLockfileDrift({ repoRoot: deps.repoRoot, source: deps.lockfile });
  if (drift.state !== 'in-sync') {
    const ev = drift.evidence || {};
    return { unknown: { outcome: `lockfile-${drift.state}`, detail: drift.detail, command: ev.command || `compare ${I.LOCKFILE} ↔ ${I.INSTALLED_LOCKFILE}`,
      status: ev.status, signal: ev.signal, output: ev.stderr, remedy: 'pnpm install — και ξανά το commit (η κρίση πρέπει να αφορά το δέντρο που θα φύγει)' } };
  }
  const inventory = I.runLicenseInventory({ cwd: deps.repoRoot, command: deps.command });
  if (inventory.outcome !== SPAWN_OUTCOME.RAN) {
    return { unknown: { ...inventory, output: `${inventory.stderr}\n${inventory.stdout}`,
      remedy: 'βεβαιώσου ότι το pnpm τρέχει (`pnpm -v`) και ότι έχει γίνει pnpm install' } };
  }
  const verdict = judge(loaded.policy, {
    packages: inventory.packages, lockfileKeys: I.lockfilePackageKeys(drift.lockfileText),
    patched: I.patchedDependencies(deps.repoRoot), now: deps.now,
  });
  return { verdict, inventory };
}

/** @returns {number} κωδικός εξόδου — η εκτύπωση γίνεται εδώ, το `process.exit` στον καλούντα. */
function main(argv = process.argv.slice(2), injected = testInjections(process.env)) {
  const args = parseArgs(argv);
  if (args.help) { console.log(require('node:fs').readFileSync(__filename, 'utf8').split('*/')[0]); return EXIT.OK; }
  const deps = {
    repoRoot: I.PROJECT_ROOT, policyFile: null, command: undefined, now: Date.now(), lockfile: args.lockfile, ...injected,
  };
  deps.policyFile = deps.policyFile || path.join(deps.repoRoot, P.POLICY_FILE_NAME);
  if (Object.keys(injected).length) console.log(`🧪 ${R.TITLE} — δοκιμαστική έγχυση: ${Object.keys(injected).join(', ')}`);

  const m = measure(deps);
  if (m.unknown) { R.printUnknown(m.unknown); return EXIT.UNKNOWN; }

  const { verdict, inventory } = m;
  if (args.report) R.printReport(verdict, { packageCount: inventory.packages.length, command: inventory.command });
  R.printDecisionNotes(verdict);
  if (args.propose) R.printProposals(verdict, new Date(deps.now).toISOString().slice(0, 10));
  if (verdict.blocking.length) { R.printViolations(verdict); return EXIT.VIOLATION; }
  const t = verdict.packageTally;
  console.log(`✅ ${R.TITLE} — ${inventory.packages.length} πακέτα prod: ${t.allowed} επιτρεπτά · ${t.curated} με επιμέλεια · ${t.excepted} με εξαίρεση · ${t.converted} μετατραπέντα`);
  return EXIT.OK;
}

module.exports = { parseArgs, main, measure, testInjections };

if (require.main === module) {
  let code;
  try {
    code = main();
  } catch (error) {
    // Σφάλμα της ίδιας της μηχανής ⇒ ΟΥΤΕ αυτό είναι «καθαρό».
    console.error(`❌ ${R.TITLE} — εσωτερικό σφάλμα της μηχανής (UNKNOWN): ${error.stack || error.message}`);
    code = EXIT.UNKNOWN;
  }
  process.exit(code);
}
