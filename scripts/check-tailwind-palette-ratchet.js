#!/usr/bin/env node
/**
 * =============================================================================
 * Tailwind Semantic Palette Ratchet — Pre-commit Check 3.26 (ADR-365)
 * =============================================================================
 *
 * Motivation
 * ----------
 * The codebase ships an enterprise design system in three tiers:
 *   tokens     (src/design-system/tokens/colors.ts)
 *   semantics  (src/design-system/semantics/colors.ts)
 *   bridge     (src/design-system/color-bridge.ts → shadcn class mapping)
 * plus shadcn tokens (muted/accent/destructive/primary/ring), bg-enterprise-*,
 * performance-*, and CSS variables in src/app/globals.css.
 *
 * Despite this, consumer files routinely bypass the SSoT with raw palette
 * utilities like `hover:bg-amber-100`, `text-emerald-600`, `dark:bg-slate-800`,
 * etc. ADR-365 (2026-05-19) measured 249 violations across 86 files and laid
 * out a 9-phase migration plan with this ratchet as Phase 0.
 *
 * What this check does
 * --------------------
 * For every `.ts`/`.tsx` file in scope (`src/**`) it counts occurrences of:
 *
 *   (dark:)?(hover:|focus:|active:|group-hover:|peer-hover:)?
 *   (bg|text|border|ring|fill|stroke)-{palette}-{shade}
 *
 * where `{palette}` is one of the 22 raw Tailwind palettes (slate, gray, ...,
 * rose) and `{shade}` is one of 50/100/.../900/950. Word boundaries on both
 * sides prevent partial matches.
 *
 * Allowlist (SSoT files that define the palette — exempt by design)
 * -----------------------------------------------------------------
 * Sourced from `.ssot-registry.json` → modules.tailwind-hardcoded-palette.allowlist.
 * Includes color-bridge.ts, tokens/colors.ts, semanticColors, brand-map.ts,
 * comparison-factor-colors.ts, modal-colors.ts, panel-tokens.ts, ui/effects/*,
 * tailwind.config.ts, plus test/storybook/doc/locale files via the global
 * exemptPatterns regex.
 *
 * Ratchet semantics
 * -----------------
 *   - Baseline file: `.tailwind-palette-baseline.json`
 *   - Counts can only decrease per-file.
 *   - New files start at zero tolerance.
 *   - `npm run tailwind-palette:baseline` refreshes after legit cleanup.
 *
 * Modes
 * -----
 *   default            scan files passed as args (pre-commit, silent on PASS)
 *   --all              full src/ scan, audit-style summary (no block)
 *   --report           full src/ scan, verbose per-file breakdown
 *   --baseline         full src/ scan, write `.tailwind-palette-baseline.json`
 *
 * Reference: ADR-365 §2.3 (allowlist), §3.2 (regex spec), §3.3 (this check)
 * =============================================================================
 */
const path = require('path');
const { commitInput } = require('./lib/gate-input');
const ratchet = require('./lib/per-file-ratchet');

const REPO_ROOT = path.join(__dirname, '..');
// ADR-924: σχετικά με τη ρίζα — κάθε ανάγνωση περνά από την ΕΙΣΟΔΟ
const REGISTRY_FILE = '.ssot-registry.json';
const BASELINE_FILE = '.tailwind-palette-baseline.json';
const MODULE_NAME = 'tailwind-hardcoded-palette';

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

// ---------------------------------------------------------------------------
// Canonical detection regex (ADR-365 §3.2)
// ---------------------------------------------------------------------------
const PALETTES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose',
];
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
// ⚠️ SSoT: το «ποια utilities παίρνουν χρώμα» καταναλώνεται πλέον από ΔΥΟ πύλες — αυτή
// (3.26, «παρακάμπτεις το SSoT;») και το CHECK 3.42 (ADR-773 §8, «οι κλάσεις του SSoT
// είναι θεματικές;»). Ήταν σκληροκωδικοποιημένο και στις δύο· δύο αντίγραφα του ίδιου
// λεξιλογίου αποκλίνουν, και τότε η μία πύλη φρουρεί κάτι που η άλλη δεν βλέπει καν.
// Το `tailwind-classes.js` δεν φορτώνει το config του Tailwind — μηδέν κόστος εδώ.
const { COLOR_UTILITIES: UTILITIES } = require('./lib/contrast/tailwind-classes');
const STATE_PREFIXES = ['hover:', 'focus:', 'active:', 'group-hover:', 'peer-hover:'];

// Single regex covering both `(state?)util-palette-shade` and `dark:(state?)util-palette-shade`.
// Lookarounds enforce class boundaries (quotes/spaces/braces) so substrings of unrelated
// identifiers don't match.
const PALETTE_REGEX = new RegExp(
  '(?<![\\w-])' +
  '(?:dark:)?' +
  '(?:' + STATE_PREFIXES.map((p) => p.replace(':', '\\:')).join('|') + ')?' +
  '(' + UTILITIES.join('|') + ')' +
  '-(' + PALETTES.join('|') + ')' +
  '-(' + SHADES.join('|') + ')' +
  '(?![\\w-])',
  'g',
);

