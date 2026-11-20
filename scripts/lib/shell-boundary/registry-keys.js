#!/usr/bin/env node
'use strict';

/**
 * ADR-777 §8.12 · ADR-783 ομάδα Ζ #2 — CHECK 3.52, Κ2: **η προσβασιμότητα μέσα από μητρώο τεμπέλικων chunks
 * μετριέται ΑΝΑ ΚΛΕΙΔΙ, όχι ανά αρχείο.**
 *
 * 🔴 **Το περιστατικό (μετρημένο 2026-11-20)**: το `src/utils/lazyRoutes.tsx` δηλώνει 27 εγγραφές
 * `Κλειδί: { load: () => import('…') }` και το εισάγουν 82 σελίδες. Η κλειστότητα ανά αρχείο έλεγε «όποιος
 * εισάγει το μητρώο φτάνει σε ΟΛΕΣ τις εγγραφές του» ⇒ μόλις **μία** εγγραφή (`PropertyDetail`) έφτασε σε
 * δημόσιο hook, **83** σελίδες του `(app)` —`admin/backup` που ζητά μόνο `LazyRoutes.AdminBackup`— έγιναν
 * «δημόσια επιφάνεια». Ψευδώς θετικά, όλα.
 *
 * 🔑 **Η πρακτική των bundlers** (webpack · Next.js · Bazel · dependency-cruiser): κάθε `import()` είναι
 * **σημείο διαχωρισμού**· ό,τι φτάνει μια σελίδα είναι οι εγγραφές που **ζητά**, όχι το αρχείο-κατάλογος.
 * Καμία νέα μηχανή: οι εγγραφές διαβάζονται από το **ίδιο** SSoT της πύλης εισδοχής (ADR-280 §11.8,
 * `lazy-registry-read`), με το **ίδιο** κλειστό σύνολο μητρώων (`lazyRouteRegistries`).
 *
 * ⚠️ **Fail-closed παντού**: χρήση του μητρώου που ΔΕΝ είναι `Μητρώο.Κλειδί` / `Μητρώο['Κλειδί']`
 * (το περνάς ως τιμή, `import * as`, re-export, `import()` του ίδιου του μητρώου) ⇒ «φτάνει σε όλα» —
 * η παλιά, αυστηρή απάντηση. Μητρώο που λείπει από το δέντρο ⇒ καμία ακρίβεια (πάλι η αυστηρή).
 *
 * @module scripts/lib/shell-boundary/registry-keys
 */

const path = require('node:path');
const ts = require('typescript');

const MG = require('../module-graph');
const SLICE = require('../i18n-shell-slice/config');
const { readRegistry } = require('../i18n-shell-slice/lazy-registry-read');
const { parseSource } = require('../i18n-shell-slice/key-extract');
const { toPosix } = require('./tree');

/** Το κλειστό σύνολο μητρώων — η ΙΔΙΑ λίστα με τη CHECK 3.34 (JSON του slice αν την ορίζει, αλλιώς DEFAULTS). */
function declaredRegistries(input) {
  const text = input.read(SLICE.CONFIG_FILE);
  const raw = text === null ? {} : JSON.parse(text);
  return raw.lazyRouteRegistries ?? SLICE.DEFAULTS.lazyRouteRegistries;
}

/**
 * Ο κατάλογος: απόλυτο posix μητρώου → (απόλυτο posix στόχου εγγραφής → κλειδιά).
 * Εγγραφή που δεν λύνεται σε εσωτερικό αρχείο απλώς δεν μπαίνει: η ακμή της μένει ακμή-αρχείου (αυστηρή).
 */
function loadRegistryIndex(projectRoot, ctx) {
  const byRegistry = new Map();
  const ownKeys = new Map();
  const readText = abs => ctx.input.read(toPosix(abs));
  for (const registry of declaredRegistries(ctx.input)) {
    if (ctx.input.read(registry) === null) continue; // λείπει ⇒ καμία ακρίβεια, ποτέ σιωπηλή απαλλαγή
    const registryAbs = toPosix(path.resolve(projectRoot, registry));
    const targets = new Map();
    const entries = readRegistry(projectRoot, registry, readText);
    for (const entry of entries) {
      const hit = MG.resolveSpecifier(entry.spec, registryAbs, ctx);
      if (hit.kind !== 'internal') continue;
      const target = toPosix(hit.file);
      targets.set(target, [...(targets.get(target) || []), entry.key]);
    }
    byRegistry.set(registryAbs, targets);
    ownKeys.set(registryAbs, new Set(entries.map(e => e.key)));
  }
  const keyCount = [...ownKeys.values()].reduce((n, keys) => n + keys.size, 0);
  const tokens = [...byRegistry.keys()].map(f => path.basename(f).replace(/\.[jt]sx?$/, ''));
  return { byRegistry, exposed: exposedKeys(ownKeys, ctx), keyCount, tokens };
}

/**
 * Τα κλειδιά που **εκθέτει** κάθε μητρώο: τα δικά του + όσων μητρώων εισάγει στατικά (το `lazyRoutes` κάνει
 * spread το `lazyRoutesAdr294` ⇒ το `LazyRoutes.X` μπορεί να είναι εγγραφή του δεύτερου). Σταθερό σημείο.
 * 🔑 Αδιαφανής χρήση μητρώου μετρά **μόνο** αν έφτασε κλειδί που εκθέτει **αυτό** — μετρημένο 2026-11-20: χωρίς
 * αυτό, το `PublicPriceSlot` του `public-catalog-surfaces` «έφτανε» επειδή έφτασε εγγραφή του `lazyRoutes`.
 */
