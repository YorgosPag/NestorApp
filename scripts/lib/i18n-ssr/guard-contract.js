'use strict';
/**
 * =============================================================================
 * Φ — Ο ΔΙΔΥΜΟΣ: «ο ανώνυμος ΔΕΝ μπαίνει στον ιδιωτικό χώρο» (CHECK 3.51 Χ · ADR-875 §14)
 * =============================================================================
 *
 * 🔴 ΤΟ ΚΕΝΟ: από τη Φάση 1 (ADR-875) ο χρησμός χτυπά κάθε `/o/**` **μόνο με συνεδρία**.
 * Πριν, η ανακατεύθυνση του ανώνυμου στη σύνδεση ήταν **σιωπηρή** απόδειξη ότι ο
 * φρουρός ταυτότητας του `o/[workspace]/layout.tsx` δουλεύει· τώρα **κανείς** δεν
 * ρωτούσε αν ένας ανώνυμος βλέπει ιδιωτικό χώρο. Ο χρησμός με ταυτότητα έκλεισε ένα
 * τυφλό σημείο και **άνοιξε** άλλο — ο δίδυμος του `withheld-but-answered`
 * («δηλωμένη ανακατεύθυνση που **δεν** έγινε», ADR-781 §13.7).
 *
 * 🔑 ΠΡΟΤΥΠΟ — Autorize (Burp Suite): κάθε αίτημα με ταυτότητα **ξαναστέλνεται χωρίς
 * cookie**, και η απάντηση κρίνεται Enforced / Bypassed / «Is enforced???». Εδώ:
 *
 *   | απάντηση στον ανώνυμο                         | κατάσταση                      |
 *   |-----------------------------------------------|--------------------------------|
 *   | σύνδεση με `?next=` = η διαδρομή που ζητήθηκε | ✅ `guard-honored`              |
 *   | σύνδεση χωρίς (σωστή) επιστροφή               | 🔴 `guard-return-lost`          |
 *   | ανακατεύθυνση αλλού                           | 🔴 `guard-redirected-elsewhere` |
 *   | 2xx χωρίς ανακατεύθυνση                       | ⛔ `guard-not-honored`          |
 *   | δεν απάντησε / 4xx-5xx / χαλασμένος δείκτης   | ⛔ `guard-unproven`             |
 *
 * ⚠️ ΤΟ ΙΔΙΟ ΑΙΤΗΜΑ, ΟΧΙ ΣΥΝΘΕΤΙΚΟ: ο δίδυμος χτυπά το `fetchUrl` της **πρώτης** κλάσης
 *    persona — πραγματικός χώρος, πραγματικά golden ids. Ένα «ο ανώνυμος δεν είδε το
 *    `/o/ssr-probe/projects/ssr-probe`» δεν αποδεικνύει τίποτα: θα έπεφτε σε 404 και με
 *    σπασμένο φρουρό. Διαρροή κρίνεται μόνο εκεί όπου υπάρχει κάτι να διαρρεύσει.
 *
 * ⚠️ ΣΤΑ `(app)` Η ΑΝΑΚΑΤΕΥΘΥΝΣΗ ΕΙΝΑΙ 200 + ΔΕΙΚΤΗΣ DOM, ΟΧΙ 3xx (ADR-781 §14): το
 *    layout ρίχνει `redirect()` αφού έχει αρχίσει η ροή. Ο δίδυμος διαβάζει τον **ίδιο**
 *    δείκτη με τον Χ (`softRedirectOf`) — ένα «200 ⇒ διαρροή» θα έβαφε ⛔ **κάθε** `/o/**`.
 *
 * ⛔ ΠΟΤΕ cookie εδώ: ο δίδυμος **δεν** διαβάζει το `options.sessions`. Αυτό είναι όλο
 *    το νόημά του — και το κλειδώνει η άγκυρα Φ5.
 *
 * Φύλλο χωρίς npm εξαρτήσεις (ο χρησμός τρέχει στο CI χωρίς `node_modules`).
 * Αλυσίδα: states ← probe ← guard-contract· identity ← guard-contract. Κανένας κύκλος.
 * =============================================================================
 */

