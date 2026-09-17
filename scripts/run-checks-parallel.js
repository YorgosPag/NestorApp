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
 *   SKIP_PRERENDER_BAILOUT                                  bypass CHECK 3.55
 *   SKIP_LISTING_CUSTODY                                    bypass CHECK 3.56
 *   SKIP_WORKSPACE_AUTHORITY                                bypass CHECK 3.58
 *   SKIP_AUTHORITY_REGISTRY                                 bypass CHECK 3.68
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
const addedFiles          = parseList(process.env.STAGED_ADDED_FILES);
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
  // CHECK 3.55 (ADR-785) — προαποδοσιμότητα. Το `docker-build.yml` (Tier 1) ήταν κόκκινο ΟΚΤΩ
  // ΜΕΡΕΣ επειδή μια σελίδα καλούσε `useSearchParams()` χωρίς όριο `<Suspense>`: το `next build`
  // σταματά στον ΠΡΩΤΟ παραβάτη, άρα δεν μπορεί καν να πει πόσοι είναι. Ο μόνος άλλος ανιχνευτής
  // στο οικοσύστημα του Next είναι το ίδιο το build (21 κανόνες eslint, κανένας γι' αυτό).
  // Η σκανδάλη ζει ΜΕΣΑ στην πύλη — η ανάλυση είναι πάντα ΠΛΗΡΗΣ όταν πυροδοτεί (~8s),
  // γιατί το ερώτημα αφορά την κλειστότητα απόδοσης, όχι ένα αρχείο. ZERO-TOL, καμία baseline.
  if (!process.env.SKIP_PRERENDER_BAILOUT)
    addThread('3.55', 'Prerender integrity',    'scripts/check-prerender-bailout.js',          tsFiles);
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

// CHECK 3.57 (ADR-788) — «χτίζουν ΟΛΟΙ τον ίδιο server;». Δύο workflows γράφουν κατά λέξη
// «Any workflow calling build:ci MUST set NODE_OPTIONS itself»· ένα τρίτο το αγνόησε και
// έχτιζε με **1 από τις 20** μεταβλητές — πέθαινε σε OOM στα ~4,1 GB, και ο ΧΡΗΣΜΟΣ του
// CHECK 3.51 δεν έτρεξε ΟΥΤΕ ΜΙΑ φορά επί 13 ημέρες. Το σχόλιο μέσα στο τρίτο έλεγε ότι
// έλειπε «μία γραμμή env»: η περιγραφή της διόρθωσης ΗΤΑΝ η απόκλιση. Ένα anchor χωρίς
// gate είναι σχόλιο (3.36). Ίδια σκανδάλη με το 3.37 — και τα δύο ρωτούν για workflows,
// αλλά ΑΛΛΟ ερώτημα: εκείνο «ποιος παρακολουθείται;», αυτό «τι χτίζεται;».
// ΔΕΝ είναι ratchet — καμία baseline, ποτέ: ένα build με λάθος περιβάλλον αρκεί.
// ⚠️ Η σκανδάλη ΔΕΝ είναι η ίδια με του 3.37: πρέπει να περιλαμβάνει και τις ΤΟΠΙΚΕΣ
// σύνθετες ενέργειες (εκεί μπορεί να κρυφτεί build) και τον ΚΩΔΙΚΑ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΠΥΛΗΣ —
// αλλιώς μια αλλαγή στο κριτήριο περνά χωρίς να ασκηθεί το κριτήριο.
const buildParityTriggers = allFiles.filter(
  f => f.startsWith('.github/workflows/')
    || f.startsWith('.github/actions/')
    || f === '.ci-gate-tiers.json'
    || f.startsWith('scripts/lib/ci/')
    || f.startsWith('scripts/lib/build-parity/')
    || f === 'scripts/check-production-build-parity.js'
);
if (!process.env.SKIP_BUILD_PARITY && buildParityTriggers.length > 0)
  addThread('3.57', 'Production build parity', 'scripts/check-production-build-parity.js');

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

// CHECK 3.78 (ADR-855 Α5) — «δηλώνει αυτή η διαδρομή όριο, και συμφωνεί η δήλωση με ό,τι
// επιβάλλεται;». Το `options.category` των επτά wrappers ΔΕΝ διαβαζόταν ποτέ: η κατηγορία
// έβγαινε αποκλειστικά από 9 γραμμές προθεμάτων για 449 διαδρομές, και ΤΕΣΣΕΡΑ έγγραφα
// υπόσχονταν όρια που ο κώδικας δεν επέβαλλε. Η Φ1 διόρθωσε τη μηχανή· αυτή η πύλη φυλά το
// ΕΡΩΤΗΜΑ, ώστε η επόμενη σιωπηλή διαδρομή — ή ο επόμενος πίνακας που αποκλίνει από τις
// δηλώσεις — να μη προσγειωθεί.
// Σκανδάλη: ΟΠΟΙΑΔΗΠΟΤΕ διαδρομή, ο πίνακας, ή ο κώδικας της ίδιας της πύλης (αλλιώς αλλαγή
// κριτηρίου περνά χωρίς να δοκιμαστεί ποτέ — μάθημα 3.43 · 3.57 · 3.75).
// Κόστος: ένα πέρασμα 449 `readFileSync` + 2 parse, μηδέν spawn ⇒ Φάση 1 δίπλα στα 3.33/3.34.
if (!process.env.SKIP_RATE_LIMIT_POLICY) {
  // 🔴 **Η ΜΗΧΑΝΗ ΠΟΥ ΚΡΙΝΕΤΑΙ ΕΛΕΙΠΕ ΑΠΟ ΤΗ ΣΚΑΝΔΑΛΗ** (διορθώθηκε 2026-09-12, ADR-855 Φ8).
  //    Η λίστα είχε τις διαδρομές, τον πίνακα και τον κώδικα **της πύλης** — αλλά **όχι** το
  //    `with-rate-limit.ts`/`rate-limiter.ts`, δηλαδή τον κώδικα που **επιβάλλει** το όριο.
  //    ⇒ Αφαίρεση του τρίτου ορίσματος του `checkRateLimit` — **ακριβώς** το ελάττωμα Α1 που
  //    γέννησε αυτό το ADR — θα περνούσε **χωρίς να τρέξει η πύλη**. Το σχόλιο παρακάτω
  //    επικαλούνταν το μάθημα 3.43/3.57/3.75 και το εφάρμοζε **μισό**.
  const ratePolicyTriggers = allFiles.filter(f =>
    /^src\/app\/api\/.*route\.ts$/.test(f)
    || f === 'src/lib/middleware/rate-limit-config.ts'
    || f === 'src/lib/middleware/with-rate-limit.ts'
    || f === 'src/lib/middleware/rate-limiter.ts'
    || f === 'src/lib/middleware/rate-limit-store.ts'
    || f.startsWith('scripts/lib/rate-limit-policy/')
    || f === 'scripts/check-rate-limit-policy.js');
  if (ratePolicyTriggers.length > 0)
    addThread('3.78', 'Rate-limit policy', 'scripts/check-rate-limit-policy.js');
}

// CHECK 3.79 (ADR-858) — «λύνουν ΔΥΟ αρχεία στο ίδιο specifier, και ξέρει κάποιος ποιο
// κερδίζει;». Ο φάκελος `dxf-viewer/debug/` είχε `index.ts` ΚΑΙ `index.tsx`· το webpack λύνει
// `.tsx` πριν `.ts` ⇒ το `index.ts` δεν φορτώθηκε ΠΟΤΕ, 52 καταναλωτές τραβούσαν όλο το debug
// UI, και ο κύκλος που γεννήθηκε έριξε την παραγωγή με TDZ σε σελίδα πωλήσεων.
// Σκανδάλη: ΠΡΟΣΘΗΚΗ/ΜΕΤΟΝΟΜΑΣΙΑ αρχείου (μόνο έτσι γεννιέται σκίαση) ή ο κώδικας της ίδιας
// της πύλης — αλλιώς αλλαγή κριτηρίου περνά χωρίς να δοκιμαστεί ποτέ (μάθημα 3.43·3.57·3.75).
// Κόστος: ~4,3s, ένα πέρασμα σε 16.788 αρχεία ⇒ ΔΕΝ μπαίνει σε κάθε commit επίτηδες.
if (!process.env.SKIP_SHADOWED_MODULES) {
  const shadowTriggers = addedFiles.filter(f => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f))
    .concat(allFiles.filter(f =>
      f === 'scripts/check-shadowed-modules.js'
      || f === '.shadowed-modules-baseline.json'
      || f.startsWith('scripts/lib/module-init/')));
  if (shadowTriggers.length > 0)
    addThread('3.79', 'Shadowed modules', 'scripts/check-shadowed-modules.js');
}

// CHECK 3.80 (ADR-858 Δ4) — «ΘΑ ΣΚΑΣΕΙ αυτός ο κύκλος;», όχι «υπάρχει κύκλος;».
// Το depcruise λέει 1159· αυτή η πύλη λέει 1, γιατί ρωτά αν κάποιο μέλος του κύκλου διαβάζει
// εισαγόμενο binding σε ΧΡΟΝΟ ΑΞΙΟΛΟΓΗΣΗΣ module — το μόνο που κάνει έναν κύκλο θανάσιμο.
// Ακριβώς αυτό έριξε την παραγωγή στις 2026-09-12 (TDZ σε σελίδα πωλήσεων).
//
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΕΙΝΑΙ ΣΤΕΝΗ ΕΠΙΤΗΔΕΣ — κοστίζει ~14,6s σε 12.666 αρχεία, δεν έχει θέση σε
// κάθε commit. Πυροδοτεί σε `index.*` (τα barrels είναι η ΓΕΝΝΗΤΡΙΑ των κύκλων: ένα barrel
// συνδέει ό,τι επανεξάγει με ό,τι το εισάγει) και στον κώδικα της ίδιας της πύλης — αλλιώς
// αλλαγή κριτηρίου περνά χωρίς να δοκιμαστεί ποτέ (μάθημα 3.43 · 3.57 · 3.75).
//
// 🔶 ΔΗΛΩΜΕΝΟ ΚΕΝΟ: ένα top-level `const` που προστίθεται σε αρχείο ΧΩΡΙΣ να αγγίξει barrel
// δεν πυροδοτεί εδώ. Αυτό είναι ρητή ανταλλαγή κόστους/κάλυψης, όχι παράβλεψη.
if (!process.env.SKIP_MODULE_INIT) {
  const moduleInitTriggers = allFiles.filter(f =>
    /(^|\/)index\.(ts|tsx|js|jsx|mjs)$/.test(f)
    || f === 'scripts/check-module-init.js'
    || f === '.module-init-baseline.json'
    || f.startsWith('scripts/lib/module-init/'));
  if (moduleInitTriggers.length > 0)
    addThread('3.80', 'Deadly import cycles', 'scripts/check-module-init.js');
}

