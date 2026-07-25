#!/usr/bin/env node
/**
 * ADR-700 §1 — Import graph + barrel-aware liveness for the dead-export gate.
 *
 * Answers the one question no configured tool answers (§10.7.1):
 *   «ποιος εισάγει αυτό το σύμβολο ΕΚΤΟΣ από barrel;»
 * A barrel does not consume — it forwards. A consumer writing
 * `import { useFoo } from '../hooks'` is credited to the DECLARING file
 * `hooks/useFoo.ts`; a barrel that merely re-exports `useFoo` is credited with
 * nothing at all.
 *
 * "Has an importer" is NOT the test — REACHABILITY is. Measured on the real
 * tree: `useEntityDrag` had exactly one importer, `useMovementOperations`,
 * which was itself dead. A dead island keeps its own members alive under a
 * one-hop rule, so liveness is a fixpoint from the roots the framework really
 * calls, and nothing else.
 *
 * Every ambiguity resolves toward LIVE (namespace import, dynamic import,
 * unresolved specifier, unparsed file, entry point). The gate must never invent
 * a deletion — the 2026-04-24 incident (13 ADR-321 scaffolding files deleted by
 * a batch that trusted its tool) is why this file is paranoid.
 */

'use strict';

const { resolveSpecifier } = require('./resolve-specifier');

const KEY_SEP = ' ';
const usageKey = (file, name) => `${file}${KEY_SEP}${name}`;

// A name occurring in more modules than this is treated as "everywhere" — the
// safe direction, since wide occurrence argues for life, not death.
const OWNER_SAMPLE = 8;

/**
 * Folds one module's identifiers into a bounded global index:
 * name → the (few) modules that mention it in real code. Bounded so the textual
 * safety net costs ~megabytes instead of identifiers×modules, and so it can be
 * re-asked AFTER liveness is known — an occurrence inside another dead module
 * is not evidence of life.
 */
function foldIdentifiers(owners, file, identifiers) {
  for (const id of identifiers.keys()) {
    let rec = owners.get(id);
    if (!rec) { owners.set(id, { files: [file], overflow: false }); continue; }
    if (rec.overflow || rec.files.includes(file)) continue;
    if (rec.files.length >= OWNER_SAMPLE) { rec.overflow = true; rec.files = []; continue; }
    rec.files.push(file);
  }
}

/** Is `name` mentioned in real code by some OTHER module that is itself live? */
function occursInLiveModule(owners, name, declaringFile, liveModules) {
  const rec = owners.get(name);
  if (!rec) return false;
  if (rec.overflow) return true;
  return rec.files.some(f => f !== declaringFile && liveModules.has(f));
}

function buildGraph({ projectRoot, aliases, files, readFile, onParseError }) {
  const { parseModule } = require('./parse-module');
  const fileSet = new Set(files);
  const modules = new Map();
  const identifierOwners = new Map();
  const unparsed = new Set();

  for (const file of files) {
    let mod;
    try {
      mod = parseModule(file, readFile(file));
    } catch (e) {
      unparsed.add(file);
      if (onParseError) onParseError(file, e);
      continue;
    }
    foldIdentifiers(identifierOwners, file, mod.identifiers);
    mod.identifiers = null;
    modules.set(file, mod);
  }

  return { projectRoot, aliases, fileSet, modules, identifierOwners, unparsed };
}

function createResolver(graph) {
  const cache = new Map();
  return (spec, fromFile) => {
    const key = `${fromFile}${KEY_SEP}${spec}`;
    let hit = cache.get(key);
    if (hit === undefined) {
      hit = resolveSpecifier(spec, fromFile, {
        projectRoot: graph.projectRoot,
        aliases: graph.aliases,
        fileSet: graph.fileSet,
      });
      cache.set(key, hit);
    }
    return hit;
  };
}

/**
 * Walks a re-export chain to the file that actually DECLARES the symbol.
 * `{ opaque: true }` means the chain left the analysed tree (unresolved,
 * unparsed, namespace hop) — opaque is "assume live", never "assume dead".
 */
function resolveOrigin(graph, resolve, file, name, seen = new Set()) {
  const guard = usageKey(file, name);
  if (seen.has(guard)) return { opaque: true };
  seen.add(guard);

  const mod = graph.modules.get(file);
  if (!mod) return { opaque: true };
  if (mod.exports.some(e => e.name === name && e.origin === 'local')) return { file, name };

  for (const re of mod.reExports) {
    if (re.kind === 'star-as' && re.as === name) return { opaqueModule: re.spec, from: file };
    if (re.kind !== 'named') continue;
    const match = re.names.find(n => n.exported === name);
    if (!match) continue;
    const target = resolve(re.spec, file);
    if (target.kind !== 'internal') return { opaque: true };
    return resolveOrigin(graph, resolve, target.file, match.imported, seen);
  }

  for (const re of mod.reExports) {
    if (re.kind !== 'star') continue;
    const target = resolve(re.spec, file);
    if (target.kind !== 'internal') return { opaque: true };
    const found = resolveOrigin(graph, resolve, target.file, name, seen);
    if (!found.opaque || found.opaqueModule) return found;
  }

  return { opaque: true };
}

