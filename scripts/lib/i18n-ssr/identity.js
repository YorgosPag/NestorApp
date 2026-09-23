'use strict';
/**
 * =============================================================================
 * Χ — Ο ΧΡΗΣΜΟΣ ΜΕ ΤΑΥΤΟΤΗΤΑ: golden tenant (CHECK 3.51 Χ · ADR-875)
 * =============================================================================
 *
 * Οι `/o/[workspace]/**` δεν κρίνονταν ΠΟΤΕ: ο χρησμός χτυπούσε ανώνυμα και το
 * `o/[workspace]/layout.tsx` ανακατεύθυνε στη σύνδεση πριν από κάθε render
 * (ADR-781 §13-§15). Το `[workspace]` **δεν είναι οντότητα, είναι ταυτότητα** —
 * άρα δεν γεμίζει με συνθετικό τμήμα, γεμίζει με **συνεδρία**.
 *
 * 🔑 ΤΡΕΙΣ ΑΡΧΕΣ (ADR-875 §3):
 *
 * 1. **HERMETIC ΕΚ ΚΑΤΑΣΚΕΥΗΣ.** Συνεδρία κόβεται ΜΟΝΟ σε project `demo-*` (η
 *    σύμβαση του Firebase: «demo project = κανένας πραγματικός πόρος») και ΜΟΝΟ
 *    σε emulator loopback. Αλλιώς `throw` — ποτέ «προσπάθησε». Ο φρουρός είναι
 *    εδώ, στον καταναλωτή, και όχι μόνο στο workflow: ένα workflow αλλάζει.
 *
 * 2. **Η ΣΥΝΕΔΡΙΑ ΚΟΒΕΤΑΙ ΑΠΟ ΤΗ ΣΤΑΛΜΕΝΗ ΕΙΚΟΝΑ.** Το ID token ανταλλάσσεται στο
 *    `POST /api/auth/session` **της εικόνας** (ADR-788: κρίνουμε ό,τι στάλθηκε),
 *    όχι σε cookie φτιαγμένο δίπλα της — έτσι ελέγχεται και η ίδια η πόρτα.
 *
 * 3. **ΤΟ COOKIE ΔΕΝ ΓΙΝΕΤΑΙ ΠΟΤΕ ΔΕΔΟΜΕΝΟ.** Ζει σε `Map` που περνά στις
 *    επιλογές της σάρωσης· **ποτέ** στο αντικείμενο διαδρομής, που απλώνεται
 *    (`...route`) σε κάθε εγγραφή → αναφορά → baseline → artifact.
 *
 * ⚠️ **ΚΑΜΙΑ npm ΕΞΑΡΤΗΣΗ** (το job του χρησμού δεν έχει `node_modules` — ADR-788).
 *    Οι τέσσερις σταθερές πιο κάτω **αντιγράφουν** αυθεντίες σε TypeScript· η
 *    συμφωνία τους **εκτελείται** στην άγκυρα `i18n-ssr-identity.test.ts` (Τ1).
 * =============================================================================
 */

const fs = require('node:fs');

const { SYNTHETIC_SEGMENT } = require('./states');
const { parseGolden, bindWorkspaceRoute } = require('./golden-bindings');

/** Αντίγραφα αυθεντιών — ΕΛΕΓΧΟΝΤΑΙ στην άγκυρα Τ1, ποτέ θέμα εμπιστοσύνης. */
const IDENTITY_CONTRACT = Object.freeze({
  /** `WORKSPACE_PATH_PREFIX` — `src/lib/workspace/workspace-path.ts` */
  workspacePrefix: 'o',
  /** `AUTH_ROUTES.login` — `src/lib/routes/authRoutes.ts` */
  loginPath: '/login',
  /** `SESSION_COOKIE_CONFIG.NAME` — `src/lib/auth/security-policy.ts` */
  sessionCookie: '__session',
  /** `src/app/api/auth/session/route.ts` — η πόρτα σύνδεσης της εικόνας */
  sessionEndpoint: '/api/auth/session',
});

// v2 (ADR-875 §10): + `golden` — ΥΠΟΧΡΕΩΤΙΚΟ, άρα bump και όχι προαιρετικό πεδίο στο v1.
const MANIFEST_SCHEMA = 'i18n-ssr-personas/v2';
const HERMETIC_PROJECT = /^demo-[a-z0-9-]+$/;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** `ENV` — η μόνη είσοδος· καμία τιμή δεν γράφεται σε κώδικα (CHECK 10). */
const IDENTITY_ENV = Object.freeze({
  manifest: 'I18N_SSR_ORACLE_PERSONAS',
  credential: 'DEMO_SEED_PASSWORD',
});

// ---------------------------------------------------------------------------
// 1. Το manifest — το γράφει ο ΣΠΟΡΕΑΣ, ο χρησμός μόνο το διαβάζει
// ---------------------------------------------------------------------------

function fail(message) {
  throw new Error(`CHECK 3.51 Χ (ADR-875): ${message}`);
}

