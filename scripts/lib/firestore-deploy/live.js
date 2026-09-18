/**
 * ADR-865 §10 — Ο «ΖΩΝΤΑΝΟΣ ΚΟΣΜΟΣ»: τι τρέχει **ΤΩΡΑ** στο Firebase, ρωτημένο από τον πάροχο.
 *
 * Το **μόνο** σημείο του αποθετηρίου που ρωτά το Firebase για κανόνες και δείκτες. Η κρίση ζει
 * στο καθαρό `drift.js`· εδώ **μόνο** αναγνώσεις — κανένα `PATCH`/`POST`/`DELETE`, ποτέ.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΡΩΤΑΜΕ Ο,ΤΙ ΓΡΑΦΕΙ Ο DEPLOYER — ΜΕ ΤΑ ΙΔΙΑ ΟΝΟΜΑΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 * Αναγνωσμένο στην πηγή του firebase-tools 15.13.0 (2026-09-18):
 *
 * | Στόχος | Τι ενημερώνει το `firebase deploy` | Πηγή |
 * |---|---|---|
 * | κανόνες Firestore | release `cloud.firestore` (ή `cloud.firestore/<database>`) | `lib/rulesDeploy.js` · `deploy/firestore/release.js` |
 * | κανόνες Storage | release `firebase.storage/<bucket>` — ο bucket από `v1alpha/…/defaultBucket` | `deploy/storage/prepare.js` · `gcp/storage.js` |
 * | δείκτες | `…/collectionGroups/-/indexes` + `fields?filter=indexConfig.usesAncestorConfig=false OR ttlConfig:*` χωρίς `__default__` | `lib/firestore/api.js` |
 *
 * 🔴 Γιατί έχει σημασία, **μετρημένο**: το project έχει **δύο** releases storage — το παλιό
 * `firebase.storage` (2025-08-10) και το `firebase.storage/pagonis-87766.firebasestorage.app`
 * (αυτό που ενημερώνει το deploy). Επαληθευτής που θα διάλεγε «το πρώτο που μοιάζει» θα έκρινε
 * **νεκρό** release και θα έβγαζε ψευδή απόκλιση — ή, χειρότερα, ψευδή ισοτιμία.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΑΥΤΟΤΗΤΑ: Application Default Credentials — η πρακτική της Google
 * ────────────────────────────────────────────────────────────────────────────
 * Μέσω του `google-auth-library` (Apache-2.0 — βλ. `defaultCredential`), κανένα shell-out στο
 * `gcloud`. Τοπικά: `gcloud auth application-default login`· σε CI: ταυτότητα **χωρίς κλειδί**
 * (Workload Identity Federation, `google-github-actions/auth`) — **ο ίδιος κώδικας** (ADR-865 §11).
 * ⚠️ Το header `x-goog-user-project` είναι **υποχρεωτικό** με διαπιστευτήρια χρήστη: χωρίς αυτό το
 * Rules API απαντά `403 SERVICE_DISABLED`, που **διαβάζεται σαν έλλειψη δικαιωμάτων** και έτσι
 * καταγράφηκε λανθασμένα ως «αδύνατο» στο §3 (διαψεύστηκε 2026-09-18).
 *
 * @module scripts/lib/firestore-deploy/live
 */

'use strict';

const M = require('./model');

const API = Object.freeze({
  rules: 'https://firebaserules.googleapis.com/v1',
  firestore: 'https://firestore.googleapis.com/v1',
  storage: 'https://firebasestorage.googleapis.com/v1alpha',
});

const REQUEST_TIMEOUT_MS = 30_000;
const TOKEN_SLACK_MS = 60_000;

// ============================================================================
// PROJECT — ποτέ μαντεψιά
// ============================================================================

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

/**
 * Το project — ρητό `--project`, αλλιώς `FIREBASE_PROJECT_ID`, αλλιώς `null` (ο καλών αρνείται).
 * Λάθος project εδώ σημαίνει κρίση — ή ανάπτυξη — σε **ξένο** δέντρο.
 */
function resolveProject(argv, env = process.env) {
  return argValue(argv, '--project') || env.FIREBASE_PROJECT_ID || null;
}

// ============================================================================
// ΜΕΤΑΦΟΡΑ — GET μόνο, με ADC
// ============================================================================

