#!/usr/bin/env node
/**
 * ADR-744 §2 — "which keys can this shell module ask for?"
 *
 * What it resolves, in ladder order:
 *
 *   t('a.b')                      plain literal
 *   t('files:upload.ok')          explicit namespace
 *   t(`a.b`)                      backtick literal
 *   t(cond ? 'a' : 'b')           both branches
 *   t(a ?? 'fallback')            both alternatives
 *   t(`emailShare.${k}`)          static prefix ⇒ whole subtree
 *   t('errors.' + code)           static prefix ⇒ whole subtree
 *   t(NOTIFICATION_KEYS.files.x)  registered key-constant SSoT
 *   t(MAP[runtimeValue])          local const table, computed index ⇒ all values
 *   t(item.labelKey)              property harvest from the shell's own literals
 *   t(x, { defaultValue })        cannot flash by i18next's contract ⇒ nothing to slice
 *   t(step.titleKey)              UNRESOLVED — reported, never guessed
 *
 * RELATIONSHIP TO `extractTCalls` (scripts/lib/i18n-namespace-extract.js)
 * ----------------------------------------------------------------------
 * That regex is the shared SSoT for "plain `t('literal')`", and CHECK 3.8 owns
 * it — its ratchet baseline is calibrated to exactly those matches, so it must
 * not change. The shell-slice generator runs BOTH and takes the union: this
 * classifier is a strict superset, and the regex is kept as the belt to its
 * suspenders (CLAUDE.md N.7.2 #4). They are not clones — different mechanism,
 * different question depth — and the migration path is stated once, here:
 * CHECK 3.8 should adopt this classifier when its baseline is next re-cut.
 *
 * WHY AN AST AND NOT MORE REGEX
 * -----------------------------
 * `ts.createSourceFile` is a parse, not a type-check — no program, no
 * diagnostics, milliseconds per file, and explicitly not a `tsc` run under
 * CLAUDE.md N.17 (same reasoning as scripts/lib/module-graph/parse-module.js).
 * A regex cannot tell `t(a ? 'x' : 'y')` from `t(a)`, and the difference between
 * those two is 400 bytes versus a whole 40 KB namespace in the slice.
 *
 * THE UNRESOLVED CASE IS THE IMPORTANT ONE
 * ----------------------------------------
 * `t(step.titleKey)` is not resolvable from this file, and the honest answers
 * are "take the whole namespace" or "ask a human". Guessing silently is what
 * lets a raw key reach the screen, so this module only ever REPORTS the call
 * site; the generator refuses to emit a slice until every one of them is
 * classified in `.i18n-shell-slice.json`. Zero tolerance, no baseline.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/** `ns:key` — i18next's explicit-namespace form. */
const EXPLICIT_NS = /^([a-zA-Z0-9_-]+):(.+)$/;

function scriptKindFor(file) {
  return file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

/** Splits `'files:upload.ok'` into its namespace and key; `ns` is null when implicit. */
function splitKey(raw) {
  const match = EXPLICIT_NS.exec(raw);
  return match ? { ns: match[1], key: match[2] } : { ns: null, key: raw };
}

// ─── Key-constant SSoTs (e.g. src/config/notification-keys.ts) ────────────────

/** Folds an object-literal AST into dottedPath → string leaf. Non-literal values are skipped. */
function foldObjectLiteral(node, prefix, out) {
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (name === null) continue;
    const dotted = prefix ? `${prefix}.${name}` : name;
    if (ts.isObjectLiteralExpression(prop.initializer)) foldObjectLiteral(prop.initializer, dotted, out);
    else if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
      out.set(dotted, prop.initializer.text);
    }
  }
  return out;
}

/**
 * Reads the registered key-constant modules into `name → Map<dottedPath, key>`.
 * These constants exist precisely so keys are not hardcoded at call sites
 * (`src/config/notification-keys.ts`, `.ssot-registry.json → notification-keys`);
 * without this the shell would fall back to whole namespaces for every
 * notification hook it touches.
 *
 * @param {string} projectRoot
 * @param {Array<{file: string, exportName: string}>} specs
 */
function loadKeyConstants(projectRoot, specs) {
  const constants = new Map();
  for (const spec of specs) {
    const abs = path.join(projectRoot, spec.file);
    if (!fs.existsSync(abs)) continue;
    const source = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.name.text !== spec.exportName) continue;
        const init = decl.initializer && ts.isAsExpression(decl.initializer)
          ? decl.initializer.expression
          : decl.initializer;
        if (init && ts.isObjectLiteralExpression(init)) {
          constants.set(spec.exportName, foldObjectLiteral(init, '', new Map()));
        }
      }
    }
  }
  return constants;
}

