#!/usr/bin/env node
/**
 * =============================================================================
 * Χ — Ο ΧΡΗΣΜΟΣ: ΠΕΡΙΕΧΕΙ ΩΜΑ ΚΛΕΙΔΙΑ ΤΟ HTML ΠΟΥ ΣΤΕΛΝΕΙ Ο SERVER;
 * (CHECK 3.51 / ADR-781 §6)
 * =============================================================================
 *
 * Ο Χ **είναι η αυθεντία**, και ο λόγος είναι δομικός, όχι προτίμηση: δεν
 * μπορεί να είναι πράσινος πάνω σε σπασμένη οθόνη, **γιατί είναι η οθόνη**.
 * Κάθε στατικός κανόνας απαντά για ένα μοντέλο του κόσμου· αυτός απαντά για τον
 * κόσμο. Και είναι ο **μόνος** που απαντά για τις **29 δυναμικές** διαδρομές και
 * για ό,τι η στατική ανάλυση αρνείται.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ 🔴 ΕΞΙ ΤΡΟΠΟΙ ΝΑ ΓΕΝΝΗΘΕΙ ΑΥΤΟΣ Ο ΧΡΗΣΜΟΣ ΜΟΝΙΜΩΣ ΠΡΑΣΙΝΟΣ.               │
 * │ Και οι έξι είναι ΜΕΤΡΗΜΕΝΟΙ σε αυτό το repo, όχι υποθετικοί.             │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 1. **ΤΟ ΠΛΑΣΤΟ USER-AGENT ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟ.** Το `src/middleware.ts` έχει
 *    `BLOCKED_BOT_PATTERNS` με `'curl/'`, `'node-fetch'`, `'axios/'`,
 *    `'headlesschrome'`, `'python-requests'` — και απαντά **`403` με ΚΕΝΟ
 *    σώμα**, **χωρίς καμία εξαίρεση για dev ή localhost** (επαληθεύτηκε
 *    διαβάζοντας τον κώδικα: μηδέν αναφορές σε `NODE_ENV`/`localhost`).
 *    ⚠️ Το `fetch()` του Node στέλνει `node`/`undici` ⇒ **κάθε** naive probe θα
 *    ανέφερε **«0 ωμά κλειδιά σε 141 διαδρομές»**. Θα ήταν η **ένατη** εμφάνιση
 *    του «0 = κανείς δεν κοίταξε» — και θα τη γράφαμε **μόνοι μας**, μέσα στο
 *    όργανο που την κυνηγά. Γι' αυτό το UA είναι **παράμετρος χωρίς προεπιλογή**
 *    και ο κατασκευαστής **σκάει** αν λείπει.
 *
 * 2. **ΘΕΤΙΚΟ CONTROL.** Ένα «0» χωρίς απόδειξη ότι κοιτάχτηκε σελίδα είναι
 *    «0» από άδεια απάντηση. Το control **δεν είναι χειρόγραφο**: είναι
 *    «περιέχει η σελίδα **έστω μία τιμή που μόνο το i18n μπορούσε να
 *    παραγάγει**;». Παράγεται από τα ίδια τα δεδομένα ⇒ δεν παλιώνει.
 *
 * 5. 🔴 **ΤΟ CONTROL ΤΟΥ ΚΕΛΥΦΟΥΣ ΔΕΝ ΕΙΝΑΙ CONTROL ΤΗΣ ΣΕΛΙΔΑΣ** (ADR-788).
 *    Μέχρι τις 2026-08-22 το §2 παραγόταν **αποκλειστικά** από το shell slice —
 *    και το κέλυφος ζωγραφίζεται σε **κάθε** διαδρομή. Άρα η κατάσταση
 *    `probe-unproven` ήταν **δομικά αδύνατο** να πυροδοτήσει: ο χρησμός
 *    αποδείκνυε ότι **η διαδρομή κοιτάχτηκε**, ποτέ ότι **η επιφάνεια
 *    αποδόθηκε**. Πλέον **δύο** σύνολα (`controls.js`), και η σελίδα έχει το
 *    δικό της: μετρημένα **16.538** τιμές έναντι **2.119** του κελύφους.
 *
 * 6. 🔴 **ΤΟ ΣΥΝΘΕΤΙΚΟ `[param]` ΔΕΝ ΕΙΝΑΙ Η ΣΕΛΙΔΑ** (ADR-788). Οι **33**
 *    δυναμικές διαδρομές χτυπιούνται με id που **δεν υπάρχει**, οπότε βάφουν
 *    το «δεν βρέθηκε» τους. Ένα «clean» εκεί είναι ψέμα με άλλο όνομα. Πλέον
 *    ρητή κατάσταση `surface-synthetic-id` — **μετριέται, δεν απαριθμείται**.
 *
 * 3. **ΚΛΕΙΣΤΟ ΣΥΜΠΑΝ ΚΛΕΙΔΙΩΝ.** Το ευρετικό `/\w+(\.\w+)+/` πιάνει
 *    `nestorconstruct.gr`, `report.pdf`, `v1.2.3`. Ένα κλειδί είναι κλειδί
 *    **μόνο αν είναι κυριολεκτικά κλειδί κάποιου locale bundle** (31.361
 *    κλειδιά σε 101 namespaces, βλ. `lib/i18n/locale-keys.js`).
 *
 * 4. **ΔΥΟ ΕΠΙΦΑΝΕΙΕΣ, ΟΧΙ ΜΙΑ.** Ένας χρησμός που κοιτάζει μόνο κόμβους
 *    κειμένου είναι **δομικά τυφλός** σε `placeholder="settings.title"`,
 *    `aria-label="actions.close"`, `title="…"`, `alt="…"` — που είναι εξίσου
 *    ωμά κλειδιά, και το `aria-label` είναι **η μόνη** ετικέτα που ακούει ο
 *    αναγνώστης οθόνης. Σαρώνονται **και** οι δύο.
 *
 * ΤΟ `<script>` ΑΦΑΙΡΕΙΤΑΙ ΩΣ ΠΡΟΦΥΛΑΞΗ, ΟΧΙ ΩΣ ΘΕΡΑΠΕΙΑ
 * -------------------------------------------------------
 * Μετρήθηκε ότι σήμερα **δεν** μολύνει (το `pages.home` εμφανίζεται **0** φορές
 * μέσα σε `<script>`). Αφαιρείται γιατί το RSC flight payload **περιέχει**
 * κλειδιά ως δεδομένα, και μια μελλοντική αλλαγή σειριοποίησης θα γεννούσε
 * ψευδώς θετικά που θα διαβάζονταν ως ρύπανση της οθόνης.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { buildKeyUniverse, flattenAnswerableKeys } = require('../i18n/locale-keys');
const { assertClosedLedger } = require('./ledger');

const X_STATES = Object.freeze({
  UNREACHABLE: 'route-unreachable',
  PROBE_UNPROVEN: 'probe-unproven',
  RAW_KEY: 'raw-key',
  SKIPPED: 'route-skipped',
  SHELL_ONLY: 'surface-shell-only',
  SYNTHETIC_ID: 'surface-synthetic-id',
  CLEAN: 'clean',
});

/** ⛔ ΠΟΤΕ σε baseline: ένας χρησμός που δεν απέδειξε ότι κοίταξε δεν έχει «πρόοδο». */
const X_ZERO_TOLERANCE = Object.freeze([X_STATES.UNREACHABLE, X_STATES.PROBE_UNPROVEN]);
/** 🔴 ratchet κατά ταυτότητα `διαδρομή|επιφάνεια|κλειδί` — ανταλλαγή ⇒ μπλοκ (ADR-749). */
const X_RATCHETED = Object.freeze([X_STATES.RAW_KEY, X_STATES.SKIPPED, X_STATES.SHELL_ONLY]);
/**
 * 🔶 ΜΕΤΡΙΕΤΑΙ, ΔΕΝ ΑΠΑΡΙΘΜΕΙΤΑΙ — και **δεν** μπλοκάρει (πρότυπο
 * `unanalyzable-heritage`, CHECK 3.44).
 *
 * Μια δυναμική διαδρομή χτυπιέται με **συνθετικό** τμήμα, δηλαδή με id που δεν
 * υπάρχει. Ό,τι κι αν βάψει, **δεν είναι η σελίδα**: είναι το «δεν βρέθηκε» της.
 * Το να τη λέγαμε `clean` θα ήταν ψέμα· το να τη λέγαμε ⛔ θα έκανε **33 από τις
 * 154** διαδρομές μονίμως κόκκινες ⇒ `SKIP_` ⇒ διακοσμητική πύλη (η παγίδα που
 * το CHECK 3.39 δοκίμασε και απέρριψε). Μένει **ονομασμένη**.
 *
 * ⚠️ Η ασυμμετρία είναι σκόπιμη: πάνω σε **ακρίτη** επιφάνεια ένα «βρήκα ωμό
 * κλειδί» παραμένει **αληθές** (το κλειδί ζωγραφίστηκε όντως), ενώ ένα «δεν
 * βρήκα» δεν αποδεικνύει τίποτα. Γι' αυτό το `raw-key` κρίνεται **πριν** από
 * αυτή την κατάσταση, όχι μετά.
 */
