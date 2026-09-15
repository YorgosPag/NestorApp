/**
 * CHECK 12 / ADR-598 G13 — ΤΙ ΒΛΕΠΕΙ Ο ΑΝΘΡΩΠΟΣ.
 *
 * 🔑 Δύο μπλοκ που **δεν μοιάζουν** μεταξύ τους, επίτηδες:
 *   · exit 1 «ΠΑΡΑΒΑΣΗ ΠΟΛΙΤΙΚΗΣ» — ποιο πακέτο, ποια άδεια, ποια κατηγορία, **τι κάνεις**.
 *   · exit 2 «UNKNOWN» — **δεν μετρήθηκε τίποτα**· εντολή, cwd, κωδικός, σήμα, τα τελευταία λόγια
 *     του εργαλείου. Το παλιό CHECK 12 τα συγχώνευε, και έστειλε τον επόμενο να ψάχνει
 *     «εγκατάσταση του license-checker» για ένα `mktemp` που είχε αποτύχει.
 */

'use strict';

const S = require('./states');
const { formatUnmeasured } = require('../spawn-outcome');
const { emitCiAnnotation } = require('../ratchet-baseline');

const TITLE = 'CHECK 12 — πολιτική αδειών (ADR-598 G13)';

const REMEDY = Object.freeze({
  [S.PACKAGE_STATE.FORBIDDEN]: 'αφαίρεσε ή αντικατέστησε την εξάρτηση — η κατηγορία ΔΕΝ δέχεται εξαίρεση (N.5)',
  [S.PACKAGE_STATE.RESTRICTED]: 'αντικατέστησε την εξάρτηση, ή ζήτα έγκριση Giorgio: exceptions[] με καρφωμένη άδεια + όρους (npm run license:propose)',
  [S.PACKAGE_STATE.RECIPROCAL_UNEXCEPTED]: 'αναλλοίωτο reciprocal επιτρέπεται ΜΟΝΟ με εξαίρεση: exceptions[] με όρους (npm run license:propose)',
  [S.PACKAGE_STATE.SOURCE_AVAILABLE_UNEXCEPTED]: 'εξαίρεση ανά ΚΥΚΛΟΦΟΡΙΑ με convertsOn/convertsTo, ή αντικατάσταση (npm run license:propose)',
  [S.PACKAGE_STATE.BY_EXCEPTION_ONLY_UNEXCEPTED]: 'ρητή έγκριση Giorgio: exceptions[] με όρους (npm run license:propose)',
  [S.PACKAGE_STATE.UNKNOWN_LICENSE]: 'βρες τεκμήριο (LICENSE, upstream, ClearlyDefined) → licenseMappings ή curations["name@version"] — ΠΟΤΕ εξαίρεση',
  [S.PACKAGE_STATE.EXCEPTION_LICENSE_DRIFT]: 'το πακέτο ΑΛΛΑΞΕ άδεια — η παλιά έγκριση δεν καλύπτει τη νέα· νέα απόφαση για τη νέα άδεια',
  [S.PACKAGE_STATE.CURATION_LICENSE_DRIFT]: 'η δηλωμένη τιμή άλλαξε — ξαναεπιβεβαίωσε το τεκμήριο και ενημέρωσε το declared της επιμέλειας',
  [S.PACKAGE_STATE.EXCEPTION_EXPIRED]: 'η εξαίρεση έληξε — νέα απόφαση (νέο expiresOn) ή αφαίρεση της εξάρτησης',
  [S.PACKAGE_STATE.MODIFIED_COPYLEFT]: 'αφαίρεσε το patch, ή δημοσίευσε την τροποποίηση και ζήτα νέα έγκριση που καλύπτει τροποποίηση',
  [S.PACKAGE_STATE.FORBIDDEN_EXCEPTION_REFUSED]: 'σβήσε την εξαίρεση ΚΑΙ αφαίρεσε την εξάρτηση — η κατηγορία δεν ανοίγει με εξαίρεση',
});

/** exit 2: η μέτρηση δεν έγινε. */
function printUnknown({ outcome, detail, command, status, signal, output, remedy }) {
  console.error(`\n❌ ${TITLE} — UNKNOWN: ο έλεγχος ΔΕΝ ΕΤΡΕΞΕ (δεν είναι παράβαση πολιτικής)\n`);
  console.error(formatUnmeasured({
    outcome, detail, command, status, signal, output, tool: 'license inventory',
    notice: 'Αυτό ΔΕΝ είναι παράβαση πολιτικής: τίποτα δεν μετρήθηκε. Διόρθωσε την εκτέλεση και ξανατρέξε.',
  }));
  if (remedy) console.error(`\n   Θεραπεία: ${remedy}`);
}

