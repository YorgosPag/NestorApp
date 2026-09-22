'use strict';
/**
 * CHECK 3.93 (ADR-874) — THE PLAN: what `functions/src/generated/` must contain,
 * computed from the app SSoT and the manifest `.functions-projection.json`.
 *
 * The generator WRITES the plan; the gate COMPARES the disk against it. One
 * function answers both, so the two cannot disagree (pattern of CHECK 3.33/3.34).
 *
 *   modules   → copied VERBATIM (source bytes, LF). No transform, so no "allowed
 *               differences" and no normalizer — the old mirror check needed a
 *               250-line hand parser precisely because the copy was not a copy.
 *   constants → the SUBSET of a constant map that is read. The key set is
 *               COMPUTED from the code (every `NAME.KEY` in the projected modules
 *               and in `functions/src`), never listed: a hand list is one more
 *               mirror that drifts (3.92: «boundaries are computed, not enumerated»).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { parse } = require('./ast');
const { extractConstants, renderConstants } = require('./constants');
const { checkClosure, collectKeyReads, readConsumers, checkConsumerBoundary } = require('./reads');

const MANIFEST_FILE = '.functions-projection.json';
const GENERATOR_VERSION = 'functions-projection/1';
const REGENERATE = 'npm run generate:functions-projection';

const readLf = (abs) => fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');

function loadManifest(root) {
  const raw = JSON.parse(fs.readFileSync(path.join(root, MANIFEST_FILE), 'utf8'));
  const fields = ['sourceRoot', 'outputRoot', 'consumerRoot', 'modules', 'constants'];
  for (const f of fields) {
    if (raw[f] === undefined) throw new Error(`${MANIFEST_FILE}: missing "${f}"`);
  }
  return raw;
}

function fingerprint(kind, rel, body) {
  return crypto.createHash('sha256')
    .update([GENERATOR_VERSION, kind, rel, body].join('\0'))
    .digest('hex');
}

function header(kind, sourceRel, body, extra) {
  const lines = [
    `// ⚠️ GENERATED — DO NOT EDIT. ${kind} of ${sourceRel} (ADR-874 · CHECK 3.93).`,
    `// Edit the source, then run: ${REGENERATE}`,
    ...extra,
    `// sha256:${fingerprint(kind, sourceRel, body)}`,
  ];
  return `${lines.join('\n')}\n\n`;
}

function readSources(root, manifest) {
  const sources = new Map();
  for (const rel of [...manifest.modules, ...manifest.constants.map((c) => c.module)]) {
    const abs = path.join(root, manifest.sourceRoot, rel);
    if (!fs.existsSync(abs)) throw new Error(`${MANIFEST_FILE}: source not found: ${manifest.sourceRoot}/${rel}`);
    const text = readLf(abs);
    sources.set(rel, { text, sf: parse(abs, text) });
  }
  return sources;
}

function planModules(manifest, sources, errors) {
  return manifest.modules.map((rel) => {
    const { text, sf } = sources.get(rel);
    errors.push(...checkClosure(manifest, rel, sf));
    const sourceRel = `${manifest.sourceRoot}/${rel}`;
    return { path: `${manifest.outputRoot}/${rel}`, content: header('Verbatim projection', sourceRel, text, []) + text };
  });
}

function resolveRows(entry, reads, sources, errors) {
  const { found, entries, spreads } = extractConstants(sources.get(entry.module).sf, entry.export);
  if (!found) {
    errors.push(`${entry.module}: no \`export const ${entry.export} = { … }\` object literal`);
    return [];
  }
  const rows = [];
  for (const [key, v] of entries) {
    if (!reads.keys.has(key)) continue;
    if (v.unsupported) errors.push(`${entry.module}: ${entry.export}.${key} is a ${v.unsupported}, not a literal`);
    else rows.push({ key, value: v.value, env: v.env });
  }
  for (const [key, where] of reads.keys) {
    if (entries.has(key)) continue;
    const hint = spreads > 0 ? ' (the object has spreads — only direct literal keys can be projected)' : '';
    errors.push(`${entry.export}.${key} is read by ${where} but ${entry.module} does not declare it${hint}`);
  }
  return rows;
}

function planConstants(manifest, sources, consumers, errors) {
  return manifest.constants.map((entry) => {
    const reads = collectKeyReads(manifest, sources, consumers, entry.export);
    errors.push(...reads.errors);
    const rows = resolveRows(entry, reads, sources, errors);
    const body = renderConstants(entry.export, rows);
    const sourceRel = `${manifest.sourceRoot}/${entry.module}`;
    const overridable = rows.filter((r) => r.env).map((r) => r.key);
    const extra = [
      `// Keys: ${rows.length} — computed from every \`${entry.export}.KEY\` read under ${manifest.consumerRoot}.`,
      ...(overridable.length
        ? [`// ${overridable.length} keys have an app-side env override that a Cloud Function cannot see — marked inline.`]
        : []),
    ];
    return { path: `${manifest.outputRoot}/${entry.module}`, content: header('Key projection', sourceRel, body, extra) + body };
  });
}

/** @returns {{ manifest: object|null, outputs: Array<{path:string, content:string}>, errors: string[] }} */
function buildPlan(root) {
  const errors = [];
  let manifest;
  let sources;
  try {
    manifest = loadManifest(root);
    sources = readSources(root, manifest);
  } catch (e) {
    return { manifest: null, outputs: [], errors: [e.message] };
  }
  const consumers = readConsumers(root, manifest);
  errors.push(...checkConsumerBoundary(root, manifest, consumers));
  const outputs = [
    ...planModules(manifest, sources, errors),
    ...planConstants(manifest, sources, consumers, errors),
  ].sort((a, b) => a.path.localeCompare(b.path));
  return { manifest, outputs, errors };
}

module.exports = { buildPlan, readLf, REGENERATE };