// ---------------------------------------------------------------------------
// Invalid-shade detection (ADR-365 §10 — green-707 typo incident, 2026-05-29)
// ---------------------------------------------------------------------------
// Same shape as PALETTE_REGEX but captures ANY numeric shade, including the
// `-l-`/`-r-`/`-t-`/`-b-`/`-x-`/`-y-` directional border infix. A match whose
// shade is NOT in the SHADES whitelist (e.g. `green-707` typo for `green-700`)
// is a non-existent Tailwind class → emits zero CSS → silent visual regression.
// Zero-tolerance hard block (no baseline): valid shades are already governed by
// the PALETTE_REGEX ratchet, so the only matches here are real typos.
const SHADE_SET = new Set(SHADES);
const INVALID_SHADE_REGEX = new RegExp(
  '(?<![\\w-])' +
  '(?:dark:)?' +
  '(?:' + STATE_PREFIXES.map((p) => p.replace(':', '\\:')).join('|') + ')?' +
  '(?:[\\w-]+\\:)?' + // tolerate arbitrary state/variant prefixes like data-[state=checked]:
  '(' + UTILITIES.join('|') + ')' +
  '(?:-[lrtbxy])?' + // directional border infix (border-l-, border-x-, …)
  '-(' + PALETTES.join('|') + ')' +
  '-(\\d{2,3})' +
  '(?![\\w-])',
  'g',
);

// ---------------------------------------------------------------------------
// Registry-driven allowlist + global exempt patterns — από την ΕΙΣΟΔΟ (ADR-924: `--index` ⇒ το μητρώο ΤΟΥ COMMIT)
// ---------------------------------------------------------------------------
function loadRegistry(input) {
  if (!input.exists(REGISTRY_FILE)) {
    console.error(`${RED}❌ Registry missing: ${path.join(REPO_ROOT, REGISTRY_FILE)}${NC}`);
    process.exit(2);
  }
  const data = input.readJson(REGISTRY_FILE);
  const mod = data.modules?.[MODULE_NAME];
  if (!mod) {
    console.error(`${RED}❌ Module '${MODULE_NAME}' missing from ${path.join(REPO_ROOT, REGISTRY_FILE)}${NC}`);
    process.exit(2);
  }
  const exemptRegex = data.exemptPatterns ? new RegExp(data.exemptPatterns) : null;
  return { allowlist: mod.allowlist || [], exemptRegex };
}

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

/** Το πεδίο της πύλης, από το μητρώο της εισόδου: `.ts`/`.tsx` του `src/`, εκτός εξαιρέσεων και allowlist. */
function scopeOf({ allowlist, exemptRegex }) {
  const isAllowlisted = (file) => {
    const norm = normalizePath(file);
    return allowlist.some((entry) => {
      const e = normalizePath(entry);
      if (e.endsWith('/')) return norm.startsWith(e);
      return norm === e;
    });
  };
  return (file) => {
    const norm = normalizePath(file);
    if (!/\.(ts|tsx)$/.test(norm)) return false;
    if (!norm.startsWith('src/')) return false;
    if (exemptRegex && exemptRegex.test(norm)) return false;
    return !isAllowlisted(file);
  };
}

// ---------------------------------------------------------------------------
// Match counting
// ---------------------------------------------------------------------------
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function countViolations(content) {
  PALETTE_REGEX.lastIndex = 0;
  const hits = [];
  for (const m of content.matchAll(PALETTE_REGEX)) {
    hits.push({
      match: m[0],
      utility: m[1],
      palette: m[2],
      shade: m[3],
      line: getLineNumber(content, m.index),
    });
  }
  return hits;
}

// Detect raw-palette utilities with a NON-existent shade (typos like green-707).
function countInvalidShades(content) {
  INVALID_SHADE_REGEX.lastIndex = 0;
  const hits = [];
  for (const m of content.matchAll(INVALID_SHADE_REGEX)) {
    if (SHADE_SET.has(m[3])) continue; // valid shade — governed by PALETTE_REGEX ratchet
    hits.push({
      match: m[0],
      palette: m[2],
      shade: m[3],
      line: getLineNumber(content, m.index),
    });
  }
  return hits;
}

/**
 * Σάρωση από την ΕΙΣΟΔΟ: τα ευρήματα παλέτας ανά αρχείο (το ratchet) ΚΑΙ οι ανύπαρκτες αποχρώσεις (μηδενική ανοχή),
 * σε ΜΙΑ ανάγνωση ανά αρχείο. `files` = ορίσματα, ή (χωρίς) όλο το `src/`.
 */
