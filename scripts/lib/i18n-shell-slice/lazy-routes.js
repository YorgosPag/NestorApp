#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §27 — ΤΑ NAMESPACES ΜΙΑΣ ΤΕΜΠΕΛΙΚΗΣ ΔΙΑΔΡΟΜΗΣ, ΠΑΡΑΓΟΜΕΝΑ
 * =============================================================================
 *
 * «Τι πρέπει να έχει φτάσει **πριν** αποδώσει αυτό το chunk;»
 *
 * Μια σελίδα `ssr: false` είναι **εκτός** route slice: η κλειστότητα κόβεται στο
 * δυναμικό όριο. Chunk και namespace είναι δύο ανεξάρτητα αιτήματα· αν φτάσει πρώτο
 * το chunk, ένα καρέ δείχνει ωμά κλειδιά. Η θεραπεία υπήρχε (`createLazyRoute({
 * namespaces })`) αλλά **χειρόγραφη** — 4 εγγραφές στις 83.
 *
 * 🏆 ΤΟ ΣΧΗΜΑ ΕΙΝΑΙ ΤΟΥ `remix-i18next` (`handle.i18n` ανά διαδρομή, αναμονή πριν το
 * render), ΜΕ ΤΟ ΚΕΝΟ ΤΟΥ ΚΛΕΙΣΤΟ: εκεί τη λίστα τη γράφει άνθρωπος. Εδώ **παράγεται**
 * από τη στατική κλειστότητα του chunk, με τον **ίδιο** walker που ορίζει το κέλυφος.
 *
 * 🔑 **ΔΗΛΩΣΕΙΣ, ΟΧΙ ΚΛΕΙΔΙΑ — ΜΕΤΡΗΜΕΝΗ ΑΠΟΦΑΣΗ (§27.3).** Το σύνολο είναι ό,τι
 * **ονομάζουν** τα αρχεία της κλειστότητας (`useTranslation(...)`, ρητό `t('ns:key')`),
 * συν τα compat splits που φορτώνει ο hook. Slice σε επίπεδο κλειδιού μετρήθηκε: **914**
 * ανεπίλυτες δυναμικές `t()` σε 51 διαδρομές. Γι' αυτό εδώ **δεν καλείται** το
 * `buildShellPlan`: δεν υπάρχει κλειδί να λυθεί, άρα ούτε άρνηση να συλλεχθεί.
 *
 * ⚠️ **ΤΑ «ΟΛΟΚΛΗΡΑ» ΜΕΝΟΥΝ ΣΤΗ ΛΙΣΤΑ ΑΝΑΜΟΝΗΣ.** Το slice είναι μόνο `el`: εκεί το
 * `loadNamespace` επιλύεται αμέσως (πλήρες bundle), ενώ σε άλλη γλώσσα είναι η μόνη
 * αναμονή που υπάρχει. Εξαιρούνται **μόνο από το ratchet**, όπου δεν κοστίζουν τίποτα.
 *
 * ⛔ **ΤΟ ΦΡΕΝΟ ΕΙΝΑΙ ΤΑΥΤΟΤΗΤΑ, ΠΟΤΕ BYTES (§23.2).** Τα ζεύγη `(διαδρομή, namespace
 * εκτός εκκίνησης)` είναι κλειστή απογραφή + σφραγισμένο πλήθος που μόνο συρρικνώνεται.
 * Η ακριβή αναμονή θεραπεύεται με **διαχωρισμό κώδικα**, όχι με εξαίρεση.
 *
 * @module scripts/lib/i18n-shell-slice/lazy-routes
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const MG = require('../module-graph');
const {
  loadNamespaceBundles,
  loadCompatNamespaces,
  withCompatNamespaces,
  extractExplicitTCalls,
} = require('../i18n-namespace-extract');
const { computeShellClosure } = require('./shell-closure');
const { parseSource } = require('./key-extract');
const { stableStringify } = require('./slice-build');
const { createNamespaceDeclarationReader } = require('./namespace-declarations');
const {
  LEDGER,
  SEAL,
  OPAQUE_LEDGER,
  mountOnlyPairs,
  auditMountCensus,
  describeMountFailures,
  describeMountGrowth,
  announceMountSlack,
} = require('./lazy-route-census');