const { G_STATES } = require('./states');
const { ANONYMOUS_AUDIENCE, IDENTITY_CONTRACT, isWorkspaceRoute, isLoginRedirect } = require('./identity');
const { normaliseRedirectTarget, redirectDetail, softRedirectOf, settle } = require('./probe');

/** Βάση για την ανάλυση ενός σχετικού προορισμού — δεσμευμένο TLD (RFC 2606), δεν λύνεται ποτέ. */
const PARSE_ORIGIN = 'https://guard-twin.invalid';

// ---------------------------------------------------------------------------
// 1. Ο πληθυσμός — ΠΑΡΑΓΕΤΑΙ, δεν δηλώνεται
// ---------------------------------------------------------------------------

/**
 * Ένας δίδυμος ανά διαδρομή χώρου της **απογραφής** (`enumerated`, πριν από την επέκταση
 * ανά persona). Πηγή του αιτήματος: η πρώτη επεκταμένη διαδρομή του ίδιου `template` —
 * χωρίς manifest (τοπικά, ανώνυμα) η ίδια η απογραφή, με το συνθετικό τμήμα.
 *
 * @param {Array<object>} enumerated  η απογραφή του `enumerateRoutes`
 * @param {Array<object>} expanded    οι διαδρομές μετά το `prepareIdentity`
 */
function guardTwinsOf(enumerated, expanded) {
  const firstByTemplate = new Map();
  for (const route of expanded) {
    if (route.persona && !firstByTemplate.has(route.template)) firstByTemplate.set(route.template, route);
  }
  return enumerated.filter(isWorkspaceRoute).map((route) => {
    const { persona: _session, ...source } = firstByTemplate.get(route.template) || route;
    return { ...source, audience: ANONYMOUS_AUDIENCE };
  });
}

/** Το πρότυπο του χώρου στο σύστημα αρχείων — ο φάκελος `o/[workspace]` (ίδιο με `golden-bindings.js`). */
const WORKSPACE_TEMPLATE = `/${IDENTITY_CONTRACT.workspacePrefix}/[workspace]`;

/**
 * «0 = κανείς δεν κοίταξε» (CHECK 3.48 Κ6): **ένας** δίδυμος για **κάθε** διαδρομή χώρου
 * της απογραφής. Αλλιώς `throw` — ο χρησμός αρνείται να αποφανθεί, ποτέ «καθαρό».
 *
 * ⚠️ ΑΝΕΞΑΡΤΗΤΟ ΚΡΙΤΗΡΙΟ, ΕΠΙΤΗΔΕΣ: ο πληθυσμός κρίνεται από το **`template`** (το σύστημα
 *    αρχείων), ενώ το `guardTwinsOf` διαλέγει με το `isWorkspaceRoute` (το URL). Αν ο
 *    ίδιος κριτής έφτιαχνε και μετρούσε, ένα σπασμένο `isWorkspaceRoute` θα έδινε
 *    «0 δίδυμοι για 0 διαδρομές» — πράσινο που σημαίνει «δεν κοίταξα».
 */
