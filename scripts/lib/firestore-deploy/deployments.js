/**
 * ADR-865 §11.10 — **ΤΟ ΑΡΧΕΙΟ ΤΗΣ ΠΡΑΞΗΣ ΤΗΣ ΓΡΑΜΜΗΣ ΠΑΡΑΓΩΓΗΣ**: τα GitHub Deployments.
 *
 * Η γραμμή (`docker-build.yml` → `firebase-apply`, `environment: firebase-production`) **δεν**
 * γράφει το τοπικό μητρώο εκ σχεδιασμού: το GitHub δημιουργεί για κάθε job με `environment` ένα
 * Deployment με statuses `waiting → queued → in_progress → success|failure|error`. Μέχρι τις
 * 2026-09-21 η σημείωση της επαλήθευσης **έλεγε** «γραμμή παραγωγής ⇒ GitHub Deployments» αλλά
 * **κανείς δεν τα διάβαζε** ⇒ κάθε ανάπτυξη του CI έμενε για πάντα «μη καταγεγραμμένη», αδιάκριτη
 * από ανάπτυξη **εκτός** εργαλείου (Console · CLI).
 *
 * 🔑 **Διπλή απόδειξη, ποτέ μία** — ένα Deployment εξηγεί ένα release **μόνο** όταν:
 *   1. ο χρόνος του release (`updateTime` του Rules API) πέφτει **μέσα** στο παράθυρο εκτέλεσης
 *      του job (`in_progress` → τερματική κατάσταση) — **αυτή** η πράξη το έκανε, όχι μια
 *      μεταγενέστερη που βρήκε ίδια bytes και δεν ανέπτυξε τίποτα (το πλάνο αναπτύσσει μόνο ό,τι
 *      διαφέρει)· και
 *   2. το περιεχόμενο του δέντρου **@sha** του Deployment = ζωντανό (ο καλών, `world.js`).
 * Το Argo CD κρατά `status.history` (revision + χρόνος)· εδώ ο χρόνος **διασταυρώνεται** με τον
 * πάροχο, που το Argo CD δεν κάνει: history που ψεύδεται δεν περνά.
 *
 * Καθαρό εκτός από το `fetchPipelineDeployments`, που δέχεται τον **έναν** πελάτη GitHub
 * (`scripts/lib/ci/github-api.js`) ως παράμετρο ⇒ η σουίτα τον αντικαθιστά.
 *
 * @module scripts/lib/firestore-deploy/deployments
 */

'use strict';

/** Τερματικές καταστάσεις του job — μετά από αυτές ο deployer δεν αγγίζει πια τον πάροχο. */
const TERMINAL = Object.freeze(['success', 'failure', 'error']);

/** Πόσα Deployments εξετάζονται — φράγμα κόστους (ένα αίτημα statuses ανά Deployment). */
const DEPLOYMENT_LIMIT = 20;

const time = (iso) => Date.parse(iso);

/**
 * **Το παράθυρο εκτέλεσης** ενός Deployment από τα statuses του (όποια σειρά κι αν έρθουν).
 * `start` = το πρώτο `in_progress` (πριν από αυτό το job **περιμένει** έγκριση/σειρά)· `end` = η
 * πρώτη τερματική κατάσταση, αλλιώς `null` (τρέχει ακόμη — π.χ. η επαλήθευση **μέσα** στο apply).
 * @returns {{start:string, end:string|null, state:string}|null} `null` ⇒ δεν ξεκίνησε ποτέ
 */
function executionWindow(statuses) {
  const sorted = [...(statuses || [])].sort((a, b) => time(a.created_at) - time(b.created_at));
  const started = sorted.find((s) => s.state === 'in_progress');
  if (!started) return null;
  const ended = sorted.find((s) => TERMINAL.includes(s.state) && time(s.created_at) >= time(started.created_at));
  const last = sorted[sorted.length - 1];
  return { start: started.created_at, end: ended ? ended.created_at : null, state: ended ? ended.state : last.state };
}

/**
 * **Ποιο Deployment έτρεχε όταν άλλαξε το release;** — εκείνο του οποίου το παράθυρο περιέχει τον
 * χρόνο· σε επικάλυψη (δύο ανοιχτά), το **νεότερο** που είχε ήδη ξεκινήσει.
 * @param {{start:string, end:string|null}[]} records
 * @returns {object|null}
 */
function deploymentForRelease(records, releaseTime) {
  const at = time(releaseTime);
  if (!Number.isFinite(at)) return null;
  const inside = records.filter((r) => time(r.start) <= at && (r.end === null || at <= time(r.end)));
  return inside.sort((a, b) => time(b.start) - time(a.start))[0] || null;
}

/**
 * Τα Deployments ενός environment, **με** παράθυρο εκτέλεσης — μόνο όσα δημιουργήθηκαν μέχρι
 * `before` (ένα release δεν το έκανε ποτέ πράξη που γεννήθηκε **μετά** από αυτό).
 * @param {{request:Function}} api ο πελάτης του `github-api.js`
 * @returns {Promise<{id:number, sha:string, url:string|null, start:string, end:string|null, state:string}[]>}
 */
async function fetchPipelineDeployments(api, repo, { environment, before, limit = DEPLOYMENT_LIMIT }) {
  const env = encodeURIComponent(environment);
  const list = (await api.request('GET', `/repos/${repo}/deployments?environment=${env}&per_page=${limit}`)) || [];
  const candidates = list.filter((d) => !before || time(d.created_at) <= time(before));
  const records = await Promise.all(candidates.map(async (d) => {
    const statuses = (await api.request('GET', `/repos/${repo}/deployments/${d.id}/statuses?per_page=100`)) || [];
    const window = executionWindow(statuses);
    if (window === null) return null;
    const withUrl = statuses.find((s) => s.log_url);
    return { id: d.id, sha: d.sha, url: withUrl ? withUrl.log_url : null, ...window };
  }));
  return records.filter(Boolean);
}

module.exports = { executionWindow, deploymentForRelease, fetchPipelineDeployments, TERMINAL, DEPLOYMENT_LIMIT };
