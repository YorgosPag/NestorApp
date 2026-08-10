#!/usr/bin/env node
'use strict';

/**
 * =============================================================================
 * CHECK 3.52 — ΠΥΛΗ ΤΟΥ ΣΥΝΟΡΟΥ ΚΕΛΥΦΟΥΣ  (ADR-777 §8.12)
 * =============================================================================
 *
 * «Φοράει αυτή η σελίδα το κέλυφος **επειδή το λέει ο φάκελός της**, ή επειδή
 *  κανείς δεν ρώτησε;»
 *
 * ## Η ρίζα
 * Ο `ConditionalAppShell` έκρινε «γυμνή σελίδα;» από **τρεις χειρόγραφες λίστες
 * `pathname`**. Ένα route group είναι **ΦΑΚΕΛΟΣ** και **δεν εμφανίζεται ΠΟΤΕ** στο
 * `pathname` ⇒ ο φρουρός ήταν **δομικά τυφλός** στο `(light)`. Δεν απέκλινε η λίστα
 * του — **δεν ρωτήθηκε ποτέ**. Μετρημένο ζωντανά (2026-08-10, φωτογραφία «ΠΡΙΝ»):
 * το δημόσιο `/search` σέρβιρε **65×** `data-sidebar` + `sidebar-wrapper` + `<header>`.
 *
 * 🔴 Και δεν ήταν μόνο οι δημόσιες: το `/oauth/consent` ζει στο group `(auth)` και το
 * ίδιο του το docblock γράφει «*η οθόνη δεν χρειάζεται τίποτα από το app shell*» —
 * έπαιρνε **ολόκληρο** το κέλυφος, επειδή η λίστα `AUTH_ROUTES` δεν το ονόμαζε. Η ίδια
 * λίστα ονόμαζε **τρεις** διαδρομές που **δεν υπάρχουν** (`/register`,
 * `/forgot-password`, `/reset-password`). Δύο αλήθειες, με **όνομα** η καθεμία, που
 * είχαν αποκλίνει **και προς τις δύο κατευθύνσεις** (σχήμα ADR-749).
 *
 * ## Τρεις ΑΝΕΞΑΡΤΗΤΟΙ κανόνες — ΠΟΤΕ ένας με «ή» (μάθημα CHECK 3.41)
 *
 *  **Κ1 — ΔΟΜΗ**: κάθε `page.tsx` ζει κάτω από **ένα δηλωμένο** route group, και η
 *  ιδιότητα «φοράει κέλυφος» προκύπτει **αποκλειστικά** από το αν ο δηλωμένος
 *  ιδιοκτήτης-layout βρίσκεται στην **αλυσίδα προγόνων** της. Αυθεντία = το Next.js.
 *
 *  **Κ2 — ΚΑΤΑΝΑΛΩΤΗΣ**: κάθε σελίδα που φτάνει σε **αντιδραστικό** hook δημόσιας
 *  προβολής οφείλει να ζει σε group `wearsShell:false`, **ανεξάρτητα** από τον φάκελο.
 *  ⚠️ Ο Κ1 είναι από κατασκευή **αυτο-συνεπής**: μετακίνησε δημόσια σελίδα μέσα στο
 *  `(app)` και η δήλωση αλλάζει μαζί της ⇒ ο Κ1 μένει **ΠΡΑΣΙΝΟΣ πάνω στο ελάττωμα**.
 *  Ο Κ2 είναι ο λόγος που η άγκυρα είναι άγκυρα.
 *
 *  **Κ3 — ΙΔΙΟΚΤΗΣΙΑ ΣΥΜΒΟΛΟΥ**: τα σύμβολα κελύφους εισάγονται **μόνο** από τον
 *  δηλωμένο ιδιοκτήτη (τα tests μετρώνται ξεχωριστά, ρητά). Και ο ιδιοκτήτης οφείλει
 *  να τα εισάγει **ΑΜΕΣΑ** — αυτό είναι **κατάσταση** (`owner-without-shell`), όχι
 *  σύμβαση σε σχόλιο: ένας wrapper που κρύβει το κέλυφος μια στάση πιο κάτω θα έκανε
 *  τον έλεγχο τυφλό **σιωπηλά**, που είναι ακριβώς το σχήμα που κυνηγάει η πύλη.
 *
 * ## Κλειστό σύνολο δηλώσεων
 * Ένα route group **χωρίς** δήλωση ΜΠΛΟΚΑΡΕΙ, ακόμα κι αν σήμερα δεν σπάει τίποτα
 * (πρότυπο CHECK 3.39/3.50): ένας νέος φάκελος `(x)` διχάζει το σύνορο, και η στιγμή
 * να το πει κανείς είναι **πριν** προσγειωθεί, όχι αφού.
 *
 * ## ΔΕΝ είναι ratchet — καμία baseline, ΠΟΤΕ
 * Δεν υπάρχει «λιγότερες σελίδες που φοράνε λάθος κέλυφος από χθες»: **μία** αρκεί
 * για να διαρρεύσει το εσωτερικό μενού σε δημόσιο επισκέπτη. Είναι εφικτό ως zero-tol
 * **επειδή** η μετακόμιση του ADR-777 §8.12 καθάρισε το δέντρο — **μετρημένο** (Μ0),
 * όχι ελπιζόμενο.
 *
 * ## Στρώματα
 *  · **Layer 1** (pre-commit): πλήρης, με **σκανδάλη**. ~0,05s όταν δεν αφορά·
 *    ~7s όταν πυροδοτεί (Κ2: `git grep` + AST). Η σκανδάλη ζει **μέσα** στην πύλη —
 *    λίστα φακέλων στο `run-checks-parallel.js` θα ήταν **δεύτερη αυθεντία**.
 *  · **Layer 2** (CI, άνευ όρων): το ίδιο, σε όλο το δέντρο.
 *
 * ⚠️ **ΜΗΝ** το κάνεις ratchet. **ΜΗΝ** λύσεις κόκκινο προσθέτοντας group στο
 * `.shell-boundary.json` χωρίς λόγο — ο λόγος **είναι** η απάντηση. **ΜΗΝ** βάλεις το
 * `computeListingLedger` στα `publicDataHooks` (καθαρή συνάρτηση· το εσωτερικό
 * `/test-harness/listing-shapes` τη χρησιμοποιεί νόμιμα και θα γινόταν ψευδώς θετικό).
 *
 * Escape: `SKIP_SHELL_BOUNDARY=1`
 * @module scripts/check-shell-boundary
 */

