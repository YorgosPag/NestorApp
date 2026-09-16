/**
 * CHECK 12 / ADR-598 G13 — Η ΜΙΑ ΑΠΟΦΑΣΗ ΠΟΛΙΤΙΚΗΣ ΑΔΕΙΩΝ (SSoT).
 *
 * «Επιτρέπεται αυτή η άδεια, σε αυτό το αντικείμενο, σήμερα — και με ποια απόφαση ανθρώπου;»
 *
 * Τη ρωτούν **δύο** πύλες, με την **ίδια** συνάρτηση (`decideLicense`):
 *   · CHECK 12 — κάθε πακέτο του γράφου prod (`judge.js`)
 *   · CHECK 3.69 — κάθε γραμματοσειρά που διανέμουμε (`font-assets/assets.js`)
 * Δεύτερη λίστα επιτρεπόμενων αδειών οπουδήποτε θα ήταν ADR-749 σε μικρογραφία.
 *
 * Το μοντέλο είναι του **ORT** (OSS Review Toolkit) σε τρία επίπεδα, με κατηγορίες **Google**:
 *   · license classifications → `licenseCategories` (+ `categories[*].decision`)
 *   · package curations       → `licenseMappings` (καθολικές) + `curations` (ανά name@version)
 *   · resolutions             → `exceptions` / `assetExceptions` (όροι, ιδιοκτήτης, ημερομηνίες)
 *
 * 🏆 **Πού ξεπερνά τα εργαλεία της αγοράς** (dependency-review, OSV-Scanner, license-checker):
 * η εξαίρεση **καρφώνει την άδεια** — αν το πακέτο αλλάξει άδεια (το `@sentry/cli` πήγε από
 * BSD-3-Clause σε FSL-1.1-MIT μέσα στη major 2), η έγκριση **παύει** να ισχύει αντί να
 * καλύψει σιωπηλά κάτι που κανείς δεν ενέκρινε. Και ξέρει **ημερομηνίες**: λήξη και μετατροπή.
 */

'use strict';

const fs = require('node:fs');

const spdx = require('./spdx');
const { validatePolicy, splitPattern } = require('./schema');
const S = require('./states');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Το ΜΟΝΟ σημείο που ονομάζει το αρχείο πολιτικής — το διαβάζουν CHECK 12 και CHECK 3.69. */
const POLICY_FILE_NAME = '.license-policy.json';

/**
 * @returns {{ok: true, policy: object} | {ok: false, error: string}}
 * Ποτέ δεν πετά: μια πολιτική που δεν διαβάζεται γίνεται UNKNOWN με όνομα, όχι κρασάρισμα.
 */
function loadPolicy(filePath) {
  if (!fs.existsSync(filePath)) return { ok: false, error: `λείπει το αρχείο πολιτικής ${filePath}` };
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { ok: false, error: `μη έγκυρο JSON στο ${filePath}: ${error.message}` };
  }
  return compilePolicy(raw);
}

/** Επικύρωση + ευρετήρια. Χωριστό από το I/O ώστε η σουίτα να δίνει συνθετικές πολιτικές. */
function compilePolicy(raw) {
  const { errors, licenseIndex } = validatePolicy(raw);
  if (errors.length) return { ok: false, error: `άκυρη πολιτική:\n   · ${errors.join('\n   · ')}` };
  return { ok: true, policy: { raw, licenseIndex } };
}

// ─── Κατηγοριοποίηση ─────────────────────────────────────────────────────────

const VERSION_SUFFIX = /(-only|-or-later)$/;

/** Υποψήφια κλειδιά αναζήτησης, από το ακριβέστερο στο γενικότερο. */
function lookupKeys(leaf) {
  const base = leaf.id.replace(VERSION_SUFFIX, '');
  return [spdx.leafText(leaf), `${leaf.id}${leaf.plus ? '+' : ''}`, leaf.id, base];
}

