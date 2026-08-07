#!/usr/bin/env node
/**
 * CHECK 3.45 — **εφικτότητα υποσχέσεων αντίθεσης** (ADR-771 Φ.3). ZERO TOLERANCE.
 *
 * > «Κάθε δηλωμένο κατώφλι αντίθεσης — είναι **εφικτό** σε κάθε επιφάνεια που η εφαρμογή
 * > μπορεί να παρουσιάσει; Κι αν όχι, το ζητά κάποιος που **μπορεί να μάθει** ότι απέτυχε;»
 *
 * ## ΓΙΑΤΙ ΥΠΑΡΧΕΙ — μετρημένο, όχι υποτεθειμένο
 * Το `wall-render-palette.ts` δηλώνει `WALL_LINE_CONTRAST = 9.0`. Στο **δικό μας** preset θέμα
 * `cinema4d` η επιφάνεια λύνεται σε `#555555`, όπου το **μέγιστο δυνατό** είναι **7,46:1**.
 * Η `adaptColorToBackground` δεν πετούσε τίποτα — επέστρεφε το άκρο και σιωπούσε:
 *
 * ```ts
 * if (contrastRatio(target, bgHex) < minContrast) return target;   // ← σιωπηλή παράδοση
 * ```
 *
 * Νέα μορφή του «0 = κανείς δεν κοίταξε»: **η συνάρτηση απαντά, άρα κανείς δεν ρώτησε αν
 * πέτυχε.** Καμία πύλη δεν το έβλεπε — τα 3.38/3.39/3.40 κρίνουν κλάσεις · δηλώσεις ·
 * υπολογισμένες τιμές **CSS**, ενώ εδώ το κατώφλι είναι **αριθμός σε TypeScript**· το 3.32
 * μετρά μόνο παλέτα γραφημάτων· και ο μεταγλωττιστής δεν έχει γνώμη για το `9.0`.
 *
 * ## 🔴 ΔΥΟ ΕΠΙΦΑΝΕΙΕΣ-ΚΡΙΤΕΣ, ΠΟΤΕ ΜΙΑ
 * | | ερώτηση | γιατί δεν αρκεί η άλλη |
 * |---|---|---|
 * | **preset** | εφικτό στα 9 θέματα που **στέλνουμε**; | δείγμα — δεν λέει τίποτα για το `custom` |
 * | **custom** | εφικτό στο **χειρότερο δυνατό** χρώμα (4,58:1); | ένα κατώφλι 7,0 περνά όλα τα preset και σπάει στον πρώτο χρήστη |
 *
 * ## 🔴 ΜΗΝ ΤΟ ΛΥΣΕΙΣ ΚΑΤΕΒΑΖΟΝΤΑΣ ΤΟ ΚΑΤΩΦΛΙ
 * Το ζήτημα **δεν** είναι ότι το 9.0 είναι φιλόδοξο· είναι ότι η αποτυχία ήταν **σιωπηλή**.
 * Ένα μικρότερο νούμερο κάνει την πύλη πράσινη και αφήνει τους τοίχους ακριβώς εκεί που ήταν.
 * Οι **δύο** νόμιμες διορθώσεις: (α) ζήτα το κατώφλι μέσα από την υπογραφή που επιστρέφει
 * `InkVerdict` και **διάσωσε** όπου αποτυγχάνει (casing — `bim-contrast-casing.ts`)·
 * (β) αν το κατώφλι ήταν όντως λάθος, άλλαξέ το **με μέτρηση και σχόλιο**.
 *
 * Usage:  node scripts/check-contrast-promise-reachability.js [--all] [--verbose] [file…]
 * Escape: SKIP_CONTRAST_PROMISE=1
 */

'use strict';

const path = require('node:path');

const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const {
  CANVAS_THEME_TS, TABLE_INK_TS, VARIABLES_CSS,
  calibrate, presentableSurfaces, reachabilityLimits,
} = require('./lib/contrast-promise/presentable-surfaces');
const {
  ADAPTIVE_MODULE, SCAN_ROOT, createReader, isTestFile, readAdaptiveApi, sitesInFile,
} = require('./lib/contrast-promise/promise-sites');

const REPO_ROOT = path.resolve(__dirname, '..');

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/**
 * Οι **επτά ρητές καταστάσεις**. Κάθε κλήση πέφτει σε ακριβώς μία και ο σαρωτής τυπώνει τον
 * **παρονομαστή** — καμία σιωπηλή απόρριψη (πρότυπο CHECK 3.35/3.43/3.44).
 *
 * ⚠️ Το `unreachable-rescued` **δεν είναι πολυτέλεια**. Η πρώτη γραφή το μετρούσε ως
 * `reachable` — δηλαδή η απογραφή ισχυριζόταν «εφικτό» για τις **τρεις** κλήσεις τοίχου που
 * είναι *αποδεδειγμένα ανέφικτες* και απλώς διασώζονται. Ένα άθροισμα που ονομάζει τη
 * διάσωση «επιτυχία» επικυρώνει τον εαυτό του, και ο επόμενος αναγνώστης θα συμπέραινε ότι το
 * `WALL_LINE_CONTRAST` κρατιέται από μόνο του.
 */
