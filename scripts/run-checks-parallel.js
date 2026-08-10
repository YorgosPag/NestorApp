#!/usr/bin/env node
'use strict';
/**
 * Phase 1 parallel check orchestrator for the pre-commit hook.
 *
 * Architecture:
 *   - JS checks  → worker_threads (zero spawn overhead, shared OS file cache,
 *                  single Node.js heap instead of 15 separate ones)
 *   - .sh checks → child_process.spawn (bash; cannot run in a thread)
 *
 * The bash hook sets STAGED_* environment variables and then calls this script.
 * All conditional logic lives here so the bash hook stays minimal.
 *
 * Environment inputs (set by pre-commit hook):
 *   STAGED_TS_FILES                staged .ts/.tsx (excl. .d.ts, node_modules)
 *   STAGED_LOCALE_FILES            staged src/i18n/locales/**\/*.json
 *   STAGED_QUERY_FILES             TS files containing query() + where()
 *   STAGED_SRC_TS_FILES            staged .ts/.tsx under src/
 *   STAGED_ALL_FILES               all staged files
 *   STAGED_NAV_TRIGGER_FILES       navigation factory / nav locale changes
 *   STAGED_RULES_COVERAGE_TRIGGERS firestore.rules or tests/firestore-rules changes
 *   STAGED_STORAGE_COVERAGE_TRIGGERS storage.rules changes
 *   STAGED_NOTIF_LOCALE_TRIGGERS   notification-key locale changes
 *   STAGED_AUDIT_CATALOGS_TRIGGER  audit-value-catalog changes
 *   SSOT_DISCOVER_FULL             '1' = run full ssot-discover scan
 *   SKIP_NATIVE_TOOLTIP / SKIP_TABS_IMPORT / SKIP_NO_FLASH  bypass specific checks
 *   SKIP_EMPTY_SELECT_ITEM                                  bypass CHECK 3.48
 *   SKIP_I18N_TYPES                '1' = bypass CHECK 3.33 (generated-types freshness)
 *   SKIP_I18N_SHELL_SLICE          '1' = bypass CHECK 3.34 (i18n shell-slice freshness)
 *   SKIP_I18N_NAMESPACE_WIRING     '1' = bypass CHECK 3.36 (i18n namespace reachability)
 *   SKIP_CI_TIER_COVERAGE          '1' = bypass CHECK 3.37 (CI gate tier coverage)
 *   SKIP_ADDRESS_VOCABULARY        '1' = bypass CHECK 3.44 (address vocabulary coverage)
 *   SKIP_ADR_IDENTITY              '1' = bypass CHECK 3.49 (ADR number identity)
 *   CHECK_WORKER_TIMEOUT_MS        per-worker timeout ms (default 60000)
 *
 * Exit: 0 = all pass, 1 = any fail.
 */

const { Worker }   = require('worker_threads');
const { spawn }    = require('child_process');
const fs           = require('fs');
const path         = require('path');

const RED    = '\x1b[0;31m';
const GREEN  = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC     = '\x1b[0m';

const cwd            = process.cwd();
const RUNNER         = path.join(__dirname, 'worker-check-runner.js');
const TIMEOUT_MS     = Number(process.env.CHECK_WORKER_TIMEOUT_MS) || 120_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseList(envVal) {
  if (!envVal) return [];
  return envVal.split('\n').map(s => s.trim()).filter(Boolean);
}

function has(rel) {
  return fs.existsSync(path.join(cwd, rel));
}

// ─── Environment inputs ───────────────────────────────────────────────────────

const tsFiles             = parseList(process.env.STAGED_TS_FILES);
const localeFiles         = parseList(process.env.STAGED_LOCALE_FILES);
const queryFiles          = parseList(process.env.STAGED_QUERY_FILES);
const srcTsFiles          = parseList(process.env.STAGED_SRC_TS_FILES);
const allFiles            = parseList(process.env.STAGED_ALL_FILES);
const navTriggers         = parseList(process.env.STAGED_NAV_TRIGGER_FILES);
const rulesCovTriggers    = parseList(process.env.STAGED_RULES_COVERAGE_TRIGGERS);
const storageCovTriggers  = parseList(process.env.STAGED_STORAGE_COVERAGE_TRIGGERS);
const notifLocaleTriggers = parseList(process.env.STAGED_NOTIF_LOCALE_TRIGGERS);
const auditCatalogsTrigger = parseList(process.env.STAGED_AUDIT_CATALOGS_TRIGGER);

const ssotFull    = process.env.SSOT_DISCOVER_FULL === '1';
const skipTenantScope = !!process.env.SKIP_FIRESTORE_TENANT_SCOPE;
const skipI18nTypes = !!process.env.SKIP_I18N_TYPES;
const skipShellSlice = !!process.env.SKIP_I18N_SHELL_SLICE;
const skipNamespaceWiring = !!process.env.SKIP_I18N_NAMESPACE_WIRING;
const skipTooltip = !!process.env.SKIP_NATIVE_TOOLTIP;
const skipTabs    = !!process.env.SKIP_TABS_IMPORT;
const skipFlash   = !!process.env.SKIP_NO_FLASH;

// ─── Build check lists ────────────────────────────────────────────────────────

/** @type {{ id:string, name:string, script:string, args:string[] }[]} */
const threads = [];

/** @type {{ id:string, name:string, cmd:string, args:string[] }[]} */
const processes = [];

function addThread(id, name, script, args = []) {
  if (!has(script)) return;
  threads.push({ id, name, script, args });
}

function addBash(id, name, shScript, args = []) {
  if (!has(shScript)) return;
  processes.push({ id, name, cmd: 'bash', args: [shScript, ...args] });
}

