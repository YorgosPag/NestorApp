#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.72 — ΠΥΛΗ ΤΩΝ ΚΑΘΟΛΙΚΩΝ ΔΥΝΑΤΟΤΗΤΩΝ   (ADR-809)
 * =============================================================================
 *
 * «Προσφέρει **αυτή η οθόνη** στον άνθρωπο τη γλώσσα, το θέμα και τον λογαριασμό
 * του — και αν όχι, το είπε κάποιος **με λόγο**;»
 *
 * ⚠️ **ΔΕΝ είναι το ερώτημα του CHECK 3.52**, και η ένωση θα ήταν το λάθος που
 * απέφυγε ρητά το ADR-775. Εκείνο ρωτά *«φοράει κέλυφος;»* (ποιο layout)· αυτό
 * *«τι **υπόσχεται** το κέλυφος;»* (ποιες δυνατότητες). Μια σελίδα μπορεί να
 * φοράει το σωστό κέλυφος και να μην υπόσχεται τίποτα — ακριβώς αυτό συνέβαινε.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΜΕΤΡΗΜΕΝΟ ΕΛΑΤΤΩΜΑ (2026-08-26, ΠΡΙΝ γραφτεί γραμμή)
 * ─────────────────────────────────────────────────────────────────────────────
 * Πέντε γειτονιές, **πέντε** διαφορετικά κελύφη· γλώσσα+θέμα σε **2 στις 5**,
 * λογαριασμός σε **1 στις 5**. Και το χειρότερο δεν ήταν η ασυνέπεια αλλά το
 * **ψέμα**: ο `PublicSiteHeader` ζωγράφιζε πόρτα «Σύνδεση» **άνευ όρων**, άρα σε
 * **ΣΥΝΔΕΔΕΜΕΝΟ** άνθρωπο, σε **δύο** γειτονιές — στο `(me)`, που φρουρείται από
 * `ProtectedRoute` και άρα **κανείς ανώνυμος δεν το βλέπει ποτέ**, και στο
 * `(light)`. Και το docblock του `PrivateSpaceShell` το δήλωνε ως **απόφαση**
 * («Καμία νέα κεφαλίδα»), οπότε ο επόμενος θα τη σεβόταν.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ **ΑΝΑ ΣΕΛΙΔΑ**, ΚΑΙ ΤΟ ΑΠΟΦΑΣΙΣΕ Η ΜΕΤΡΗΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το προφανές κριτήριο «ανά **γειτονιά**, ρίζα το `layout.tsx`» δοκιμάστηκε και
 * έδινε ⛔ για το `(auth)` — **ψευδώς θετικό**, γιατί εκείνο έβαζε τη μπάρα του
 * στο δέντρο της **σελίδας**. Το κριτήριο ανά σελίδα όχι μόνο το έλυσε, αλλά
 * βρήκε **πραγματικό κενό που κανένα άλλο δεν έβλεπε**: το `/oauth/consent` και
 * το `/mandate/[token]` δεν περνούσαν από κανένα από τα **τρία** σημεία απόδοσης
 * της μπάρας ⇒ **μηδέν** γλώσσα, **μηδέν** θέμα. Μια μέτρηση ανά γειτονιά θα
 * έλεγε «το `(auth)` έχει γλώσσα» — **αληθές και άσχετο**.
 *
 * Θεραπεία: η `AuthToolbar` μετακόμισε στο `(auth)/layout.tsx`, όπως σε **κάθε
 * άλλη** γειτονιά — τρία σημεία απόδοσης έγιναν **ένα**, και το `authToolbar`
 * είναι `fixed top-4 right-4` ⇒ **μηδέν** οπτική αλλαγή.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή» (μάθημα CHECK 3.41)
 * ─────────────────────────────────────────────────────────────────────────────
 *  **Κ1 — ΠΡΟΣΒΑΣΙΜΟΤΗΤΑ**: κάθε `page.tsx` φτάνει στον ιδιοκτήτη, μέσα από την
 *  αλυσίδα των layout της **ή** το δικό της δέντρο. ⇒ *«πρόσθεσε τις δυνατότητες»*
 *
 *  **Κ2 — ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ**: κάθε γειτονιά/σελίδα που **δεν** φτάνει δηλώνεται με
 *  λόγο ≥40 χαρακτήρων· ορφανή δήλωση, ή δήλωση για κάτι που **όντως** φτάνει,
 *  μπλοκάρει επίσης (δύο αλήθειες που διαφωνούν, ADR-749).
 *  ⇒ *«δήλωσε, ή σβήσε τη δήλωση»*
 *
 *  **Κ3 — ΙΔΙΟΚΤΗΣΙΑ**: τα τρία καθολικά σύμβολα εισάγονται **μόνο** από τον
 *  ιδιοκτήτη. ⇒ *«πάψε να συναρμολογείς δικό σου»*
 *
 * 🔑 **Ο Κ3 ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ Ο Κ1 ΕΙΝΑΙ ΑΓΚΥΡΑ.** Ο Κ1 είναι από κατασκευή
 * ικανοποιήσιμος με **τέταρτο** cluster δίπλα στον ιδιοκτήτη — θα έμενε
 * **ΠΡΑΣΙΝΟΣ πάνω στο ελάττωμα** που η πύλη γεννήθηκε να πιάσει. Ίδια σχέση με
 * Κ1/Κ3 του CHECK 3.52.
 *
 * ⚠️ **ΤΟ WCAG ΔΕΝ ΕΙΝΑΙ Η ΒΑΣΗ ΑΥΤΗΣ ΤΗΣ ΠΥΛΗΣ** — δες `$whyNotWcag` στο
 * `.shell-utilities.json`. Τα SC 3.2.3/3.2.6 φυλούν τη **ΣΕΙΡΑ**, και το 3.2.6
 * λέει ρητά ότι η **απουσία** δεν είναι παραβίαση. Η σειρά ήταν ήδη συνεπής.
 *
 * ⚠️ **ΜΗΝ το κάνεις ratchet.** Δεν υπάρχει «λιγότερες οθόνες που λένε ψέματα από
 * χθες» — **μία** αρκεί ώστε συνδεδεμένος άνθρωπος να καλείται να συνδεθεί. Είναι
 * εφικτό ως zero-tol **επειδή μετρήθηκε** ότι το ίδιο ρεύμα δουλειάς μηδένισε
 * τους παραβάτες (157/157 σελίδες), όχι επειδή ελπίζεται.
 *
 * ⚠️ **ΚΑΜΙΑ ΣΚΑΝΔΑΛΗ ΓΙΑ ΤΟ ΕΥΡΟΣ, ΜΟΝΟ ΓΙΑ ΤΟ ΑΝ.** Όταν πυροδοτεί, ο έλεγχος
 * είναι **πάντα πλήρης**: ο ιδιοκτήτης είναι **ένα** αρχείο και κάθε σελίδα του
 * δέντρου εξαρτάται από αυτόν — μερική ανάλυση θα ήταν αναληθής.
 *
 * Layer 1 = pre-commit (σκανδάλη μέσα στην πύλη)
 * Layer 2 = job στο υπάρχον `ssot-discover.yml`, άνευ όρων.
 *
 * Αναφορά: `npm run shell-utilities:report`
 * Escape:  `SKIP_SHELL_UTILITIES=1`
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TREE = require('./lib/shell-boundary/tree');
const { createReachability, toPosix } = require('./lib/shell-utilities/reach');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

