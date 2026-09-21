/**
 * ADR-865 — Ο «ΚΟΣΜΟΣ» ΠΟΥ ΚΡΙΝΕΙ Η ΠΥΛΗ: ένα δέντρο + git, σε ένα σημείο.
 *
 * Το `judge.js` είναι καθαρό· εδώ ζουν **μόνο** οι αναγνώσεις. Το ίδιο ισχύει για το **επιθυμητό**
 * της ζωντανής επαλήθευσης (`loadDesired`, ADR-865 §10): δέντρο + git, **ποτέ** δίκτυο — ο
 * πάροχος ρωτιέται **μόνο** στο `live.js`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΟΙΟ ΔΕΝΤΡΟ; — ADR-865 §11.8 (Ε1): «κρίνε ό,τι ΦΕΥΓΕΙ, όχι ό,τι βρίσκεται στον δίσκο»
 * ────────────────────────────────────────────────────────────────────────────
 * | Δέντρο | Ποιος το ζητά | Γιατί |
 * |---|---|---|
 * | `index` | pre-commit (CHECK 3.86) | ό,τι θα **δεσμεύσει** το commit |
 * | `<sha>` | pre-push (`--at-push`) | ό,τι **στέλνει** το push (stdin του hook, githooks(5)) |
 * | `HEAD` | `firestore:verify` (προεπιλογή) | ό,τι κρίνει η γραμμή — Argo CD: *«the tip of the branch»* |
 * | `worktree` | `firestore:deploy` (έκτακτη ανάγκη) | ό,τι στέλνει το `firebase deploy` — διαβάζει τον δίσκο |
 *
 * 🔴 Μετρημένο 2026-09-19: με **+9 ακομμίτιστες** γραμμές άλλης συνεδρίας στο `firestore.rules`, ο
 * pre-push έλεγε *«διαφέρει — στο push: έγκριση»* για push που **δεν** τις περιείχε, και το
 * `firestore:verify` έβγαινε **EXIT 2** ενώ η παραγωγή = HEAD. Σε **κοινό** working tree ο δίσκος
 * δεν είναι κανενός η πρόθεση. Γι' αυτό το δέντρο είναι **υποχρεωτική** παράμετρος: σιωπηλή
 * προεπιλογή «δίσκος» ήταν ακριβώς η βλάβη.
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

// ============================================================================
// ΤΟ ΔΕΝΤΡΟ — ένας αναγνώστης, τρεις πηγές (ADR-865 §11.8)
// ============================================================================

const TREE = Object.freeze({ WORKTREE: 'worktree', INDEX: 'index' });

const ZERO_OID = /^0+$/;

/** Υπάρχει αυτό το commit; — ref που δεν λύνεται δεν γίνεται σιωπηλά «όλα τα αρχεία λείπουν». */
const isCommit = (ref) => git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null;

/**
 * `(relative) => string|null` για το δέντρο. Blob/index = **ωμά** bytes (χωρίς φίλτρα checkout)·
 * η διαφορά γραμμών κρίνεται στη σύγκριση (`M.normalizeEol` · `M.renderingOf`), όχι εδώ.
 */
function treeReader(tree) {
  if (tree === TREE.WORKTREE) return M.readSource;
  if (tree !== TREE.INDEX && !isCommit(tree)) {
    throw new Error(`firestore-deploy: το δέντρο «${tree}» δεν είναι commit — ούτε "${TREE.INDEX}" ούτε "${TREE.WORKTREE}"`);
  }
  const prefix = tree === TREE.INDEX ? ':' : `${tree}:`;
  return (relative) => gitBytes(['show', `${prefix}${relative}`]);
}

