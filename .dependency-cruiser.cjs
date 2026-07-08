/**
 * ADR-598 G9 + G10 — dependency-cruiser rule set (SSoT for BOTH graph gates).
 *
 * ONE config drives two ratchets, selected in scripts/check-depcruise-ratchet.js
 * by rule name:
 *   • G9  cycles     — `no-circular`
 *   • G10 boundaries — the architectural `not-*` rules below
 *
 * All rules are `warn` (never `error`): the gate is a RATCHET, not a flag-day.
 * The committed baselines (.depcruise-{cycles,boundaries}-baseline.json) seed the
 * current violation counts (the ADR budgeted 112+); the ratchet only lets them
 * fall. Heavy graph analysis → Layer-2 CI only (N.17).
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // --- G9: cycles ---------------------------------------------------------
    {
      name: 'no-circular',
      comment: 'Circular import chain — refactor to a one-directional dependency.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },

    // --- G10: architectural boundaries -------------------------------------
    {
      name: 'services-not-to-components',
      comment: 'Domain services must not import UI components (services are UI-agnostic).',
      severity: 'warn',
      from: { path: '^src/services/' },
      to: { path: '^src/components/' },
    },
    {
      name: 'not-to-dxf-internals',
      comment:
        'The DXF viewer subapp is a black box: import it only through its public ' +
        'barrel (src/subapps/dxf-viewer/index.ts[x]), never a deep internal path.',
      severity: 'warn',
      from: { pathNot: '^src/subapps/dxf-viewer/' },
      to: {
        path: '^src/subapps/dxf-viewer/',
        pathNot: '^src/subapps/dxf-viewer/index\\.(ts|tsx)$',
      },
    },
    {
      name: 'no-test-utils-in-prod',
      comment: 'Production code must not import test utilities / testing scaffolding.',
      severity: 'warn',
      from: {
        pathNot: '(\\.(test|spec)\\.[jt]sx?$|__tests__/|/test-utils/|/testing/|\\.stories\\.)',
      },
      to: { path: '(/test-utils/|/testing/)' },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|\\.next|dist|coverage|\\.d\\.ts$)' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    },
  },
};
