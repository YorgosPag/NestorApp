#!/usr/bin/env node
/**
 * CHECK 3.42 / ADR-773 §8 — **η πύλη της πέμπτης αρχής χρώματος**.
 *
 * ΤΟ ΜΕΤΡΗΜΕΝΟ ΓΕΓΟΝΟΣ: `src/design-system/tokens/colors.ts:76-78` δηλώνει
 * `text.primary = 'text-slate-900'` — και το `text-slate-900` είναι `#0f172a`, δηλαδή
 * στο **προεπιλεγμένο (σκοτεινό)** θέμα δίνει **1,02:1** πάνω στο `--background` και
 * **1,20:1** πάνω στο `--card`. **Χειρότερο από το 1,01:1** που ξεκίνησε ολόκληρη την
 * εκστρατεία (ADR-759). **875 αρχεία** το καταναλώνουν μέσω `useSemanticColors`.
 *
 * 🔴 ΓΙΑΤΙ ΚΑΜΙΑ ΠΥΛΗ ΔΕΝ ΤΟ ΡΩΤΟΥΣΕ — ΚΑΙ ΔΕΝ ΗΤΑΝ ΚΕΝΟ ΚΑΜΙΑΣ:
 *   · **3.26** ρωτά «παρακάμπτεις το SSoT;» — τα αρχεία είναι στην allowlist, **ορθά**:
 *     *είναι* το SSoT. Φρουρεί την **παράκαμψη**, όχι την **ποιότητα**.
 *   · **3.38** ψάχνει `text-primary`· εδώ γράφεται `text-slate-900`.
 *   · **3.39 / 3.40** διαβάζουν **τιμές**· εδώ υπάρχει **κλάση**.
 *   · **3.32** μετρά την παλέτα **γραφημάτων**.
 * Η ερώτηση «**οι κλάσεις που παράγει η κεντρική αρχή χρώματος είναι θεματικές;**» δεν
 * είχε διατυπωθεί ποτέ. Δεν είναι σπασμένη πύλη — είναι πύλη που δεν υπήρχε.
 *
 * 🔑 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ **ΔΕΝ** ΓΡΑΦΤΗΚΑΝ, ΚΑΙ ΓΙ' ΑΥΤΟ ΕΙΝΑΙ ΣΩΣΤΟ:
 *   1. **Καμία χαρτογράφηση «κλίμακα → hex».** Η αυθεντία είναι το ίδιο το Tailwind:
 *      `loadConfig('tailwind.config.ts') → resolveConfig()`. Ένας δικός μας πίνακας θα
 *      ήταν δεύτερη αλήθεια που αποκλίνει από το build (ADR-749: τέσσερις μηχανές,
 *      τρεις αριθμοί για το ίδιο δέντρο).
 *   2. **Καμία μηχανή κρίσης.** Το κριτήριο, τα κατώφλια, οι ρόλοι και οι εννέα
 *      καταστάσεις μένουν στο `theme-pairing.js` — το ίδιο που κρίνει το 3.39 και το
 *      3.40. Αυτό εδώ είναι **νέα πηγή τιμών**, όπως ήταν και το Στρώμα 2β.
 *   3. **Καμία σκληρή λίστα αρχείων.** Η εμβέλεια είναι η **allowlist του 3.26**, από
 *      το `.ssot-registry.json`. Μέχρι σήμερα, προσθέτοντας αρχείο εκεί το εξαιρούσες
 *      από το 3.26 και **κανείς άλλος δεν το κοίταζε ποτέ** — έξοδος διαφυγής χωρίς
 *      αντίβαρο. Οι δύο πύλες είναι πλέον τα δύο μισά ενός ερωτήματος.
 *
 * ΚΑΤΑΣΤΑΣΕΙΣ ΠΟΥ ΜΕΤΡΩΝΤΑΙ (ratchet — μόνο μειώνονται):
 *   · οι έξι του `theme-pairing.js` (theme-flip, declared-pair-fail, …)
 *   · `translucent-invisible` — από το 3.40, με **σύνθεση**, όχι δεύτερη υλοποίηση
 *   · `class-unknown` — η οικογένεια υπάρχει, το σκαλί όχι ⇒ **μηδέν CSS**. Βρέθηκαν
 *     **δύο ζωντανά**: `bg-background-secondary`/`-tertiary` στο `modal-colors.ts`
 *     (το `background` είναι **συμβολοσειρά** στο config, δεν έχει παραλλαγές).
 *   · `dangling-var` — δείχνει σε custom property που δεν ορίζεται σε κανένα θέμα.
 *
 * ⚠️ Ο ΡΟΛΟΣ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟ ΜΟΝΟΠΑΤΙ, ΟΧΙ ΑΠΟ ΤΟ ΠΡΟΘΕΜΑ. Αν το `text-` σήμαινε
 * «κείμενο», τότε τα 57 εικονίδια τύπων αρχείου και τα 9 debug overlays θα ήταν
 * ψευδώς θετικά: ένα **κατηγορικό** χρώμα ταυτότητας δεν οφείλει να είναι θεματικό.
 *
 * ⚠️ ΤΟ ΠΛΗΘΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ. Η θεραπεία είναι σημασιολογικά tokens
 * (`text-foreground`, `bg-card`) — που το **ίδιο** το `color-bridge.ts` ήδη εφαρμόζει
 * σωστά για τις επιφάνειες. **Άνοιξε τη baseline πριν επικαλεστείς αριθμό.**
 *
 * ⚠️ ΜΗΝ αλλάξεις τιμή στο `design-system/tokens/colors.ts` (**875** καταναλωτές)
 * χωρίς εντολή. ΜΗΝ αλλάξεις το `--primary` (ADR-682 §5.5, γραπτή απόρριψη).
 *
 * ΔΙΑΦΥΓΗ ΑΝΑ ΔΗΛΩΣΗ: `// theme-exempt: <λόγος>` — ο λόγος είναι **υποχρεωτικός**
 * (πρότυπο `tenant-scope-exempt`, CHECK 3.35). **ΔΕΝ** σβήνει `class-unknown` /
 * `dangling-var`: εκείνα δεν είναι θεματική κρίση, είναι λάθος.
 *
 * ΚΟΣΤΟΣ: ~0,9s (303ms φόρτωση tailwind config + AST σε 21 αρχεία + 1 parse CSS).
 *
 * CLI:
 *   node scripts/check-tailwind-theme-classes-ratchet.js                  # έλεγχος
 *   node scripts/check-tailwind-theme-classes-ratchet.js --report         # αναφορά
 *   node scripts/check-tailwind-theme-classes-ratchet.js --write-baseline # reseed
 *
 * Env: SKIP_THEME_CLASSES=1 · THEME_CLASSES_BASELINE_FILE
 */