/** Το μητρώο σε ένα ref, ή `null` — δεν υπήρχε εκεί ⇒ τίποτα καταγεγραμμένο να φυλαχτεί (Κ3). */
function ledgerAt(ref) {
  if (ref === null) return null;
  const text = git(['show', `${ref}:${M.rel(M.paths.ledger)}`]);
  if (text === null) return null;
  try {
    return { deployments: M.parseLedger(text).deployments };
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

/** Οι στόχοι με το αρχείο τους και το αποτύπωμα **του δέντρου** (`digest: null` ⇒ λείπει το αρχείο). */
function resolveTargets(firebaseJson, read) {
  const targets = [];
  const sourceByTarget = {};
  for (const target of Object.keys(M.DEPLOY_TARGETS)) {
    const source = M.sourceOf(firebaseJson, target);
    if (source === null) continue; // δεν δηλώνεται καθόλου — ο Κ1 κρίνει την πληρότητα
    sourceByTarget[target] = source;
    const bytes = read(source);
    targets.push({ target, source, digest: bytes === null ? null : M.digestOf(bytes) });
  }
  return { targets, sourceByTarget };
}

// ============================================================================
// ΤΟ ΕΠΙΘΥΜΗΤΟ — για την κρίση του ζωντανού (ADR-865 §10, `drift.js`)
// ============================================================================

/**
 * **Τα bytes που στάλθηκαν στην καταγεγραμμένη ανάπτυξη**, ανασυντεθειμένα από το git.
 *
 * 🔴 Μετρημένο 2026-09-18 με `core.autocrlf=true`: το `storage.rules` είναι **CRLF** στον δίσκο
 * και **LF** στο blob. Δεκτή είναι η απόδοση γραμμών του blob της οποίας το sha256 **ταιριάζει με
 * το αποτύπωμα του μητρώου** (`M.renderingOf`) — καμία μαντεψιά, καμία εξάρτηση από ρύθμιση git.
 */
function recordedBytes(row) {
  if (!row.commit) return { bytes: null, why: 'η γραμμή του μητρώου δεν έχει commit' };
  const blob = gitBytes(['show', `${row.commit}:${row.source}`]);
  if (blob === null) return { bytes: null, why: `το ${row.source} δεν βρέθηκε στο ${row.commit}` };
  const bytes = M.renderingOf(row.digest, blob);
  return bytes === null
    ? { bytes: null, why: `τα bytes που στάλθηκαν ΔΕΝ ήταν δεσμευμένα στο ${row.commit}` }
    : { bytes, why: null };
}

/**
 * `recorded.matchesTree` — **κατέγραψε το μητρώο αυτό το περιεχόμενο;** Modulo αλλαγές γραμμής
 * (ADR-865 Ε2): η ίδια ερώτηση πρέπει να δίνει την ίδια απάντηση σε Windows (CRLF) και CI (LF).
 */
function desiredRuleset(target, source, bytes, ledger) {
  const row = M.lastDeployment(ledger, target);
  let recorded = null;
  if (row !== null) {
    const { bytes: sent, why } = recordedBytes(row);
    recorded = {
      at: row.at, commit: row.commit, digest: row.digest, why,
      wire: sent === null ? null : M.wireOf(target, sent),
      matchesTree: M.renderingOf(row.digest, bytes) !== null,
    };
  }
  return { kind: 'ruleset', source, digest: M.digestOf(bytes), wire: M.wireOf(target, bytes), recorded };
}

/** **Ό,τι λέει το δέντρο** του κόσμου (`world.tree`) για κάθε δηλωμένο στόχο που έχει αρχείο. */
function loadDesired(world) {
  const desired = {};
  for (const { target, source, digest } of world.targets) {
    if (digest === null) continue; // λείπει το αρχείο — ο Κ2 κρίνει
    const bytes = world.read(source);
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
  for (const line of log.split('\n')) {
    const [commit, at] = line.split(' ');
    if (wireMatchesAt(target, source, commit, liveContent)) return { commit, at };
  }
  return null;
}

/**
 * **Είναι το ζωντανό η μεταγλώττιση της πηγής @commit;** — modulo αλλαγές γραμμής. Η **μία**
 * ταύτιση περιεχομένου έναντι του git: την κάνουν το `attributeFromHistory` **και** η απόδοση
 * από τα GitHub Deployments (ADR-865 §11.10). Commit που λείπει (ρηχό checkout) ⇒ `false`.
 */
function wireMatchesAt(target, source, commit, liveContent) {
  if (typeof liveContent !== 'string') return false;
  const blob = gitBytes(['show', `${commit}:${source}`]);
  return blob !== null && M.normalizeEol(M.wireOf(target, blob)) === M.normalizeEol(liveContent);
}

// ============================================================================
// ΤΟ ΔΗΜΟΣΙΕΥΜΕΝΟ — ό,τι θα κρίνει η γραμμή παραγωγής (ADR-865 §11, Κ5)
// ============================================================================

/**
 * Το ref που **φτάνει** στη γραμμή παραγωγής. Τοπικά `origin/main` (το τελευταίο push)· σε CI
 * ορίζεται ρητά (`FIRESTORE_DEPLOY_PUBLISHED_REF`). Στο pre-push: το `<remote sha>` του stdin.
 */
const publishedRef = (env = process.env) => env.FIRESTORE_DEPLOY_PUBLISHED_REF || 'origin/main';

/** Ίδιο περιεχόμενο modulo αλλαγές γραμμής (`null` = λείπει· ίσο μόνο με `null`). */
const sameText = (a, b) => (a === null || b === null ? a === b : M.normalizeEol(a) === M.normalizeEol(b));

/**
 * `same` · `differs` · `unknown` — η πηγή **του δέντρου** έναντι του δημοσιευμένου ref.
 * `unknown` **μόνο** όταν το ref δεν υπάρχει (π.χ. κλώνος χωρίς remote) — ποτέ ψευδές «ίδιο».
 */
function publishedStateOf(source, ref, read) {
  if (ref === null || !isCommit(ref)) return 'unknown';
  return sameText(read(source), gitBytes(['show', `${ref}:${source}`])) ? 'same' : 'differs';
}

/**
 * **Οι πηγές όπου ο δίσκος ≠ το κρινόμενο δέντρο** — για **ορατή** σημείωση, ποτέ σιωπηλή: ο
 * άνθρωπος πρέπει να ξέρει ότι αλλαγές που βλέπει στον editor **δεν** κρίθηκαν.
 */
function worktreeDriftOf(targets, tree, read) {
  if (tree === TREE.WORKTREE) return [];
  return targets.filter(({ source }) => !sameText(M.readSource(source), read(source))).map((t) => t.source);
}

/**
 * Οι γραμμές του stdin του pre-push (githooks(5)): `<local ref> SP <local sha> SP <remote ref> SP
 * <remote sha>`. Οι **διαγραφές** (local sha = μηδενικά) δεν στέλνουν δέντρο ⇒ εκτός· νέο remote
 * ref ⇒ `remoteSha: null`.
 */
function parsePushLines(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length === 4 && !ZERO_OID.test(parts[1]))
    .map(([localRef, localSha, remoteRef, remoteSha]) => ({
      localRef, localSha, remoteRef, remoteSha: ZERO_OID.test(remoteSha) ? null : remoteSha,
    }));
}

/**
 * @param {object} options
 * @param {string} options.tree `TREE.WORKTREE` · `TREE.INDEX` · commit — **υποχρεωτικό** (§11.8)
 * @param {string|null} [options.baseRef] βάση του Κ3 (append-only)· προεπιλογή `HEAD` για δίσκο/index
 * @param {string|null} [options.published] ref της γραμμής· `null` ⇒ ο στόχος δεν φτάνει στη γραμμή
 */
function loadWorld({ tree, baseRef, published } = {}) {
  if (!tree) throw new Error('firestore-deploy: loadWorld χωρίς δέντρο — δήλωσε ποιο κρίνεται (ADR-865 §11.8)');
  const read = treeReader(tree);
  const firebaseJson = JSON.parse(read('firebase.json'));
  const { targets, sourceByTarget } = resolveTargets(firebaseJson, read);
  const snapshot = tree === TREE.WORKTREE || tree === TREE.INDEX;
  const base = baseRef !== undefined ? baseRef : (snapshot ? process.env.FIRESTORE_DEPLOY_BASE_REF || 'HEAD' : null);
  const ref = published !== undefined ? published : publishedRef();
  return {
    tree,
    read,
    firebaseJson,
    ledger: M.parseLedger(read(M.rel(M.paths.ledger))),
    headLedger: ledgerAt(base),
    targets: targets.map((t) => ({ ...t, published: ref === null ? 'off-pipeline' : publishedStateOf(t.source, ref, read) })),
    publishedRef: ref,
    worktreeDrift: worktreeDriftOf(targets, tree, read),
    sourceByTarget,
    ageOf: ageInCommits,
  };
}

module.exports = {
  TREE,
  loadWorld,
  loadDesired,
  recordedBytes,
  attributeFromHistory,
  wireMatchesAt,
  publishedStateOf,
  publishedRef,
  parsePushLines,
  ledgerAt,
  ageInCommits,
  resolveTargets,
  treeReader,
  git,
  gitBytes,
};