const X_COUNTED = Object.freeze([X_STATES.SYNTHETIC_ID]);

/** Το τμήμα που μπαίνει στη θέση ενός `[param]`. Σκόπιμα αναγνωρίσιμο στα logs. */
const SYNTHETIC_SEGMENT = 'ssr-probe';

// ---------------------------------------------------------------------------
// 1. Οι διαδρομές — από τη ΣΥΜΒΑΣΗ του Next.js, ποτέ από χειρόγραφη λίστα
// ---------------------------------------------------------------------------

/**
 * `src/app/(group)/spaces/[id]/page.tsx` → `/spaces/ssr-probe`
 * Τα route groups `(…)` **δεν** εμφανίζονται στο URL· τα `[param]`/`[...rest]`
 * παίρνουν συνθετικό τμήμα.
 *
 * @returns {Array<{file: string, url: string, dynamic: boolean}>}
 */
function enumerateRoutes(projectRoot, appDir = path.join('src', 'app')) {
  const root = path.join(projectRoot, appDir);
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'page.tsx' || entry.name === 'page.jsx') found.push(full);
    }
  };
  if (!fs.existsSync(root)) return [];
  walk(root);

  return found
    .map((file) => {
      const rel = path.relative(projectRoot, file).split(path.sep).join('/');
      const segments = rel
        .replace(/^src\/app/, '')
        .replace(/\/page\.[jt]sx$/, '')
        .split('/')
        .filter((segment) => segment !== '' && !/^\(.*\)$/.test(segment));
      const dynamic = segments.some((segment) => segment.startsWith('['));
      const url = `/${segments.map((segment) => (segment.startsWith('[') ? SYNTHETIC_SEGMENT : segment)).join('/')}`;
      return { file: rel, url: url === '/' ? '/' : url.replace(/\/$/, ''), dynamic };
    })
    .sort((a, b) => a.url.localeCompare(b.url));
}