/**
 * Walks `NOTIFICATION_KEYS.files.upload` or `PHOTO_TYPE_I18N_MAP[photoType]`
 * back to its root identifier.
 *
 * `wildcard` marks a COMPUTED index: the call selects one of the table's values
 * but which one is a runtime decision, so every value under that point is a
 * possible key and all of them must travel. That is the fail-safe direction —
 * a map of 5 labels costs 5 strings, a missing one costs a raw key on screen.
 *
 * @returns {?{root: string, path: string, wildcard: boolean}}
 */
function resolveAccessChain(node) {
  const parts = [];
  let wildcard = false;
  let current = node;
  for (;;) {
    if (ts.isPropertyAccessExpression(current)) { parts.unshift(current.name.text); current = current.expression; continue; }
    if (ts.isElementAccessExpression(current)) {
      const index = current.argumentExpression;
      if (index && (ts.isStringLiteral(index) || ts.isNoSubstitutionTemplateLiteral(index))) parts.unshift(index.text);
      else wildcard = true;
      current = current.expression;
      continue;
    }
    break;
  }
  if (!ts.isIdentifier(current)) return null;
  return { root: current.text, path: parts.join('.'), wildcard };
}

/**
 * Module-level `const NAME = { … }` object literals in the file being analysed.
 *
 * WHY: `t(PHOTO_TYPE_I18N_MAP[photoType] ?? 'photoPreview.titles.photo')` is a
 * local lookup table, not a registered SSoT, and it is a common enough shape
 * that sending it to the manual escape hatch would make the hatch the norm. The
 * table is right there in the AST — read it.
 */
function collectLocalConstants(source) {
  const tables = new Map();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const init = ts.isAsExpression(decl.initializer) ? decl.initializer.expression : decl.initializer;
      if (!ts.isObjectLiteralExpression(init)) continue;
      const folded = foldObjectLiteral(init, '', new Map());
      if (folded.size > 0) tables.set(decl.name.text, folded);
    }
  }
  return tables;
}

/**
 * Harvests `propertyName → every string literal assigned to it` from all
 * module-level literals in the file (objects AND arrays, at any depth).
 *
 * WHY THIS RUNG EXISTS. The commonest unresolvable shape is not an opaque
 * variable — it is a config row walked by `.map()`:
 *
 *   const ACCOUNT_NAV = [{ href: …, labelKey: 'account.nav.profile' }, …]
 *   …ACCOUNT_NAV.map(item => <span>{t(item.labelKey)}</span>)
 *
 * `item` is a loop binding, so the access chain has no resolvable root and the
 * table lookup fails. But the answer is sitting in the same file: every value
 * `labelKey` can hold is a literal a few lines above. Asking "what strings does
 * this property ever hold here?" resolves it exactly.
 *
 * Over-collection is harmless by construction: a property that is not an i18n
 * key yields strings no locale defines, and `pruneNamespace` drops them. The
 * lookup only ever fires for a property that an actual `t()` call reads.
 */
function harvestPropertyValues(source) {
  const values = new Map();
  const remember = (name, text) => {
    if (!values.has(name)) values.set(name, new Set());
    values.get(name).add(text);
  };
  const walk = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
      const init = node.initializer;
      if (name !== null && (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init))) {
        remember(name, init.text);
      }
    }
    ts.forEachChild(node, walk);
  };
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) walk(statement);
  }
  return values;
}

/** Every leaf at or below `dotted` — a call may reference a whole subtree. */
function leavesUnder(table, dotted) {
  const exact = table.get(dotted);
  if (exact !== undefined) return [exact];
  const prefix = `${dotted}.`;
  const out = [];
  for (const [key, value] of table) if (key.startsWith(prefix)) out.push(value);
  return out;
}

// ─── Call-site classification ────────────────────────────────────────────────

/** The static head of a dynamic key, up to its last dot: `` `a.b.${x}` `` → `a.b`. */
function staticPrefixOf(head) {
  const cut = head.lastIndexOf('.');
  return cut > 0 ? head.slice(0, cut) : null;
}

/** Leftmost string operand of a `'a.' + x` chain. */
function leftmostStringLiteral(node) {
  let current = node;
  while (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    current = current.left;
  }
  return ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current) ? current.text : null;
}