// CHECK 3.53 — ταυτότητα ενοτήτων ADR (ADR-739 §0.3 / ADR-777 §0.4).
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ (`triggers()`): μια ενότητα μπορεί να μετακομίσει σε
// οποιοδήποτε ADR/SPEC, άρα λίστα μονοπατιών εδώ θα απέκλινε σιωπηλά (σχήμα 3.34/3.37).
if (!process.env.SKIP_ADR_SECTION_REFS && allFiles.length > 0)
  addThread('3.53', 'ADR section refs', 'scripts/check-adr-section-refs.js', allFiles);

// CHECK 3.56 (ADR-777 §8.42) — «αποφασίζει κάποιος ΠΟΙΟΣ ΔΙΑΧΕΙΡΙΖΕΤΑΙ μια αγγελία έξω
// από το SSoT;». Το §8.39 ένωσε την ερώτηση σε `lib/owner-property/listing-custody.ts` και
// ΔΕΝ ΑΦΗΣΕ ΦΡΟΥΡΟ ΠΙΣΩ ΤΗΣ: το §8.42 βρήκε ΤΡΙΤΗ υλοποίηση (`place-interest.service.ts`),
// που έκρινε `authorUserId !== uid` πάνω σε πόρο που μπορεί να ζει σε ΕΤΑΙΡΙΚΟ χώρο ⇒
// αγγελία του γραφείου ήταν `absent` για κάθε άλλον υπάλληλό του.
// 🔑 ΞΕΧΩΡΙΣΤΗ ΑΠΟ ΤΗΝ 3.35, ΚΑΙ ΤΟ ΛΕΕΙ ΤΟ ΙΔΙΟ ΤΟ SSoT: εκείνη ρωτά ΑΠΟΜΟΝΩΣΗ («ποιος
// ΒΛΕΠΕΙ;»), αυτή ΕΞΟΥΣΙΟΔΟΤΗΣΗ («ποιος ΔΙΑΧΕΙΡΙΖΕΤΑΙ;»). Ένωση θα ανέφερε αποτυχία
// θεματοφυλακής ως αποτυχία tenant scope (το λάθος που απορρίπτει ρητά το ADR-775).
// ⚠️ ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ: 8 από τις 10 εμφανίσεις στο δέντρο ΕΙΝΑΙ σχόλια που τεκμηριώνουν
// τη βλάβη — πύλη χωρίς `stripComments` κοκκινίζει πάνω στην τεκμηρίωση της θεραπείας (3.50).
// ⚠️ ZERO-TOL, ΚΑΜΙΑ baseline: δεν υπάρχει «λιγότερες αυθεντίες εξουσιοδότησης από χθες».
if (!process.env.SKIP_LISTING_CUSTODY && allFiles.length > 0)
  addThread('3.56', 'Listing custody', 'scripts/check-listing-custody.js', allFiles);

// CHECK 3.58 (ADR-787 §5.2) — «ποιος αποφασίζει ότι επιτρέπεσαι σε ΞΕΝΟ χώρο, και ρώτησε
// τον κριτή;». Η Φάση 1 (Κ-2) έδωσε τον απαντητή του «είναι μέλος;» και έκλεισε ΕΝΑ κανάλι
// (την κεφαλίδα HTTP). Η μέτρηση της 22/08 βρήκε ΔΕΥΤΕΡΟ, ζωντανό, ΜΕ ΔΕΔΟΜΕΝΑ ΣΤΗ ΒΑΣΗ:
// ο Telegram adapter δρομολογούσε στο `users/{uid}.activeCompanyId` — πεδίο που ΓΡΑΦΕΙ ο
// φυλλομετρητής και που τα `firestore.rules` επιτρέπουν σε κάθε χρήστη ΧΩΡΙΣ field allowlist
// ⇒ *confused deputy* με την τεχνική σημασία του όρου.
// 🔑 ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ ΤΟ ΚΑΝΑΛΙ, ΟΧΙ ΤΟ ΟΝΟΜΑ: το ονοματολογικό μετρήθηκε σε >60% ψευδώς
// θετικά (`resolveWorkspaceLayout` του DXF dock, `decideEmailDelivery`, …) — πήχης <10%.
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ (`triggers()`): νέος αναγνώστης καναλιού προσγειώνεται
// σε ΟΠΟΙΟΔΗΠΟΤΕ αρχείο του `src/`, άρα λίστα μονοπατιών εδώ θα απέκλινε σιωπηλά (3.34/3.37).
// ⚠️ ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ: ZERO-TOL για το «κανάλι χωρίς κριτή» (ΔΕΝ μπαίνει ΠΟΤΕ σε baseline —
// το `buildPayload` ρίχνει) + RATCHET κατά ταυτότητα για την ομωνυμία.
if (!process.env.SKIP_WORKSPACE_AUTHORITY && allFiles.length > 0)
  addThread('3.58', 'Workspace authority', 'scripts/check-workspace-authority.js', allFiles);

// CHECK 3.59 — πύλη ενικού λεξιλογίου σημείου (ADR-792). «Δηλώνεται κάθε όνομα του
// λεξιλογίου σε ΑΚΡΙΒΩΣ ΕΝΑ αρχείο;» Μετρημένο 22/08: ΤΕΣΣΕΡΑ ζεύγη ομώνυμων τύπων με
// ασύμβατο συμβόλαιο (`Point3D` 216 vs 49 · `Polygon3D` 54 vs 56 — αντικείμενο έναντι
// σκέτου πίνακα · `Polyline3D` 13 vs 14 · `BoundingBox3D` 45 vs 1) και ΕΞΙ `Point2D`.
// ⚠️ ΤΟ ΚΟΙΝΟ ΟΝΟΜΑ ΤΥΦΛΩΝΕΙ ΤΟ CHECK 3.30: `OWNER_SAMPLE = 8` ⇒ overflow ⇒ κάδος
// `suspect`, που το ratchet δεν μετρά. Απόδειξη: το `precision-positioning.ts` είχε 4/5
// exports στη baseline του 3.30 — έλειπε ακριβώς το `Point2D`.
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ: ένας δεύτερος ορισμός προσγειώνεται σε ΟΠΟΙΟΔΗΠΟΤΕ
// αρχείο του `src/`, άρα λίστα μονοπατιών εδώ θα απέκλινε σιωπηλά (3.34/3.37).
// ⚠️ ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ: ZERO-TOL για αδήλωτη ρίζα + ορφανή δήλωση (ΔΕΝ μπαίνουν ΠΟΤΕ σε
// baseline — το `buildPayload` ρίχνει) + RATCHET κατά ταυτότητα για το κοινό όνομα.
if (!process.env.SKIP_POINT_VOCABULARY && allFiles.length > 0)
  addThread('3.59', 'Point vocabulary', 'scripts/check-point-vocabulary.js', allFiles);

// CHECK 3.68 — ΠΥΛΗ ΤΗΣ ΑΡΧΗΣ ΤΗΣ ΕΞΟΥΣΙΟΔΟΤΗΣΗΣ (ADR-801 §4). «Αποφασίζει κάποιος
// "επιτρέπεται;" έξω από τον ΕΝΑ κριτή;» ⚠️ ΔΕΝ είναι το ερώτημα του 3.58: εκείνο ρωτά
// ποιος διαβάζει αναξιόπιστο ΚΑΝΑΛΙ ΧΩΡΟΥ (απομόνωση) — αυτό ποιος κρίνει ΙΚΑΝΟΤΗΤΑ.
// Μετρημένο 25/08: 20 αρχεία απαντούσαν μόνα τους, με ΕΠΤΑ σταθερές ονόματι ADMIN_ROLES /
// ADMIN_GLOBAL_ROLES και ΠΕΝΤΕ διαφορετικά περιεχόμενα· δύο έκριναν με λίστα email.
// 🏆 Ο Κ3 («μπορεί αυτός ο κλάδος να πυροδοτήσει ΠΟΤΕ;») είναι η πρωτοτυπία — κανένα
// εργαλείο της αγοράς δεν το ρωτά, και είναι ο κανόνας που θα είχε πιάσει τον πίνακα των
// 13 ρόλων ΤΗ ΜΕΡΑ ΠΟΥ ΓΡΑΦΤΗΚΕ (ADR-801 §2.2, 11 πράσινα tests από πάνω).
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ: νέος κριτής προσγειώνεται σε ΟΠΟΙΟΔΗΠΟΤΕ αρχείο του
// src/, άρα λίστα μονοπατιών εδώ θα απέκλινε σιωπηλά (3.34/3.37).
// ⚠️ ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ: RATCHET κατά ταυτότητα για τους inline κριτές (14 ζωντανοί ⇒ zero-tol
// θα ήταν μονίμως κόκκινο, 3.39) + ZERO-TOL για φαντάσματα/ορφανές δηλώσεις, που ΔΕΝ
// μπαίνουν ΠΟΤΕ σε baseline (το buildPayload ρίχνει).
if (!process.env.SKIP_AUTHORITY_REGISTRY && allFiles.length > 0)
  addThread('3.68', 'Authority registry', 'scripts/check-authority-registry.js', allFiles);

