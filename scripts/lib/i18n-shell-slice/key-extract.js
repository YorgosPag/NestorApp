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

const ts = require('typescript');

// ADR-777 §8.37 — η **επίλυση τιμών** ζει δίπλα, ως ξεχωριστή ευθύνη (N.7.1).
const {
  forEachModuleConstant,
  isScopeNode,
  readConstantDeclaration,
  collectScopeDeclarations,
  makeConstantScope,
  collectStringConstants,
  expandTemplate,
  spanValues,
  expandTemplateKeys,
} = require('./constant-resolution');
const {
  foldObjectLiteral,
  loadKeyConstants,
  resolveAccessChain,
  collectLocalConstants,
  lookupTable,
  harvestPropertyValues,
  leavesUnder,
} = require('./key-tables');

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
    // 🔴 ADR-777 §8.36 — TRY THE CONSTANT CHAIN FIRST. `` t(`${K}.newTitle`) `` where
    // `K` is a module constant denotes ONE key; treating it as dynamic was the sole
    // reason the generator refused route slices for the three property forms.
    //
    // ⚠️ STRICTLY ADDITIVE, and that is load-bearing: the raw `head` of such a call
    // is the EMPTY string, so `staticPrefixOf` returned null and the call fell through
    // to `unresolved`. Nothing that resolved before resolves more narrowly now — the
    // only movement is unresolved → prefix → exact key.
    const expanded = expandTemplateKeys(arg, ctx);
    if (expanded.complete) {
      expanded.texts.forEach(text => sink.keys.push(splitKey(text)));
      return true;
    }
    const prefix = staticPrefixOf(expanded.head);
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
  // 🔴 ADR-777 §8.39 — ΤΟ ΣΚΑΛΙ ΤΟΥ ΑΝΑΓΝΩΡΙΣΤΙΚΟΥ, ΤΕΛΕΥΤΑΙΟ.
  //
  // `const key = \`ns:ρίζα.${x}\`; … t(key, { value })` ήταν **ανεπίλυτη ολόκληρη**,
  // ενώ η ίδια έκφραση **μέσα** στο `t(...)` έδινε πρόθεμα: το ίδιο ερώτημα με δύο
  // απαντήσεις, ανάλογα με το αν ο άνθρωπος έβαλε ενδιάμεση μεταβλητή (ADR-749).
  // Πλέον η κλήση κρίνεται πάνω στον **αρχικοποιητή** της σταθεράς, με την ίδια σκάλα.
  //
  // ⚠️ **Φρουρός κύκλου**: `const a = b; const b = a;` δεν επιτρέπεται να κρεμάσει.
  if (ts.isIdentifier(arg)) {
    if (ctx.resolvingNames.has(arg.text)) return false;
    const initializer = ctx.constants.initializerOf(arg.text);
    if (initializer === undefined) return false;
    ctx.resolvingNames.add(arg.text);
    const resolved = classifyArgument(initializer, ctx, sink);
    ctx.resolvingNames.delete(arg.text);
    return resolved;
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
  const table = access === null ? null : lookupTable(ctx, access.root);
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

/**
 * 🔴 ADR-744 §14.5 — ΤΑ ΟΝΟΜΑΤΑ ΠΟΥ ΜΕΤΑΦΡΑΖΟΥΝ ΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ.
 *
 * Μέχρι 2026-08-19 αυτό ήταν `callee.text === 't'` — **ακριβής σύγκριση** — οπότε ο
 * generator ήταν **δομικά τυφλός** σε κάθε `const { t: tParking } = useTranslation(…)`.
 * Δεν ήταν θεωρητικό: μετρημένο ότι **2 από τα 459** shell modules γράφουν έτσι, και
 * **και τα δύο έχαναν κλειδιά** — `ShareModal.tsx:77-78` (`shareSurface.close` ·
 * `shareSurface.errorPrefix`, ΚΥΡΙΟΛΕΚΤΙΚΑ, σε αρχείο του κελύφους) και
 * `SearchResultItem.tsx`. Τα δύο κλειδιά του ShareModal **έλειπαν από το slice** ενώ τα
 * αδέρφια τους `shareSurface.submitting`/`.a11y.statusRegion` ταξίδευαν, επειδή εκείνα
 * καλούνται από το **μη**-aliased `t` — δηλαδή το ίδιο αρχείο ήταν μισό ορατό.
 *
 * ⚠️ **ΔΕΝ δέχεται κάθε `t<Κάτι>`** — αυτό θα έπιανε `toString` · `test` · `trim` και θα
 * γέμιζε τον generator ψευδώς ανεπίλυτες κλήσεις (ο generator ΑΡΝΕΙΤΑΙ να παράξει σε
 * ανεπίλυτη, άρα ένα ψευδώς θετικό δεν είναι θόρυβος: είναι **φραγμός**). Δέχεται ΜΟΝΟ
 * ονόματα που είναι **δεσμευμένα** από destructuring πάνω σε κλήση `useTranslation*` —
 * δηλαδή ρωτά την ίδια αυθεντία που ρωτά και το `extractNamespaces`, όχι μια σύμβαση
 * ονοματοδοσίας.
 *
 * @param {ts.SourceFile} source
 * @returns {Set<string>} πάντα περιέχει `'t'`
 */
function collectTranslateAliases(source) {
  const aliases = new Set(['t']);
  const isTranslationHook = (init) => {
    if (!init || !ts.isCallExpression(init)) return false;
    const callee = init.expression;
    const name = ts.isIdentifier(callee) ? callee.text
      : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
    // `useTranslation` και `useTranslationLazy` — και οι δύο επιστρέφουν `{ t }`.
    return typeof name === 'string' && name.startsWith('useTranslation');
  };
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name && ts.isObjectBindingPattern(node.name)
        && isTranslationHook(node.initializer)) {
      for (const element of node.name.elements) {
        // `{ t: tParking }` → propertyName='t', name='tParking'. Το σκέτο `{ t }` δεν έχει
        // propertyName και καλύπτεται ήδη από το 't' του αρχικού συνόλου.
        if (element.propertyName && ts.isIdentifier(element.propertyName)
            && element.propertyName.text === 't' && ts.isIdentifier(element.name)) {
          aliases.add(element.name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return aliases;
}

/** `t(...)`, `i18n.t(...)`, ή aliased `tParking(...)` — βλ. {@link collectTranslateAliases}. */
function isTranslateCall(node, aliases) {
  if (!ts.isCallExpression(node) || node.arguments.length === 0) return false;
  const names = aliases || TRANSLATE_ONLY_T;
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return names.has(callee.text);
  return ts.isPropertyAccessExpression(callee) && names.has(callee.name.text);
}

/** Το προεπιλεγμένο σύνολο, για καλούντες που δεν πέρασαν aliases. */
const TRANSLATE_ONLY_T = new Set(['t']);

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
  // Τα aliases είναι ΦΙΛΕ-LOCAL γεγονός (δεσμεύσεις μέσα σε αυτό το αρχείο), άρα ανήκουν
  // στο fingerprint όπως και τα ίδια τα `t()` — βλ. το σχόλιο της συνάρτησης.
  const aliases = collectTranslateAliases(source);
  const visit = (node) => {
    if (isTranslateCall(node, aliases)) callTexts.push(node.getText(source).slice(0, 200).replace(/\s+/g, ' '));
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
function classifyTranslateCalls(content, { file, keyConstants, propertyValues, closureConstants }) {
  const source = parseSource(file, content);
  const local = harvestPropertyValues(source);
  const sink = { keys: [], prefixes: [], unresolved: [], defaulted: 0 };
  const ctx = {
    keyConstants: keyConstants || new Map(),
    localConstants: collectLocalConstants(source),
    // ADR-777 §8.39 — οι εξαγόμενοι πίνακες ΟΛΗΣ της κλειστότητας. Είναι εισαγωγή
    // **επίλυσης**, όχι επιφάνειας: το fingerprint (`extractSurface`) δεν τη βλέπει,
    // ακριβώς όπως και το `propertyValues` — αλλιώς η φθηνή πύλη θα ήταν μονίμως κόκκινη.
    closureConstants: closureConstants || new Map(),
    /** Ο φρουρός κύκλου του σκαλιού αναγνωριστικού — ένας ανά αρχείο. */
    resolvingNames: new Set(),
    constants: collectStringConstants(source),
    lookupProperty: (name) => [
      ...(local.get(name) || []),
      ...((propertyValues && propertyValues.get(name)) || []),
    ],
  };
  const aliases = collectTranslateAliases(source);
  // Η σκάλα εμβέλειας χτίζεται ΚΑΤΑ ΤΗΝ ΚΑΤΑΒΑΣΗ: κάθε κλήση `t()` κρίνεται με τις
  // σταθερές που ΒΛΕΠΕΙ από τη θέση της — βλ. {@link makeConstantScope}.
  const visit = (node, scope) => {
    const inner = isScopeNode(node) ? makeConstantScope(node, scope) : scope;
    if (isTranslateCall(node, aliases)) recordCall(node, source, { ...ctx, constants: inner }, sink);
    ts.forEachChild(node, child => visit(child, inner));
  };
  ts.forEachChild(source, child => visit(child, ctx.constants));
  return sink;
}

// ⚠️ Η επιφάνεια εισαγωγής μένει **ΙΔΙΑ**: η διάσπαση είναι κατά ευθύνη, όχι κατά
// συμβόλαιο — κανένας καταναλωτής δεν αλλάζει, άρα καμία άγκυρα δεν ξαναγράφεται
// για να περάσει.
module.exports = {
  EXPLICIT_NS,
  splitKey,
  foldObjectLiteral,
  loadKeyConstants,
  resolveAccessChain,
  collectLocalConstants,
  collectStringConstants,
  expandTemplate,
  isScopeNode,
  collectScopeDeclarations,
  makeConstantScope,
  spanValues,
  expandTemplateKeys,
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
  collectTranslateAliases,
  classifyTranslateCalls,
};