const ARTIFACT_NAME = 'lazy-route-namespaces.json';
/** Η κλήση που **δηλώνει** μητρώο — το όνομα γράφεται εδώ μία φορά, για reader και μηνύματα. */
const REGISTRY_CALL = 'defineLazyRoutes';
const LAZY_CONFIG = 'src/i18n/lazy-config.ts';

const COVERAGE = Object.freeze({
  MISSING_ROW: 'route-without-row',
  ORPHAN_ROW: 'row-without-route',
  UNSUPPORTED: 'row-names-unsupported-namespace',
});

function artifactPath(config) {
  return MG.toPosix(path.join(config.outputDir, ARTIFACT_NAME));
}

/** `export const NAME[: T] = [ 'a', … ]` ως **δήλωση** — το `CRITICAL_NAMESPACES` έχει τύπο, άρα regex σε κείμενο δεν το διαβάζει. */
function readStringArrayConst(projectRoot, relFile, name) {
  const abs = path.join(projectRoot, relFile);
  if (!fs.existsSync(abs)) throw new Error(`${relFile} δεν βρέθηκε — η λίστα ${name} δεν μπορεί να διαβαστεί.`);
  const source = parseSource(abs, fs.readFileSync(abs, 'utf8'));
  let found = null;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      let init = node.initializer;
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init))) init = init.expression;
      if (init && ts.isArrayLiteralExpression(init)) {
        found = init.elements.filter(ts.isStringLiteralLike).map(element => element.text);
      }
    }
    if (found === null) ts.forEachChild(node, visit);
  };
  visit(source);
  if (found === null || found.length === 0) {
    throw new Error(`${relFile}: η λίστα ${name} δεν διαβάστηκε ως πίνακας συμβολοσειρών — άδεια λίστα θα έκανε κάθε έλεγχο πράσινο.`);
  }
  return found;
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