'use strict';

const path = require('path');
const { PROJECT_ROOT, runSetRatchetCli } = require('./lib/ratchet-baseline');
const { readThemes, GLOBALS_CSS } = require('./lib/contrast/css-token-themes');
/**
 * ⚠️ Το `evaluateTranslucent` **δεν** εισάγεται πια από το `runtime-matrix` (module του
 * CHECK 3.40): μετακόμισε στη μηχανή κρίσης και είναι πλέον **μέσα** στο `evaluate`.
 * Αυτή η πύλη τραβούσε ολόκληρο τον κριτή του browser για μια συνάρτηση που δεν αγγίζει
 * browser. Αν ξαναπροσθέσεις χωριστή κλήση, οι ημιδιαφανείς μετρώνται **δύο φορές**.
 */
const { evaluate, RATCHETED_STATES } = require('./lib/contrast/theme-pairing');
const { buildClassPalette, auditBuckets, MODULE_NAME } = require('./lib/contrast/tailwind-class-palette');
const { TAILWIND_CONFIG } = require('./lib/contrast/tailwind-class-resolver');

const ADR = 'ADR-773 §8 (CHECK 3.42)';

/**
 * Οι **επτά** του κοινού κριτή (το `translucent-invisible` μπήκε εκεί 2026-08-08) + οι
 * δύο που γεννιούνται αποκλειστικά σε χώρο **κλάσεων**.
 */
