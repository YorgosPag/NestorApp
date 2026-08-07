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
 * ΠΕΝΤΕ ΟΜΑΔΕΣ, ΕΝΤΕΚΑ ΡΗΤΕΣ ΚΑΤΑΣΤΑΣΕΙΣ — καμία σιωπηλή απόρριψη:
 *   Α. δηλωμένα ζεύγη (`severity.*` = {background, icon, border} μαζί)
 *        `declared-pair-fail` / `declared-pair-ok`
 *   Β. θεματικά ζεύγη (`borderColors.*` = {light, dark})
 *        `themed-side-invisible` / `themed-side-ok`
 *   Γ. μονοθεματικό κείμενο/περίγραμμα  `theme-flip` / `both-fail` / `both-pass`
 *   Γ2. καρφωμένη επιφάνεια             `surface-theme-flip` / `surface-both-fail` / `surface-both-pass`
 *   Ε. **ημιδιαφανές `rgba()`** — συνθεμένο πάνω σε κάθε επιφάνεια των δύο θεμάτων
 *        `translucent-invisible` / `translucent-ok`
 *   Δ. primitives (`colors.blue.500`) — **δηλώνονται εκτός εμβέλειας**, δεν κρίνονται:
 *      ένα σκαλί παλέτας δεν ισχυρίζεται ρόλο, οπότε δεν μπορεί να είναι σπασμένο.
 *
 * 🔑 Η ΟΜΑΔΑ Ε ΕΚΛΕΙΣΕ ΤΟ ΔΗΛΩΜΕΝΟ ΟΡΙΟ `Κ5` (2026-08-08). Το `rgba()` ανατίθετο στο
 * Στρώμα 2β «γιατί ο browser το λύνει» — αλλά ένα `rgba(0, 0, 0, 0.5)` **γραμμένο ως
 * literal** δεν έχει τίποτα να λυθεί: είναι ήδη λυμένο. Αυτό που έλειπε δεν ήταν
 * πληροφορία, ήταν **ερώτηση**. Μετρήθηκαν **11** τέτοιες δηλώσεις (επιφάνεια 8 ·
 * περίγραμμα 3), ανάμεσά τους το **modal backdrop** — και το ερώτημα απαντιέται τώρα
 * σε **κάθε commit** αντί για μια πύλη που θέλει dev server και browser.
 *
 * ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ, ΟΧΙ ΕΝΑΣ:
 *   1. **RATCHET κατά ταυτότητα** στις παραβιάσεις — μόνο μειώνονται· η *ανταλλαγή*
 *      μιας παραβίασης με άλλη μπλοκάρει (`compareSets`, μάθημα του ADR-749).
 *   2. **ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ** των δηλώσεων που κρίθηκαν — **κάθε ΝΕΑ** δήλωση σταθερού
 *      χρώματος σε σημασιολογικό ρόλο (hex **ή** ημιδιαφανές `rgba()`) μπλοκάρει,
 *      **ακόμα κι αν σήμερα περνά και στα δύο θέματα**, γιατί θα σπάσει μόλις
 *      μετακινηθεί μια επιφάνεια. Είναι το μοντέλο του Atlassian
 *      (`no-unsafe-design-token-usage`): η μάζα ratchet-άρεται, το **νέο** απαγορεύεται.
 *
 * ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΣΤΗ ΚΑΙ FAIL-CLOSED (`auditPalette`): κάθε δήλωση μπαίνει σε **έναν**
 * ονομασμένο κάδο και το «ποιος κρίθηκε» απαντιέται **ονομαστικά**. Δύο κάδοι είναι
 * δηλωμένα κενά με πλήθος **0** (`rgb()` με α=1 · `hsl()` literal) — γράφονται ακριβώς
 * επειδή είναι μηδέν: ένα μηδέν που δεν δηλώνεται διαβάζεται ως «δεν υπάρχουν τέτοια».
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
const { PROJECT_ROOT, runSetRatchetCli } = require('./lib/ratchet-baseline');
const { readTokenPalette, TOKEN_MODULES_DIR } = require('./lib/contrast/ts-token-palette');
const { readThemes, GLOBALS_CSS } = require('./lib/contrast/css-token-themes');
const { evaluate, RATCHETED_STATES } = require('./lib/contrast/theme-pairing');
const { auditPalette } = require('./lib/contrast/palette-ledger');

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

/**
 * Το κλειστό σύνολο: **κάθε δήλωση που όντως κρίθηκε**, υγιής ή όχι — σταθερό hex *και*
 * ημιδιαφανές `rgba()`.
 *
 * ⚠️ ΠΡΟΕΡΧΕΤΑΙ ΑΠΟ ΤΗ ΛΟΓΙΣΤΙΚΗ, ΟΧΙ ΑΠΟ ΞΕΧΩΡΙΣΤΟ ΦΙΛΤΡΟ. Μέχρι τις 2026-08-08 ήταν
 * `semanticEntries(palette)`, δηλαδή ένα **δεύτερο** κατηγόρημα δίπλα σε αυτό που
 * χρησιμοποιεί η κρίση. Όσο συνέπιπταν, κανείς δεν το πρόσεχε· τη στιγμή που η
 * Κατηγορία Ε άρχισε να κρίνει `rgba()`, το κλειστό σύνολο θα έμενε πίσω **σιωπηλά** —
 * δηλαδή μια νέα ημιδιαφανής δήλωση θα προσγειωνόταν χωρίς να μπλοκάρει, ενώ ο σκοπός
 * του κλειστού συνόλου είναι ακριβώς αυτό.
 */