const STATES = {
  DEFINITION: 'definition-site',
  TEST: 'test-site',
  REACHABLE: 'reachable',
  UNREACHABLE_RESCUED: 'unreachable-rescued',
  UNREACHABLE_PRESET: 'unreachable-preset',
  UNREACHABLE_CUSTOM: 'unreachable-custom',
  UNANALYZABLE: 'unanalyzable-threshold',
};

/** Οι καταστάσεις που μπλοκάρουν. Οι υπόλοιπες μετριούνται και εξηγούνται. */
const BLOCKING = new Set([STATES.UNREACHABLE_PRESET, STATES.UNREACHABLE_CUSTOM, STATES.UNANALYZABLE]);

/** Πού σπάει το κατώφλι: σε preset που στέλνουμε, στο `custom`, ή πουθενά. */
function reachabilityGap(threshold, limits) {
  if (threshold > limits.worstPreset.max) return 'preset';
  if (threshold > limits.customCeiling) return 'custom';
  return null;
}

/**
 * Η ετυμηγορία μιας κλήσης.
 *
 * ⚠️ Η ιεραρχία είναι **σκόπιμη**: το «είναι το ίδιο το αρχείο ορισμού;» προηγείται, γιατί ο
 * λεπτός wrapper `adaptStructuralLineColorForCanvas` ζει εκεί και *οφείλει* να πετά την
 * ετυμηγορία — αυτή είναι η δουλειά του. Το κριτήριο δεν είναι χειρόγραφο μονοπάτι: το
 * `ADAPTIVE_MODULE` είναι η ίδια σταθερά από την οποία διαβάστηκε το API.
 */
function classify(site, limits) {
  if (site.file === ADAPTIVE_MODULE) return STATES.DEFINITION;
  if (isTestFile(site.file)) return STATES.TEST;
  if (site.threshold === null) return STATES.UNANALYZABLE;
  const gap = reachabilityGap(site.threshold, limits);
  if (gap === null) return STATES.REACHABLE;
  // Ανέφικτο ΕΠΙΤΡΕΠΕΤΑΙ όταν ο καλών παίρνει την ετυμηγορία: το μαθαίνει και διασώζει.
  if (site.verdictAware) return STATES.UNREACHABLE_RESCUED;
  return gap === 'preset' ? STATES.UNREACHABLE_PRESET : STATES.UNREACHABLE_CUSTOM;
}

function explain(site, state, limits) {
  const where = `${site.file}:${site.line}  ${site.fn}(…, ${site.fromDefault ? 'προεπιλογή ' : ''}${site.threshold})`;
  if (state === STATES.UNANALYZABLE) {
    return `${site.file}:${site.line}  ${site.fn}(…) — το κατώφλι ΔΕΝ αναλύεται (fail-closed).`;
  }
  if (state === STATES.UNREACHABLE_PRESET) {
    return `${where} — ΑΝΕΦΙΚΤΟ στο preset «${limits.worstPreset.key}» (μέγιστο δυνατό `
      + `${limits.worstPreset.max.toFixed(2)}:1) και η ετυμηγορία πετιέται.`;
  }
  return `${where} — εφικτό σε κάθε preset, αλλά πάνω από το φράγμα του «custom» `
    + `(${limits.customCeiling.toFixed(2)}:1): μία επιλογή χρώματος το αθετεί. Η ετυμηγορία πετιέται.`;
}

/**
 * Τα αρχεία-SSoT που αλλάζουν την **ετυμηγορία για όλους**: το API, οι επιφάνειες, το χαρτί.
 * **Παράγονται** από τα ίδια modules που τα διαβάζουν — καμία δεύτερη λίστα να αποκλίνει.
 */
const SSOT_INPUTS = new Set([ADAPTIVE_MODULE, CANVAS_THEME_TS, VARIABLES_CSS, TABLE_INK_TS]);

const isOwnFile = (rel) => rel === 'scripts/check-contrast-promise-reachability.js'
  || rel.startsWith('scripts/lib/contrast-promise/');

/**
 * 🔑 **Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΕΔΩ, ΚΑΙ Η ΠΥΛΗ ΕΙΝΑΙ ΠΑΝΤΑ ΠΛΗΡΗΣ** — δεν υπάρχει «σαρώνω μόνο τα
 * σταδιοποιημένα».
 *
 * Είναι σκόπιμο και είναι **αυστηρότερο από το CHECK 3.43**, που δηλώνει ρητά ότι το Layer 1
 * του είναι *δομικά ανίκανο* να δει τι χάλασε σε αρχεία που κανείς δεν σταδιοποίησε. Εδώ το
 * ίδιο πρόβλημα υπάρχει (ένα νέο μεσοτονικό θέμα κάνει ανέφικτες υποσχέσεις **αλλού**), αλλά
 * λύνεται αντί να δηλωθεί: όταν κάτι σχετικό είναι staged, τρέχει **ολόκληρο** το subapp.
 *
 * Το κόστος μένει μηδενικό επειδή η **σκανδάλη** είναι φθηνή: μόλις ~8 αρχεία σε όλο το
 * δέντρο καλούν το προσαρμοστικό API, οπότε ένα τυπικό commit στο dxf-viewer δεν την αγγίζει
 * καν (~0,05s). Όταν όντως πυροδοτεί, ο πλήρης έλεγχος κοστίζει ~2,7s.
 */
