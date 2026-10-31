#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §27 · ADR-280 §11.8 Β4.1 — ΤΑ ΜΗΤΡΩΑ ΤΕΜΠΕΛΙΚΩΝ CHUNKS, ΔΙΑΒΑΣΜΕΝΑ ΜΕ AST
 * =============================================================================
 *
 * «Ποια κλειδιά δηλώνει κάθε μητρώο — και καλεί κάποιος `defineLazy*` ΕΞΩ από τα μητρώα;»
 *
 * Βγήκε από το `lazy-routes.js` (Β4.2, όριο 500 γραμμών): η **ανάγνωση** των δηλώσεων είναι μία
 * ευθύνη, η **παραγωγή/κρίση** του χάρτη άλλη. Το `lazy-routes.js` τα επανεξάγει αυτούσια, ώστε κανένας
 * καταναλωτής (γεννήτορας · CHECK 3.34 · καθολικές είσοδοι · tests) να μην αλλάξει.
 *
 * @module scripts/lib/i18n-shell-slice/lazy-registry-read
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const MG = require('../module-graph');
const { isTestSource } = require('../gate-input');
const { parseSource } = require('./key-extract');

/** Η κλήση που **δηλώνει** μητρώο — το όνομα γράφεται εδώ μία φορά, για reader και μηνύματα. */
const REGISTRY_CALL = 'defineLazyRoutes';
/**
 * ADR-280 §11.8 Β4.1 — οι κλήσεις που δηλώνουν τεμπέλικα chunks, και το **είδος** που δηλώνει η καθεμία.
 * Ένα πεδίο config (`lazyRouteRegistries`), δύο είδη: η κλήση μέσα στο αρχείο λέει ποιο. Η επιφάνεια
 * (διάλογος, καρτέλα) μπαίνει στον ΙΔΙΟ χάρτη, την ΙΔΙΑ απογραφή Κ1/Κ2, την ΙΔΙΑ κάλυψη Layer 1.
 */
const REGISTRY_CALLS = Object.freeze({ [REGISTRY_CALL]: 'route', defineLazySurfaces: 'surface' });

/** Το είδος της κλήσης `node`, ή `null` όταν δεν δηλώνει μητρώο. */
function registryCallKind(node) {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression)
    && Object.prototype.hasOwnProperty.call(REGISTRY_CALLS, node.expression.text)
    ? REGISTRY_CALLS[node.expression.text] : null;
}

/** Ο ένας `import('…')` μιας εγγραφής. Κανένας ή πολλοί ⇒ `null` — ο καλών αρνείται. */
function importSpecOf(node) {
  const specs = [];
  const visit = child => {
    if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [arg] = child.arguments;
      specs.push(arg && ts.isStringLiteralLike(arg) ? arg.text : null);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return specs.length === 1 ? specs[0] : null;
}

/**
 * ADR-280 §11.8 Β4.2 — το χειρόγραφο `namespaces` μιας εγγραφής, ως **δεδομένο**: μόνο κυριολεκτικός πίνακας
 * συμβολοσειρών. Ό,τι άλλο ⇒ `throw` — μια αναμονή που δεν διαβάζεται δεν κρίνεται απέναντι στη γραμμή.
 */
function readDeclaredNamespaces(node, where, key) {
  if (!node) return [];
  let init = node;
  while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression;
  if (!ts.isArrayLiteralExpression(init) || !init.elements.every(ts.isStringLiteralLike)) {
    throw new Error(`${where}: το \`namespaces\` της «${key}» δεν είναι κυριολεκτικός πίνακας συμβολοσειρών.`);
  }
  return init.elements.map(element => element.text);
}

/** Μία εγγραφή `Key: { load: () => import('…'), ssr?: … }`. Ό,τι δεν διαβάζεται ⇒ `throw`, ποτέ σιωπηλή παράλειψη. */
function readEntry(property, registry, source, kind = 'route') {
  const where = `${registry}:${source.getLineAndCharacterOfPosition(property.getStart(source)).line + 1}`;
  if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) {
    throw new Error(`${where}: εγγραφή του ${REGISTRY_CALL} που δεν είναι \`Κλειδί: { load, … }\` — ο χάρτης δεν μπορεί να τη δει.`);
  }
  const key = property.name.text;
  const fields = new Map(property.initializer.properties
    .filter(ts.isPropertyAssignment)
    .map(field => [field.name.text, field.initializer]));
  const load = fields.get('load');
  const spec = load ? importSpecOf(load) : null;
  if (spec === null) throw new Error(`${where}: το \`load\` της «${key}» δεν έχει ΑΚΡΙΒΩΣ ΕΝΑ κυριολεκτικό import().`);

  const namespaces = readDeclaredNamespaces(fields.get('namespaces'), where, key);
  const ssrNode = fields.get('ssr');
  // Επιφάνεια = μοντάρεται από ενέργεια χρήστη ⇒ πάντα client. Ένα `ssr: true` θα της έσβηνε τη γραμμή.
  if (kind === 'surface' && ssrNode) throw new Error(`${where}: η επιφάνεια «${key}» δηλώνει \`ssr\` — οι επιφάνειες είναι πάντα client-only.`);
  if (ssrNode && ssrNode.kind !== ts.SyntaxKind.TrueKeyword && ssrNode.kind !== ts.SyntaxKind.FalseKeyword) {
    throw new Error(`${where}: το \`ssr\` της «${key}» δεν είναι κυριολεκτικό true/false.`);
  }
  return { key, spec, registry, kind, namespaces, ssr: Boolean(ssrNode) && ssrNode.kind === ts.SyntaxKind.TrueKeyword };
}

