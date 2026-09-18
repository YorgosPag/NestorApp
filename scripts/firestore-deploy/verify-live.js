#!/usr/bin/env node
/**
 * ADR-865 §10 — «ό,τι τρέχει ΤΩΡΑ στο Firebase είναι ό,τι λέει το δέντρο — και είναι ΔΙΑΘΕΣΙΜΟ;»
 *
 *   npm run firestore:verify -- --project pagonis-87766            # μία ερώτηση
 *   npm run firestore:verify -- --project pagonis-87766 --wait     # μέχρι να μη χτίζεται τίποτα
 *   npm run firestore:verify -- --project pagonis-87766 --json     # για μηχανή (CI, πύλη)
 *   npm run firestore:verify -- --project pagonis-87766 --plan     # πλάνο για τη γραμμή παραγωγής (§11)
 *
 * **ΜΟΝΟ ΑΝΑΓΝΩΣΗ** — κανένα deploy, καμία γραφή στο μητρώο. Ασφαλές από πράκτορα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΔΙΑΦΟΡΑ ΑΠΟ ΤΟ CHECK 3.86
 * ────────────────────────────────────────────────────────────────────────────
 * Το 3.86 ρωτά **offline** «υπάρχει απόδειξη ότι αυτά τα bytes **στάλθηκαν**;» — από το δικό
 * μας μητρώο, σε κάθε commit. Εδώ ρωτάμε **τον πάροχο**: «αυτά **τρέχουν**;». Το πρώτο είναι
 * ισχυρισμός της τελευταίας μας πράξης· το δεύτερο είναι **γεγονός** — πιάνει deploy από την
 * Console, rollback, και μητρώο που ψεύδεται. Τα δύο **δεν** ενώνονται: δίκτυο και ταυτότητα σε
 * pre-commit θα έκαναν την πύλη αργή και offline-κόκκινη (§3).
 *
 * | Έξοδος | Σημαίνει | Πρότυπο |
 * |---|---|---|
 * | **0** | `Synced` + `Healthy` | Terraform `-detailed-exitcode` 0 |
 * | **1** | ο πάροχος δεν απάντησε (ταυτότητα · δίκτυο) | Terraform 1 |
 * | **2** | `OutOfSync` — ορισμοί ≠ δέντρο | Terraform 2 |
 * | **3** | `Progressing` — ίδιοι ορισμοί, δείκτης χτίζεται: **ερώτημα αποτυγχάνει** | Argo CD `Progressing` |
 * | **4** | `Degraded` — `NEEDS_REPAIR` / άγνωστη κατάσταση | Argo CD `Degraded` |
 *
 * @see ADR-865 §10 · CHECK 3.86 · `scripts/lib/firestore-deploy/{live,drift}.js`
 */

'use strict';

const M = require('../lib/firestore-deploy/model');
const fs = require('node:fs');
const { loadWorld, loadDesired, attributeFromHistory } = require('../lib/firestore-deploy/world');
const { createTransport, loadLiveWorld, resolveProject, argValue } = require('../lib/firestore-deploy/live');
const { judgeLive, withHistory, liveContent, SYNC, HEALTH, EXIT, ORIGIN } = require('../lib/firestore-deploy/drift');
const { planDeployment, renderPlanMarkdown, ACTION } = require('../lib/firestore-deploy/plan');

const POLL_MS = 15_000;
const DEFAULT_TIMEOUT_S = 30 * 60; // δείκτης σε μεγάλη συλλογή: λεπτά, όχι δευτερόλεπτα
const LIST_LIMIT = 20;

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const MARK = {
  [SYNC.SYNCED]: c.green('✓ Synced'),
  [SYNC.OUT_OF_SYNC]: c.red('✗ OutOfSync'),
  [SYNC.UNKNOWN]: c.red('? Unknown'),
  [HEALTH.HEALTHY]: c.green('Healthy'),
  [HEALTH.PROGRESSING]: c.yellow('Progressing'),
  [HEALTH.DEGRADED]: c.red('Degraded'),
  [HEALTH.UNKNOWN]: c.red('Unknown'),
};

// ============================================================================
// ΑΠΟΔΟΣΗ
// ============================================================================

function printList(title, items, format = (x) => x) {
  if (!items || items.length === 0) return;
  console.log(`      ${title} (${items.length}):`);
  for (const item of items.slice(0, LIST_LIMIT)) console.log(`        - ${format(item)}`);
  if (items.length > LIST_LIMIT) console.log(c.dim(`        … και ${items.length - LIST_LIMIT} ακόμη (--json για όλα)`));
}

function printVerdict(v) {
  console.log(`   ${MARK[v.sync]} · ${MARK[v.health]}  ${v.target}`);
  console.log(`      ${c.dim(v.detail)}`);
  printList('λείπουν ζωντανά', v.missing);
  printList('ζωντανά ΕΚΤΟΣ αρχείου — το επόμενο deploy θα ζητήσει να τα ΣΒΗΣΕΙ', v.extra);
  printList('δεν είναι διαθέσιμα', v.notReady, (n) => `${n.label} · ${n.state}`);
}

