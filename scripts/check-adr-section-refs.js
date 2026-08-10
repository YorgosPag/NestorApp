#!/usr/bin/env node
'use strict';

/**
 * =============================================================================
 * CHECK 3.53 — ΠΥΛΗ ΤΑΥΤΟΤΗΤΑΣ ΕΝΟΤΗΤΩΝ ADR   (ADR-739 §0.3 · ADR-777 §0.4)
 * =============================================================================
 *
 * «Επιλύεται κάθε δείκτης `ADR-NNN §X` σε **ακριβώς μία** ενότητα **ακριβώς ενός**
 *  εγγράφου της οικογένειας;»
 *
 * ## ΤΟ ΜΕΤΡΗΜΕΝΟ ΓΕΓΟΝΟΣ
 * Το `ADR-739-canvas-table-system.md` δεν είναι έγγραφο — είναι **χώρος ονομάτων**:
 * **1.104** δείκτες `ADR-739 §NN` από tracked αρχεία (996 σε `src/subapps`, 82 σε
 * `docs`, 5 στο `.ssot-registry.json`, **1 στο ίδιο το `CLAUDE.md`**, **1 στο
 * `.ci-gate-tiers.json`**), **1.394** εσωτερικοί μέσα στο ίδιο το αρχείο, και **586**
 * φασικοί (`Φ.Δ`, `Φ.Ε`…). **Κανείς δεν τους επικύρωνε ποτέ — και είχαν ήδη αποκλίνει
 * σε επτά σημεία**: `§48.11` · `§48.13` · `§8390` · `§67.11` δεν υπάρχουν **πουθενά**
 * (το `§67.11` το γράφει **το ίδιο το Changelog** του ADR)· `§59.6.3` · `§4.3` · `§6.6`
 * υπάρχουν μόνο μέσα σε πρόζα.
 *
 * 🔴 Το χειρότερο: το `scripts/check-empty-select-item.js:10` — **η ίδια η πύλη
 * CHECK 3.48** — τεκμηριώνει την αιτία ύπαρξής της ως «*ADR-739 §59.6.3*», δείκτη που
 * **δεν είναι ενότητα**. Ένας φρουρός που παραπέμπει στο πουθενά.
 *
 * ## ΓΙΑΤΙ ΚΑΜΙΑ ΥΠΑΡΧΟΥΣΑ ΠΥΛΗ ΔΕΝ ΤΟ ΕΒΛΕΠΕ
 * Το **CHECK 3.49** ρωτά «απαντά ο **αριθμός ADR** σε ένα έγγραφο;» και σαρώνει με
 * `/^ADR-(\d+)/` ⇒ βλέπει **ονόματα αρχείων**, ποτέ **ενότητες**. Το ADR-777 §0.4
 * ορίζει ρητά «συμβόλαιο δεσμών» και δηλώνει ότι η κλειστή λογιστική είναι «*μηχανικά
 * ελέγξιμη και όχι υπόσχεση*» — **και καμία πύλη δεν το εκτελούσε** (επαληθεύτηκε:
 * μηδέν αρχεία σε `scripts/`/`.github/` αναφέρουν `specified-by`/`parent: ADR-`).
 * Σχήμα **CHECK 3.36**: *ένα anchor χωρίς gate είναι σχόλιο.*
 *
 * ## ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ (ερευνήθηκε πριν γραφτεί γραμμή)
 *  · **Kubernetes KEP** — `kep.yaml` με schema, επικυρωμένο από `kepctl` **στο CI**·
 *    τρέχει σε **ό,τι δήλωσε** `kep.yaml`, όχι σε κάθε αρχείο του δέντρου.
 *  · **Python PEP 1** — `Requires:`/`Replaces:`/`Superseded-By:`, **υποχρεωτικά
 *    αμφίδρομα** («*the newer PEP must have a Replaces header*»), με header linter.
 *  · **ISO/IEC/IEEE 42010** — correspondence rules που **επιβάλλουν** ιχνηλασιμότητα.
 *  · **Figma node-id · Revit ElementId** — *το ID είναι μόνιμο συμβόλαιο· η θέση αλλάζει.*
 *
 * Και τα τέσσερα λένε το ίδιο: **αριθμοί αμετάβλητοι, δεσμοί αμφίδρομοι, επιβολή
 * μηχανική**. Εδώ υιοθετούνται και τα τρία — το τρίτο έλειπε.
 *
 * ## ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΔΗΛΩΣΕΩΝ (`.adr-section-refs.json`)
 * Φυλάσσεται **ό,τι δηλώνεται** — πρότυπο KEP. Δεν σαρώνονται τυφλά τα 812 ADR: μόλις
 * **8/824** έγγραφα έχουν frontmatter, οπότε καθολική επιβολή θα παρήγαγε θόρυβο πολύ
 * πάνω από τον πήχη <10% ψευδώς θετικών — και μια μονίμως κόκκινη πύλη παρακάμπτεται
 * με `SKIP_`, δηλαδή γίνεται διακοσμητική (δοκιμάστηκε και απορρίφθηκε στο 3.39).
 * ⚠️ Νέα οικογένεια που σπάει σε SPEC **χωρίς δήλωση εδώ** δεν φυλάσσεται· γι' αυτό η
 * κατάσταση `unbonded` **τυπώνεται πάντα**: το «δεν κοίταξα» δεν επιτρέπεται να
 * μοιάζει με «καθαρό».
 *
 * ## ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ
 *  · ⛔ **ZERO-TOL** — `dangling-section` · `ambiguous-section` · `orphan-section` ·
 *    `broken-bond`. **ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline**: το `buildPayload` αρνείται.
 *    *Ένα zero-tol που κλειδώνεται με ένα `--write-baseline` δεν είναι zero-tol.*
 *  · 🔴 **RATCHET κατά ταυτότητα** — `prose-only` (3 ζωντανές). Ταυτότητα =
 *    `οικογένεια §ενότητα`, **χωρίς γραμμή**: μετακίνηση ≠ add+remove.
 *
 * ⚠️ **ΜΗΝ** λύσεις κόκκινο `dangling` σβήνοντας τον δείκτη από τον κώδικα χωρίς να
 * δεις τι εννοούσε — ο δείκτης είναι **η ερώτηση**, όχι ο θόρυβος.
 * ⚠️ **ΜΗΝ** επαναριθμήσεις ενότητα για να «τακτοποιηθεί»: ~2.500 δείκτες.
 * ⚠️ **ΜΗΝ** το κάνεις zero-tol στο σύνολο (οι 3 prose-only είναι ζωντανές).
 *
 * Escape: `SKIP_ADR_SECTION_REFS=1`
 * @module scripts/check-adr-section-refs
 */