function printTally(title, counts, isBlocking) {
  console.log(`\n   ${title}`);
  for (const [state, n] of Object.entries(counts)) {
    const mark = isBlocking(state) ? (n ? '⛔' : '  ') : '✅';
    console.log(`   ${mark} ${state.padEnd(30)} ${n}`);
  }
}

const INFO_STATES = [S.DECISION_STATE.PRUNED, S.DECISION_STATE.UNNEEDED, S.DECISION_STATE.CONVERTED, S.DECISION_STATE.CONVERSION_DUE];

function printDecisionNotes(verdict) {
  for (const row of verdict.decisions.filter((d) => INFO_STATES.includes(d.state))) {
    const line = `${row.kind} «${row.id}» — ${row.state}: ${row.detail}`;
    console.log(`   ℹ️  ${line}`);
    emitCiAnnotation('warning', TITLE, line);
  }
}

/** Πλήρης λογιστική — κάθε κάδος, και στο μηδέν. */
function printReport(verdict, { packageCount, command }) {
  console.log(`📋 ${TITLE}\n   πηγή: ${command} · πακέτα prod: ${packageCount} · κλειδιά lockfile χωρίς εγκατάσταση prod εδώ (dev ή άλλη πλατφόρμα): ${verdict.lockfileOnly}`);
  printTally('Πακέτα', verdict.packageTally, (s) => S.BLOCKING_PACKAGE_STATES.includes(s));
  printTally('Αποφάσεις πολιτικής (εξαιρέσεις + επιμέλειες)', verdict.decisionTally, () => false);
  const total = Object.values(verdict.packageTally).reduce((a, b) => a + b, 0);
  if (total !== verdict.rows.length) throw new Error(`license-policy — η λογιστική δεν κλείνει: ${total} ≠ ${verdict.rows.length}`);
  for (const row of verdict.rows.filter((r) => r.via !== 'declared' || r.exceptionId)) {
    console.log(`   · ${row.id} — ${row.state} (${row.via}${row.exceptionId ? ` · ${row.exceptionId}` : ''}): ${row.detail}`);
  }
}

/** exit 1: μετρήθηκε, και η πολιτική λέει όχι. */
function printViolations(verdict) {
  console.error(`\n❌ ${TITLE} — ΠΑΡΑΒΑΣΗ ΠΟΛΙΤΙΚΗΣ: ${verdict.blocking.length} πακέτο(α)\n`);
  const byState = new Map();
  for (const row of verdict.blocking) byState.set(row.state, [...(byState.get(row.state) || []), row]);
  for (const [state, rows] of byState) {
    console.error(`   ⛔ ${state} (${rows.length})`);
    for (const r of rows) console.error(`      • ${r.id} — ${r.detail}`);
    console.error(`      → ${REMEDY[state]}\n`);
  }
}

/** Σκελετοί απόφασης — τυπώνονται, ΠΟΤΕ δεν γράφονται: η απόφαση είναι ανθρώπινη. */
function printProposals(verdict, today) {
  const unknown = verdict.blocking.filter((r) => r.state === S.PACKAGE_STATE.UNKNOWN_LICENSE);
  const needsException = verdict.blocking.filter((r) => r.state !== S.PACKAGE_STATE.UNKNOWN_LICENSE
    && S.UNEXCEPTED_STATE[r.category] === r.state && r.category !== S.CATEGORY.FORBIDDEN);
  const curations = Object.fromEntries(unknown.map((r) => [r.id, {
    declared: r.declared, concludedLicense: '<SPDX>', evidenceGrade: '<license-text|upstream-declaration|third-party-curation>',
    evidence: ['<τεκμήριο>'], comment: '<γιατί>', approvedOn: today,
  }]));
  const exceptions = needsException.map((r) => ({
    id: `<${r.name}>`, packages: [r.category === S.CATEGORY.SOURCE_AVAILABLE ? r.id : r.name], license: r.license,
    category: r.category, reason: '<χρήση — μετρημένη>', owner: 'giorgio', conditions: ['<όρος>'], approvedOn: today, scope: 'prod',
  }));
  console.log('\n📝 Προτάσεις (ΔΕΝ γράφτηκαν — αντέγραψε μόνο μετά από απόφαση):');
  console.log(JSON.stringify({ curations, exceptions }, null, 2));
}

module.exports = { TITLE, REMEDY, printUnknown, printReport, printViolations, printProposals, printDecisionNotes };