const CLASS_RATCHETED_STATES = [
  ...RATCHETED_STATES,
  'class-unknown',
  'dangling-var',
];

const baselineFile = () => process.env.THEME_CLASSES_BASELINE_FILE
  || path.join(PROJECT_ROOT, '.theme-classes-baseline.json');

/** Ταυτότητα παραβίασης = κατάσταση + ταυτότητα δήλωσης. Χωρίς γραμμή, χωρίς τιμή. */
const violationId = (f) => `${f.state}::${f.id}`;

function measure() {
  const themes = readThemes(PROJECT_ROOT);
  const palette = buildClassPalette(PROJECT_ROOT, themes);
  const ledger = auditBuckets(palette);

  /**
   * ⚠️ FAIL-CLOSED ΣΤΗ ΛΟΓΙΣΤΙΚΗ. Αν έστω μία δήλωση δεν μπήκε σε κάδο, η πύλη **σκάει**
   * αντί να αναφέρει «καθαρό»: ένα άθροισμα που κλείνει χωρίς να ρωτά «ποιος κρίθηκε»
   * επικυρώνει τον εαυτό του (μάθημα του Στρώματος 2β). Ο έλεγχος **έπιασε** ήδη μία
   * διπλομέτρηση (1533/1532) πριν γραφτεί οποιαδήποτε baseline.
   */
  if (!ledger.balanced) {
    throw new Error(
      `η λογιστική ΔΕΝ κλείνει (${ledger.placed}/${ledger.total}) — σιωπηλή απόρριψη, fail-closed.`,
    );
  }
  if (palette.drift.length) {
    throw new Error(
      `η allowlist του «${MODULE_NAME}» δείχνει σε ανύπαρκτα: ${palette.drift.join(', ')} — μπαγιάτικο μητρώο, fail-closed.`,
    );
  }

  const result = evaluate(palette, themes);
  const findings = [
    ...result.findings,
    ...palette.extraFindings,
  ];
  const byState = {};
  for (const f of findings) byState[f.state] = (byState[f.state] || 0) + 1;

  const violations = findings.filter((f) => CLASS_RATCHETED_STATES.includes(f.state));
  return {
    palette,
    ledger,
    byState,
    violations,
    violationIds: violations.map(violationId).sort(),
    declarations: palette.judged,
  };
}