const fs = require('node:fs');
const path = require('node:path');

const TREE = require('./lib/shell-boundary/tree');
const PS = require('./lib/shell-boundary/public-surface');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

const CONFIG_FILE = '.shell-boundary.json';
const APP_DIR = 'src/app';

// --- Οι καταστάσεις: ρητές, ονομασμένες, και οι μπλοκάρουσες τυπώνονται ΚΑΙ ΣΤΟ ΜΗΔΕΝ ---
const PAGE_STATES = Object.freeze({
  UNGROUPED: 'ungrouped-page',
  PUBLIC_WEARING_SHELL: 'public-surface-wearing-shell',
  SHELL_MISMATCH: 'shell-mismatch',
  SHELL_PAGE: 'shell-page',
  BARE_PAGE: 'bare-page',
});
const PAGE_BLOCKING = [PAGE_STATES.UNGROUPED, PAGE_STATES.PUBLIC_WEARING_SHELL, PAGE_STATES.SHELL_MISMATCH];
const PAGE_ORDER = [...PAGE_BLOCKING, PAGE_STATES.SHELL_PAGE, PAGE_STATES.BARE_PAGE];

const SYMBOL_STATES = Object.freeze({
  OUTSIDE_OWNER: 'shell-outside-owner',
  OWNER_SITE: 'owner-site',
  TEST_SITE: 'test-site',
});
const SYMBOL_BLOCKING = [SYMBOL_STATES.OUTSIDE_OWNER];
const SYMBOL_ORDER = [...SYMBOL_BLOCKING, SYMBOL_STATES.OWNER_SITE, SYMBOL_STATES.TEST_SITE];

const GROUP_STATES = Object.freeze({
  UNDECLARED: 'undeclared-group',
  ORPHAN: 'orphan-declaration',
  DECLARED: 'declared-group',
});
const GROUP_BLOCKING = [GROUP_STATES.UNDECLARED, GROUP_STATES.ORPHAN];
const GROUP_ORDER = [...GROUP_BLOCKING, GROUP_STATES.DECLARED];

const OWNER_STATES = Object.freeze({
  MISSING: 'owner-missing',
  WITHOUT_SHELL: 'owner-without-shell',
  OK: 'owner-ok',
});
const OWNER_BLOCKING = [OWNER_STATES.MISSING, OWNER_STATES.WITHOUT_SHELL];

function loadConfig(projectRoot) {
  const file = path.join(projectRoot, CONFIG_FILE);
  if (!fs.existsSync(file)) throw new Error(`CHECK 3.52: λείπει το ${CONFIG_FILE}`);
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const field of ['owner', 'shellSymbols', 'groups', 'publicDataHooks']) {
    if (!(field in cfg)) throw new Error(`CHECK 3.52: ${CONFIG_FILE} — λείπει το πεδίο «${field}»`);
  }
  return cfg;
}

