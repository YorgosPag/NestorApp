#!/usr/bin/env node
/**
 * CHECK 3.23 — Native HTML Tooltip Ratchet
 *
 * Detects `title=` props on lowercase (HTML) JSX elements.
 * These render as grey browser-native tooltips — not the centralized
 * dark-bg/white-text Radix tooltip from @/components/ui/tooltip.
 *
 * Canonical tooltip: <Tooltip><TooltipTrigger>…<TooltipContent>
 * Info icon shortcut: <InfoTooltip content="…" />
 *
 * Why AST, not grep:
 *   In multiline JSX the `title=` attribute sits on its own line, making
 *   it impossible to determine the parent element name with a line regex.
 *   @typescript-eslint/parser gives us the full JSX tree.
 *
 * Ratchet semantics:
 *   - Baseline: .native-tooltip-baseline.json
 *   - New file with violations → BLOCK (zero tolerance)
 *   - Existing baselined file with MORE violations → BLOCK
 *   - Existing baselined file same or fewer → allow
 *
 * CLI:
 *   node scripts/check-native-tooltip.js                    # staged files via stdin-like args
 *   node scripts/check-native-tooltip.js --all              # full src/ scan
 *   node scripts/check-native-tooltip.js --write-baseline   # regenerate baseline
 *   node scripts/check-native-tooltip.js path/a.tsx         # explicit targets
 *
 * Exit codes: 0 = pass, 1 = blocked
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

process.chdir(path.resolve(__dirname, '..'));

const BASELINE_FILE = '.native-tooltip-baseline.json';
const WRITE_BASELINE = process.argv.includes('--write-baseline');
const SCAN_ALL       = process.argv.includes('--all');

// HTML elements — lowercase JSX tags that produce DOM nodes
const HTML_ELEMENTS = new Set([
  'a','abbr','address','area','article','aside','audio',
  'b','bdi','bdo','blockquote','br','button',
  'canvas','caption','cite','code','col','colgroup',
  'data','datalist','dd','del','details','dfn','dialog','div','dl','dt',
  'em',
  'fieldset','figcaption','figure','footer','form',
  'h1','h2','h3','h4','h5','h6','header','hgroup','hr',
  'i','iframe','img','input','ins',
  'kbd',
  'label','legend','li','link',
  'main','map','mark','menu','meter',
  'nav',
  'object','ol','optgroup','option','output',
  'p','picture','pre','progress',
  'q',
  's','samp','section','select','small','source','span','strong','sub','summary','sup',
  'table','tbody','td','template','textarea','tfoot','th','thead','time','title','tr','track',
  'u','ul',
  'var','video',
  'wbr',
  'svg','path','circle','rect','line','polyline','polygon','g','defs','use','text',
]);

// ─── AST walker ──────────────────────────────────────────────────────────────

function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach(c => walk(c, visitor));
    } else if (child && typeof child === 'object' && child.type) {
      walk(child, visitor);
    }
  }
}

function findNativeTooltips(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  let parser;
  try {
    parser = require('@typescript-eslint/parser');
  } catch {
    return [];
  }

  let ast;
  try {
    ast = parser.parse(src, {
      jsx: true,
      range: true,
      loc: true,
      errorOnUnknownASTType: false,
    });
  } catch {
    return [];
  }

  const violations = [];

  walk(ast, node => {
    if (node.type !== 'JSXOpeningElement') return;

    // Only lowercase (HTML) elements
    const nameNode = node.name;
    if (!nameNode) return;
    const tagName = nameNode.type === 'JSXIdentifier' ? nameNode.name : null;
    if (!tagName || !HTML_ELEMENTS.has(tagName)) return;

    // Find title attribute with a non-trivial value
    const titleAttr = (node.attributes || []).find(attr =>
      attr.type === 'JSXAttribute' &&
      attr.name?.type === 'JSXIdentifier' &&
      attr.name.name === 'title' &&
      attr.value !== null // title={expr} or title="literal"
    );
    if (!titleAttr) return;

    violations.push({
      line: titleAttr.loc?.start?.line ?? '?',
      tag: tagName,
    });
  });

  return violations;
}

// ─── File collection ─────────────────────────────────────────────────────────

function collectFiles() {
  if (SCAN_ALL || WRITE_BASELINE) {
    return collectAllFiles('src');
  }
  const explicit = process.argv.slice(2).filter(a => !a.startsWith('--'));
  return explicit.length ? explicit : [];
}

function collectAllFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      out.push(...collectAllFiles(full));
    } else if (/\.(tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// ─── Baseline helpers ─────────────────────────────────────────────────────────

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).files ?? {};
  } catch { return {}; }
}

function writeBaseline(files) {
  const baseline = {};
  let totalViolations = 0;
  let totalFiles = 0;

  for (const f of files) {
    const violations = findNativeTooltips(f);
    if (violations.length > 0) {
      baseline[f] = violations.length;
      totalViolations += violations.length;
      totalFiles++;
    }
  }

  const out = {
    _meta: {
      description: 'Native HTML title= tooltip ratchet (CHECK 3.23)',
      generated: new Date().toISOString(),
      totalViolations,
      totalFiles,
      rule: 'title= on HTML elements must use centralized Tooltip component',
    },
    files: baseline,
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`✅ Baseline written: ${BASELINE_FILE}`);
  console.log(`   Files: ${totalFiles} | Violations: ${totalViolations}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC     = '\x1b[0m';

const files = collectFiles();

if (WRITE_BASELINE) {
  writeBaseline(files.length ? files : collectAllFiles('src'));
  process.exit(0);
}

if (!files.length) process.exit(0);

const baseline = loadBaseline();
let hasBlock = false;
const blocked = [];
const improved = [];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  if (!/\.(tsx)$/.test(file)) continue;

  const violations = findNativeTooltips(file);
  const current    = violations.length;
  const base       = baseline[file] ?? 0;

  if (current === 0 && base === 0) continue;

  if (current < base) {
    improved.push({ file, from: base, to: current });
    continue;
  }

  if (current === base) continue;

  // current > base OR (current > 0 && base === 0 → new file)
  hasBlock = true;
  const isNew = base === 0;
  blocked.push({ file, current, base, isNew, violations });
}

if (improved.length) {
  console.log(`\n${GREEN}═══════════════════════════════════════════════════════════════${NC}`);
  console.log(`${GREEN}  🎯 RATCHET DOWN — Native tooltip violations reduced${NC}`);
  console.log(`${GREEN}═══════════════════════════════════════════════════════════════${NC}`);
  for (const { file, from, to } of improved) {
    console.log(`  ✅ ${file}: ${from} → ${to} (-${from - to})`);
  }
  console.log(`\n  ${YELLOW}Run after commit: npm run native-tooltip:baseline${NC}\n`);
}

if (hasBlock) {
  console.log(`\n${RED}═══════════════════════════════════════════════════════════════${NC}`);
  console.log(`${RED}  🚫 COMMIT BLOCKED — Native HTML Tooltip (CHECK 3.23)${NC}`);
  console.log(`${RED}  Replace title= on HTML elements with centralized Tooltip${NC}`);
  console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}\n`);

  for (const { file, current, base, isNew, violations } of blocked) {
    if (isNew) {
      console.log(`  ❌ ${file} (NEW FILE — zero tolerance)`);
      console.log(`     Found ${current} native tooltip(s)`);
    } else {
      console.log(`  ❌ ${file}`);
      console.log(`     Baseline: ${base} → Current: ${current} (+${current - base})`);
    }
    for (const { line, tag } of violations) {
      console.log(`     line ${line}: <${tag} title=…>`);
    }
    console.log();
  }

  console.log(`  ${YELLOW}Fix: replace <element title={x}> with:${NC}`);
  console.log(`       <Tooltip><TooltipTrigger>…</TooltipTrigger>`);
  console.log(`       <TooltipContent>{x}</TooltipContent></Tooltip>`);
  console.log(`  ${YELLOW}Or for info icons: <InfoTooltip content={x} />${NC}\n`);
  process.exit(1);
}

process.exit(0);
