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
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const REGISTRY_FILE = path.join(REPO_ROOT, '.ssot-registry.json');
const BASELINE_FILE = path.join(REPO_ROOT, '.tailwind-palette-baseline.json');
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
const UTILITIES = ['bg', 'text', 'border', 'ring', 'fill', 'stroke'];
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
// Registry-driven allowlist + global exempt patterns
// ---------------------------------------------------------------------------
function loadRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    console.error(`${RED}❌ Registry missing: ${REGISTRY_FILE}${NC}`);
    process.exit(2);
  }
  const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  const mod = data.modules?.[MODULE_NAME];
  if (!mod) {
    console.error(`${RED}❌ Module '${MODULE_NAME}' missing from ${REGISTRY_FILE}${NC}`);
    process.exit(2);
  }
  const exemptRegex = data.exemptPatterns ? new RegExp(data.exemptPatterns) : null;
  return { allowlist: mod.allowlist || [], exemptRegex };
}

const { allowlist: ALLOWLIST, exemptRegex: EXEMPT_REGEX } = loadRegistry();

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function isAllowlisted(file) {
  const norm = normalizePath(file);
  return ALLOWLIST.some((entry) => {
    const e = normalizePath(entry);
    if (e.endsWith('/')) return norm.startsWith(e);
    return norm === e;
  });
}

function isInScope(file) {
  const norm = normalizePath(file);
  if (!/\.(ts|tsx)$/.test(norm)) return false;
  if (!norm.startsWith('src/')) return false;
  if (EXEMPT_REGEX && EXEMPT_REGEX.test(norm)) return false;
  if (isAllowlisted(file)) return false;
  return true;
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

// ---------------------------------------------------------------------------
// Full src/ walk
// ---------------------------------------------------------------------------
function walkSrc(dir, out = []) {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '__tests__'].includes(entry.name)) continue;
      walkSrc(rel, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && isInScope(rel)) {
      out.push(rel);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Baseline IO
// ---------------------------------------------------------------------------
function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return { files: {} };
  try {
    const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    return { files: data.files ?? {} };
  } catch {
    return { files: {} };
  }
}

function writeBaseline(fileCounts) {
  const sortedFiles = Object.fromEntries(
    Object.entries(fileCounts).sort(([a], [b]) => a.localeCompare(b)),
  );
  const totalViolations = Object.values(fileCounts).reduce((a, b) => a + b, 0);
  const payload = {
    _meta: {
      module: MODULE_NAME,
      description:
        'Tailwind raw palette utilities baseline. Ratchet enforced via CHECK 3.26 (ADR-365). ' +
        'Counts can only decrease per-file. New files: zero tolerance.',
      adr: 'ADR-365',
      generatedAt: new Date().toISOString(),
      totalFiles: Object.keys(sortedFiles).length,
      totalViolations,
    },
    files: sortedFiles,
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return { totalFiles: Object.keys(sortedFiles).length, totalViolations };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const wantAll = args.includes('--all') || args.includes('--audit');
const wantReport = args.includes('--report');
const wantBaseline = args.includes('--baseline') || args.includes('--write-baseline');

if (wantBaseline) {
  const files = walkSrc('src');
  const fileCounts = {};
  for (const file of files) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    const hits = countViolations(content);
    if (hits.length > 0) fileCounts[normalizePath(file)] = hits.length;
  }
  const { totalFiles, totalViolations } = writeBaseline(fileCounts);
  console.log(
    `${GREEN}✅ Baseline written: ${BASELINE_FILE}${NC}\n` +
    `${GREEN}   ${totalFiles} files / ${totalViolations} violations${NC}`,
  );
  process.exit(0);
}

if (wantReport || wantAll) {
  const files = walkSrc('src');
  const entries = [];
  let totalViolations = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    const hits = countViolations(content);
    if (hits.length === 0) continue;
    totalViolations += hits.length;
    entries.push({ file: normalizePath(file), hits });
  }
  entries.sort((a, b) => b.hits.length - a.hits.length || a.file.localeCompare(b.file));

  if (wantReport) {
    for (const { file, hits } of entries) {
      console.log(`${YELLOW}${file}${NC}  (${hits.length})`);
      for (const h of hits) {
        console.log(`  L${h.line}  ${h.match}`);
      }
    }
    console.log('');
  }
  console.log(
    `${GREEN}📊 Tailwind palette audit: ${entries.length} files / ${totalViolations} violations${NC}`,
  );
  process.exit(0);
}

// Default: ratchet mode — scan provided args (staged files from pre-commit).
const stagedFiles = args.filter((a) => !a.startsWith('--'));

if (stagedFiles.length === 0) {
  // Nothing to check (e.g. commit with no staged TS files in src/).
  process.exit(0);
}

const baseline = loadBaseline();
let hasBlock = false;
let totalChecked = 0;
let totalViolations = 0;
const reductions = [];

for (const file of stagedFiles) {
  const abs = path.isAbsolute(file) ? file : path.join(REPO_ROOT, file);
  if (!fs.existsSync(abs)) continue;
  const rel = normalizePath(path.relative(REPO_ROOT, abs));
  if (!isInScope(rel)) continue;
  totalChecked += 1;

  const content = fs.readFileSync(abs, 'utf8');
  const hits = countViolations(content);
  if (hits.length === 0) continue;

  const baselineCount = baseline.files[rel] ?? 0;
  const currentCount = hits.length;
  totalViolations += currentCount;

  if (currentCount <= baselineCount) {
    if (currentCount < baselineCount) {
      reductions.push(
        `${GREEN}  📉 ${rel}: ${baselineCount} → ${currentCount} (-${baselineCount - currentCount}) raw palette utilities${NC}`,
      );
    }
    continue;
  }

  hasBlock = true;
  const newCount = currentCount - baselineCount;
  console.log(
    `${RED}  🚫 ${rel}: ${newCount} new raw palette utility/-ies (total ${currentCount}, baseline ${baselineCount})${NC}`,
  );
  for (const { match, line } of hits.slice(-newCount)) {
    console.log(
      `${YELLOW}     Line ${line}: ${match} — replace with semantic token (ADR-365 §3.1)${NC}`,
    );
  }
}

for (const line of reductions) console.log(line);

if (hasBlock) {
  console.log('');
  console.log(
    `${RED}  ❌ Tailwind palette ratchet FAILED — replace raw utilities with semantic tokens${NC}`,
  );
  console.log(
    `${YELLOW}     Mapping: docs/centralized-systems/reference/adrs/ADR-365-tailwind-semantic-palette-enforcement.md §3.1${NC}`,
  );
  console.log(
    `${YELLOW}     SSoT: src/design-system/color-bridge.ts (COLOR_BRIDGE) + src/design-system/semantics/colors.ts (semanticColors)${NC}`,
  );
  console.log(
    `${YELLOW}     After legit cleanup: npm run tailwind-palette:baseline${NC}`,
  );
  process.exit(1);
}

if (totalChecked > 0) {
  console.log(
    `${GREEN}  ✅ Tailwind palette: no new raw-utility violations (${totalChecked} file(s) in scope)${NC}`,
  );
}
process.exit(0);
