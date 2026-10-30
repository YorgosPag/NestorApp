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

const path = require('node:path');
const { walkAst, parseJsx } = require('./lib/jsx-ast');
const ratchet = require('./lib/per-file-ratchet');

// ADR-924: κάθε ανάγνωση από την ΕΙΣΟΔΟ — με `--index` (εκτελεστής) το κείμενο ΤΟΥ COMMIT, όχι του δίσκου.
const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = '.native-tooltip-baseline.json';

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

const isTsx = (file) => /\.(tsx)$/.test(file);

// ─── Detection ───────────────────────────────────────────────────────────────

/** Κάθε `title=` σε στοιχείο HTML του κειμένου. */
function findNativeTooltips(src) {
  const ast = parseJsx(src);
  if (!ast) return [];

  const violations = [];

  walkAst(ast, node => {
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

// ─── Main ─────────────────────────────────────────────────────────────────────

const { yellow: YELLOW, nc: NC } = ratchet.BANNER_COLORS;

/** `run(argv, input)` — με `--index` (εκτελεστής) κρίνεται το κείμενο ΤΟΥ COMMIT, όχι του δίσκου (ADR-924). */
const run = ratchet.defineBannerGate({
  root: ROOT,
  baselineFile: BASELINE_FILE,
  inScope: isTsx,
  findHits: findNativeTooltips,
  collectAll: (scope) => ratchet.scopeFiles(scope, ['src'], isTsx),
  meta: {
    description: 'Native HTML title= tooltip ratchet (CHECK 3.23)',
    rule: 'title= on HTML elements must use centralized Tooltip component',
  },
  banner: {
    downTitle: 'Native tooltip violations reduced',
    downCommand: 'native-tooltip:baseline',
    blockedTitle: 'Native HTML Tooltip (CHECK 3.23)',
    blockedSubtitle: 'Replace title= on HTML elements with centralized Tooltip',
    newNoun: 'native tooltip(s)',
    describeHit: ({ line, tag }) => `line ${line}: <${tag} title=…>`,
  },
  printFix() {
    console.log(`  ${YELLOW}Fix: replace <element title={x}> with:${NC}`);
    console.log(`       <Tooltip><TooltipTrigger>…</TooltipTrigger>`);
    console.log(`       <TooltipContent>{x}</TooltipContent></Tooltip>`);
    console.log(`  ${YELLOW}Or for info icons: <InfoTooltip content={x} />${NC}\n`);
  },
});

if (require.main === module) process.exit(run());

module.exports = { run, findNativeTooltips };
