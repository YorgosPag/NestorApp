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
 *   SKIP_I18N_TYPES                '1' = bypass CHECK 3.33 (generated-types freshness)
 *   SKIP_I18N_SHELL_SLICE          '1' = bypass CHECK 3.34 (i18n shell-slice freshness)
 *   SKIP_I18N_NAMESPACE_WIRING     '1' = bypass CHECK 3.36 (i18n namespace reachability)
 *   SKIP_CI_TIER_COVERAGE          '1' = bypass CHECK 3.37 (CI gate tier coverage)
 *   SKIP_ADDRESS_VOCABULARY        '1' = bypass CHECK 3.44 (address vocabulary coverage)
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