/** The value of one option in `t(key, { … })`, or `undefined` when absent. */
function readOption(arg, name) {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;
  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const propName = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (propName === name) return prop.initializer;
  }
  return undefined;
}

/** `t(key, { ns: 'files' })` — an explicit option that overrides the file's namespaces. */
function readNsOption(arg) {
  const value = readOption(arg, 'ns');
  if (value === undefined) return null;
  return ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value) ? value.text : 'UNRESOLVED';
}

/**
 * `t(key, { defaultValue })` renders the default when the key is absent — that
 * is i18next's own contract, not our inference. Such a call CANNOT paint a raw
 * key no matter which namespace has loaded, so an unresolvable key inside one is
 * not a shell risk and must not be dragged to the manual escape hatch.
 *
 * Note this is orthogonal to CLAUDE.md N.11, which bans a hardcoded LITERAL
 * default; a variable default (`defaultValue: n.title ?? ''`) is the permitted
 * shape and is exactly the one that appears here.
 */
function hasDefaultValue(arg) {
  return readOption(arg, 'defaultValue') !== undefined;
}

/**
 * The classification ladder. Every rung either produces keys/prefixes or hands
 * the call to the next; falling off the end is `unresolved`, never a guess.
 */
function classifyArgument(arg, ctx, sink) {
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
    // ALWAYS emitted, even though the shared extractTCalls regex also sees the
    // plain ones. An earlier version skipped them here "because the regex has
    // it", and that silently broke three shapes the regex cannot express:
    // `t(a ? 'x' : 'y')` (the branches vanished), `t(a ?? 'fallback')` (same),
    // and worst, `t('a.b', { ns: 'files' })` — the key was recorded with no
    // namespace, so it got sliced out of the file's DECLARED namespaces instead
    // of `files`, and the one it actually needed never shipped. Context is
    // exactly what the AST is for; a literal only looks context-free.
    sink.keys.push(splitKey(arg.text));
    return true;
  }
  // No short-circuit: a branch that resolves must be collected even when its
  // sibling does not, because a key we keep is bytes and a key we drop is a raw
  // key on screen. The CALL is resolved only when every branch was.
  if (ts.isConditionalExpression(arg)) {
    const whenTrue = classifyArgument(arg.whenTrue, ctx, sink);
    return classifyArgument(arg.whenFalse, ctx, sink) && whenTrue;
  }
  if (ts.isTemplateExpression(arg)) {
    const prefix = staticPrefixOf(arg.head.text);
    if (prefix === null) return false;
    sink.prefixes.push(splitKey(prefix));
    return true;
  }
  if (ts.isBinaryExpression(arg)) return classifyBinary(arg, ctx, sink);
  if (ts.isPropertyAccessExpression(arg) || ts.isElementAccessExpression(arg)) {
    return classifyConstantAccess(arg, ctx, sink);
  }
  if (ts.isParenthesizedExpression(arg) || ts.isAsExpression(arg) || ts.isNonNullExpression(arg)) {
    return classifyArgument(arg.expression, ctx, sink);
  }
  return false;
}

/**
 * `??` and `||` are alternatives — BOTH sides can reach `t()`, so both are
 * classified. `+` is concatenation, where only the static head is knowable.
 */
function classifyBinary(arg, ctx, sink) {
  const operator = arg.operatorToken.kind;
  if (operator === ts.SyntaxKind.QuestionQuestionToken || operator === ts.SyntaxKind.BarBarToken) {
    const left = classifyArgument(arg.left, ctx, sink);
    return classifyArgument(arg.right, ctx, sink) && left;
  }
  const head = leftmostStringLiteral(arg);
  const prefix = head === null ? null : staticPrefixOf(head);
  if (prefix === null) return false;
  sink.prefixes.push(splitKey(prefix));
  return true;
}

function classifyConstantAccess(arg, ctx, sink) {
  const access = resolveAccessChain(arg);
  const table = access === null ? null : (ctx.keyConstants.get(access.root) || ctx.localConstants.get(access.root));
  if (table) {
    // A computed index means "any value at or below this path".
    const leaves = access.wildcard ? [...table.values()] : leavesUnder(table, access.path);
    if (leaves.length > 0) {
      leaves.forEach(leaf => sink.keys.push(splitKey(leaf)));
      return true;
    }
  }
  // The root is a loop binding or a component prop — fall back to asking what
  // this PROPERTY ever holds in a literal anywhere in the shell.
  if (!ts.isPropertyAccessExpression(arg)) return false;
  const harvested = ctx.lookupProperty(arg.name.text);
  if (harvested.length === 0) return false;
  harvested.forEach(value => sink.keys.push(splitKey(value)));
  return true;
}

