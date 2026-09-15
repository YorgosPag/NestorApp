/**
 * CHECK 12 / ADR-598 G13 — Η ΚΡΙΣΗ: κάθε πακέτο και κάθε απόφαση πολιτικής, ακριβώς μία κατάσταση.
 *
 * Καθαρό (χωρίς I/O): παίρνει πολιτική + απογραφή + κλειδιά lockfile + patched + «σήμερα»,
 * επιστρέφει γραμμές και λογιστική. Όλη η κρίση άδειας περνά από το `policy.decideLicense` —
 * εδώ προστίθεται ΜΟΝΟ ό,τι είναι ιδιότητα **πακέτου**: επιμέλεια ανά έκδοση, τοπική
 * τροποποίηση, και η λογιστική των αποφάσεων (σε χρήση / κλαδεμένη / προς απόσυρση).
 */

'use strict';

const P = require('./policy');
const S = require('./states');
const { splitPattern } = require('./schema');

/** Τι άδεια ΕΙΝΑΙ πραγματικά το πακέτο: επιμέλεια > καθολική αντιστοίχιση > δηλωμένη. */
function resolveLicense(policy, pkg) {
  const curation = policy.raw.curations[pkg.id];
  if (curation) {
    return curation.declared === pkg.license
      ? { license: curation.concludedLicense, via: 'curation' }
      : { drift: curation };
  }
  const mapping = policy.raw.licenseMappings[pkg.license];
  if (mapping) return { license: mapping.spdx, via: 'mapping' };
  return { license: pkg.license, via: 'declared' };
}

const pkgRow = (pkg, fields) => ({ id: pkg.id, name: pkg.name, version: pkg.version, declared: pkg.license, ...fields });

function judgePackage(policy, pkg, patched, now) {
  const resolved = resolveLicense(policy, pkg);
  if (resolved.drift) {
    return pkgRow(pkg, { state: S.PACKAGE_STATE.CURATION_LICENSE_DRIFT, category: S.CATEGORY.UNKNOWN, via: 'curation',
      detail: `η επιμέλεια καρφώθηκε για δηλωμένο «${resolved.drift.declared}», το πακέτο δηλώνει τώρα «${pkg.license}» — ξαναεπιβεβαίωσε το τεκμήριο` });
  }
  const decision = P.decideLicense(policy, { license: resolved.license, exceptions: P.packageExceptions(policy, pkg), now });
  const base = { license: resolved.license, via: resolved.via, category: decision.category,
    exceptionId: decision.exception ? decision.exception.id : null, timeline: decision.timeline || null };
  const modifiable = S.MODIFICATION_SENSITIVE.includes(decision.category);
  if (patched.has(pkg.id) && modifiable && !S.BLOCKING_PACKAGE_STATES.includes(decision.state)) {
    return pkgRow(pkg, { ...base, state: S.PACKAGE_STATE.MODIFIED_COPYLEFT,
      detail: `τοπικό patch σε πακέτο «${decision.category}» — η τροποποίηση ενεργοποιεί υποχρεώσεις που η έγκριση δεν καλύπτει` });
  }
  const curated = decision.state === S.PACKAGE_STATE.ALLOWED && resolved.via === 'curation';
  return pkgRow(pkg, { ...base, state: curated ? S.PACKAGE_STATE.CURATED : decision.state, detail: decision.detail });
}

// ─── Λογιστική αποφάσεων ────────────────────────────────────────────────────

function anyPackageMatches(patterns, packages) {
  return packages.some((p) => patterns.some((pat) => P.packageMatchScore(pat, p.name, p.version) > 0));
}

function exceptionState(exception, ctx) {
  if (exception.scope === 'dev') return S.DECISION_STATE.DEV_SCOPE_NOT_EVALUATED;
  if (!anyPackageMatches(exception.packages, ctx.lockPackages)) return S.DECISION_STATE.PRUNED;
  const used = ctx.rows.filter((r) => r.exceptionId === exception.id);
  if (used.some((r) => r.state === S.PACKAGE_STATE.CONVERTED)) return S.DECISION_STATE.CONVERTED;
  if (used.length) {
    const days = P.exceptionTimeline(exception, ctx.now).daysToConversion;
    return days !== null && days <= S.CONVERSION_NOTICE_DAYS ? S.DECISION_STATE.CONVERSION_DUE : S.DECISION_STATE.IN_USE;
  }
  return anyPackageMatches(exception.packages, ctx.rows) ? S.DECISION_STATE.UNNEEDED : S.DECISION_STATE.NOT_INSTALLED_HERE;
}

function curationState(key, ctx) {
  if (!ctx.lockKeys.has(key)) return S.DECISION_STATE.PRUNED;
  return ctx.rows.some((r) => r.id === key) ? S.DECISION_STATE.IN_USE : S.DECISION_STATE.NOT_INSTALLED_HERE;
}

function judgeDecisions(policy, ctx) {
  const rows = policy.raw.exceptions.map((e) => ({ kind: 'exception', id: e.id, state: exceptionState(e, ctx),
    detail: `${e.license} · ${e.category} · ${e.packages.join(', ')}${e.convertsOn ? ` · μετατροπή ${e.convertsOn}` : ''}` }));
  for (const [key, c] of Object.entries(policy.raw.curations)) {
    rows.push({ kind: 'curation', id: key, state: curationState(key, ctx),
      detail: `«${c.declared}» → ${c.concludedLicense} · ${c.evidenceGrade}` });
  }
  return rows;
}

// ─── Λογιστική ──────────────────────────────────────────────────────────────

/** Κλειστή λογιστική: κάθε κάδος υπάρχει (και στο μηδέν)· άγνωστη κατάσταση ⇒ throw με όνομα. */
function tally(rows, vocabulary, label) {
  const counts = Object.fromEntries(Object.values(vocabulary).map((s) => [s, 0]));
  for (const r of rows) {
    if (!(r.state in counts)) throw new Error(`license-policy — άγνωστη κατάσταση ${label} «${r.state}» (${r.id})`);
    counts[r.state] += 1;
  }
  return counts;
}

/**
 * @param {object} policy — από `policy.compilePolicy`/`loadPolicy`
 * @param {{packages: object[], lockfileKeys: string[], patched?: string[], now?: number}} input
 */
function judge(policy, { packages, lockfileKeys, patched = [], now = Date.now() }) {
  const patchedSet = new Set(patched);
  const rows = packages.map((pkg) => judgePackage(policy, pkg, patchedSet, now));
  const lockKeys = new Set(lockfileKeys);
  const lockPackages = lockfileKeys.map((k) => ({ ...splitPattern(k) }));
  const decisions = judgeDecisions(policy, { rows, lockKeys, lockPackages, now });
  const installedIds = new Set(rows.map((r) => r.id));
  return {
    rows,
    decisions,
    packageTally: tally(rows, S.PACKAGE_STATE, 'πακέτου'),
    decisionTally: tally(decisions, S.DECISION_STATE, 'απόφασης'),
    blocking: rows.filter((r) => S.BLOCKING_PACKAGE_STATES.includes(r.state)),
    lockfileOnly: lockfileKeys.filter((k) => !installedIds.has(k)).length,
  };
}

module.exports = { judge, judgePackage, resolveLicense, tally };