const CONFIG_FILE = '.shell-utilities.json';
const APP_DIR = 'src/app';
/** Ο λόγος οφείλει να είναι **μετρημένος**, όχι λέξη. Ίδιο κατώφλι με 3.58/3.61. */
const MIN_REASON = 40;

// ---------------------------------------------------------------------------
// ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ — κλειστή λογιστική, άγνωστη ⇒ throw ΜΕ ΟΝΟΜΑ
// ---------------------------------------------------------------------------

const PAGE_STATES = Object.freeze({
  /** ⛔ Οθόνη χωρίς καθολικές δυνατότητες, αδήλωτη. */
  SILENT: 'silent-screen',
  /** ✅ Φτάνει μέσα από την αλυσίδα layout — ο κανονικός δρόμος. */
  VIA_LAYOUT: 'utilities-via-layout',
  /** ✅ Φτάνει μέσα από το δέντρο της ίδιας της σελίδας. */
  VIA_PAGE: 'utilities-via-page',
  /** 🔶 Δηλωμένη σιωπή, με λόγο. */
  DECLARED: 'declared-silent',
});
const PAGE_BLOCKING = [PAGE_STATES.SILENT];
const PAGE_GAPS = [PAGE_STATES.DECLARED];
const PAGE_ORDER = [PAGE_STATES.SILENT, PAGE_STATES.DECLARED, PAGE_STATES.VIA_LAYOUT, PAGE_STATES.VIA_PAGE];