// ---------------------------------------------------------------------------
// 2. Το σύμπαν και το control — και τα δύο ΠΑΡΑΓΟΜΕΝΑ από τα δεδομένα
// ---------------------------------------------------------------------------

/** Κάθε dotted κλειδί κάθε locale namespace. */
function buildUniverse(localeDir) {
  const { universe, unreadable } = buildKeyUniverse(localeDir);
  return { universe, unreadable };
}

/**
 * ⚠️ **Η ΚΡΙΣΗ ΤΩΝ CONTROLS ΖΕΙ ΣΤΟ `controls.js`, ΟΧΙ ΕΔΩ.** Εδώ μένει μόνο
 * η επανεξαγωγή, ώστε να μην υπάρχουν **δύο** ορισμοί του «τι είναι απόδειξη»
 * (ADR-749). Το παλιό όνομα `buildPositiveControls` διατηρείται γιατί το
 * καταναλώνουν οι άγκυρες — αλλά **δείχνει στην ίδια συνάρτηση**.
 */
const { GREEK, greekValuesIn, buildControlUniverse, anyControlRendered } = require('./controls');

const buildPositiveControls = (slice) => greekValuesIn(slice);

// ---------------------------------------------------------------------------
// 3. Η εξαγωγή — δύο επιφάνειες
// ---------------------------------------------------------------------------

/** Attributes που καταλήγουν σε ανθρώπινα μάτια ή σε αναγνώστη οθόνης. */
const HUMAN_ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'aria-description', 'alt', 'aria-placeholder'];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'" };

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(ENTITIES, name)) return ENTITIES[name];
    if (/^#\d+$/.test(name)) return String.fromCodePoint(Number(name.slice(1)));
    if (/^#x[0-9a-fA-F]+$/i.test(name)) return String.fromCodePoint(parseInt(name.slice(2), 16));
    return match;
  });
}