// CHECK 3.62 — ΠΥΛΗ ΔΗΜΟΣΙΑΣ ΕΠΙΦΑΝΕΙΑΣ (ADR-796). «Ζητά κάποιος από ΕΞΩ ένα σύμβολο
// του dxf-viewer που κανείς δεν δήλωσε δημόσιο;»
// 🔴 ΑΝΤΙΚΑΘΙΣΤΑ τον κανόνα `not-to-dxf-internals` του `.dependency-cruiser.cjs`, που
// επέβαλλε barrel `src/subapps/dxf-viewer/index.ts` ΠΟΥ ΔΕΝ ΥΠΗΡΞΕ ΠΟΤΕ (`git log --all`
// κενό): 163 αρχεία εισάγουν βαθιά, 0 μέσω barrel, και η ΙΔΙΑ η σελίδα της εφαρμογής
// παραβιάζει. Φρουρός ΕΝΕΡΓΟΣ (baseline 335, DOWN-only) με ΑΝΥΠΑΡΚΤΗ θεραπεία —
// χειρότερο από τους 606 αδρανείς του ADR-749 §5, γιατί εκείνοι δεν πυροδοτούν καν.
// 🏆 ΓΙΑΤΙ ΟΧΙ BARREL: το Atlassian ΑΦΑΙΡΕΣΕ τα barrels από το Jira (90.000 αρχεία) και
// μέτρησε 75% ταχύτερα builds — και ΠΑΡΑΔΕΧΤΗΚΕ ότι έτσι έχασε την ενθυλάκωση. Εδώ η
// ενθυλάκωση γίνεται ΔΕΔΟΜΕΝΟ (.dxf-viewer-public-api.json) αντί για MODULE: μηδέν
// κόμβος στον γράφο εισαγωγών ⇒ το όφελος του Atlassian ΚΑΙ η εγγύηση του Revit,
// ανά ΣΥΜΒΟΛΟ — αυστηρότερο από το `package.json exports`, που κρίνει μονοπάτια.
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ: νέος καταναλωτής προσγειώνεται σε ΟΠΟΙΟΔΗΠΟΤΕ
// αρχείο του src/, άρα λίστα μονοπατιών εδώ θα ήταν δεύτερη αυθεντία (3.34: 63).
if (!process.env.SKIP_PUBLIC_SURFACE && allFiles.length > 0)
  addThread('3.62', 'Public surface', 'scripts/check-public-surface.js', allFiles);

// CHECK 3.60 — πύλη εμβέλειας χώρου (ADR-787 §5.3 γ). «Ζει αυτή η σελίδα πίσω από το
// πρόθεμα χώρου — και αν όχι, το είπε κάποιος με λόγο;»
// 🔑 Η ΠΡΟΕΠΙΛΟΓΗ ΕΙΝΑΙ «ΜΠΑΙΝΕΙ», ΚΑΙ Η ΚΑΤΕΥΘΥΝΣΗ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ: δύο κριτήρια για
// την ευθεία («ποια σελίδα ανήκει σε χώρο;») μετρήθηκαν και έπεσαν — «ο φάκελος αναφέρει
// companyId» ⇒ >60% ψευδώς θετικά (κατήγγελλε τα projects·contacts·crm), και «η κλειστότητα
// αγγίζει tenant-scoped συλλογή» ⇒ maxClosure 4030 = ΤΟ ΤΑΒΑΝΙ, δηλαδή μετρά μέγεθος και όχι
// σχέση (η ίδια βλάβη που το ADR-781 μέτρησε σε 99,88%). Κρατήθηκε η ΑΝΤΙΣΤΡΟΦΗ, με το
// πρότυπο του `tenant-config.ts:22`: κλειστό σύνολο ΕΞΑΙΡΕΣΕΩΝ με υποχρεωτικό λόγο.
// ⚠️ ΔΕΝ είναι η απαγορευμένη «χειρόγραφη λίστα διαδρομών» — είναι η fail-closed
// κατεύθυνσή της: νέα διαδρομή παίρνει πρόθεμα ΑΥΤΟΜΑΤΑ· ξεχασμένη εξαίρεση είναι ΟΡΑΤΗ
// στην οθόνη, όχι σιωπηλή διαρροή εκτός χώρου.
// ⚠️ ΤΟ ΠΡΟΘΕΜΑ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΟ TS SSoT (`workspace-path.ts`) — ποτέ αντιγραμμένο, και
// άρνηση σε αποτυχία ανάγνωσης: ένα `?? 'o'` θα έκανε την πύλη πράσινη πάνω σε δέντρο που
// δεν κοίταξε (ίδια κίνηση με το 3.42, που ρωτά το ίδιο το Tailwind).
// ⚠️ ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ: ZERO-TOL για ορφανή δήλωση (ΔΕΝ μπαίνει ΠΟΤΕ σε baseline — το
// `buildPayload` ρίχνει) + RATCHET κατά ταυτότητα για τις σελίδες που δεν έχουν μετακινηθεί
// ακόμη. ⚠️ Ο αριθμός ΔΕΝ είναι δείκτης υγείας: είναι το μέτρο μιας εκστρατείας που
// τελειώνει στο μηδέν.
if (!process.env.SKIP_WORKSPACE_SCOPE && allFiles.length > 0)
  addThread('3.60', 'Workspace scope', 'scripts/check-workspace-scope.js', allFiles);

// CHECK 3.61 — πύλη του συνόρου πλοήγησης (ADR-787 §5.3 ν). «Ζητά αυτό το αρχείο την πλοήγηση
// από το ΣΥΝΟΡΟ;» — το επόμενο ερώτημα μετά τη μετανάστευση των 128 αρχείων. ⛔ ZERO-TOLERANCE,
// και είναι ΜΕΤΡΗΜΕΝΟ: το Γ2 καθάρισε το πεδίο ⇒ μηδέν παραβιάσεις σήμερα (πρότυπο 3.48/3.55).
// ⚠️ ΚΑΜΙΑ baseline, ποτέ: δεν έχει νόημα «λιγότερες παρακάμψεις από χθες» — ΜΙΑ αρκεί για να
// γεννηθεί σιωπηλό 404, γιατί το ωμό `prefetch` προφορτώνει λάθος διεύθυνση ΧΩΡΙΣ ΙΧΝΟΣ.
// ⚠️ Η σκανδάλη ζει ΜΕΣΑ στην πύλη και αποφασίζει ΑΝ τρέχει, ποτέ ΠΟΣΟ σαρώνει: όταν πυροδοτεί,
// σαρώνει ΟΛΟ το δέντρο (~4,5s· ~0,7s όταν δεν αφορά).
if (!process.env.SKIP_NAVIGATION_BOUNDARY && allFiles.length > 0)
  addThread('3.61', 'Navigation boundary', 'scripts/check-navigation-boundary.js', allFiles);

// CHECK 3.63 — ΠΥΛΗ ΤΟΥ ΔΙΑΔΡΟΜΟΥ ΤΟΥ ΚΕΛΥΦΟΥΣ (ADR-797). «Δηλώνει κάποιος κενό που ΔΕΝ
// του ανήκει, και ξέρει κάποιος ποιες σελίδες βγήκαν από τον διάδρομο;»
// 🔴 Η ΑΙΤΙΑ ΗΤΑΝ ΟΤΙ ΔΕΝ ΥΠΗΡΧΕ ΙΔΙΟΚΤΗΤΗΣ: μετρημένο πριν γραφτεί γραμμή, **86 από τις
// 104** σελίδες του χώρου δεν δήλωναν ΚΑΝΕΝΑ οριζόντιο κενό, και η αλυσίδα του κελύφους
// (`shellAppContainer` → `SidebarInset` → `MainContentBridge`) δήλωνε ΜΗΔΕΝ σε ΚΑΘΕ κρίκο
// ⇒ το περιεχόμενο ακουμπούσε την μπάρα. Το κενό ήταν ανάθεση σε κάθε σελίδα ξεχωριστά —
// το σχήμα που εδώ έχει αποτύχει μετρημένα (3.34: 63 · 3.37: 18 vs 26 · 3.49: 60 · 3.57: 19/20).
// 🏆 ΞΕΠΕΡΝΑ M3/Utopia/Carbon: εκείνα μετρούν το ΠΑΡΑΘΥΡΟ. Η μπάρα εδώ διπλώνει 16rem→3rem,
// δηλαδή **208px** αλλαγή διαθέσιμου πλάτους ΜΕ ΤΟ ΠΑΡΑΘΥΡΟ ΑΚΙΝΗΤΟ ⇒ window-size-class δίνει
// την ΙΔΙΑ απάντηση σε ΔΥΟ διαφορετικές επιφάνειες. Ο διάδρομος μετριέται στο PANE, ρευστά.
// ⚠️ ΟΧΙ container query: το `container-type` δημιουργεί stacking context ⇒ θα εγκλώβιζε ΟΛΕΣ
// τις επιφάνειες ≥1000 που το ADR-780 Φ.Γ μέτρησε στο ROOT — σιωπηλά, χωρίς να κοκκινίσει τίποτα.
// ⚠️ ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ: ⛔ ZERO-TOL (ο ιδιοκτήτης δεν γίνεται διάδικος · κλειστό σύνολο bleed —
// ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline, το `buildPayload` ρίχνει) + 🔴 RATCHET κατά ταυτότητα για
// τις σελίδες που κρατούν δικό τους κενό. Ο αριθμός ΔΕΝ είναι δείκτης υγείας — είναι
// εκστρατεία που τελειώνει στο μηδέν.
// ⚠️ ΚΑΜΙΑ σκανδάλη, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ: το πλήρες κοστίζει ~0,3s. Όταν το πλήρες είναι φθηνό,
// η μερική ανάλυση δεν είναι βελτιστοποίηση — είναι δεύτερη αυθεντία, χωρίς αντάλλαγμα.
if (!process.env.SKIP_SHELL_SURFACE && allFiles.length > 0)
  addThread('3.63', 'Shell surface', 'scripts/check-shell-surface.js', allFiles);
  addThread('3.72', 'Shell utilities', 'scripts/check-shell-utilities.js', allFiles);