const DECL_STATES = Object.freeze({
  /** ⛔ Δήλωση για γειτονιά/σελίδα που δεν υπάρχει στον δίσκο. */
  ORPHAN: 'orphan-declaration',
  /** ⛔ Λόγος που λείπει ή είναι πολύ κοντός για να είναι μέτρηση. */
  REASONLESS: 'reasonless-declaration',
  /** ⛔ Δηλώθηκε σιωπηλή, αλλά ΟΝΤΩΣ φτάνει — δύο αλήθειες που διαφωνούν. */
  CONTRADICTED: 'contradicted-declaration',
  /** ✅ Δήλωση που στέκει. */
  HONOURED: 'honoured-declaration',
});
const DECL_BLOCKING = [DECL_STATES.ORPHAN, DECL_STATES.REASONLESS, DECL_STATES.CONTRADICTED];
const DECL_ORDER = [...DECL_BLOCKING, DECL_STATES.HONOURED];

const SYMBOL_STATES = Object.freeze({
  /** ⛔ Καθολικό σύμβολο συναρμολογημένο έξω από τον ιδιοκτήτη. */
  OUTSIDE_OWNER: 'assembled-outside-owner',
  /** ✅ Ο ίδιος ο ιδιοκτήτης. */
  OWNER_SITE: 'owner-site',
  /** ✅ Άγκυρα — δοκιμάζει, δεν συναρμολογεί. */
  TEST_SITE: 'test-site',
});
const SYMBOL_BLOCKING = [SYMBOL_STATES.OUTSIDE_OWNER];
const SYMBOL_ORDER = [...SYMBOL_BLOCKING, SYMBOL_STATES.OWNER_SITE, SYMBOL_STATES.TEST_SITE];

const OWNER_STATES = Object.freeze({
  /** ⛔ Ο δηλωμένος ιδιοκτήτης δεν υπάρχει. */
  MISSING: 'owner-missing',
  /** ⛔ Υπάρχει, αλλά δεν εισάγει και τα τρία — υπόσχεση χωρίς αντίκρισμα. */
  INCOMPLETE: 'owner-incomplete',
  /** ✅ */
  OK: 'owner-ok',
});
const OWNER_BLOCKING = [OWNER_STATES.MISSING, OWNER_STATES.INCOMPLETE];
const OWNER_ORDER = [...OWNER_BLOCKING, OWNER_STATES.OK];

// ---------------------------------------------------------------------------

function loadConfig(projectRoot) {
  const file = path.join(projectRoot, CONFIG_FILE);
  if (!fs.existsSync(file)) {
    // fail-closed: «δεν βρήκα το συμβόλαιο» ΠΟΤΕ «άρα όλα καλά».
    throw new Error(`CHECK 3.72: λείπει το ${CONFIG_FILE}`);
  }
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const key of ['owner', 'universalSymbols', 'groupsWithoutUtilities', 'pagesWithoutUtilities']) {
    if (cfg[key] === undefined) throw new Error(`CHECK 3.72: το ${CONFIG_FILE} δεν δηλώνει «${key}»`);
  }
  return cfg;
}