/** Σφάλμα παρόχου με τον **λόγο** της Google (`ErrorInfo.reason`), όχι μόνο τον κωδικό. */
class LiveError extends Error {
  constructor(status, reason, message) {
    super(`${status}${reason ? ` ${reason}` : ''} — ${message}`);
    this.status = status;
    this.reason = reason;
  }
}

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const FALLBACK_TOKEN_TTL_S = 300;

/**
 * **ADC μέσω του `google-auth-library`** — του ίδιου που χρησιμοποιεί το firebase-tools
 * (`lib/requireAuth.js`: `new GoogleAuth(…)`), ώστε επαληθευτής και deployer να βλέπουν την ίδια
 * ταυτότητα. Επιστρέφει το σχήμα `{access_token, expires_in}` που περιμένει η μεταφορά.
 *
 * 🔴 **Γιατί ΟΧΙ πια το `firebase-admin` (μετρημένο 2026-09-18, ADR-865 §11)**: το
 * `applicationDefault()` του 12.7.0 δέχεται **μόνο** `service_account` · `authorized_user` ·
 * `impersonated_service_account` (`credential-internal.js:479-496`) — το `external_account` της
 * **ταυτότητας χωρίς κλειδί** (Workload Identity Federation) απαντά *«Invalid contents in the
 * credentials file»*. Ο ισχυρισμός «ο ίδιος κώδικας τοπικά και σε CI» (§10.2) ίσχυε μόνο με
 * **κλειδί** service account — δηλαδή ακριβώς με αυτό που η Google συνιστά να **μην** υπάρχει.
 */
function defaultCredential() {
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] });
  return {
    async getAccessToken() {
      const client = await auth.getClient();
      const { token } = await client.getAccessToken();
      if (!token) throw new LiveError(401, 'NO_ACCESS_TOKEN', 'τα ADC δεν έδωσαν token');
      const expiry = client.credentials && client.credentials.expiry_date;
      const ttl = expiry ? Math.floor((expiry - Date.now()) / 1000) : FALLBACK_TOKEN_TTL_S;
      return { access_token: token, expires_in: Math.max(0, ttl) };
    },
  };
}

async function errorOf(response) {
  const body = await response.json().catch(() => ({}));
  const error = body.error || {};
  const info = (error.details || []).find((d) => String(d['@type']).endsWith('ErrorInfo'));
  return new LiveError(response.status, info ? info.reason : error.status, error.message || response.statusText);
}

/**
 * **Μεταφορά μόνο-ανάγνωσης.** Το token κρατιέται μέχρι λίγο πριν λήξει — το `--wait` μπορεί να
 * ρωτά για λεπτά, και κάθε νέο token χωρίς λόγο είναι μια κλήση OAuth παραπάνω.
 * `getJson` επιστρέφει `null` στο **404** (ό,τι δεν υπάρχει δεν είναι σφάλμα μεταφοράς).
 */
