/**
 * **RATCHET ΑΝΑ ΑΡΧΕΙΟ** (ADR-924 Φ3) — ο ΕΝΑΣ πυρήνας των πυλών που μετρούν «πόσα ευρήματα έχει κάθε αρχείο» και
 * μπλοκάρουν όταν ένα αρχείο ξεπερνά τη baseline του (`{ files: { rel: n } }` · νέο αρχείο = μηδενική ανοχή):
 * 3.20 · 3.23 · 3.24 · 3.25 · 3.26 · 3.27.
 *
 * 🔴 ΓΙΑΤΙ: έξι πύλες κουβαλούσαν έξι αντίγραφα του ίδιου σκελετού — περιπατητή `readdirSync`, `loadBaseline`,
 * βρόχο κρίσης, `writeBaseline` — και ΟΛΕΣ διάβαζαν τον ΔΙΣΚΟ με ωμό `fs`, όπου ζει και η ξένη αστάδιοποίητη δουλειά.
 * Εδώ κάθε ανάγνωση περνά από την **είσοδο** της πύλης (`gate-input`): με `--index` κρίνεται το commit.
 *
 * Τι ΔΕΝ ζει εδώ, επίτηδες: το **κριτήριο** (`findHits`) και η **αναφορά** — κάθε πύλη μιλά τη δική της γλώσσα.
 * ⚠️ Η baseline **γράφεται** πάντα στον δίσκο (γεννήτορας), με κλειδιά ταξινομημένα — ντετερμινιστική σε κάθε ΛΣ.
 *
 * @module scripts/lib/per-file-ratchet
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { commitInput } = require('./gate-input');

/** Φάκελοι που οι περιπατητές των ratchet κλάδευαν ΚΑΤΑ ΟΝΟΜΑ (οι φάκελοι εργαλείων κλαδεύονται πάντα από την είσοδο). */
const pruneTestDirs = (dir) => /(^|\/)__tests__\/$/.test(dir);

/** Οι μετρήσεις της baseline από την ΕΙΣΟΔΟ — λείπει ή δεν διαβάζεται ⇒ `{}` (η συμπεριφορά και των έξι). */
function loadFileCounts(baselineFile, input) {
  const text = input.read(baselineFile);
  if (text === null) return {};
  try {
    return JSON.parse(text).files ?? {};
  } catch {
    return {};
  }
}

/**
 * Κάθε αρχείο του πεδίου κάτω από τις `roots`, σχετικό posix — από την ΕΙΣΟΔΟ (στο ευρετήριο: χωρίς untracked).
 * @param {object} input η είσοδος της πύλης
 * @param {string[]} roots
 * @param {(rel: string) => boolean} inScope
 * @param {(dir: string) => boolean} [pruneDir]
 */
function scopeFiles(input, roots, inScope, pruneDir) {
  return input.files(roots, { accept: inScope, pruneDir }).map(input.rel);
}

/**
 * Τα ευρήματα κάθε αρχείου: `[{ file, hits }]` — ΚΑΙ τα μηδενικά (ο καλών αποφασίζει). Ορίσματα σχετικά ή απόλυτα·
 * όσα λείπουν από την όψη ή είναι εκτός πεδίου **παραλείπονται** (σβησμένο αρχείο δεν κρίνεται).
 * @param {string[]} files
 * @param {{input: object, inScope: (rel: string) => boolean, findHits: (text: string, rel: string) => object[]}} spec
 */
function scanFiles(files, { input, inScope, findHits }) {
  const out = [];
  for (const file of files) {
    const rel = input.rel(file);
    if (!inScope(rel) || !input.exists(rel)) continue;
    out.push({ file: rel, hits: findHits(input.read(rel), rel) });
  }
  return out;
}

/**
 * Η κρίση: κάθε σαρωμένο αρχείο έναντι της baseline. `improved` = λιγότερα από τη baseline · `blocked` = περισσότερα
 * (`isNew` όταν η baseline δεν το ξέρει). Ίσο ⇒ τίποτα.
 */
function judgeCounts(scanned, baseline) {
  const improved = [];
  const blocked = [];
  for (const { file, hits } of scanned) {
    const current = hits.length;
    const base = baseline[file] ?? 0;
    if (current < base) improved.push({ file, from: base, to: current, hits });
    else if (current > base) blocked.push({ file, current, base, isNew: base === 0, hits });
  }
  return { improved, blocked };
}

/**
 * Γράφει τη baseline στον ΔΙΣΚΟ: μόνο αρχεία με ευρήματα, κλειδιά ταξινομημένα. `metaOf(totals)` = το `_meta` της πύλης.
 * @returns {{totalFiles: number, totalViolations: number}}
 */
