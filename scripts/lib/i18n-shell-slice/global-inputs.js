#!/usr/bin/env node
/**
 * ADR-744 §30 — ΟΙ ΚΑΘΟΛΙΚΕΣ ΕΙΣΟΔΟΙ ΤΟΥ ΓΕΝΝΗΤΟΡΑ, ΔΗΛΩΜΕΝΕΣ ΚΑΙ ΚΑΤΑΚΕΡΜΑΤΙΣΜΕΝΕΣ.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΚΛΑΣΗ ΠΟΥ ΚΛΕΙΝΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το manifest ήξερε τις εισόδους ΑΝΑ ΑΡΧΕΙΟ (`shellFiles` · `routeFiles`, §21/§29). Δεν
 * ήξερε ΤΙΠΟΤΑ για όσες αλλάζουν τα `wants` ΧΩΡΙΣ να αλλάξει κανένα αρχείο κλειστότητας:
 * το `dynamicKeyPolicy`, τα αρχεία `keyConstants`, τα aliases του tsconfig, τα bundles,
 * τα μητρώα τεμπέλικων διαδρομών — και τον ΚΩΔΙΚΑ του ίδιου του γεννήτορα. Αλλαγή τους
 * ⇒ άλλα κλειδιά ανά διαδρομή, και το Layer 1 έλεγε `✅ OK`. Το έπιανε μόνο το CI.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ — ΚΑΙ ΠΟΥ ΠΑΜΕ ΠΑΡΑΠΕΡΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * · Bazel: το action key περιέχει γραμμή εντολής, περιβάλλον και τα ΙΔΙΑ τα tools ως inputs.
 * · Buck2: το toolchain είναι μέρος του action digest.
 * · Nx: `namedInputs` + `runtime` + `externalDependencies` (έκδοση πακέτου, όχι bytes).
 * · Turborepo: `globalDependencies` — ένα αρχείο αλλάζει, όλα ακυρώνονται.
 * Όλοι κατακερματίζουν BYTES ολόκληρων αρχείων. Εδώ, για τις ΔΗΛΩΤΙΚΕΣ εισόδους, κατακερματίζεται
 * ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΤΗΣ ΑΝΑΓΝΩΣΗΣ ΤΟΥ ΓΕΝΝΗΤΟΡΑ (ίδια αρχή με το §29): ο ΙΔΙΟΣ reader που τρέχει ο
 * γεννήτορας ⇒ αλλαγή σχολίου, μορφοποίησης ή σειράς κλειδιών ΔΕΝ κοκκινίζει, αλλαγή που μετακινεί
 * κλειδί κοκκινίζει ΠΑΝΤΑ. Και το config ΔΕΝ μπαίνει ολόκληρο: κάθε πεδίο ΤΑΞΙΝΟΜΕΙΤΑΙ ρητά ως
 * «επηρεάζει έξοδο» ή «μόνο πύλη», με ΟΛΙΚΟΤΗΤΑ που ελέγχεται στη φόρτωση — νέο πεδίο χωρίς
 * ταξινόμηση ⇒ `throw`. Κανένας από τους τέσσερις δεν σε σταματά αν ξεχάσεις να δηλώσεις είσοδο.
 *
 * ⚠️ Ο ΚΩΔΙΚΑΣ κατακερματίζεται σε BYTES (LF), ΟΧΙ «χωρίς σχόλια»: το `stripComments` είναι
 *    σαρωτής, όχι lexer — αν έτρωγε κώδικα, θα έκρυβε αλλαγή (ψευδώς ΠΡΑΣΙΝΟ). Το σχόλιο που
 *    αναγκάζει αναγέννηση είναι ψευδώς ΚΟΚΚΙΝΟ, δηλαδή η ασφαλής κατεύθυνση. Απορρίφθηκε με λόγο.
 * ⚠️ Η έκδοση του Node ΔΕΝ μπαίνει: το CI και ο σταθμός τρέχουν άλλη, και τα builtins που
 *    αγγίζουν την έξοδο (JSON, sort, sha256) είναι ντετερμινιστικά ⇒ μόνιμο κόκκινο, μηδέν σήμα.
 *
 * 🔑 ΤΟ ΜΗΤΡΩΟ ΕΙΝΑΙ ΜΙΑ ΠΗΓΗ ΓΙΑ ΤΕΣΣΕΡΙΣ ΚΑΤΑΝΑΛΩΤΕΣ: το manifest (`globalInputs`), η σύγκριση
 * του Layer 1, τα pathspecs του στιγμιότυπου (`--index`) και η σκανδάλη του hook. Τέσσερις λίστες
 * θα απέκλιναν — το σχήμα «δύο λίστες namespace, απόκλιση 63» που γέννησε το ADR-744.
 *
 * ⛔ ΚΑΝΕΝΑ `require('typescript')` ΣΤΗΝ ΚΟΡΥΦΗ: ο δρομολογητής του hook φορτώνει αυτό το module
 * για τη σκανδάλη, και το typescript κοστίζει 790ms (μετρημένο). Οι βαριοί readers φορτώνονται
 * τεμπέλικα, μέσα στο `parts`.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { builtinModules } = require('node:module');

const { CONFIG_FILE, DEFAULTS } = require('./config');
const { LAZY_CONFIG } = require('./lazy-route-census');
const { digestOf, toLf } = require('./slice-build');
const { NAMESPACE_BUNDLES_FILE, NAMESPACE_COMPAT_FILE } = require('../i18n-namespace-extract');

/** Το tsconfig από το οποίο ο γεννήτορας ΚΑΙ η πύλη διαβάζουν aliases — δηλωμένο ΕΔΩ, μία φορά. */
const TS_PATH_ALIAS_CONFIG = 'tsconfig.base.json';