// CHECK 3.65 — ΠΥΛΗ ΤΗΣ ΜΙΑΣ ΕΚΔΟΣΗΣ (ADR-800). «Υπάρχει ΕΝΑ σημείο δήλωσης και ΜΙΑ
// εγκατεστημένη έκδοση για κάθε όνομα πακέτου μέσα στο workspace;»
// 🔴 ΤΟ ΓΕΓΟΝΟΣ: το `src/subapps/dxf-viewer/package.json` δήλωνε jest@29 + jsdom@24 ενώ η
// ρίζα τρέχει jest@30 + jsdom@27, ΚΑΙ είχε script `"test": "jest"` ⇒ όποιος έτρεχε δοκιμές
// από μέσα έπαιρνε ΑΛΛΗ ΜΗΧΑΝΗ από το CI (σχήμα ADR-749 σε επίπεδο εργαλείου δοκιμών) —
// εκεί κρυβόταν και η δεύτερη, αόρατη διαδρομή προς το ευάλωτο `tar`.
// 🔑 ΔΥΟ ΠΗΓΕΣ, ΔΥΟ ΕΡΩΤΗΜΑΤΑ, ΠΟΤΕ ΕΝΑ ΜΕ «Ή» (3.41): Κ1 από τα MANIFESTS = η αιτία
// (διπλή δήλωση)· Κ2 από το LOCKFILE = το αποτέλεσμα (διχασμένη επίλυση). Ανεξάρτητα,
// αποδεδειγμένα με ζωντανά δεδομένα: `react` → Κ1 🔴 / Κ2 ✅ · `jest` → και τα δύο 🔴.
// 🏆 ΞΕΠΕΡΝΑ syncpack/pnpm-catalog-lint (κρίνουν ΔΗΛΩΣΕΙΣ — τυφλά στο ότι μια δήλωση μπορεί
// να είναι ΨΕΜΑ: το subapp δήλωνε react ^18.3.1 και έτρεχε 19.2.1) και το
// check-pnpm-duplicates (κρίνει ΟΛΟΝ τον γράφο — άλλο ερώτημα). Και η πολιτική ΠΑΡΑΓΕΤΑΙ
// από το ίδιο το manifest: διανεμητέο πακέτο ΟΦΕΙΛΕΙ να δηλώνει ό,τι εισάγει· εσωτερικό ΟΧΙ.
// ⚠️ Ο κατάλογος (`catalog:`) απορρίφθηκε ΜΕ ΜΕΤΡΗΣΗ: υπήρχε με 12 εγγραφές, 0 αναφορές,
// 6/12 λάθος τιμές, και το `catalogMode: strict` θέλει pnpm ≥10.12.1 (εδώ 9.14.0).
// ⚠️ ΔΕΝ είναι ratchet — καμία baseline, ποτέ. Δεν υπάρχει «λιγότερες μηχανές δοκιμών από χθες».
if (!process.env.SKIP_ONE_VERSION && allFiles.length > 0)
  addThread('3.65', 'One version', 'scripts/check-one-version.js', allFiles);

// CHECK 3.66 — ΠΥΛΗ ΤΟΥ ΜΗΤΡΩΟΥ ΠΥΛΩΝ (ADR-802). «Είναι κάθε πύλη που ΤΡΕΧΕΙ γραμμένη στο
// CLAUDE.md, και κάθε γραμμή του CLAUDE.md πύλη που ΤΡΕΧΕΙ;»
// 🔴 ΓΙΑΤΙ: μετρημένο 25/08 — ΤΡΕΙΣ λίστες, ΤΡΕΙΣ αριθμοί για το ίδιο δέντρο (εκτελεστής+hook
// 60 · CLAUDE.md 47 γραμμές · precommit-checks.md 33 ενότητες). Το CHECK 3.62 έτρεχε και
// ΜΠΛΟΚΑΡΕ commits χωρίς ΚΑΜΙΑ γραμμή πουθενά: ο πράκτορας που το συναντούσε δεν είχε πού να
// διαβάσει τι είναι. Ίδιο σχήμα «δύο λίστες που αποκλίνουν» με 3.34 (63) · 3.37 (18 vs 26) ·
// 3.49 (60) · 3.57 (19/20) — κάθε φορά η θεραπεία ήταν ΠΥΛΗ, ποτέ «να θυμάται ο επόμενος».
// 🔑 Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ Η ΕΝΩΣΗ, ΚΑΙ ΟΙ ΜΟΡΦΕΣ ΔΡΟΜΟΛΟΓΗΣΗΣ ΔΥΟ: κριτήριο καρφωμένο στο
// `addThread` μετρήθηκε ζωντανά και κατήγγελλε τα 3.9/3.10 (που δρομολογούνται με `addBash`)
// ως φαντάσματα — 2 ψευδώς θετικά στα 3. Το μοτίβο είναι πλέον αγνωστικό ως προς τη μορφή,
// και ο hook διαβάζεται ΞΕΧΩΡΙΣΤΑ (οι φάσεις 0/0.5/0.6 δεν περνούν από τον δρομολογητή).
// ⚠️ Το «μόνο σε πρόζα» ΔΕΝ είναι παραβίαση: τα 3.7/3.18/3.28 ζουν μέσα στους κανόνες N.12
// και N.18, που είναι η ΣΩΣΤΗ τους θέση — απαίτηση για γραμμή θα ήταν απαίτηση διπλότυπου.
// ⚠️ ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ: 🔴 RATCHET κατά ΤΑΥΤΟΤΗΤΑ για τις αδήλωτες (με αριθμό, η ανταλλαγή
// «τεκμηρίωσα το Α, πρόσθεσα αδήλωτο το Β» θα περνούσε αθόρυβα — ADR-749) · ⛔ ZERO-TOL για
// φαντάσματα και λάθος δηλώσεις, που ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline (το buildPayload ρίχνει).
// ⚠️ ΚΑΜΙΑ ΣΚΑΝΔΑΛΗ ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ: το πλήρες κοστίζει ~40ms (4 αρχεία, 4 regex). Όταν το
// πλήρες είναι φθηνό, η μερική ανάλυση δεν είναι βελτιστοποίηση — είναι δεύτερη αυθεντία.
if (!process.env.SKIP_GATE_INVENTORY)
  addThread('3.66', 'Gate inventory', 'scripts/check-gate-inventory.js', allFiles);

// CHECK 3.67 — ΠΥΛΗ ΤΗΣ ΥΠΟΣΧΕΣΗΣ ΓΡΑΜΜΑΤΟΣΕΙΡΑΣ (ADR-803). «Υπόσχεται ο πίνακας
// υποκατάστασης όψη που ΔΕΝ φορτώνεται ΠΟΤΕ;»
// 🔴 ΜΕΤΡΗΜΕΝΟ 25/08: ο FONT_SUBSTITUTION_TABLE υπόσχεται 5 οικογένειες, το
// CAD_SUBSTITUTE_FONTS φορτώνει 1 — 4 στις 5 ανεκπλήρωτες, ανάμεσά τους το
// `romand.shx → «Liberation Sans Bold»` (η ΕΝΤΟΝΗ γραφή του πιο κοινού CAD κειμένου) και
// το `isocpeur → «ISO 3098»` (τυπική γραμματοσειρά μηχανολογικού σχεδίου).
// 🔑 Η ΥΠΟΚΑΤΑΣΤΑΣΗ ΕΙΝΑΙ ΑΛΥΣΙΔΑ ΔΥΟ ΒΗΜΑΤΩΝ ΚΑΙ ΜΟΝΟ ΤΟ ΠΡΩΤΟ ΑΝΑΦΕΡΕΤΑΙ: το βήμα
// «SHX → υποκατάστατο» το δείχνει ο MissingFontBanner· το βήμα «υποκατάστατο → εφεδρική
// του browser» είναι ΣΙΩΠΗΛΟ (resolveEntityFont → null → CSS).
// 🏆 ΤΟ AutoCAD ΕΙΔΟΠΟΙΕΙ («Missing SHX Files») και το acad.fmp δείχνει σε γραμματοσειρές
// ΠΟΥ ΥΠΑΡΧΟΥΝ· το Revit ΔΕΝ ειδοποιεί και είναι τεκμηριωμένο παράπονο χρηστών. Άρα ο
// πήχης είναι «AutoCAD». ⚠️ ΚΑΙ ΕΝΑ ΣΚΑΛΙ ΠΑΝΩ: εκείνο ελέγχει στο ΑΝΟΙΓΜΑ του σχεδίου —
// αφού το λάθος έφυγε στον χρήστη· εδώ ελέγχεται στο COMMIT, και επιπλέον επαληθεύεται ότι
// το ΑΡΧΕΙΟ κάθε φορτωμένης όψης υπάρχει όντως (⛔ unloadable-preload) — ερώτημα που κανένα
// CAD δεν μπορεί καν να θέσει, γιατί οι όψεις του είναι του συστήματος.
// ⚠️ ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ: 🔴 RATCHET κατά ΤΑΥΤΟΤΗΤΑ (εκστρατεία που τελειώνει στο μηδέν) ·
// ⛔ ZERO-TOL για αρχείο που λείπει και λάθος δηλώσεις, που ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline.
// ⚠️ Ο αριθμός 4 ΔΕΝ είναι δείκτης υγείας — η θεραπεία είναι να ΜΠΕΙ η όψη.
if (!process.env.SKIP_FONT_PROMISE)
  addThread('3.67', 'Font promise', 'scripts/check-font-promise.js', allFiles);

// CHECK 3.69 — ΠΥΛΗ ΤΟΥ ΜΗΤΡΩΟΥ ΓΡΑΜΜΑΤΟΣΕΙΡΩΝ (ADR-805). «Έχει κάθε δυαδικό γραμματοσειράς
// που ΔΙΑΝΕΜΟΥΜΕ δηλωμένη, επιτρεπόμενη άδεια — και το επιβεβαιώνει το ΙΔΙΟ ΤΟ ΑΡΧΕΙΟ;»
// 🔴 ΤΟ ΤΥΦΛΟ ΣΗΜΕΙΟ, ΜΕΤΡΗΜΕΝΟ 25/08: ο license gate (ADR-598 G13) κρίνει ΠΑΚΕΤΑ (τότε
// `license-checker`, από 16/09 `pnpm licenses list --prod`). Ένα .ttf μέσα στο public/ ΔΕΝ είναι πακέτο ⇒ ΔΟΜΙΚΑ ΑΟΡΑΤΟ.
// Το έργο διένειμε ΤΡΙΑ σύνολα bytes γραμματοσειράς με ΜΗΔΕΝΙΚΗ δηλωμένη άδεια και κανένα
// αρχείο απόδοσης — ένα από αυτά (687 KB base64) ΕΝΣΩΜΑΤΩΝΕΤΑΙ σε ΚΑΘΕ PDF πελάτη.
// 🔑 Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ ΤΟ ΑΡΧΕΙΟ, ΟΧΙ Η ΔΗΛΩΣΗ: το `name` table κρατά copyright (ID 0),
// άδεια (ID 13) και licenseURL (ID 14) — επαληθεύτηκε σε 7 από 7 αρχεία. Το base64 module
// ΑΠΟΚΩΔΙΚΟΠΟΙΕΙΤΑΙ και κρίνεται με τον ΙΔΙΟ αναγνώστη. Απόκλιση δήλωσης ⇒ ⛔ license-drift.
// 🏆 AutoCAD/Revit/ArchiCAD/Figma ΔΕΝ επαληθεύουν τι φορτώνουν — και τους είναι εύκολο: οι
// όψεις τους είναι του ΣΥΣΤΗΜΑΤΟΣ, δεν τις ΔΙΑΝΕΜΟΥΝ. Εδώ τα bytes φεύγουν στον χρήστη.
// ⚠️ ΜΙΑ πολιτική αδειών: το .license-policy.json μέσω του ΙΔΙΟΥ decideLicense που κρίνει τα
// npm πακέτα (CHECK 12). Δεύτερη λίστα στο μητρώο θα ήταν ADR-749 σε μικρογραφία.
// ⚠️ ΚΑΜΙΑ ΣΚΑΝΔΑΛΗ ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ: το πλήρες κοστίζει ~2,9s (git grep + N opentype.parse).
// Πρόφιλτρο ΜΕΓΕΘΟΥΣ απορρίφθηκε αν και 2000× πιο επιλεκτικό: είναι ευρετικό, και μια μικρή
// υποσυνόλου γραμματοσειρά θα χανόταν ΣΙΩΠΗΛΑ.
if (!process.env.SKIP_FONT_ASSETS)
  addThread('3.69', 'Font assets', 'scripts/check-font-assets.js', allFiles);

