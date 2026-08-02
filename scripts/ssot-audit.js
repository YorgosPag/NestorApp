#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-749 — SSoT ΑΝΑΦΟΡΑ (αντικαθιστά το ssot-audit.sh)
 * =============================================================================
 *
 * Τρέξε: npm run ssot:audit
 *
 * ⚠️ **Ο ΠΡΑΚΤΟΡΑΣ ΔΕΝ ΤΟ ΤΡΕΧΕΙ ΠΟΤΕ** — `.claude-rules/test-execution-budget.md`
 * ΜΕΡΟΣ Β. Είναι εντολή για τον άνθρωπο και για το pre-commit hook.
 *
 * ── ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΠΙΑ BASH ───────────────────────────────────────────────
 *
 * Το `ssot-audit.sh` ήταν **δεύτερη υλοποίηση** της ίδιας ερώτησης, σε άλλη
 * γλώσσα και άλλη διάλεκτο regex. Απέκλινε ακριβώς όπως προέβλεπε η κεφαλίδα
 * του `check-ssot-imports.js`. Μετρημένο στις 2026-08-03, ίδιο δέντρο:
 *
 *     πύλη (JS)          48 αρχεία /  61     ← τα 6 POSIX patterns νεκρά
 *     αναφορά (rg -P)    73 αρχεία /  86
 *     baseline (JS)      73 αρχεία / 103     ← διπλομέτρηση ανά pattern
 *
 * Τώρα υπάρχει **μία** μέτρηση (`lib/ssot/scan.js`) και τρεις καταναλωτές.
 * Ως παράπλευρο όφελος: **~22s αντί για 10′31″**.
 *
 * ── ΤΟ ΝΕΟ ΤΜΗΜΑ: ΑΔΡΑΝΕΙΣ ΦΡΟΥΡΟΙ ────────────────────────────────────────
 *
 * Ένα pattern με **μηδέν ευρήματα σε όλο το repo** είναι είτε *καθαρό* είτε
 * *νεκρό* — και τα δύο μοιάζουν ίδια στην αναφορά. Ήταν η αιτία τριών χωριστών
 * περιστατικών (6 POSIX patterns · 3 `xlineMode.*` · `type` αντί `interface`
 * στο jobs-visibility). Εδώ απαριθμούνται ρητά, ώστε το «0» να μη διαβάζεται
 * ποτέ ξανά ως «καθαρό» χωρίς να το κοιτάξει άνθρωπος.
 *
 * @see ADR-749
 */

'use strict';

const fs = require('node:fs');

const { loadRegistry } = require('./lib/ssot/registry');
const { scanAll } = require('./lib/ssot/full-scan');
const { BASELINE_FILE, loadBaseline } = require('./lib/ssot/baseline');
const { provenPatternKeys } = require('./lib/ssot/proofs');

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const CYAN = '\x1b[0;36m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

// ---------------------------------------------------------------------------
// Συγκεντρώσεις
// ---------------------------------------------------------------------------

/**
 * @param {Record<string, Record<string, number>>} files
 * @returns {{totalFiles: number, totalViolations: number,
 *            perModule: Map<string, number>, perFile: [string, number][]}}
 */
function aggregate(files) {
  const perModule = new Map();
  const perFile = [];
  let totalViolations = 0;

  for (const [file, counts] of Object.entries(files)) {
    let fileTotal = 0;
    for (const [mod, n] of Object.entries(counts)) {
      perModule.set(mod, (perModule.get(mod) || 0) + n);
      fileTotal += n;
    }
    perFile.push([file, fileTotal]);
    totalViolations += fileTotal;
  }

  perFile.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { totalFiles: perFile.length, totalViolations, perModule, perFile };
}

/**
 * Βρίσκει patterns που δεν πιάνουν **τίποτα** σε ολόκληρο το `src/`.
 *
 * @param {import('./lib/ssot/registry').SsotModule[]} modules
 * @param {Map<string, number>} patternHits  κλειδί `"<module>#<index>"`
 * @returns {{module: string, index: number, source: string}[]}
 */
