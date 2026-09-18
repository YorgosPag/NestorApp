/**
 * ADR-865 — Ο «ΚΟΣΜΟΣ» ΠΟΥ ΚΡΙΝΕΙ Η ΠΥΛΗ: δίσκος + git, σε ένα σημείο.
 *
 * Το `judge.js` είναι καθαρό· εδώ ζουν **μόνο** οι αναγνώσεις. Το ίδιο ισχύει για το **επιθυμητό**
 * της ζωντανής επαλήθευσης (`loadDesired`, ADR-865 §10): δίσκος + git, **ποτέ** δίκτυο — ο
 * πάροχος ρωτιέται **μόνο** στο `live.js`.
 *
 * ⚠️ **Βάση σύγκρισης του Κ3** = `HEAD` (pre-commit / pre-push). Στο CI η βάση ορίζεται με
 * `FIRESTORE_DEPLOY_BASE_REF` (π.χ. `origin/main`)· χωρίς αυτήν, στο CI ο Κ3 συγκρίνει το commit
 * με τον εαυτό του — **δηλωμένο όριο**, όχι σιωπηλό πράσινο (ίδιο σχήμα με CHECK 3.85).
 *
 * @module scripts/lib/firestore-deploy/world
 */

'use strict';

const { execFileSync } = require('node:child_process');

const M = require('./model');

/** Έξοδος git ή `null` — ποτέ εξαίρεση προς τα έξω: απουσία ιστορικού δεν είναι σφάλμα πύλης. */
function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: M.paths.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function readHeadLedger() {
  const ref = process.env.FIRESTORE_DEPLOY_BASE_REF || 'HEAD';
  const text = git(['show', `${ref}:${M.rel(M.paths.ledger)}`]);
  if (text === null) return null; // δεν υπήρχε στη βάση — τίποτα καταγεγραμμένο να φυλαχτεί
  try {
    const parsed = JSON.parse(text);
    return { deployments: Array.isArray(parsed.deployments) ? parsed.deployments : [] };
  } catch {
    return null;
  }
}

/**
 * **Πόσα commits πέρασαν** από την τελευταία αλλαγή ενός αρχείου — `null` όταν δεν το ξέρει το git.
 *
 * ⚠️ Commits, **ποτέ μέρες**: ρολόι σε κρίση πύλης σημαίνει ότι η ίδια είσοδος δίνει άλλη
 * ετυμηγορία αύριο (μάθημα CHECK 3.33).
 */
function ageInCommits(relative) {
  const sha = git(['log', '-1', '--format=%H', '--', relative]);
  if (!sha) return null;
  const count = git(['rev-list', '--count', `${sha}..HEAD`]);
  return count === null ? null : Number(count);
}

/** Οι στόχοι με το αρχείο τους και το **τρέχον** αποτύπωμα (`digest: null` ⇒ λείπει το αρχείο). */
function resolveTargets(firebaseJson) {
  const targets = [];
  const sourceByTarget = {};
  for (const target of Object.keys(M.DEPLOY_TARGETS)) {
    const source = M.sourceOf(firebaseJson, target);
    if (source === null) continue; // δεν δηλώνεται καθόλου — ο Κ1 κρίνει την πληρότητα
    sourceByTarget[target] = source;
    const bytes = M.readSource(source);
    targets.push({ target, source, digest: bytes === null ? null : M.digestOf(bytes) });
  }
  return { targets, sourceByTarget };
}

// ============================================================================
// ΤΟ ΕΠΙΘΥΜΗΤΟ — για την κρίση του ζωντανού (ADR-865 §10, `drift.js`)
// ============================================================================