// CHECK 3.70 — ΠΥΛΗ ΤΩΝ ΑΔΕΣΜΕΥΤΩΝ ΑΝΑΓΝΩΡΙΣΤΙΚΩΝ (ADR-808). «Αναφέρει αυτό το αρχείο όνομα
// που ΔΕΝ δηλώνεται, ΔΕΝ εισάγεται και ΔΕΝ είναι καθολικό;» → `ReferenceError` / «Cannot find name».
// 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΑΦΗΝΕΙ Ο N.17, ΚΑΙ ΤΟ ΟΙΚΟΣΥΣΤΗΜΑ ΤΟ ΔΗΛΩΝΕΙ ΓΡΑΠΤΩΣ: το typescript-eslint
// ΑΠΕΝΕΡΓΟΠΟΙΕΙ τον `no-undef` λέγοντας «το κάνει ο μεταγλωττιστής, και καλύτερα» — δηλαδή η
// μόνη απάντηση της βιομηχανίας είναι «τρέξε tsc». Εδώ ο tsc είναι ΑΠΑΓΟΡΕΥΜΕΝΟΣ (N.17) και
// το src/subapps/dxf-viewer είναι ΕΚΤΟΣ root tsconfig (3.29, baseline 381: ένα ΝΕΟ αδέσμευτο
// εκεί πνίγεται μέσα της). Άρα το ερώτημα ΔΕΝ ΤΟ ΑΠΑΝΤΑ ΚΑΝΕΙΣ.
// 🏆 ΞΕΠΕΡΝΑ ΤΟΝ ΚΑΝΟΝΑ ΠΟΥ ΑΠΟΡΡΙΦΘΗΚΕ: η τεκμηριωμένη αστοχία του `no-undef` είναι ότι
// διαβάζει ΡΥΘΜΙΣΗ ESLint αντί για τους τύπους (issue #2799: «eslint ignores @types»). Εδώ τα
// καθολικά ΠΑΡΑΓΟΝΤΑΙ από lib.*.d.ts + @types + εξαρτήσεις, με AST και τον ΠΡΑΓΜΑΤΙΚΟ κανόνα
// script-vs-module — 2.557 ακριβή ονόματα έναντι 19.576 της regex (υπερ-προσέγγιση 7,7×, που
// ΕΚΡΥΒΕ πραγματικά σφάλματα: με τη regex το `GeoPoint` ήταν ΑΟΡΑΤΟ).
// 🔑 ZERO-TOL ΕΠΕΙΔΗ ΜΕΤΡΗΘΗΚΕ: 10 → 0 σε 15.296 αρχεία. Καμία baseline ΠΟΤΕ — ΕΝΑ αρκεί
// (το `entity` του PropertiesPalette.tsx έριχνε την παλέτα σε ΚΑΘΕ F11, ζωντανά).
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ: σταδιοποιημένα (~0,05s όταν δεν αφορά), αλλά ΚΛΙΜΑΚΩΝΕΤΑΙ
// ΜΟΝΗ ΤΗΣ σε πλήρη σάρωση όταν σταδιοποιείται .d.ts/manifest — αλλιώς διαγραφή καθολικής
// δήλωσης σπάει αρχεία ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΕΣΤΕΙΛΕ. Layer 2 = `--all` άνευ όρων.
if (!process.env.SKIP_UNBOUND_IDENTIFIERS)
  addThread('3.70', 'Unbound identifiers', 'scripts/check-unbound-identifiers.js', []);

// CHECK 3.71 — ΠΥΛΗ ΤΩΝ ΔΙΠΛΩΝ ΚΛΕΙΔΙΩΝ LOCALE (ADR-810). «Δηλώνεται κλειδί ΔΥΟ ΦΟΡΕΣ
// στο ίδιο αντικείμενο ενός locale JSON;»
// 🔴 ΤΟ ΤΥΦΛΟ ΣΗΜΕΙΟ ΕΙΝΑΙ ΔΟΜΙΚΟ: το ECMA-404 ΕΠΙΤΡΕΠΕΙ διπλά ονόματα και το
// `JSON.parse` κρατά ΣΙΩΠΗΛΑ το τελευταίο. Κάθε πύλη i18n ξεκινά από `JSON.parse` ⇒
// βλέπει κόσμο όπου το διπλότυπο ΔΕΝ ΥΠΗΡΞΕ ΠΟΤΕ. Το 3.8 ρωτά «λείπει κλειδί;» — και
// δεν λείπει· απλώς κουβαλά λάθος τιμή ή έχει καταπιεί δεκάδες αδέλφια.
// 📏 ΜΕΤΡΗΜΕΝΟ 26/08: 16 διπλότυπα / 8 αρχεία / 360 ΝΕΚΡΕΣ ΜΕΤΑΦΡΑΣΕΙΣ. Χειρότερο:
// `common.json → audit.fields` (γρ. 767 ΚΑΙ 1100) — 177 ετικέτες πεδίων ανά γλώσσα δεν
// έφταναν ΠΟΤΕ, και ο χρήστης έβλεπε ΩΜΟ ΟΝΟΜΑ ΠΕΔΙΟΥ στο ιστορικό αλλαγών.
// ⚠️ Ο σαρωτής είναι ΣΥΝΤΑΚΤΙΚΟΣ επίτηδες: το ερώτημα ΔΕΝ απαντιέται από το αποτέλεσμα
// της ανάλυσης — μόνο από το κείμενο. Δεν είναι δεύτερη μηχανή δίπλα στο locale-keys.js.
// ⚠️ Η σκανδάλη (σταδιοποιημένα) είναι ΕΝΤΙΜΗ εδώ: διπλό κλειδί γεννιέται ΜΟΝΟ μέσα στο
// αρχείο που κάποιος έγραψε — δεν υπάρχει το μονοπάτι «σπάει αρχείο που κανείς δεν έστειλε».
if (!process.env.SKIP_LOCALE_DUPLICATE_KEYS)
  addThread('3.71', 'Locale duplicate keys', 'scripts/check-locale-duplicate-keys.js', []);

// CHECK 3.73 — ΠΥΛΗ ΛΕΞΙΛΟΓΙΟΥ ΤΟΜΕΑ (ADR-812). «Είναι κάθε δήλωση που απαριθμεί το
// λεξιλόγιο ΔΕΜΕΝΗ στη ρίζα του;»
// 🔴 Η ΑΙΤΙΑ, μετρημένη 26/08 με AST σε 15.344 αρχεία: το ADR-287 δήλωσε SSoT
// «ProjectStatus» και υπήρχαν ΔΕΚΑΤΡΙΑ σώματα με ΤΕΣΣΕΡΑ ασύμβατα σύνολα τιμών, συν ΔΥΟ
// ομώνυμα PROJECT_STATUSES. Το χειρότερο: το `types/validation/schemas.ts` έκανε
// `Object.keys()` πάνω στο badge map ΧΡΩΜΑΤΩΝ και το έδινε σε Zod — τα κλειδιά ενός
// πίνακα ΠΑΡΟΥΣΙΑΣΗΣ γίνονταν κανόνας ΕΓΚΥΡΟΤΗΤΑΣ του API, με το σχόλιο από πάνω να
// γράφει «NO MORE DUPLICATES» (σχήμα 3.34 · 3.37 · 3.57: η περιγραφή της διόρθωσης ΕΙΝΑΙ
// η απόκλιση).
// 🔑 ΤΟ ΚΡΙΤΗΡΙΟ ΔΕΝ ΕΙΝΑΙ «ΠΟΣΑ ΣΩΜΑΤΑ» — η επανάληψη είναι συχνά ΝΟΜΙΜΗ (badge variants ·
// στόχοι μετάβασης · λεξικό NLU: ίδιες τιμές, ΑΛΛΟΣ λόγος). Πύλη που μετρούσε πλήθος θα
// μπλόκαρε τη ΣΩΣΤΗ αρχιτεκτονική. Το ερώτημα είναι αν ο τύπος αναφέρει τη ΡΙΖΑ, ώστε η
// απόκλιση να γίνεται ΜΗ ΕΚΦΡΑΣΙΜΗ αντί για απλώς ανιχνεύσιμη.
// 🏆 Το typescript-eslint είναι ΑΝΑ ΑΡΧΕΙΟ (δεν μπορεί να κάνει την ερώτηση)· το ISO 19650
// είναι πρότυπο σε PDF· Revit/Figma είναι κλειστά προϊόντα. Και το CHECK 3.59 ρωτά «ένα
// ΟΝΟΜΑ → ένα σπίτι»: εδώ τα 13 σώματα είχαν 13 ΔΙΑΦΟΡΕΤΙΚΑ ονόματα ⇒ δομικά τυφλό.
// ⚠️ ZERO-TOL, καμία baseline ΠΟΤΕ: ένα αδέσμευτο σώμα αρκεί για να δεχτεί το API τιμή που
// η οθόνη δεν ξέρει να ζωγραφίσει. Εφικτό επειδή το ίδιο ρεύμα δουλειάς μηδένισε τους
// παραβάτες, ΜΕΤΡΗΜΕΝΑ (2 → 0).
// ⚠️ Το προφίλτρο κειμένου (17,9s → ~3s) είναι ΑΣΦΑΛΕΣ δομικά: δήλωση που απαριθμεί ≥K
// τιμές ΠΡΕΠΕΙ να τις περιέχει ως bytes. Επαληθευμένο: ταυτόσημη λογιστική με/χωρίς.
if (!process.env.SKIP_DOMAIN_VOCABULARY) {
  addThread('3.73', 'Domain vocabulary', 'scripts/check-domain-vocabulary.js', []);
}