const fs = require('node:fs');
const path = require('node:path');

const S = require('./lib/adr-sections/scan');
const R = require('./lib/adr-sections/resolve');
const { loadBaseline, writeBaselineFile, compareSets } = require('./lib/ratchet-baseline');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

const CONFIG_FILE = '.adr-section-refs.json';
const BASELINE_FILE = '.adr-section-refs-baseline.json';

/** Μόνο κείμενο· δυαδικά αρχεία δεν γράφουν δείκτες. */
const TEXTUAL = /\.(md|ts|tsx|js|jsx|cjs|mjs|json|ya?ml|sh|css)$/i;

/**
 * 🔴 **ΤΟ ΚΑΤΑΣΤΙΧΟ ΜΙΑΣ ΠΥΛΗΣ ΔΕΝ ΕΙΝΑΙ ΕΙΣΟΔΟΣ ΤΗΣ.**
 *
 * Πιάστηκε ζωντανά: η baseline καταγράφει ταυτότητες όπως `"ADR-739 §48.10"`, και ο
 * σαρωτής τις διάβασε ως **αναφορές** — δηλαδή κάθε καταγραφή γεννούσε **νέο** εύρημα,
 * που με τη σειρά του θα γραφόταν στην επόμενη baseline. Ένας βρόχος που τροφοδοτεί
 * τον εαυτό του και δεν συγκλίνει ποτέ. Το ίδιο ισχύει για το config: τα πεδία `why`
 * **περιγράφουν** τη βλάβη, δεν την ασκούν.
 */