function shouldRunFull(stagedRelFiles, api, reader) {
  for (const rel of stagedRelFiles) {
    if (SSOT_INPUTS.has(rel) || isOwnFile(rel)) return true;
    if (!rel.startsWith(`${SCAN_ROOT}/`) || !/\.tsx?$/.test(rel)) continue;
    if (reader.mayContain(path.join(REPO_ROOT, rel), api)) return true;
  }
  return false;
}

/** Ολόκληρο το subapp — η **μόνη** εμβέλεια σάρωσης που υπάρχει. */
function targetFiles() {
  return collectSourceFiles(REPO_ROOT, [SCAN_ROOT]);
}

function main() {
  if (process.env.SKIP_CONTRAST_PROMISE === '1') {
    console.log(C.dim('CHECK 3.45 — παρακάμφθηκε (SKIP_CONTRAST_PROMISE=1)'));
    return 0;
  }
  const verbose = process.argv.includes('--verbose');
  console.log(C.bold('\nCHECK 3.45 — εφικτότητα υποσχέσεων αντίθεσης (ADR-771 Φ.3)\n'));

  const calibrationError = calibrate();
  if (calibrationError !== null) {
    console.error(C.red(`  [FAIL] ΒΑΘΜΟΝΟΜΗΣΗ: ${calibrationError}`));
    console.error(C.dim('  Καμία ετυμηγορία χωρίς επαληθευμένο όργανο — δες ADR-771 §5.\n'));
    return 1;
  }

  let surfaces;
  let limits;
  let api;
  let reader;
  try {
    reader = createReader(REPO_ROOT);
    api = readAdaptiveApi(REPO_ROOT, reader);
    surfaces = presentableSurfaces(REPO_ROOT);
    limits = reachabilityLimits(surfaces);
  } catch (err) {
    console.error(C.red(`  [FAIL] ${err.message}`));
    return 1;
  }

  const staged = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!process.argv.includes('--all') && staged.length > 0
      && !shouldRunFull(staged.map((f) => f.split(path.sep).join('/')), api, reader)) {
    console.log(C.dim('  καμία σταδιοποιημένη αλλαγή δεν αγγίζει υπόσχεση αντίθεσης — παράλειψη\n'));
    return 0;
  }

  if (verbose) {
    console.log(C.dim(`    API: ${[...api.keys()].join(', ')}`));
    for (const s of surfaces) console.log(C.dim(`    επιφάνεια ${s.key.padEnd(18)} ${s.hex}`));
    console.log('');
  }

  const files = targetFiles();
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  const failures = [];

  for (const abs of files) {
    const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
    for (const site of sitesInFile(abs, rel, api, reader)) {
      const state = classify(site, limits);
      tally[state] += 1;
      if (BLOCKING.has(state)) failures.push(explain(site, state, limits));
      else if (verbose) console.log(C.dim(`    ${state.padEnd(22)} ${rel}:${site.line} ${site.fn}`));
    }
  }

  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  if (failures.length === 0) {
    console.log(C.green(
      `  [PASS] κάθε υπόσχεση είναι εφικτή Ή δηλώνει την αποτυχία της — ${total} κλήση(εις) σε ${files.length} αρχεία`,
    ));
    console.log(C.dim(`  όρια: χειρότερο preset «${limits.worstPreset.key}» ${limits.worstPreset.max.toFixed(2)}:1 · `
      + `φράγμα custom ${limits.customCeiling.toFixed(2)}:1`));
    console.log(C.dim('  απογραφή (κάθε κλήση σε ΜΙΑ ρητή κατάσταση):'));
    for (const [state, count] of Object.entries(tally)) {
      if (count > 0) console.log(C.dim(`      ${String(count).padStart(4)}  ${state}`));
    }
    console.log(C.green('\n✓ CHECK 3.45 PASS\n'));
    return 0;
  }

  for (const f of failures) console.error(C.red(`  [FAIL] ${f}`));
  console.error(C.red(`\n✗ CHECK 3.45 FAIL — ${failures.length} αθετημένη(ες) υπόσχεση(εις)\n`));
  console.error(C.dim('  ΜΗΝ κατεβάσεις το κατώφλι για να γίνει πράσινο — η αποτυχία ήταν ΣΙΩΠΗΛΗ,'));
  console.error(C.dim('  όχι υπερβολική. Ζήτα το μέσα από την υπογραφή που επιστρέφει InkVerdict'));
  console.error(C.dim('  και διάσωσε με casing (bim-contrast-casing.ts) — δες ADR-771 §5.\n'));
  return 1;
}

if (require.main === module) process.exit(main());

module.exports = { BLOCKING, SSOT_INPUTS, STATES, classify, explain, reachabilityGap, shouldRunFull, targetFiles };
