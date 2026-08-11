'use strict';

/**
 * ADR-783 / CHECK 3.54 — **Η ΑΠΟΓΡΑΦΗ**: μπορεί αυτό το αρχείο test να κοκκινίσει κάτι;
 *
 * Το CHECK 3.47 (ADR-776) απάντησε «**ποιος το διεκδικεί;**» — ποιο `jest.config*.js`. Αυτό
 * εδώ είναι το **επόμενο** ερώτημα, και είναι διαφορετικό: ένα αρχείο μπορεί να έχει
 * ιδιοκτήτη config, να **εκτελείται** σε κάθε PR, και **παρ' όλα αυτά** η αποτυχία του να
 * μην αλλάζει τίποτα.
 *
 * ## Η μέτρηση που το γέννησε (2026-08-11, με την ίδια αυτή πύλη, πριν τον εκτελεστή)
 * ```
 * 3.458 κρινόμενα αρχεία test (3.453 jest + 5 playwright)
 * 3.289  μόνο μέσα από `continue-on-error`   ⛔ 95,1 %
 *   162  μπλοκάρουν, αλλά με φίλτρο διαδρομών 🔶
 *     2  μπλοκάρουν άνευ όρων                 ✅ 0,06 %
 *     0  χωρίς κανέναν εκτελεστή
 * ```
 * Δηλαδή **δεν** έλειπε η εκτέλεση: το `coverage-ratchet.yml` τρέχει ολόκληρη τη σουίτα σε
 * κάθε PR. Έλειπε η **συνέπεια**. Το βήμα έχει `continue-on-error: true` (σωστά, για τον
 * δικό του σκοπό: μετρά κάλυψη) και η πύλη του κρίνει **ποσοστό**, όχι pass/fail. Άρα 3.259
 * αρχεία test εκτελούνταν και **κανένα δεν μπορούσε να κοκκινίσει τίποτα**.
 *
 * ⚠️ Τα **162** «με φίλτρο διαδρομών» δεν είναι παρηγοριά: ένα test σπάει από αλλαγή
 * οπουδήποτε (locale JSON, config, εξάρτηση), και το φίλτρο απαντά «δεν με αφορά».
 *
 * Το ίδιο ελάττωμα, τρεις φορές ονομασμένο και ποτέ λυμένο συνολικά:
 *   · ADR-587 §6.1 — 11 tests κόκκινα στο main επί 6 commits (λύση: **μία** πύλη για ~20 άγκυρες)
 *   · ADR-775 §11  — 369 e2e tests που κανένα workflow δεν τρέχει (μένει ανοιχτό)
 *   · ADR-782 §3   — οι νέες άγκυρες `Β`/`Ψ`/`Φ` δεν μπλοκάρουν τίποτα
 * Κάθε φορά γράφτηκε **μπάλωμα ανά ADR**: ένα workflow που τρέχει ονομαστικά τις δικές του
 * σουίτες. Είκοσι εννέα τέτοιες κλήσεις σήμερα, **194 αρχεία** συνολικά — και μια χειρόγραφη
 * λίστα ανά workflow, δηλαδή ακριβώς το σχήμα που στο CHECK 3.34 είχε αποκλίνει κατά 63.
 *
 * ## Έξι ρητές καταστάσεις αρχείου, κλειστή λογιστική
 * ⛔ `unexecuted` · `non-blocking-only`
 * 🔶 `blocking-path-filtered`
 * ✅ `blocking-unconditional` · `declared-exempt` · `outside-partition`
 *
 * ⚠️ Το `outside-partition` **δεν** είναι διαφυγή: είναι τα αρχεία που το CHECK 3.47 ήδη
 * κρίνει (αστάδιαστα, αγνοημένα από το git, διπλοδιεκδικούμενα, αδιεκδίκητα). Δύο πύλες που
 * φωνάζουν για το ίδιο αρχείο με **διαφορετική θεραπεία** είναι θόρυβος, όχι αυστηρότητα.
 *
 * @module scripts/lib/anchor-execution/census
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  listWorkflowFiles,
  readWorkflowRunSteps,
  readWorkflowTriggers,
} = require('../ci/workflow-meta');
const { buildCensus } = require('../jest-partition/census');
const { allExecutors } = require('../jest-partition/executors');
const { PROJECT_ROOT, toPosix } = require('../jest-partition/jest-configs');
const { classifyCommand, loadScripts, splitCommands } = require('./invocations');

/** Το κλειστό σύνολο δηλώσεων: κάθε εξαίρεση είναι πράξη με **όνομα και λόγο**. */
const DECLARATIONS_FILE = '.anchor-execution.json';

const WORKFLOWS_DIR = '.github/workflows';