// CHECK 3.81 — ΠΥΛΗ ΤΑΥΤΟΤΗΤΑΣ ΠΡΟΪΟΝΤΟΣ (ADR-857 Φ8). «Λέει κάθε σημείο που ονομάζει το
// ΠΡΟΪΟΝ το ΙΔΙΟ όνομα — και είναι κάθε ΑΛΛΗ χρήση δηλωμένη, με λόγο;»
// 🔴 Η ΑΙΤΙΑ: το ΙΔΙΟ, μοναδικό email που φεύγει κουβαλούσε ΤΕΣΣΕΡΑ ονόματα (`Nestor
// Construct` στο From:, `— ΝΕΣΤΩΡ`/`— Nestor` στο θέμα, `Nestor App` στο υποσέλιδο, `Nestor
// Pagonis` από τη Firebase) — και το πρώτο ΔΕΝ ΥΠΗΡΧΕ ΣΕ ΚΑΜΙΑ ΑΠΟΓΡΑΦΗ. Η Φ8α βρήκε δύο
// ακόμη που καμία απογραφή δεν είχε δει: `Nestor Enterprise` και `Pagonis Nestor`.
// 🔑 ΓΙΑΤΙ ΚΑΝΕΝΑ ΕΡΓΑΛΕΙΟ ΔΕΝ ΤΟ ΕΠΙΑΣΕ: ο `no-hardcoded-strings` θεωρεί «τεχνική» κάθε
// ΛΑΤΙΝΙΚΗ συμβολοσειρά με κενό ⇒ και οι έξι λατινικές γραφές ήταν ΑΟΡΑΤΕΣ, ενώ η ελληνική
// θα είχε αναφερθεί. Δεν είναι χαλασμένος — είναι δομικά τυφλός σε αυτή την κλάση.
// 🏆 ΚΑΙ ΤΟ ΟΙΚΟΣΥΣΤΗΜΑ ΕΠΙΣΗΣ (μετρημένο 13/09): το Vale (Microsoft · GitLab · Mozilla ·
// Red Hat) έχει ΑΚΡΙΒΩΣ τον κανόνα, αλλά ανασηκώνει ΜΟΝΟ σχόλια/docstrings και αφήνει τα
// string literals ως κώδικα — δηλαδή είναι τυφλό ακριβώς εκεί που έζησαν οι έξι γραφές.
// ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ: τέσσερα αθώα σημεία γράφουν παλιές γραφές μέσα σε ΣΧΟΛΙΟ — το ένα
// είναι το σχόλιο που ΤΕΚΜΗΡΙΩΝΕΙ τη διόρθωση. Σαρωτής κειμένου κοκκινίζει στη θεραπεία.
// ⚠️ ZERO-TOL, καμία baseline ΠΟΤΕ: δεν υπάρχει «λιγότερες λάθος γραφές από χθες» — ΜΙΑ
// αρκεί για να φτάσει σε εισερχόμενα πραγματικού ανθρώπου. Εφικτό επειδή η Φ8α μηδένισε
// την κλάση Α ΜΕΤΡΗΜΕΝΑ (15 γραφές σε 13 αρχεία → 0), όχι επειδή ελπίζουμε.
if (!process.env.SKIP_PRODUCT_IDENTITY) {
  addThread('3.81', 'Product identity', 'scripts/check-product-identity.js', []);
}

// CHECK 3.83 — Η ΑΡΧΗ ΤΟΥ ΑΠΟΣΤΟΛΕΑ (ADR-857 Φ9). «Ποιος αποφασίζει τη γραμμή `From:`;»
// 🔴 ΤΟ ΓΕΓΟΝΟΣ: 6 ΟΙΚΟΓΕΝΕΙΕΣ · 9 ΑΡΧΕΙΑ · 8 ΕΦΕΔΡΕΙΕΣ — ενώ το ADR έγραφε «τρεις
// αναγνώσεις» και το handoff «3/6/3». ΔΥΟ οικογένειες δεν ήταν σε ΚΑΜΙΑ απογραφή: σκληρή
// 'noreply@nestorconstruct.gr' στον orchestrator (γραμμένη στο `from` ΚΑΘΕ ουραγμένου
// εγγράφου, άρα ΠΑΓΩΜΕΝΗ) και ο onboarding cron χωρίς κανένα `from` (τελικό σκαλί
// `noreply@company.com` — ΨΕΥΤΙΚΟ domain). Και η `deliverDigest` δεν περνούσε `from`
// καθόλου ⇒ ίδιος ένοικος, ΔΙΑΦΟΡΕΤΙΚΟ `From:` ανάλογα με τη συνάθροιση.
// 🔑 ΓΙΑΤΙ ΔΕΝ ΤΑ ΕΙΔΕ Η 3.81: συγκρίνει ΠΕΖΑ-ΚΕΦΑΛΑΙΑ, και το `nestorconstruct.gr` σε
// πεζά δεν ανήκει στο κλειστό σύνολο γραφών ⇒ πέρασε τον μηδενισμό της Φ8α ΑΟΡΑΤΟ.
// 🏆 ΤΡΙΑ ΣΤΡΩΜΑΤΑ: ο τύπος `SenderHeader` (μη εξαγόμενο `unique symbol`) κάνει το «ξέχασα
// να ρωτήσω» ΜΗ ΜΕΤΑΓΛΩΤΤΙΣΙΜΟ· αυτή η πύλη πιάνει το residue που ο τύπος ΔΟΜΙΚΑ δεν
// βλέπει (παράλληλη πηγή που δεν τον αγγίζει ποτέ)· το `.ssot-registry.json` είναι Layer 1
// smoke. Η σύσταση «τύπος ΚΑΙ lint μαζί» είναι ρητή του typescript-eslint.
// ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ: τα εννέα θεραπευμένα αρχεία κουβαλούν σχόλια που ΟΝΟΜΑΖΟΥΝ τις
// μεταβλητές που έφυγαν — σαρωτής κειμένου θα κοκκίνιζε πάνω στη ΘΕΡΑΠΕΙΑ.
if (!process.env.SKIP_SENDER_AUTHORITY) {
  addThread('3.83', 'Sender authority', 'scripts/check-sender-authority.js', []);
}

// CHECK 3.84 — Η ΑΠΟΔΟΣΗ ΑΔΕΙΩΝ (ADR-863). «Ταξιδεύει το κείμενο μαζί με το αντίγραφο;»
// 🔴 ΤΟ ΓΕΓΟΝΟΣ, ΜΕΤΡΗΜΕΝΟ 2026-09-16: οι άδειες NOTICE (MIT/BSD/Apache/ISC) απαιτούν το
// κείμενό τους να συνοδεύει τα ΑΝΤΙΓΡΑΦΑ. Ό,τι κατεβαίνει στον browser ΕΙΝΑΙ αντίγραφο — και
// το προϊόν δεν είχε ΚΑΜΙΑ απόδοση πουθενά· ολόκληρο το public/ είχε δύο αρχεία αδειών, και
// τα δύο για γραμματοσειρές (ADR-805). Από τα 1.071 πακέτα prod, τα 1.064 απαιτούν απόδοση.
// 🔑 ΚΑΙ ΤΟ ΕΡΩΤΗΜΑ ΔΕΝ ΗΤΑΝ ΚΑΝ ΔΙΑΤΥΠΩΜΕΝΟ ΣΩΣΤΑ: το «απαιτεί απόδοση;» ζούσε ως χειρόγραφο
// Set(['Apache-2.0','OFL-1.1']) μέσα στο font-assets — δεύτερη λίστα αδειών (ADR-749 σε
// μικρογραφία) ΚΑΙ νομικά στενή, αφού η MIT απαιτεί επίσης και ΕΛΕΙΠΕ. Πλέον το πεδίο ζει στις
// categories του .license-policy.json και το ρωτούν ΔΥΟ πύλες με την ΙΔΙΑ συνάρτηση (3.69+3.84).
// 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ: Figma/Slack/Chromium ΠΑΡΑΓΟΥΝ αρχείο — κανείς δεν το ΦΡΟΥΡΕΙ, και η δήλωση
// «shipped» του Chromium είναι χειρόγραφη κι ανεπαλήθευτη. Εδώ η αυθεντία είναι τα webpack
// stats του build που ΗΔΗ τρέχει, και ο ισχυρισμός «server-side» γίνεται ΔΙΑΨΕΥΣΙΜΟΣ.
// ⏳ Όσο το .third-party-surfaces.json έχει `measured: false`, η άγνωστη επιφάνεια ΔΕΝ μπλοκάρει
// (η μέτρηση θέλει `next build` ⇒ συμβολαιακά CI, N.17) — αλλά ανακοινώνεται δυνατά. Ποτέ
// ψευδώς πράσινο: το μήνυμα λέει «δεν απαντήθηκε», όχι «καθαρό».
if (!process.env.SKIP_THIRD_PARTY_NOTICES) {
  addThread('3.84', 'Third-party notices', 'scripts/check-third-party-notices.js', []);
}

// CHECK 3.85 — ΟΙ ΕΚΔΟΣΕΙΣ ΤΩΝ ΝΟΜΙΚΩΝ ΚΕΙΜΕΝΩΝ (ADR-861 Φ3). «Είναι κάθε νομικό κείμενο μια
// ΑΜΕΤΑΒΛΗΤΗ, αποδείξιμη έκδοση — και ξέρει κάθε έκδοση ποιος ήταν ο φορέας τότε;»
// 🔴 ΤΟ ΓΕΓΟΝΟΣ, ΜΕΤΡΗΜΕΝΟ 2026-09-16: η πολιτική/οι όροι έγραφαν χειρόγραφο «Τελευταία ενημέρωση:
// 11 Φεβρουαρίου 2026» ενώ το κείμενο είχε αλλάξει στις 16/9 — και ΚΑΜΙΑ παλιά έκδοση δεν υπήρχε
// πουθενά. Η συναίνεση πωλητή (ADR-864 Α8) πρέπει να δείχνει σε κείμενο που ΔΕΝ μπορεί να αλλάξει.
// ⛔ ZERO TOL, καμία baseline: Κ1 bytes≠αποτύπωμα · Κ2 κείμενο χωρίς έκδοση · Κ3 δημοσιευμένη έκδοση
// άλλαξε (vs HEAD) · Κ4 ακολουθία · Κ5 μάρτυρας φορέα (κλείνει τη φύλαξη append-only του ADR-861 Σ2)
// · Κ6 αλλαγή φορέα χωρίς έκδοση · Κ7 ευρετήριο. Πλήρες ~1s ⇒ καμία σκανδάλη (πρότυπο 3.84).
if (!process.env.SKIP_LEGAL_DOCUMENTS) {
  addThread('3.85', 'Legal document versions', 'scripts/check-legal-documents.js', []);
}

