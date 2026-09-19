'use strict';

/**
 * ADR-865 §11.9 — **Η ΔΙΑΔΟΧΗ**: ποιο τρέξιμο της γραμμής παραγωγής έχει δικαίωμα να αναπτύξει
 * και να κυκλοφορήσει. Καθαρές συναρτήσεις — **κανένα** I/O (το κάνει το
 * `scripts/firestore-deploy/succession.js`), ώστε κάθε απόφαση να δοκιμάζεται με δεδομένα.
 *
 * 🔑 **Η αρχή (GitOps, Argo CD / Flux)**: ισχύει **μόνο η κορυφή** του κλάδου. Το δέντρο της
 * κορυφής είναι **υπερσύνολο** κάθε παλαιότερου ⇒ ένα παλαιότερο τρέξιμο δεν έχει τίποτα να
 * αναπτύξει που δεν θα αναπτύξει η κορυφή — έχει μόνο κάτι να **γυρίσει πίσω**.
 *
 * 🔴 **Το μετρημένο πρόβλημα (ADR-865 Changelog 2026-09-19)**: job σε αναμονή έγκρισης **κρατά**
 * το `concurrency: firebase-production`· το νεότερο μένει `pending` με `pending_deployments = 0`
 * (χωρίς κουμπί). Ίδια συμπεριφορά με το AWS CodePipeline (*«A stage with an approval action is
 * locked until the approval action is approved or rejected or has timed out»*) — που όμως
 * αντικαθιστά μόνο όσα περιμένουν **μπροστά** από το στάδιο. Εδώ αντικαθίσταται **και** ο
 * κάτοχος, **μόνο** όσο περιμένει έγκριση: τίποτα δεν έχει εκτελεστεί ακόμη ⇒ καμία ανάπτυξη
 * δεν κόβεται στη μέση (γι' αυτό **ποτέ** `cancel-in-progress: true`).
 *
 * Πηγές: GitLab *«prevent older deployment jobs from running when a newer deployment job is
 * started»* · HCP Terraform *«stale saved plan runs are automatically detected and discarded»* ·
 * AWS CodePipeline SUPERSEDED, Rule 3.
 */

const M = require('./model');

/** Το γεγονός που γεννά **κορυφή**. Ένα `workflow_dispatch` (δοκιμή deployer) δεν αντικαθιστά ποτέ push. */
const KEEPER_EVENT = 'push';

/**
 * Η πρωινή υπενθύμιση ξυπνά για έγκριση που περιμένει **τουλάχιστον** τόσο (πέρασε η νύχτα).
 * Η **άμεση** ειδοποίηση φεύγει ήδη τη στιγμή του αιτήματος (`firebase-succession`).
 */
const REMINDER_AFTER_HOURS = 8;

/** Πού βρίσκεται η **δική μου** ανάπτυξη (`firebase-apply`) — για τον φύλακα της ουράς. */
const APPLY_STATE = Object.freeze({
  QUEUED: 'queued', // πίσω από την κλειδαριά, **χωρίς** κουμπί
  WAITING: 'waiting', // έχει κουμπί έγκρισης
  RUNNING: 'running',
  DONE: 'done',
  ABSENT: 'absent',
});