/**
 * Η ΑΡΧΗ ΤΟΥ «ACTION»: ό,τι συνθέτει την έξοδο είναι το `renderComplete` (route-slices.js) — ο
 * ελεγκτής Layer 2 συγκρίνει ακριβώς αυτό. Η κλειστότητα `require` από εδώ ΕΙΝΑΙ το toolchain.
 * Το CLI του γεννήτορα μένει έξω: γράφει τα κείμενα αυτούσια, δεν αποφασίζει περιεχόμενο.
 */
const TOOLCHAIN_ENTRY = 'scripts/lib/i18n-shell-slice/route-slices.js';
const TOOLCHAIN_EXTENSIONS = Object.freeze(['', '.js', '/index.js']);

// ─── Το config: ΟΛΙΚΗ ταξινόμηση πεδίων ─────────────────────────────────────

const asIs = value => value;
const names = value => Object.keys(value || {}).sort();
const set = value => [...(value || [])].sort();
const gateOnly = why => Object.freeze({ gateOnly: why });

/** `dynamicKeyPolicy`: ό,τι φτάνει στα `wants` — ΟΧΙ το `reason`, που είναι πρόζα για άνθρωπο. */
function projectPolicy(policy) {
  const out = {};
  for (const [file, entry] of Object.entries(policy || {})) {
    out[file] = {
      wholeNamespaces: set(entry.wholeNamespaces),
      prefixes: set(entry.prefixes),
      keys: set(entry.keys),
    };
  }
  return out;
}

/** `lazyRouteOpaqueNamespaces`: τα namespaces ταξιδεύουν στον χάρτη· το `reason` όχι. */
function projectOpaque(ledger) {
  const out = {};
  for (const [file, entry] of Object.entries(ledger || {})) out[file] = set(entry && entry.namespaces);
  return out;
}

/**
 * ΚΑΘΕ πεδίο του `DEFAULTS`, ταξινομημένο. Συνάρτηση = «επηρεάζει έξοδο, με αυτή την προβολή»·
 * `gateOnly(why)` = «το διαβάζει μόνο κρίση, και το Layer 1 το ξανακρίνει ζωντανά».
 * ⚠️ ΜΗΝ κάνεις πεδίο `gateOnly` για να σωπάσει κόκκινο: αν αλλάζει artifact ή manifest, ΕΙΝΑΙ έξοδος.
 */
const CONFIG_INPUTS = Object.freeze({
  shellRoots: asIs,                 // η σειρά φτάνει στο `manifest.shellRoots`
  extraShellRoots: asIs,
  guaranteedNamespaces: names,      // τα ονόματα ⇒ `whole`· τα budgets τα κρίνει το checkLedgerBudget ζωντανά
  shellNamespaces: gateOnly('checkShellCensus (Layer 1) το διαβάζει ζωντανά από το config'),
  shellNamespacesSeal: gateOnly('checkShellCensus (Layer 1) — σφράγιση πλήθους, όχι έξοδος'),
  languages: asIs,                  // η ΠΡΩΤΗ είναι η πρωτεύουσα ⇒ η σειρά μετρά
  localesDir: asIs,
  outputDir: asIs,
  keyConstants: asIs,               // η λίστα· το ΠΕΡΙΕΧΟΜΕΝΟ είναι δική του είσοδος
  excludeConsumers: set,            // `.some(prefix)` ⇒ η σειρά δεν μετρά
  dynamicKeyPolicy: projectPolicy,
  routeSlices: names,               // οι σελίδες ⇒ artifacts· sealed/history τα κρίνει το checkRouteLedger ζωντανά
  lazyRouteRegistries: asIs,
  lazyRouteMountNamespaces: gateOnly('judgeLazyRoutes — ετυμηγορία απογραφής, δεν γράφει artifact'),
  lazyRouteOpaqueNamespaces: projectOpaque,
  lazyRouteMountSeal: gateOnly('judgeLazyRoutes — σφράγιση πλήθους, όχι έξοδος'),
});