if (tsFiles.length > 0) {
  // 3.5 + 3.6 run in Phase 0.5 (sync bash) — spawn deadlocks alongside worker threads
  addThread('3.7',  'SSoT imports',             'scripts/check-ssot-imports.js',               tsFiles);
  addThread('3.8',  'i18n missing keys',        'scripts/check-i18n-missing-keys.js',          tsFiles);
  addThread('3.12', 'Option i18n keys',         'scripts/check-option-i18n-keys.js',           tsFiles);
  addThread('3.13', 'i18n resolver',            'scripts/check-i18n-resolver-reachability.js', tsFiles);
  if (!skipTooltip)
    addThread('3.23', 'Native tooltip',         'scripts/check-native-tooltip.js',             tsFiles);
  // CHECK 3.48 (ADR-778) — κενό <SelectItem>: το Radix δεσμεύει το '' και το item ΡΙΧΝΕΙ ΟΛΗ
  // την επιφάνεια. Χτύπησε ΤΡΕΙΣ φορές (§59.6.3 έριξε την καρτέλα «Μορφοποίηση»· το βρήκε
  // άνθρωπος). Ο τύπος δέχεται το '' και ο έλεγχος χρόνου εκτέλεσης πετά ΚΑΤΑ ΤΗΝ ΑΠΟΔΟΣΗ,
  // δηλαδή αφού προσγειωθεί. Ίδιος σκελετός AST με το 3.23 — καμία νέα μηχανή. ZERO-TOL.
  if (!process.env.SKIP_EMPTY_SELECT_ITEM)
    addThread('3.48', 'Empty SelectItem',       'scripts/check-empty-select-item.js',          tsFiles);
  if (!skipTabs)
    addThread('3.24', 'Tabs import ratchet',    'scripts/check-tabs-import-ratchet.js',        tsFiles);
  if (!skipFlash)
    addThread('3.25', 'No-flash ratchet',       'scripts/check-no-flash-ratchet.js',           tsFiles);
  addThread('4',    'File sizes',               'scripts/check-file-sizes.js',                 tsFiles);
}

if (localeFiles.length > 0)
  addBash('3.9', 'ICU interpolation', 'scripts/check-icu-interpolation.sh', localeFiles);

// CHECK 3.33 (ADR-727) — src/types/i18n.ts is generated from the locale JSONs.
// Trigger on either side of that dependency: a locale change that forgot the
// regeneration, or an edit to the generated file itself. Pure in-memory Node
// (no spawn), so it belongs here in Phase 1 rather than a sequential 0.x phase.
if (!skipI18nTypes && (localeFiles.length > 0 || allFiles.includes('src/types/i18n.ts')))
  addThread('3.33', 'i18n types freshness', 'scripts/check-i18n-types-freshness.js');

// CHECK 3.34 (ADR-744) — the synchronous i18n bootstrap is generated from the
// shell's import closure. Three things can invalidate it, so all three are
// triggers: a locale edit (the sliced VALUES move), any staged .ts/.tsx (it may
// BE a shell module, or may newly resolve a specifier the walk could not), and
// an edit to the generated output or its config. Layer 1 never builds the
// module graph — measured 0,7s against the manifest — so it belongs in Phase 1
// beside 3.33; the full graph rebuild is Layer 2, in CI.
const shellSliceTriggers = [
  ...localeFiles,
  ...tsFiles,
  ...allFiles.filter(f => f.startsWith('src/i18n/generated/') || f === '.i18n-shell-slice.json'),
];
if (!skipShellSlice && shellSliceTriggers.length > 0)
  addThread('3.34', 'i18n shell slice', 'scripts/check-i18n-shell-slice.js', tsFiles);

// CHECK 3.36 (ADR-752) — «φορτώνεται» το namespace; Έξι namespaces είχαν αρχεία
// locale, τύπους και καταναλωτές αλλά κανένα `case` στο namespace-loaders.ts:
// άδειο bundle ⇒ ωμά κλειδιά στην οθόνη, με ΟΛΕΣ τις άλλες CHECK πράσινες. Ο
// validator υπήρχε ήδη (validate-i18n-config.js) και ήταν ΚΟΚΚΙΝΟΣ — απλώς δεν
// τον έτρεχε καμία πύλη· ένα anchor χωρίς gate δεν είναι anchor, είναι σχόλιο.
// Καθαρό in-memory Node (2 parse + 100 readdir, ~60ms), άρα Phase 1 δίπλα στα
// 3.33/3.34. ΔΕΝ είναι ratchet — καμία baseline, ποτέ: μια δήλωση υπάρχει ή όχι.
const namespaceWiringTriggers = [
  ...localeFiles,
  ...allFiles.filter(f => f.startsWith('src/i18n/') || f === 'src/types/i18n.ts'),
];
if (!skipNamespaceWiring && namespaceWiringTriggers.length > 0)
  addThread('3.36', 'i18n namespace reachability', 'scripts/validate-i18n-config.js');

// CHECK 3.37 (ADR-757) — «παρακολουθείται» η πύλη; Ο συγκεντρωτής CI κρατούσε ΧΕΙΡΟΓΡΑΦΗ
// λίστα 18 workflows· επτά πύλες είχαν προστεθεί χωρίς να μπουν, ανάμεσά τους η ΜΟΝΑΔΙΚΗ
// που φράζει την παραγωγή. Όταν σταμάτησε το deploy, το «SSoT των αποτυχιών CI» δεν το
// κατέγραψε καν. Σκανδάλη: οτιδήποτε αγγίζει workflows, μητρώο ή τον κώδικα της πύλης.
// ~27 μικρά αρχεία, καθαρό in-memory Node. ΔΕΝ είναι ratchet — καμία baseline, ποτέ.
const ciTierTriggers = allFiles.filter(
  f => f.startsWith('.github/workflows/') || f === '.ci-gate-tiers.json' || f.startsWith('scripts/lib/ci/')
);
if (!process.env.SKIP_CI_TIER_COVERAGE && ciTierTriggers.length > 0)
  addThread('3.37', 'CI gate tier coverage', 'scripts/check-ci-gate-tiers.js');

// CHECK 3.38 (ADR-770) — «διαβάζεται»; Στο ΠΡΟΕΠΙΛΕΓΜΕΝΟ (σκοτεινό) θέμα το `--primary`
// λύνεται σε `217 33% 17%`, ΤΑΥΤΟΣΗΜΟ με το `--card`: το `text-primary` αποτυγχάνει σε
// 23/23 επιφάνειες, τέσσερις στο 1,00:1 (ADR-759 §4.12.2). Κανένα υπάρχον gate δεν το
// έβλεπε — το 3.32 μετρά μόνο παλέτα γραφημάτων, το a11y ratchet ρωτά αν ΥΠΑΡΧΕΙ test,
// ο Tailwind δεν έχει λόγο για μια συμβολοσειρά. Έτσι έφτασαν οι 424, με όλες τις
// πύλες πράσινες. Layer 1 = ΜΟΝΟ τα staged (~50-150ms)· το πλήρες δέντρο (2,7s) είναι
// Layer 1b στο CI. ⚠️ Το Layer 1 ΔΕΝ ξαναταξινομεί μη-staged αρχεία — δηλωμένο όριο.
if (!process.env.SKIP_TEXT_PRIMARY_RATCHET && srcTsFiles.length > 0)
  addThread('3.38', 'UI contrast ratchet', 'scripts/check-text-primary-ratchet.js', srcTsFiles);