function assertTwinCoverage(twins, enumerated) {
  const isWorkspaceTemplate = (template) => template === WORKSPACE_TEMPLATE || template.startsWith(`${WORKSPACE_TEMPLATE}/`);
  const expected = new Set(enumerated.map((route) => route.template).filter(isWorkspaceTemplate));
  const covered = new Set(twins.map((twin) => twin.template));
  const missing = [...expected].filter((template) => !covered.has(template));
  if (missing.length > 0 || twins.length !== expected.size) {
    throw new Error(`CHECK 3.51 Φ: ${twins.length} δίδυμοι για ${expected.size} διαδρομές χώρου — λείπουν: ${missing.join(', ') || '(διπλότυπα)'}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Η κρίση — καθαρή συνάρτηση της απάντησης
// ---------------------------------------------------------------------------

/** Πού προσγείωσε ο server τον ανώνυμο — ή γιατί δεν το ξέρουμε. */
function landingOf(status, location, html, baseUrl) {
  if (status >= 300 && status < 400) {
    return location ? { target: normaliseRedirectTarget(location, baseUrl) } : { unproven: `HTTP ${status} ΧΩΡΙΣ κεφαλίδα Location` };
  }
  if (status < 200 || status >= 300) return { unproven: `HTTP ${status}` };
  const soft = softRedirectOf(html, baseUrl);
  if (soft === null) return { served: true };
  if (soft.malformed !== undefined) return { unproven: `δείκτης ανακατεύθυνσης με άγνωστο σχήμα: ${soft.malformed}` };
  return { target: soft.target };
}

/** Το `?next=` ενός προορισμού σύνδεσης — `null` αν λείπει. */
function returnPathOf(target) {
  return new URL(target, PARSE_ORIGIN).searchParams.get(IDENTITY_CONTRACT.returnParam);
}

/**
 * @param {{status: number, location: string|null, html: string}} answer
 * @param {string} requested  η διαδρομή που **ζητήθηκε** (με τα πραγματικά ids)
 * @returns {{state: string, status: number, keys: [], detail?: string}}
 */
function judgeGuard(answer, requested, baseUrl) {
  const verdict = (state, detail) => ({ state, status: answer.status, keys: [], ...(detail ? { detail } : {}) });
  const landing = landingOf(answer.status, answer.location, answer.html, baseUrl);

  if (landing.unproven) return verdict(G_STATES.UNPROVEN, landing.unproven);
  if (landing.served) {
    return verdict(G_STATES.NOT_HONORED, `ανώνυμο αίτημα πήρε HTTP ${answer.status} ΧΩΡΙΣ ανακατεύθυνση — ο ιδιωτικός χώρος ΣΕΡΒΙΡΙΣΤΗΚΕ`);
  }
  if (!isLoginRedirect(landing.target)) return verdict(G_STATES.REDIRECTED_ELSEWHERE, redirectDetail(landing.target));
  if (returnPathOf(landing.target) === requested) return verdict(G_STATES.HONORED);
  return verdict(G_STATES.RETURN_LOST, `${redirectDetail(landing.target)} — η επιστροφή ΔΕΝ είναι η διαδρομή που ζητήθηκε`);
}

// ---------------------------------------------------------------------------
// 3. Το χτύπημα
// ---------------------------------------------------------------------------

/**
 * Χτυπά ΕΝΑΝ δίδυμο — ίδια υπογραφή με το `probeRoute`, ώστε να τρέχει στη **ΜΙΑ**
 * δεξαμενή του `sweep`. ⛔ Κανένα cookie, όποιες κι αν είναι οι `options.sessions`.
 */
async function probeGuard(route, options) {
  const { baseUrl, userAgent, timeoutMs = 120000 } = options;
  if (!userAgent) throw new Error('CHECK 3.51 Φ: το userAgent είναι ΥΠΟΧΡΕΩΤΙΚΟ (βλ. κεφαλίδα του probe.js)');
  const requested = route.fetchUrl ?? route.url;
  let answer;
  try {
    const response = await fetch(`${baseUrl}${requested}`, {
      headers: { 'user-agent': userAgent, accept: 'text/html' },
      // `manual`, ΠΟΤΕ `follow` (ADR-781 §13): κρίνεται η πόρτα, όχι η σελίδα σύνδεσης.
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    answer = { status: response.status, location: response.headers.get('location'), html: await response.text() };
  } catch (error) {
    return settle(route, { state: G_STATES.UNPROVEN, status: null, keys: [], detail: `ο server δεν απάντησε: ${error.message}` });
  }
  return settle(route, judgeGuard(answer, requested, baseUrl));
}

module.exports = { guardTwinsOf, assertTwinCoverage, judgeGuard, probeGuard };