/** Ολικότητα: πεδίο χωρίς ταξινόμηση, ή ταξινόμηση χωρίς πεδίο ⇒ `throw` στη φόρτωση. */
function assertConfigClassified(defaults = DEFAULTS, inputs = CONFIG_INPUTS) {
  const unclassified = Object.keys(defaults).filter(field => !(field in inputs));
  const stale = Object.keys(inputs).filter(field => !(field in defaults));
  if (unclassified.length === 0 && stale.length === 0) return;
  throw new Error(
    `ADR-744 §30: το ${CONFIG_FILE} και το CONFIG_INPUTS (global-inputs.js) αποκλίνουν — ` +
    `αταξινόμητα: [${unclassified.join(', ')}] · χωρίς πεδίο: [${stale.join(', ')}]. ` +
    'Κάθε πεδίο δηλώνει αν επηρεάζει την ΕΞΟΔΟ ή μόνο την ΠΥΛΗ.',
  );
}
assertConfigClassified();

function configParts(config) {
  const parts = {};
  for (const [field, project] of Object.entries(CONFIG_INPUTS)) {
    if (typeof project === 'function') parts[field] = project(config[field]);
  }
  return parts;
}

// ─── Δηλωτικές είσοδοι: ο ΙΔΙΟΣ reader με τον γεννήτορα ─────────────────────

/** Map/Set → απλά δεδομένα, ώστε το `stableStringify` να τα δει (το JSON δεν βλέπει Map). */
function plain(value) {
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, inner]) => [key, plain(inner)]));
  if (value instanceof Set) return [...value].map(plain).sort();
  if (Array.isArray(value)) return value.map(plain);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, plain(inner)]));
  }
  return value;
}

function keyConstantParts(root, config) {
  const { loadKeyConstants } = require('./key-tables');
  return plain(loadKeyConstants(root, config.keyConstants));
}

function aliasParts(root) {
  const { readTsPathAliases } = require('../module-graph/resolve-specifier');
  return { paths: readTsPathAliases(root, TS_PATH_ALIAS_CONFIG) };
}

function namespaceTableParts(loaderName) {
  return root => plain(require('../i18n-namespace-extract')[loaderName](root));
}

/** Ίδια συνθήκη με το `renderComplete`: χωρίς μητρώα, ο γεννήτορας δεν διαβάζει τίποτα από αυτά. */
function lazyRouteParts(root, config) {
  if (config.lazyRouteRegistries.length === 0) return {};
  const { readRegistries, readStringArrayConst } = require('./lazy-routes');
  const { loadCompatNamespaces } = require('../i18n-namespace-extract');
  return {
    registries: readRegistries(root, config),
    supportedNamespaces: readStringArrayConst(root, LAZY_CONFIG, 'SUPPORTED_NAMESPACES'),
    compatNamespaces: plain(loadCompatNamespaces(root)),
  };
}

// ─── Toolchain: η κλειστότητα `require` του action ──────────────────────────