const SUMMARY = {
  [EXIT.OK]: () => c.green('✅ η παραγωγή = το δέντρο, και ό,τι ορίστηκε είναι διαθέσιμο'),
  [EXIT.ERROR]: () => c.red('❌ ο πάροχος δεν απάντησε — ΚΑΜΙΑ ετυμηγορία (όχι «πράσινο»)'),
  [EXIT.DRIFT]: () => c.red('⛔ η παραγωγή ΔΕΝ είναι το δέντρο') + c.dim('  → npm run firestore:deploy -- --project <id>'),
  [EXIT.PROGRESSING]: () => c.yellow('⏳ ίδιοι ορισμοί, αλλά δείκτης ΧΤΙΖΕΤΑΙ — τα ερωτήματά του ΑΠΟΤΥΓΧΑΝΟΥΝ μέχρι READY')
    + c.dim('  → --wait'),
  [EXIT.DEGRADED]: () => c.red('⛔ δείκτης σε NEEDS_REPAIR ή άγνωστη κατάσταση — θέλει άνθρωπο (Console → Firestore → Indexes)'),
};

function printReport(project, result) {
  console.log(`\n🔎 ADR-865 — ζωντανό έναντι δέντρου · ${project}`);
  for (const v of result.verdicts) printVerdict(v);
  console.log(`\n${SUMMARY[result.exitCode]()}\n`);
}

// ============================================================================
// ΕΚΤΕΛΕΣΗ
// ============================================================================

/**
 * Δεύτερη φάση της προέλευσης (ADR-865 §11): ό,τι φαίνεται ξένο ψάχνεται στο ιστορικό του git.
 * Ακριβό (μεταγλώττιση ανά commit) ⇒ **μόνο** για ό,τι δεν εξήγησε το μητρώο.
 */
function attributeForeign(result, desired, live) {
  const verdicts = result.verdicts.map((v) => {
    if (v.origin !== ORIGIN.FOREIGN && v.origin !== ORIGIN.UNATTRIBUTABLE) return v;
    const found = attributeFromHistory(v.target, desired[v.target].source, liveContent(live[v.target]));
    return withHistory(v, found);
  });
  return { ...result, verdicts };
}

/** Μία ερώτηση — επιθυμητό (δίσκος + git) έναντι ζωντανού (πάροχος). */
async function verifyOnce(project, transport) {
  const world = loadWorld();
  const desired = loadDesired(world);
  const live = await loadLiveWorld({ project, firebaseJson: world.firebaseJson, transport });
  return attributeForeign(judgeLive(desired, live), desired, live);
}

/**
 * `argocd app wait --health`: ξαναρωτά **μόνο** όσο η ετυμηγορία είναι `Progressing`.
 * Απόκλιση ή βλάβη δεν «περνούν με την αναμονή» — επιστρέφονται αμέσως.
 */
async function verifyUntilSettled(project, transport, timeoutSeconds, log) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let result = await verifyOnce(project, transport);
  while (result.exitCode === EXIT.PROGRESSING && Date.now() + POLL_MS < deadline) {
    const building = result.verdicts.flatMap((v) => v.notReady || []).length;
    log(c.dim(`   … ${building} σε εξέλιξη — ξανά σε ${POLL_MS / 1000}s`));
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    result = await verifyOnce(project, transport);
  }
  return result;
}

/**
 * **Προς το GitHub** (ADR-865 §11): η σελίδα του τρεξίματος — και της **έγκρισης** — δείχνει τι θα
 * αλλάξει (Terraform plan). Εκτός Actions οι μεταβλητές λείπουν ⇒ τίποτα δεν γράφεται.
 * @returns {object} το πλάνο
 */
function publishToGithub(project, result, env = process.env) {
  const plan = planDeployment(result);
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, renderPlanMarkdown(project, result, plan));
  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, `action=${plan.action}\ntargets=${plan.targets.join(',')}\n`);
  }
  return plan;
}

/** `--plan`: έξοδος 1 **μόνο** όταν το πλάνο φράζει την κυκλοφορία· απόκλιση προς ανάπτυξη δεν είναι σφάλμα. */
function planExitCode(plan, log) {
  log(`🧭 πλάνο: ${plan.action}${plan.targets.length ? ` · ${plan.targets.join(',')}` : ''} — ${plan.reason}`);
  for (const w of plan.warnings) log(c.yellow(`   ⚠️  ${w}`));
  return plan.action === ACTION.BLOCKED ? EXIT.ERROR : EXIT.OK;
}

/**
 * Η ερώτηση ως συνάρτηση — την καλεί **και** το `record-deploy.js` μετά από κάθε ανάπτυξη,
 * ώστε «deploy» να μην αναφέρεται ποτέ ως «διαθέσιμο» χωρίς να ρωτηθεί ο πάροχος.
 * @returns {Promise<number>} κωδικός εξόδου (`EXIT`)
 */
async function runVerification(argv, { transport } = {}) {
  const project = resolveProject(argv);
  if (!project) {
    console.error('\n❌ firestore:verify — λείπει το project: δώσε --project <id> ή όρισε FIREBASE_PROJECT_ID\n');
    return EXIT.ERROR;
  }
  const json = argv.includes('--json');
  const t = transport || createTransport(project);
  const timeout = Number(argValue(argv, '--timeout')) || DEFAULT_TIMEOUT_S;
  const log = json ? () => {} : (line) => console.log(line);
  const result = argv.includes('--wait')
    ? await verifyUntilSettled(project, t, timeout, log)
    : await verifyOnce(project, t);
  if (json) console.log(M.stableStringify({ project, ...result }));
  else printReport(project, result);
  const plan = publishToGithub(project, result);
  return argv.includes('--plan') ? planExitCode(plan, (line) => console.log(line)) : result.exitCode;
}

if (require.main === module) {
  runVerification(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`\n❌ firestore:verify — ${error.stack || error.message}\n`);
      process.exit(EXIT.ERROR);
    },
  );
}

module.exports = { runVerification, verifyOnce, publishToGithub };
