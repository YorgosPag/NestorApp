/**
 * CHECK 3.93 — anchors of the Cloud Functions projection gate (ADR-874).
 * The gate and the generator are EXECUTED on fixture trees and on the real tree —
 * never a check of their source text (CHECK 3.54).
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { judge, STATES } = require('../lib/functions-projection/judge');
const { generate } = require('../generate-functions-projection');

const REPO = path.resolve(__dirname, '..', '..');

const MANIFEST = {
  sourceRoot: 'src',
  outputRoot: 'functions/src/generated',
  consumerRoot: 'functions/src',
  modules: ['lib/core.ts'],
  constants: [{ module: 'config/names.ts', export: 'NAMES' }],
};

const BASE = {
  'src/config/names.ts': [
    "export const NAMES = {",
    "  A: process.env.NEXT_PUBLIC_A || 'alpha',",
    "  B: 'beta',",
    "  C: 'gamma',",
    "} as const;",
    "export const OTHER = { X: 'x' };",
  ].join('\n'),
  'src/lib/core.ts': "import { gunzipSync } from 'zlib';\nimport { NAMES } from '../config/names';\nexport const a = NAMES.A;\nexport const z = gunzipSync;\n",
  'functions/src/trigger.ts': "import { NAMES } from './generated/config/names';\nexport const b = NAMES['B'];\n",
};

function tree(overrides = {}, manifest = MANIFEST) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fn-projection-'));
  const files = { '.functions-projection.json': JSON.stringify(manifest), ...BASE, ...overrides };
  for (const [rel, text] of Object.entries(files)) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

const out = (root, rel) => path.join(root, 'functions/src/generated', rel);
const stateOf = (res, rel) => res.results.find((r) => r.path === `functions/src/generated/${rel}`)?.state;
const invalidDetails = (res) => res.results.filter((r) => r.state === STATES.INVALID).map((r) => r.detail).join('\n');

describe('CHECK 3.93 — freshness (Φ)', () => {
  it('Φ1: a generated tree is fresh', () => {
    const root = tree();
    expect(generate(root).ok).toBe(true);
    expect(judge(root).ok).toBe(true);
  });

  it('Φ2: an SSoT edit without regeneration is STALE', () => {
    const root = tree();
    generate(root);
    fs.appendFileSync(path.join(root, 'src/lib/core.ts'), 'export const later = 1;\n');
    expect(stateOf(judge(root), 'lib/core.ts')).toBe(STATES.STALE);
  });

  it('Φ3: a hand edit of the generated file is STALE — the same failure as Φ2', () => {
    const root = tree();
    generate(root);
    fs.appendFileSync(out(root, 'config/names.ts'), '// tweak\n');
    expect(stateOf(judge(root), 'config/names.ts')).toBe(STATES.STALE);
  });

  it('Φ4: a deleted generated file is MISSING', () => {
    const root = tree();
    generate(root);
    fs.unlinkSync(out(root, 'lib/core.ts'));
    expect(stateOf(judge(root), 'lib/core.ts')).toBe(STATES.MISSING);
  });

  it('Φ5: a file the plan does not own is an ORPHAN, and the generator removes it', () => {
    const root = tree();
    generate(root);
    fs.writeFileSync(out(root, 'lib/old-mirror.ts'), 'export const x = 1;\n');
    expect(stateOf(judge(root), 'lib/old-mirror.ts')).toBe(STATES.ORPHAN);
    expect(generate(root).removed).toEqual(['functions/src/generated/lib/old-mirror.ts']);
    expect(judge(root).ok).toBe(true);
  });

  it('Φ6: CRLF in the working tree is not staleness (core.autocrlf=true)', () => {
    const root = tree();
    generate(root);
    const file = out(root, 'lib/core.ts');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
    expect(judge(root).ok).toBe(true);
  });

  it('Φ7: a module is copied VERBATIM — body identical to the source', () => {
    const root = tree();
    generate(root);
    const body = fs.readFileSync(out(root, 'lib/core.ts'), 'utf8').split('\n\n').slice(1).join('\n\n');
    expect(body).toBe(BASE['src/lib/core.ts']);
  });
});

describe('CHECK 3.93 — computed key set (Κ)', () => {
  it('Κ1: exactly the keys that are read — A (projected module) + B (consumer), never C', () => {
    const root = tree();
    generate(root);
    const text = fs.readFileSync(out(root, 'config/names.ts'), 'utf8');
    expect(text).toContain("A: 'alpha', // app override: process.env.NEXT_PUBLIC_A");
    expect(text).toContain("B: 'beta',");
    expect(text).not.toContain('gamma');
  });

  it('Κ2: a new read in a consumer changes the plan (no hand list to forget)', () => {
    const root = tree();
    generate(root);
    fs.writeFileSync(path.join(root, 'functions/src/new.ts'), "import { NAMES } from './generated/config/names';\nexport const c = NAMES.C;\n");
    expect(stateOf(judge(root), 'config/names.ts')).toBe(STATES.STALE);
  });

  it('Κ3: a key read but not declared in the SSoT is INVALID', () => {
    const root = tree({ 'functions/src/trigger.ts': "import { NAMES } from './x';\nexport const d = NAMES.D;\n" });
    const res = judge(root);
    expect(res.ok).toBe(false);
    expect(invalidDetails(res)).toMatch(/NAMES\.D is read by functions\/src\/trigger\.ts/);
  });

  it('Κ4: whole-object use makes the key set unknowable — INVALID, never guessed', () => {
    const root = tree({ 'functions/src/trigger.ts': "import { NAMES } from './x';\nexport const all = Object.keys(NAMES);\n" });
    expect(invalidDetails(judge(root))).toMatch(/as a whole object/);
  });

  it('Κ5: a non-literal value is INVALID', () => {
    const root = tree({ 'src/config/names.ts': "export const NAMES = { A: compute(), B: 'beta' } as const;" });
    expect(invalidDetails(judge(root))).toMatch(/NAMES\.A is a CallExpression/);
  });
});

describe('CHECK 3.93 — closure of portable modules (Κλ)', () => {
  it('Κλ1: an @/ alias import is INVALID', () => {
    const root = tree({ 'src/lib/core.ts': "import type { X } from '@/types/x';\nexport type Y = X;\n" });
    expect(invalidDetails(judge(root))).toMatch(/imports '@\/types\/x'/);
  });

  it('Κλ2: a relative import of an UNPROJECTED file is INVALID', () => {
    const root = tree({ 'src/lib/core.ts': "import { h } from './helper';\nexport const k = h;\n", 'src/lib/helper.ts': 'export const h = 1;\n' });
    expect(invalidDetails(judge(root))).toMatch(/imports '\.\/helper', which is not in/);
  });

  it('Κλ3: an export of a constants module that is NOT projected is INVALID', () => {
    const root = tree({ 'src/lib/core.ts': "import { OTHER } from '../config/names';\nexport const o = OTHER;\n" });
    expect(invalidDetails(judge(root))).toMatch(/imports 'OTHER' from 'config\/names\.ts'/);
  });

  it('Κλ4: a package import is INVALID; a node builtin is fine (Φ1 uses zlib)', () => {
    const root = tree({ 'src/lib/core.ts': "import { z } from 'zod';\nexport const s = z;\n" });
    expect(invalidDetails(judge(root))).toMatch(/imports 'zod'/);
  });

  it('Κλ6: a functions file importing OUTSIDE functions/src is INVALID (bypass + moves the build rootDir)', () => {
    const root = tree({ 'functions/src/sneaky.ts': "import { a } from '../../src/lib/core';\nexport const s = a;\n" });
    expect(invalidDetails(judge(root))).toMatch(/functions\/src\/sneaky\.ts: imports '\.\.\/\.\.\/src\/lib\/core', outside functions\/src/);
  });

  it('Κλ5: an invalid plan writes NOTHING', () => {
    const root = tree({ 'src/lib/core.ts': "import x from '@/x';\nexport default x;\n" });
    expect(generate(root).ok).toBe(false);
    expect(fs.existsSync(path.join(root, 'functions/src/generated'))).toBe(false);
  });
});

describe('CHECK 3.93 — the real tree (Δ)', () => {
  it('Δ1: functions/src/generated is fresh against the app SSoT', () => {
    const res = judge(REPO);
    expect(res.results.filter((r) => r.state !== STATES.FRESH)).toEqual([]);
  });

  it('Δ2: the hand-kept mirrors are gone and nothing imports them', () => {
    expect(fs.existsSync(path.join(REPO, 'functions/src/search/search-config.mirror.ts'))).toBe(false);
    expect(fs.existsSync(path.join(REPO, 'functions/src/shared/decode-processed-json.ts'))).toBe(false);
  });

  it('Δ3: the INDEX normalizer is the QUERY normalizer (Ε-874.1)', () => {
    const generated = fs.readFileSync(path.join(REPO, 'functions/src/generated/lib/search/search.ts'), 'utf8');
    const source = fs.readFileSync(path.join(REPO, 'src/lib/search/search.ts'), 'utf8').replace(/\r\n/g, '\n');
    expect(generated.replace(/\r\n/g, '\n').endsWith(source)).toBe(true);
  });
});
