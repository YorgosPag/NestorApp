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
 * 7. 🔴 **Η ΛΙΣΤΑ ΤΟΥ `src/app/**` ΔΕΝ ΕΙΝΑΙ Η ΛΙΣΤΑ ΤΗΣ ΠΑΡΑΓΩΓΗΣ** (ADR-790).
 *    Τέσσερις διαδρομές απαντούν **404** και δύο αποδίδουν **τίποτα**. Ένα «404»
 *    δεν είναι «καθαρό», αλλά ούτε «δεν ξέρω»: **γιατί** παρακρατείται μια
 *    διαδρομή το απαντούν οι μηχανισμοί του `served-surface.js`, διαβασμένοι από
 *    την αυθεντία τους — ποτέ από χειρόγραφη λίστα διαδρομών.
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
  NOT_RENDERED: 'surface-not-rendered',
  WITHHELD_ANSWERED: 'withheld-but-answered',
  SYNTHETIC_ID: 'surface-synthetic-id',
  WITHHELD: 'route-withheld',
  CLEAN: 'clean',
});

/** ⛔ ΠΟΤΕ σε baseline: ένας χρησμός που δεν απέδειξε ότι κοίταξε δεν έχει «πρόοδο». */
const X_ZERO_TOLERANCE = Object.freeze([X_STATES.UNREACHABLE, X_STATES.PROBE_UNPROVEN]);
/** 🔴 ratchet κατά ταυτότητα `διαδρομή|επιφάνεια|κλειδί` — ανταλλαγή ⇒ μπλοκ (ADR-749). */
const X_RATCHETED = Object.freeze([
  X_STATES.RAW_KEY,
  X_STATES.SKIPPED,
  X_STATES.SHELL_ONLY,
  X_STATES.NOT_RENDERED,
  X_STATES.WITHHELD_ANSWERED,
]);
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
const X_COUNTED = Object.freeze([X_STATES.SYNTHETIC_ID, X_STATES.WITHHELD]);

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
 * 🔑 **ΤΟ `<head>` ΔΕΝ ΕΙΝΑΙ ΑΠΟΔΟΘΕΙΣΑ ΕΠΙΦΑΝΕΙΑ** (ADR-790).
 *
 * Χωρίς αυτόν τον διαχωρισμό **κάθε** έγγραφο του Next.js έχει τουλάχιστον έναν
 * κόμβο κειμένου — τον `<title>` — άρα το ερώτημα «**ζωγράφισε κάτι** αυτή η
 * σελίδα;» δεν μπορούσε ποτέ να απαντηθεί «όχι». Μια σελίδα που αποδίδει
 * **μηδέν** στον server (όλο το σώμα της μέσα σε `<Suspense fallback={null}>` —
 * μετρημένα το `/oauth/consent`) θα φαινόταν να έχει «μία επιφάνεια», και το
 * «μία» δεν ξεχωρίζει από το «λίγες»: η κατάσταση θα γεννιόταν με **μαγικό
 * κατώφλι** αντί για απόδειξη.
 *
 * ⚠️ Ο `<title>` **δεν χάνεται** — επιστρέφεται ρητά και κρίνεται για ωμά κλειδιά
 * ως επιφάνεια `document-title`: ένα ωμό κλειδί στην καρτέλα του browser είναι
 * εξίσου ορατό. Μετρημένο 2026-08-22 στις 154 διαδρομές της παραγωγής, το κόστος
 * του διαχωρισμού σε ωμά κλειδιά είναι **207 → 207**, δηλαδή **μηδέν**.
 */
function stripHead(html) {
  return html.replace(/<head[\s\S]*?<\/head>/i, ' ');
}

/** Ο τίτλος του εγγράφου — μεταδεδομένο, ΟΧΙ απόδειξη ότι αποδόθηκε σελίδα. */
function extractDocumentTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const value = decodeEntities(match[1].replace(/<[^>]+>/g, ' ')).trim();
  return value || null;
}

/**
 * @returns {{texts: string[], attributes: Array<{attribute: string, value: string}>, title: string|null, bodyCount: number}}
 */