function buildPayload(m) {
  return {
    adr: ADR,
    generated_from: [`.ssot-registry.json → ${MODULE_NAME}.allowlist`, TAILWIND_CONFIG, GLOBALS_CSS],
    note:
      'ΔΕΝ είναι δείκτης υγείας: μετρά κλάσεις Tailwind που η ΚΕΝΤΡΙΚΗ ΑΡΧΗ χρώματος '
      + 'δηλώνει σε σημασιολογικό ρόλο και που είναι δομικά ασύμβατες με δύο θέματα. '
      + 'Η θεραπεία είναι σημασιολογικά tokens (text-foreground/bg-card), όχι μικρότερος αριθμός.',
    violation_count: m.violationIds.length,
    declaration_count: m.declarations.length,
    files: m.palette.files.length,
    by_state: m.byState,
    ledger: m.ledger.counts,
    literal_values_uncovered: m.palette.notAClassByFile,
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

function printReport(m) {
  const { palette, ledger } = m;
  console.log(`${ADR} — θεματικότητα κλάσεων της κεντρικής αρχής χρώματος\n`);
  console.log(`  εμβέλεια: ${palette.files.length} αρχεία (allowlist «${MODULE_NAME}»)`);
  console.log(`  αυθεντία τιμών: ${TAILWIND_CONFIG} μέσω resolveConfig — καμία δική μας χαρτογράφηση\n`);

  console.log('  ΤΟ ΚΑΘΟΛΙΚΟ — κάθε δήλωση σε ΕΝΑΝ κάδο, χωρίς υπόλοιπο');
  for (const [k, n] of Object.entries(ledger.counts).sort((a, b) => b[1] - a[1])) {
    if (!n) continue;
    console.log(`    ${String(n).padStart(5)}  ${k.padEnd(24)} ${ledger.descriptions[k]}`);
  }
  console.log(`    ${'─'.repeat(5)}`);
  console.log(`    ${String(ledger.placed).padStart(5)}  ΣΥΝΟΛΟ (κλείνει: ${ledger.balanced ? 'ΝΑΙ' : 'ΟΧΙ'})`);
  console.log(
    `\n  ΚΡΙΝΟΝΤΑΙ: ${ledger.judged} δηλώσεις → ${palette.judged.length} ταυτότητες`
    + `  (δήλωση που βάφει δύο utilities κρίνεται ΔΥΟ φορές — κάδος «multi-color»)\n`,
  );

  console.log('  ΑΝΑ ΚΑΤΑΣΤΑΣΗ');
  for (const [state, n] of Object.entries(m.byState).sort()) {
    console.log(`    ${CLASS_RATCHETED_STATES.includes(state) ? '🔴' : '✅'} ${state.padEnd(24)} ${n}`);
  }

  const uncovered = Object.entries(palette.notAClassByFile).sort((a, b) => b[1] - a[1]);
  if (uncovered.length) {
    console.log('\n  ΩΜΕΣ ΤΙΜΕΣ ΑΝΤΙ ΓΙΑ ΚΛΑΣΕΙΣ — ΔΗΛΩΜΕΝΑ ΑΚΑΛΥΠΤΕΣ ΕΔΩ (ADR-773 #6)');
    console.log('  (όσες ζουν σε src/styles/design-tokens/modules/ τις κρίνει το CHECK 3.39)');
    for (const [file, n] of uncovered) {
      const covered = file.startsWith('src/styles/design-tokens/modules/');
      console.log(`     ${String(n).padStart(4)}  ${file}  ${covered ? '→ 3.39' : '🔶 καμία πύλη'}`);
    }
  }

  console.log('\n  ΠΑΡΑΒΙΑΣΕΙΣ ΑΝΑΛΥΤΙΚΑ');
  for (const f of m.violations) console.log(`    [${f.state}] ${f.file}:${f.line}\n       ${f.detail}`);
}

const DESCRIPTOR = {
  adr: 'CHECK 3.42',
  skipEnv: 'SKIP_THEME_CLASSES',
  get baselineFile() { return baselineFile(); },
  measure,
  buildPayload,
  printReport,
  violationId,
  labels: { violations: 'παραβιάσεις', declarations: 'κρινόμενες κλάσεις' },
  messages: {
    worse: 'η θεματικότητα των κλάσεων της κεντρικής αρχής χειροτέρεψε',
    newDeclLabel: 'ΝΕΑ ΜΟΝΟΘΕΜΑΤΙΚΗ ΚΛΑΣΗ',
    newDeclAdvice: [
      'Μια ωμή κλίμακα (`text-slate-900`) είναι ΕΝΑ hex: δεν αλλάζει με το θέμα.',
      'Ακόμα κι αν σήμερα τυχαίνει να περνά, σπάει μόλις μετακινηθεί μια επιφάνεια.',
      'Γράψε σημασιολογικά, όπως ήδη κάνει το color-bridge.ts για τις επιφάνειες:',
      '  text-slate-900 → text-foreground     bg-white → bg-card',
      'Κατηγορικό χρώμα ταυτότητας (debug, εικονίδιο τύπου); → // theme-exempt: <λόγος>',
    ],
  },
  commands: {
    report: 'npm run theme-classes:report',
    baseline: 'npm run theme-classes:baseline',
    seed: 'node scripts/check-tailwind-theme-classes-ratchet.js --write-baseline',
  },
};

const main = (argv = process.argv) => runSetRatchetCli(DESCRIPTOR, argv);

if (require.main === module) {
  main().catch((e) => {
    console.error(`❌ CHECK 3.42 — απρόσμενο σφάλμα: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { measure, buildPayload, violationId, baselineFile, CLASS_RATCHETED_STATES, main };