// `$` αποκλείεται: specifier δεν το περιέχει ποτέ, ενώ το `require('${x}')` ενός μηνύματος σφάλματος
// (αυτού εδώ του αρχείου — μετρημένο) θα γινόταν «πακέτο» με όνομα `${x}`.
const REQUIRE_CALL = /\brequire\s*\(\s*(['"])([^'"$]+)\1\s*\)/g;

/**
 * Οι κυριολεκτικοί specifiers ενός module, από το ΩΜΟ κείμενο (σχόλια μαζί) ⇒ υπερσύνολο: το λάθος
 * του είναι ψευδώς κόκκινο, ποτέ ψευδώς πράσινο. Χωρίς parser, επειδή το καλεί και η σκανδάλη του hook.
 */
function requiredSpecifiers(text) {
  return [...text.matchAll(REQUIRE_CALL)].map(match => match[2]);
}

/**
 * Η ΑΡΝΗΣΗ — όπως της δυναμικής `t()`: `require(<έκφραση>)` είναι είσοδος που ο κατάλογος δεν ξέρει.
 * Με AST, όχι regex: μετρημένο, ο σαρωτής σχολίων έδινε ψευδή άρνηση πάνω στο docblock ΑΥΤΟΥ του αρχείου.
 * Τρέχει μόνο στον υπολογισμό του digest, όπου ο parser φορτώνεται ούτως ή άλλως.
 */
function assertLiteralRequires(text, relFile) {
  const ts = require('typescript');
  const source = ts.createSourceFile(relFile, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      const [argument] = node.arguments;
      if (!argument || !ts.isStringLiteralLike(argument)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        throw new Error(`ADR-744 §30: μη κυριολεκτικό require στο ${relFile}:${line} — το toolchain digest δεν ξέρει την είσοδό του.`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function resolveLocal(root, fromRel, spec) {
  const base = path.posix.join(path.posix.dirname(fromRel), spec);
  for (const ext of TOOLCHAIN_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    const abs = path.join(root, candidate);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return candidate;
  }
  throw new Error(`ADR-744 §30: το require('${spec}') του ${fromRel} δεν λύνεται σε αρχείο.`);
}

const isBuiltin = spec => spec.startsWith('node:') || builtinModules.includes(spec.split('/')[0]);
const packageOf = spec => spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');

/** @returns {{files: string[], packages: string[]}} ταξινομημένα */
function toolchainClosure(root) {
  const files = new Set();
  const packages = new Set();
  const queue = [TOOLCHAIN_ENTRY];
  while (queue.length > 0) {
    const relFile = queue.pop();
    if (files.has(relFile)) continue;
    const abs = path.join(root, relFile);
    if (!fs.existsSync(abs)) throw new Error(`ADR-744 §30: module του toolchain λείπει: ${relFile}`);
    files.add(relFile);
    for (const spec of requiredSpecifiers(fs.readFileSync(abs, 'utf8'))) {
      if (spec.startsWith('.')) queue.push(resolveLocal(root, relFile, spec));
      else if (!isBuiltin(spec)) packages.add(packageOf(spec));
    }
  }
  return { files: [...files].sort(), packages: [...packages].sort() };
}

/** Η έκδοση που ΟΝΤΩΣ φορτώνεται (Nx `externalDependencies`): από το `main` προς τα πάνω ως το package.json του. */
function installedVersion(name) {
  let dir = path.dirname(require.resolve(name));
  for (;;) {
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (pkg.name === name) return pkg.version;
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`ADR-744 §30: δεν βρέθηκε package.json για το «${name}».`);
    dir = parent;
  }
}

function toolchainParts(root) {
  const { files, packages } = toolchainClosure(root);
  const parts = {};
  for (const relFile of files) {
    const text = toLf(fs.readFileSync(path.join(root, relFile), 'utf8'));
    assertLiteralRequires(text, relFile);
    parts[relFile] = text;
  }
  for (const name of packages) parts[`npm:${name}`] = installedVersion(name);
  return parts;
}

// ─── Το μητρώο ──────────────────────────────────────────────────────────────

/**
 * Η ρίζα του κώδικα που ΤΡΕΧΕΙ. Ο γεννήτορας την περνά ως `toolRoot`: στον δίσκο είναι το repo,
 * στο `generate:…:index` είναι το στιγμιότυπο (εκεί τρέχει ο κώδικας του ευρετηρίου). Η πύλη
 * `--index` περνά το ΣΤΙΓΜΙΟΤΥΠΟ — κρίνει το toolchain του commit, όχι του δίσκου.
 */
const CODE_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Κάθε είσοδος, ως συναρτήσεις ενός context `{ root, toolRoot, config }`:
 * `paths` = τα αρχεία που διαβάζει ο reader (στιγμιότυπο + σκανδάλη)·
 * `parts` = `{ τμήμα: τιμή }`, ό,τι ΒΛΕΠΕΙ ο γεννήτορας από αυτά.
 */
const GLOBAL_INPUTS = Object.freeze([
  { id: 'config', paths: () => [CONFIG_FILE], parts: ({ config }) => configParts(config) },
  {
    id: 'keyConstants',
    paths: ({ config }) => config.keyConstants.map(entry => entry.file),
    parts: ({ root, config }) => keyConstantParts(root, config),
  },
  { id: 'tsPathAliases', paths: () => [TS_PATH_ALIAS_CONFIG], parts: ({ root }) => aliasParts(root) },
  {
    id: 'namespaceBundles',
    paths: () => [NAMESPACE_BUNDLES_FILE],
    parts: ({ root }) => namespaceTableParts('loadNamespaceBundles')(root),
  },
  {
    id: 'lazyRoutes',
    paths: ({ config }) => (config.lazyRouteRegistries.length === 0
      ? [] : [LAZY_CONFIG, NAMESPACE_COMPAT_FILE, ...config.lazyRouteRegistries]),
    parts: ({ root, config }) => lazyRouteParts(root, config),
  },
  {
    id: 'toolchain',
    paths: ({ toolRoot }) => toolchainClosure(toolRoot).files,
    parts: ({ toolRoot }) => toolchainParts(toolRoot),
  },
]);

const contextOf = (root, config, toolRoot) => ({ root, config, toolRoot: toolRoot || CODE_ROOT });

/**
 * `{ είσοδος: { τμήμα: sha256 } }` — γράφεται στο manifest και σφραγίζεται από το `inputsSha256`.
 * @param {string} [toolRoot] από πού διαβάζεται το toolchain· προεπιλογή ο κώδικας που τρέχει
 */
function computeGlobalInputs(root, config, toolRoot, inputs = GLOBAL_INPUTS) {
  const context = contextOf(root, config, toolRoot);
  const out = {};
  for (const input of inputs) {
    const parts = input.parts(context);
    out[input.id] = Object.fromEntries(Object.keys(parts).sort().map(part => [part, digestOf(parts[part])]));
  }
  return out;
}

/** Κάθε αρχείο που διαβάζει κάποιος reader, ταξινομημένο και μοναδικό. */
function globalInputPaths(root, config, toolRoot, inputs = GLOBAL_INPUTS) {
  const context = contextOf(root, config, toolRoot);
  return [...new Set(inputs.flatMap(input => input.paths(context)))].sort();
}

/** @returns {string[]} `είσοδος:τμήμα (αλλαγμένο|νέο|αφαιρέθηκε)`, ταξινομημένα */
function diffGlobalInputs(recorded, current) {
  const changes = [];
  for (const id of [...new Set([...Object.keys(recorded), ...Object.keys(current)])].sort()) {
    const before = recorded[id] || {};
    const after = current[id] || {};
    for (const part of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      if (!(part in before)) changes.push(`${id}:${part} (νέο)`);
      else if (!(part in after)) changes.push(`${id}:${part} (αφαιρέθηκε)`);
      else if (before[part] !== after[part]) changes.push(`${id}:${part} (αλλαγμένο)`);
    }
  }
  return changes;
}

/**
 * E. Ο έλεγχος του Layer 1. Fail-closed σε ΚΑΘΕ κατεύθυνση: manifest χωρίς πεδίο ⇒ κόκκινο·
 * reader που πετά ⇒ κόκκινο με το μήνυμά του — ποτέ «δεν μπόρεσα να κρίνω» με στολή «πέρασε».
 */
function checkGlobalInputs(config, manifest, root, toolRoot = root, inputs = GLOBAL_INPUTS) {
  if (!manifest.globalInputs) {
    return 'το manifest δεν έχει αποτύπωμα καθολικών εισόδων (`globalInputs`, ADR-744 §30) — γράφτηκε από παλαιότερο γεννήτορα.';
  }
  let current;
  try {
    current = computeGlobalInputs(root, config, toolRoot, inputs);
  } catch (error) {
    return `οι καθολικές είσοδοι δεν υπολογίζονται — ${error.message}`;
  }
  const changes = diffGlobalInputs(manifest.globalInputs, current);
  if (changes.length === 0) return null;
  const shown = changes.slice(0, 8).join(' · ');
  const more = changes.length > 8 ? ` · …και ${changes.length - 8} ακόμη` : '';
  return `άλλαξε καθολική είσοδος του γεννήτορα (config · σταθερές · aliases · toolchain) χωρίς αναγέννηση: ${shown}${more}`;
}

module.exports = {
  CODE_ROOT,
  TS_PATH_ALIAS_CONFIG,
  TOOLCHAIN_ENTRY,
  CONFIG_INPUTS,
  GLOBAL_INPUTS,
  assertConfigClassified,
  configParts,
  requiredSpecifiers,
  assertLiteralRequires,
  toolchainClosure,
  computeGlobalInputs,
  globalInputPaths,
  diffGlobalInputs,
  checkGlobalInputs,
};