/** Every local export of a module, by name. */
function localExportNames(mod) {
  return mod.exports.filter(e => e.origin === 'local').map(e => e.name);
}

/**
 * An entry point / namespace import / dynamic import exposes a module's whole
 * surface, and everything that surface forwards.
 */
function markOpaque(state, file) {
  if (state.opaque.has(file)) return;
  state.opaque.add(file);
  state.addModule(file);
  const mod = state.graph.modules.get(file);
  if (!mod) return;
  for (const name of localExportNames(mod)) state.liveSymbols.add(usageKey(file, name));
  for (const re of mod.reExports) {
    const target = state.resolve(re.spec, file);
    if (target.kind === 'internal') markOpaque(state, target.file);
  }
}

function recordConsumer(map, key, consumer, cap = 5) {
  const list = map.get(key) || [];
  if (list.length < cap && !list.includes(consumer)) list.push(consumer);
  map.set(key, list);
}

function applyNamedImport(state, mod, imp) {
  for (const n of imp.names) {
    const origin = resolveOrigin(state.graph, state.resolve, imp.targetFile, n.imported);
    if (origin.opaqueModule) {
      const nsTarget = state.resolve(origin.opaqueModule, origin.from);
      if (nsTarget.kind === 'internal') markOpaque(state, nsTarget.file);
      continue;
    }
    if (origin.opaque) continue;
    const key = usageKey(origin.file, origin.name);
    state.liveSymbols.add(key);
    recordConsumer(state.consumers, key, mod.file);
    state.addModule(origin.file);
  }
}

function applyImport(state, mod, imp) {
  const target = state.resolve(imp.spec, mod.file);
  if (target.kind === 'external') return;
  if (target.kind === 'unresolved') {
    state.unresolvedSpecs.add(`${mod.file} → ${imp.spec}`);
    return;
  }
  imp.targetFile = target.file;
  if (imp.kind === 'side-effect') { state.sideEffect.add(target.file); state.addModule(target.file); return; }
  if (imp.kind === 'dynamic' || imp.kind === 'namespace') { markOpaque(state, target.file); return; }
  applyNamedImport(state, mod, imp);
}

/**
 * Fixpoint from the roots outward. `isEntry(file)` covers what the framework
 * calls without an import (Next pages/routes, middleware, workers); `withTests`
 * additionally seeds every test file, so the difference between the two runs is
 * exactly "used only by its own test".
 */
function computeLiveness(graph, { isEntry, withTests = false }) {
  const resolve = createResolver(graph);
  const queue = [];
  const state = {
    graph, resolve,
    liveModules: new Set(),
    liveSymbols: new Set(),
    consumers: new Map(),
    opaque: new Set(),
    sideEffect: new Set(),
    unresolvedSpecs: new Set(),
    addModule(file) {
      if (state.liveModules.has(file)) return;
      state.liveModules.add(file);
      queue.push(file);
    },
  };

  for (const [file, mod] of graph.modules) {
    if (isEntry(file)) markOpaque(state, file);
    else if (withTests && mod.isTest) state.addModule(file);
  }
  while (queue.length > 0) {
    const mod = graph.modules.get(queue.pop());
    if (!mod) continue;
    for (const imp of mod.imports) applyImport(state, mod, imp);
  }
  return state;
}

/**
 * Every import edge in the tree, reachable or not. Not liveness — diagnostics:
 * it lets `--explain` say "imported by X, but X is itself unreachable" instead
 * of a bare "0 importers", which is what a human needs to judge a candidate.
 */
function collectAllImporters(graph) {
  const resolve = createResolver(graph);
  const importers = new Map();
  const state = { graph, resolve, liveSymbols: new Set(), consumers: importers,
    opaque: new Set(), sideEffect: new Set(), unresolvedSpecs: new Set(), addModule() {} };
  for (const mod of graph.modules.values()) {
    for (const imp of mod.imports) applyImport(state, mod, imp);
  }
  return importers;
}

module.exports = {
  KEY_SEP,
  OWNER_SAMPLE,
  usageKey,
  foldIdentifiers,
  occursInLiveModule,
  buildGraph,
  createResolver,
  resolveOrigin,
  localExportNames,
  markOpaque,
  computeLiveness,
  collectAllImporters,
};