function leafCategory(policy, leaf) {
  const key = lookupKeys(leaf).find((k) => policy.licenseIndex.has(k));
  return key === undefined ? S.CATEGORY.UNKNOWN : policy.licenseIndex.get(key);
}

/** @returns {{category: string, parseError: string|null}} */
function categorize(policy, licenseText) {
  const p = spdx.parse(licenseText);
  if (!p.ok) return { category: S.CATEGORY.UNKNOWN, parseError: p.error };
  return { category: spdx.evaluate(p.ast, (leaf) => leafCategory(policy, leaf), S.rankOf), parseError: null };
}

const decisionOf = (policy, category) => policy.raw.categories[category].decision;

// ─── Αντιστοίχιση ───────────────────────────────────────────────────────────

/** `*` = οτιδήποτε εκτός από `/`. Κανένα άλλο μεταχαρακτήρα — τα ονόματα είναι κυριολεκτικά. */
function globToRegExp(glob) {
  const body = glob.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*');
  return new RegExp(`^${body}$`);
}

/** 3 = name@version ακριβές · 2 = όνομα ακριβές · 1 = glob. 0 = καμία αντιστοίχιση. */
function packageMatchScore(pattern, name, version) {
  const p = splitPattern(pattern);
  if (p.version !== null && p.version !== version) return 0;
  if (p.name.includes('*')) return globToRegExp(p.name).test(name) ? 1 : 0;
  if (p.name !== name) return 0;
  return p.version !== null ? 3 : 2;
}

