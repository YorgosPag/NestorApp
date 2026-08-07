#!/usr/bin/env node
/**
 * CHECK 3.39 / ADR-770 **Στρώμα 2** — η πύλη θεματικού ζευγαρώματος.
 *
 * ΤΟ ΜΕΤΡΗΜΕΝΟ ΓΕΓΟΝΟΣ: η εφαρμογή έχει **δύο** συστήματα χρωμάτων. Το ένα ζει στο
 * `globals.css` και έχει δύο θέματα. Το άλλο ζει σε TypeScript
 * (`src/styles/design-tokens/modules/`), δηλώνει `colors.text.primary = "#1e293b"` —
 * **σταθερό hex φωτεινού θέματος, μηδενική έννοια θέματος** — και καταλήγει σε
 * **inline style**, δηλαδή **νικάει** κάθε κλάση κατά ειδικότητα. Το ζωντανό εύρημα του
 * ADR-759 (επικεφαλίδα με σωστή σημασιολογική κλάση, βαμμένη **1,01:1** από inline
 * `color`) ήταν ένα σημείο αυτής της κλάσης.
 *
 * 🔴 ΓΙΑΤΙ ΚΑΜΙΑ ΥΠΑΡΧΟΥΣΑ ΠΥΛΗ ΔΕΝ ΤΟ ΕΒΛΕΠΕ:
 *   · CHECK 3.38 (Στρώμα 1) διαβάζει **κλάσεις**· εδώ δεν υπάρχει κλάση.
 *   · CHECK 3.26 / ADR-365 φρουρεί ωμές κλίμακες **Tailwind**· εδώ είναι TypeScript.
 *   · CHECK 3.32 μετρά την παλέτα **γραφημάτων**.
 *   · ADR-598 G11 ρωτά **αν υπάρχει** a11y test.
 *   · Ο ΙΔΙΟΣ ο κανόνας `color-contrast` του axe **δεν εκτελείται σε jsdom**:
 *     γυρίζει `incomplete` με `TypeError: range2.getClientRects is not a function`
 *     (axe-core 4.10.2, μετρημένο 2026-08-07). Το `toHaveNoViolations` κοιτάζει **μόνο**
 *     το `violations`, οπότε ένα 1,00:1 περνά **πράσινο**. Πέμπτη εμφάνιση του
 *     «0 = κανείς δεν κοίταξε» — και ο λόγος που το Στρώμα 2 **δεν** μπορούσε να
 *     επεκτείνει το ADR-598: το περιβάλλον του δεν μπορεί να απαντήσει την ερώτηση.
 *
 * ΤΟ ΚΡΙΤΗΡΙΟ — και γιατί ΟΧΙ το προφανές (πλήρες σκεπτικό: `lib/contrast/theme-pairing.js`):
 * το «κάθε ζεύγος ≥ 4,5:1» μετρήθηκε (**141 από 230**) και απορρίφθηκε — περιλαμβάνει
 * συνδυασμούς που **δεν συμβαίνουν** (λευκό σε λευκή κάρτα). Κρατήθηκε το «**αλλάζει η
 * ετυμηγορία ανάμεσα στα δύο θέματα;**», που δεν χρειάζεται να μαντέψει τι συμβαίνει.
 *
 * ΤΕΣΣΕΡΙΣ ΟΜΑΔΕΣ, ΕΝΝΕΑ ΡΗΤΕΣ ΚΑΤΑΣΤΑΣΕΙΣ — καμία σιωπηλή απόρριψη:
 *   Α. δηλωμένα ζεύγη (`severity.*` = {background, icon, border} μαζί)
 *        `declared-pair-fail` / `declared-pair-ok`
 *   Β. θεματικά ζεύγη (`borderColors.*` = {light, dark})
 *        `themed-side-invisible` / `themed-side-ok`
 *   Γ. μονοθεματικό κείμενο/περίγραμμα  `theme-flip` / `both-fail` / `both-pass`
 *   Γ2. καρφωμένη επιφάνεια             `surface-theme-flip` / `surface-both-fail` / `surface-both-pass`
 *   Δ. primitives (`colors.blue.500`) — **δηλώνονται εκτός εμβέλειας**, δεν κρίνονται:
 *      ένα σκαλί παλέτας δεν ισχυρίζεται ρόλο, οπότε δεν μπορεί να είναι σπασμένο.
 *
 * ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ, ΟΧΙ ΕΝΑΣ:
 *   1. **RATCHET κατά ταυτότητα** στις παραβιάσεις — μόνο μειώνονται· η *ανταλλαγή*
 *      μιας παραβίασης με άλλη μπλοκάρει (`compareSets`, μάθημα του ADR-749).
 *   2. **ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ** σημασιολογικών ταυτοτήτων — **κάθε ΝΕΑ** δήλωση σταθερού hex
 *      σε σημασιολογικό ρόλο μπλοκάρει, **ακόμα κι αν σήμερα περνά και στα δύο θέματα**,
 *      γιατί θα σπάσει μόλις μετακινηθεί μια επιφάνεια. Είναι το μοντέλο του Atlassian
 *      (`no-unsafe-design-token-usage`): η μάζα ratchet-άρεται, το **νέο** απαγορεύεται.
 *
 * ⚠️ ΤΟ ΠΛΗΘΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ — είναι «πόσες δηλώσεις είναι δομικά
 * ασύμβατες με δύο θέματα». Η θεραπεία είναι **μετανάστευση σε `hsl(var(--…))`** (το
 * ίδιο αρχείο ήδη το κάνει σωστά στο `semanticColors`), όχι μικρότερος αριθμός.
 * **Άνοιξε τη baseline πριν επικαλεστείς αριθμό.**
 *
 * ⚠️ ΜΗΝ αλλάξεις το `--primary` (ADR-682 §5.5, απορρίφθηκε γραπτώς).
 *
 * ΚΟΣΤΟΣ: ένα πέρασμα AST σε 12 αρχεία + ένα parse του `globals.css`. Δεν έχει «staged»
 * λειτουργία **σκόπιμα**: οι είσοδοι είναι 13 αρχεία συνολικά και **κάθε** αλλαγή σε
 * οποιοδήποτε από αυτά ξαναταξινομεί τα υπόλοιπα. Μερική σάρωση εδώ θα ήταν το
 * δηλωμένο κενό του Στρώματος 1 χωρίς κανένα κέρδος ταχύτητας.
 *
 * CLI:
 *   node scripts/check-theme-pairing-ratchet.js                  # έλεγχος
 *   node scripts/check-theme-pairing-ratchet.js --report         # πλήρης ανθρώπινη αναφορά
 *   node scripts/check-theme-pairing-ratchet.js --write-baseline # reseed μετά από νόμιμο καθάρισμα
 *
 * Env: SKIP_THEME_PAIRING=1 · THEME_PAIRING_BASELINE_FILE
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { PROJECT_ROOT, loadBaseline, writeBaselineFile, compareSets } = require('./lib/ratchet-baseline');
const { readTokenPalette, semanticEntries, TOKEN_MODULES_DIR } = require('./lib/contrast/ts-token-palette');
const { readThemes, GLOBALS_CSS } = require('./lib/contrast/css-token-themes');
const { evaluate, RATCHETED_STATES } = require('./lib/contrast/theme-pairing');

function baselineFile() {
  return process.env.THEME_PAIRING_BASELINE_FILE
    || path.join(PROJECT_ROOT, '.theme-pairing-baseline.json');
}

/**
 * Η ταυτότητα μιας παραβίασης = **κατάσταση + μονοπάτι token**. Ο αριθμός γραμμής
 * ΔΕΝ μπαίνει (θα κοκκίνιζε σε κάθε μετακίνηση από πάνω), και η **τιμή** δεν μπαίνει
 * (η αλλαγή του hex σε άλλο εξίσου σπασμένο πρέπει να μένει η ίδια παραβίαση).
 */
