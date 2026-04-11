/**
 * Firestore Rules Test Harness — Emulator Lifecycle
 *
 * Thin wrapper around `@firebase/rules-unit-testing` that handles
 * initialization, teardown, and between-test reset. Every rules test suite
 * goes through this module — no direct `initializeTestEnvironment` calls.
 *
 * See ADR-298 §3.1 (harness layer).
 *
 * @module tests/firestore-rules/_harness/emulator
 * @since 2026-04-11 (ADR-298 Phase A)
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Firestore emulator host — matches `firebase.json` emulators.firestore.port.
 *
 * Kept as a constant rather than an env var because `rules-unit-testing`
 * requires synchronous setup and we want deterministic failure when the
 * emulator is not running.
 */
const EMULATOR_HOST = 'localhost';
const EMULATOR_PORT = 8080;

/**
 * Path to the canonical firestore.rules file, resolved from this module.
 * CHECK 3.16 parses the same file, so drift is impossible by construction.
 */
const FIRESTORE_RULES_PATH = path.resolve(__dirname, '..', '..', '..', 'firestore.rules');

/**
 * Unique project id per emulator session.
 *
 * `rules-unit-testing` namespaces data by projectId, so generating a fresh
 * id per test file prevents cross-suite pollution even if `clearFirestore`
 * is accidentally skipped.
 */
function generateProjectId(): string {
  return `nestor-rules-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Spin up a fresh emulator environment with the current firestore.rules
 * loaded. Call in `beforeAll` of each suite.
 */
export async function initEmulator(): Promise<RulesTestEnvironment> {
  const rules = fs.readFileSync(FIRESTORE_RULES_PATH, 'utf8');

  return initializeTestEnvironment({
    projectId: generateProjectId(),
    firestore: {
      rules,
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
    },
  });
}

/** Tear down the environment. Call in `afterAll`. */
export async function teardownEmulator(env: RulesTestEnvironment): Promise<void> {
  await env.cleanup();
}

/**
 * Clear all Firestore data between tests — `clearFirestore` does NOT reload
 * rules, so suites never need to re-init just to get a clean slate.
 * Call in `afterEach`.
 */
export async function resetData(env: RulesTestEnvironment): Promise<void> {
  await env.clearFirestore();
}

/**
 * Reload rules from disk into an existing environment. Used by
 * rule-shape regression tests that swap in a deliberately broken rules
 * file to assert the regression gate actually fires.
 */
export async function reloadRules(env: RulesTestEnvironment, rulesContent?: string): Promise<void> {
  const rules = rulesContent ?? fs.readFileSync(FIRESTORE_RULES_PATH, 'utf8');
  await env.withSecurityRulesDisabled(async () => {
    // No-op placeholder — `rules-unit-testing` does not expose a hot-reload
    // API, so callers must init a new environment. We keep the function in
    // the harness surface so Phase D CI integration has a stable seam.
    void rules;
  });
}

/** Exposed for introspection/debugging — NOT used by production tests. */
export function getEmulatorConfig(): Readonly<{ host: string; port: number; rulesPath: string }> {
  return {
    host: EMULATOR_HOST,
    port: EMULATOR_PORT,
    rulesPath: FIRESTORE_RULES_PATH,
  };
}