/** Τα groups του δίσκου έναντι των δηλώσεων — και προς τις ΔΥΟ κατευθύνσεις. */
function auditGroups(projectRoot, cfg) {
  const onDisk = TREE.enumerateRootGroups(projectRoot, APP_DIR);
  const declared = Object.keys(cfg.groups);
  const findings = [];
  for (const group of onDisk) {
    if (!declared.includes(group)) findings.push({ state: GROUP_STATES.UNDECLARED, group });
    else findings.push({ state: GROUP_STATES.DECLARED, group });
  }
  for (const group of declared) {
    if (!onDisk.includes(group)) findings.push({ state: GROUP_STATES.ORPHAN, group });
  }
  return findings;
}

/** Κ3 — κάθε σημείο εισαγωγής συμβόλου κελύφους, κρινόμενο κατά ιδιοκτήτη. */
function auditShellSymbols(projectRoot, cfg) {
  const hits = PS.gitGrepFiles(projectRoot, cfg.shellSymbols);
  return hits.map(rel => {
    if (rel === cfg.owner) return { state: SYMBOL_STATES.OWNER_SITE, file: rel };
    if (/__tests__|\.(test|spec)\.[jt]sx?$/.test(rel)) return { state: SYMBOL_STATES.TEST_SITE, file: rel };
    return { state: SYMBOL_STATES.OUTSIDE_OWNER, file: rel };
  });
}

/** Κ3 (β) — ο ιδιοκτήτης υπάρχει ΚΑΙ εισάγει το κέλυφος ΑΜΕΣΑ. */
function auditOwner(projectRoot, cfg, symbolFindings) {
  const abs = path.join(projectRoot, cfg.owner);
  if (!fs.existsSync(abs)) return { state: OWNER_STATES.MISSING, file: cfg.owner };
  const sites = symbolFindings.filter(f => f.state === SYMBOL_STATES.OWNER_SITE);
  if (sites.length === 0) return { state: OWNER_STATES.WITHOUT_SHELL, file: cfg.owner };
  return { state: OWNER_STATES.OK, file: cfg.owner };
}

/**
 * Κ1 + Κ2 ανά σελίδα. **Η ΣΕΙΡΑ ΤΑΞΙΝΟΜΗΣΗΣ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**: χωρίς group δεν
 * μπορεί να τεθεί καμία άλλη ερώτηση, και η δημόσια επιφάνεια κρίνεται **πριν** τη
 * συμφωνία δομής-δήλωσης, γιατί εκεί η δήλωση **είναι** το λάθος.
 */
function classifyPage(pageRel, ctx) {
  const group = TREE.rootGroupOf(pageRel, APP_DIR);
  if (!group || !ctx.groups[group]) return { state: PAGE_STATES.UNGROUPED, file: pageRel, group };

  const declared = ctx.groups[group].wearsShell === true;
  const wears = TREE.ancestorLayoutsOf(pageRel, ctx.layouts).includes(ctx.owner);

  if (ctx.publicReaching && ctx.publicReaching.has(TREE.toPosix(path.join(ctx.projectRoot, pageRel)))) {
    if (declared || wears) return { state: PAGE_STATES.PUBLIC_WEARING_SHELL, file: pageRel, group };
  }
  if (wears !== declared) return { state: PAGE_STATES.SHELL_MISMATCH, file: pageRel, group, wears, declared };
  return { state: wears ? PAGE_STATES.SHELL_PAGE : PAGE_STATES.BARE_PAGE, file: pageRel, group };
}

/** 🔴 Κλειστή λογιστική, fail-closed: άγνωστη κατάσταση ⇒ `throw` ΜΕ ΟΝΟΜΑ. */
function tally(findings, order, label) {
  const ledger = Object.fromEntries(order.map(s => [s, 0]));
  for (const f of findings) {
    if (!(f.state in ledger)) throw new Error(`CHECK 3.52: άγνωστη κατάσταση «${f.state}» στη λογιστική ${label}`);
    ledger[f.state] += 1;
  }
  const summed = order.reduce((acc, s) => acc + ledger[s], 0);
  if (summed !== findings.length) {
    throw new Error(`CHECK 3.52: η λογιστική ${label} δεν κλείνει (${summed} ≠ ${findings.length})`);
  }
  return ledger;
}

function analyse(projectRoot, { withPublicSurface = true } = {}) {
  const cfg = loadConfig(projectRoot);
  const layouts = TREE.enumerateLayouts(projectRoot, APP_DIR);
  const pages = TREE.enumeratePages(projectRoot, APP_DIR);

  const groupFindings = auditGroups(projectRoot, cfg);
  const symbolFindings = auditShellSymbols(projectRoot, cfg);
  const ownerFinding = auditOwner(projectRoot, cfg, symbolFindings);

  const publicReaching = withPublicSurface
    ? PS.computePublicReaching(projectRoot, cfg.publicDataHooks)
    : null;

  const ctx = {
    projectRoot: TREE.toPosix(projectRoot),
    groups: cfg.groups,
    owner: cfg.owner,
    layouts,
    publicReaching,
  };
  const pageFindings = pages.map(p => classifyPage(p, ctx));

  return {
    cfg,
    pages: pageFindings,
    groups: groupFindings,
    symbols: symbolFindings,
    owner: ownerFinding,
    ledgers: {
      pages: tally(pageFindings, PAGE_ORDER, 'σελίδων'),
      groups: tally(groupFindings, GROUP_ORDER, 'groups'),
      symbols: tally(symbolFindings, SYMBOL_ORDER, 'συμβόλων'),
    },
  };
}