function findDormantPatterns(modules, patternHits) {
  const dormant = [];
  for (const mod of modules) {
    mod.patterns.forEach((pattern, index) => {
      if (!patternHits.has(`${mod.name}#${index}`)) {
        dormant.push({ module: mod.name, index, source: pattern.source });
      }
    });
  }
  return dormant;
}

// ---------------------------------------------------------------------------
// Παρουσίαση
// ---------------------------------------------------------------------------

function printHeader() {
  console.log('');
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}`);
  console.log(`${BOLD}${CYAN}  📊 SSoT Κεντρικοποίηση — Αναφορά Ελέγχου${NC}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}`);
  console.log('');
}

/**
 * ⚠️ Τυπώνει **τρέχον** και **baseline** ως χωριστά μεγέθη, ρητά.
 * Το bash τύπωνε `Progress to zero: 35% (47/133)` όπου το 47 ήταν το *πλήθος
 * που διορθώθηκε*, όχι οι τρέχουσες παραβιάσεις — και διαβάστηκε λάθος
 * τουλάχιστον τρεις φορές, μέχρι και μέσα στο CLAUDE.md.
 */
function printTotals(current, baseline) {
  console.log(`  ${BOLD}Baseline${NC} (${baseline.generated || 'άγνωστη ημερομηνία'}):`);
  console.log(`    Αρχεία:      ${baseline.totalFiles}`);
  console.log(`    Παραβιάσεις: ${baseline.totalViolations}`);
  console.log('');
  console.log(`  ${BOLD}Τρέχον:${NC}`);
  console.log(`    Αρχεία:      ${current.totalFiles}`);
  console.log(`    Παραβιάσεις: ${current.totalViolations}`);
  console.log('');

  const fixed = baseline.totalViolations - current.totalViolations;
  if (fixed > 0) {
    console.log(`  ${GREEN}${BOLD}✅ Διορθώθηκαν ${fixed} — απομένουν ${current.totalViolations}${NC}`);
    console.log(`  ${CYAN}   Κλείδωσε την πρόοδο: npm run ssot:baseline${NC}`);
  } else if (fixed < 0) {
    console.log(`  ${RED}${BOLD}⚠️  Οπισθοδρόμηση: +${-fixed} παραβιάσεις πάνω από το baseline${NC}`);
  } else {
    console.log(`  ${YELLOW}${BOLD}═ Καμία αλλαγή από το baseline${NC}`);
  }
  console.log('');
}

function printModuleBreakdown(perModule) {
  console.log(`${BOLD}Ανά module (τρέχουσες παραβιάσεις):${NC}`);
  console.log('');
  const rows = [...perModule.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [mod, n] of rows) console.log(`  ${String(n).padStart(4)}  ${mod}`);
  console.log('');
}

function printTopOffenders(perFile, limit = 10) {
  console.log(`${BOLD}Κορυφαία ${limit} αρχεία:${NC}`);
  console.log('');
  for (const [file, n] of perFile.slice(0, limit)) {
    console.log(`  ${String(n).padStart(4)}  ${file}`);
  }
  if (perFile.length > limit) console.log(`        … και άλλα ${perFile.length - limit} αρχεία`);
  console.log('');
}

/**
 * Το τμήμα που δεν είχε καμία από τις προηγούμενες μηχανές.
 * «0 ευρήματα» ΔΕΝ σημαίνει «καθαρό» — σημαίνει «κανείς δεν κοίταξε».
 *
 * ⚠️ Τα σκέτα «0 ευρήματα» είναι **θόρυβος**: μετρημένα 651 από 671 patterns,
 * και η συντριπτική πλειονότητα είναι απλώς **καθαροί** φρουροί — κανείς δεν
 * παραβιάζει το SSoT τους. Το να τυπωθούν όλα θα ήταν αναφορά με ~97% ψευδώς
 * θετικά, δηλαδή αναφορά που κανείς δεν διαβάζει (ο πήχης της Google για
 * blocking checks είναι ≤10%).
 *
 * Το **σήμα** είναι η τομή: pattern που δεν πιάνει τίποτα **ΚΑΙ** δεν έχει
 * απόδειξη ότι μπορεί να πιάσει. Η απόδειξη ζει στα golden fixtures και
 * επιβάλλεται από το `registry-golden-regex.test.js` — εδώ μόνο αναφέρεται.
 */
function printDormant(dormant, totalPatterns, proven) {
  const unproven = dormant.filter(d => !proven.has(`${d.module}#${d.index}`));

  console.log(`${BOLD}Ζωντάνια φρουρών:${NC}`);
  console.log('');
  console.log(`  ${totalPatterns - dormant.length} patterns πιάνουν τουλάχιστον μία γραμμή (ζωντανά, αποδεδειγμένα από τον κώδικα)`);
  console.log(`  ${dormant.length} patterns δεν πιάνουν τίποτα — από αυτά:`);
  console.log(`     ${GREEN}${dormant.length - unproven.length}${NC} έχουν golden fixture ⇒ ${GREEN}καθαρός φρουρός${NC}`);
  console.log(`     ${YELLOW}${unproven.length}${NC} δεν έχουν καμία απόδειξη ⇒ ${YELLOW}άγνωστο αν φυλάνε τίποτα${NC}`);
  console.log('');

  if (unproven.length > 0) {
    console.log(`  ${CYAN}Πλήρης λίστα: npm run ssot:audit -- --dormant${NC}`);
    console.log(`  ${CYAN}Το πλήθος είναι ratchet — μόνο μειώνεται (test:registry-golden).${NC}`);
    console.log('');
  }

  if (!process.argv.includes('--dormant')) return;

  const byModule = new Map();
  for (const d of unproven) {
    if (!byModule.has(d.module)) byModule.set(d.module, []);
    byModule.get(d.module).push(d);
  }
  for (const [mod, list] of [...byModule.entries()].sort()) {
    console.log(`  ${mod}`);
    for (const d of list) console.log(`      [${d.index}] ${d.source}`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Είσοδος
// ---------------------------------------------------------------------------

async function main() {
  const started = Date.now();

  const { modules } = loadRegistry();
  const baselineMeta = readBaselineMeta();

  console.log(`${CYAN}🔍 Σάρωση src/ …${NC}`);
  const { files, patternHits, scanned, workers } = await scanAll({ trackLiveness: true });

  const current = aggregate(files);
  const totalPatterns = modules.reduce((n, m) => n + m.patterns.length, 0);
  const dormant = findDormantPatterns(modules, patternHits);

  printHeader();
  printTotals(current, baselineMeta);
  printModuleBreakdown(current.perModule);
  printTopOffenders(current.perFile);
  printDormant(dormant, totalPatterns, provenPatternKeys(modules));

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`${CYAN}${scanned} αρχεία · ${modules.length} modules · ${totalPatterns} patterns · ${elapsed}s · ${workers} νήματα${NC}`);
  console.log('');
}

/** @internal Το `_meta` του baseline — ανεκτικό, η αναφορά δεν είναι πύλη. */
function readBaselineMeta() {
  try {
    const { _meta } = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    loadBaseline(BASELINE_FILE);                      // fail-closed έλεγχος σχήματος
    return _meta || { totalFiles: 0, totalViolations: 0 };
  } catch (err) {
    console.log(`${YELLOW}⚠️  ${err.message}${NC}`);
    return { totalFiles: 0, totalViolations: 0, generated: '—' };
  }
}

main().catch(err => {
  console.error(`${RED}❌ ssot:audit: ${err.stack || err.message}${NC}`);
  process.exit(1);
});
