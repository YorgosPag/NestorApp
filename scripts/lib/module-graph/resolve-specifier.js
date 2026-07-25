#!/usr/bin/env node
/**
 * ADR-364 §10.9 — Module specifier resolution for the barrel-aware dead-export gate.
 *
 * Pure + injectable: never touches the filesystem itself. The caller passes the
 * set of every file it enumerated, so a lookup is a Set hit instead of an
 * `fs.existsSync` syscall — on Windows that is the difference between ~13k
 * cheap probes and ~80k expensive ones.
 *
 * Alias table is read from `tsconfig.base.json` (the SSoT for `paths`) rather
 * than hardcoded, because `@/systems/*` → `src/subapps/dxf-viewer/systems/*`
 * overlaps `@/*` → `src/*` and only the longest matching prefix is correct.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Order matters: TypeScript prefers a real `.ts` over a sibling `.js`, and a
// directory's `index.*` only after every direct-file candidate has failed.
const CANDIDATE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.d.ts', '.js', '.jsx', '.mjs', '.cjs'];

function toPosix(p) {
  return p.split(path.sep).join('/');
}

/**
 * Reads `compilerOptions.paths` from a tsconfig (JSONC-tolerant via the
 * TypeScript parser) and returns entries sorted longest-prefix-first.
 */
function readTsPathAliases(projectRoot, configFileName = 'tsconfig.base.json') {
  const configPath = path.join(projectRoot, configFileName);
  if (!fs.existsSync(configPath)) return [];

  const read = ts.readConfigFile(configPath, p => fs.readFileSync(p, 'utf8'));
  if (read.error || !read.config) return [];

  const paths = (read.config.compilerOptions && read.config.compilerOptions.paths) || {};
  return Object.entries(paths)
    .map(([pattern, targets]) => ({
      prefix: pattern.replace(/\*$/, ''),
      wildcard: pattern.endsWith('*'),
      targets: (targets || []).map(t => ({
        prefix: t.replace(/\*$/, ''),
        wildcard: t.endsWith('*'),
      })),
    }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
}

function isRelative(spec) {
  return spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..';
}

/**
 * `import './foo.js'` in an ESM-authored TS file actually means `./foo.ts`.
 * Returns the extensionless base to probe, or null when the specifier carries
 * no JS-ish extension.
 */
function stripJsExtension(base) {
  const match = /\.(js|jsx|mjs|cjs)$/.exec(base);
  return match ? base.slice(0, -match[0].length) : null;
}

function probe(base, fileSet) {
  if (fileSet.has(base)) return base;
  for (const ext of CANDIDATE_EXTENSIONS) {
    if (fileSet.has(base + ext)) return base + ext;
  }
  for (const ext of CANDIDATE_EXTENSIONS) {
    if (fileSet.has(`${base}/index${ext}`)) return `${base}/index${ext}`;
  }
  const stripped = stripJsExtension(base);
  return stripped ? probe(stripped, fileSet) : null;
}

function expandAlias(spec, aliases) {
  const bases = [];
  for (const alias of aliases) {
    if (!spec.startsWith(alias.prefix)) continue;
    if (!alias.wildcard && spec !== alias.prefix) continue;
    const rest = spec.slice(alias.prefix.length);
    for (const target of alias.targets) {
      bases.push(target.wildcard ? target.prefix + rest : target.prefix);
    }
    // Longest prefix wins outright — a shorter alias must never shadow it.
    break;
  }
  return bases;
}

/**
 * Resolves one module specifier.
 *
 * @returns {{kind:'internal', file:string}
 *          |{kind:'external'}
 *          |{kind:'unresolved'}}
 *   `external` = a bare package name we deliberately do not follow.
 *   `unresolved` = a relative/aliased specifier we FAILED to resolve — the
 *   caller must treat the target as opaque (fail-safe), never as absent.
 */
function resolveSpecifier(spec, fromFile, { projectRoot, aliases, fileSet }) {
  if (isRelative(spec)) {
    const abs = toPosix(path.resolve(path.dirname(fromFile), spec));
    const hit = probe(abs, fileSet);
    return hit ? { kind: 'internal', file: hit } : { kind: 'unresolved' };
  }

  const aliasBases = expandAlias(spec, aliases);
  if (aliasBases.length > 0) {
    for (const base of aliasBases) {
      const abs = toPosix(path.resolve(projectRoot, base));
      const hit = probe(abs, fileSet);
      if (hit) return { kind: 'internal', file: hit };
    }
    return { kind: 'unresolved' };
  }

  return { kind: 'external' };
}

module.exports = {
  CANDIDATE_EXTENSIONS,
  toPosix,
  readTsPathAliases,
  isRelative,
  probe,
  expandAlias,
  resolveSpecifier,
};