/** ⛔ Καταστάσεις αρχείου που μπλοκάρουν. */
const BLOCKING_FILE_STATES = ['unexecuted', 'non-blocking-only'];

/** 🔶 Δηλωμένα κενά: μετρώνται, ονομάζονται, δεν μπλοκάρουν. */
const GAP_FILE_STATES = ['blocking-path-filtered'];

/** ✅ Οι νόμιμες — απαριθμούνται ώστε καμία να μην είναι σιωπηλή. */
const OK_FILE_STATES = ['blocking-unconditional', 'declared-exempt', 'outside-partition'];

const FILE_STATES = [...BLOCKING_FILE_STATES, ...GAP_FILE_STATES, ...OK_FILE_STATES];

/** ⛔ Καταστάσεις εντολής/δήλωσης που μπλοκάρουν. */
const BLOCKING_COMMAND_STATES = ['unresolvable-command', 'orphan-declaration', 'reasonless-declaration'];

const COMMAND_STATES = [
  ...BLOCKING_COMMAND_STATES,
  'execution-blocking',
  'execution-non-blocking',
  'execution-conditional',
  'execution-manual-only',
  'execution-disabled-workflow',
  'execution-tolerated',
];

/** Οι καταστάσεις της απογραφής 3.47 που **δεν** κρίνονται εδώ, και γιατί. */
const PARTITION_DEFERRED = new Set([
  'multi-owned',
  'build-artifact',
  'unowned',
  'jest-owned-untracked',
  'untracked-unowned',
  'ignored-not-run',
]);

/**
 * Το αρχείο ρυθμίσεων μιας κλήσης, όπως το ονομάζει ο **εκτελεστής** του δέντρου.
 * Η εντολή γράφει `--config jest.config.storage-rules.js` ή `./jest.config.js`· ο
 * εκτελεστής το ξέρει ως διαδρομή σχετική με τη ρίζα. Επιστρέφει `null` αν δεν υπάρχει.
 */