/** Κάθε αρχείο του `src/`, ως posix — ο γράφος το θέλει ολόκληρο. */
function collectFiles(projectRoot, dir = 'src', out = []) {
  const abs = path.join(projectRoot, dir);
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      collectFiles(projectRoot, rel, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) {
      out.push(toPosix(path.join(projectRoot, rel)));
    }
  }
  return out;
}

/**
 * Κ3 — κάθε σημείο εισαγωγής καθολικού συμβόλου, κρινόμενο κατά ιδιοκτήτη.
 *
 * ⚡ **ΠΡΟΦΙΛΤΡΟ ΚΕΙΜΕΝΟΥ** (πρότυπο CHECK 3.56/3.59/3.61): μόνο τα αρχεία που
 * **αναφέρουν** ειδικευτή περνούν από τον αναλυτή. Είναι ασφαλές **μόνο** επειδή
 * σφάλλει προς την **υπερ-συλλογή**: το φίλτρο δεν μπορεί να κρύψει εισαγωγή που
 * υπάρχει, γιατί κάθε εισαγωγή γράφει τον ειδικευτή της αυτολεξεί.
 *
 * ⚠️ **Ο ΑΝΑΛΥΤΗΣ ΜΕΝΕΙ ΚΡΙΤΗΣ, ΟΧΙ ΤΟ REGEX**: το ίδιο το `ShellUtilities`
 * γράφει τα τρία ονόματα και σε **πρόζα** μέσα στο docblock του, όπως και αυτό
 * το αρχείο. Κριτήριο κειμένου θα κοκκίνιζε πάνω στην **τεκμηρίωση της
 * θεραπείας** — το σχήμα `Κ7β` του CHECK 3.50.
 */
function auditSymbols(projectRoot, cfg, reach, files) {
  const owner = toPosix(path.join(projectRoot, cfg.owner));
  const findings = [];
  for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (!cfg.universalSymbols.some((s) => text.includes(s))) continue;

    const mod = reach.graph.modules.get(file);
    if (mod === undefined) continue;
    const specs = [...(mod.imports ?? []), ...(mod.reExports ?? [])].map((i) => i.spec);
    if (!specs.some((s) => cfg.universalSymbols.includes(s))) continue;
    const rel = toPosix(path.relative(projectRoot, file));
    // ⚠️ Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ: ο ιδιοκτήτης κρίνεται ΠΡΩΤΟΣ, αλλιώς ένας
    // ιδιοκτήτης που θα ζούσε κάτω από `__tests__` θα βαφόταν «άγκυρα».
    const state = file === owner
      ? SYMBOL_STATES.OWNER_SITE
      : /(^|\/)(__tests__|__mocks__)\//.test(rel) || /\.(test|spec)\.[tj]sx?$/.test(rel)
        ? SYMBOL_STATES.TEST_SITE
        : SYMBOL_STATES.OUTSIDE_OWNER;
    findings.push({ file: rel, state });
  }
  return findings;
}

/** Κ3 (β) — ο ιδιοκτήτης υπάρχει ΚΑΙ εισάγει **και τα τρία**. */
function auditOwner(projectRoot, cfg, reach) {
  const ownerAbs = toPosix(path.join(projectRoot, cfg.owner));
  const mod = reach.graph.modules.get(ownerAbs);
  if (!mod) return { file: cfg.owner, state: OWNER_STATES.MISSING, missing: cfg.universalSymbols };
  const specs = new Set([...(mod.imports ?? []), ...(mod.reExports ?? [])].map((i) => i.spec));
  const missing = cfg.universalSymbols.filter((s) => !specs.has(s));
  return missing.length > 0
    ? { file: cfg.owner, state: OWNER_STATES.INCOMPLETE, missing }
    : { file: cfg.owner, state: OWNER_STATES.OK, missing: [] };
}