// CHECK 3.39 (ADR-770 Στρώμα 2) — η ΑΛΛΗ διαδρομή προς το ίδιο αόρατο κείμενο. Η
// εφαρμογή έχει ΔΥΟ συστήματα χρωμάτων: το `globals.css` (δύο θέματα) και ένα
// χειρόγραφο σε TypeScript που δηλώνει `colors.text.primary = "#1e293b"` — σταθερό hex
// φωτεινού θέματος, μηδενική έννοια θέματος — και καταλήγει σε INLINE STYLE, δηλαδή
// νικάει κάθε κλάση κατά ειδικότητα. Το 3.38 διαβάζει κλάσεις· εδώ δεν υπάρχει κλάση.
// Το `color-contrast` του axe ΔΕΝ εκτελείται σε jsdom (`getClientRects`, μετρημένο
// 2026-08-07) ⇒ 1,00:1 περνά πράσινο. Κριτήριο: «αλλάζει η ετυμηγορία ανάμεσα στα δύο
// θέματα;» — δεν χρειάζεται να μαντέψει τι συμβαίνει στην οθόνη.
// Σκανδάλη: μόνο τα 13 αρχεία εισόδου. ΔΕΝ έχει staged λειτουργία σκόπιμα — κάθε
// αλλαγή σε οποιοδήποτε από αυτά ξαναταξινομεί τα υπόλοιπα (~250ms συνολικά).
const themePairingTriggers = allFiles.filter(
  f => f.startsWith('src/styles/design-tokens/modules/')
    || f === 'src/app/globals.css'
    || f.startsWith('scripts/lib/contrast/')
);
if (!process.env.SKIP_THEME_PAIRING && themePairingTriggers.length > 0)
  addThread('3.39', 'Theme pairing ratchet', 'scripts/check-theme-pairing-ratchet.js');

// CHECK 3.42 (ADR-773 §8) — η ΠΕΜΠΤΗ αρχή χρώματος: «οι ΚΛΑΣΕΙΣ που παράγει η κεντρική
// αρχή είναι θεματικές;». Το `design-system/tokens/colors.ts:76` δηλώνει
// `text.primary = 'text-slate-900'` = `#0f172a` ⇒ στο ΠΡΟΕΠΙΛΕΓΜΕΝΟ (σκοτεινό) θέμα
// **1,02:1** πάνω στο `--background`, ΧΕΙΡΟΤΕΡΟ από το 1,01:1 που ξεκίνησε την
// εκστρατεία — με **875** αρχεία καταναλωτές. Καμία πύλη δεν το ρωτούσε, και δεν ήταν
// κενό καμίας: το 3.26 ρωτά «παρακάμπτεις;» και τα αρχεία είναι ΟΡΘΑ στην allowlist
// (*είναι* το SSoT)· το 3.38 ψάχνει `text-primary`· τα 3.39/3.40 διαβάζουν ΤΙΜΕΣ και
// εδώ υπάρχει ΚΛΑΣΗ.
// 🔑 Η εμβέλεια ΕΙΝΑΙ η allowlist του 3.26 — δομικά: μέχρι σήμερα, βάζοντας αρχείο εκεί
// το εξαίρειες από το 3.26 και ΚΑΝΕΙΣ άλλος δεν το κοίταζε ποτέ. Οι δύο πύλες είναι
// πλέον τα δύο μισά ενός ερωτήματος, με ΜΙΑ λίστα.
// Σκανδάλη: τα αρχεία της allowlist, το μητρώο, το config του Tailwind, το globals.css
// (~0,9s — 303ms το `resolveConfig`, που είναι και η ΑΥΘΕΝΤΙΑ των τιμών: καμία δική μας
// χαρτογράφηση «κλίμακα → hex»).
let themeClassesTriggered = allFiles.some(
  f => f === '.ssot-registry.json' || f === 'tailwind.config.ts'
    || f === 'src/app/globals.css' || f.startsWith('scripts/lib/contrast/'),
);
if (!themeClassesTriggered && srcTsFiles.length > 0) {
  // Η ιδιότητα «είναι αρχείο-αυθεντία;» ζει στο μητρώο, όχι εδώ. Fail-open προς τα
  // ΜΕΣΑ: αν το module λείπει, τρέχει η πύλη — και εκείνη κάνει fail-closed.
  const { loadRegistry, isAllowlisted } = require('./lib/ssot/registry');
  const mod = loadRegistry().modules.find(m => m.name === 'tailwind-hardcoded-palette');
  themeClassesTriggered = !mod
    || srcTsFiles.some(f => isAllowlisted(f.replace(/\\/g, '/'), mod.allowlist));
}
if (!process.env.SKIP_THEME_CLASSES && themeClassesTriggered)
  addThread('3.42', 'Tailwind theme classes ratchet', 'scripts/check-tailwind-theme-classes-ratchet.js');