function stripScripts(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

/**
 * @returns {{texts: string[], attributes: Array<{attribute: string, value: string}>}}
 */
function extractSurfaces(html) {
  const body = stripScripts(html);

  const attributes = [];
  for (const attribute of HUMAN_ATTRIBUTES) {
    const pattern = new RegExp(`\\s${attribute}\\s*=\\s*"([^"]*)"`, 'gi');
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const value = decodeEntities(match[1]).trim();
      if (value) attributes.push({ attribute, value });
    }
  }

  const texts = decodeEntities(body.replace(/<[^>]+>/g, '\n'))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return { texts, attributes };
}

// ---------------------------------------------------------------------------
// 4. Η κρίση μιας σελίδας
// ---------------------------------------------------------------------------

/**
 * **ΔΥΟ ΑΠΟΔΕΙΞΕΙΣ, ΟΧΙ ΜΙΑ** — και ποτέ μία με «ή» (μάθημα CHECK 3.41):
 *
 *   `shellProven` «απάντησε ο server με μεταφρασμένη εφαρμογή;»
 *   `pageProven`  «αποδόθηκε περιεχόμενο **πέρα από το κέλυφος**;»
 *
 * Μέχρι το ADR-788 υπήρχε **μόνο** το πρώτο, με το όνομα του δεύτερου. Το
 * κέλυφος ζωγραφίζεται σε **κάθε** διαδρομή, άρα το πρώτο ήταν πάντα `true`
 * και το δεύτερο **δεν ρωτήθηκε ποτέ** (βλ. `controls.js`).
 *
 * @param {string} html
 * @param {{universe: Set<string>, shellControls: Set<string>, pageControls: Set<string>}} oracle
 * @returns {{shellProven: boolean, pageProven: boolean, hits: Array<{key: string, surface: string}>}}
 */
function judgeHtml(html, oracle) {
  const { texts, attributes } = extractSurfaces(html);
  const hits = new Map();

  for (const text of texts) {
    if (oracle.universe.has(text)) hits.set(`text|${text}`, { key: text, surface: 'text' });
  }
  for (const { attribute, value } of attributes) {
    if (oracle.universe.has(value)) hits.set(`${attribute}|${value}`, { key: value, surface: attribute });
  }

  // Οι αποδείξεις ψάχνονται σε ΟΛΕΣ τις επιφάνειες: μια σελίδα μπορεί κάλλιστα
  // να έχει όλο της το μεταφρασμένο κείμενο μέσα σε `aria-label`.
  const haystack = texts.concat(attributes.map((item) => item.value));

  return {
    shellProven: anyControlRendered(oracle.shellControls, haystack),
    pageProven: anyControlRendered(oracle.pageControls, haystack),
    hits: [...hits.values()],
  };
}

/**
 * Η ΜΗΧΑΝΗ ΚΑΤΑΣΤΑΣΕΩΝ ΜΙΑΣ ΣΕΛΙΔΑΣ ΠΟΥ ΑΠΑΝΤΗΣΕ 200.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ**, όχι στυλ: πάνω σε ακρίτη επιφάνεια το
 * «**βρήκα** ωμό κλειδί» παραμένει αληθές, ενώ το «**δεν** βρήκα» δεν αποδεικνύει
 * τίποτα. Γι΄ αυτό το `raw-key` κρίνεται **πριν** από τις καταστάσεις επιφάνειας.
 *
 * @param {{dynamic: boolean}} route
 * @param {{shellProven: boolean, pageProven: boolean, hits: Array}} verdict
 * @returns {{state: string, detail?: string}}
 */