/** Οι εξαιρέσεις που ταιριάζουν, πιο συγκεκριμένη πρώτα. */
function matchingExceptions(entries, subjectKey, matchScore) {
  return entries
    .map((e) => ({ e, score: Math.max(0, ...e[subjectKey].map(matchScore)) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((m) => m.e);
}

function packageExceptions(policy, { name, version }) {
  const prod = policy.raw.exceptions.filter((e) => e.scope === 'prod');
  return matchingExceptions(prod, 'packages', (p) => packageMatchScore(p, name, version));
}

function assetExceptions(policy, relPath) {
  return matchingExceptions(policy.raw.assetExceptions, 'paths', (p) => (globToRegExp(p).test(relPath) ? 1 : 0));
}

// ─── Η απόφαση ──────────────────────────────────────────────────────────────

const dayOf = (iso) => Date.parse(`${iso}T00:00:00Z`);

/** Χρονική κατάσταση μιας εξαίρεσης σε σχέση με το `now` (ms). */
function exceptionTimeline(exception, now) {
  const expired = exception.expiresOn !== undefined && dayOf(exception.expiresOn) <= now;
  const converted = exception.convertsOn !== undefined && dayOf(exception.convertsOn) <= now;
  const daysToConversion = exception.convertsOn === undefined
    ? null : Math.ceil((dayOf(exception.convertsOn) - now) / DAY_MS);
  return { expired, converted, daysToConversion };
}

function withException(policy, category, exception, licenseText, now) {
  const base = { category, exception };
  if (decisionOf(policy, category) === S.DECISION.BLOCK) {
    return { ...base, state: S.PACKAGE_STATE.FORBIDDEN_EXCEPTION_REFUSED,
      detail: `η κατηγορία «${category}» δεν δέχεται εξαίρεση — η «${exception.id}» αγνοείται` };
  }
  if (spdx.canonicalText(exception.license) !== spdx.canonicalText(licenseText)) {
    return { ...base, state: S.PACKAGE_STATE.EXCEPTION_LICENSE_DRIFT,
      detail: `η εξαίρεση «${exception.id}» εγκρίθηκε για «${exception.license}», το πακέτο δηλώνει τώρα «${licenseText}»` };
  }
  const t = exceptionTimeline(exception, now);
  if (t.expired) {
    return { ...base, state: S.PACKAGE_STATE.EXCEPTION_EXPIRED,
      detail: `η εξαίρεση «${exception.id}» έληξε στις ${exception.expiresOn}` };
  }
  if (t.converted && decisionOf(policy, categorize(policy, exception.convertsTo).category) === S.DECISION.ALLOW) {
    return { ...base, state: S.PACKAGE_STATE.CONVERTED,
      detail: `μετατράπηκε σε «${exception.convertsTo}» στις ${exception.convertsOn} — η εξαίρεση «${exception.id}» μπορεί να αποσυρθεί` };
  }
  return { ...base, state: S.PACKAGE_STATE.EXCEPTED, detail: `εξαίρεση «${exception.id}»`, timeline: t };
}

/**
 * Η ΜΙΑ απόφαση. `exceptions` = όσες ταιριάζουν στο αντικείμενο (η πιο συγκεκριμένη πρώτη).
 *
 * @returns {{state: string, category: string, detail: string, exception?: object, timeline?: object}}
 */
function decideLicense(policy, { license, exceptions, now = Date.now() }) {
  const { category, parseError } = categorize(policy, license);
  if (decisionOf(policy, category) === S.DECISION.ALLOW) {
    return { state: S.PACKAGE_STATE.ALLOWED, category, detail: `${license} · ${category}` };
  }
  const [exception] = exceptions;
  if (!exception) {
    const why = parseError ? ` (δεν αναλύεται: ${parseError})` : '';
    return { state: S.UNEXCEPTED_STATE[category], category, detail: `«${license}» · ${category}${why} — χωρίς εγκεκριμένη εξαίρεση` };
  }
  return withException(policy, category, exception, license, now);
}

/** Η απόφαση για ένα διανεμόμενο αρχείο (CHECK 3.69). */
function decideAsset(policy, relPath, license, now = Date.now()) {
  return decideLicense(policy, { license, exceptions: assetExceptions(policy, relPath), now });
}

const PERMITTED = new Set([S.PACKAGE_STATE.ALLOWED, S.PACKAGE_STATE.EXCEPTED, S.PACKAGE_STATE.CONVERTED]);
const isPermitted = (decision) => PERMITTED.has(decision.state);

/**
 * «Απαιτεί αυτή η άδεια το κείμενό της να **ΤΑΞΙΔΕΥΕΙ** με κάθε αντίγραφο που διανέμουμε;»
 *
 * Ορθογώνιο στο «επιτρέπεται;» — αλλά **ίδια** ταξινόμηση, άρα καμία δεύτερη λίστα αδειών.
 *
 * 🔑 **Οι σύνθετες εκφράσεις λύνονται σωστά ΧΩΡΙΣ δεύτερη λογική**, επειδή το `categorize`
 * ήδη εφαρμόζει «OR ⇒ ευνοϊκότερη, AND ⇒ αυστηρότερη»:
 *   · `MIT OR CC0-1.0`  ⇒ `unencumbered` ⇒ **none** — διαλέγουμε τη CC0, δεν οφείλουμε ειδοποίηση
 *   · `MIT AND CC0-1.0` ⇒ `notice`       ⇒ **required** — η MIT δεσμεύει ούτως ή άλλως
 *
 * ⚠️ Η άγνωστη άδεια είναι `unknown` ⇒ `required` (fail-closed): ό,τι δεν ξέρουμε τι ζητά,
 * το αποδίδουμε. Τη ρωτούν **δύο** πύλες — CHECK 3.69 (γραμματοσειρές) και CHECK 3.84 (πακέτα
 * που φτάνουν στον browser). Πριν από το ADR-863 ήταν χειρόγραφο `Set` στη μία από τις δύο.
 */
function requiresAttribution(policy, licenseText) {
  return policy.raw.categories[categorize(policy, licenseText).category].attribution === 'required';
}

module.exports = {
  POLICY_FILE_NAME,
  loadPolicy,
  compilePolicy,
  categorize,
  decideLicense,
  decideAsset,
  isPermitted,
  requiresAttribution,
  packageExceptions,
  assetExceptions,
  packageMatchScore,
  globToRegExp,
  exceptionTimeline,
};