/**
 * Κ1 — μία σελίδα.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΤΑΞΙΝΟΜΗΣΗΣ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**: η δήλωση κρίνεται **αφού**
 * απαντηθεί το «φτάνει;», αλλιώς μια δηλωμένη σιωπή που **έπαψε** να είναι σιωπή
 * θα έμενε αόρατη — και η δήλωση θα σάπιζε σιωπηλά (σχήμα CHECK 3.50).
 */
function classifyPage(pageRel, ctx) {
  const { projectRoot, cfg, reach, owner } = ctx;
  const abs = toPosix(path.join(projectRoot, pageRel));

  for (const layoutRel of TREE.ancestorLayoutsOf(pageRel, ctx.layouts, APP_DIR)) {
    const chain = reach.chainTo(toPosix(path.join(projectRoot, layoutRel)), owner);
    if (chain) return { file: pageRel, state: PAGE_STATES.VIA_LAYOUT, via: layoutRel };
  }
  if (reach.chainTo(abs, owner)) return { file: pageRel, state: PAGE_STATES.VIA_PAGE, via: pageRel };

  const group = TREE.rootGroupOf(pageRel, APP_DIR);
  if ((group !== null && cfg.groupsWithoutUtilities[group]) || cfg.pagesWithoutUtilities[pageRel]) {
    return { file: pageRel, state: PAGE_STATES.DECLARED, via: null };
  }
  return { file: pageRel, state: PAGE_STATES.SILENT, via: null };
}

/** Κ2 — οι δηλώσεις, και προς τις **δύο** κατευθύνσεις. */
function auditDeclarations(cfg, pageFindings, groupsOnDisk) {
  const findings = [];
  const reaching = new Set(
    pageFindings.filter((f) => f.state !== PAGE_STATES.SILENT && f.state !== PAGE_STATES.DECLARED)
      .map((f) => f.file),
  );
  const groupOf = (rel) => TREE.rootGroupOf(rel, APP_DIR);

  // ⚠️ **ΜΙΑ κρίση, ΔΥΟ είσοδοι** (ADR-811 / N.18): οι δύο βρόχοι ήταν
  //    token-ταυτόσημοι και το CHECK 3.28 τους ανέφερε ως κλώνο. Διαφέρουν
  //    **μόνο** σε δύο ερωτήματα — «υπάρχει;» και «τη διαψεύδει κάποιος;» —
  //    οπότε αυτά περνούν ως κατηγορήματα και η **σειρά κρίσης** (ορφανή →
  //    αδικαιολόγητη → διαψευσμένη → τιμημένη) ζει σε **ΕΝΑ** σημείο.
  const known = new Set(pageFindings.map((f) => f.file));
  const judge = (entries, prefix, exists, contradicted) => {
    for (const [key, decl] of Object.entries(entries)) {
      const id = `${prefix}/${key}`;
      if (!exists(key)) { findings.push({ file: id, state: DECL_STATES.ORPHAN }); continue; }
      if (typeof decl?.reason !== 'string' || decl.reason.trim().length < MIN_REASON) {
        findings.push({ file: id, state: DECL_STATES.REASONLESS }); continue;
      }
      // Δηλωμένη σιωπηλή, αλλά ΚΑΠΟΙΑ σελίδα της φτάνει ⇒ η δήλωση λέει ψέματα.
      if (contradicted(key)) { findings.push({ file: id, state: DECL_STATES.CONTRADICTED }); continue; }
      findings.push({ file: id, state: DECL_STATES.HONOURED });
    }
  };

  judge(
    cfg.groupsWithoutUtilities, 'groupsWithoutUtilities',
    (group) => groupsOnDisk.includes(group),
    (group) => pageFindings.some((f) => groupOf(f.file) === group && reaching.has(f.file)),
  );
  judge(
    cfg.pagesWithoutUtilities, 'pagesWithoutUtilities',
    (page) => known.has(page),
    (page) => reaching.has(page),
  );
  return findings;
}