function classifySurface(route, verdict) {
  // ⛔ Ούτε το κέλυφος δεν βάφτηκε: ο server απάντησε κάτι που ΔΕΝ είναι η
  //    εφαρμογή. «0 ωμά κλειδιά» εδώ σημαίνει «δεν κοίταξα».
  if (!verdict.shellProven) {
    return { state: X_STATES.PROBE_UNPROVEN, detail: 'καμία μεταφρασμένη τιμή στη σελίδα — ο χρησμός ΔΕΝ απέδειξε ότι κοίταξε' };
  }
  // 🔴 Ωμό κλειδί ζωγραφίστηκε ΟΝΤΩΣ — αληθές ανεξάρτητα από το ΠΟΙΑ επιφάνεια αποδόθηκε.
  if (verdict.hits.length > 0) return { state: X_STATES.RAW_KEY };
  // 🔶 Δυναμική διαδρομή με ΣΥΝΘΕΤΙΚΟ id: ό,τι κι αν βάφτηκε, δεν είναι η σελίδα.
  if (route.dynamic) {
    return {
      state: X_STATES.SYNTHETIC_ID,
      detail: `το τμήμα «${SYNTHETIC_SEGMENT}» δεν αντιστοιχεί σε υπαρκτή οντότητα — η επιφάνεια της σελίδας ΔΕΝ κρίθηκε`,
    };
  }
  // 🔴 Στατική διαδρομή που έβαψε ΜΟΝΟ το κέλυφος: το περιεχόμενό της δεν έφτασε στο SSR HTML.
  if (!verdict.pageProven) {
    return { state: X_STATES.SHELL_ONLY, detail: 'μόνο το κέλυφος αποδόθηκε — καμία τιμή πέρα από αυτό' };
  }
  return { state: X_STATES.CLEAN };
}
/**
 * Χτυπάει ΜΙΑ διαδρομή. **Ποτέ δεν επιστρέφει «καθαρό» χωρίς απόδειξη.**
 *
 * @returns {{route: string, file: string, dynamic: boolean, state: string, status: number|null, keys: Array, detail?: string}}
 */
async function probeRoute(route, options) {
  const { baseUrl, userAgent, oracle, timeoutMs = 120000 } = options;
  if (!userAgent) throw new Error('CHECK 3.51 Χ: το userAgent είναι ΥΠΟΧΡΕΩΤΙΚΟ (βλ. κεφαλίδα §1)');

  let response;
  let html;
  try {
    response = await fetch(`${baseUrl}${route.url}`, {
      headers: { 'user-agent': userAgent, accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    html = await response.text();
  } catch (error) {
    return { ...route, route: route.url, state: X_STATES.UNREACHABLE, status: null, keys: [], detail: error.message };
  }

  if (!response.ok) {
    return { ...route, route: route.url, state: X_STATES.UNREACHABLE, status: response.status, keys: [], detail: `HTTP ${response.status}${html.trim() === '' ? ' (ΚΕΝΟ σώμα — έλεγξε το User-Agent)' : ''}` };
  }
  if (html.trim() === '') {
    return { ...route, route: route.url, state: X_STATES.UNREACHABLE, status: response.status, keys: [], detail: 'ΚΕΝΟ σώμα με 200' };
  }

  const verdict = judgeHtml(html, oracle);
  const { state, detail } = classifySurface(route, verdict);
  return { ...route, route: route.url, state, status: response.status, keys: verdict.hits, ...(detail ? { detail } : {}) };
}

/** Ταυτότητα ratchet — **ποτέ γραμμή**, ποτέ σειρά: `διαδρομή|επιφάνεια|κλειδί`. */
function violationId(record, hit) {
  return `${record.route}|${hit.surface}|${hit.key}`;
}

/** Κλειστή λογιστική — ΜΙΑ υλοποίηση για τους τρεις κανόνες (βλ. `ledger.js`). */
function assertClosedX(records) {
  return assertClosedLedger('Χ', X_STATES, records, (record) => `διαδρομή ${record.route}`);
}

/**
 * Σαρώνει διαδρομές με περιορισμένη ταυτοχρονία.
 * ⚠️ **Καμία σιωπηλή δειγματοληψία**: αν ο καλών περιορίσει τη λίστα, οι
 * υπόλοιπες μπαίνουν ρητά ως `route-skipped` και **ratchet-άρονται** — μια
 * κάλυψη που συρρικνώνεται πρέπει να φαίνεται.
 */
async function sweep(routes, options) {
  const { concurrency = 2, onProgress } = options;
  const results = new Array(routes.length);
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= routes.length) return;
      results[index] = await probeRoute(routes[index], options);
      if (onProgress) onProgress(results[index], index + 1, routes.length);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return results;
}

module.exports = {
  X_STATES,
  classifySurface,
  X_ZERO_TOLERANCE,
  X_RATCHETED,
  X_COUNTED,
  GREEK,
  greekValuesIn,
  buildControlUniverse,
  anyControlRendered,
  SYNTHETIC_SEGMENT,
  HUMAN_ATTRIBUTES,
  enumerateRoutes,
  buildUniverse,
  buildPositiveControls,
  extractSurfaces,
  decodeEntities,
  stripScripts,
  judgeHtml,
  probeRoute,
  sweep,
  violationId,
  assertClosedX,
  flattenAnswerableKeys,
};
