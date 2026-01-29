/**
 * 🔒 PR-1A: Buildings Collection - Tenant Isolation Tests
 *
 * Tests for the critical hotfix removing public read from buildings collection.
 * Verifies tenant isolation via companyId field.
 *
 * @module tests/firestore-rules/pr-1a-buildings
 * @version 1.1.0
 * @since 2026-01-29 - Security Gate Phase 1 (PR-1A)
 * @updated 2026-01-29 - Fixed write tests to use assertFails with correct payload
 *
 * Test Cases:
 * 1. Cross-tenant DENY: Tenant A cannot read Tenant B buildings
 * 2. Same-tenant ALLOW: Tenant A can read Tenant A buildings
 * 3. Super admin ALLOW: super_admin can read all buildings
 * 4. Anonymous DENY: Unauthenticated users cannot read buildings
 * 5. Legacy fallback: Buildings without companyId (via projectId lookup)
 * 6. Server-only CREATE: Even with valid payload, client create fails
 * 7. Server-only UPDATE: Client cannot update buildings
 * 8. Server-only DELETE: Client cannot delete buildings
 */

import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  clearFirestoreData,
  TEST_USERS,
  getAuthContext,
  getAnonymousContext,
  assertReadAllowed,
  assertReadDenied,
  assertFails,
  seedTestData,
  seedMultipleDocuments,
  createTestBuilding,
  createTestProject,
  createLegacyBuilding,
} from './setup';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

