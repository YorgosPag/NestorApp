#!/usr/bin/env node
'use strict';

/**
 * ADR-865 §11.9 — **Η ΔΙΑΔΟΧΗ της γραμμής παραγωγής**: μόνο η κορυφή του `main` αναπτύσσει και
 * κυκλοφορεί· μια ξεχασμένη έγκριση **δεν** κρατά πια όμηρο κάθε επόμενη κυκλοφορία στο Netcup.
 * Οι αποφάσεις είναι καθαρές (`scripts/lib/firestore-deploy/succession.js`)· εδώ ζει **μόνο** η
 * συνομιλία με το GitHub (ένας πελάτης: `scripts/lib/ci/github-api.js`).
 *
 * Λειτουργίες (μία ανά job του `docker-build.yml`):
 *   claim   `firebase-succession` — φρεσκάδα (όχι κορυφή ⇒ αυτοακύρωση) + ακύρωση παλαιότερων
 *           τρεξιμάτων που **περιμένουν έγκριση** (όχι όσων αναπτύσσουν)
 *   guard   πρώτο βήμα του `firebase-apply` **και** του `release` — «είμαι ακόμη η κορυφή;»
 *           (κλείνει το παράθυρο «εγκρίθηκε μετά από νεότερο push»)
 *   watch   `firebase-queue-watch` — όσο το δικό μου apply κάθεται στην ουρά **χωρίς** κουμπί,
 *           ξανασκουπίζει (κλείνει τον αγώνα «ο παλιός μπήκε σε αναμονή μετά τη σκούπα μου»)
 *   tip     `notify` — `fresh=true|false|unknown`: μιλά **μόνο** η κορυφή (ποτέ ψευδές «FALLITO»)
 *   remind  `firebase-drift.yml` — πρωινή υπενθύμιση έγκρισης που ξεχάστηκε
 *
 * 🔑 **Αντικατάσταση = ακύρωση, ποτέ αποτυχία.** Ο συγκεντρωτής CI Health (ADR-757) μετρά ως
 * «έσπασε» **μόνο** το `failure` ⇒ ένα αντικατεστημένο τρέξιμο που θα κατέληγε κόκκινο θα έστελνε
 * ψευδές Tier 1 στο κινητό. Και η έγκριση **δεν** απορρίπτεται μέσω API: το
 * `POST …/pending_deployments` το καλούν μόνο *«Required reviewers»* — ο bot δεν είναι.
 *
 * Κωδικοί εξόδου: 0 ✓ · 1 το GitHub δεν απάντησε (claim/guard ⇒ fail-closed: καμία ανάπτυξη·
 * watch/tip/remind ⇒ προειδοποίηση και 0, γιατί είναι δικλίδες και πλάγια κανάλια) ·
 * 3 ζητήθηκε αυτοακύρωση αλλά το τρέξιμο ζει (fail-closed) · 64 χρήση / εκτός Actions.
 * Env: GITHUB_TOKEN (`actions: write` για claim/guard/watch) · GITHUB_REPOSITORY · GITHUB_RUN_ID · GITHUB_SHA.
 */

const path = require('node:path');
const M = require('../lib/firestore-deploy/model');
const S = require('../lib/firestore-deploy/succession');
const { githubApiFromEnv } = require('../lib/ci/github-api');
const { setOutputs, appendSummary } = require('../lib/ci/actions-io');
const { readWorkflowJobs } = require('../lib/ci/workflow-meta');
const { composeMessage, sendTelegram } = require('../lib/ci/telegram');

