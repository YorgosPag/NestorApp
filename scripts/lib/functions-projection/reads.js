'use strict';
/**
 * CHECK 3.93 (ADR-874) — the two closures the projection must be sure of.
 *
 *   checkClosure     «does this portable module reach ONLY what is also projected?»
 *                    An `@/` import, a package, or a relative import of an
 *                    unprojected file would compile in the app and break the
 *                    functions build — or worse, be satisfied by a stale copy.
 *   collectKeyReads  «which keys of the constant map does anyone read?» — the
 *                    projected modules plus every hand-written file under the
 *                    consumer root. The answer IS the key list; nobody types it.
 */

const fs = require('node:fs');
const path = require('node:path');
const { builtinModules } = require('node:module');

const { parse, moduleSpecifiers, importedBindings, memberReads, ts } = require('./ast');

const BUILTINS = new Set(builtinModules);
const isBuiltin = (spec) => BUILTINS.has(spec.replace(/^node:/, ''));
const readLf = (abs) => fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');

/** Projected module path that a relative specifier resolves to, or null. */
function resolveRelative(manifest, fromRel, spec) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  const projected = new Set([...manifest.modules, ...manifest.constants.map((c) => c.module)]);
  const candidates = base.endsWith('.ts') ? [base] : [`${base}.ts`, `${base}/index.ts`];
  return candidates.find((c) => projected.has(c)) || null;
}

/** Named imports taken from a constants module must be exactly its projected exports. */
function checkConstantsImport(manifest, rel, stmt, target) {
  const allowed = new Set(manifest.constants.filter((c) => c.module === target).map((c) => c.export));
  if (allowed.size === 0) return [];
  const bindings = stmt.importClause && stmt.importClause.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) {
    return [`${rel}: imports '${target}' without named bindings — only { ${[...allowed].join(', ')} } is projected`];
  }
  return bindings.elements
    .map((el) => (el.propertyName || el.name).text)
    .filter((name) => !allowed.has(name))
    .map((name) => `${rel}: imports '${name}' from '${target}', but only { ${[...allowed].join(', ')} } is projected`);
}

function checkClosure(manifest, rel, sf) {
  const errors = [];
  for (const spec of moduleSpecifiers(sf)) {
    if (isBuiltin(spec)) continue;
    if (!spec.startsWith('.')) {
      errors.push(`${rel}: imports '${spec}' — a portable module may import only node builtins and other projected modules (no '@/' alias, no packages)`);
      continue;
    }
    if (!resolveRelative(manifest, rel, spec)) {
      errors.push(`${rel}: imports '${spec}', which is not in ${'.functions-projection.json'} — project it too, or cut the dependency`);
    }
  }
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.moduleSpecifier.text.startsWith('.')) continue;
    const target = resolveRelative(manifest, rel, stmt.moduleSpecifier.text);
    if (target) errors.push(...checkConstantsImport(manifest, rel, stmt, target));
  }
  return errors;
}

function listConsumers(root, manifest) {
  const consumerAbs = path.join(root, manifest.consumerRoot);
  const outputAbs = path.join(root, manifest.outputRoot);
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir) || path.resolve(dir) === path.resolve(outputAbs)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory() && ent.name !== 'node_modules') walk(abs);
      else if (ent.isFile() && /\.tsx?$/.test(ent.name) && !ent.name.endsWith('.d.ts')) out.push(abs);
    }
  };
  walk(consumerAbs);
  return out.sort();
}

function recordReads(sf, where, exportName, keys, errors) {
  for (const { local } of importedBindings(sf, exportName)) {
    const reads = memberReads(sf, local);
    for (const key of reads.keys) if (!keys.has(key)) keys.set(key, where);
    for (const line of reads.wholeUses) {
      errors.push(`${where}:${line}: uses \`${local}\` as a whole object — the projected key set cannot be computed; read \`${local}.KEY\` instead`);
    }
  }
}

/**
 * A consumer that reaches OUTSIDE the consumer root is the bypass this gate exists
 * to close — and it breaks the deploy: the functions `tsc` infers `rootDir` from its
 * inputs, so one `../../../src/…` import moves `lib/index.js` to
 * `lib/functions/src/index.js` while `package.json` still says `main: lib/index.js`.
 */
function boundaryErrors(root, manifest, abs, sf, where) {
  const consumerAbs = path.resolve(root, manifest.consumerRoot);
  return moduleSpecifiers(sf)
    .filter((spec) => spec.startsWith('.'))
    .filter((spec) => {
      const target = path.resolve(path.dirname(abs), spec);
      return path.relative(consumerAbs, target).startsWith('..');
    })
    .map((spec) => `${where}: imports '${spec}', outside ${manifest.consumerRoot} — project the module instead (it would also move the build's rootDir)`);
}

/** Parse every consumer once: `{ abs, where, sf }`. */
function readConsumers(root, manifest) {
  return listConsumers(root, manifest).map((abs) => ({
    abs,
    where: path.relative(root, abs).split(path.sep).join('/'),
    sf: parse(abs, readLf(abs)),
  }));
}

function checkConsumerBoundary(root, manifest, consumers) {
  return consumers.flatMap(({ abs, sf, where }) => boundaryErrors(root, manifest, abs, sf, where));
}

/** @returns {{ keys: Map<string, string>, errors: string[] }}  key → first file that reads it */
function collectKeyReads(manifest, sources, consumers, exportName) {
  const keys = new Map();
  const errors = [];
  for (const rel of manifest.modules) {
    recordReads(sources.get(rel).sf, `${manifest.sourceRoot}/${rel}`, exportName, keys, errors);
  }
  for (const { sf, where } of consumers) recordReads(sf, where, exportName, keys, errors);
  return { keys, errors };
}

module.exports = { checkClosure, collectKeyReads, readConsumers, checkConsumerBoundary };