const declarationIds = (palette) => auditPalette(palette).judgedIds;

function measure() {
  const palette = readTokenPalette(PROJECT_ROOT);
  const themes = readThemes(PROJECT_ROOT);
  const ledger = auditPalette(palette);

  /**
   * FAIL-CLOSED ΣΤΗ ΛΟΓΙΣΤΙΚΗ (πρότυπο CHECK 3.42). Αν έστω μία δήλωση δεν μπήκε σε
   * κάδο, η πύλη **σκάει** αντί να αναφέρει «καθαρό»: ένα άθροισμα που κλείνει χωρίς να
   * ρωτά «ποιος κρίθηκε» επικυρώνει τον εαυτό του.
   */
  if (!ledger.balanced) {
    throw new Error(
      `η λογιστική ΔΕΝ κλείνει (${ledger.placed}/${ledger.total}) — σιωπηλή απόρριψη, fail-closed.`,
    );
  }

  const result = evaluate(palette, themes);
  const violations = result.findings.filter((f) => RATCHETED_STATES.includes(f.state));
  return {
    palette,
    themes,
    result,
    ledger,
    violations,
    violationIds: violations.map(violationId).sort(),
    declarations: ledger.judgedIds,
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
    ledger: m.ledger.counts,
    census: m.result.census,
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

function printReport(m) {
  console.log(`CHECK 3.39 — θεματικό ζευγάρωμα (${TOKEN_MODULES_DIR} × ${GLOBALS_CSS})\n`);
  console.log(`  αρχεία token: ${m.palette.files.length}   δηλώσεις: ${m.palette.entries.length}`);
  console.log(`  κρίνονται: ${m.declarations.length}`);
  console.log(`  παραβιάσεις: ${m.violationIds.length}\n`);

  console.log(`  ΛΟΓΙΣΤΙΚΗ (${m.ledger.placed}/${m.ledger.total} — κλειστή):`);
  for (const [k, n] of Object.entries(m.ledger.counts)) {
    const mark = k.startsWith('judged') ? '⚖️ ' : '  ';
    console.log(`    ${mark}${k.padEnd(22)} ${String(n).padStart(4)}  ${m.ledger.descriptions[k]}`);
  }

  console.log('\n  ανά κατάσταση:');
  for (const [state, n] of Object.entries(m.result.byState).sort()) {
    const mark = RATCHETED_STATES.includes(state) ? '🔴' : '✅';
    console.log(`    ${mark} ${state.padEnd(24)} ${n}`);
  }
  console.log('\n  εκτός εμβέλειας (δηλωμένο, ΔΕΝ κρίνεται):');
  for (const [k, n] of Object.entries(m.result.census).sort()) {
    console.log(`     · ${k.padEnd(24)} ${n}`);
  }
  console.log('\n  παραβιάσεις αναλυτικά:');
  for (const f of m.violations) {
    console.log(`    [${f.state}] ${f.file}:${f.line}`);
    console.log(`       ${f.detail}`);
  }
}

/**
 * Το control-flow ζει στο `runSetRatchetCli` (SSoT) — **όχι** εδώ. Το CHECK 3.28 (jscpd)
 * έπιασε αυτή την πύλη και την 3.40 να είναι δίδυμα σε 4 μπλοκ / ~50 γραμμές· η κοινή
 * μηχανή είναι η απάντηση που ο N.18 απαιτεί, όχι δύο «σχεδόν ίδια» αρχεία.
 */
const DESCRIPTOR = {
  adr: 'CHECK 3.39',
  skipEnv: 'SKIP_THEME_PAIRING',
  get baselineFile() { return baselineFile(); },
  measure,
  buildPayload,
  printReport,
  violationId,
  labels: { violations: 'παραβιάσεις', declarations: 'δηλώσεις που κρίθηκαν' },
  messages: {
    worse: 'το θεματικό ζευγάρωμα χειροτέρεψε',
    newDeclLabel: 'ΝΕΑ ΜΟΝΟΘΕΜΑΤΙΚΗ ΔΗΛΩΣΗ',
    newDeclAdvice: [
      'Ένα σταθερό χρώμα δεν μπορεί να ισχύει και στα δύο θέματα — ούτε σταθερό hex,',
      'ούτε σταθερό rgba(). Ακόμα κι αν σήμερα τυχαίνει να περνά, θα σπάσει μόλις',
      'μετακινηθεί μια επιφάνεια.',
      'Γράψε το όπως το `semanticColors` στο ίδιο αρχείο:  hsl(var(--token))',
      'Για ημιδιαφάνεια πάνω σε token:                     hsl(var(--token) / 0.5)',
    ],
  },
  commands: {
    report: 'npm run theme-pairing:report',
    baseline: 'npm run theme-pairing:baseline',
    seed: 'node scripts/check-theme-pairing-ratchet.js --write-baseline',
  },
};

const main = (argv = process.argv) => runSetRatchetCli(DESCRIPTOR, argv);

if (require.main === module) {
  main().catch((e) => {
    console.error(`❌ CHECK 3.39 — απρόσμενο σφάλμα: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { measure, buildPayload, violationId, declarationIds, baselineFile, main };