// CHECK 3.41 (ADR-771 Φ.1) — «ξέρω ΠΟΙΟ είναι ποιο χωρίς να δω χρώμα;». Η «παράκαμψη»
// και η «σύγκρουση» κελιού ζωγραφίζονταν ως ΤΑΥΤΟΣΗΜΟ τρίγωνο, στην ίδια γωνία, στο ίδιο
// μέγεθος — μόνη διαφορά η απόχρωση (WCAG 1.4.1). Καμία πύλη δεν τα κοίταζε: το 3.32
// μετρά ΜΟΝΟ την παλέτα γραφημάτων, τα 3.38/3.39 κλάσεις και δηλώσεις tokens.
// ⚠️ ΔΥΟ κανόνες, ΟΧΙ ένας με «ή»: το ζεύγος `#f59e0b`↔`#ef4444` δίνει ΔE 13,9 σε CVD,
// δηλαδή ΠΑΝΩ από το κατώφλι 8 — ένα «σχήμα Ή χρώμα» θα έμενε πράσινο πάνω στο ίδιο το
// ελάττωμα. Το Κ1 (ταυτότητα) δεν έχει χρωματική διέξοδο σε καμία τιμή ΔE.
// Σκανδάλη: το config των σημαδιών ή ο ζωγράφος τους (~120ms, ένα AST parse).
const stateChannelTriggers = allFiles.filter(
  f => f === 'src/subapps/dxf-viewer/config/color-config.ts'
    || f === 'src/subapps/dxf-viewer/rendering/entities/table/stamp-table-bound-state.ts'
    || f.startsWith('scripts/lib/contrast/')
);
if (!process.env.SKIP_STATE_CHANNEL && stateChannelTriggers.length > 0)
  addThread('3.41', 'State channel distinctness', 'scripts/check-state-channel-distinctness.js');

// CHECK 3.45 (ADR-771 Φ.3) — «αυτό το κατώφλι αντίθεσης είναι ΕΦΙΚΤΟ;». Το
// `WALL_LINE_CONTRAST = 9.0` είναι ΑΝΕΦΙΚΤΟ στο preset `cinema4d` (#555555, μέγιστο δυνατό
// 7,46:1) — και η `adaptColorToBackground` επέστρεφε σιωπηλά το άκρο: η συνάρτηση απαντά,
// άρα κανείς δεν ρώτησε αν πέτυχε. Καμία πύλη δεν το έβλεπε: τα 3.38/3.39/3.40 κρίνουν
// κλάσεις · δηλώσεις · υπολογισμένες τιμές CSS, ενώ εδώ το κατώφλι είναι ΑΡΙΘΜΟΣ σε TS.
// ⚠️ ΔΥΟ επιφάνειες-κριτές: τα 9 preset θέματα ΚΑΙ το μαθηματικό φράγμα του `custom`
// (4,58:1) — ένα κατώφλι 7,0 περνά όλα τα preset και σπάει στον πρώτο χρήστη.
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ, ΟΧΙ ΕΔΩ, και όταν πυροδοτεί ο έλεγχος είναι ΠΑΝΤΑ
// πλήρης (~2,7s): μια νέα μεσοτονική επιφάνεια κάνει ανέφικτες υποσχέσεις σε αρχεία που
// κανείς δεν σταδιοποίησε. Κόστος όταν δεν αφορά: ~0,05s (προφίλτρο κειμένου).
if (!process.env.SKIP_CONTRAST_PROMISE && allFiles.length > 0)
  addThread('3.45', 'Contrast promise reachability', 'scripts/check-contrast-promise-reachability.js', allFiles);

// CHECK 3.43 (ADR-774) — «αυτό που μοιάζει με token, ΕΙΝΑΙ token;». Στα `.css` του `src/`
// υπάρχουν 125 `var(--x, #hex)` όπου το `--x` δεν ορίζεται πουθενά ⇒ το hex είναι η τιμή,
// ΠΑΝΤΑ, μονοθεματικό — και το `var()` γύρω του είναι ακριβώς αυτό που το κάνει αόρατο.
// 🔑 Ο κανόνας `no-unknown-custom-properties` του stylelint — το βιομηχανικό πρότυπο —
// τεκμηριώνει ΚΑΤΑ ΛΕΞΗ ότι το `var(--foo, #f00)` «δεν είναι πρόβλημα». Εδώ είμαστε
// αυστηρότεροι, με μετρημένο λόγο. Τα CSS Modules δεν είναι καμία από τις επτά αρχές του
// ADR-773: είναι η ΟΓΔΟΗ, αχαρτογράφητη.
// ⚠️ ΤΡΕΙΣ κανόνες, ΟΧΙ ένας με «ή»: Κ1 (χωρίς fallback ⇒ κληρονομεί αυθαίρετο χρώμα,
// ZERO-TOL στο 0) · Κ2 (σκληρό χρώμα, ratchet) · Κ3 (`prefers-color-scheme` ρωτά το
// ΛΕΙΤΟΥΡΓΙΚΟ, ενώ το θέμα εδώ το ορίζει η κλάση `.dark`).
// Σκανδάλη: σταδιοποιημένο `.css` ή τα ίδια τα αρχεία της πύλης. Τα `.css` αλλάζουν σπάνια,
// οπότε πληρώνουμε τον ΠΛΗΡΗ δείκτη ορισμών (~3s) και παίρνουμε σωστή απάντηση, αντί για
// φθηνή προσέγγιση — ένας χειρόγραφος κατάλογος πηγών αποκλίνει σιωπηλά (3.34, 3.37).
const cssAuthorityTriggers = allFiles.filter(
  f => /^src\/.*\.css$/.test(f)
    || f === 'scripts/check-css-token-authority.js'
    || f.startsWith('scripts/lib/css-vars/')
);
const stagedCssForAuthority = cssAuthorityTriggers.filter(f => /^src\/.*\.css$/.test(f));
if (!process.env.SKIP_CSS_TOKEN_AUTHORITY && cssAuthorityTriggers.length > 0)
  // Αλλαγή στην ΙΔΙΑ την πύλη χωρίς staged `.css` ⇒ `--all`. Αλλιώς η πύλη θα ανέφερε
  // «κανένα staged .css» και θα περνούσε πράσινη πάνω στην αλλαγή του ίδιου της του κριτηρίου
  // — το σχήμα «0 = κανείς δεν κοίταξε», γεννημένο στη σκανδάλη αντί στον σαρωτή.
  addThread('3.43', 'CSS token authority', 'scripts/check-css-token-authority.js',
    stagedCssForAuthority.length > 0 ? stagedCssForAuthority : ['--all']);

