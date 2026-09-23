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
 * │ 🔴 ΕΠΤΑ ΤΡΟΠΟΙ ΝΑ ΓΕΝΝΗΘΕΙ ΑΥΤΟΣ Ο ΧΡΗΣΜΟΣ ΜΟΝΙΜΩΣ ΠΡΑΣΙΝΟΣ.              │
 * │ Και οι επτά είναι ΜΕΤΡΗΜΕΝΟΙ σε αυτό το repo, όχι υποθετικοί.            │
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
 * 8. 🔴 **ΜΙΑ ΑΝΑΚΑΤΕΥΘΥΝΣΗ ΔΕΝ ΕΙΝΑΙ Η ΣΕΛΙΔΑ** (ADR-781 §13 + §14). Ο χρησμός
 *    χτυπά **ανώνυμα**, και το `o/[workspace]/layout.tsx` κάνει
 *    `redirect(AUTH_ROUTES.login)` σε κάθε ανώνυμο. Η ανακατεύθυνση φτάνει με
 *    **δύο** μεταφορές, και η κατάσταση `route-redirected` είναι **μία**:
 *      (α) **3xx + `Location`** — group χωρίς `loading.tsx` (`/search`, `/n/…`).
 *          Πλέον `redirect: 'manual'`, ώστε να μην κρίνεται ο προορισμός (§13).
 *      (β) **200 + `<template data-dgst="NEXT_REDIRECT;…">`** — το `(app)` έχει
 *          `loading.tsx` ⇒ streaming ⇒ ο κωδικός έχει φύγει (§14,
 *          `redirect-contract.js`). ⚠️ **ΔΙΟΡΘΩΣΗ**: η πρώτη εκδοχή αυτής της
 *          παραγράφου έλεγε ότι οι 110 `/o/[workspace]/**` «έδιναν το πόρισμα της
 *          σελίδας σύνδεσης» — **ψευδές, μετρημένο**: δεν ανακατεύθυναν ποτέ με
 *          3xx, άρα το `follow` δεν είχε τι να ακολουθήσει. Έδιναν το πόρισμα
 *          του **δικού τους** streamed 200 (κέλυφος + σκελετός φόρτωσης).
 *    Κοινό και στις δύο: επειδή είναι δυναμικές, το πόρισμα απορροφιόταν στο 🔶
 *    `surface-synthetic-id`, που **δεν απαριθμείται ποτέ** — το σφάλμα
 *    **εξατμιζόταν**.
 *
 * ΤΟ `<script>` ΑΦΑΙΡΕΙΤΑΙ ΩΣ ΠΡΟΦΥΛΑΞΗ, ΟΧΙ ΩΣ ΘΕΡΑΠΕΙΑ
 * -------------------------------------------------------
 * Μετρήθηκε ότι σήμερα **δεν** μολύνει (το `pages.home` εμφανίζεται **0** φορές
 * μέσα σε `<script>`). Αφαιρείται γιατί το RSC flight payload **περιέχει**
 * κλειδιά ως δεδομένα, και μια μελλοντική αλλαγή σειριοποίησης θα γεννούσε
 * ψευδώς θετικά που θα διαβάζονταν ως ρύπανση της οθόνης.
 *
 * ⚠️ **ΠΟΥ ΖΕΙ ΤΙ** (ο διαχωρισμός επιβλήθηκε από το όριο των 500 γραμμών του
 * N.7.1, αλλά έγινε κατά **ευθύνη**, και η αλυσίδα είναι **μονόδρομη**):
 *
 *     ledger.js ← states.js ← probe.js ← oracle.js
 *                 (το κλειστό  (χτυπά +    (απαριθμεί διαδρομές,
 *                  σύνολο)      κρίνει ΜΙΑ  σύμπαν κλειδιών,
 *                               διαδρομή)   σάρωση — και ΞΑΝΑ-ΕΞΑΓΕΙ τα πάντα)
 *
 * Η επανα-εξαγωγή είναι **σκόπιμη**: κάθε καταναλωτής συνεχίζει να εισάγει από
 * εδώ, ώστε ο διαχωρισμός να μην είναι αλλαγή δημόσιας επιφάνειας.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { buildKeyUniverse, flattenAnswerableKeys } = require('../i18n/locale-keys');
const { GREEK, greekValuesIn, buildControlUniverse, anyControlRendered } = require('./controls');
const {
  X_STATES,
  X_ZERO_TOLERANCE,
  X_RATCHETED,
  X_COUNTED,
  SYNTHETIC_SEGMENT,
  assertClosedX,
} = require('./states');
const {
  HUMAN_ATTRIBUTES,
  decodeEntities,
  stripScripts,
  stripHead,
  extractDocumentTitle,
  extractSurfaces,
  judgeHtml,
  classifySurface,
  normaliseRedirectTarget,
  probeRoute,
} = require('./probe');

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
      // ADR-875 §10 — το ΠΡΟΤΥΠΟ (με τα `[τμήματα]`) είναι το κλειδί του καταλόγου golden.
      const template = `/${segments.join('/')}`;
      return { file: rel, url: url === '/' ? '/' : url.replace(/\/$/, ''), template, dynamic };
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
const buildPositiveControls = (slice) => greekValuesIn(slice);

// ---------------------------------------------------------------------------
// 3. Η σάρωση
// ---------------------------------------------------------------------------

/** Ταυτότητα ratchet — **ποτέ γραμμή**, ποτέ σειρά: `διαδρομή|επιφάνεια|κλειδί`. */
function violationId(record, hit) {
  return `${record.route}|${hit.surface}|${hit.key}`;
}

/**
 * Σαρώνει διαδρομές με περιορισμένη ταυτοχρονία.
 * ⚠️ **Καμία σιωπηλή δειγματοληψία**: αν ο καλών περιορίσει τη λίστα, οι
 * υπόλοιπες μπαίνουν ρητά ως `route-skipped` και **ratchet-άρονται** — μια
 * κάλυψη που συρρικνώνεται πρέπει να φαίνεται.
 */
/**
 * @param {Function} [probe] το χτύπημα ΜΙΑΣ διαδρομής — προεπιλογή ο Χ (`probeRoute`)· ο
 *   δίδυμος (ADR-875 §14) περνά το `probeGuard`. ΜΙΑ δεξαμενή εργατών, όχι δεύτερη.
 */
async function sweep(routes, options, probe = probeRoute) {
  const { concurrency = 2, onProgress } = options;
  const results = new Array(routes.length);
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= routes.length) return;
      results[index] = await probe(routes[index], options);
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
  normaliseRedirectTarget,
  probeRoute,
  sweep,
  violationId,
  assertClosedX,
  flattenAnswerableKeys,
};
