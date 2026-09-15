/**
 * CHECK 12 / ADR-598 G13 — ΣΧΗΜΑΤΙΚΟΣ ΕΛΕΓΧΟΣ ΤΟΥ `.license-policy.json`.
 *
 * 🔑 **Μια πολιτική που δεν διαβάζεται σωστά ΔΕΝ είναι «καμία παράβαση»**: είναι UNKNOWN (exit 2).
 * Κάθε σφάλμα εδώ ονομάζει το **μονοπάτι** της εγγραφής, ώστε ο επόμενος να μην ψάχνει.
 *
 * Κανόνες που ΔΕΝ είναι απλή μορφή, αλλά απόφαση Giorgio (2026-09-16, handoff §4):
 *   · `forbidden` και `unknown` έχουν απόφαση `block` — **καμία** ρύθμιση δεν τα ανοίγει.
 *   · εξαίρεση `sourceAvailable` ⇒ **κάθε** μοτίβο καρφωμένο σε έκδοση + `convertsOn` +
 *     `convertsTo`: η ημερομηνία μετατροπής της FSL είναι **ανά κυκλοφορία** (2 χρόνια από
 *     εκείνη), άρα μια εξαίρεση χωρίς έκδοση θα ενέκρινε σιωπηλά και τις μελλοντικές.
 *   · η δηλωμένη `category` μιας εξαίρεσης πρέπει να είναι αυτή που **υπολογίζει** η μηχανή για
 *     την καρφωμένη άδεια — ο άνθρωπος βεβαιώνει τι εγκρίνει, δεν το ορίζει.
 *   · ένα αναγνωριστικό άδειας ανήκει σε **μία** κατηγορία.
 */

'use strict';

const spdx = require('./spdx');
const { CATEGORY, DECISION } = require('./states');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EVIDENCE_GRADES = Object.freeze(['license-text', 'upstream-declaration', 'third-party-curation']);
const SCOPES = Object.freeze(['prod', 'dev']);
/**
 * Ποιες αποφάσεις δέχεται κάθε κατηγορία. Κλειστό επίτηδες: κάθε συνδυασμός πρέπει να έχει
 * **όνομα κατάστασης** (`UNEXCEPTED_STATE`)· ένα `notice: block` θα έβγαζε πακέτα χωρίς
 * κατάσταση, δηλαδή λογιστική που δεν κλείνει.
 *   · forbidden / unknown — μόνο `block` (απόφαση Giorgio· το unknown θεραπεύεται με τεκμήριο)
 *   · restricted / sourceAvailable / byExceptionOnly / reciprocal — `exception` ή `block`
 *   · notice / unencumbered — μόνο `allow`
 */
const ALLOWED_DECISIONS = Object.freeze({
  [CATEGORY.FORBIDDEN]: [DECISION.BLOCK],
  [CATEGORY.UNKNOWN]: [DECISION.BLOCK],
  [CATEGORY.RESTRICTED]: [DECISION.EXCEPTION, DECISION.BLOCK],
  [CATEGORY.SOURCE_AVAILABLE]: [DECISION.EXCEPTION, DECISION.BLOCK],
  [CATEGORY.BY_EXCEPTION_ONLY]: [DECISION.EXCEPTION, DECISION.BLOCK],
  [CATEGORY.RECIPROCAL]: [DECISION.EXCEPTION, DECISION.BLOCK],
  [CATEGORY.NOTICE]: [DECISION.ALLOW],
  [CATEGORY.UNENCUMBERED]: [DECISION.ALLOW],
});

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const nonEmptyStrings = (v) => Array.isArray(v) && v.length > 0 && v.every(nonEmptyString);

/** Έκδοση σε μοτίβο πακέτου: το `@` μετά τον πρώτο χαρακτήρα (το `@scope` δεν μετρά). */
function splitPattern(pattern) {
  const at = pattern.lastIndexOf('@');
  return at > 0 ? { name: pattern.slice(0, at), version: pattern.slice(at + 1) } : { name: pattern, version: null };
}

function checkCategories(raw, errors) {
  if (!isObject(raw.categories)) return errors.push('categories: λείπει αντικείμενο');
  for (const category of Object.values(CATEGORY)) {
    const entry = raw.categories[category];
    if (!isObject(entry)) { errors.push(`categories.${category}: λείπει`); continue; }
    const allowed = ALLOWED_DECISIONS[category];
    if (!allowed.includes(entry.decision)) {
      errors.push(`categories.${category}.decision: «${entry.decision}» — επιτρέπεται μόνο ${allowed.join(' | ')} (δεν αλλάζει με ρύθμιση)`);
    }
  }
  return undefined;
}

/** @returns {Map<string,string>} id → κατηγορία */
function buildLicenseIndex(raw, errors) {
  const index = new Map();
  if (!isObject(raw.licenseCategories)) {
    errors.push('licenseCategories: λείπει αντικείμενο');
    return index;
  }
  for (const [category, ids] of Object.entries(raw.licenseCategories)) {
    if (!Object.values(CATEGORY).includes(category)) { errors.push(`licenseCategories.${category}: άγνωστη κατηγορία`); continue; }
    if (!nonEmptyStrings(ids)) { errors.push(`licenseCategories.${category}: πρέπει να είναι μη κενή λίστα`); continue; }
    for (const id of ids) {
      if (index.has(id)) errors.push(`licenseCategories: το «${id}» είναι σε «${index.get(id)}» ΚΑΙ σε «${category}»`);
      else index.set(id, category);
    }
  }
  return index;
}

function checkParseable(where, text, errors) {
  if (!nonEmptyString(text)) return errors.push(`${where}: λείπει`);
  const p = spdx.parse(text);
  if (!p.ok) errors.push(`${where}: «${text}» δεν αναλύεται ως SPDX (${p.error})`);
  return undefined;
}