function scan(input, inScope, files = ratchet.scopeFiles(input, ['src'], inScope, ratchet.pruneTestDirs)) {
  const invalidByFile = new Map();
  const scanned = ratchet.scanFiles(files, {
    input,
    inScope,
    findHits: (text, rel) => {
      invalidByFile.set(rel, countInvalidShades(text));
      return countViolations(text);
    },
  });
  return { scanned, invalidByFile };
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------
function writeBaseline(scanned) {
  ratchet.writeModuleBaseline(BASELINE_FILE, scanned, {
    module: MODULE_NAME,
    adr: 'ADR-365',
    description:
      'Tailwind raw palette utilities baseline. Ratchet enforced via CHECK 3.26 (ADR-365). ' +
      'Counts can only decrease per-file. New files: zero tolerance.',
  }, REPO_ROOT);
}

function audit({ scanned, invalidByFile }, wantReport) {
  const entries = ratchet.rankByCount(scanned);
  const totalViolations = entries.reduce((sum, { hits }) => sum + hits.length, 0);
  const invalidEntries = scanned.map(({ file }) => ({ file, invalid: invalidByFile.get(file) }))
    .filter(({ invalid }) => invalid.length > 0);
  const totalInvalidShades = invalidEntries.reduce((sum, { invalid }) => sum + invalid.length, 0);

  if (wantReport) {
    for (const { file, hits } of entries) {
      console.log(`${YELLOW}${file}${NC}  (${hits.length})`);
      for (const h of hits) {
        console.log(`  L${h.line}  ${h.match}`);
      }
    }
    if (invalidEntries.length > 0) {
      console.log(`\n${RED}Invalid shades (non-existent classes):${NC}`);
      for (const { file, invalid } of invalidEntries) {
        for (const h of invalid) console.log(`  ${RED}${file}:${h.line}  ${h.match}${NC}`);
      }
    }
    console.log('');
  }
  console.log(
    `${GREEN}📊 Tailwind palette audit: ${entries.length} files / ${totalViolations} violations${NC}`,
  );
  if (totalInvalidShades > 0) {
    console.log(
      `${RED}🚫 Invalid shades: ${invalidEntries.length} files / ${totalInvalidShades} non-existent classes (emit no CSS)${NC}`,
    );
  }
}

/** Zero-tolerance: invalid-shade typos (e.g. green-707) emit no CSS — always block. */
function printInvalidShades(file, invalid) {
  if (invalid.length === 0) return false;
  console.log(
    `${RED}  🚫 ${file}: ${invalid.length} invalid Tailwind shade(s) — non-existent class, emits NO CSS${NC}`,
  );
  for (const { match, line, palette, shade } of invalid) {
    console.log(
      `${YELLOW}     Line ${line}: ${match} — shade '${shade}' not in ${palette} palette (valid: ${SHADES.join(',')})${NC}`,
    );
  }
  return true;
}

function ratchetMode(input, inScope, stagedFiles) {
  const { scanned, invalidByFile } = scan(input, inScope, stagedFiles);
  const hasBlock = ratchet.printLineVerdict(scanned, ratchet.loadFileCounts(BASELINE_FILE, input), {
    noun: 'raw palette utilities',
    newNoun: 'new raw palette utility/-ies',
    describeHit: ({ match }) => `${match} — replace with semantic token (ADR-365 §3.1)`,
    deferReductions: true,
    extra: ({ file }) => printInvalidShades(file, invalidByFile.get(file)),
  });

  return ratchet.concludeLineRatchet(hasBlock, scanned.length, {
    failLines: [
      `${RED}  ❌ Tailwind palette ratchet FAILED — replace raw utilities with semantic tokens${NC}`,
      `${YELLOW}     Mapping: docs/centralized-systems/reference/adrs/ADR-365-tailwind-semantic-palette-enforcement.md §3.1${NC}`,
      `${YELLOW}     SSoT: src/design-system/color-bridge.ts (COLOR_BRIDGE) + src/design-system/semantics/colors.ts (semanticColors)${NC}`,
      `${YELLOW}     After legit cleanup: npm run tailwind-palette:baseline${NC}`,
    ],
    okLine: `${GREEN}  ✅ Tailwind palette: no new raw-utility violations (${scanned.length} file(s) in scope)${NC}`,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
/** `input` = η είσοδος (ADR-924): με `--index` (εκτελεστής) το μητρώο, η baseline και το κείμενο ΤΟΥ COMMIT. */
function run(args = process.argv.slice(2), input = commitInput(REPO_ROOT, args)) {
  const inScope = scopeOf(loadRegistry(input));
  return ratchet.runLineModes(args, {
    baseline: () => writeBaseline(scan(input, inScope).scanned),
    audit: (wantReport) => audit(scan(input, inScope), wantReport),
    // ratchet mode — scan provided args (staged files from pre-commit)
    ratchet: (stagedFiles) => ratchetMode(input, inScope, stagedFiles),
  });
}

if (require.main === module) process.exit(run());

module.exports = { run, countViolations, countInvalidShades, scopeOf };