function exposedKeys(ownKeys, ctx) {
  const imports = new Map();
  for (const registryAbs of ownKeys.keys()) {
    const mod = MG.parseModule(registryAbs, ctx.input.read(registryAbs) ?? '');
    const deps = [...mod.imports.filter(i => i.kind !== 'dynamic'), ...mod.reExports]
      .map(i => MG.resolveSpecifier(i.spec, registryAbs, ctx))
      .filter(hit => hit.kind === 'internal' && ownKeys.has(toPosix(hit.file)))
      .map(hit => toPosix(hit.file));
    imports.set(registryAbs, deps);
  }
  const exposed = new Map([...ownKeys].map(([r, keys]) => [r, new Set(keys)]));
  let grew = true;
  while (grew) {
    grew = false;
    for (const [registryAbs, deps] of imports) {
      const mine = exposed.get(registryAbs);
      for (const dep of deps) {
        for (const key of exposed.get(dep)) if (!mine.has(key)) { mine.add(key); grew = true; }
      }
    }
  }
  return exposed;
}

const EMPTY_INDEX = Object.freeze({ byRegistry: new Map(), exposed: new Map(), keyCount: 0, tokens: [] });

/** Τα ονόματα που δένει το αρχείο από τα μητρώα. `null` = `import * as` ⇒ αδιαφανές. */
function registryBindings(source, specs) {
  const locals = new Set();
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    if (!specs.has(stmt.moduleSpecifier.text) || !stmt.importClause) continue;
    const { name, namedBindings } = stmt.importClause;
    if (name) locals.add(name.text);
    if (namedBindings && ts.isNamespaceImport(namedBindings)) return null;
    if (namedBindings && ts.isNamedImports(namedBindings)) namedBindings.elements.forEach(e => locals.add(e.name.text));
  }
  return locals;
}

/** Το κλειδί που ζητά μία αναφορά στο όνομα του μητρώου· `undefined` = δεν είναι αναφορά· `null` = αδιαφανής. */
function keyOfReference(node) {
  const parent = node.parent;
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent)) return undefined;
  if ((ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent)) && parent.name === node) return undefined;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) return parent.name.text;
  if (ts.isQualifiedName(parent) && parent.left === node) return parent.right.text;
  if (ts.isElementAccessExpression(parent) && parent.expression === node && ts.isStringLiteralLike(parent.argumentExpression)) {
    return parent.argumentExpression.text;
  }
  return null;
}

/** Τα κλειδιά μητρώου που ζητά το αρχείο. `null` = αδιαφανής χρήση ⇒ fail-closed («όλα»). */
function registryKeysUsedBy(absFile, specs, ctx) {
  const source = parseSource(absFile, ctx.input.read(absFile) ?? '');
  const locals = registryBindings(source, specs);
  if (locals === null) return null;
  const used = new Set();
  let opaque = false;
  const visit = node => {
    if (opaque) return;
    if (ts.isIdentifier(node) && locals.has(node.text)) {
      const key = keyOfReference(node);
      if (key === null) opaque = true;
      else if (key !== undefined) used.add(key);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return opaque ? null : used;
}

/**
 * Η κρίση ενός υποψηφίου σε έναν γύρο της αντίστροφης κλειστότητας.
 * @returns {{marks: boolean, keys: string[]}} `marks` = το αρχείο φτάνει (ως αρχείο)· `keys` = εγγραφές που
 *   φτάνουν **μέσα από** αυτό (μόνο όταν το ίδιο είναι μητρώο).
 */
function judgeImporter(absFile, hits, frontier, frontierKeys, index, ctx) {
  const toFrontier = hits.filter(h => h.file && frontier.has(h.file));
  const entries = index.byRegistry.get(absFile);
  if (entries) {
    // Μητρώο: η ακμή `import()` εγγραφής δίνει ΚΛΕΙΔΙ· κάθε άλλη ακμή προς το μέτωπο το σημειώνει ολόκληρο.
    const keys = [];
    let whole = false;
    for (const h of toFrontier) {
      const k = h.dynamic ? entries.get(h.file) : undefined;
      if (k) keys.push(...k);
      else whole = true;
    }
    return { marks: whole, keys };
  }
  if (toFrontier.length > 0) return { marks: true, keys: [] };
  if (frontierKeys.size === 0) return { marks: false, keys: [] };

  // Μόνο μητρώα που ΕΚΘΕΤΟΥΝ κλειδί που μόλις έφτασε — αλλιώς η χρήση τους (όσο αδιαφανής) δεν φτάνει πουθενά νέο.
  const viaRegistry = hits.filter(h => h.file && index.byRegistry.has(h.file)
    && [...frontierKeys].some(k => index.exposed.get(h.file).has(k)));
  if (viaRegistry.length === 0) return { marks: false, keys: [] };
  if (viaRegistry.some(h => h.dynamic || h.reExport)) return { marks: true, keys: [] }; // αδιαφανές
  const used = registryKeysUsedBy(absFile, new Set(viaRegistry.map(h => h.spec)), ctx);
  return { marks: used === null || [...used].some(k => frontierKeys.has(k)), keys: [] };
}

module.exports = { EMPTY_INDEX, declaredRegistries, loadRegistryIndex, registryKeysUsedBy, judgeImporter };
