/**
 * 🔒 Firestore Rules Test Setup
 *
 * Common setup and helper functions for Firestore security rules testing.
 * Uses @firebase/rules-unit-testing with Firebase Emulator Suite.
 *
 * @module tests/firestore-rules/setup
 * @version 1.0.0
 * @since 2026-01-29 - Security Gate Phase 1
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
  RulesTestContext,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROJECT_ID = 'nestor-test-' + Date.now();
const FIRESTORE_RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

// ============================================================================
// TEST ENVIRONMENT
// ============================================================================

let testEnv: RulesTestEnvironment;

/**
 * Initialize test environment with Firestore rules.
 * Call this in beforeAll() of each test file.
 */
export async function setupTestEnvironment(): Promise<RulesTestEnvironment> {
  const rules = fs.readFileSync(FIRESTORE_RULES_PATH, 'utf8');

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: 'localhost',
      port: 8080,
    },
  });

  return testEnv;
}

/**
 * Clean up test environment.
 * Call this in afterAll() of each test file.
 */
export async function cleanupTestEnvironment(): Promise<void> {
  if (testEnv) {
    await testEnv.cleanup();
  }
}

/**
 * Clear all data between tests.
 * Call this in afterEach() to ensure test isolation.
 */
export async function clearFirestoreData(): Promise<void> {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
}

// ============================================================================
// TEST USERS (Custom Claims Simulation)
// ============================================================================

/**
 * Test user configurations with custom claims.
 * Simulates different tenant/role combinations.
 */
export const TEST_USERS = {
  // Tenant A users
  TENANT_A_ADMIN: {
    uid: 'user-a-admin',
    companyId: 'company-a',
    globalRole: 'company_admin',
  },
  TENANT_A_USER: {
    uid: 'user-a-internal',
    companyId: 'company-a',
    globalRole: 'internal_user',
  },

  // Tenant B users
  TENANT_B_ADMIN: {
    uid: 'user-b-admin',
    companyId: 'company-b',
    globalRole: 'company_admin',
  },
  TENANT_B_USER: {
    uid: 'user-b-internal',
    companyId: 'company-b',
    globalRole: 'internal_user',
  },

  // Super admin (cross-tenant access)
  SUPER_ADMIN: {
    uid: 'user-super-admin',
    companyId: 'company-root',
    globalRole: 'super_admin',
  },

  // External user (limited access)
  EXTERNAL_USER: {
    uid: 'user-external',
    companyId: 'company-a',
    globalRole: 'external_user',
  },
} as const;

// ============================================================================
// CONTEXT HELPERS
// ============================================================================

/**
 * Get authenticated context for a test user.
 */
export function getAuthContext(
  env: RulesTestEnvironment,
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS]
): RulesTestContext {
  return env.authenticatedContext(user.uid, {
    companyId: user.companyId,
    globalRole: user.globalRole,
  });
}

/**
 * Get unauthenticated context (anonymous user).
 */
export function getAnonymousContext(env: RulesTestEnvironment): RulesTestContext {
  return env.unauthenticatedContext();
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

export { assertFails, assertSucceeds };

/**
 * Assert that a read operation fails (DENY).
 */
export async function assertReadDenied(
  ctx: RulesTestContext,
  collection: string,
  docId: string
): Promise<void> {
  const docRef = ctx.firestore().collection(collection).doc(docId);
  await assertFails(docRef.get());
}

/**
 * Assert that a read operation succeeds (ALLOW).
 */
export async function assertReadAllowed(
  ctx: RulesTestContext,
  collection: string,
  docId: string
): Promise<void> {
  const docRef = ctx.firestore().collection(collection).doc(docId);
  await assertSucceeds(docRef.get());
}

/**
 * Assert that a list operation fails (DENY).
 */
export async function assertListDenied(
  ctx: RulesTestContext,
  collection: string,
  query?: { field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }
): Promise<void> {
  let queryRef: FirebaseFirestore.Query = ctx.firestore().collection(collection);
  if (query) {
    queryRef = queryRef.where(query.field, query.op, query.value);
  }
  await assertFails(queryRef.get());
}

/**
 * Assert that a list operation succeeds (ALLOW).
 */
export async function assertListAllowed(
  ctx: RulesTestContext,
  collection: string,
  query?: { field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }
): Promise<void> {
  let queryRef: FirebaseFirestore.Query = ctx.firestore().collection(collection);
  if (query) {
    queryRef = queryRef.where(query.field, query.op, query.value);
  }
  await assertSucceeds(queryRef.get());
}

/**
 * Assert that a write operation fails (DENY).
 */
export async function assertWriteDenied(
  ctx: RulesTestContext,
  collection: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  const docRef = ctx.firestore().collection(collection).doc(docId);
  await assertFails(docRef.set(data));
}

/**
 * Assert that a write operation succeeds (ALLOW).
 */
export async function assertWriteAllowed(
  ctx: RulesTestContext,
  collection: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  const docRef = ctx.firestore().collection(collection).doc(docId);
  await assertSucceeds(docRef.set(data));
}

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Create test building data.
 */
export function createTestBuilding(
  companyId: string,
  projectId?: string,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  return {
    name: 'Test Building',
    companyId,
    projectId: projectId || `project-${companyId}`,
    createdAt: new Date(),
    createdBy: 'test-user',
    ...overrides,
  };
}

/**
 * Create test project data.
 */
export function createTestProject(
  companyId: string,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  return {
    name: 'Test Project',
    status: 'planning',
    company: 'Test Company',
    companyId,
    createdAt: new Date(),
    createdBy: 'test-user',
    ...overrides,
  };
}

/**
 * Create legacy building data (no companyId, only projectId).
 * Used for testing transitional fallback rules.
 */
export function createLegacyBuilding(
  projectId: string,
  createdBy: string,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  return {
    name: 'Legacy Building',
    projectId,
    createdAt: new Date(),
    createdBy,
    // NOTE: No companyId - simulates legacy data
    ...overrides,
  };
}

/**
 * Create test contact data.
 */
export function createTestContact(
  companyId: string,
  createdBy: string,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  return {
    name: 'Test Contact',
    email: 'test@example.com',
    phone: '+30 210 1234567',
    companyId,
    createdAt: new Date(),
    createdBy,
    ...overrides,
  };
}

/**
 * Create test file record data.
 */
export function createTestFileRecord(
  companyId: string,
  createdBy: string,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  return {
    fileName: 'test-file.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    status: 'ready',
    companyId,
    createdAt: new Date(),
    createdBy,
    ...overrides,
  };
}

// ============================================================================
// SEED HELPERS
// ============================================================================

/**
 * Seed test data using admin context.
 * Use this to set up initial data before running tests.
 */
export async function seedTestData(
  env: RulesTestEnvironment,
  collection: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  await env.withSecurityRulesDisabled(async (context: RulesTestContext) => {
    await context.firestore().collection(collection).doc(docId).set(data);
  });
}

/**
 * Seed multiple documents.
 */
export async function seedMultipleDocuments(
  env: RulesTestEnvironment,
  collection: string,
  documents: Array<{ id: string; data: Record<string, unknown> }>
): Promise<void> {
  await env.withSecurityRulesDisabled(async (context: RulesTestContext) => {
    const batch = context.firestore().batch();
    for (const doc of documents) {
      batch.set(context.firestore().collection(collection).doc(doc.id), doc.data);
    }
    await batch.commit();
  });
}