/** Κάθε μπλοκάρον εύρημα, σε μία λίστα, με τη σοβαρότερη οικογένεια πρώτη. */
function blockingOf(result) {
  const out = [];
  if (OWNER_BLOCKING.includes(result.owner.state)) out.push(result.owner);
  out.push(...result.groups.filter(f => GROUP_BLOCKING.includes(f.state)));
  out.push(...result.symbols.filter(f => SYMBOL_BLOCKING.includes(f.state)));
  out.push(...result.pages.filter(f => PAGE_BLOCKING.includes(f.state)));
  return out;
}

// ---------------------------------------------------------------------------
// Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΕΔΩ, ΟΧΙ ΣΤΟΝ ΚΑΛΟΥΝΤΑ — αλλιώς θα ήταν δεύτερη αυθεντία.
// ---------------------------------------------------------------------------
const TRIGGER_RE = [
  /^src\/app\/.*\/(page|layout)\.(tsx|jsx)$/,
  /^src\/app\/(page|layout)\.(tsx|jsx)$/,
  /^\.shell-boundary\.json$/,
  /^scripts\/check-shell-boundary\.js$/,
  /^scripts\/lib\/shell-boundary\//,
];

function triggers(files) {
  return files.some(f => TRIGGER_RE.some(re => re.test(f)));
}

function printLedger(name, ledger, blocking, gaps = []) {
  console.log(`\n  ${name}`);
  for (const [state, count] of Object.entries(ledger)) {
    const mark = blocking.includes(state) ? '⛔' : gaps.includes(state) ? '🔶' : '✅';
    console.log(`    ${mark} ${state.padEnd(30)} ${count}`);
  }
}

function main(argv) {
  if (process.env.SKIP_SHELL_BOUNDARY === '1') return 0;

  const projectRoot = process.cwd();
  const report = argv.includes('--report');
  const all = argv.includes('--all') || report;
  const staged = argv.filter(a => !a.startsWith('-'));

  if (!all && staged.length > 0 && !triggers(staged)) return 0;

  const result = analyse(projectRoot);

  if (report) {
    console.log('\nCHECK 3.52 — απογραφή συνόρου κελύφους');
    console.log(`  ιδιοκτήτης: ${result.cfg.owner}  [${result.owner.state}]`);
    printLedger('σελίδες', result.ledgers.pages, PAGE_BLOCKING);
    printLedger('route groups', result.ledgers.groups, GROUP_BLOCKING);
    printLedger('σημεία εισαγωγής συμβόλων κελύφους', result.ledgers.symbols, SYMBOL_BLOCKING);
    console.log('');
    return 0;
  }

  const blocked = blockingOf(result);
  if (blocked.length > 0) {
    console.log(`\n${RED}═══════════════════════════════════════════════════════════════${NC}`);
    console.log(`${RED}  🚫 COMMIT BLOCKED — σύνορο κελύφους (CHECK 3.52 · ADR-777 §8.12)${NC}`);
    console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}\n`);
    for (const f of blocked) console.log(`  ❌ ${(f.file || f.group)}  [${f.state}]`);
    console.log(`\n  ${YELLOW}Το «φοράει κέλυφος;» το απαντά Η ΙΕΡΑΡΧΙΑ ΦΑΚΕΛΩΝ, όχι λίστα διαδρομών.${NC}`);
    console.log(`  ${YELLOW}Βάλε τη σελίδα στο σωστό route group· δήλωσε νέο group στο ${CONFIG_FILE}.${NC}\n`);
    return 1;
  }

  const { pages } = result.ledgers;
  console.log(
    `${GREEN}✅ CHECK 3.52 — σύνορο κελύφους καθαρό${NC} ` +
    `(${pages[PAGE_STATES.SHELL_PAGE]} με κέλυφος · ${pages[PAGE_STATES.BARE_PAGE]} γυμνές)`,
  );
  return 0;
}

module.exports = {
  PAGE_STATES, PAGE_BLOCKING, PAGE_ORDER,
  SYMBOL_STATES, SYMBOL_ORDER, GROUP_STATES, GROUP_ORDER, OWNER_STATES,
  loadConfig, auditGroups, auditShellSymbols, auditOwner, classifyPage, tally,
  analyse, blockingOf, triggers, main,
};

if (require.main === module) process.exit(main(process.argv.slice(2)));