// CHECK 3.46 (ADR-775) — «ΜΠΟΡΕΙ αυτή η σουίτα e2e να περάσει;», πριν καν ρωτήσει κανείς
// αν περνάει. Μέχρι 08/08 ΚΑΝΕΝΑ workflow δεν έτρεχε `playwright test`: 369 tests σε 5
// αρχεία δεν εκτελούνταν πουθενά, άρα κανείς δεν μάθαινε ότι δεν μπορούν. Δεν έλειπε πύλη
// — έλειπε η ΕΚΤΕΛΕΣΗ.
// ⚠️ ΤΡΕΙΣ ομάδες, ΟΧΙ μία με «ή»: Α ο UA περνά τα ΠΡΑΓΜΑΤΙΚΑ BLOCKED_BOT_PATTERNS του
// `src/middleware.ts` (⇒ αλλιώς 403 χωρίς σώμα) · Β το `snapshotPathTemplate` ξεχωρίζει
// {projectName}+{platform} (⇒ αλλιώς σύγκριση με golden άλλου project/OS) · Γ κάθε
// `playwright test <φίλτρο>` δείχνει σε υπαρκτό spec (⇒ αλλιώς «No tests found» = 0 κάλυψη).
// 🔑 Ο αριθμός του ADR-770 §13 («τα 7 projects είναι δομικά σπασμένα») ήταν ΛΑΘΟΣ: μετρημένο
// 0/7 — τα device descriptors του Playwright ΠΕΡΙΕΧΟΥΝ userAgent. Η προστασία υπάρχει αλλά
// είναι ΤΥΧΑΙΑ, και αυτό ακριβώς κλειδώνει η ομάδα Α.
// Σκανδάλη: τα δύο αρχεία-αυθεντίες, το package.json, τα e2e specs, ή η ίδια η πύλη (~2s).
// Δηλωμένο κενό: νέο spec που δεν σταδιοποιήθηκε — το κλείνει το Layer 2 (άνευ όρων).
const e2eExecTriggers = allFiles.filter(
  f => f === 'playwright.config.ts'
    || f === 'src/middleware.ts'
    || f === 'package.json'
    || f === 'scripts/check-e2e-executability.js'
    || f.startsWith('scripts/lib/e2e-executability/')
    || /(^|\/)e2e\/.*\.spec\.tsx?$|\.e2e\.spec\.tsx?$/.test(f)
);
if (!process.env.SKIP_E2E_EXECUTABILITY && e2eExecTriggers.length > 0)
  addThread('3.46', 'E2E executability', 'scripts/check-e2e-executability.js');

// CHECK 3.47 (ADR-776) — «αυτό το αρχείο test το τρέχει ΑΚΡΙΒΩΣ ΕΝΑΣ;»: όχι κανένας, όχι δύο.
// Το default `jest.config.js` σάρωνε με glob όλο το δέντρο και επικαλυπτόταν με τα ΤΕΣΣΕΡΑ
// sibling configs, ενώ η χειρόγραφη λίστα εξαιρέσεων ανέφερε ΕΝΑ. Μετρημένο: 3362 tracked
// αρχεία test ⇒ 14 σε δύο projects (η μία εκτέλεση με `jsdom` αντί `node`, δηλαδή δομικά
// αδύνατο να περάσει) + 7 build artifacts κάτω από το gitignored `functions/lib/`.
// ⚠️ Το `projects` API του jest ΔΕΝ αρκεί: #14019 «runs tests twice if projects have rootDir
// set to the root of the repository» (και τα 4 configs μας) — closed as not planned — και το
// jest δεν προειδοποιεί ΠΟΤΕ για επικάλυψη. Η εγγύηση θέλει πύλη, όχι μετακόμιση.
// ⚠️ ΔΕΝ είναι ratchet: όλα διορθώθηκαν στο ίδιο commit, οπότε baseline θα κλείδωνε το
// ελάττωμα αντί να το λύσει.
// Σκανδάλη: κάθε jest config, κάθε .gitignore (αυθεντία του «τι δεν είναι πηγή»), το
// playwright.config.ts, η ίδια η πύλη, ή staged `.spec.` (η ΜΟΝΗ μορφή που μπορεί να
// προσγειωθεί ορφανή, αφού το default διεκδικεί ό,τι άλλο έχει σχήμα test). ~2,2s.
// Δηλωμένο κενό: build artifact που κανείς δεν σταδιοποίησε — το κλείνει το Layer 2.
const jestPartitionTriggers = allFiles.filter(
  f => /^jest\.config.*\.js$/.test(f)
    || f === '.gitignore'
    || f.endsWith('/.gitignore')
    || f === 'playwright.config.ts'
    || f === 'scripts/check-jest-partition.js'
    || f.startsWith('scripts/lib/jest-partition/')
    || /\.spec\.[jt]sx?$/.test(f)
);
if (!process.env.SKIP_JEST_PARTITION && jestPartitionTriggers.length > 0)
  addThread('3.47', 'Jest partition', 'scripts/check-jest-partition.js');

// CHECK 3.49 (ADR-779) — «απαντά ο αριθμός ADR-NNN σε ΕΝΑ έγγραφο;». Μετρημένο 2026-08-08:
// **60 αριθμοί** διεκδικούνται από περισσότερα του ενός έγγραφα, σε **8 σπίτια** — το ADR-320
// υπάρχει με το ΙΔΙΟ όνομα αρχείου σε δύο σπίτια. Δηλαδή «δες το ADR-294» δεν προσδιορίζει
// έγγραφο, και το ADR-294 είναι ο ίδιος ο κανόνας N.12 του CLAUDE.md.
// 🔴 Ο κανόνας ΥΠΗΡΧΕ και δεν τον εκτελούσε κανείς: το CLAUDE.md ζητά «use the next sequential
// number» και παραδέχεται ρητά ότι ο δηλωμένος επόμενος παλιώνει («stale by 357 … by 18, so
// verify with `ls` instead of trusting it») — δηλαδή αναθέτει σε άνθρωπο έλεγχο που καμία
// μηχανή δεν κάνει. Σχήμα CHECK 3.36: «ένα anchor χωρίς gate είναι σχόλιο».
// Πρακτική των μεγάλων (ερευνήθηκε): οι αριθμοί είναι ΑΜΕΤΑΒΛΗΤΟΙ («never renumber»), η
// σύγκρουση λύνεται με **bumping** (RFC-0000), και η αποτροπή είναι **CI lint duplicate numbers**
// (adrs-core `check_all`). Η πύλη δεν επινοεί πολιτική — εκτελεί τη γραμμένη.
// ⚠️ RATCHET, ΟΧΙ zero-tol: 60 υπάρχουσες ⇒ μονίμως κόκκινο ⇒ παρακάμπτεται με SKIP_.
// Σκανδάλη: staged αρχείο με βασικό όνομα `ADR-<ψηφία>` — ακριβώς η μόνη στιγμή που γεννιέται
// σύγκρουση (η αυθεντία της πύλης είναι το index του git). ~0,5s.
const adrIdentityTriggers = allFiles.filter(
  f => /(^|\/)ADR-\d+/.test(f)
    || f === 'scripts/check-adr-identity.js'
    || f.startsWith('scripts/lib/adr-identity/')
);
if (!process.env.SKIP_ADR_IDENTITY && adrIdentityTriggers.length > 0)
  addThread('3.49', 'ADR identity', 'scripts/check-adr-identity.js');