function extractSurfaces(html) {
  const title = extractDocumentTitle(html);
  const body = stripHead(stripScripts(html));

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

  return { texts, attributes, title, bodyCount: texts.length + attributes.length };
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
  const { texts, attributes, title, bodyCount } = extractSurfaces(html);
  const hits = new Map();

  for (const text of texts) {
    if (oracle.universe.has(text)) hits.set(`text|${text}`, { key: text, surface: 'text' });
  }
  // ⚠️ Ο τίτλος κρίνεται ΞΕΧΩΡΙΣΤΑ: είναι ορατός στην καρτέλα του browser, αλλά
  //    ΔΕΝ μετράει ως «η σελίδα ζωγράφισε κάτι» (βλ. `stripHead`).
  const judged = title ? attributes.concat([{ attribute: 'document-title', value: title }]) : attributes;
  for (const { attribute, value } of judged) {
    if (oracle.universe.has(value)) hits.set(`${attribute}|${value}`, { key: value, surface: attribute });
  }

  // Οι αποδείξεις ψάχνονται σε ΟΛΕΣ τις επιφάνειες: μια σελίδα μπορεί κάλλιστα
  // να έχει όλο της το μεταφρασμένο κείμενο μέσα σε `aria-label`.
  const haystack = texts.concat(attributes.map((item) => item.value));

  return {
    shellProven: anyControlRendered(oracle.shellControls, haystack),
    pageProven: anyControlRendered(oracle.pageControls, haystack),
    bodyCount,
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
  // 🔴 1. ΩΜΟ ΚΛΕΙΔΙ ΠΡΩΤΑ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΙΔΙΟ Η ΑΠΟΔΕΙΞΗ (ADR-790).
  //    Ένα κλειδί του **δικού μας** κλειστού σύμπαντος, τυπωμένο σε κόμβο του
  //    HTML, δεν μπορεί να το βάλει εκεί τίποτε άλλο από τον δικό μας κώδικα.
  //    Άρα «βρήκα ωμό κλειδί» **είναι** η ισχυρότερη δυνατή απόδειξη ότι ο
  //    χρησμός κοίταξε δική μας αποδοθείσα επιφάνεια.
  //    ⚠️ Μέχρι το ADR-788 το `!shellProven` προηγούνταν, οπότε το
  //    `/mandate/ssr-probe` — που βάφει **δύο ωμά κλειδιά και τίποτε άλλο**,
  //    επειδή ακριβώς λείπει το namespace του — αναφερόταν ⛔ «δεν κοίταξα»
  //    και **μπλόκαρε τη φωτογραφία**. Η κεφαλίδα δήλωνε την ασυμμετρία· η
  //    σειρά την ακύρωνε.
  if (verdict.hits.length > 0) return { state: X_STATES.RAW_KEY };

  // 🔴 2. ΔΗΛΩΜΕΝΗ ΕΚΤΟΣ ΠΑΡΑΓΩΓΗΣ, ΑΛΛΑ Ο SERVER ΑΠΑΝΤΗΣΕ 200.
  //    Δεν είναι «σερβίρεται»: το `notFound()` **έτρεξε**, αλλά ρίχτηκε **μετά**
  //    την έναρξη της ροής, οπότε ο κωδικός κατάστασης δεν αλλάζει πια. Η τεκμη-
  //    ρίωση του Next.js το λέει ρητά: 200 για streamed απαντήσεις, 404 για μη
  //    streamed. Μετρημένο φυσικό πείραμα (2026-08-22, nestorconstruct.gr): οι
  //    **τρεις** διαδρομές του group `(app)` — που έχει `loading.tsx`, άρα
  //    Suspense — απαντούν **200**· οι **δύο** του `(bare)`, που δεν έχει,
  //    απαντούν **404**. Ίδιος φρουρός, ίδιο SSoT, **αντίθετος** κωδικός.
  if (route.withheld) {
    return {
      state: X_STATES.WITHHELD_ANSWERED,
      detail: `δηλωμένη εκτός παραγωγής (${route.withheld.mechanism}) αλλά ο server απαντά 200 — το notFound() ρίχτηκε ΜΕΤΑ την έναρξη της ροής`,
    };
  }

  // ⛔/🔴 3. ΤΙΠΟΤΑ ΔΕΝ ΑΠΕΔΕΙΞΕ ΟΤΙ ΑΠΑΝΤΗΣΕ Η ΕΦΑΡΜΟΓΗ ΜΑΣ.
  //    ⚠️ ΔΥΟ ΠΟΛΥ ΔΙΑΦΟΡΕΤΙΚΕΣ ΑΙΤΙΕΣ, ΚΑΙ ΤΟ ΝΑ ΤΙΣ ΛΕΣ ΜΕ ΕΝΑ ΟΝΟΜΑ ΕΙΝΑΙ
  //    ΤΟ ΛΑΘΟΣ: (α) το σώμα έχει **μηδέν** αποδοθείσες επιφάνειες ⇒ η σελίδα
  //    δεν αποδίδει τίποτα στον server (client-only), γεγονός **για τη σελίδα**
  //    και **επαληθεύσιμο**· (β) το σώμα έχει επιφάνειες αλλά **καμία** δεν
  //    είναι δική μας ⇒ ο server απάντησε **κάτι άλλο** (proxy, σελίδα σφάλματος,
  //    αμετάφραστη απόδοση) και ο χρησμός **δεν επιτρέπεται** να αποφανθεί.
  //    Το (α) είναι ratchet — καταγράφεται, δεν μπλοκάρει για πάντα. Το (β)
  //    μένει ⛔: «δεν κοίταξα» δεν έχει πρόοδο.
  if (!verdict.shellProven && !verdict.pageProven) {
    if (verdict.bodyCount === 0) {
      return {
        state: X_STATES.NOT_RENDERED,
        detail: 'μηδέν αποδοθείσες επιφάνειες στο σώμα — η σελίδα δεν αποδίδει ΤΙΠΟΤΑ στον server (client-only)',
      };
    }
    return { state: X_STATES.PROBE_UNPROVEN, detail: 'καμία μεταφρασμένη τιμή στη σελίδα — ο χρησμός ΔΕΝ απέδειξε ότι κοίταξε' };
  }

  // 🔶 4. Δυναμική διαδρομή με ΣΥΝΘΕΤΙΚΟ id: ό,τι κι αν βάφτηκε, δεν είναι η σελίδα.
  if (route.dynamic) {
    return {
      state: X_STATES.SYNTHETIC_ID,
      detail: `το τμήμα «${SYNTHETIC_SEGMENT}» δεν αντιστοιχεί σε υπαρκτή οντότητα — η επιφάνεια της σελίδας ΔΕΝ κρίθηκε`,
    };
  }

  // 🔴 5. Στατική διαδρομή που έβαψε ΜΟΝΟ λεξιλόγιο κελύφους.
  //    ⚠️ «Λεξιλόγιο κελύφους», ΟΧΙ «το κέλυφος»: μια σελίδα του `(auth)`/`(light)`
  //    δεν φοράει κέλυφος (CHECK 3.52) και όμως προσγειώνεται εδώ, γιατί ό,τι
  //    βάφει ζει ολόκληρο μέσα στο αποστελλόμενο slice. Η κατάσταση λέει
  //    «**το περιεχόμενό της δεν έφτασε στο SSR HTML**» — και αυτό είναι αληθές
  //    και στις δύο περιπτώσεις.
  if (!verdict.pageProven) {
    return { state: X_STATES.SHELL_ONLY, detail: 'μόνο λεξιλόγιο κελύφους αποδόθηκε — καμία τιμή πέρα από αυτό' };
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
    // 🔶 ΔΗΛΩΜΕΝΗ ΠΑΡΑΚΡΑΤΗΣΗ + Ο SERVER ΣΥΜΦΩΝΗΣΕ = ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΗΡΗΘΗΚΕ.
    //    Δεν είναι «δεν κοίταξα»: είναι «δεν υπάρχει τίποτα να κοιτάξω, και ο
    //    λόγος είναι γραμμένος». ⚠️ Χωρίς δήλωση, το 404 παραμένει ⛔ — ο Κ2
    //    (`served-surface.js`) είναι ανεξάρτητος κανόνας, ποτέ ο ίδιος με «ή».
    const state = route.withheld ? X_STATES.WITHHELD : X_STATES.UNREACHABLE;
    const why = route.withheld ? ` — δηλωμένη εκτός παραγωγής (${route.withheld.mechanism})` : '';
    return { ...route, route: route.url, state, status: response.status, keys: [], detail: `HTTP ${response.status}${html.trim() === '' ? ' (ΚΕΝΟ σώμα)' : ''}${why}` };
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
  extractDocumentTitle,
  decodeEntities,
  stripScripts,
  stripHead,
  judgeHtml,
  probeRoute,
  sweep,
  violationId,
  assertClosedX,
  flattenAnswerableKeys,
};