function writeFileCounts(baselineFile, scanned, metaOf, root = process.cwd()) {
  const counted = scanned.filter(({ hits }) => hits.length > 0)
    .sort((a, b) => a.file.localeCompare(b.file));
  const files = Object.fromEntries(counted.map(({ file, hits }) => [file, hits.length]));
  const totals = { totalFiles: counted.length, totalViolations: counted.reduce((sum, { hits }) => sum + hits.length, 0) };
  const payload = { _meta: metaOf(totals), files };
  fs.writeFileSync(path.resolve(root, baselineFile), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return totals;
}

const BANNER = '═'.repeat(63);
const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', nc: '\x1b[0m' };

/**
 * Η αναφορά «με πανό» (3.23 · 3.24 · 3.25 — ήταν τρία αντίγραφα): μείωση ⇒ «RATCHET DOWN» · αύξηση ⇒ «COMMIT BLOCKED»
 * με κάθε εύρημα (`describeHit`). Επιστρέφει αν μπλοκάρει· τις οδηγίες διόρθωσης τις τυπώνει ο καλών.
 * @param {{improved: object[], blocked: object[]}} verdict
 * @param {{downTitle: string, downCommand: string, blockedTitle: string, blockedSubtitle: string, newNoun: string,
 *          describeHit: (hit: object) => string}} spec
 */
function printBannerVerdict({ improved, blocked }, spec, log = console.log) {
  if (improved.length) {
    log(`\n${C.green}${BANNER}${C.nc}`);
    log(`${C.green}  🎯 RATCHET DOWN — ${spec.downTitle}${C.nc}`);
    log(`${C.green}${BANNER}${C.nc}`);
    for (const { file, from, to } of improved) log(`  ✅ ${file}: ${from} → ${to} (-${from - to})`);
    log(`\n  ${C.yellow}Run after commit: npm run ${spec.downCommand}${C.nc}\n`);
  }
  if (!blocked.length) return false;
  log(`\n${C.red}${BANNER}${C.nc}`);
  log(`${C.red}  🚫 COMMIT BLOCKED — ${spec.blockedTitle}${C.nc}`);
  log(`${C.red}  ${spec.blockedSubtitle}${C.nc}`);
  log(`${C.red}${BANNER}${C.nc}\n`);
  for (const { file, current, base, isNew, hits } of blocked) {
    if (isNew) {
      log(`  ❌ ${file} (NEW FILE — zero tolerance)`);
      log(`     Found ${current} ${spec.newNoun}`);
    } else {
      log(`  ❌ ${file}`);
      log(`     Baseline: ${base} → Current: ${current} (+${current - base})`);
    }
    for (const hit of hits) log(`     ${spec.describeHit(hit)}`);
    log();
  }
  return true;
}

const L = { red: '\x1b[0;31m', green: '\x1b[0;32m', yellow: '\x1b[1;33m', nc: '\x1b[0m' };

/**
 * Η αναφορά «γραμμή ανά αρχείο» (3.20 · 3.26 · 3.27 — ήταν τρία αντίγραφα του βρόχου): 📉 μείωση · 🚫 αύξηση με τα
 * **νέα** ευρήματα (τα τελευταία `n`). Επιστρέφει αν μπλοκάρει.
 * @param {{file: string, hits: object[]}[]} scanned
 * @param {Record<string, number>} baseline
 * @param {{noun: string, newNoun: string, describeHit: (hit: object) => string,
 *          deferReductions?: boolean, migrated?: string, extra?: (entry: object) => boolean, showTotals?: boolean}} spec
 *   `deferReductions` = οι μειώσεις τυπώνονται ΜΕΤΑ τα μπλοκαρίσματα · `migrated` = μήνυμα για αρχείο που έπεσε στο 0 ·
 *   `showTotals: false` = η γραμμή 🚫 χωρίς «(total, baseline)» (3.12 · 3.13) ·
 *   `extra(entry)` = ό,τι ΑΛΛΟ κρίνει η πύλη ανά αρχείο, πριν τη μέτρηση (true ⇒ μπλοκάρει).
 */
function printLineVerdict(scanned, baseline, spec, log = console.log) {
  let hasBlock = false;
  const reductions = [];
  const reduce = (line) => (spec.deferReductions ? reductions.push(line) : log(line));
  for (const entry of scanned) {
    if (spec.extra && spec.extra(entry)) hasBlock = true;
    const { file, hits } = entry;
    const base = baseline[file] ?? 0;
    const current = hits.length;
    if (current === 0) {
      if (base && spec.migrated) reduce(`${L.green}  📉 ${file}: ${base} → 0 ${spec.migrated}${L.nc}`);
      continue;
    }
    if (current <= base) {
      if (current < base) reduce(`${L.green}  📉 ${file}: ${base} → ${current} (-${base - current}) ${spec.noun}${L.nc}`);
      continue;
    }
    hasBlock = true;
    const added = current - base;
    const totals = spec.showTotals === false ? '' : ` (total ${current}, baseline ${base})`;
    log(`${L.red}  🚫 ${file}: ${added} ${spec.newNoun}${totals}${L.nc}`);
    for (const hit of hits.slice(-added)) log(`${L.yellow}     Line ${hit.line}: ${spec.describeHit(hit)}${L.nc}`);
  }
  for (const line of reductions) log(line);
  return hasBlock;
}

/**
 * Το CLI «με πανό» (3.23 · 3.24 · 3.25 — τρία αντίγραφα του ίδιου `main`): `--write-baseline` ⇒ πλήρης σάρωση και
 * baseline στον δίσκο · `--all` ⇒ πλήρης κρίση · αλλιώς τα ορίσματα (σταδιοποιημένα). Επιστρέφει τον κωδικό εξόδου.
 * @param {string[]} argv
 * @param {object} input η είσοδος της πύλης
 * @param {{baselineFile: string, inScope: (rel: string) => boolean, findHits: (text: string, rel: string) => object[],
 *          collectAll: (input: object) => string[], meta: {description: string, rule: string},
 *          banner: object, printFix: () => void}} spec `banner` = το `spec` του `printBannerVerdict`
 */
function runBannerRatchet(argv, input, spec) {
  const full = argv.includes('--all') || argv.includes('--write-baseline');
  const files = full ? spec.collectAll(input) : argv.filter((a) => !a.startsWith('--'));
  const scanned = scanFiles(files, { input, inScope: spec.inScope, findHits: spec.findHits });
  if (argv.includes('--write-baseline')) {
    const { totalFiles, totalViolations } = writeFileCounts(spec.baselineFile, scanned, (totals) => ({
      description: spec.meta.description,
      generated: new Date().toISOString(),
      totalViolations: totals.totalViolations,
      totalFiles: totals.totalFiles,
      rule: spec.meta.rule,
    }), input.root);
    console.log(`✅ Baseline written: ${spec.baselineFile}`);
    console.log(`   Files: ${totalFiles} | Violations: ${totalViolations}`);
    return 0;
  }
  if (!files.length) return 0;
  if (!printBannerVerdict(judgeCounts(scanned, loadFileCounts(spec.baselineFile, input)), spec.banner)) return 0;
  spec.printFix();
  return 1;
}

/**
 * Η πύλη «με πανό» ως `run(argv, input)`: η είσοδος του `main` είναι η όψη του commit όταν τη ζητά ο εκτελεστής
 * (`--index`), αλλιώς ο δίσκος της `spec.root` (χωρίς `root`: ο τρέχων φάκελος τη στιγμή της κλήσης).
 */
function defineBannerGate(spec) {
  return (argv = process.argv.slice(2), input = commitInput(spec.root || process.cwd(), argv)) =>
    runBannerRatchet(argv, input, spec);
}

/**
 * Οι λειτουργίες των πυλών «γραμμή ανά αρχείο» (3.26 · 3.27): `--baseline` ⇒ `baseline()` · `--all`/`--audit`/`--report`
 * ⇒ `audit(wantReport)` · αλλιώς `ratchet(σταδιοποιημένα)` (κανένα ⇒ 0).
 */
function runLineModes(args, { baseline, audit, ratchet }) {
  if (args.includes('--baseline') || args.includes('--write-baseline')) {
    baseline();
    return 0;
  }
  const wantReport = args.includes('--report');
  if (wantReport || args.includes('--all') || args.includes('--audit')) {
    audit(wantReport);
    return 0;
  }
  const staged = args.filter((a) => !a.startsWith('--'));
  return staged.length === 0 ? 0 : ratchet(staged);
}

/**
 * Baseline «με module» (3.26 · 3.27): `_meta` = module · description · adr · χρόνος · σύνολα, και η αναφορά της
 * εγγραφής με το ΑΠΟΛΥΤΟ μονοπάτι (όπως πάντα).
 */
function writeModuleBaseline(baselineFile, scanned, { module, adr, description }, root) {
  const totals = writeFileCounts(baselineFile, scanned, ({ totalFiles, totalViolations }) => ({
    module, description, adr, generatedAt: new Date().toISOString(), totalFiles, totalViolations,
  }), root);
  console.log(
    `${L.green}✅ Baseline written: ${path.join(root, baselineFile)}${L.nc}\n` +
    `${L.green}   ${totals.totalFiles} files / ${totals.totalViolations} violations${L.nc}`,
  );
}

/** Το τέλος του `printLineVerdict`: αποτυχία ⇒ κενή γραμμή + `failLines`, 1 · αλλιώς `okLine` αν κρίθηκε κάτι, 0. */
function concludeLineRatchet(hasBlock, checked, { failLines, okLine }, log = console.log) {
  if (hasBlock) {
    log('');
    for (const line of failLines) log(line);
    return 1;
  }
  if (checked > 0) log(okLine);
  return 0;
}

/** Τα αρχεία με ευρήματα, φθίνοντα κατά πλήθος (ισοπαλία: όνομα) — η σειρά των αναφορών `--report`/`--all`. */
function rankByCount(scanned) {
  return scanned.filter(({ hits }) => hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length || a.file.localeCompare(b.file));
}

module.exports = {
  pruneTestDirs, loadFileCounts, scopeFiles, scanFiles, judgeCounts, writeFileCounts, printBannerVerdict,
  runBannerRatchet, defineBannerGate, printLineVerdict, runLineModes, writeModuleBaseline, concludeLineRatchet,
  rankByCount, BANNER_COLORS: C,
};