// CHECK 3.50 (ADR-780) — «κάθε επιφάνεια που δηλώνει ΚΑΘΟΛΙΚΗ στρώση, τη ζητά από τη ΜΙΑ
// κλίμακα;» — και, το ίδιο σημαντικό, «το token που ζητά ΥΠΑΡΧΕΙ;». Το SSoT σταματούσε στο
// `tooltip: 1800`· πάνω από αυτό βρέθηκαν ΠΕΝΤΕ λεξιλόγια, δύο από τα οποία δίνουν
// ΔΙΑΦΟΡΕΤΙΚΟ ΑΡΙΘΜΟ ΣΤΟ ΙΔΙΟ ΟΝΟΜΑ ΡΟΛΟΥ (`tooltip` = 1800 · 2000 · 10000) — χειρότερο
// σχήμα από το ADR-749 («δύο αλήθειες, η μία ανώνυμη»): εδώ και οι δύο έχουν ΟΝΟΜΑ.
// 🔑 ΤΡΕΙΣ ΔΙΑΛΕΚΤΟΙ, ΜΙΑ ΕΠΙΦΑΝΕΙΑ — ΜΕΤΡΗΜΕΝΟ ζωντανά: `.z-\[9999\]` (Tailwind, από .tsx)
// και `.DxfContextMenu-module__…` (CSS module, από .css) κάθονται ΔΙΠΛΑ-ΔΙΠΛΑ στο ίδιο
// μεταγλωττισμένο stylesheet με ίδια τιμή. Πύλη που διαβάζει μόνο `.css` είναι δομικά τυφλή
// στο μισό — και το χειρότερο (`z-[99999]`) ζει στο τυφλό μισό.
// ⚠️ ΜΗΝ προσθέσεις stylelint: ο `no-unknown-custom-properties` τεκμηριώνει ΚΑΤΑ ΛΕΞΗ ότι
// ένα fallback κάνει τη χρήση αποδεκτή — θα έλεγε «καθαρό» ακριβώς εκεί που ρωτάμε (3.43).
// ⚠️ RATCHET, ΟΧΙ zero-tol: 37 ζωντανές ⇒ μονίμως κόκκινο ⇒ παρακάμπτεται με SKIP_. Οι ΔΥΟ
// καταστάσεις που ΕΙΝΑΙ zero-tol (`unknown-token`, `parallel-scale`) δεν μπαίνουν ΠΟΤΕ σε
// baseline — το ίδιο το `buildPayload` αρνείται να τις γράψει.
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ (προφίλτρο κειμένου, ~0,05s): μια ωμή `z-index: 9999`
// μπορεί να προσγειωθεί σε ΟΠΟΙΟΔΗΠΟΤΕ αρχείο του `src/`, άρα λίστα φακέλων εδώ θα ήταν
// σωστή σήμερα και θα απέκλινε σιωπηλά αύριο. Όταν πυροδοτεί, ο έλεγχος είναι ΠΑΝΤΑ πλήρης
// (~4,7s) — ένας νέος ρόλος ξαναταξινομεί αρχεία που κανείς δεν σταδιοποίησε.
// ⚠️ ΤΟ ΣΥΝΟΡΟ ΤΩΝ ΤΡΙΤΩΝ (ADR-780 Φάση Β) ΠΡΟΣΘΕΤΕΙ ΤΡΕΙΣ ΕΙΣΟΔΟΥΣ ΕΚΤΟΣ `src/`: το
// μητρώο και τα δύο αρχεία εξαρτήσεων. Χωρίς αυτά, ένα `npm i` που φέρνει βιβλιοθήκη με
// `z-index: 99999` δεν θα άγγιζε ΚΑΝΕΝΑ αρχείο πηγής και θα περνούσε αθέατο μέχρι το CI.
// Η απογραφή του `node_modules` (~6s) τρέχει ΜΟΝΟ όταν πυροδοτούν αυτά — η ίδια η πύλη
// το αποφασίζει (`touchesForeignCensus`), όχι αυτή η λίστα.
const zIndexScaleTriggers = allFiles.filter(
  f => /^src\/.*\.(css|ts|tsx)$/.test(f)
    || f === 'design-tokens.json'
    || f === 'scripts/check-zindex-scale.js'
    || f.startsWith('scripts/lib/zindex/')
    || f === '.zindex-foreign.json'
    || f === 'package.json'
    || f === 'package-lock.json'
    || f === 'pnpm-lock.yaml'
);
if (!process.env.SKIP_ZINDEX_SCALE && zIndexScaleTriggers.length > 0)
  addThread('3.50', 'z-index scale', 'scripts/check-zindex-scale.js', zIndexScaleTriggers);