function assertPersona(persona, index) {
  const where = `personas[${index}]`;
  if (!persona || typeof persona !== 'object') fail(`${where}: δεν είναι αντικείμενο`);
  for (const field of ['class', 'email', 'workspaceSegment']) {
    if (typeof persona[field] !== 'string' || persona[field] === '') fail(`${where}.${field}: λείπει`);
  }
  // Το τμήμα μπαίνει ΑΥΤΟΥΣΙΟ σε URL — ό,τι δεν είναι σκέτο τμήμα είναι άρνηση.
  if (!/^[a-z0-9-]+$/.test(persona.workspaceSegment)) fail(`${where}.workspaceSegment: μη έγκυρο τμήμα`);
}

/**
 * fail-closed: κάθε απόκλιση σχήματος είναι `throw`, ποτέ «όσα persona διάβασα».
 * Ένα manifest με **μηδέν** persona θα ξανάκανε τον χρησμό ανώνυμο σιωπηλά.
 */
function parsePersonaManifest(raw) {
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    fail(`μη αναγνώσιμο manifest persona (${error.message})`);
  }
  if (manifest?.schema !== MANIFEST_SCHEMA) fail(`άγνωστο σχήμα manifest «${manifest?.schema}» — αναμενόταν ${MANIFEST_SCHEMA}`);
  if (typeof manifest.projectId !== 'string') fail('manifest χωρίς projectId');
  if (typeof manifest.authEmulatorHost !== 'string') fail('manifest χωρίς authEmulatorHost');
  if (!Array.isArray(manifest.personas) || manifest.personas.length === 0) fail('manifest με ΜΗΔΕΝ persona');
  manifest.personas.forEach(assertPersona);
  const classes = manifest.personas.map((persona) => persona.class);
  if (new Set(classes).size !== classes.length) fail(`διπλή κλάση persona: ${classes.join(', ')}`);
  return { ...manifest, golden: parseGolden(manifest.golden) };
}

/** Φρουρός hermetic — ΠΡΙΝ από οποιοδήποτε αίτημα. */
function assertHermetic(manifest) {
  if (!HERMETIC_PROJECT.test(manifest.projectId)) {
    fail(`το project «${manifest.projectId}» ΔΕΝ είναι demo-* — ο χρησμός αρνείται να κόψει συνεδρία εκτός hermetic project`);
  }
  const host = manifest.authEmulatorHost.replace(/:\d+$/, '');
  if (!LOOPBACK_HOSTS.has(host)) {
    fail(`ο Auth emulator «${manifest.authEmulatorHost}» ΔΕΝ είναι loopback — ο χρησμός δεν στέλνει διαπιστευτήρια εκτός μηχανής`);
  }
}

// ---------------------------------------------------------------------------
// 2. Η κοπή της συνεδρίας — emulator → ΤΗΣ ΕΙΚΟΝΑΣ η πόρτα σύνδεσης
// ---------------------------------------------------------------------------

async function postJson(url, body, headers, timeoutMs) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** Ο emulator δέχεται οποιοδήποτε `key` — δεν υπάρχει κλειδί API να διαρρεύσει. */
async function emulatorIdToken(manifest, email, credential, timeoutMs) {
  const url = `http://${manifest.authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=hermetic`;
  const response = await postJson(url, { email, password: credential, returnSecureToken: true }, {}, timeoutMs);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.idToken !== 'string') {
    fail(`ο emulator αρνήθηκε τη σύνδεση του ${email} (HTTP ${response.status}${payload.error?.message ? ` ${payload.error.message}` : ''})`);
  }
  return payload.idToken;
}

/** Το `__session` από τα `Set-Cookie` — ΜΟΝΟ η τιμή, ποτέ τα attributes. */
function sessionCookieOf(response) {
  const prefix = `${IDENTITY_CONTRACT.sessionCookie}=`;
  const line = response.headers.getSetCookie().find((cookie) => cookie.startsWith(prefix));
  const value = line ? line.slice(prefix.length).split(';')[0] : '';
  return value === '' ? null : `${prefix}${value}`;
}

/**
 * @returns {Promise<string>} η κεφαλίδα `cookie` — ΠΟΤΕ δεν επιστρέφεται σε εγγραφή.
 * ⚠️ Τα μηνύματα σφάλματος ΔΕΝ περιέχουν token ή cookie: καταλήγουν σε `detail`.
 */
async function mintSession({ manifest, persona, baseUrl, userAgent, credential, timeoutMs = 30000 }) {
  assertHermetic(manifest);
  if (!credential) fail(`λείπει το ${IDENTITY_ENV.credential} — ο χρησμός δεν επινοεί διαπιστευτήριο`);
  const idToken = await emulatorIdToken(manifest, persona.email, credential, timeoutMs);
  const response = await postJson(`${baseUrl}${IDENTITY_CONTRACT.sessionEndpoint}`, { idToken }, { 'user-agent': userAgent }, timeoutMs);
  const cookie = response.ok ? sessionCookieOf(response) : null;
  if (!cookie) fail(`η εικόνα ΔΕΝ έκοψε συνεδρία για την κλάση ${persona.class} (HTTP ${response.status})`);
  return cookie;
}