const byNewest = (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id;

/** @returns {{fresh:boolean, sha:string, tip:string}} */
function freshnessOf(sha, tipSha) {
  if (!sha || !tipSha) throw new Error('διαδοχή: λείπει το sha του τρεξίματος ή της κορυφής');
  return { fresh: sha === tipSha, sha, tip: tipSha };
}

/**
 * Η **κορυφή**: το νεότερο τρέξιμο push του οποίου το commit είναι η κορυφή του κλάδου.
 * Κανένα τέτοιο (το push μόλις έγινε, το τρέξιμο δεν δημιουργήθηκε ακόμη) ⇒ `null` ⇒ **κανείς**
 * δεν ακυρώνεται: όταν δεν ξέρεις ποιος κρατά, δεν διώχνεις κανέναν.
 */
function keeperOf(runs, tipSha) {
  const candidates = runs.filter((run) => run.event === KEEPER_EVENT && run.head_sha === tipSha);
  return candidates.length === 0 ? null : [...candidates].sort(byNewest)[0];
}

/** Οι εκκρεμείς εγκρίσεις (`pending_deployments`) **αυτού** του environment. */
function approvalsFor(pendingDeployments, environment = M.PIPELINE.environment) {
  return (pendingDeployments || []).filter((entry) => entry && entry.environment && entry.environment.name === environment);
}

/** Περιμένει αυτό το τρέξιμο **ανθρώπινη έγκριση** για το environment της γραμμής; */
const awaitsApproval = (pendingDeployments, environment) => approvalsFor(pendingDeployments, environment).length > 0;

/**
 * Ποια τρεξίματα **αντικαθίστανται**: ενεργά, **όχι** η κορυφή, και σε αναμονή έγκρισης.
 * 🔑 Κριτήριο το `pending_deployments`, **όχι** το όνομα του job: είναι ακριβώς το μετρημένο
 * σύμπτωμα (κάτοχος = 1, ουρά = 0) — και ένα τρέξιμο που **ήδη αναπτύσσει** έχει 0 ⇒ **ποτέ** δεν
 * ακυρώνεται από εδώ.
 * @param {{runs:object[], pendingByRun:Map<number,object[]>, keeper:object|null, environment?:string}} input
 */
function supersededHolders({ runs, pendingByRun, keeper, environment = M.PIPELINE.environment }) {
  if (!keeper) return [];
  return runs.filter(
    (run) => run.id !== keeper.id && run.status !== 'completed' && awaitsApproval(pendingByRun.get(run.id), environment),
  );
}

/**
 * Η κατάσταση του **δικού μου** apply, από το API `…/runs/{id}/jobs` (το `name` εκεί είναι το
 * `name:` του job — διαβάζεται από το workflow με τον **έναν** αναγνώστη YAML).
 */
function applyStateOf(jobs, applyName) {
  const job = (jobs || []).find((j) => j.name === applyName);
  if (!job) return APPLY_STATE.ABSENT;
  if (job.status === 'completed') return APPLY_STATE.DONE;
  if (job.status === 'in_progress') return APPLY_STATE.RUNNING;
  if (job.status === 'waiting') return APPLY_STATE.WAITING;
  return APPLY_STATE.QUEUED; // queued · pending · requested — πίσω από την κλειδαριά
}

/**
 * Εγκρίσεις που περιμένουν **πάνω** από το όριο — για την πρωινή υπενθύμιση. Αρχή αναμονής: το
 * `wait_timer_started_at` όταν υπάρχει, αλλιώς η δημιουργία του τρεξίματος (κάτω φράγμα: το
 * υπερεκτιμά κατά τη διάρκεια του πλάνου, αμελητέο μπροστά σε ώρες).
 * @returns {{run:object, hours:number, isKeeper:boolean}[]}
 */
function overdueApprovals({ runs, pendingByRun, keeper, now, afterHours = REMINDER_AFTER_HOURS, environment = M.PIPELINE.environment }) {
  const out = [];
  for (const run of runs) {
    const pending = approvalsFor(pendingByRun.get(run.id), environment);
    if (run.status === 'completed' || pending.length === 0) continue;
    const since = Date.parse(pending[0].wait_timer_started_at || run.created_at);
    const hours = (now - since) / 3_600_000;
    if (hours >= afterHours) out.push({ run, hours, isKeeper: Boolean(keeper && keeper.id === run.id) });
  }
  return out.sort((a, b) => byNewest(a.run, b.run));
}

module.exports = {
  KEEPER_EVENT,
  REMINDER_AFTER_HOURS,
  APPLY_STATE,
  freshnessOf,
  keeperOf,
  awaitsApproval,
  supersededHolders,
  applyStateOf,
  overdueApprovals,
};