const SELF_METADATA = new Set([CONFIG_FILE, BASELINE_FILE]);

function loadConfig(projectRoot) {
  const file = path.join(projectRoot, CONFIG_FILE);
  if (!fs.existsSync(file)) throw new Error(`CHECK 3.53: λείπει το ${CONFIG_FILE}`);
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!cfg.families || Object.keys(cfg.families).length === 0) {
    throw new Error(`CHECK 3.53: ${CONFIG_FILE} — κενό «families»· κλειστό σύνολο χωρίς μέλη είναι φρουρός που δεν μπορεί να πυροδοτήσει`);
  }
  for (const [id, fam] of Object.entries(cfg.families)) {
    if (!fam.hub) throw new Error(`CHECK 3.53: η οικογένεια ${id} δεν δηλώνει «hub»`);
    if (!fam.why) throw new Error(`CHECK 3.53: η οικογένεια ${id} δεν δηλώνει «why» — ο λόγος είναι υποχρεωτικός`);
  }
  return cfg;
}

function analyse(projectRoot) {
  const cfg = loadConfig(projectRoot);
  const familyIds = Object.keys(cfg.families);

  const families = new Map();
  const memberOf = new Map();
  for (const [id, famCfg] of Object.entries(cfg.families)) {
    const fam = R.buildFamily(projectRoot, id, famCfg);
    families.set(id, fam);
    for (const f of fam.files) memberOf.set(f.rel, id);
  }

  const refs = [];
  for (const rel of S.listIndexedFiles(projectRoot)) {
    if (!TEXTUAL.test(rel) || SELF_METADATA.has(rel)) continue;
    const text = S.readText(projectRoot, rel);
    if (text === null) continue;
    if (!familyIds.some(id => text.includes(id)) && !memberOf.has(rel)) continue;
    refs.push(...S.scanReferences(text, { file: rel, familyIds, ownFamily: memberOf.get(rel) || null }));
  }

  const refFindings = refs.map(r => R.classifyRef(r, families.get(r.family)));

  const docFindings = [];
  for (const fam of families.values()) {
    for (const f of fam.files) {
      if (f.missing) { docFindings.push({ state: R.DOC_STATES.BROKEN_BOND, file: f.rel, why: 'δηλωμένο μέλος που δεν υπάρχει' }); continue; }
      docFindings.push(...R.auditSectionLedger(f));
    }
    docFindings.push(...R.auditDuplicateHeadings(fam));
    docFindings.push(...R.auditBonds(fam));
  }

  return {
    cfg,
    families,
    refs: refFindings,
    docs: docFindings,
    ledgers: {
      refs: R.tally(refFindings, R.REF_ORDER, 'δεικτών'),
      docs: R.tally(docFindings, R.DOC_ORDER, 'εγγράφων'),
    },
  };
}

const blockingOf = result => [
  ...result.refs.filter(f => R.REF_BLOCKING.includes(f.state)),
  ...result.docs.filter(f => R.DOC_BLOCKING.includes(f.state)),
];

/**
 * Ταυτότητα ratchet: `οικογένεια §ενότητα`, **χωρίς γραμμή και χωρίς πλήθος**.
 * Χωρίς γραμμή, γιατί μετακίνηση δεν είναι add+remove. Χωρίς πλήθος, γιατί μια νόμιμη
 * μείωση 13→2 δεικτών θα φαινόταν «νέα παραβίαση» και η πύλη θα μπλόκαρε τη θεραπεία
 * (μάθημα CHECK 3.49 `Κ2`).
 */
