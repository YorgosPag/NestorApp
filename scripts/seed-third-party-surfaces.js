#!/usr/bin/env node
/**
 * ADR-863 / CHECK 3.84 — ΣΠΟΡΑ ΤΟΥ ΣΤΙΓΜΙΟΤΥΠΟΥ ΕΠΙΦΑΝΕΙΩΝ ΑΠΟ ΤΟ ΠΡΑΓΜΑΤΙΚΟ BUILD.
 *
 * «Ποια πακέτα φτάνουν **πράγματι** στον browser;» — η **μόνη** τίμια απάντηση είναι το build
 * που στέλνουμε, όχι στατικός γράφος ούτε δήλωση ανθρώπου.
 *
 * ⚠️ **ΤΡΕΧΕΙ ΜΟΝΟ ΣΤΟ CI** (N.17): απαιτεί `next build` με stats, που στο τοπικό μηχάνημα
 * θέλει 12 GB heap. Προσκολλάται στο build που **ΗΔΗ** τρέχει στο `bundle-ratchet.yml` —
 * κανένα δεύτερο build, καμία νέα εξάρτηση.
 *
 * Το προϊόν του (`.third-party-surfaces.json`) **δεσμεύεται στο repo** από τον Giorgio, όπως
 * κάθε baseline που σπέρνεται από CI (πρότυπο ADR-598: depcruise / type-complexity / bundle).
 *
 * CLI:
 *   node scripts/seed-third-party-surfaces.js <διαδρομή-stats.json>
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const S = require('./lib/third-party-notices/surfaces');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT = path.join(ROOT, S.SNAPSHOT_FILE);

/**
 * Διατηρεί τα **ΑΝΘΡΩΠΙΝΑ** πεδία και ανανεώνει μόνο τα **ΜΗΧΑΝΙΚΑ**.
 *
 * 🔴 **ΜΑΘΗΜΑ ΜΕΤΡΗΜΕΝΟ ΣΕ ΑΥΤΟ ΤΟ REPO** (ADR-598, 2026-08-24): το `--write-baseline` του
 * dependency-audit έσβηνε το `reason` κάθε εγγραφής και **και οι 21** κατέληξαν να λένε
 * «Seeded», αφανίζοντας γραπτές αποφάσεις ανθρώπου. *Μια εγγύηση που απαιτεί από άνθρωπο να
 * θυμάται δεν είναι εγγύηση.* Εδώ το `claims` (**απόφαση**) δεν αγγίζεται ποτέ από τη σπορά.
 */
function mergeSnapshot(previous, measured) {
  return {
    ...previous,
    measured: true,
    measuredAt: new Date().toISOString(),
    generatedBy: 'scripts/seed-third-party-surfaces.js ← webpack stats (bundle-ratchet.yml)',
    browser: measured.packages,
    $measuredFalse: undefined,
    claims: previous.claims || {},
  };
}

/** Κλειστή λογιστική της σποράς — τυπώνεται **και στο μηδέν**. */
function report(previous, measured) {
  const before = new Set(previous.browser || []);
  const after = new Set(measured.packages);
  const added = [...after].filter((n) => !before.has(n));
  const removed = [...before].filter((n) => !after.has(n));
  console.log(`📦 modules στα stats: ${measured.modules} · πακέτα στον browser: ${after.size}`);
  console.log(`   νέα: ${added.length} · έφυγαν: ${removed.length} · ισχυρισμοί που διατηρήθηκαν: ${Object.keys(previous.claims || {}).length}`);

  const refuted = S.refutedClaims(previous, measured.packages);
  if (refuted.length) {
    console.error('\n🔴 ΤΟ BUILD ΔΙΕΨΕΥΣΕ ΙΣΧΥΡΙΣΜΟΥΣ — δηλώθηκαν «server» και βρέθηκαν στο client bundle:');
    for (const claim of refuted) console.error(`   ⛔ ${claim.name}\n      ${claim.why}`);
    console.error('\n   Η σπορά ΠΡΟΧΩΡΑ (το γεγονός είναι γεγονός) — η πύλη 3.84 θα το κοκκινίσει ως «surface-drift».');
  }
}

function main(argv) {
  const statsFile = argv[0];
  if (!statsFile) {
    console.error('❌ ADR-863 — λείπει η διαδρομή του stats.json');
    return 1;
  }
  if (!fs.existsSync(statsFile)) {
    console.error(`❌ ADR-863 — δεν βρέθηκε: ${statsFile}`);
    return 1;
  }
  const measured = S.packagesFromStats(JSON.parse(fs.readFileSync(statsFile, 'utf8')));
  if (!measured.ok) {
    // ⚠️ Fail-closed: ΠΟΤΕ δεν γράφεται `measured: true` με κενή λίστα — αυτό θα σήμαινε
    //    «κανένα πακέτο δεν φτάνει στον browser», δηλαδή το «0 = κανείς δεν κοίταξε».
    console.error(`❌ ADR-863 — τα stats δεν διαβάστηκαν: ${measured.detail}`);
    return 1;
  }
  const previous = fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) : { claims: {} };
  report(previous, measured);
  fs.writeFileSync(SNAPSHOT, `${JSON.stringify(mergeSnapshot(previous, measured), null, 2)}\n`, 'utf8');
  console.log(`\n✅ ${S.SNAPSHOT_FILE} — δέσμευσέ το στο repo (δεν γίνεται auto-commit).`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { SNAPSHOT, mergeSnapshot, report, main };