// CHECK 3.74 — ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΗΣ ΔΗΜΟΣΙΑΣ ΠΡΟΒΟΛΗΣ (ADR-839). «Διαβάζει κάποιος
// αγγελία ΧΩΡΙΣ να περάσει από το σύνορο;»
// 🔴 ΤΟ ΓΕΓΟΝΟΣ, ΣΤΗΝ ΠΑΡΑΓΩΓΗ 2026-08-31: η οθόνη 3 κατέρρευσε σε ΛΕΥΚΟ για ανώνυμο
// επισκέπτη (`legality.map` σε `undefined`). Το έγγραφο είχε 15 από τα 18 πεδία του τύπου —
// γράφτηκε 06:46, τα τρία πεδία μπήκαν στο σχήμα ώρες αργότερα (ADR-835/838).
// 🔑 Ο ΤΥΠΟΣ ΕΛΕΓΕ ΤΗΝ ΑΛΗΘΕΙΑ ΓΙΑ ΤΟΝ ΓΡΑΦΕΑ ΚΑΙ ΨΕΜΑΤΑ ΓΙΑ ΤΗ ΒΑΣΗ. Τέσσερα σημεία έκαναν
// `data() as PublicListing` — και το τέταρτο (`mandate-request-notifier:170`) το βρήκε Η ΙΔΙΑ
// Η ΠΥΛΗ, όχι το grep. Ένα `as` δεν είναι έλεγχος: είναι εντολή στον tsc να πάψει να ρωτά.
// ⚠️ ΤΟ Κ2 ΕΙΝΑΙ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ («έχει το σύνορο καταναλωτές;»): χωρίς αυτό, κάποιος «λύνει»
// κόκκινο Κ1 σβήνοντας τη μετάφραση και η πύλη γίνεται ΠΡΑΣΙΝΗ ΜΕ ΜΗΔΕΝ ΠΡΟΣΤΑΣΙΑ.
// ⚠️ ΜΗΝ το συγχέεις με το 3.56 («ποιος ΔΙΑΧΕΙΡΙΖΕΤΑΙ»): αυτό ρωτά «ποιος ΔΙΑΒΑΖΕΙ».
if (!process.env.SKIP_LISTING_READ_BOUNDARY) {
  addThread('3.74', 'Listing read boundary', 'scripts/check-public-listing-read-boundary.js', []);
}

// CHECK 3.75 — ΤΟ ΣΥΝΟΡΟ ΤΟΥ ΧΑΡΤΗ (ADR-777 §8.56). «Έρχεται αυτός ο χάρτης ΜΑΖΙ ΜΕ ΤΟ ΣΤΥΛ
// ΤΟΥ — και το ξέρει κάποιος πριν το δει ο χρήστης;»
// 🔴 ΤΟ ΓΕΓΟΝΟΣ, ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ 2026-09-06 στο /search/results: κλικ σε πινέζα ⇒ ο χάρτης
// «μαύριζε» ΟΛΟΚΛΗΡΟΣ και ένα scroll τον επανέφερε ακαριαία. ΔΕΝ μαύριζε ποτέ — ΚΥΛΟΥΣΕ ΕΞΩ
// ΑΠΟ ΤΟ ΚΑΔΡΟ: το `maplibre-gl.css` δεν φορτωνόταν καθόλου εκεί (`maplibreCssPresent: false`),
// ο καμβάς έμενε `position: static`, το `div[mapboxgl-children]` έπεφτε ΚΑΤΩ του ⇒ δοχείο με
// `scrollHeight 1702` σε κουτί `792`. Η MapLibre εστιάζει το popup όταν ανοίγει (σωστή a11y)
// και ο περιηγητής κύλησε τον πρόγονο στο τέρμα (`scrollTop 1223.75`, καμβάς στο `y = −894`).
// 🔑 ΤΟ ΕΛΑΤΤΩΜΑ ΔΕΝ ΗΤΑΝ «ΚΑΠΟΙΟΣ ΞΕΧΑΣΕ» — ΗΤΑΝ ΟΤΙ ΤΟ «ΘΥΜΗΣΟΥ» ΗΤΑΝ Ο ΜΟΝΟΣ ΜΗΧΑΝΙΣΜΟΣ:
// ΤΕΣΣΕΡΑ αρχεία εισήγαγαν το φύλλο στυλ χειρόγραφα και ο ΚΟΙΝΟΣ χάρτης (3 καταναλωτές)
// ΚΑΝΕΝΑ. Και το είχαμε ήδη πληρώσει: το σχόλιο του AddressMap έγραφε «was missing, causing
// invisible pins» — διορθωμένο ΤΟΠΙΚΑ, σε ένα από τα τέσσερα.
// ⚠️ ΤΡΙΑ ΚΡΙΤΗΡΙΑ, ΚΑΙ ΚΑΝΕΝΑ ΔΕΝ ΑΠΑΝΤΑ ΤΟ ΕΡΩΤΗΜΑ ΤΩΝ ΑΛΛΩΝ: Κ1 παράκαμψη · Κ2 «έχει το
// σύνορο ΚΑΤΑΝΑΛΩΤΕΣ;» · Κ3 «κατέχει το σύνορο ΤΟ ΦΥΛΛΟ ΣΤΥΛ;». Χωρίς τα Κ2/Κ3 το ευκολότερο
// πράσινο θα ήταν να ΣΒΗΣΕΙΣ ΤΗ ΘΕΡΑΠΕΙΑ — μία γραμμή, και κάθε χάρτης χάνει τη διάταξή του.
// ⚠️ `import type` ΕΠΙΤΡΕΠΕΤΑΙ ρητά: ο τύπος σβήνεται στη μεταγλώττιση, άρα δεν μπορεί να
// ξεχάσει φύλλο στυλ (ίδιο κριτήριο με 3.61). Πύλη που κοκκινίζει σε ΣΩΣΤΟ κώδικα οδηγεί στο SKIP_.
// ⛔ ZERO-TOLERANCE, καμία baseline: ΜΙΑ παράκαμψη αρκεί για σελίδα όπου ο χάρτης εξαφανίζεται.
if (!process.env.SKIP_MAP_BOUNDARY && allFiles.length > 0)
  addThread('3.75', 'Map boundary', 'scripts/check-map-boundary.js', allFiles);

// CHECK 3.76 — ΠΥΛΗ ΕΠΙΜΕΛΕΙΑΣ ΤΟΥ ΔΗΜΟΣΙΟΥ ΜΟΝΤΕΛΟΥ (ADR-845 §8, Φ4.3). «Ποιος γεμίζει το
// `models[]` και ποιος το αδειάζει — και τους ρωτάει ΚΑΝΕΙΣ πριν φύγει η αγγελία στο κοινό;»
// 🔴 ΤΟ ΓΕΓΟΝΟΣ: το ADR-845 έγραψε ΕΝΤΕΚΑ άγκυρες και το §8 του ομολογούσε «καμία δεν είναι
// πύλη ακόμη» — οι Α-7/Α-8 έτρεχαν μόνο σε σκέτο `npm test`, και ΚΑΝΕΝΑ `register_area` δεν
// τις ονόμαζε. Ένα anchor χωρίς πύλη ΔΕΝ είναι anchor· είναι σχόλιο.
// ⚠️ ΔΥΟ ΠΗΓΕΣ, ΔΥΟ ΕΡΩΤΗΜΑΤΑ (ιδίωμα 3.41/3.65): ΕΔΩ το ΣΤΑΤΙΚΟ σκέλος («υπάρχει ΔΕΥΤΕΡΟΣ
// γραφέας;» — πιάνει τον ΜΕΛΛΟΝΤΙΚΟ παραβάτη, που καμία δοκιμή δεν ξέρει ότι θα γραφτεί)· το
// σκέλος ΕΚΤΕΛΕΣΗΣ ζει στο `register_area` του hook («κάνει ακόμη ο ΣΗΜΕΡΙΝΟΣ γραφέας αυτό
// που λέει;»). Ένας κανόνας με «ή» θα έμενε πράσινος πάνω στο μισό ελάττωμα.
// 🔑 ΚΑΘΕ ΚΡΙΤΗΡΙΟ ΑΠΟ ΜΕΤΡΗΜΕΝΟ ΠΕΡΙΣΤΑΤΙΚΟ: Κ2 = `reconcileShelfSafely(id, [])` σε ΔΥΟ
// σημεία άδειαζε ΜΟΝΟ το raster ράφι ⇒ κάθε αποσυρμένη αγγελία άφηνε το μοντέλο ΔΗΜΟΣΙΟ
// (§7.4)· Κ3 = το `encodeModelDeclaration` είχε ΜΗΔΕΝ μη-test καλούντες επί μία φάση ενώ ο
// ψήστης απέρριπτε κάθε ανέβασμα, και καμία δοκιμή δεν κοκκίνιζε (§7.5)· Κ4 = χωρίς αυτό, το
// ευκολότερο πράσινο είναι να ΣΒΗΣΕΙΣ ΤΗΝ ΑΓΚΥΡΑ.
// ⚠️ Αναφορά σε JSDoc (`{@link withPublishedModels}`) ΕΠΙΤΡΕΠΕΤΑΙ ρητά: δεν εκτελείται, άρα
// δεν αποφασίζει τίποτα. Πύλη που κοκκινίζει σε ΤΕΚΜΗΡΙΩΣΗ οδηγεί στο SKIP_ (ιδίωμα 3.61/3.75).
// ⛔ ZERO-TOLERANCE, καμία baseline: ΕΝΑΣ δεύτερος γραφέας αρκεί για να φύγει στο κοινό GLB
// που κανείς δεν επικύρωσε — σε content-addressed URL, δηλαδή ΜΟΝΙΜΗ ΔΙΕΥΘΥΝΣΗ.
if (!process.env.SKIP_LISTING_MODEL_CUSTODY && allFiles.length > 0)
  addThread('3.76', 'Listing model custody', 'scripts/check-listing-model-custody.js', allFiles);