function ratchetIds(result) {
  const refBy = state => [
    ...new Set(result.refs.filter(f => f.state === state).map(f => `${f.family} §${f.section}`)),
  ].sort();
  return {
    dangling: refBy(R.REF_STATES.DANGLING),
    ambiguous: refBy(R.REF_STATES.AMBIGUOUS),
    proseOnly: refBy(R.REF_STATES.PROSE_ONLY),
    // ⚠️ Ταυτότητα κατά ΟΙΚΟΓΕΝΕΙΑ, όχι κατά αρχείο. Η πρώτη γραφή έλεγε `file §id` και
    // το σπάσιμο του ADR-739 τη μετέτρεψε αμέσως σε ψευδή παλινδρόμηση: οι ίδιες τρεις
    // διπλές επικεφαλίδες απλώς **μετακόμισαν** σε SPEC. Το ίδιο λάθος που ο σχολιασμός
    // από πάνω απέφευγε ρητά για τους δείκτες — και επαναλήφθηκε εδώ.
    duplicateHeading: [
      ...new Set(result.docs.filter(f => f.state === R.DOC_STATES.DUPLICATE_HEADING).map(f => `${f.family} §${f.section}`)),
    ].sort(),
  };
}

const RATCHET_KEYS = ['dangling', 'ambiguous', 'proseOnly', 'duplicateHeading'];

/** 🔴 Το zero-tolerance ΔΕΝ γράφεται ΠΟΤΕ σε baseline. */
function buildPayload(result) {
  const blocked = blockingOf(result);
  if (blocked.length > 0) {
    throw new Error(
      `CHECK 3.53: άρνηση εγγραφής baseline — υπάρχουν ${blocked.length} zero-tolerance ευρήματα. ` +
      'Ένα zero-tol που κλειδώνεται με --write-baseline δεν είναι zero-tol.',
    );
  }
  return { adr: 'ADR-739 §0.3 / ADR-777 §0.4', check: '3.53', ...ratchetIds(result) };
}

// ---------------------------------------------------------------------------
// Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΕΔΩ — λίστα στον καλούντα θα ήταν δεύτερη αυθεντία (μάθημα 3.44/3.52).
// ---------------------------------------------------------------------------
const TRIGGER_RE = [
  /(^|\/)ADR-\d+[^/]*\.md$/,
  /(^|\/)SPEC-[^/]*\.md$/,
  /^\.adr-section-refs(-baseline)?\.json$/,
  /^scripts\/check-adr-section-refs\.js$/,
  /^scripts\/lib\/adr-sections\//,
];
const triggers = files => files.some(f => TRIGGER_RE.some(re => re.test(f)));

function printLedger(name, ledger, blocking, ratcheted = []) {
  console.log(`\n  ${name}`);
  for (const [state, count] of Object.entries(ledger)) {
    const mark = blocking.includes(state) ? '⛔' : ratcheted.includes(state) ? '🔴' : state === 'phase-label' || state === 'unbonded' ? '🔶' : '✅';
    console.log(`    ${mark} ${state.padEnd(20)} ${String(count).padStart(6)}`);
  }
}

function report(result) {
  console.log('\nCHECK 3.53 — απογραφή ταυτότητας ενοτήτων ADR');
  for (const fam of result.families.values()) {
    const present = fam.files.filter(f => !f.missing).length;
    console.log(`  ${fam.id}: ${present}/${fam.files.length} αρχεία · ${fam.byId.size} μοναδικές ενότητες`);
  }
  printLedger('δείκτες', result.ledgers.refs, R.REF_BLOCKING, R.REF_RATCHETED);
  printLedger('έγγραφα', result.ledgers.docs, R.DOC_BLOCKING, R.DOC_RATCHETED);
  const ids = ratchetIds(result);
  for (const key of RATCHET_KEYS) {
    if (ids[key].length > 0) console.log(`\n  🔴 ${key} (${ids[key].length}): ${ids[key].join(' · ')}`);
  }
  console.log('');
}