function createTransport(project, { credential = defaultCredential(), fetchImpl = fetch } = {}) {
  let cached = null;
  async function token() {
    if (cached && cached.expiresAt - Date.now() > TOKEN_SLACK_MS) return cached.value;
    const t = await credential.getAccessToken();
    cached = { value: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
    return cached.value;
  }
  async function getJson(url) {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${await token()}`, 'x-goog-user-project': project },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw await errorOf(response);
    return response.json();
  }
  return { getJson };
}

// ============================================================================
// ΑΝΑΓΝΩΣΕΙΣ
// ============================================================================

async function fetchDefaultBucket(t, project) {
  const body = await t.getJson(`${API.storage}/projects/${project}/defaultBucket`);
  const name = body && body.bucket && body.bucket.name;
  if (!name) throw new LiveError(404, 'NO_DEFAULT_BUCKET', 'το project δεν έχει προεπιλεγμένο bucket');
  return name.split('/').pop();
}

/** Το release ενός στόχου κανόνων **και** τα αρχεία του ruleset που δείχνει. */
async function fetchRelease(t, project, release) {
  const rel = await t.getJson(`${API.rules}/projects/${project}/releases/${release}`);
  if (rel === null) return { release, rulesetName: null, updateTime: null, files: [] };
  const ruleset = await t.getJson(`${API.rules}/${rel.rulesetName}`);
  return {
    release,
    rulesetName: rel.rulesetName,
    updateTime: rel.updateTime ?? null,
    files: ruleset && ruleset.source ? ruleset.source.files || [] : [],
  };
}

/** Όλες οι σελίδες μιας λίστας — το API **απορρίπτει** `pageSize≠0` (μετρημένο), αλλά σέβεται token. */
async function listAll(t, url, key) {
  const out = [];
  let pageToken = null;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const page = await t.getJson(pageToken ? `${url}${sep}pageToken=${encodeURIComponent(pageToken)}` : url);
    out.push(...((page && page[key]) || []));
    pageToken = page && page.nextPageToken;
  } while (pageToken);
  return out;
}

const segment = (name, after) => {
  const parts = name.split('/');
  return parts[parts.indexOf(after) + 1];
};

function toIndex(raw) {
  return { ...raw, collectionGroup: segment(raw.name, 'collectionGroups') };
}

function toOverride(raw) {
  const config = raw.indexConfig || {};
  return {
    collectionGroup: segment(raw.name, 'collectionGroups'),
    fieldPath: segment(raw.name, 'fields'),
    indexes: config.indexes || [],
    ttlState: raw.ttlConfig ? raw.ttlConfig.state || 'STATE_UNSPECIFIED' : null,
  };
}

async function fetchIndexes(t, project, database) {
  const db = `${API.firestore}/projects/${project}/databases/${database}`;
  const info = await t.getJson(db);
  if (info === null) throw new LiveError(404, 'NO_DATABASE', `η βάση «${database}» δεν υπάρχει`);
  const filter = encodeURIComponent('indexConfig.usesAncestorConfig=false OR ttlConfig:*');
  const [indexes, fields] = await Promise.all([
    listAll(t, `${db}/collectionGroups/-/indexes`, 'indexes'),
    listAll(t, `${db}/collectionGroups/-/fields?filter=${filter}`, 'fields'),
  ]);
  return {
    edition: info.databaseEdition || 'STANDARD',
    indexes: indexes.map(toIndex),
    fieldOverrides: fields.filter((f) => !f.name.includes('__default__')).map(toOverride),
  };
}

// ============================================================================
// Ο ΖΩΝΤΑΝΟΣ ΚΟΣΜΟΣ
// ============================================================================

/** Ένας στόχος — σφάλμα γίνεται **ετυμηγορία** `Unknown`, ποτέ σιωπηλό πράσινο ή κατάρρευση. */
async function settle(read) {
  try {
    return await read();
  } catch (error) {
    return { error: error instanceof LiveError ? error.message : `σφάλμα μεταφοράς — ${error.message}` };
  }
}

/**
 * @param {{project:string, firebaseJson:object, transport:{getJson:Function}}} opts
 * @returns {Promise<Record<string, object>>} ανά στόχο το ζωντανό, ή `{error}`.
 */
async function loadLiveWorld({ project, firebaseJson, transport }) {
  const live = {};
  let bucket = null; // ρωτιέται μία φορά, και μόνο αν το firebase.json δεν ονομάζει bucket
  const defaultBucketOnce = () => (bucket ??= settle(() => fetchDefaultBucket(transport, project)));
  await Promise.all(Object.keys(M.DEPLOY_TARGETS).map(async (target) => {
    if (M.sourceOf(firebaseJson, target) === null) return; // δεν δηλώνεται — ο Κ1 κρίνει
    const provider = M.DEPLOY_TARGETS[target].provider;
    if (provider.kind === 'indexes') {
      live[target] = await settle(() => fetchIndexes(transport, project, M.databaseOf(firebaseJson)));
      return;
    }
    const needsDefault = provider.needsBucket && M.explicitBucketOf(firebaseJson) === null;
    const defaultBucket = needsDefault ? await defaultBucketOnce() : null;
    if (defaultBucket && defaultBucket.error) {
      live[target] = defaultBucket;
      return;
    }
    const release = M.releaseNameOf(firebaseJson, target, defaultBucket);
    live[target] = await settle(() => fetchRelease(transport, project, release));
  }));
  return live;
}

module.exports = {
  API,
  LiveError,
  resolveProject,
  argValue,
  createTransport,
  loadLiveWorld,
};