// ---------------------------------------------------------------------------
// 3. Το σύμπαν ανά persona
// ---------------------------------------------------------------------------

const WORKSPACE_ROOT = `/${IDENTITY_CONTRACT.workspacePrefix}/${SYNTHETIC_SEGMENT}`;

/** Διαδρομή του χώρου ⇔ το ΠΡΩΤΟ τμήμα είναι `/o/[workspace]` — ποτέ «περιέχει». */
function isWorkspaceRoute(route) {
  return route.url === WORKSPACE_ROOT || route.url.startsWith(`${WORKSPACE_ROOT}/`);
}

/** Η ταυτότητα ratchet: η διαδρομή + η κλάση (δύο persona στο ΙΔΙΟ URL είναι δύο γεγονότα). */
function routeIdOf(route) {
  return route.persona ? `${route.url}@${route.persona}` : route.url;
}

/**
 * Κάθε `/o/[workspace]/**` → μία διαδρομή **ανά κλάση**. Το `[workspace]` γεμίζει με τον
 * χώρο του persona, τα υπόλοιπα δυναμικά τμήματα με τα golden ids (ADR-875 §10). Το
 * `dynamic` ξαναϋπολογίζεται: όσο μένει έστω ένα `ssr-probe`, η σελίδα μένει 🔶.
 * `golden === null` ⇒ μόνο το `[workspace]` (τα υπόλοιπα μένουν συνθετικά, ορατά).
 */
function expandForPersonas(routes, personas, golden = null) {
  const out = [];
  for (const route of routes) {
    if (!isWorkspaceRoute(route) || personas.length === 0) {
      out.push(route);
      continue;
    }
    for (const persona of personas) {
      out.push({ ...route, ...bindWorkspaceRoute(route, persona, golden), persona: persona.class });
    }
  }
  return out;
}

/** Ανακατεύθυνση ΣΤΗ ΣΥΝΔΕΣΗ ενώ κρατούσαμε συνεδρία ⇒ η εικόνα δεν την τίμησε. */
function isLoginRedirect(target) {
  const login = IDENTITY_CONTRACT.loginPath;
  return target === login || target.startsWith(`${login}?`) || target.startsWith(`${login}/`);
}

// ---------------------------------------------------------------------------
// 4. Η προετοιμασία — ΜΙΑ κλήση από τον CLI
// ---------------------------------------------------------------------------

/**
 * Χωρίς manifest: στο CI ⇒ `throw` (ο χρησμός δεν ξαναγίνεται ανώνυμος σιωπηλά)·
 * τοπικά ⇒ ανώνυμος, με **δηλωμένη** σημείωση.
 * Αποτυχία κοπής ⇒ η κλάση ΔΕΝ μπαίνει στο `sessions`, και ο `probeRoute` βγάζει
 * ⛔ `identity-unproven` σε κάθε διαδρομή της — θορυβώδης, ποτέ σιωπηλός.
 */
async function prepareIdentity(routes, { baseUrl, userAgent, env = process.env }) {
  const file = env[IDENTITY_ENV.manifest];
  if (!file) {
    if (env.CI) fail(`στο CI ο χρησμός απαιτεί ταυτότητα — λείπει το ${IDENTITY_ENV.manifest}`);
    return { routes, sessions: new Map(), failures: new Map(), notice: `χωρίς ${IDENTITY_ENV.manifest}: ο χρησμός είναι ΑΝΩΝΥΜΟΣ` };
  }
  const manifest = parsePersonaManifest(fs.readFileSync(file, 'utf8'));
  assertHermetic(manifest);
  const sessions = new Map();
  const failures = new Map();
  for (const persona of manifest.personas) {
    try {
      sessions.set(persona.class, await mintSession({ manifest, persona, baseUrl, userAgent, credential: env[IDENTITY_ENV.credential] }));
    } catch (error) {
      failures.set(persona.class, error.message);
    }
  }
  const classes = manifest.personas.map((persona) => persona.class).join(', ');
  return {
    routes: expandForPersonas(routes, manifest.personas, manifest.golden),
    sessions,
    failures,
    golden: manifest.golden,
    notice: `ταυτότητα: ${classes} · project ${manifest.projectId} · golden: ${Object.keys(manifest.golden).length} οντότητες`,
  };
}

module.exports = {
  IDENTITY_CONTRACT,
  IDENTITY_ENV,
  MANIFEST_SCHEMA,
  parsePersonaManifest,
  assertHermetic,
  emulatorIdToken, // ADR-875 §10 — και ο σπορέας golden (ΜΙΑ είσοδος στον emulator, όχι κλώνος)
  mintSession,
  isWorkspaceRoute,
  routeIdOf,
  expandForPersonas,
  isLoginRedirect,
  prepareIdentity,
};