// CHECK 3.51 (ADR-781) — ωμά i18n κλειδιά στο SSR HTML, ΣΤΑΤΙΚΟ μισό (Κ1 + Κ2).
// 17 ωμά κλειδιά × 141 διαδρομές, μόνιμα, στην παραγωγή: ο `useTranslationLazy`
// αρχικοποιούσε την ετοιμότητά του σε `useState(false)` και τη διόρθωνε ΜΟΝΟ σε
// `useEffect` — που δεν τρέχει ποτέ σε SSR. 🔴 Η ΜΕΤΑΦΡΑΣΗ ΗΤΑΝ ΗΔΗ ΕΚΕΙ, γι' αυτό
// καμία από τις πέντε πύλες i18n δεν το είδε: όλες ρωτούν «υπάρχει το κλειδί;».
// ⚠️ ZERO-TOL, ΚΑΜΙΑ baseline — και οι δύο πληθυσμοί μετρήθηκαν 0 (Κ1: 0/14.751
// αρχεία · Κ2: 0/606 βάσιμα κρινόμενα σημεία κλήσης). Layer 1 ~1,5s: ο Κ2 διαβάζει
// την κλειστότητα από το ΜΑΝΙΦΕΣΤΟ, χωρίς γράφο.
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΠΕΡΙΛΑΜΒΑΝΕΙ ΤΗ ΣΥΜΒΑΣΗ ΤΟΥ NEXT.JS (`src/app/**/{page,layout}.tsx`)
// και ΟΧΙ μόνο το manifest: ένα ΝΕΟ layout αλλάζει «ό,τι ζωγραφίζει πάντα» και το
// manifest το μαθαίνει μόνο ΜΕΤΑ. Λίστα από manifest και μόνο θα ήταν τυφλή ακριβώς
// στη στιγμή που έχει σημασία.
// ⚠️ Ο ΧΡΗΣΜΟΣ (Χ) ΔΕΝ τρέχει εδώ — χρειάζεται ζωντανό server (Layer 2, CI).
const ssrRawKeysTriggers = allFiles.filter(
  f => /^src\/app\/.*\/(page|layout)\.tsx$/.test(f)
    || /^src\/i18n\//.test(f)
    || /^src\/.*\.tsx?$/.test(f)
    || f === '.i18n-shell-slice.json'
    || f === 'scripts/check-i18n-ssr-raw-keys.js'
    || f.startsWith('scripts/lib/i18n-ssr/')
    || f.startsWith('scripts/lib/i18n/')
);
if (!process.env.SKIP_I18N_SSR_RAW_KEYS && ssrRawKeysTriggers.length > 0)
  addThread('3.51', 'i18n SSR raw keys', 'scripts/check-i18n-ssr-raw-keys.js', ssrRawKeysTriggers);

// CHECK 3.52 (ADR-777 §8.12) — «φοράει αυτή η σελίδα το κέλυφος ΕΠΕΙΔΗ ΤΟ ΛΕΕΙ Ο ΦΑΚΕΛΟΣ
// ΤΗΣ, ή επειδή κανείς δεν ρώτησε;». Ο `ConditionalAppShell` έκρινε «γυμνή σελίδα;» από
// ΤΡΕΙΣ χειρόγραφες λίστες `pathname` — και ένα route group είναι ΦΑΚΕΛΟΣ, δεν εμφανίζεται
// ΠΟΤΕ στο `pathname` ⇒ ήταν ΔΟΜΙΚΑ τυφλός στο `(light)`. Δεν απέκλινε η λίστα του: ΔΕΝ
// ΡΩΤΗΘΗΚΕ ΠΟΤΕ. Μετρημένο ζωντανά πριν τη μετακόμιση: 51/53 διαδρομές σέρβιραν το κέλυφος,
// μαζί με τις 3 δημόσιες οθόνες, το `/oauth/consent` (του οποίου το docblock λέει το
// αντίθετο) και τη σελίδα 404.
// 🔑 ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή» (3.41): Κ1 δομή · Κ2 ΚΑΤΑΝΑΛΩΤΗΣ ·
// Κ3 ιδιοκτησία συμβόλου. Ο Κ2 είναι ο λόγος που η άγκυρα είναι άγκυρα: ο Κ1 είναι από
// κατασκευή αυτο-συνεπής — μετακίνησε δημόσια σελίδα μέσα στο `(app)` και η δήλωση αλλάζει
// μαζί της, οπότε ο Κ1 μένει ΠΡΑΣΙΝΟΣ πάνω στο ίδιο το ελάττωμα.
// ⚠️ ZERO-TOL, ΚΑΜΙΑ baseline: δεν υπάρχει «λιγότερες σελίδες με λάθος κέλυφος από χθες» —
// μία αρκεί για να διαρρεύσει το εσωτερικό μενού σε δημόσιο επισκέπτη.
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ (`triggers()`), όχι εδώ — λίστα μονοπατιών εδώ θα ήταν
// δεύτερη αυθεντία. Κόστος ~0,05s όταν δεν αφορά· ~7s όταν πυροδοτεί (Κ2: git grep + AST).
if (!process.env.SKIP_SHELL_BOUNDARY && allFiles.length > 0)
  addThread('3.52', 'Shell boundary', 'scripts/check-shell-boundary.js', allFiles);

// CHECK 3.53 — ταυτότητα ενοτήτων ADR (ADR-739 §0.3 / ADR-777 §0.4).
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ (`triggers()`): μια ενότητα μπορεί να μετακομίσει σε
// οποιοδήποτε ADR/SPEC, άρα λίστα μονοπατιών εδώ θα απέκλινε σιωπηλά (σχήμα 3.34/3.37).
if (!process.env.SKIP_ADR_SECTION_REFS && allFiles.length > 0)
  addThread('3.53', 'ADR section refs', 'scripts/check-adr-section-refs.js', allFiles);

// CHECK 3.44 (ADR-772 §9) — «αυτό το διοικητικό πεδίο έχει γραμμή στον πίνακα;». Το
// ADR-772 έφτιαξε τον πίνακα λεξιλογίου (8 επίπεδα × 5 δοχεία)· τίποτα δεν εμπόδιζε ένα
// δοχείο να αποκτήσει ΕΝΑΤΟ πεδίο χωρίς γραμμή — ο μετατροπέας δεν το μεταφέρει, τίποτα
// δεν σκάει, και η σιωπηλή απώλεια επιστρέφει «φαινομενικά λυμένη». Το 3.7 φρουρεί τα
// ιδιωτικά ζεύγη μετατροπέα, όχι τα πεδία· το 3.18 σαρώνει `src/config|utils|lib` σε
// -maxdepth 1 και ΔΕΝ ανοίγει ποτέ το `src/types/**`, όπου ζουν τα δοχεία.
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ, ΟΧΙ ΕΔΩ: η πύλη λύνει μόνη της ποια αρχεία είναι τα
// δοχεία (από τον ίδιο τον πίνακα) και βγαίνει αμέσως αν κανένα δεν είναι staged. Λίστα
// μονοπατιών εδώ θα ήταν δεύτερη αυθεντία που αποκλίνει σιωπηλά — το ακριβές σχήμα των
// δύο λιστών namespace του CHECK 3.34. Κόστος όταν δεν αφορά: ~0,2s.
// Στρώμα 2 (πλήρες `src/`, ~30s) = job στο υπάρχον `ssot-discover.yml`.
if (!process.env.SKIP_ADDRESS_VOCABULARY && srcTsFiles.length > 0)
  addThread('3.44', 'Address vocabulary', 'scripts/check-address-vocabulary-coverage.js', srcTsFiles);