function main(argv) {
  if (process.env.SKIP_ADR_SECTION_REFS === '1') return 0;

  const projectRoot = process.cwd();
  const wantReport = argv.includes('--report');
  const writeBaseline = argv.includes('--write-baseline');
  const all = argv.includes('--all') || wantReport || writeBaseline;
  const staged = argv.filter(a => !a.startsWith('-'));

  if (!all && staged.length > 0 && !triggers(staged)) return 0;

  const result = analyse(projectRoot);

  if (wantReport) { report(result); return 0; }

  if (writeBaseline) {
    const payload = buildPayload(result);
    writeBaselineFile(path.join(projectRoot, BASELINE_FILE), payload);
    const totals = RATCHET_KEYS.map(k => `${k} ${payload[k].length}`).join(' · ');
    console.log(`${GREEN}✅ CHECK 3.53 — baseline γράφτηκε (${totals})${NC}`);
    return 0;
  }

  const blocked = blockingOf(result);
  if (blocked.length > 0) {
    console.log(`\n${RED}═══════════════════════════════════════════════════════════════${NC}`);
    console.log(`${RED}  🚫 COMMIT BLOCKED — ταυτότητα ενοτήτων ADR (CHECK 3.53)${NC}`);
    console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}\n`);
    for (const f of blocked.slice(0, 40)) {
      const where = f.line ? `${f.file}:${f.line}` : f.file;
      const what = f.section ? `§${f.section}` : f.why || '';
      console.log(`  ❌ ${where}  ${what}  [${f.state}]`);
    }
    if (blocked.length > 40) console.log(`  … και άλλα ${blocked.length - 40}`);
    console.log(`\n  ${YELLOW}Ο αριθμός ενότητας είναι ΣΥΜΒΟΛΑΙΟ — δεν επαναριθμείται ποτέ.${NC}`);
    console.log(`  ${YELLOW}Είτε η ενότητα λείπει, είτε ο δείκτης δείχνει λάθος: διόρθωσε τον δείκτη.${NC}\n`);
    return 1;
  }

  const baseline = loadBaseline(path.join(projectRoot, BASELINE_FILE));
  const current = ratchetIds(result);
  if (baseline) {
    const regressions = [];
    for (const key of RATCHET_KEYS) {
      if (!Array.isArray(baseline[key])) continue;
      for (const id of compareSets(current[key], baseline[key]).added) regressions.push({ key, id });
    }
    if (regressions.length > 0) {
      console.log(`\n${RED}🚫 CHECK 3.53 — νέες παραβιάσεις ταυτότητας ενοτήτων (ratchet):${NC}\n`);
      for (const r of regressions) console.log(`  ❌ [${r.key}] ${r.id}`);
      console.log(`\n  ${YELLOW}Ο αριθμός ενότητας είναι ΣΥΜΒΟΛΑΙΟ — δεν επαναριθμείται ποτέ.${NC}`);
      console.log(`  ${YELLOW}Δώσε στην ενότητα πραγματική, ΜΟΝΑΔΙΚΗ επικεφαλίδα, ή διόρθωσε τον δείκτη.${NC}\n`);
      return 1;
    }
  }

  const { refs } = result.ledgers;
  const open = RATCHET_KEYS.reduce((a, k) => a + current[k].length, 0);
  console.log(
    `${GREEN}✅ CHECK 3.53 — ταυτότητα ενοτήτων ADR καθαρή${NC} ` +
    `(${refs[R.REF_STATES.RESOLVED]} δείκτες επιλύονται · ${refs[R.REF_STATES.PHASE_LABEL]} φασικοί · ${open} σε ratchet)`,
  );
  return 0;
}

module.exports = {
  CONFIG_FILE, BASELINE_FILE, RATCHET_KEYS,
  loadConfig, analyse, blockingOf, ratchetIds, buildPayload, triggers, main,
};

if (require.main === module) process.exit(main(process.argv.slice(2)));