/** `t(...)` or `i18n.t(...)` — matches what the shared regex considers a call. */
function isTranslateCall(node) {
  if (!ts.isCallExpression(node) || node.arguments.length === 0) return false;
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text === 't';
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 't';
}

function recordCall(node, source, ctx, sink) {
  const local = { keys: [], prefixes: [] };
  const resolved = classifyArgument(node.arguments[0], ctx, local);
  const nsOption = readNsOption(node.arguments[1]);
  const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  // Whatever WAS resolved is kept even when the call as a whole was not: a
  // partially-known ternary still contributes the branch we can name.
  const explicitNs = nsOption === 'UNRESOLVED' ? null : nsOption;
  const applyNs = entry => ({ ns: entry.ns ?? explicitNs ?? null, key: entry.key });
  local.keys.forEach(entry => sink.keys.push(applyNs(entry)));
  local.prefixes.forEach(entry => sink.prefixes.push({ ...applyNs(entry), prefix: entry.key }));

  if (resolved && nsOption !== 'UNRESOLVED') return;
  // i18next renders the default instead of the key — such a call cannot flash,
  // so it is not a shell risk and must not be sent to the manual escape hatch.
  if (hasDefaultValue(node.arguments[1])) { sink.defaulted += 1; return; }
  sink.unresolved.push({ line, snippet: node.getText(source).slice(0, 120).replace(/\s+/g, ' ') });
}

function parseSource(file, content) {
  return ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKindFor(file));
}

/**
 * The FILE-LOCAL facts about one module — everything the fingerprint is allowed
 * to depend on.
 *
 * WHY THIS IS SEPARATE FROM RESOLUTION. `t(tab.labelKey)` inside a generic
 * `RouteTabs` is resolved from literals in whichever module PASSES the tabs, so
 * the resolved key set of a file depends on the rest of the shell. The
 * pre-commit gate re-fingerprints one staged file in isolation and must arrive
 * at exactly the number the generator wrote; if the fingerprint depended on
 * shell-wide resolution, the gate would be permanently, invisibly red. So the
 * fingerprint hashes what the file itself says — its import edges, its
 * namespaces, the raw text of its `t()` calls, its literals — and nothing that
 * required looking at another module.
 */
function extractSurface(content, { file }) {
  const source = parseSource(file, content);
  const callTexts = [];
  const visit = (node) => {
    if (isTranslateCall(node)) callTexts.push(node.getText(source).slice(0, 200).replace(/\s+/g, ' '));
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return { callTexts, harvest: harvestPropertyValues(source) };
}

/**
 * @param {string} content   source of a .ts/.tsx file
 * @param {{file: string,
 *          keyConstants: Map<string, Map<string, string>>,
 *          propertyValues: ?Map<string, Set<string>>}} options
 *   `propertyValues` is the SHELL-WIDE harvest; the file's own literals are
 *   always consulted first and both are used, because a wider net here only
 *   ever adds keys no locale defines, which are dropped when the slice is cut.
 * @returns {{keys, prefixes, unresolved, defaulted}}
 */
function classifyTranslateCalls(content, { file, keyConstants, propertyValues }) {
  const source = parseSource(file, content);
  const local = harvestPropertyValues(source);
  const sink = { keys: [], prefixes: [], unresolved: [], defaulted: 0 };
  const ctx = {
    keyConstants: keyConstants || new Map(),
    localConstants: collectLocalConstants(source),
    lookupProperty: (name) => [
      ...(local.get(name) || []),
      ...((propertyValues && propertyValues.get(name)) || []),
    ],
  };
  const visit = (node) => {
    if (isTranslateCall(node)) recordCall(node, source, ctx, sink);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return sink;
}

module.exports = {
  EXPLICIT_NS,
  splitKey,
  foldObjectLiteral,
  loadKeyConstants,
  resolveAccessChain,
  collectLocalConstants,
  harvestPropertyValues,
  leavesUnder,
  staticPrefixOf,
  leftmostStringLiteral,
  readOption,
  readNsOption,
  hasDefaultValue,
  parseSource,
  extractSurface,
  classifyArgument,
  classifyBinary,
  classifyConstantAccess,
  isTranslateCall,
  classifyTranslateCalls,
};