if (queryFiles.length > 0)
  addBash('3.10', 'Firestore companyId', 'scripts/check-firestore-companyid.sh', queryFiles);

// CHECK 3.35 — tenant scope (ADR-747). Ο διάδοχος του 3.10, με AST αντί για grep
// γραμμών: πιάνει και το client spread idiom (στο οποίο το 3.10 είναι ΔΟΜΙΚΑ
// τυφλό) και τις αλυσίδες του Admin SDK (τις οποίες δεν κοιτά καθόλου).
// Layer 1 = μόνο τα staged· Layer 2 (`--all`, ~2 λεπτά) τρέχει στο CI.
if (!skipTenantScope && srcTsFiles.length > 0)
  addThread('3.35', 'Firestore tenant scope', 'scripts/check-firestore-tenant-scope.js', srcTsFiles);

if (navTriggers.length > 0)
  addThread('3.11', 'Navigation labels', 'scripts/check-navigation-labels.js');

if (auditCatalogsTrigger.length > 0)
  addThread('3.14', 'Audit value catalogs', 'scripts/check-audit-value-catalogs.js');

if (srcTsFiles.length > 0) {
  addThread('3.15', 'Firestore index coverage',  'scripts/check-firestore-index-coverage.js',    srcTsFiles);
  addThread('3.17', 'Entity audit coverage',     'scripts/check-entity-audit-coverage.js',       srcTsFiles);
  addThread('3.18', 'SSoT discover',             'scripts/check-ssot-discover-ratchet.js',       ssotFull ? ['--full'] : []);
  addThread('3.20', 'Notification keys ratchet', 'scripts/check-notification-keys-ratchet.js',   srcTsFiles);
  addThread('3.26', 'Tailwind palette ratchet',  'scripts/check-tailwind-palette-ratchet.js',    srcTsFiles);
  addThread('3.27', 'DXF timing ratchet',        'scripts/check-dxf-timing-ratchet.js',          srcTsFiles);
}

if (rulesCovTriggers.length > 0)
  addThread('3.16', 'Firestore rules coverage',  'scripts/check-firestore-rules-test-coverage.js', rulesCovTriggers);

if (storageCovTriggers.length > 0)
  addThread('3.19', 'Storage rules coverage',    'scripts/check-storage-rules-test-coverage.js',   storageCovTriggers);

if (notifLocaleTriggers.length > 0)
  addThread('3.21', 'Notification keys locale',  'scripts/check-notification-keys-locale.js');

if (allFiles.length > 0)
  addThread('10', 'Secret scan', 'scripts/check-secret-scan.js', allFiles);

// ─── Runners ──────────────────────────────────────────────────────────────────

function runThread(check) {
  return new Promise(resolve => {
    const worker = new Worker(RUNNER, {
      workerData: { scriptPath: check.script, args: check.args, cwd },
      stdout: true,
      stderr: true,
    });

    let output = '';
    worker.stdout.on('data', chunk => { output += chunk; });
    worker.stderr.on('data', chunk => { output += chunk; });

    const timer = setTimeout(() => {
      worker.terminate();
      output += `\n${RED}  ⏰ CHECK ${check.id} timed out after ${TIMEOUT_MS / 1000}s${NC}\n`;
      resolve({ ...check, exitCode: 1, output });
    }, TIMEOUT_MS);

    worker.on('error', err => {
      clearTimeout(timer);
      output += `\n${RED}  ❌ Worker error [${check.id}]: ${err.message}${NC}\n`;
      resolve({ ...check, exitCode: 1, output });
    });

    worker.on('exit', code => {
      clearTimeout(timer);
      resolve({ ...check, exitCode: code ?? 0, output });
    });
  });
}

function runProcess(check) {
  return new Promise(resolve => {
    const proc = spawn(check.cmd, check.args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let output = '';
    proc.stdout.on('data', chunk => { output += chunk; });
    proc.stderr.on('data', chunk => { output += chunk; });

    const timer = setTimeout(() => {
      proc.kill();
      output += `\n${RED}  ⏰ CHECK ${check.id} timed out after ${TIMEOUT_MS / 1000}s${NC}\n`;
      resolve({ ...check, exitCode: 1, output });
    }, TIMEOUT_MS);

    proc.on('error', err => {
      clearTimeout(timer);
      output += `\n${RED}  ❌ Spawn error [${check.id}]: ${err.message}${NC}\n`;
      resolve({ ...check, exitCode: 1, output });
    });

    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ ...check, exitCode: code ?? 0, output });
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const total = threads.length + processes.length;

  if (total === 0) {
    console.log(`${GREEN}  ✅ No Phase 1 checks triggered${NC}`);
    process.exit(0);
  }

  console.log(
    `${YELLOW}⚡ ${total} checks running in parallel` +
    ` (${threads.length} threads + ${processes.length} processes)...${NC}`
  );

  const results = await Promise.all([
    ...threads.map(runThread),
    ...processes.map(runProcess),
  ]);

  let failed = false;
  for (const r of results) {
    const out = r.output;
    if (out && out.trim()) {
      process.stdout.write(out.endsWith('\n') ? out : out + '\n');
    }
    if (r.exitCode !== 0) {
      failed = true;
      process.stdout.write(`${RED}  ⛔ CHECK ${r.id} (${r.name}) exited ${r.exitCode}${NC}\n`);
    }
  }

  if (failed) {
    process.exit(1);
  } else {
    console.log(`${GREEN}  ✅ All ${total} parallel checks passed${NC}`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`${RED}Orchestrator fatal error: ${err.message}${NC}`);
  process.exit(1);
});