/**
 * Οι εγγραφές ενός μητρώου, με AST.
 *
 * ⚠️ Ένα `...spread` μέσα στην κλήση **δεν** είναι εγγραφή: είναι άλλο μητρώο, που
 * διαβάζεται από το δικό του αρχείο. Μητρώο χωρίς καμία κλήση ⇒ `throw` — ένα αρχείο
 * που «δεν έχει διαδρομές» επειδή άλλαξε σχήμα θα έδινε άδειο, πράσινο χάρτη.
 */
function readRegistry(projectRoot, registry) {
  const abs = path.join(projectRoot, registry);
  if (!fs.existsSync(abs)) throw new Error(`μητρώο τεμπέλικων διαδρομών δεν βρέθηκε: ${registry}`);
  const source = parseSource(abs, fs.readFileSync(abs, 'utf8'));
  const entries = [];
  let calls = 0;
  const visit = node => {
    const kind = registryCallKind(node);
    if (kind !== null) {
      const [declarations] = node.arguments;
      if (!declarations || !ts.isObjectLiteralExpression(declarations)) {
        throw new Error(`${registry}: το ${node.expression.text}(…) δεν δέχεται κυριολεκτικό αντικείμενο.`);
      }
      calls += 1;
      for (const property of declarations.properties) {
        if (!ts.isSpreadAssignment(property)) entries.push(readEntry(property, registry, source, kind));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (calls === 0) throw new Error(`${registry}: καμία κλήση ${Object.keys(REGISTRY_CALLS).join('/')}(…) — δηλωμένο μητρώο χωρίς δήλωση.`);
  return entries;
}

/**
 * ADR-280 §11.8 Β4.1 — Η ΑΛΛΗ ΚΑΤΕΥΘΥΝΣΗ: αρχείο που **καλεί** `defineLazy*` χωρίς να είναι στο
 * `lazyRouteRegistries` δεν παίρνει γραμμή ⇒ το chunk του δεν περιμένει τίποτα ⇒ ωμά κλειδιά, σιωπηλά.
 * Μία συνάρτηση, δύο είσοδοι: ο γεννήτορας της δίνει τους εισαγωγείς του factory (από τον γράφο),
 * το Layer 1 τα σταδιοποιημένα αρχεία.
 *
 * @param {string[]} files    σχετικές διαδρομές (posix)
 * @param {(relFile: string) => string} readText
 * @returns {string[]} τα αδήλωτα αρχεία-καλούντες, ταξινομημένα
 */
function undeclaredRegistryCallers(files, readText, config) {
  const declared = new Set(config.lazyRouteRegistries);
  // Ένα test που καλεί το factory για να το ΕΛΕΓΞΕΙ δεν είναι chunk παραγωγής (μετρημένο: ψευδώς θετικό
  // `lazyRouteFactory-namespaces.test.tsx` στην πρώτη εκτέλεση) — το κατηγόρημα των πυλών, όχι δεύτερο.
  const callers = files.filter(relFile => !declared.has(relFile) && !isTestSource(relFile)
    && /\.(?:[cm]?[jt]sx?)$/.test(relFile)).filter(relFile => {
    const text = readText(relFile);
    if (typeof text !== 'string' || !Object.keys(REGISTRY_CALLS).some(call => text.includes(call))) return false;
    let found = false;
    const visit = node => {
      if (registryCallKind(node) !== null) found = true;
      if (!found) ts.forEachChild(node, visit);
    };
    visit(parseSource(relFile, text));
    return found;
  });
  return [...new Set(callers)].sort();
}

/** Οι εισαγωγείς ενός ονόματος `defineLazy*` — ρωτώντας τον γράφο, όχι το κείμενο. */
function registryCallImporters(graph, projectRoot) {
  const wanted = new Set(Object.keys(REGISTRY_CALLS));
  const importers = [];
  for (const [abs, mod] of graph.modules) {
    if ((mod.imports || []).some(imp => (imp.names || []).some(name => wanted.has(name.imported)))) {
      importers.push(MG.toPosix(path.relative(projectRoot, abs)));
    }
  }
  return importers;
}

function describeUndeclaredCallers(files) {
  return `αρχείο/α που καλούν ${Object.keys(REGISTRY_CALLS).join('/')}(…) ΧΩΡΙΣ να είναι στο lazyRouteRegistries `
    + `(τα chunks τους δεν θα περίμεναν κανένα namespace): ${files.join(' · ')}`;
}

/**
 * ADR-280 §11.8 Β4.3 — **ΚΑΝΟΝΑΣ Ρ: `import()` ΣΤΟΧΟΥ ΕΓΓΡΑΦΗΣ ΕΞΩ ΑΠΟ ΜΗΤΡΩΟ ⇒ ΑΡΝΗΣΗ.** Μηδενική ανοχή, χωρίς λίστα.
 *
 * 🔴 Η τρύπα που κλείνει: ο κανόνας εισδοχής (`surface-coverage.js`) σταματά σε **κάθε** `import()` προς αρχείο που
 * είναι στόχος εγγραφής — σωστά, όταν το `import()` είναι της εγγραφής (το chunk της περιμένει τη γραμμή της). Ένα
 * τοπικό `dynamic(() => import(<στόχος>))` όμως φορτώνει τον ΙΔΙΟ κώδικα **χωρίς** τα κείμενα — ωμά κλειδιά με την
 * πύλη πράσινη. Μετρημένο: `DxfPerfHarness` → `DxfViewerApp` (ο κρυμμένος 5ος harness) · `preloadRoutes.ts` (7 specs
 * γραμμένα δεύτερη φορά). Θεραπεία: η εγγραφή (`LazyRoutes.X`) ή το `preload()` της — ταυτότητα, ποτέ αντίγραφο.
 *
 * Μία συνάρτηση, δύο είσοδοι (πρότυπο `undeclaredRegistryCallers`): πρόθυμος γράφος ⇒ όλα τα modules· Layer 1 ⇒ τα
 * σταδιοποιημένα. Τα tests εξαιρούνται με το κατηγόρημα των πυλών (`isTestSource`).
 *
 * @param {string[]} files σχετικές διαδρομές (posix)
 * @param {(relFile: string) => ?object[]} importsOf οι εισαγωγές του module, από τον γράφο
 * @param {(spec: string, relFile: string) => ?string} resolveRel spec → σχετική διαδρομή αρχείου του έργου, ή `null`
 * @param {Map<string, string>} targets στόχος εγγραφής (σχετική διαδρομή) → κλειδί
 * @returns {{file: string, target: string, key: string}[]}
 */
function registryBypasses(files, importsOf, resolveRel, targets, config) {
  const registries = new Set(config.lazyRouteRegistries);
  const found = [];
  for (const relFile of [...new Set(files)].sort()) {
    if (registries.has(relFile) || isTestSource(relFile)) continue;
    for (const imp of importsOf(relFile) || []) {
      if (imp.kind !== 'dynamic') continue;
      const target = resolveRel(imp.spec, relFile);
      if (target !== null && targets.has(target)) found.push({ file: relFile, target, key: targets.get(target) });
    }
  }
  return found;
}

function describeRegistryBypasses(found) {
  return `import() στόχου εγγραφής ΕΞΩ από μητρώο (ίδιος κώδικας, ΧΩΡΙΣ τα κείμενα που περιμένει η εγγραφή ⇒ ωμά `
    + `κλειδιά — χρησιμοποίησε την εγγραφή ή το .preload() της): `
    + found.map(item => `${item.file} → ${item.target} (εγγραφή ${item.key})`).join(' · ');
}

/** Όλα τα δηλωμένα μητρώα. Το ίδιο κλειδί δύο φορές ⇒ `throw`: ο χάρτης έχει μία γραμμή ανά κλειδί. */
function readRegistries(projectRoot, config) {
  const entries = config.lazyRouteRegistries.flatMap(registry => readRegistry(projectRoot, registry));
  const seen = new Map();
  for (const entry of entries) {
    if (seen.has(entry.key)) {
      throw new Error(`διπλό κλειδί τεμπέλικης διαδρομής «${entry.key}»: ${seen.get(entry.key)} και ${entry.registry}.`);
    }
    seen.set(entry.key, entry.registry);
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

/** Τα κλειδιά που **οφείλουν** γραμμή στον χάρτη: όσα αποδίδουν μόνο στον browser. */
function awaitedKeys(entries) {
  return entries.filter(entry => !entry.ssr).map(entry => entry.key);
}

module.exports = {
  REGISTRY_CALL,
  REGISTRY_CALLS,
  readEntry,
  readRegistry,
  readRegistries,
  awaitedKeys,
  undeclaredRegistryCallers,
  registryCallImporters,
  describeUndeclaredCallers,
  registryBypasses,
  describeRegistryBypasses,
};