/** Τα **ακατέργαστα** bytes ενός αρχείου σε ένα commit — χωρίς `trim`, που θα άλλαζε το αποτύπωμα. */
function gitBytes(args) {
  try {
    return execFileSync('git', args, {
      cwd: M.paths.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/**
 * **Τα bytes που στάλθηκαν στην καταγεγραμμένη ανάπτυξη**, ανασυντεθειμένα από το git.
 *
 * 🔴 Μετρημένο 2026-09-18 με `core.autocrlf=true`: το `storage.rules` είναι **CRLF** στον δίσκο
 * και **LF** στο blob, ενώ το `firestore.rules` είναι LF και στα δύο. Ούτε το `git show` (ωμό
 * blob) ούτε το `git cat-file --filters` αναπαράγουν **πάντα** τον δίσκο — και το δεύτερο
 * εξαρτάται από τη ρύθμιση **του μηχανήματος** (σε CI χωρίς autocrlf δεν δίνει ποτέ CRLF).
 * ⇒ Υποψήφιες είναι οι **τρεις αποδόσεις γραμμών** του blob (ως έχει · LF · CRLF), και δεκτή
 * εκείνη της οποίας το sha256 **ταιριάζει με το αποτύπωμα του μητρώου**. Το αποτύπωμα είναι η
 * απόδειξη· καμία μαντεψιά, καμία εξάρτηση από ρύθμιση git.
 */
function recordedBytes(row) {
  if (!row.commit) return { bytes: null, why: 'η γραμμή του μητρώου δεν έχει commit' };
  const blob = gitBytes(['show', `${row.commit}:${row.source}`]);
  if (blob === null) return { bytes: null, why: `το ${row.source} δεν βρέθηκε στο ${row.commit}` };
  const lf = blob.replace(/\r\n/g, '\n');
  for (const bytes of [blob, lf, lf.replace(/\n/g, '\r\n')]) {
    if (M.digestOf(bytes) === row.digest) return { bytes, why: null };
  }
  return { bytes: null, why: `τα bytes που στάλθηκαν ΔΕΝ ήταν δεσμευμένα στο ${row.commit}` };
}

function desiredRuleset(target, source, bytes, ledger) {
  const row = M.lastDeployment(ledger, target);
  let recorded = null;
  if (row !== null) {
    const { bytes: sent, why } = recordedBytes(row);
    recorded = { at: row.at, commit: row.commit, digest: row.digest, wire: sent === null ? null : M.wireOf(target, sent), why };
  }
  return { kind: 'ruleset', source, digest: M.digestOf(bytes), wire: M.wireOf(target, bytes), recorded };
}

/**
 * **Ό,τι λέει το δέντρο** για κάθε δηλωμένο στόχο που έχει αρχείο — τα bytes του **δίσκου**
 * (αυτά στέλνει το `firebase deploy`), ποτέ του `HEAD`.
 */
function loadDesired(world) {
  const desired = {};
  for (const { target, source, digest } of world.targets) {
    if (digest === null) continue; // λείπει το αρχείο — ο Κ2 κρίνει
    const bytes = M.readSource(source);
    if (M.DEPLOY_TARGETS[target].provider.kind === 'indexes') {
      const spec = JSON.parse(bytes);
      desired[target] = { kind: 'indexes', source, indexes: spec.indexes || [], fieldOverrides: spec.fieldOverrides || [] };
      continue;
    }
    desired[target] = desiredRuleset(target, source, bytes, world.ledger);
  }
  return desired;
}

/**
 * Πόσα commits **της πηγής** εξετάζονται — φράγμα κόστους (κάθε υποψήφιος κανόνων Firestore
 * μεταγλωττίζεται). Ό,τι είναι παλαιότερο μένει `foreign`: δηλωμένο όριο (ADR-865 §11), όχι σιωπή.
 */
const HISTORY_LIMIT = 200;

/**
 * **Ποιο commit του δέντρου τρέχει;** — απόδοση με **ταύτιση περιεχομένου** (ADR-865 §11).
 *
 * Η γραμμή παραγωγής αναπτύσσει μόνο **δεσμευμένα** bytes και **δεν** γράφει το τοπικό μητρώο
 * (το αρχείο της πράξης είναι το GitHub Deployment). Άρα το ιστορικό του git **είναι** το
 * μητρώο της: αρκεί να βρεθεί το commit του οποίου η μεταγλώττιση = ζωντανό. Απαιτεί πλήρες
 * ιστορικό (`fetch-depth: 0` στο CI) — με ρηχό checkout επιστρέφει `null`, ποτέ ψευδές εύρημα.
 *
 * @returns {{commit:string, at:string}|null}
 */
function attributeFromHistory(target, source, liveContent, limit = HISTORY_LIMIT) {
  if (typeof liveContent !== 'string') return null;
  const log = git(['log', `-n${limit}`, '--format=%h %cs', '--', source]);
  if (!log) return null;
  const want = M.normalizeEol(liveContent);
  for (const line of log.split('\n')) {
    const [commit, at] = line.split(' ');
    const blob = gitBytes(['show', `${commit}:${source}`]);
    if (blob !== null && M.normalizeEol(M.wireOf(target, blob)) === want) return { commit, at };
  }
  return null;
}

// ============================================================================
// ΤΟ ΔΗΜΟΣΙΕΥΜΕΝΟ — ό,τι θα κρίνει η γραμμή παραγωγής (ADR-865 §11, Κ5)
// ============================================================================

/**
 * Το ref που **φτάνει** στη γραμμή παραγωγής. Τοπικά `origin/main` (το τελευταίο push)· σε CI
 * ορίζεται ρητά (`FIRESTORE_DEPLOY_PUBLISHED_REF`).
 */
const publishedRef = (env = process.env) => env.FIRESTORE_DEPLOY_PUBLISHED_REF || 'origin/main';

/**
 * `same` · `differs` · `unknown` — η πηγή του δίσκου έναντι του δημοσιευμένου ref, **modulo
 * αλλαγές γραμμής** (Windows CRLF στον δίσκο, LF στο blob — `M.normalizeEol`).
 * `unknown` **μόνο** όταν το ref δεν υπάρχει (π.χ. κλώνος χωρίς remote) — ποτέ ψευδές «ίδιο».
 */
function publishedStateOf(source, ref) {
  if (git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) === null) return 'unknown';
  const disk = M.readSource(source);
  const published = gitBytes(['show', `${ref}:${source}`]);
  if (disk === null || published === null) return disk === published ? 'same' : 'differs';
  return M.normalizeEol(disk) === M.normalizeEol(published) ? 'same' : 'differs';
}

function loadWorld() {
  const firebaseJson = M.loadFirebaseJson();
  const { targets, sourceByTarget } = resolveTargets(firebaseJson);
  const ref = publishedRef();
  return {
    firebaseJson,
    ledger: M.loadLedger(),
    headLedger: readHeadLedger(),
    targets: targets.map((t) => ({ ...t, published: publishedStateOf(t.source, ref) })),
    publishedRef: ref,
    sourceByTarget,
    ageOf: ageInCommits,
  };
}

module.exports = {
  loadWorld,
  loadDesired,
  recordedBytes,
  attributeFromHistory,
  publishedStateOf,
  publishedRef,
  readHeadLedger,
  ageInCommits,
  resolveTargets,
  git,
};