describe('PR-1A: Buildings Collection - Tenant Isolation', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  afterEach(async () => {
    await clearFirestoreData();
  });

  // ==========================================================================
  // CROSS-TENANT DENY TESTS
  // ==========================================================================

  describe('Cross-Tenant Access Denial', () => {
    beforeEach(async () => {
      // Seed buildings for both tenants
      await seedMultipleDocuments(testEnv, 'buildings', [
        {
          id: 'building-a1',
          data: createTestBuilding('company-a', 'project-a1'),
        },
        {
          id: 'building-b1',
          data: createTestBuilding('company-b', 'project-b1'),
        },
      ]);
    });

    it('Tenant A user CANNOT read Tenant B building', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadDenied(ctx, 'buildings', 'building-b1');
    });

    it('Tenant A admin CANNOT read Tenant B building', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      await assertReadDenied(ctx, 'buildings', 'building-b1');
    });

    it('Tenant B user CANNOT read Tenant A building', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      await assertReadDenied(ctx, 'buildings', 'building-a1');
    });
  });

  // ==========================================================================
  // SAME-TENANT ALLOW TESTS
  // ==========================================================================

  describe('Same-Tenant Access Allowed', () => {
    beforeEach(async () => {
      await seedTestData(
        testEnv,
        'buildings',
        'building-a1',
        createTestBuilding('company-a', 'project-a1')
      );
    });

    it('Tenant A user CAN read Tenant A building', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadAllowed(ctx, 'buildings', 'building-a1');
    });

    it('Tenant A admin CAN read Tenant A building', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      await assertReadAllowed(ctx, 'buildings', 'building-a1');
    });
  });

  // ==========================================================================
  // SUPER ADMIN BYPASS TESTS
  // ==========================================================================

  describe('Super Admin Cross-Tenant Access', () => {
    beforeEach(async () => {
      await seedMultipleDocuments(testEnv, 'buildings', [
        {
          id: 'building-a1',
          data: createTestBuilding('company-a', 'project-a1'),
        },
        {
          id: 'building-b1',
          data: createTestBuilding('company-b', 'project-b1'),
        },
      ]);
    });

    it('Super admin CAN read Tenant A building', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      await assertReadAllowed(ctx, 'buildings', 'building-a1');
    });

    it('Super admin CAN read Tenant B building', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      await assertReadAllowed(ctx, 'buildings', 'building-b1');
    });
  });

  // ==========================================================================
  // ANONYMOUS DENY TESTS (Critical: was public before PR-1A)
  // ==========================================================================

  describe('Anonymous Access Denial', () => {
    beforeEach(async () => {
      await seedTestData(
        testEnv,
        'buildings',
        'building-a1',
        createTestBuilding('company-a', 'project-a1')
      );
    });

    it('Anonymous user CANNOT read any building', async () => {
      const ctx = getAnonymousContext(testEnv);
      await assertReadDenied(ctx, 'buildings', 'building-a1');
    });
  });

  // ==========================================================================
  // LEGACY FALLBACK TESTS (Buildings without companyId)
  // ==========================================================================

  describe('Legacy Buildings (via projectId lookup)', () => {
    beforeEach(async () => {
      // First seed the project with companyId
      await seedTestData(
        testEnv,
        'projects',
        'project-a1',
        createTestProject('company-a')
      );

      // Then seed legacy building (no companyId, only projectId)
      await seedTestData(
        testEnv,
        'buildings',
        'building-legacy-a1',
        createLegacyBuilding('project-a1', TEST_USERS.TENANT_A_USER.uid)
      );
    });

    it('Tenant A user CAN read legacy building via projectId lookup', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadAllowed(ctx, 'buildings', 'building-legacy-a1');
    });

    it('Tenant B user CANNOT read legacy building from Tenant A project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      await assertReadDenied(ctx, 'buildings', 'building-legacy-a1');
    });

    it('Super admin CAN read legacy building', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      await assertReadAllowed(ctx, 'buildings', 'building-legacy-a1');
    });
  });

  // ==========================================================================
  // WRITE DENIAL TESTS (Server-only via Admin SDK)
  // ==========================================================================
  // 🔒 SECURITY: Buildings are SERVER-ONLY write (allow write: if false)
  // These tests prove that even with CORRECT payload (matching uid, companyId),
  // the write is still DENIED because of the hard "if false" rule.
  // ==========================================================================

  describe('Write Operations Denial (Server-Only Policy)', () => {
    it('Tenant A admin CANNOT create building even with correct payload', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      const docRef = ctx.firestore().collection('buildings').doc('new-building');

      // Payload with CORRECT createdBy and companyId (matching auth claims)
      // This proves write fails due to "allow write: if false", not validation
      const validPayload = {
        name: 'Test Building',
        companyId: TEST_USERS.TENANT_A_ADMIN.companyId, // Matches user's company
        projectId: 'project-a1',
        createdAt: new Date(),
        createdBy: TEST_USERS.TENANT_A_ADMIN.uid, // Matches authenticated user
      };

      await assertFails(docRef.set(validPayload));
    });

    it('Super admin CANNOT create building via client (server-only)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      const docRef = ctx.firestore().collection('buildings').doc('new-building');

      // Even super_admin cannot write via client (only Admin SDK)
      const validPayload = {
        name: 'Test Building',
        companyId: TEST_USERS.SUPER_ADMIN.companyId,
        projectId: 'project-a1',
        createdAt: new Date(),
        createdBy: TEST_USERS.SUPER_ADMIN.uid,
      };

      await assertFails(docRef.set(validPayload));
    });

    it('Tenant A user CANNOT update existing building (server-only)', async () => {
      // First seed a building
      await seedTestData(
        testEnv,
        'buildings',
        'building-update-test',
        createTestBuilding('company-a', 'project-a1')
      );

      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection('buildings').doc('building-update-test');

      await assertFails(docRef.update({ name: 'Updated Name' }));
    });

    it('Super admin CANNOT delete building via client (server-only)', async () => {
      // First seed a building
      await seedTestData(
        testEnv,
        'buildings',
        'building-delete-test',
        createTestBuilding('company-a', 'project-a1')
      );

      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      const docRef = ctx.firestore().collection('buildings').doc('building-delete-test');

      await assertFails(docRef.delete());
    });
  });
});