function tally(findings, order, label) {
  const ledger = Object.fromEntries(order.map((s) => [s, 0]));
  for (const f of findings) {
    if (!(f.state in ledger)) {
      throw new Error(`CHECK 3.72: άγνωστη κατάσταση «${f.state}» στη λογιστική ${label}`);
    }
    ledger[f.state] += 1;
  }
  const summed = order.reduce((acc, s) => acc + ledger[s], 0);
  if (summed !== findings.length) {
    throw new Error(`CHECK 3.72: η λογιστική ${label} δεν κλείνει (${summed} ≠ ${findings.length})`);
  }
  return ledger;
}

function analyse(projectRoot, { readFile } = {}) {
  const cfg = loadConfig(projectRoot);
  const files = collectFiles(projectRoot);
  const reach = createReachability({
    projectRoot,
    files,
    readFile: readFile ?? ((f) => fs.readFileSync(f, 'utf8')),
  });

  const owner = toPosix(path.join(projectRoot, cfg.owner));
  const layouts = TREE.enumerateLayouts(projectRoot, APP_DIR);
  const pages = TREE.enumeratePages(projectRoot, APP_DIR);
  const groupsOnDisk = TREE.enumerateRootGroups(projectRoot, APP_DIR);

  const ctx = { projectRoot: toPosix(projectRoot), cfg, reach, owner, layouts };
  const pageFindings = pages.map((p) => classifyPage(p, ctx));
  const declFindings = auditDeclarations(cfg, pageFindings, groupsOnDisk);
  const symbolFindings = auditSymbols(projectRoot, cfg, reach, files);
  const ownerFinding = auditOwner(projectRoot, cfg, reach);

  return {
    cfg,
    pages: pageFindings,
    declarations: declFindings,
    symbols: symbolFindings,
    owner: ownerFinding,
    ledgers: {
      pages: tally(pageFindings, PAGE_ORDER, 'σελίδων'),
      declarations: tally(declFindings, DECL_ORDER, 'δηλώσεων'),
      symbols: tally(symbolFindings, SYMBOL_ORDER, 'συμβόλων'),
      owner: tally([ownerFinding], OWNER_ORDER, 'ιδιοκτήτη'),
    },
  };
}

function blockingOf(result) {
  const out = [];
  if (OWNER_BLOCKING.includes(result.owner.state)) out.push(result.owner);
  out.push(...result.symbols.filter((f) => SYMBOL_BLOCKING.includes(f.state)));
  out.push(...result.declarations.filter((f) => DECL_BLOCKING.includes(f.state)));
  out.push(...result.pages.filter((f) => PAGE_BLOCKING.includes(f.state)));
  return out;
}

// ---------------------------------------------------------------------------
// Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΕΔΩ, ΟΧΙ ΣΤΟΝ ΚΑΛΟΥΝΤΑ — αλλιώς θα ήταν δεύτερη αυθεντία
// (σχήμα CHECK 3.34: δύο λίστες που απέκλιναν κατά 63).
// ---------------------------------------------------------------------------
const TRIGGER_RE = [
  /^src\/app\/.*\/(page|layout)\.(tsx|jsx)$/,
  /^src\/app\/(page|layout)\.(tsx|jsx)$/,
  /^src\/core\/containers\/ShellUtilities\.tsx$/,
  /^src\/components\/header\/(language-switcher|theme-toggle|user-menu)\.tsx$/,
  /^src\/components\/(app-header|public-site\/PublicSiteHeader)\.tsx$/,
  /^src\/auth\/components\/AuthScreenChrome\.tsx$/,
  /^\.shell-utilities\.json$/,
  // ⚠️ Ο ΙΔΙΟΣ Ο ΚΩΔΙΚΑΣ ΤΗΣ ΠΥΛΗΣ: αλλιώς αλλαγή στο κριτήριο περνά χωρίς να
  // ασκηθεί ποτέ το κριτήριο (μάθημα CHECK 3.43/3.57).
  /^scripts\/check-shell-utilities\.js$/,
  /^scripts\/lib\/shell-utilities\//,
];
const triggers = (files) => files.some((f) => TRIGGER_RE.some((re) => re.test(f)));

