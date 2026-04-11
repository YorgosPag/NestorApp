# Firestore Rules Testing (ADR-298)

Tests for `firestore.rules` using `@firebase/rules-unit-testing` against the
Firebase Firestore emulator. Every suite is a runtime behavior contract that
mirrors the typed matrix in `_registry/coverage-manifest.ts` — the manifest is
the single source of truth and each suite iterates `COVERAGE.matrix` so drift
is impossible by construction.

See `adrs/ADR-298-firestore-rules-test-coverage-ssot.md` for the full
architecture rationale, Phase A foundation, and Phase B/C/D/E roadmap.

## Directory layout

```
tests/firestore-rules/
├── README.md                      ← this file
├── _registry/
│   ├── coverage-manifest.ts       ← SSoT persona × operation matrix
│   └── personas.ts                ← canonical tenant IDs, role constants
├── _harness/
│   ├── emulator.ts                ← initEmulator / teardown / reset
│   ├── auth-contexts.ts           ← persona → RulesTestContext factory
│   ├── seed-helpers.ts            ← idempotent document seeders
│   ├── assertions.ts              ← matrix-driven allow/deny assertions
│   └── rule-shape-validator.ts    ← static AST checks used by CHECK 3.16
└── suites/
    ├── buildings.rules.test.ts
    ├── contacts.rules.test.ts
    ├── entity-audit-trail.rules.test.ts
    ├── files.rules.test.ts
    ├── messages.rules.test.ts
    └── projects.rules.test.ts
```

## Prerequisites

1. **Node 20+** and **pnpm 9.14+** (repo `packageManager` field is enforced)
2. **Java 17+** — required by the Firestore emulator JVM
3. **Firebase CLI**:
   ```bash
   pnpm add -g firebase-tools
   ```
4. Install test dependencies (already in `package.json`):
   ```bash
   pnpm install
   ```

## Running tests

### One-shot run (preferred — boots emulator, runs suite, shuts down)

```bash
pnpm test:firestore-rules:emulator
```

This wraps `firebase emulators:exec --only firestore "jest --config
jest.config.firestore-rules.js"` so the emulator lifecycle is fully automated.
Matches the CI job exactly (`.github/workflows/firestore-rules.yml`).

### Iterative development (emulator already running)

Terminal 1 — start the emulator:
```bash
pnpm firestore-rules:emulator
```

Terminal 2 — run tests in watch mode:
```bash
pnpm test:firestore-rules:watch
```

### Single-run against a running emulator

```bash
pnpm test:firestore-rules
```

### Static coverage audit (no emulator, full repo scan)

```bash
pnpm firestore-rules:coverage:audit
```

Runs `scripts/check-firestore-rules-test-coverage.js --all --verbose` — the
same script that powers the pre-commit CHECK 3.16 gate, but in `--all` mode
instead of staged-only. Surfaces the full `FIRESTORE_RULES_PENDING` backlog.

## Jest configuration

Rules tests use a dedicated `jest.config.firestore-rules.js` (root of repo):

- `testEnvironment: 'node'` — required by `firebase-admin` and
  `@firebase/rules-unit-testing`
- `testMatch: tests/firestore-rules/suites/**/*.rules.test.ts`
- `maxWorkers: 1` — emulator state is shared process-wide
- `testTimeout: 30000` — emulator boot + large seed graphs

The main `jest.config.js` explicitly excludes `tests/firestore-rules` via
`testPathIgnorePatterns` so the two test runs never collide.

## Test patterns

Every suite follows the same shape:

```ts
import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === '<collection-name>',
)!;

describe('<collection-name> rules', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  beforeEach(async () => { await resetData(env); /* seed here */ });

  for (const cell of COVERAGE.matrix) {
    it(`${cell.persona} ${cell.operation} should ${cell.expect}`, async () => {
      await assertCell(env, cell /* + seed target */);
    });
  }
});
```

The matrix iteration pattern is enforced by the `rule-shape-validator` —
suites that hardcode assertions outside the `COVERAGE.matrix` loop will fail
the pre-commit CHECK 3.16 shape guard.

## Adding a new collection

1. **Move the collection** from `FIRESTORE_RULES_PENDING` to
   `FIRESTORE_RULES_COVERAGE` in `_registry/coverage-manifest.ts`, defining the
   full persona × operation matrix.
2. **Create `suites/<collection>.rules.test.ts`** by copying the nearest
   existing suite with the same pattern (`tenant_direct`, `immutable`, etc.)
   and iterate `COVERAGE.matrix`.
3. **Run** `pnpm test:firestore-rules:emulator` locally to confirm green.
4. **Run** `pnpm firestore-rules:coverage:audit` to confirm CHECK 3.16 is
   happy with the manifest drift.
5. **Commit** — the pre-commit hook re-runs CHECK 3.16 on staged files.

## CI integration

`.github/workflows/firestore-rules.yml` runs on every PR / push to `main`
that touches:

- `firestore.rules` / `firestore.indexes.json`
- `tests/firestore-rules/**`
- `jest.config.firestore-rules.js`
- `scripts/check-firestore-rules-test-coverage.js`
- `.github/workflows/firestore-rules.yml`
- `firebase.json`

Two jobs:

1. **`static`** — full repo scan via `firestore-rules:coverage:audit`.
   Pure Node, no emulator, ~15s.
2. **`runtime`** — pnpm install, emulator binaries cached, Java 17,
   `firebase emulators:exec` wrapping the jest suite. ~60–120s warm, ~180s
   cold.

Both jobs are required status checks for merge into `main`.

## Relationship with pre-commit CHECK 3.16

| Layer | Scope | Trigger | Covers |
|-------|-------|---------|--------|
| Pre-commit CHECK 3.16 | Staged files + full static scan | `git commit` | Coverage manifest parity, rule shape static check |
| CI workflow (this) | Full repo scan + runtime jest | PR / push to main | Everything above + live emulator behavior |

CHECK 3.16 is the fast feedback loop (static only). This workflow is the
authoritative gate (static + runtime). A PR cannot merge unless both pass.