const violationId = (f) => `${f.state}::${f.id}`;

/** Το κλειστό σύνολο: κάθε σημασιολογική δήλωση σταθερού hex, υγιής ή όχι. */
const declarationIds = (palette) =>
  semanticEntries(palette).map((e) => `${e.file}::${e.path}`).sort();

function measure() {
  const palette = readTokenPalette(PROJECT_ROOT);
  const themes = readThemes(PROJECT_ROOT);
  const result = evaluate(palette, themes);
  const violations = result.findings.filter((f) => RATCHETED_STATES.includes(f.state));
  return {
    palette,
    themes,
    result,
    violations,
    violationIds: violations.map(violationId).sort(),
    declarations: declarationIds(palette),
  };
}

function buildPayload(m) {
  return {
    adr: 'ADR-770 Στρώμα 2 (CHECK 3.39)',
    generated_from: [TOKEN_MODULES_DIR, GLOBALS_CSS],
    note:
      'ΔΕΝ είναι δείκτης υγείας: μετρά δηλώσεις χρώματος δομικά ασύμβατες με δύο θέματα. '
      + 'Η θεραπεία είναι μετανάστευση σε hsl(var(--…)), όχι μικρότερος αριθμός.',
    violation_count: m.violationIds.length,
    declaration_count: m.declarations.length,
    by_state: m.result.byState,
    out_of_scope: m.result.outOfScope,
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

function printReport(m) {
  console.log(`CHECK 3.39 — θεματικό ζευγάρωμα (${TOKEN_MODULES_DIR} × ${GLOBALS_CSS})\n`);
  console.log(`  αρχεία token: ${m.palette.files.length}   δηλώσεις: ${m.palette.entries.length}`);
  console.log(`  σημασιολογικές (κρίνονται): ${m.declarations.length}`);
  console.log(`  παραβιάσεις: ${m.violationIds.length}\n`);
  console.log('  ανά κατάσταση:');
  for (const [state, n] of Object.entries(m.result.byState).sort()) {
    const mark = RATCHETED_STATES.includes(state) ? '🔴' : '✅';
    console.log(`    ${mark} ${state.padEnd(24)} ${n}`);
  }
  console.log('\n  εκτός εμβέλειας (δηλωμένο, ΔΕΝ κρίνεται):');
  for (const [k, n] of Object.entries(m.result.outOfScope).sort()) {
    console.log(`     · ${k.padEnd(24)} ${n}`);
  }
  console.log('\n  παραβιάσεις αναλυτικά:');
  for (const f of m.violations) {
    console.log(`    [${f.state}] ${f.file}:${f.line}`);
    console.log(`       ${f.detail}`);
  }
}

function printFailure({ addedViolations, addedDeclarations, byId }) {
  console.error('❌ CHECK 3.39 (ADR-770 Στρώμα 2) — το θεματικό ζευγάρωμα χειροτέρεψε\n');

  for (const id of addedDeclarations) {
    console.error(`   🚫 ΝΕΑ ΜΟΝΟΘΕΜΑΤΙΚΗ ΔΗΛΩΣΗ  ${id}`);
  }
  if (addedDeclarations.length) {
    console.error('\n      Ένα σταθερό hex δεν μπορεί να ισχύει και στα δύο θέματα. Ακόμα κι αν');
    console.error('      σήμερα τυχαίνει να περνά, θα σπάσει μόλις μετακινηθεί μια επιφάνεια.');
    console.error(`      Γράψε το όπως το ${'`semanticColors`'} στο ίδιο αρχείο:  hsl(var(--token))\n`);
  }

  for (const id of addedViolations) {
    const f = byId.get(id);
    console.error(`   🚫 ${f ? `${f.file}:${f.line}` : id}`);
    console.error(`      [${f ? f.state : '—'}] ${f ? f.detail : ''}`);
  }

  console.error('\n   Αναφορά: npm run theme-pairing:report');
  console.error('   Reseed ΜΟΝΟ μετά από νόμιμο καθάρισμα: npm run theme-pairing:baseline');
  console.error('   Έμμεση διαφυγή (αιτιολόγησε στον Giorgio): SKIP_THEME_PAIRING=1 git commit ...');
}

function main(argv = process.argv) {
  if (process.env.SKIP_THEME_PAIRING) return process.exit(0);
  const args = argv.slice(2);

  let m;
  try {
    m = measure();
  } catch (e) {
    console.error(`❌ CHECK 3.39 — αδύνατη η μέτρηση: ${e.message}`);
    return process.exit(1); // fail-closed
  }

  if (args.includes('--report')) {
    printReport(m);
    return process.exit(0);
  }

  if (args.includes('--write-baseline')) {
    writeBaselineFile(baselineFile(), buildPayload(m));
    console.log(`✅ Baseline: ${path.relative(PROJECT_ROOT, baselineFile())}`);
    console.log(`   ${m.violationIds.length} παραβιάσεις · ${m.declarations.length} σημασιολογικές δηλώσεις`);
    return process.exit(0);
  }

  const baseline = loadBaseline(baselineFile());
  if (!baseline || baseline.__invalid || !Array.isArray(baseline.violations) || !Array.isArray(baseline.declarations)) {
    const why = baseline ? baseline.__invalid || 'λείπει πεδίο "violations"/"declarations"' : 'λείπει';
    console.error(`❌ CHECK 3.39 — baseline ${why}: ${path.relative(PROJECT_ROOT, baselineFile())}`);
    console.error('   Δημιούργησε: node scripts/check-theme-pairing-ratchet.js --write-baseline');
    // fail-closed: χαλασμένη baseline ΠΟΤΕ δεν διαβάζεται ως «0 παραβιάσεις»
    return process.exit(1);
  }

  const v = compareSets(m.violationIds, baseline.violations);
  const d = compareSets(m.declarations, baseline.declarations);

  if (v.added.length || d.added.length) {
    printFailure({
      addedViolations: v.added,
      addedDeclarations: d.added,
      byId: new Map(m.violations.map((f) => [violationId(f), f])),
    });
    return process.exit(1);
  }

  const progress = v.removed.length || d.removed.length
    ? `  ⬇ ${v.removed.length} παραβιάσεις / ${d.removed.length} δηλώσεις λιγότερες — κλείδωσέ το: npm run theme-pairing:baseline`
    : '';
  console.log(`✅ CHECK 3.39 — ${v.currentCount} παραβιάσεις / ${d.currentCount} σημασιολογικές δηλώσεις (baseline ${v.baselineCount}/${d.baselineCount})${progress}`);
  return process.exit(0);
}

if (require.main === module) main();

module.exports = { measure, buildPayload, violationId, declarationIds, baselineFile, main };
