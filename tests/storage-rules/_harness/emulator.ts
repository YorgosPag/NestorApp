/**
 * Storage Rules Test Harness — Emulator Lifecycle
 *
 * Thin wrapper around `@firebase/rules-unit-testing` that handles
 * initialization, teardown, and between-test reset for the Storage emulator.
 * Every storage rules test suite goes through this module — no direct
 * `initializeTestEnvironment` calls.
 *
 * See ADR-301 §3.1 (harness layer).
 *
 * @module tests/storage-rules/_harness/emulator
 * @since 2026-04-14 (ADR-301 Phase A)
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Storage emulator host/port — matches `firebase.json` emulators.storage.
 */
const EMULATOR_HOST = 'localhost';
const EMULATOR_PORT = 9199;

/**
 * Path to the canonical storage.rules file, resolved from this module.
 * CHECK 3.19 parses the same file, so drift is impossible by construction.
 */
const STORAGE_RULES_PATH = path.resolve(__dirname, '..', '..', '..', 'storage.rules');

/**
 * Unique project id per emulator session.
 *
 * Must start with `demo-` — the Firebase emulator requires a `demo-*`
 * project ID for fully-local testing with no production connections.
 */
function generateProjectId(): string {
  return `demo-nestor-storage-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Spin up a fresh emulator environment with the current storage.rules
 * loaded. Call in `beforeAll` of each suite.
 */
export async function initStorageEmulator(): Promise<RulesTestEnvironment> {
  const rules = fs.readFileSync(STORAGE_RULES_PATH, 'utf8');

  return initializeTestEnvironment({
    projectId: generateProjectId(),
    storage: {
      rules,
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
    },
  });
}

/** Tear down the environment. Call in `afterAll`. */
export async function teardownStorageEmulator(
  env: RulesTestEnvironment,
): Promise<void> {
  await env.cleanup();
}

/**
 * Clear all Storage files between tests — does NOT reload rules, so suites
 * never need to re-init just to get a clean slate.
 * Call in `afterEach`.
 */
export async function resetStorageData(env: RulesTestEnvironment): Promise<void> {
  await env.clearStorage();
}

/** Exposed for introspection/debugging — NOT used by production tests. */
export function getStorageEmulatorConfig(): Readonly<{
  host: string;
  port: number;
  rulesPath: string;
}> {
  return {
    host: EMULATOR_HOST,
    port: EMULATOR_PORT,
    rulesPath: STORAGE_RULES_PATH,
  };
}