const EXIT = Object.freeze({ OK: 0, GITHUB: 1, NOT_CANCELLED: 3, USAGE: 64 });
const MODES = Object.freeze(['claim', 'guard', 'watch', 'tip', 'remind']);
const ROOT = path.join(__dirname, '..', '..');
const BRANCH = M.PIPELINE.ref.replace(/^refs\/heads\//, '');

/** Ο φύλακας ξαναρωτά κάθε 30″, για λίγο περισσότερο από το `timeout-minutes: 60` του apply. */
const WATCH_INTERVAL_MS = 30_000;
const WATCH_DEADLINE_MS = 70 * 60_000;
/** Μετά την αυτοακύρωση ο runner σκοτώνει το βήμα· αν όχι μέσα σε 2′, αποτυγχάνουμε (fail-closed). */
const CANCEL_GRACE_MS = 120_000;

const short = (sha) => String(sha || '').slice(0, 8);
const label = (run) => `#${run.run_number} @${short(run.head_sha)}`;

/** Όλες οι διαδρομές του GitHub API της διαδοχής — σε **ένα** σημείο. */
function pipelineGitHub(api, repo) {
  const workflow = encodeURIComponent(path.basename(M.PIPELINE.workflow));
  return {
    tip: async () => (await api.request('GET', `/repos/${repo}/git/ref/heads/${BRANCH}`)).object.sha,
    runs: async () =>
      (await api.request('GET', `/repos/${repo}/actions/workflows/${workflow}/runs?branch=${BRANCH}&per_page=50`)).workflow_runs || [],
    pending: async (id) => (await api.request('GET', `/repos/${repo}/actions/runs/${id}/pending_deployments`)) || [],
    jobs: async (id) => (await api.request('GET', `/repos/${repo}/actions/runs/${id}/jobs?per_page=100`)).jobs || [],
    cancel: (id) => api.request('POST', `/repos/${repo}/actions/runs/${id}/cancel`),
  };
}

/** Μια φωτογραφία της γραμμής: κορυφή, τρεξίματα, ποια περιμένουν έγκριση. */
async function snapshot(gh) {
  const [tip, runs] = await Promise.all([gh.tip(), gh.runs()]);
  const active = runs.filter((run) => run.status !== 'completed');
  const pendingByRun = new Map(await Promise.all(active.map(async (run) => [run.id, await gh.pending(run.id)])));
  return { tip, runs, pendingByRun, keeper: S.keeperOf(runs, tip) };
}

/** Ακύρωση που βρίσκει το τρέξιμο ήδη τελειωμένο (409) δεν είναι σφάλμα: ο στόχος επιτεύχθηκε. */
async function cancelRun(gh, run, log) {
  try {
    await gh.cancel(run.id);
    log(`⏭️ αντικαταστάθηκε ${label(run)} — περίμενε έγκριση για παλαιότερο δέντρο ⇒ ακυρώθηκε`);
    return true;
  } catch (error) {
    if (!/ 409 /.test(error.message)) throw error;
    log(`ℹ️ ${label(run)} είχε ήδη τελειώσει — τίποτα να ακυρωθεί`);
    return false;
  }
}

/** Η σκούπα: ανήκει **μόνο** στην κορυφή — ένα παλαιότερο τρέξιμο δεν ακυρώνει ποτέ νεότερο. */
async function sweep(gh, self, log) {
  const snap = await snapshot(gh);
  if (!snap.keeper) {
    log(`ℹ️ η κορυφή ${short(snap.tip)} δεν έχει ακόμη τρέξιμο push — καμία αντικατάσταση (δεν διώχνεις όταν δεν ξέρεις ποιος κρατά)`);
    return { snap, cancelled: [] };
  }
  if (snap.keeper.id !== self.runId) {
    log(`ℹ️ κορυφή = ${label(snap.keeper)} — η σκούπα ανήκει σε εκείνο το τρέξιμο`);
    return { snap, cancelled: [] };
  }
  const cancelled = [];
  for (const run of S.supersededHolders({ runs: snap.runs, pendingByRun: snap.pendingByRun, keeper: snap.keeper })) {
    if (await cancelRun(gh, run, log)) cancelled.push(run);
  }
  return { snap, cancelled };
}

/** Όχι κορυφή ⇒ αυτοακύρωση (γκρι, όχι κόκκινο). Αν ζούμε ακόμη μετά τη χάρη ⇒ αποτυχία, ποτέ συνέχεια. */
async function standDown(gh, self, fresh, deps) {
  deps.log(
    `⏭️ ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ: το τρέξιμο είναι στο ${short(fresh.sha)}, η κορυφή του ${BRANCH} στο ${short(fresh.tip)} ` +
      '— δεν αναπτύσσει, δεν κυκλοφορεί (αναπτύσσει η κορυφή, που περιέχει και αυτό το δέντρο)',
  );
  appendSummary(`### ⏭️ Αντικαταστάθηκε από νεότερο push\n\nΚορυφή του \`${BRANCH}\`: \`${short(fresh.tip)}\` — αυτό το τρέξιμο (\`${short(fresh.sha)}\`) ακυρώνεται.`, deps.env);
  await gh.cancel(self.runId);
  await deps.sleep(CANCEL_GRACE_MS);
  deps.log('::error::ζητήθηκε αυτοακύρωση αλλά το τρέξιμο ζει ακόμη — αποτυγχάνω (fail-closed: τίποτα μετά από εδώ δεν τρέχει)');
  return EXIT.NOT_CANCELLED;
}

async function guard(gh, self, deps) {
  const fresh = S.freshnessOf(self.sha, await gh.tip());
  setOutputs({ fresh: fresh.fresh }, deps.env);
  if (!fresh.fresh) return standDown(gh, self, fresh, deps);
  deps.log(`✓ κορυφή του ${BRANCH}: ${short(fresh.tip)} — αυτό το τρέξιμο έχει δικαίωμα να συνεχίσει`);
  return EXIT.OK;
}

async function claim(gh, self, deps) {
  const verdict = await guard(gh, self, deps);
  if (verdict !== EXIT.OK) return verdict;
  const { cancelled } = await sweep(gh, self, deps.log);
  const line = cancelled.length === 0 ? 'καμία εκκρεμής έγκριση παλαιότερου τρεξίματος' : `αντικαταστάθηκαν: ${cancelled.map(label).join(' · ')}`;
  appendSummary(`### 🧭 Διαδοχή\n\n✓ κορυφή — ${line}`, deps.env);
  return EXIT.OK;
}

/** Ο φύλακας της ουράς: τελειώνει μόλις το δικό μου apply πάρει κουμπί / τρέξει / τελειώσει. */
async function watch(gh, self, deps) {
  const applyName = readWorkflowJobs(path.join(ROOT, M.PIPELINE.workflow))[M.PIPELINE.jobs.apply].name;
  const deadline = deps.now() + WATCH_DEADLINE_MS;
  for (;;) {
    const { snap } = await sweep(gh, self, deps.log);
    if (snap.keeper && snap.keeper.id !== self.runId) return EXIT.OK;
    const state = S.applyStateOf(await gh.jobs(self.runId), applyName);
    if (state !== S.APPLY_STATE.QUEUED) {
      deps.log(`✓ η ανάπτυξη αυτού του τρεξίματος: ${state} — ο φύλακας τελείωσε`);
      return EXIT.OK;
    }
    if (deps.now() >= deadline) {
      deps.log(`::warning::η ανάπτυξη κάθεται ακόμη στην ουρά μετά από ${WATCH_DEADLINE_MS / 60_000}′ — τρέχει ανάπτυξη άλλου τρεξίματος;`);
      return EXIT.OK;
    }
    await deps.sleep(WATCH_INTERVAL_MS);
  }
}

/** Για το `notify`: άγνωστο ⇒ `unknown` (καλύτερα μια περιττή ειδοποίηση παρά μια χαμένη). */
async function tip(gh, self, deps) {
  try {
    setOutputs({ fresh: S.freshnessOf(self.sha, await gh.tip()).fresh }, deps.env);
  } catch (error) {
    deps.log(`::warning::διαδοχή: η κορυφή δεν διαβάστηκε (${error.message}) — fresh=unknown`);
    setOutputs({ fresh: 'unknown' }, deps.env);
  }
  return EXIT.OK;
}

function reminderLines(overdue) {
  return overdue.map(
    ({ run, hours, isKeeper }) =>
      `${label(run)} — περιμένει ${Math.floor(hours)} ώρες` +
      `${isKeeper ? ' (κορυφή: ο κώδικάς της ΔΕΝ έχει κυκλοφορήσει)' : ' (ΠΑΛΑΙΟΤΕΡΟ: Reject)'} · ${run.html_url}`,
  );
}

/** Πρωινή υπενθύμιση. **Ποτέ** δεν κοκκινίζει τον έλεγχο απόκλισης — είναι πλάγιο κανάλι. */
async function remind(gh, deps) {
  try {
    const snap = await snapshot(gh);
    const overdue = S.overdueApprovals({ ...snap, now: deps.now() });
    if (overdue.length === 0) {
      deps.log(`✓ καμία έγκριση δεν περιμένει ≥ ${S.REMINDER_AFTER_HOURS} ώρες`);
      return EXIT.OK;
    }
    const lines = reminderLines(overdue);
    lines.forEach((line) => deps.log(`⏸ ${line}`));
    appendSummary(['### ⏸ Εγκρίσεις που περιμένουν', '', ...lines.map((l) => `- ${l}`)].join('\n'), deps.env);
    const text = composeMessage({ status: 'info', title: 'NestorApp — έγκριση Firebase περιμένει', lines });
    const { sent, reason } = await deps.send(text);
    if (!sent) deps.log(`::warning::Telegram — ${reason}`);
  } catch (error) {
    deps.log(`::warning::υπενθύμιση εγκρίσεων: ${error.message}`);
  }
  return EXIT.OK;
}

function selfOf(env) {
  const runId = Number(env.GITHUB_RUN_ID);
  return Number.isInteger(runId) && runId > 0 && env.GITHUB_SHA && env.GITHUB_REPOSITORY ? { runId, sha: env.GITHUB_SHA } : null;
}

async function main(argv, deps = {}) {
  const d = { env: process.env, log: console.log, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: Date.now, send: sendTelegram, ...deps };
  const mode = argv[0];
  const self = selfOf(d.env);
  if (!MODES.includes(mode) || !self) {
    d.log(`::error::χρήση: succession.js <${MODES.join('|')}> — μόνο μέσα στο GitHub Actions (GITHUB_RUN_ID · GITHUB_SHA · GITHUB_REPOSITORY)`);
    return EXIT.USAGE;
  }
  try {
    const gh = pipelineGitHub(d.api || githubApiFromEnv(d.env), d.env.GITHUB_REPOSITORY);
    if (mode === 'remind') return await remind(gh, d);
    if (mode === 'tip') return await tip(gh, self, d);
    if (mode === 'guard') return await guard(gh, self, d);
    if (mode === 'claim') return await claim(gh, self, d);
    return await watch(gh, self, d);
  } catch (error) {
    // Ο φύλακας είναι δικλίδα (η κύρια σκούπα έγινε στο claim): παροδικό σφάλμα εκεί ⇒ προειδοποίηση,
    // όχι κόκκινο τρέξιμο (ο CI Health θα το έστελνε ως ψευδές Tier 1).
    if (mode === 'watch') {
      d.log(`::warning::διαδοχή (watch): το GitHub δεν απάντησε — ${error.message}`);
      return EXIT.OK;
    }
    d.log(`::error::διαδοχή (${mode}): το GitHub δεν απάντησε — ${error.message}. Fail-closed: καμία ανάπτυξη/κυκλοφορία.`);
    return EXIT.GITHUB;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

module.exports = { main, EXIT, MODES, WATCH_INTERVAL_MS, WATCH_DEADLINE_MS, CANCEL_GRACE_MS };
