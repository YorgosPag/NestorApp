/**
 * 🔒 PR-1A: Projects Collection - Tenant Isolation Tests
 *
 * Tests for the projects collection tenant isolation via companyId field.
 * Projects are the PRIMARY tenant-scoped entity in the system.
 *
 * @module tests/firestore-rules/pr-1a-projects
 * @version 1.0.0
 * @since 2026-01-29 - Security Gate Phase 1 (PR-1A)
 *
 * Test Cases:
 * 1. Cross-tenant DENY: Tenant A cannot read Tenant B projects
 * 2. Same-tenant ALLOW: Tenant A can read Tenant A projects
 * 3. Super admin ALLOW: super_admin can read all projects
 * 4. Anonymous DENY: Unauthenticated users cannot read projects
 * 5. Legacy fallback: Projects without companyId (creator-only access)
 * 6. Create: companyId must match user's company claim
 * 7. Update: companyId is immutable (no re-tenanting)
 * 8. Delete: Only creator or company admin
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
  assertSucceeds,
  seedTestData,
  seedMultipleDocuments,
  createTestProject,
} from './setup';
import {
  TENANT_ISOLATED_COLLECTIONS,
  TEST_DOC_IDS,
  TEST_COMPANIES,
} from './constants';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

const COLLECTION = TENANT_ISOLATED_COLLECTIONS.PROJECTS;

describe('PR-1A: Projects Collection - Tenant Isolation', () => {
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
      await seedMultipleDocuments(testEnv, COLLECTION, [
        {
          id: TEST_DOC_IDS.PROJECT_A1,
          data: createTestProject(TEST_COMPANIES.COMPANY_A),
        },
        {
          id: TEST_DOC_IDS.PROJECT_B1,
          data: createTestProject(TEST_COMPANIES.COMPANY_B),
        },
      ]);
    });

    it('Tenant A user CANNOT read Tenant B project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.PROJECT_B1);
    });

    it('Tenant A admin CANNOT read Tenant B project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.PROJECT_B1);
    });

    it('Tenant B user CANNOT read Tenant A project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.PROJECT_A1);
    });
  });

  // ==========================================================================
  // SAME-TENANT ALLOW TESTS
  // ==========================================================================

  describe('Same-Tenant Access Allowed', () => {
    beforeEach(async () => {
      await seedTestData(
        testEnv,
        COLLECTION,
        TEST_DOC_IDS.PROJECT_A1,
        createTestProject(TEST_COMPANIES.COMPANY_A)
      );
    });

    it('Tenant A user CAN read Tenant A project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.PROJECT_A1);
    });

    it('Tenant A admin CAN read Tenant A project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.PROJECT_A1);
    });
  });

  // ==========================================================================
  // SUPER ADMIN BYPASS TESTS
  // ==========================================================================

  describe('Super Admin Cross-Tenant Access', () => {
    beforeEach(async () => {
      await seedMultipleDocuments(testEnv, COLLECTION, [
        {
          id: TEST_DOC_IDS.PROJECT_A1,
          data: createTestProject(TEST_COMPANIES.COMPANY_A),
        },
        {
          id: TEST_DOC_IDS.PROJECT_B1,
          data: createTestProject(TEST_COMPANIES.COMPANY_B),
        },
      ]);
    });

    it('Super admin CAN read Tenant A project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.PROJECT_A1);
    });

    it('Super admin CAN read Tenant B project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.PROJECT_B1);
    });
  });

  // ==========================================================================
  // ANONYMOUS DENY TESTS
  // ==========================================================================

  describe('Anonymous Access Denial', () => {
    beforeEach(async () => {
      await seedTestData(
        testEnv,
        COLLECTION,
        TEST_DOC_IDS.PROJECT_A1,
        createTestProject(TEST_COMPANIES.COMPANY_A)
      );
    });

    it('Anonymous user CANNOT read any project', async () => {
      const ctx = getAnonymousContext(testEnv);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.PROJECT_A1);
    });
  });

  // ==========================================================================
  // LEGACY FALLBACK TESTS (Projects without companyId)
  // ==========================================================================

  describe('Legacy Projects (creator-only access)', () => {
    beforeEach(async () => {
      // Seed legacy project (no companyId, only createdBy)
      await seedTestData(testEnv, COLLECTION, TEST_DOC_IDS.LEGACY_PROJECT, {
        name: 'Legacy Project',
        status: 'planning',
        company: 'Test Company',
        // NOTE: No companyId - simulates legacy data
        createdAt: new Date(),
        createdBy: TEST_USERS.TENANT_A_USER.uid,
      });
    });

    it('Creator CAN read their legacy project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.LEGACY_PROJECT);
    });

    it('Other user from same tenant CANNOT read legacy project (strict mode)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.LEGACY_PROJECT);
    });

    it('User from other tenant CANNOT read legacy project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.LEGACY_PROJECT);
    });

    it('Super admin CAN read legacy project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.LEGACY_PROJECT);
    });
  });

  // ==========================================================================
  // CREATE TESTS (companyId must match user's company claim)
  // ==========================================================================

  describe('Create Operations - Company Enforcement', () => {
    it('User CAN create project with their own companyId', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.NEW_DOC);

      const validPayload = {
        name: 'New Project',
        status: 'planning',
        company: 'Test Company',
        companyId: TEST_COMPANIES.COMPANY_A, // Matches user's company
        createdAt: new Date(),
        createdBy: TEST_USERS.TENANT_A_USER.uid,
      };

      await assertSucceeds(docRef.set(validPayload));
    });

    it('User CANNOT create project with different companyId (cross-tenant attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.NEW_DOC);

      const maliciousPayload = {
        name: 'Malicious Project',
        status: 'planning',
        company: 'Test Company',
        companyId: TEST_COMPANIES.COMPANY_B, // WRONG: Trying to create in other tenant
        createdAt: new Date(),
        createdBy: TEST_USERS.TENANT_A_USER.uid,
      };

      await assertFails(docRef.set(maliciousPayload));
    });
  });

  // ==========================================================================
  // UPDATE TESTS (companyId is immutable)
  // ==========================================================================

  describe('Update Operations - Immutability', () => {
    beforeEach(async () => {
      await seedTestData(
        testEnv,
        COLLECTION,
        TEST_DOC_IDS.UPDATE_DOC,
        {
          ...createTestProject(TEST_COMPANIES.COMPANY_A),
          createdBy: TEST_USERS.TENANT_A_USER.uid,
        }
      );
    });

    it('Creator CAN update project name (allowed field)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.UPDATE_DOC);

      await assertSucceeds(
        docRef.update({
          name: 'Updated Name',
          status: 'planning',
          company: 'Test Company',
          companyId: TEST_COMPANIES.COMPANY_A, // Same companyId (immutable)
          createdBy: TEST_USERS.TENANT_A_USER.uid,
        })
      );
    });

    it('Creator CANNOT change companyId (re-tenanting attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.UPDATE_DOC);

      await assertFails(
        docRef.update({
          name: 'Same Name',
          status: 'planning',
          company: 'Test Company',
          companyId: TEST_COMPANIES.COMPANY_B, // WRONG: Trying to re-tenant
          createdBy: TEST_USERS.TENANT_A_USER.uid,
        })
      );
    });

    it('Other tenant user CANNOT update project (cross-tenant attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.UPDATE_DOC);

      await assertFails(
        docRef.update({
          name: 'Hacked Name',
        })
      );
    });
  });

  // ==========================================================================
  // DELETE TESTS
  // ==========================================================================

  describe('Delete Operations', () => {
    beforeEach(async () => {
      await seedTestData(
        testEnv,
        COLLECTION,
        TEST_DOC_IDS.DELETE_DOC,
        {
          ...createTestProject(TEST_COMPANIES.COMPANY_A),
          createdBy: TEST_USERS.TENANT_A_USER.uid,
        }
      );
    });

    it('Creator CAN delete their project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertSucceeds(docRef.delete());
    });

    it('Company admin CAN delete project from their company', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertSucceeds(docRef.delete());
    });

    it('Other tenant user CANNOT delete project (cross-tenant attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertFails(docRef.delete());
    });

    it('Super admin CAN delete any project', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertSucceeds(docRef.delete());
    });
  });
});