function checkMappings(raw, errors) {
  if (!isObject(raw.licenseMappings)) return errors.push('licenseMappings: λείπει αντικείμενο');
  for (const [from, entry] of Object.entries(raw.licenseMappings)) {
    const where = `licenseMappings["${from}"]`;
    if (!isObject(entry)) { errors.push(`${where}: πρέπει να είναι αντικείμενο`); continue; }
    checkParseable(`${where}.spdx`, entry.spdx, errors);
    if (!nonEmptyStrings(entry.evidence)) errors.push(`${where}.evidence: απαιτείται τεκμήριο`);
  }
  return undefined;
}

function checkCurations(raw, errors) {
  if (!isObject(raw.curations)) return errors.push('curations: λείπει αντικείμενο');
  for (const [key, c] of Object.entries(raw.curations)) {
    const where = `curations["${key}"]`;
    if (!splitPattern(key).version || key.includes('*')) errors.push(`${where}: επιμέλεια μόνο σε ακριβές name@version`);
    if (!isObject(c)) { errors.push(`${where}: πρέπει να είναι αντικείμενο`); continue; }
    if (typeof c.declared !== 'string') errors.push(`${where}.declared: λείπει η καρφωμένη δηλωμένη τιμή`);
    checkParseable(`${where}.concludedLicense`, c.concludedLicense, errors);
    if (!EVIDENCE_GRADES.includes(c.evidenceGrade)) errors.push(`${where}.evidenceGrade: εκτός {${EVIDENCE_GRADES.join(', ')}}`);
    if (!nonEmptyStrings(c.evidence)) errors.push(`${where}.evidence: απαιτείται τεκμήριο`);
    if (!nonEmptyString(c.comment)) errors.push(`${where}.comment: απαιτείται αιτιολόγηση`);
    if (!DATE.test(String(c.approvedOn))) errors.push(`${where}.approvedOn: YYYY-MM-DD`);
  }
  return undefined;
}

function checkExceptionDates(where, e, errors) {
  for (const field of ['approvedOn', 'convertsOn', 'expiresOn']) {
    if (field !== 'approvedOn' && e[field] === undefined) continue;
    if (!DATE.test(String(e[field]))) errors.push(`${where}.${field}: YYYY-MM-DD`);
  }
  if ((e.convertsOn === undefined) !== (e.convertsTo === undefined)) {
    errors.push(`${where}: τα convertsOn/convertsTo δηλώνονται μαζί`);
  }
  if (e.convertsTo !== undefined) checkParseable(`${where}.convertsTo`, e.convertsTo, errors);
}

function checkSourceAvailable(where, e, subjects, errors) {
  if (e.category !== CATEGORY.SOURCE_AVAILABLE) return;
  if (subjects.some((p) => !splitPattern(p).version)) {
    errors.push(`${where}.packages: sourceAvailable ⇒ κάθε μοτίβο με έκδοση (η μετατροπή είναι ανά κυκλοφορία)`);
  }
  if (e.convertsOn === undefined) errors.push(`${where}: sourceAvailable ⇒ απαιτούνται convertsOn + convertsTo`);
}

function checkException(where, e, subjectKey, errors) {
  if (!isObject(e)) return errors.push(`${where}: πρέπει να είναι αντικείμενο`);
  if (!nonEmptyString(e.id)) errors.push(`${where}.id: λείπει`);
  if (!nonEmptyStrings(e[subjectKey])) errors.push(`${where}.${subjectKey}: μη κενή λίστα μοτίβων`);
  checkParseable(`${where}.license`, e.license, errors);
  if (!Object.values(CATEGORY).includes(e.category)) errors.push(`${where}.category: άγνωστη κατηγορία`);
  for (const field of ['reason', 'owner']) if (!nonEmptyString(e[field])) errors.push(`${where}.${field}: λείπει`);
  if (!nonEmptyStrings(e.conditions)) errors.push(`${where}.conditions: οι όροι της έγκρισης είναι υποχρεωτικοί`);
  if (!SCOPES.includes(e.scope)) errors.push(`${where}.scope: εκτός {prod, dev}`);
  checkExceptionDates(where, e, errors);
  checkSourceAvailable(where, e, nonEmptyStrings(e[subjectKey]) ? e[subjectKey] : [], errors);
  return undefined;
}

function checkExceptionList(raw, key, subjectKey, errors) {
  if (!Array.isArray(raw[key])) return errors.push(`${key}: λείπει λίστα`);
  const ids = new Set();
  raw[key].forEach((e, i) => {
    const where = `${key}[${i}]${e && e.id ? ` («${e.id}»)` : ''}`;
    checkException(where, e, subjectKey, errors);
    if (e && e.id && ids.has(e.id)) errors.push(`${where}.id: διπλότυπο`);
    if (e && e.id) ids.add(e.id);
  });
  return undefined;
}

/**
 * @param {unknown} raw — το αναλυμένο JSON
 * @returns {{errors: string[], licenseIndex: Map<string,string>}}
 */
function validatePolicy(raw) {
  const errors = [];
  if (!isObject(raw)) return { errors: ['η πολιτική πρέπει να είναι αντικείμενο JSON'], licenseIndex: new Map() };
  checkCategories(raw, errors);
  const licenseIndex = buildLicenseIndex(raw, errors);
  checkMappings(raw, errors);
  checkCurations(raw, errors);
  checkExceptionList(raw, 'exceptions', 'packages', errors);
  checkExceptionList(raw, 'assetExceptions', 'paths', errors);
  return { errors, licenseIndex };
}

module.exports = { validatePolicy, splitPattern, EVIDENCE_GRADES, SCOPES };