// CHECK 3.64 — ΠΥΛΗ ΤΗΣ ΒΑΘΜΙΔΑΣ ΜΕΤΡΗΣΗΣ ΚΕΙΜΕΝΟΥ (ADR-799 Φάση 2). «Μέτρησε αυτή η σουίτα
// κείμενο σε βαθμίδα που ΔΕΝ ΒΛΕΠΕΙ ό,τι της ζητήθηκε — και αν ναι, το ξέρει κάποιος;»
// 🔴 ΤΟ ΓΕΓΟΝΟΣ: το `jsdom>canvas: '-'` (19fbc2cc, ΣΩΣΤΟ — αλυσίδα CVE του tar) εξαφάνισε το
// tier 2 ⇒ ό,τι δεν φτάνει σε tier 1 πέφτει στη `monospaceAdvance(text, height)`, που δέχεται
// ΚΥΡΙΟΛΕΚΤΙΚΑ ΔΥΟ ΟΡΙΣΜΑΤΑ και είναι ΔΟΜΙΚΑ ΤΥΦΛΗ σε bold/italic/οικογένεια. Σουίτες άλλαξαν
// βαθμίδα ΣΙΩΠΗΛΑ και έμειναν πράσινες σε όργανο που δεν βλέπει το ερώτημά τους.
// 🔑 ΤΟ ΚΡΙΤΗΡΙΟ ΔΕΝ ΕΙΝΑΙ «tier 3» — ΕΙΝΑΙ «tier 3 ΚΑΙ ζητήθηκε στυλ». Μετρημένο, και
// ανέτρεψε τον ίδιο τον σχεδιασμό: το ADR-799 §7 προέβλεπε 41 (σουίτες ΧΩΡΙΣ installStubFont)·
// η ΖΩΝΤΑΝΗ απογραφή έδωσε 61 που αγγίζουν τον μετρητή και ΜΟΛΙΣ 15 τυφλές — 32 μετρούν
// nominal ΧΩΡΙΣ να ζητούν κανέναν άξονα (η βαθμίδα απαντά ΑΚΡΙΒΩΣ την ερώτηση, δεν είναι
// παράβαση) και 14 φτάνουν tier 1/2 ⇒ το προσεγγιστικό κριτήριο θα είχε >68% ψευδώς θετικά.
// ⚠️ ΠΑΡΑΤΗΡΗΣΗ, ΟΧΙ ΕΥΡΕΤΙΚΟ: το `dropped` ΠΑΡΑΓΕΤΑΙ από (αίτημα × βαθμίδα) μέσα στην ΙΔΙΑ
// κλήση που έδωσε τον αριθμό — η κίνηση του CHECK 3.40: όχι νέα μηχανή κρίσης, νέα ΠΗΓΗ ΤΙΜΩΝ.
// ⚠️ ΔΥΟ ΣΤΡΩΜΑΤΑ ΜΕ ΔΙΑΦΟΡΕΤΙΚΗ ΔΟΥΛΕΙΑ: Layer 1 κρίνει την ΑΠΟΘΗΚΕΥΜΕΝΗ απογραφή και φυλά
// την ΠΑΛΙΝΔΡΟΜΗΣΗ· Layer 2 την ΤΡΕΧΕΙ και φυλά την ΑΝΑΚΑΛΥΨΗ. Νέα σουίτα που αρχίζει να
// μετρά τυφλά είναι εξ ορισμού αόρατη σε αποθηκευμένη απογραφή — δηλωμένο όριο, με δικό του
// φρουρό (`stale-census`, αποτύπωμα sha256· ΤΟ mtime ΔΕΝ ΕΙΝΑΙ ΣΗΜΑ — μάθημα CHECK 3.33).
// ⚠️ ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ: 🔴 RATCHET κατά ταυτότητα για τις τυφλές (15 ζωντανές ⇒ zero-tol θα ήταν
// μονίμως κόκκινο ⇒ SKIP_ ⇒ διακοσμητικό, απορρίφθηκε ρητά στο 3.39) + ⛔ ZERO-TOL για
// orphan/reasonless/stale/missing, που ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline (το buildPayload ρίχνει).
if (!process.env.SKIP_TEXT_MEASURE_TIER && allFiles.length > 0)
  addThread('3.64', 'Text measure tier', 'scripts/check-text-measure-tier.js', allFiles);


// CHECK 3.54 — πύλη εκτέλεσης των αγκυρών (ADR-783). «Μπορεί αυτό το test να κοκκινίσει
// κάτι;» — το επόμενο ερώτημα μετά το 3.47, με άλλη απάντηση: μετρημένο 11/08, **3.289 από
// τα 3.458** κρινόμενα αρχεία test εκτελούνταν σε κάθε PR και **κανένα δεν μπορούσε να κοκκινίσει
// τίποτα** (τρέχουν μέσα από το `coverage-ratchet.yml`, που έχει `continue-on-error` και
// κρίνει ποσοστό κάλυψης, όχι pass/fail — ακριβώς το κενό του ADR-587 §6.1).
// ⚠️ Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ (`triggers()`): ένα νέο αρχείο test προσγειώνεται
// οπουδήποτε, και ένα `continue-on-error` προσγειώνεται σε οποιοδήποτε workflow — λίστα
// μονοπατιών εδώ θα ήταν δεύτερη αυθεντία που αποκλίνει σιωπηλά (σχήμα 3.34/3.37).
// Κόστος: ~0,05s όταν δεν αφορά· ~1,4s όταν πυροδοτεί (η απογραφή του 3.47).
if (!process.env.SKIP_ANCHOR_EXECUTION && allFiles.length > 0)
  addThread('3.54', 'Anchor execution', 'scripts/check-anchor-execution.js', allFiles);

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

// CHECK 3.86 (ADR-865) — απόδειξη ανάπτυξης. 🔴 ΚΑΜΙΑ ΣΚΑΝΔΑΛΗ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΟΛΟ ΝΟΗΜΑ:
// με σκανδάλη στα `firestore.rules`/`firestore.indexes.json` ΔΕΝ θα έπιανε τη βλάβη που τη
// γέννησε. Το `b307f46e` τα άγγιξε, και μετά πέρασαν **21 commits** (legal, ADR-861 κ.ά.) χωρίς
// κανείς να ξαναδεί την εκκρεμότητα — ακριβώς εκεί ξεχάστηκε. Μια εκκρεμής ανάπτυξη πρέπει να
// **επιμένει να φαίνεται** σε ΚΑΘΕ commit μέχρι να λυθεί (πρότυπο Argo CD: το `OutOfSync` badge
// μένει, χωρίς `selfHeal`, μέχρι να δράσει άνθρωπος).
// Κόστος: sha256 τριών αρχείων + ένα JSON — κανένα δίκτυο, καμία ταυτότητα. Στο commit ΔΕΝ
// μπλοκάρει ο Κ5 (η στιγμή της ανάπτυξης είναι απόφαση του Giorgio, N.(-1))· μπλοκάρει στο
// **push**, όπου ο κώδικας φεύγει προς την παραγωγή χωρίς τον κανόνα του (`git-hooks/pre-push`).
if (!process.env.SKIP_FIRESTORE_DEPLOY_PROOF)
  addThread('3.86', 'Firestore deploy proof', 'scripts/check-firestore-deploy-proof.js');

// CHECK 3.87 (ADR-862 Φ0 Β12) — η αρχή της κατάστασης CDE. «Γράφει κάποιος την κατάσταση
// ενός αρχείου ΕΞΩ από τον ΕΝΑ γραφέα, ή διαβάζει client λίστα `files` ΧΩΡΙΣ φράχτη;»
// 🔴 ΓΙΑΤΙ ΧΩΡΙΣ ΣΚΑΝΔΑΛΗ: οι κανόνες (`cdeCustodyUnchanged`) κλείνουν τον ΠΕΛΑΤΗ, όχι το
// Admin SDK — ένας δεύτερος γραφέας διακομιστή θα γεννιόταν σε ΟΠΟΙΟΔΗΠΟΤΕ αρχείο. Και μια
// client λίστα χωρίς φράχτη ΔΕΝ «χάνει μερικά αρχεία»: απορρίπτεται ΟΛΟΚΛΗΡΗ.
// ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ: το `supersededByFileId` είναι και παράμετρος αιτήματος και φορτίο
// γεγονότος — μετρημένα 9 σημεία, κανένα γραφή. ZERO-TOL, καμία baseline.
if (!process.env.SKIP_CDE_AUTHORITY)
  addThread('3.87', 'CDE state authority', 'scripts/check-cde-authority.js');

// CHECK 3.88 (ADR-862 Φ0 Β14) — η αρχή της ομάδας έργου. «Γράφει κάποιος μέλος έργου ΕΞΩ από
// τον ΕΝΑ γραφέα, ή γεννά έργο ΧΩΡΙΣ την αρχική του ομάδα;»
// 🔴 ΓΙΑΤΙ ΧΩΡΙΣ ΣΚΑΝΔΑΛΗ: μετρημένα 8 έργα / 0 μέλη — το έργο γεννιόταν με σκέτο `.set()` και ο
// κριτής έκρυβε κάθε αρχείο CDE ακόμη και από τον δημιουργό. Οι κανόνες κλείνουν τον ΠΕΛΑΤΗ, όχι
// το Admin SDK. AST, ZERO-TOL, καμία baseline.
if (!process.env.SKIP_PROJECT_MEMBER_AUTHORITY)
  addThread('3.88', 'Project member authority', 'scripts/check-project-member-authority.js');

// CHECK 3.89 (ADR-867 Β4) — η αρχή του νήματος. «Γράφει κάποιος ΑΚΡΟΑΤΗΡΙΟ ή ΜΗΝΥΜΑ έξω από
// τον ΕΝΑ γραφέα, ή αλλάζει ομάδα ΧΩΡΙΣ να ξαναγράψει το ακροατήριο;»
// 🔴 ΓΙΑΤΙ ΧΩΡΙΣ ΣΚΑΝΔΑΛΗ: το ακροατήριο ΕΙΝΑΙ η απάντηση του κανόνα Firestore στο «ποιος
// διαβάζει;». Οι κανόνες κλείνουν τον ΠΕΛΑΤΗ, όχι το Admin SDK — δεύτερος γραφέας στον
// διακομιστή βάζει όποιον θέλει σε ξένη συνομιλία. AST, ZERO-TOL, καμία baseline.
if (!process.env.SKIP_NETWORK_THREAD_AUTHORITY)
  addThread('3.89', 'Network thread authority', 'scripts/check-network-thread-authority.js');

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
