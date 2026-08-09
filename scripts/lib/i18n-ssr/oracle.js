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
 * │ 🔴 ΤΕΣΣΕΡΙΣ ΤΡΟΠΟΙ ΝΑ ΓΕΝΝΗΘΕΙ ΑΥΤΟΣ Ο ΧΡΗΣΜΟΣ ΜΟΝΙΜΩΣ ΠΡΑΣΙΝΟΣ.          │
 * │ Και οι τέσσερις είναι ΜΕΤΡΗΜΕΝΟΙ σε αυτό το repo, όχι υποθετικοί.        │
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
 * 2. **ΘΕΤΙΚΟ CONTROL ΑΝΑ ΔΙΑΔΡΟΜΗ.** Ένα «0» χωρίς απόδειξη ότι κοιτάχτηκε
 *    σελίδα είναι «0» από άδεια απάντηση. Το control **δεν είναι χειρόγραφο**:
 *    είναι «περιέχει η σελίδα **έστω μία τιμή που μόνο το i18n μπορούσε να
 *    παραγάγει**;» — δηλαδή μια ελληνική συμβολοσειρά που **υπάρχει
 *    κυριολεκτικά μέσα στο αποστελλόμενο slice**. Παράγεται από τα ίδια τα
 *    δεδομένα ⇒ δεν παλιώνει, δεν αποκλίνει.
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
  CLEAN: 'clean',
});

/** ⛔ ΠΟΤΕ σε baseline: ένας χρησμός που δεν απέδειξε ότι κοίταξε δεν έχει «πρόοδο». */
const X_ZERO_TOLERANCE = Object.freeze([X_STATES.UNREACHABLE, X_STATES.PROBE_UNPROVEN]);
/** 🔴 ratchet κατά ταυτότητα `διαδρομή|κλειδί` — ανταλλαγή ⇒ μπλοκ (ADR-749). */
const X_RATCHETED = Object.freeze([X_STATES.RAW_KEY, X_STATES.SKIPPED]);

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

const GREEK = /[Ͱ-Ͽἀ-῿]/;

/**
 * Το θετικό control: τιμές που **μόνο το i18n** μπορούσε να βάλει στη σελίδα.
 * Ελληνικές, μήκους ≥ 4, από το **αποστελλόμενο** slice.
 *
 * ⚠️ Χρησιμοποιούμε **τιμές**, όχι κλειδιά: το ζητούμενο είναι «μεταφράστηκε
 * κάτι», όχι «υπάρχει κάτι».
 */
function buildPositiveControls(slice) {
  const controls = new Set();
  const walk = (node) => {
    if (typeof node === 'string') {
      const value = node.trim();
      if (value.length >= 4 && GREEK.test(value) && !value.includes('{')) controls.add(value);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') return Object.values(node).forEach(walk);
  };
  walk(slice);
  return controls;
}

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
 * @param {string} html
 * @param {{universe: Set<string>, controls: Set<string>}} oracle
 * @returns {{proven: boolean, hits: Array<{key: string, surface: string}>}}
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

  // Το control ψάχνεται σε ΟΛΕΣ τις επιφάνειες: μια σελίδα μπορεί κάλλιστα να
  // έχει όλο της το μεταφρασμένο κείμενο μέσα σε `aria-label`.
  const haystack = texts.concat(attributes.map((item) => item.value));
  let proven = false;
  for (const candidate of haystack) {
    if (oracle.controls.has(candidate)) { proven = true; break; }
  }
  if (!proven) {
    // Δεύτερη ευκαιρία: υπο-συμβολοσειρά (το κείμενο μπορεί να συντίθεται με
    // interpolation ή να ενώνεται με γειτονικούς κόμβους).
    const joined = haystack.join('');
    for (const control of oracle.controls) {
      if (joined.includes(control)) { proven = true; break; }
    }
  }

  return { proven, hits: [...hits.values()] };
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

  const { proven, hits } = judgeHtml(html, oracle);
  if (!proven) {
    return { ...route, route: route.url, state: X_STATES.PROBE_UNPROVEN, status: response.status, keys: hits, detail: 'καμία μεταφρασμένη τιμή στη σελίδα — ο χρησμός ΔΕΝ απέδειξε ότι κοίταξε' };
  }
  if (hits.length > 0) {
    return { ...route, route: route.url, state: X_STATES.RAW_KEY, status: response.status, keys: hits };
  }
  return { ...route, route: route.url, state: X_STATES.CLEAN, status: response.status, keys: [] };
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
  X_ZERO_TOLERANCE,
  X_RATCHETED,
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
