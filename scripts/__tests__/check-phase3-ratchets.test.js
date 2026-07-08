/**
 * ADR-598 ΦΑΣΗ 3 — Graph / coverage / a11y / hygiene ratchets: Jest suite.
 *
 * Presubmit-grade tests for the pure functions of the five ΦΑΣΗ 3 gates:
 *   G3  coverage  — extractCoverage
 *   G9  cycles    ┐ dependency-cruiser engine: summarize / parseArgs / getGate
 *   G10 boundaries┘
 *   G11 a11y      — collectCoveredBasenames / computeUncovered (tempdir fixtures)
 *   G15 knip-deps — summarize (both knip json shapes)
 *
 * We never spawn the real tools (jest --coverage / depcruise / knip) — those are
 * heavy and belong to CI (N.17). Each gate's measurement is driven by synthetic
 * reports / tempdir fixtures. Mirrors check-type-ratchets.test.js.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const coverage = require('../check-coverage-ratchet');
const depcruise = require('../check-depcruise-ratchet');
const a11y = require('../check-a11y-test-coverage-ratchet');
const knipDeps = require('../check-knip-deps-ratchet');

let TMP_ROOT;
beforeAll(() => { TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'phase3-ratchets-')); });
afterAll(() => { if (TMP_ROOT && fs.existsSync(TMP_ROOT)) fs.rmSync(TMP_ROOT, { recursive: true, force: true }); });

// ---------------------------------------------------------------------------
// G3 — coverage
// ---------------------------------------------------------------------------
describe('G3 coverage: extractCoverage', () => {
  const summary = {
    total: {
      lines: { pct: 42.5 }, statements: { pct: 41.9 },
      functions: { pct: 38.0 }, branches: { pct: 30.1 },
    },
  };
  test('pulls the four global percentages', () => {
    expect(coverage.extractCoverage(summary)).toEqual({ lines: 42.5, statements: 41.9, functions: 38.0, branches: 30.1 });
  });
  test('throws when total is missing (fail-closed)', () => {
    expect(() => coverage.extractCoverage({})).toThrow(/no "total"/);
  });
  test('throws when a metric pct is non-numeric', () => {
    expect(() => coverage.extractCoverage({ total: { lines: {}, statements: { pct: 1 }, functions: { pct: 1 }, branches: { pct: 1 } } }))
      .toThrow(/lines\.pct/);
  });
  test('descriptor is an UP ratchet on lines, zero tolerance', () => {
    expect(coverage.DESCRIPTOR.direction).toBe('up');
    expect(coverage.DESCRIPTOR.metricKey).toBe('lines');
    expect(coverage.DESCRIPTOR.resolveTolerancePct()).toBe(0);
  });
  test('buildPayload keeps all four metrics', () => {
    const p = coverage.buildPayload({ lines: 42.5, statements: 41.9, functions: 38, branches: 30.1 });
    expect(p).toMatchObject({ lines: 42.5, statements: 41.9, functions: 38, branches: 30.1, adr: 'ADR-598 G3' });
  });
});

// ---------------------------------------------------------------------------
// G9 / G10 — dependency-cruiser
// ---------------------------------------------------------------------------
describe('G9/G10 depcruise: engine', () => {
  test('exposes cycles + boundaries gates', () => {
    expect(Object.keys(depcruise.GATES).sort()).toEqual(['boundaries', 'cycles']);
    expect(depcruise.getGate('cycles').ruleNames).toEqual(['no-circular']);
    expect(depcruise.getGate('boundaries').ruleNames).toContain('not-to-dxf-internals');
  });
  test('getGate throws on unknown gate', () => {
    expect(() => depcruise.getGate('bogus')).toThrow(/Unknown --gate/);
  });
  test('parseArgs reads --gate + --write-baseline', () => {
    expect(depcruise.parseArgs(['n', 's', '--gate', 'cycles', '--write-baseline']))
      .toMatchObject({ gate: 'cycles', writeBaseline: true });
  });
  test('summarize counts only the gate rules', () => {
    const report = {
      summary: {
        violations: [
          { rule: { name: 'no-circular' } },
          { rule: { name: 'no-circular' } },
          { rule: { name: 'services-not-to-components' } },
          { rule: { name: 'some-other-rule' } },
        ],
      },
    };
    expect(depcruise.summarize(depcruise.GATES.cycles, report)).toEqual({ total: 2, perRule: { 'no-circular': 2 } });
    const b = depcruise.summarize(depcruise.GATES.boundaries, report);
    expect(b.total).toBe(1);
    expect(b.perRule).toEqual({ 'services-not-to-components': 1 });
  });
  test('summarize handles an empty report', () => {
    expect(depcruise.summarize(depcruise.GATES.cycles, { summary: {} })).toEqual({ total: 0, perRule: {} });
  });
});

// ---------------------------------------------------------------------------
// G11 — a11y test coverage
// ---------------------------------------------------------------------------
describe('G11 a11y: coverage detection', () => {
  test('collectCoveredBasenames picks imports only from axe-marked test files', () => {
    const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'a11y-'));
    const axeTest = path.join(dir, 'Button.test.tsx');
    fs.writeFileSync(axeTest, `import { expectNoA11yViolations } from '@/test-utils/a11y';\nimport { Button } from './Button';\n`);
    const plainTest = path.join(dir, 'Card.test.tsx');
    fs.writeFileSync(plainTest, `import { render } from '@testing-library/react';\nimport { Card } from './Card';\n`);
    const covered = a11y.collectCoveredBasenames([axeTest, plainTest]);
    expect(covered.has('Button')).toBe(true);   // axe-marked → counted
    expect(covered.has('Card')).toBe(false);     // no axe marker → not covered
  });

  test('computeUncovered flags a component with no axe test, not one with', () => {
    const root = fs.mkdtempSync(path.join(TMP_ROOT, 'comp-'));
    // Component roots are resolved relative to PROJECT_ROOT, so point the env at
    // a path relative to it.
    const rel = path.relative(require('../lib/ratchet-baseline').PROJECT_ROOT, root).split(path.sep).join('/');
    fs.writeFileSync(path.join(root, 'Button.tsx'), 'export const Button = () => null;');
    fs.writeFileSync(path.join(root, 'Orphan.tsx'), 'export const Orphan = () => null;');
    fs.writeFileSync(path.join(root, 'index.tsx'), 'export * from "./Button";'); // excluded (barrel)
    fs.writeFileSync(path.join(root, 'Button.test.tsx'),
      `import { expectNoA11yViolations } from '@/test-utils/a11y';\nimport { Button } from './Button';\n`);

    const prev = process.env.A11Y_COMPONENT_ROOTS;
    process.env.A11Y_COMPONENT_ROOTS = rel;
    try {
      const uncovered = a11y.computeUncovered([rel]);
      const bases = uncovered.map((f) => path.basename(f));
      expect(bases).toContain('Orphan.tsx');       // no axe test → uncovered
      expect(bases).not.toContain('Button.tsx');   // has axe test → covered
      expect(bases).not.toContain('index.tsx');    // barrel → excluded
    } finally {
      if (prev === undefined) delete process.env.A11Y_COMPONENT_ROOTS;
      else process.env.A11Y_COMPONENT_ROOTS = prev;
    }
  });

  test('parseArgs + buildPayload shape', () => {
    expect(a11y.parseArgs(['n', 's', '--write-baseline']).writeBaseline).toBe(true);
    const p = a11y.buildPayload(['src/components/ui/X.tsx']);
    expect(p).toMatchObject({ count: 1, uncovered: ['src/components/ui/X.tsx'], adr: 'ADR-598 G11' });
  });
});

// ---------------------------------------------------------------------------
// G15 — knip dependency hygiene
// ---------------------------------------------------------------------------
describe('G15 knip-deps: summarize', () => {
  test('grouped-object shape', () => {
    const report = { issues: { dependencies: ['a', 'b'], unlisted: ['c'], exports: ['ignored'] } };
    const s = knipDeps.summarize(report);
    expect(s.total).toBe(3);
    expect(s.perCat).toEqual({ dependencies: 2, unlisted: 1 });
  });
  test('per-file array shape', () => {
    const report = { issues: [
      { file: 'a', dependencies: ['x'], unresolved: ['y'] },
      { file: 'b', binaries: ['z'] },
    ] };
    const s = knipDeps.summarize(report);
    expect(s.total).toBe(3);
    expect(s.perCat).toEqual({ dependencies: 1, unresolved: 1, binaries: 1 });
  });
  test('object-valued categories are counted by key', () => {
    const report = { issues: { dependencies: { pkgA: {}, pkgB: {} } } };
    expect(knipDeps.summarize(report).total).toBe(2);
  });
  test('empty report → zero', () => {
    expect(knipDeps.summarize({ issues: [] })).toEqual({ total: 0, perCat: {} });
  });
  test('descriptor is a DOWN ratchet on total', () => {
    expect(knipDeps.DESCRIPTOR.direction).toBe('down');
    expect(knipDeps.DESCRIPTOR.metricKey).toBe('total');
  });
});