function resolveConfig(rawConfig, knownConfigs) {
  const wanted = toPosix(rawConfig).replace(/^\.\//, '');
  if (knownConfigs.has(wanted)) return wanted;
  const suffixMatch = [...knownConfigs].find((known) => known.endsWith(`/${wanted}`) || wanted.endsWith(`/${known}`));
  return suffixMatch ?? null;
}

/** Τα αρχεία `*.yml.disabled` — workflow που **υπάρχει και δεν τρέχει ποτέ**. */
function listDisabledWorkflows(workflowsDir) {
  return fs
    .readdirSync(workflowsDir)
    .filter((file) => file.endsWith('.yml.disabled'))
    .sort();
}

/**
 * Κάθε κλήση εκτελεστή test σε **κάθε** αρχείο workflow (ενεργό ή απενεργοποιημένο).
 *
 * Η κατάσταση κάθε κλήσης προκύπτει από **τέσσερα** ανεξάρτητα ερωτήματα, με αυτή τη σειρά:
 * είναι σε απενεργοποιημένο αρχείο; · ξυπνά αυτόματα; · είναι υπό συνθήκη `if:`; ·
 * μπορεί να αποτύχει; Η σειρά είναι συμβόλαιο: ένα βήμα σε `.disabled` αρχείο δεν έχει
 * νόημα να ρωτηθεί αν είναι υπό συνθήκη.
 */
function collectInvocations(projectRoot, knownConfigs = new Set()) {
  const workflowsDir = path.join(projectRoot, WORKFLOWS_DIR);
  const scripts = loadScripts(projectRoot);
  const invocations = [];

  const files = [
    ...listWorkflowFiles(workflowsDir).map((file) => ({ file, disabled: false })),
    ...listDisabledWorkflows(workflowsDir).map((file) => ({ file, disabled: true })),
  ];

  for (const { file, disabled } of files) {
    const full = path.join(workflowsDir, file);
    const triggers = disabled ? { automatic: [], pathFiltered: false } : readWorkflowTriggers(full);

    for (const step of readWorkflowRunSteps(full)) {
      for (const { command, tolerated, last } of splitCommands(step.run)) {
        const parsed = classifyCommand(command, scripts);
        if (parsed.kind === 'not-execution') continue;

        if (parsed.kind === 'unresolvable') {
          invocations.push({ state: 'unresolvable-command', workflow: file, job: step.job, detail: parsed.why });
          continue;
        }

        // Το config είναι **αυθεντία**: αν η εντολή δείχνει σε αρχείο ρυθμίσεων που δεν
        // υπάρχει, η κλήση δεν τρέχει τίποτα — και μια πύλη που το αγνοεί θα μετρούσε
        // «εκτελεστή» εκεί που το CI θα σκάσει. Ίδιος λόγος με το `orphan` του CHECK 3.36.
        const config = resolveConfig(parsed.config, knownConfigs);
        if (config === null) {
          invocations.push({
            state: 'unresolvable-command',
            workflow: file,
            job: step.job,
            detail: `άγνωστο config «${parsed.config}» — δεν αντιστοιχεί σε κανέναν εκτελεστή του δέντρου`,
          });
          continue;
        }

        let state = 'execution-blocking';
        if (disabled) state = 'execution-disabled-workflow';
        else if (triggers.automatic.length === 0) state = 'execution-manual-only';
        else if (step.conditional) state = 'execution-conditional';
        else if (step.continueOnError) state = 'execution-non-blocking';
        else if (tolerated && last) state = 'execution-tolerated';

        invocations.push({
          state,
          workflow: file,
          job: step.job,
          runner: parsed.runner,
          config,
          patterns: parsed.patterns,
          pathFiltered: triggers.pathFiltered,
          detail: command.slice(0, 120),
        });
      }
    }
  }
  return invocations;
}

/** Οι δηλωμένες εξαιρέσεις, με τον λόγο τους — και οι δύο τρόποι να είναι άκυρες. */
function readDeclarations(projectRoot, existingFiles) {
  const file = path.join(projectRoot, DECLARATIONS_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(
      `[anchor-execution] Λείπει το «${DECLARATIONS_FILE}». Το κλειστό σύνολο δηλώσεων είναι ` +
        'μέρος της πύλης: χωρίς αυτό κάθε εξαίρεση θα ήταν αόρατη.',
    );
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entries = Array.isArray(parsed.exempt) ? parsed.exempt : [];
  const problems = [];
  const exempt = new Map();

  for (const entry of entries) {
    const target = typeof entry.file === 'string' ? entry.file : '';
    const why = typeof entry.why === 'string' ? entry.why.trim() : '';
    if (why === '') {
      problems.push({ state: 'reasonless-declaration', workflow: DECLARATIONS_FILE, detail: target });
      continue;
    }
    if (!existingFiles.has(target)) {
      problems.push({ state: 'orphan-declaration', workflow: DECLARATIONS_FILE, detail: target });
      continue;
    }
    exempt.set(target, why);
  }
  return { exempt, problems };
}

/**
 * Ποιες κλήσεις φτάνουν σε ένα αρχείο: ιδιοκτησία config **και** φίλτρο μοτίβου.
 *
 * ⚠️ Η ιδιοκτησία **δεν** ξαναϋπολογίζεται εδώ — έρχεται από την απογραφή του CHECK 3.47,
 * που την έχει ήδη λύσει με τον matcher **του jest**. Ρωτώντας ξανά το `claims()` ανά
 * αρχείο × κλήση, η πύλη κόστιζε 9s· με τον ιδιοκτήτη δεδομένο, ~2s. Και το σημαντικότερο:
 * υπάρχει **μία** απάντηση στο «ποιος το διεκδικεί», όχι δύο που μπορούν να αποκλίνουν.
 */
function reaching(absolutePosix, ownerConfig, invocations) {
  return invocations.filter((invocation) => {
    if (invocation.config !== ownerConfig) return false;
    return invocation.patterns.length === 0 || invocation.patterns.some((re) => re.test(absolutePosix));
  });
}

/**
 * Η κατάσταση ενός αρχείου. **Η σειρά είναι συμβόλαιο**: η δηλωμένη εξαίρεση κρίνεται
 * **πριν** από την αναζήτηση εκτελεστή, γιατί μια εξαίρεση με λόγο είναι απάντηση — και
 * ένα αρχείο δεν επιτρέπεται να έχει δύο.
 */
function classifyFile({ exemptWhy, reached }) {
  if (exemptWhy !== undefined) return 'declared-exempt';
  const executing = reached.filter((invocation) => invocation.state === 'execution-blocking');
  if (executing.some((invocation) => !invocation.pathFiltered)) return 'blocking-unconditional';
  if (executing.length > 0) return 'blocking-path-filtered';

  // ⚠️ Η διάκριση των δύο παραβάσεων είναι η **θεραπεία**, όχι η αυστηρότητα: «τρέχει και
  // η αποτυχία καταπίνεται» θέλει αφαίρεση του `continue-on-error`/`||`· «δεν τρέχει» θέλει
  // εκτελεστή. Απενεργοποιημένο workflow, χειροκίνητο workflow και βήμα υπό `if:` πέφτουν
  // στο δεύτερο: **δεν αποδεικνύεται** ότι εκτελείται, και το fail-closed διάβασμα ενός
  // «ίσως» είναι «όχι» (αλλιώς ένα `if: inputs.seed` θα μετρούσε ως εκτέλεση σε κάθε PR).
  const swallowed = reached.some(
    (invocation) => invocation.state === 'execution-non-blocking' || invocation.state === 'execution-tolerated',
  );
  return swallowed ? 'non-blocking-only' : 'unexecuted';
}

/**
 * Η πλήρης απογραφή, με **κλειστή λογιστική σε δύο κατάστιχα**.
 *
 * Το άθροισμα των καταστάσεων αρχείου **πρέπει** να ισούται με το σύνολο της απογραφής του
 * CHECK 3.47· άγνωστη κατάσταση ⇒ `throw` **με όνομα**. Η λογιστική είναι το όργανο που
 * εγγυάται ότι κανένα αρχείο δεν χάνεται σιωπηλά — δεν επιτρέπεται να χαθεί **η ίδια**.
 */
function buildExecutionCensus(projectRoot = PROJECT_ROOT) {
  const rootPosix = toPosix(projectRoot).replace(/\/+$/, '');
  const partition = buildCensus(projectRoot);

  const claimsByConfig = new Map(
    allExecutors(projectRoot).map((executor) => [toPosix(executor.id), executor.claims]),
  );
  const invocations = collectInvocations(projectRoot, new Set(claimsByConfig.keys()));

  const judged = [
    ...partition.byState['jest-owned'],
    ...partition.byState['playwright-owned'],
  ];
  const { exempt, problems } = readDeclarations(projectRoot, new Set(judged.map((e) => e.file)));

  const executing = invocations.filter((invocation) => invocation.patterns !== undefined);
  const byState = Object.fromEntries(FILE_STATES.map((state) => [state, []]));
  for (const entry of judged) {
    const absolute = `${rootPosix}/${entry.file}`;
    const reached = reaching(absolute, toPosix(entry.owners[0]), executing);
    const state = classifyFile({ exemptWhy: exempt.get(entry.file), reached });
    if (byState[state] === undefined) {
      throw new Error(`[anchor-execution] Άγνωστη κατάσταση «${state}» για το «${entry.file}».`);
    }
    byState[state].push({
      file: entry.file,
      state,
      detail: exempt.get(entry.file) ?? [...new Set(reached.map((i) => i.workflow))].join(', '),
    });
  }

  for (const state of PARTITION_DEFERRED) {
    for (const entry of partition.byState[state]) {
      byState['outside-partition'].push({
        file: entry.file,
        state: 'outside-partition',
        detail: `CHECK 3.47 → ${state}`,
      });
    }
  }

  const counted = FILE_STATES.reduce((sum, state) => sum + byState[state].length, 0);
  if (counted !== partition.total) {
    throw new Error(
      `[anchor-execution] Η λογιστική δεν κλείνει: ${counted} καταγεγραμμένα σε ${partition.total} ` +
        'αρχεία της απογραφής 3.47. Κάποιο αρχείο χάθηκε — η πύλη σταματά αντί να αναφέρει λιγότερα.',
    );
  }

  const allCommands = [...invocations, ...problems];
  const commandLedger = Object.fromEntries(COMMAND_STATES.map((state) => [state, 0]));
  for (const invocation of allCommands) {
    if (commandLedger[invocation.state] === undefined) {
      throw new Error(`[anchor-execution] Άγνωστη κατάσταση εντολής «${invocation.state}».`);
    }
    commandLedger[invocation.state] += 1;
  }

  const violations = [
    ...BLOCKING_FILE_STATES.flatMap((state) => byState[state]),
    ...allCommands
      .filter((invocation) => BLOCKING_COMMAND_STATES.includes(invocation.state))
      .map((invocation) => ({
        file: `${invocation.workflow}${invocation.job ? ` (${invocation.job})` : ''}`,
        state: invocation.state,
        detail: invocation.detail,
      })),
  ];

  return {
    total: partition.total,
    judged: judged.length,
    byState,
    fileLedger: Object.fromEntries(FILE_STATES.map((state) => [state, byState[state].length])),
    commandLedger,
    invocations: allCommands,
    violations,
  };
}

module.exports = {
  BLOCKING_COMMAND_STATES,
  BLOCKING_FILE_STATES,
  COMMAND_STATES,
  DECLARATIONS_FILE,
  FILE_STATES,
  GAP_FILE_STATES,
  OK_FILE_STATES,
  PARTITION_DEFERRED,
  buildExecutionCensus,
  classifyFile,
  collectInvocations,
  listDisabledWorkflows,
  readDeclarations,
  reaching,
  resolveConfig,
};
