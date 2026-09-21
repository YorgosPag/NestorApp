/**
 * ADR-598 ΦΑΣΗ 3 — Graph / coverage / a11y / hygiene ratchets: Jest suite.
 *
 * Presubmit-grade tests for the pure functions of the five ΦΑΣΗ 3 gates:
 *   G3  coverage  — extractCoverage
 *   G9  cycles    ┐ dependency-cruiser engine: summarize / parseArgs / getGate
 *   G10 boundaries┘
 *   G11 a11y      — collectCoveredFiles (relative · @/ alias · barrel) / computeUncovered
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
          // The SAME cycle reported from two of its members (ADR-858, 694d7fb6):
          // two counts, ONE identity — the ratchet compares identities, not counts.
          { rule: { name: 'no-circular' }, from: 'a.ts', to: 'b.ts', cycle: ['b.ts', 'a.ts'] },
          { rule: { name: 'no-circular' }, from: 'b.ts', to: 'a.ts', cycle: ['a.ts', 'b.ts'] },
          { rule: { name: 'services-not-to-components' }, from: 'svc.ts', to: 'ui.tsx' },
          { rule: { name: 'some-other-rule' }, from: 'x.ts', to: 'y.ts' },
        ],
      },
    };
    expect(depcruise.summarize(depcruise.GATES.cycles, report)).toEqual({
      total: 2,
      perRule: { 'no-circular': 2 },
      identities: ['no-circular|a.ts→b.ts'],
    });
    const b = depcruise.summarize(depcruise.GATES.boundaries, report);
    expect(b.total).toBe(1);
    expect(b.perRule).toEqual({ 'services-not-to-components': 1 });
    expect(b.identities).toEqual(['services-not-to-components|svc.ts→ui.tsx']);
  });
  test('summarize handles an empty report', () => {
    expect(depcruise.summarize(depcruise.GATES.cycles, { summary: {} })).toEqual({ total: 0, perRule: {}, identities: [] });
  });
});

// ---------------------------------------------------------------------------
// G11 — a11y test coverage
// ---------------------------------------------------------------------------
describe('G11 a11y: coverage detection', () => {
  const AXE_IMPORT = `import { expectNoA11yViolations } from '@/test-utils/a11y';\n`;

  /** A throwaway `src/`-shaped tree: `@/` resolves to `<tmp>/src`, like tsconfig. */
  function makeTree(files) {
    const root = fs.mkdtempSync(path.join(TMP_ROOT, 'tree-'));
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
    const at = (rel) => path.resolve(root, rel);
    return { at, aliasRoot: at('src') };
  }

  test('only axe-marked test files provide coverage', () => {
    const { at, aliasRoot } = makeTree({
      'src/ui/Button.tsx': 'export const Button = () => null;',
      'src/ui/Card.tsx': 'export const Card = () => null;',
      'src/ui/Button.test.tsx': `${AXE_IMPORT}import { Button } from './Button';\n`,
      'src/ui/Card.test.tsx': `import { render } from '@testing-library/react';\nimport { Card } from './Card';\n`,
    });
    const covered = a11y.collectCoveredFiles([at('src/ui/Button.test.tsx'), at('src/ui/Card.test.tsx')], aliasRoot);
    expect(covered.has(at('src/ui/Button.tsx'))).toBe(true);   // axe-marked → counted
    expect(covered.has(at('src/ui/Card.tsx'))).toBe(false);    // no axe marker → not covered
  });

  test('an `@/` alias import counts — the blind spot of the basename scan', () => {
    const { at, aliasRoot } = makeTree({
      'src/components/ui/InfoLabel.tsx': 'export const InfoLabel = () => null;',
      'src/features/x/__tests__/x.a11y.test.tsx': `${AXE_IMPORT}import { InfoLabel } from '@/components/ui/InfoLabel';\n`,
    });
    const covered = a11y.collectCoveredFiles([at('src/features/x/__tests__/x.a11y.test.tsx')], aliasRoot);
    expect(covered.has(at('src/components/ui/InfoLabel.tsx'))).toBe(true);
  });

  test('a same-named file elsewhere is NOT covered — the over-count of the basename scan', () => {
    const { at, aliasRoot } = makeTree({
      'src/a/Button.tsx': 'export const Button = () => null;',
      'src/b/Button.tsx': 'export const Button = () => null;',
      'src/a/Button.test.tsx': `${AXE_IMPORT}import { Button } from './Button';\n`,
    });
    const covered = a11y.collectCoveredFiles([at('src/a/Button.test.tsx')], aliasRoot);
    expect(covered.has(at('src/a/Button.tsx'))).toBe(true);
    expect(covered.has(at('src/b/Button.tsx'))).toBe(false);
  });

  test('a barrel import covers exactly the files its NAMED re-exports come from', () => {
    const { at, aliasRoot } = makeTree({
      'src/ui/chart/index.ts':
        `export { ChartCard, type ChartCardProps } from './ChartCard';\n` +
        `export { ChartPlot as Plot } from './ChartPlot';\n` +
        `export { Legend } from './Legend';\n` +
        `export * from './Everything';\n`,
      'src/ui/chart/ChartCard.tsx': 'export const ChartCard = () => null;',
      'src/ui/chart/ChartPlot.tsx': 'export const ChartPlot = () => null;',
      'src/ui/chart/Legend.tsx': 'export const Legend = () => null;',
      'src/ui/chart/Everything.tsx': 'export const Everything = () => null;',
      'src/ui/chart/__tests__/c.test.tsx': `${AXE_IMPORT}import { ChartCard, Plot as P } from '..';\n`,
    });
    const covered = a11y.collectCoveredFiles([at('src/ui/chart/__tests__/c.test.tsx')], aliasRoot);
    expect(covered.has(at('src/ui/chart/ChartCard.tsx'))).toBe(true);
    expect(covered.has(at('src/ui/chart/ChartPlot.tsx'))).toBe(true);   // `ChartPlot as Plot`, imported as `Plot`
    expect(covered.has(at('src/ui/chart/Legend.tsx'))).toBe(false);     // exported, never imported
    expect(covered.has(at('src/ui/chart/Everything.tsx'))).toBe(false); // `export *` names nothing
  });

  test('bare packages and unresolvable specifiers are ignored, never guessed', () => {
    const { at, aliasRoot } = makeTree({
      'src/ui/X.test.tsx': `${AXE_IMPORT}import React from 'react';\nimport { Gone } from './Gone';\n`,
    });
    expect([...a11y.collectCoveredFiles([at('src/ui/X.test.tsx')], aliasRoot)]).toEqual([]);
  });

  test('namedBindings reads the exported name and drops `type` modifiers', () => {
    expect(a11y.namedBindings('React, { useId, type FC, A as B }')).toEqual(['useId', 'FC', 'A']);
    expect(a11y.namedBindings('* as ns')).toEqual([]);
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
    const prevTests = process.env.A11Y_TEST_ROOTS;
    process.env.A11Y_COMPONENT_ROOTS = rel;
    process.env.A11Y_TEST_ROOTS = ''; // the fixture root only — never walk the real src/
    try {
      const uncovered = a11y.computeUncovered([rel]);
      const bases = uncovered.map((f) => path.basename(f));
      expect(bases).toContain('Orphan.tsx');       // no axe test → uncovered
      expect(bases).not.toContain('Button.tsx');   // has axe test → covered
      expect(bases).not.toContain('index.tsx');    // barrel → excluded
    } finally {
      if (prev === undefined) delete process.env.A11Y_COMPONENT_ROOTS;
      else process.env.A11Y_COMPONENT_ROOTS = prev;
      if (prevTests === undefined) delete process.env.A11Y_TEST_ROOTS;
      else process.env.A11Y_TEST_ROOTS = prevTests;
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
