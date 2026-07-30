/**
 * Firestore Rules Test Harness — `deny_all` suite building blocks
 *
 * The `deny_all` pattern (`allow read, write: if false`) has exactly one
 * possible test body: every (persona × operation) cell must fail, and the
 * seeded payload is irrelevant because the rule short-circuits before any
 * document is inspected. Written inline, that body is identical in every
 * suite — which is how a family of sibling clones gets born (ADR-584, the
 * jscpd gate). This module owns the body once; suites only declare *which*
 * collection they cover.
 *
 * CHECK 3.16 (ADR-298 §3.4) still requires each suite file to (a) export a
 * `COVERAGE` const resolving its own collection and (b) contain a literal
 * `for (const cell of COVERAGE.matrix)` loop. That contract is deliberate —
 * it keeps the manifest and the executed cells from drifting — so the loop
 * stays in the suite and only its body moves here.
 *
 * See ADR-298 §3.3 (test file contract), ADR-738 §7 (OAuth collections).
 *
 * @module tests/firestore-rules/_harness/deny-all-suite
 * @since 2026-07-31 (ADR-738)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import type { CoverageCell } from '../_registry/coverage-manifest';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
  isAuthenticatedPersona,
} from '../_registry/personas';
import { getContext } from './auth-contexts';
import { assertCell, type AssertTarget } from './assertions';
import { initEmulator, resetData, teardownEmulator } from './emulator';

/** Accessor returning the live environment — valid only inside `it`/`beforeEach`. */
export type EnvAccessor = () => RulesTestEnvironment;

/**
 * Register the emulator lifecycle hooks for a `deny_all` suite.
 *
 * Returns an accessor rather than the environment itself because `beforeAll`
 * has not run yet at module-evaluation time — reading the value eagerly would
 * capture `undefined`.
 */
export function useDenyAllEmulator(): EnvAccessor {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });
  afterAll(async () => {
    await teardownEmulator(env);
  });
  afterEach(async () => {
    await resetData(env);
  });

  return () => env;
}

/**
 * Declare the `describe`/`it` pair for a single matrix cell of a `deny_all`
 * collection.
 *
 * No seeding happens: reads are blocked too, so a fixture would be
 * unobservable, and the `if false` rule fires regardless of whether the
 * document exists. The payload below exists only so the create/update calls
 * are well-formed Firestore requests.
 */
export function defineDenyAllCell(
  env: EnvAccessor,
  cell: CoverageCell,
  collection: string,
): void {
  describe(`${cell.persona} × ${cell.operation}`, () => {
    it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
      const claims = isAuthenticatedPersona(cell.persona)
        ? PERSONA_CLAIMS[cell.persona]
        : null;

      const target: AssertTarget = {
        collection,
        docId: `${collection}-deny-all`,
        createData: {
          companyId: SAME_TENANT_COMPANY_ID,
          createdBy: claims?.uid ?? 'anon-uid',
        },
        listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
      };

      await assertCell(getContext(env(), cell.persona), cell, target);
    });
  });
}