/** Μία εγγραφή `Key: { load: () => import('…'), ssr?: … }`. Ό,τι δεν διαβάζεται ⇒ `throw`, ποτέ σιωπηλή παράλειψη. */
function readEntry(property, registry, source) {
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

  const ssrNode = fields.get('ssr');
  if (ssrNode && ssrNode.kind !== ts.SyntaxKind.TrueKeyword && ssrNode.kind !== ts.SyntaxKind.FalseKeyword) {
    throw new Error(`${where}: το \`ssr\` της «${key}» δεν είναι κυριολεκτικό true/false.`);
  }
  return { key, spec, registry, ssr: Boolean(ssrNode) && ssrNode.kind === ts.SyntaxKind.TrueKeyword };
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
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === REGISTRY_CALL) {
      const [declarations] = node.arguments;
      if (!declarations || !ts.isObjectLiteralExpression(declarations)) {
        throw new Error(`${registry}: το ${REGISTRY_CALL}(…) δεν δέχεται κυριολεκτικό αντικείμενο.`);
      }
      calls += 1;
      for (const property of declarations.properties) {
        if (!ts.isSpreadAssignment(property)) entries.push(readEntry(property, registry, source));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (calls === 0) throw new Error(`${registry}: καμία κλήση ${REGISTRY_CALL}(…) — δηλωμένο μητρώο χωρίς δήλωση.`);
  return entries;
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

/**
 * Ό,τι **ονομάζει** ένα αρχείο, με μνήμη ανάμεσα στις διαδρομές (οι κλειστότητες
 * επικαλύπτονται σχεδόν ολόκληρες — χωρίς μνήμη το ίδιο αρχείο διαβάζεται 80 φορές).
 *
 * @returns {(relFile: string) => {namespaces: string[], opaque: object[]}}
 *   `opaque` = `useTranslation(<κάτι που δεν αποτιμάται στατικά>)` — βλ. `namespace-declarations.js`.
 */
function createFileNamespaceReader(projectRoot, config, graph) {
  const readDeclarations = createNamespaceDeclarationReader({ graph, bundles: loadNamespaceBundles(projectRoot) });
  const cache = new Map();
  return relFile => {
    if (cache.has(relFile)) return cache.get(relFile);
    let named = { namespaces: [], opaque: [] };
    if (!config.excludeConsumers.some(prefix => relFile.startsWith(prefix))) {
      const abs = MG.toPosix(path.join(projectRoot, relFile));
      const declared = readDeclarations(abs);
      const explicit = extractExplicitTCalls(fs.readFileSync(abs, 'utf8')).map(call => call.ns);
      // Ένα αδιαφανές `useTranslation(prop)` το απαντά ΑΝΘΡΩΠΟΣ, με λόγο — ή κανείς (άρνηση).
      const answer = declared.opaque.length > 0 ? config[OPAQUE_LEDGER][relFile] : undefined;
      named = {
        namespaces: [...new Set([...declared.namespaces, ...explicit, ...(answer ? answer.namespaces : [])])],
        opaque: declared.opaque,
        answered: answer !== undefined,
      };
    }
    cache.set(relFile, named);
    return named;
  };
}

/** Τα namespaces μιας κλειστότητας + **ποιο αρχείο** ονομάζει το καθένα (για το μήνυμα). */
function namespacesOfClosure(files, readFile, compat, supported) {
  const from = new Map();
  for (const relFile of files) {
    for (const namespace of withCompatNamespaces(readFile(relFile).namespaces, compat)) {
      if (!supported.has(namespace)) continue;
      if (!from.has(namespace)) from.set(namespace, []);
      from.get(namespace).push(relFile);
    }
  }
  return from;
}

/**
 * Ο χάρτης `κλειδί → namespaces[]`, από τον **ίδιο γράφο** που έχτισε το κέλυφος.
 *
 * @returns {{entries: object[], rows: object, provenance: Map, inputs: Set<string>, unresolved: object[]}}
 *   `unresolved` = εγγραφές των οποίων το `import()` δεν λύθηκε σε αρχείο του έργου —
 *   **επιστρέφονται**, δεν τυπώνονται (ίδια γραμμή διαχωρισμού με το `renderComplete`).
 */
function buildLazyRouteNamespaces({ projectRoot, config, graph }) {
  const entries = readRegistries(projectRoot, config);
  const supported = new Set(readStringArrayConst(projectRoot, LAZY_CONFIG, 'SUPPORTED_NAMESPACES'));
  const compat = loadCompatNamespaces(projectRoot);
  const readFile = createFileNamespaceReader(projectRoot, config, graph);
  const resolve = MG.createResolver(graph);

  const rows = {};
  const provenance = new Map();
  const inputs = new Set();
  const unresolved = [];
  for (const entry of entries.filter(candidate => !candidate.ssr)) {
    const target = resolve(entry.spec, MG.toPosix(path.join(projectRoot, entry.registry)));
    if (target.kind !== 'internal') { unresolved.push(entry); continue; }
    const closure = computeShellClosure(graph, [target.file]);
    const from = namespacesOfClosure(closure.files, readFile, compat, supported);
    rows[entry.key] = [...from.keys()].sort();
    provenance.set(entry.key, from);
    closure.files.forEach(file => inputs.add(file));
  }
  const opaqueFiles = [...inputs].sort().filter(file => readFile(file).opaque.length > 0);
  const opaque = opaqueFiles
    .filter(file => !readFile(file).answered)
    .flatMap(file => readFile(file).opaque.map(site => ({ file, ...site })));
  // Η ΑΛΛΗ κατεύθυνση: απάντηση σε ερώτηση που δεν τίθεται πια είναι νεκρή ρύθμιση που
  // εξακολουθεί να προσθέτει namespaces — δηλαδή αναμονή που κανείς δεν ζήτησε.
  const deadOpaque = Object.keys(config[OPAQUE_LEDGER]).filter(file => !opaqueFiles.includes(file)).sort();
  return { entries, rows, provenance, inputs, unresolved, opaque, deadOpaque };
}

function renderLazyArtifact(rows) {
  const ordered = Object.fromEntries(Object.keys(rows).sort().map(key => [key, [...rows[key]].sort()]));
  return stableStringify(ordered);
}

/** Τα namespaces που έχουν **ήδη ζητηθεί** πριν ανοίξει οποιαδήποτε διαδρομή: ολόκληρα στο κέλυφος ∪ εκκίνηση. */
function bootNamespaces(projectRoot, wholeNamespaces) {
  return new Set([...wholeNamespaces, ...readStringArrayConst(projectRoot, LAZY_CONFIG, 'CRITICAL_NAMESPACES')]);
}

/**
 * «Έχει κάθε διαδρομή `ssr: false` γραμμή — και κάθε γραμμή διαδρομή;» **Χωρίς γράφο**:
 * μητρώα και artifact διαβάζονται όπως είναι, άρα τρέχει σε κάθε commit (Layer 1).
 */
function auditCoverage(keys, rows, supported) {
  const failures = [];
  const wanted = new Set(keys);
  for (const key of [...wanted].sort()) {
    if (!Object.prototype.hasOwnProperty.call(rows, key)) failures.push({ verdict: COVERAGE.MISSING_ROW, key });
  }
  for (const key of Object.keys(rows).sort()) {
    if (!wanted.has(key)) { failures.push({ verdict: COVERAGE.ORPHAN_ROW, key }); continue; }
    const unknown = (Array.isArray(rows[key]) ? rows[key] : ['<όχι πίνακας>']).filter(ns => !supported.has(ns));
    if (unknown.length > 0) failures.push({ verdict: COVERAGE.UNSUPPORTED, key, namespaces: unknown });
  }
  return failures;
}

function describeCoverageFailures(failures) {
  return failures.map(failure => {
    switch (failure.verdict) {
      case COVERAGE.MISSING_ROW:
        return `${failure.key}: τεμπέλικη διαδρομή ΧΩΡΙΣ γραμμή στο ${ARTIFACT_NAME} — το chunk της δεν περιμένει κανένα namespace`;
      case COVERAGE.ORPHAN_ROW:
        return `${failure.key}: γραμμή στο ${ARTIFACT_NAME} χωρίς διαδρομή στα μητρώα`;
      default:
        return `${failure.key}: ονομάζει namespace εκτός SUPPORTED_NAMESPACES (${failure.namespaces.join(', ')})`;
    }
  }).join(' · ');
}

/**
 * Η **κρίση του γεννήτορα** (και του Layer 2) πάνω στον φρεσκοχτισμένο χάρτη. Επιστρέφει
 * ετυμηγορίες· δεν τυπώνει και δεν βγαίνει — ίδια γραμμή διαχωρισμού με το `renderComplete`.
 *
 * @param {string[]} wholeNamespaces όσα ταξιδεύουν ολόκληρα στο κέλυφος που ΜΟΛΙΣ χτίστηκε
 */
function judgeLazyRoutes(projectRoot, config, lazy, wholeNamespaces) {
  const pairs = mountOnlyPairs(lazy.rows, bootNamespaces(projectRoot, wholeNamespaces));
  const audit = auditMountCensus(config[LEDGER], pairs, config[SEAL]);
  const verdicts = [];
  if (lazy.unresolved.length > 0) {
    verdicts.push(`τεμπέλικες διαδρομές με import() που δεν λύθηκε σε αρχείο του έργου: ${lazy.unresolved.map(e => `${e.key} (${e.spec})`).join(' · ')}`);
  }
  if (lazy.opaque.length > 0) {
    verdicts.push(
      `${lazy.opaque.length} κλήση/εις useTranslation(<μη στατική τιμή>) χωρίς γραπτή απάντηση στο ${OPAQUE_LEDGER}: `
      + lazy.opaque.map(site => `${site.file}:${site.line} «${site.text}»`).join(' · '),
    );
  }
  if (lazy.deadOpaque.length > 0) {
    verdicts.push(`νεκρές εγγραφές στο ${OPAQUE_LEDGER} (καμία αδιαφανής κλήση πια): ${lazy.deadOpaque.join(' · ')}`);
  }
  if (audit.failures.length > 0) {
    verdicts.push(`η απογραφή των αναμονών εκτός εκκίνησης δεν κλείνει — ${describeMountFailures(audit.failures, lazy.provenance)}`);
  }
  if (audit.grew) verdicts.push(describeMountGrowth(audit));
  return { pairs, audit, verdicts, slack: announceMountSlack(audit) };
}

/**
 * Η **κρίση του Layer 1** πάνω στο δεσμευμένο artifact — **χωρίς γράφο**, άρα σε κάθε commit.
 *
 * ⚠️ ΤΙ ΔΕΝ ΒΛΕΠΕΙ, ΡΗΤΑ: αλλαγή σε αρχείο **μέσα** στην κλειστότητα μιας διαδρομής (νέο
 * `useTranslation`, νέα ακμή εισαγωγής). Η ένωση των κλειστοτήτων είναι **8.055** αρχεία·
 * αποτυπώματα γι' αυτά θα διπλασίαζαν το manifest (+883 KB, **+109%** — μετρημένο
 * 2026-10-05) και θα απαιτούσαν αναπαραγωγή σε σχεδόν κάθε commit. Το §21.5 απέρριψε
 * +164% για τον ίδιο λόγο. Το πιάνει το **Layer 2** (CI)· ως τότε ο χάρτης είναι το πολύ
 * **ελλιπής**, δηλαδή η κατάσταση πριν υπάρξει — ποτέ λάθος κείμενο.
 *
 * @returns {string[]} ένας λόγος ανά εύρημα· κενό ⇒ καθαρό
 */
function judgeLazyArtifact(root, config, wholeNamespaces) {
  if (config.lazyRouteRegistries.length === 0) return [];
  const file = path.join(root, artifactPath(config));
  if (!fs.existsSync(file)) return [`${artifactPath(config)} is missing — οι τεμπέλικες διαδρομές δεν περιμένουν κανένα namespace.`];
  let rows;
  try {
    rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [`${artifactPath(config)} is not valid JSON.`];
  }
  const supported = new Set(readStringArrayConst(root, LAZY_CONFIG, 'SUPPORTED_NAMESPACES'));
  const reasons = [];
  const coverage = auditCoverage(awaitedKeys(readRegistries(root, config)), rows, supported);
  if (coverage.length > 0) reasons.push(`ο χάρτης τεμπέλικων διαδρομών δεν καλύπτει τα μητρώα — ${describeCoverageFailures(coverage)}`);
  const audit = auditMountCensus(config[LEDGER], mountOnlyPairs(rows, bootNamespaces(root, wholeNamespaces)), config[SEAL]);
  if (audit.failures.length > 0) reasons.push(`η απογραφή των αναμονών εκτός εκκίνησης δεν κλείνει — ${describeMountFailures(audit.failures)}`);
  if (audit.grew) reasons.push(describeMountGrowth(audit));
  return reasons;
}

module.exports = {
  ARTIFACT_NAME,
  REGISTRY_CALL,
  LAZY_CONFIG,
  COVERAGE,
  artifactPath,
  readStringArrayConst,
  readRegistry,
  readRegistries,
  awaitedKeys,
  buildLazyRouteNamespaces,
  renderLazyArtifact,
  bootNamespaces,
  auditCoverage,
  describeCoverageFailures,
  judgeLazyRoutes,
  judgeLazyArtifact,
};