function printLedger(name, ledger, blocking, gaps = []) {
  console.log(`\n  ${name}`);
  for (const [state, count] of Object.entries(ledger)) {
    // ⚠️ Οι μπλοκάροντες κάδοι τυπώνονται **ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ**: ένα «0» που
    // δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος» (CHECK 3.48 Κ6).
    const mark = blocking.includes(state) ? '⛔' : gaps.includes(state) ? '🔶' : '✅';
    console.log(`    ${mark} ${state.padEnd(28)} ${count}`);
  }
}

function main(argv) {
  if (process.env.SKIP_SHELL_UTILITIES === '1') return 0;

  const projectRoot = process.cwd();
  const report = argv.includes('--report');
  const all = argv.includes('--all') || report;
  const staged = argv.filter((a) => !a.startsWith('-'));
  if (!all && staged.length > 0 && !triggers(staged)) return 0;

  const result = analyse(projectRoot);

  if (report) {
    console.log('\nCHECK 3.72 — απογραφή καθολικών δυνατοτήτων (ADR-809)');
    console.log(`  ιδιοκτήτης: ${result.cfg.owner}  [${result.owner.state}]`);
    printLedger('οθόνες', result.ledgers.pages, PAGE_BLOCKING, PAGE_GAPS);
    printLedger('δηλώσεις', result.ledgers.declarations, DECL_BLOCKING);
    printLedger('σημεία συναρμολόγησης', result.ledgers.symbols, SYMBOL_BLOCKING);
    console.log('');
    return 0;
  }

  const blocked = blockingOf(result);
  if (blocked.length > 0) {
    console.log(`\n${RED}══════════════════════════════════════════════════════════════════${NC}`);
    console.log(`${RED}  🚫 COMMIT BLOCKED — καθολικές δυνατότητες (CHECK 3.72 · ADR-809)${NC}`);
    console.log(`${RED}══════════════════════════════════════════════════════════════════${NC}\n`);
    for (const f of blocked.slice(0, 25)) console.log(`  ❌ ${f.file}  [${f.state}]`);
    if (blocked.length > 25) console.log(`  … και άλλα ${blocked.length - 25}`);
    console.log(`\n  ${YELLOW}Η γλώσσα, το θέμα και ο λογαριασμός δεν είναι χαρακτηριστικά της${NC}`);
    console.log(`  ${YELLOW}εφαρμογής — είναι υποσχέσεις του κελύφους σε ΚΑΘΕ οθόνη.${NC}`);
    console.log(`  ${YELLOW}Φέρε τη σελίδα κάτω από layout που αποδίδει <ShellUtilities/>,${NC}`);
    console.log(`  ${YELLOW}ή δήλωσέ τη στο ${CONFIG_FILE} με ΜΕΤΡΗΜΕΝΟ λόγο (≥${MIN_REASON} χαρακτήρες).${NC}\n`);
    return 1;
  }

  const { pages } = result.ledgers;
  console.log(
    `${GREEN}✅ CHECK 3.72 — καθολικές δυνατότητες καθαρές${NC} ` +
    `(${pages[PAGE_STATES.VIA_LAYOUT]} από layout · ${pages[PAGE_STATES.VIA_PAGE]} από σελίδα · ` +
    `${pages[PAGE_STATES.DECLARED]} δηλωμένα σιωπηλές)`,
  );
  return 0;
}

module.exports = {
  PAGE_STATES, PAGE_BLOCKING, PAGE_ORDER,
  DECL_STATES, DECL_BLOCKING, DECL_ORDER,
  SYMBOL_STATES, SYMBOL_BLOCKING, SYMBOL_ORDER,
  OWNER_STATES, OWNER_BLOCKING, OWNER_ORDER,
  MIN_REASON, CONFIG_FILE,
  loadConfig, collectFiles, auditSymbols, auditOwner, classifyPage, auditDeclarations,
  tally, analyse, blockingOf, triggers, main,
};

if (require.main === module) process.exit(main(process.argv.slice(2)));
