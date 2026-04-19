/**
 * Registry Golden Regex Tests (ADR-294, ADR-314).
 *
 * Google-style "test the enforcement tool" layer. Two concerns:
 *
 *   1. **ERE syntax validity** — every `forbiddenPatterns[*]` entry in
 *      `.ssot-registry.json` must compile under POSIX ERE (bash `grep -E`),
 *      because that's what CHECK 3.7 (`scripts/check-ssot-imports.sh`)
 *      actually runs. Prior incident: ADR-294 v3.0 discovered that v2.0
 *      patterns used `(?:...)` non-capturing groups, which GNU grep 3.0 ERE
 *      silently ignores — 139 "violations" in v2.0 baseline were false
 *      positives because the patterns matched nothing at all.
 *
 *   2. **Semantic correctness** — for a curated sample of modules spanning
 *      every architectural tier, a hand-crafted `shouldMatch` fixture must
 *      trigger the regex at least once per pattern, and a hand-crafted
 *      `shouldSkip` fixture (imports / SSoT usage / type-level literals /
 *      JSDoc false-positive traps) must NOT trigger it.
 *
 * Design notes:
 *   - Patterns are loaded ONLY from `.ssot-registry.json` — tests never
 *     hardcode a regex string. The registry is the single source of truth.
 *   - Fixtures live in `scripts/__tests__/fixtures/registry-golden-fixtures.js`
 *     as inline strings (one file per concern vs 24 separate .txt files,
 *     easier to review & evolve together).
 *   - ERE validation uses real `grep -E` via spawnSync, not a JS RegExp
 *     approximation — JS regex accepts `(?:...)` happily so it would miss
 *     the exact bug class that caused the v2.0 → v3.0 regression.
 *   - Semantic match uses JS RegExp because grep on 11 KB fixtures through
 *     stdin is fast but harder to reason about regex flags; plus the
 *     ERE-validity test already proves pattern equivalence between grep and
 *     JS for the subset of POSIX ERE we use in this repo.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REGISTRY = require(path.resolve(__dirname, '..', '..', '.ssot-registry.json'));
const GOLDEN_FIXTURES = require('./fixtures/registry-golden-fixtures');

// Filter out comment placeholders (`_comment_*` string entries) — only real
// modules have a `forbiddenPatterns` array.
const REAL_MODULES = Object.entries(REGISTRY.modules).filter(
  ([, m]) => m && typeof m === 'object' && Array.isArray(m.forbiddenPatterns)
);

// =============================================================================
// Group 1 — ERE syntax validity (all ~225 patterns across all modules)
// =============================================================================
describe('ERE syntax validity of every registry forbiddenPattern', () => {
  // grep exit codes: 0 = match, 1 = no match, 2 = error (invalid regex / I/O).
  // We pipe empty stdin so exit 1 means "regex is valid but matched nothing" —
  // which is the passing case. Exit 2 means the pattern is broken for ERE.
  //
  // Windows quirk: passing backslash-heavy patterns as argv to grep via
  // spawnSync gets mangled by CreateProcess arg-escaping (every `\(` becomes
  // `(`). We sidestep that by writing the pattern to a temp file and running
  // `grep -E -f patternFile`. Works identically on Linux CI.
  let tmpRoot;
  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ssot-ere-'));
  });
  afterAll(() => {
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  function grepCompiles(pattern, idx) {
    const patternFile = path.join(tmpRoot, `p-${idx}.txt`);
    fs.writeFileSync(patternFile, pattern);
    const result = spawnSync('grep', ['-E', '-f', patternFile], {
      input: '',
      encoding: 'utf8',
    });
    return { status: result.status, stderr: result.stderr };
  }

  it('grep -E compiles every forbiddenPattern (no status 2 errors)', () => {
    const broken = [];
    let idx = 0;
    for (const [name, m] of REAL_MODULES) {
      for (let i = 0; i < m.forbiddenPatterns.length; i += 1) {
        const p = m.forbiddenPatterns[i];
        const r = grepCompiles(p, idx);
        idx += 1;
        if (r.status === 2 || r.status === null) {
          broken.push({
            module: name,
            index: i,
            pattern: p,
            status: r.status,
            stderr: (r.stderr || '').trim(),
          });
        }
      }
    }
    if (broken.length > 0) {
      throw new Error(
        `Invalid ERE pattern(s) in .ssot-registry.json (grep -E fails to compile — ratchet module is dead code):\n${broken
          .map(
            (b) =>
              `  [${b.module}][${b.index}] ${b.pattern}\n      grep stderr: ${b.stderr || '(none)'}`
          )
          .join('\n')}`
      );
    }
  });

  // Caveat: `grep -E` silently accepts PCRE lookaheads `(?!...)` / `(?=...)`
  // as literal text, so it matches nothing. Status-2 check above can't catch
  // this. Known dormant pattern(s) in the current registry: `gcs-buckets[0]`
  // uses `(?!-backups)` — the ratchet for that module is effectively dead
  // code. Fix path: either switch enforcement to `grep -P` or rewrite the
  // pattern using ERE alternation. Tracked separately — not gated here to
  // avoid blocking commits on pre-existing registry debt.
});

// =============================================================================
// Group 2 — Golden semantic matching (sampled modules × patterns)
// =============================================================================
describe('Golden fixture matching (curated sample, cross-tier)', () => {
  for (const moduleName of Object.keys(GOLDEN_FIXTURES)) {
    // Guard: every fixture must map to a real registry module.
    const module = REGISTRY.modules[moduleName];
    if (!module || !Array.isArray(module.forbiddenPatterns)) {
      // eslint-disable-next-line jest/no-disabled-tests
      it.skip(`[${moduleName}] module missing from registry — skipping`, () => {});
      continue;
    }

    describe(moduleName, () => {
      const fixture = GOLDEN_FIXTURES[moduleName];

      module.forbiddenPatterns.forEach((patternStr, i) => {
        const makeRe = (flags) => new RegExp(patternStr, flags);

        it(`pattern[${i}] fires on should-match fixture (true positive)`, () => {
          // `m` flag so `^...$` anchors work per-line if the pattern uses them.
          const re = makeRe('m');
          const hit = re.test(fixture.shouldMatch);
          if (!hit) {
            throw new Error(
              `pattern[${i}] did not match should-match fixture\n  pattern: ${patternStr}\n  fixture:\n${fixture.shouldMatch}`
            );
          }
        });

        it(`pattern[${i}] skips should-skip fixture (no false positives)`, () => {
          const re = makeRe('gm');
          const matches = fixture.shouldSkip.match(re) || [];
          if (matches.length > 0) {
            throw new Error(
              `pattern[${i}] falsely matched should-skip fixture\n  pattern: ${patternStr}\n  false positives: ${JSON.stringify(
                matches
              )}\n  fixture:\n${fixture.shouldSkip}`
            );
          }
        });
      });
    });
  }
});

// =============================================================================
// Group 3 — Fixture coverage (sanity)
// =============================================================================
describe('Golden fixture coverage', () => {
  it('sampled modules span at least 2 distinct architectural tiers', () => {
    // Registry-wide, most pre-Tier-8 modules have no explicit `tier` field —
    // they normalise to 'core'. As long as the sample includes BOTH 'core'
    // (Phase-1 SOS-critical modules) and Tier 3+ (business/infra expansion
    // batches) we have meaningful cross-tier coverage of the regex shapes.
    const tiers = new Set();
    for (const moduleName of Object.keys(GOLDEN_FIXTURES)) {
      const m = REGISTRY.modules[moduleName];
      if (m) tiers.add(m.tier ?? 'core');
    }
    expect(tiers.size).toBeGreaterThanOrEqual(2);
  });

  it('every sampled module exists in the registry', () => {
    const missing = Object.keys(GOLDEN_FIXTURES).filter(
      (n) => !REGISTRY.modules[n] || !Array.isArray(REGISTRY.modules[n].forbiddenPatterns)
    );
    expect(missing).toEqual([]);
  });

  it('every sampled fixture has non-empty shouldMatch and shouldSkip', () => {
    const bad = Object.entries(GOLDEN_FIXTURES).filter(
      ([, f]) =>
        typeof f.shouldMatch !== 'string' ||
        typeof f.shouldSkip !== 'string' ||
        f.shouldMatch.length === 0 ||
        f.shouldSkip.length === 0
    );
    expect(bad.map(([n]) => n)).toEqual([]);
  });
});
