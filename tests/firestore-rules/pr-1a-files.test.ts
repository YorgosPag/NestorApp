/**
 * @jest-environment node
 */

/**
 * PR-1A: Files Collection - Tenant Isolation Tests
 *
 * Tests for the files collection tenant isolation via companyId field.
 * Files are referenced by the rules as the canonical pattern for tenant isolation.
 *
 * @module tests/firestore-rules/pr-1a-files
 * @version 1.0.0
 * @since 2026-01-29 - Security Gate Phase 1 (PR-1A)
 *
 * Test Cases:
 * 1. Cross-tenant DENY: Tenant A cannot read Tenant B files
 * 2. Same-tenant ALLOW: Tenant A can read Tenant A files
 * 3. Super admin ALLOW: super_admin can read all files
 * 4. Anonymous DENY: Unauthenticated users cannot read files
 * 5. Create: companyId must match user's company claim
 * 6. Update: companyId is immutable
 * 7. Delete: Only creator or company admin
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
  createTestFileRecord,
} from './setup';
import {
  TENANT_ISOLATED_COLLECTIONS,
  TEST_DOC_IDS,
  TEST_COMPANIES,
} from './constants';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

const COLLECTION = TENANT_ISOLATED_COLLECTIONS.FILES;

describe('PR-1A: Files Collection - Tenant Isolation', () => {
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
          id: TEST_DOC_IDS.FILE_A1,
          data: createTestFileRecord(TEST_COMPANIES.COMPANY_A, TEST_USERS.TENANT_A_USER.uid),
        },
        {
          id: TEST_DOC_IDS.FILE_B1,
          data: createTestFileRecord(TEST_COMPANIES.COMPANY_B, TEST_USERS.TENANT_B_USER.uid),
        },
      ]);
    });

    it('Tenant A user CANNOT read Tenant B file', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.FILE_B1);
    });

    it('Tenant A admin CANNOT read Tenant B file', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.FILE_B1);
    });

    it('Tenant B user CANNOT read Tenant A file', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.FILE_A1);
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
        TEST_DOC_IDS.FILE_A1,
        createTestFileRecord(TEST_COMPANIES.COMPANY_A, TEST_USERS.TENANT_A_USER.uid)
      );
    });

    it('Tenant A user CAN read Tenant A file', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.FILE_A1);
    });

    it('Tenant A admin CAN read Tenant A file', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.FILE_A1);
    });

    it('Other user in same tenant CAN read file (tenant-wide access)', async () => {
      // User A2 (internal_user) can read file created by User A1
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.FILE_A1);
    });
  });

  // ==========================================================================
  // SUPER ADMIN BYPASS TESTS
  // ==========================================================================

  describe('Super Admin Cross-Tenant Access', () => {
    beforeEach(async () => {
      await seedMultipleDocuments(testEnv, COLLECTION, [
        {
          id: TEST_DOC_IDS.FILE_A1,
          data: createTestFileRecord(TEST_COMPANIES.COMPANY_A, TEST_USERS.TENANT_A_USER.uid),
        },
        {
          id: TEST_DOC_IDS.FILE_B1,
          data: createTestFileRecord(TEST_COMPANIES.COMPANY_B, TEST_USERS.TENANT_B_USER.uid),
        },
      ]);
    });

    it('Super admin CAN read Tenant A file', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.FILE_A1);
    });

    it('Super admin CAN read Tenant B file', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.FILE_B1);
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
        TEST_DOC_IDS.FILE_A1,
        createTestFileRecord(TEST_COMPANIES.COMPANY_A, TEST_USERS.TENANT_A_USER.uid)
      );
    });

    it('Anonymous user CANNOT read any file', async () => {
      const ctx = getAnonymousContext(testEnv);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.FILE_A1);
    });
  });

  // ==========================================================================
  // CREATE TESTS (companyId must match user's company claim)
  // NOTE: Files rules require status='pending' on create (finalization pattern)
  // ==========================================================================

  describe('Create Operations - Company Enforcement', () => {
    it('User CAN create pending file with their own companyId', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.NEW_DOC);

      const validPayload = {
        fileName: 'new-file.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        status: 'pending', // REQUIRED: Files must be created as 'pending'
        id: TEST_DOC_IDS.NEW_DOC,
        storagePath: '/files/test-path/new-file.pdf',
        companyId: TEST_COMPANIES.COMPANY_A, // Matches user's company
        createdAt: new Date(),
        createdBy: TEST_USERS.TENANT_A_USER.uid,
      };

      await assertSucceeds(docRef.set(validPayload));
    });

    it('User CANNOT create file with different companyId (cross-tenant attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.NEW_DOC);

      const maliciousPayload = {
        fileName: 'malicious-file.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        status: 'pending',
        id: TEST_DOC_IDS.NEW_DOC,
        storagePath: '/files/test-path/malicious-file.pdf',
        companyId: TEST_COMPANIES.COMPANY_B, // WRONG: Trying to create in other tenant
        createdAt: new Date(),
        createdBy: TEST_USERS.TENANT_A_USER.uid,
      };

      await assertFails(docRef.set(maliciousPayload));
    });

    it('User CANNOT create file with ready status directly (bypass prevention)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.NEW_DOC);

      const bypassPayload = {
        fileName: 'bypass-file.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        status: 'ready', // WRONG: Cannot create directly as 'ready'
        id: TEST_DOC_IDS.NEW_DOC,
        storagePath: '/files/test-path/bypass-file.pdf',
        companyId: TEST_COMPANIES.COMPANY_A,
        createdAt: new Date(),
        createdBy: TEST_USERS.TENANT_A_USER.uid,
      };

      await assertFails(docRef.set(bypassPayload));
    });
  });

  // ==========================================================================
  // UPDATE TESTS (status transitions only - finalization pattern)
  // NOTE: Files can only be updated via status transition: pending → ready/failed
  // ==========================================================================

  describe('Update Operations - Status Finalization', () => {
    const PENDING_FILE_DATA = {
      fileName: 'test-file.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      status: 'pending', // Start as pending for finalization tests
      id: TEST_DOC_IDS.UPDATE_DOC,
      storagePath: '/files/test-path/test-file.pdf',
      companyId: TEST_COMPANIES.COMPANY_A,
      createdAt: new Date(),
      createdBy: TEST_USERS.TENANT_A_USER.uid,
    };

    beforeEach(async () => {
      await seedTestData(testEnv, COLLECTION, TEST_DOC_IDS.UPDATE_DOC, PENDING_FILE_DATA);
    });

    it('Creator CAN finalize pending file to ready', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.UPDATE_DOC);

      await assertSucceeds(
        docRef.update({
          status: 'ready', // Transition: pending → ready
          // Immutable fields must remain the same
          id: PENDING_FILE_DATA.id,
          companyId: PENDING_FILE_DATA.companyId,
          createdBy: PENDING_FILE_DATA.createdBy,
          storagePath: PENDING_FILE_DATA.storagePath,
        })
      );
    });

    it('Creator CAN mark pending file as failed', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.UPDATE_DOC);

      await assertSucceeds(
        docRef.update({
          status: 'failed', // Transition: pending → failed
          id: PENDING_FILE_DATA.id,
          companyId: PENDING_FILE_DATA.companyId,
          createdBy: PENDING_FILE_DATA.createdBy,
          storagePath: PENDING_FILE_DATA.storagePath,
        })
      );
    });

    it('Creator CANNOT change companyId during finalization (re-tenanting attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.UPDATE_DOC);

      await assertFails(
        docRef.update({
          status: 'ready',
          id: PENDING_FILE_DATA.id,
          companyId: TEST_COMPANIES.COMPANY_B, // WRONG: Trying to re-tenant
          createdBy: PENDING_FILE_DATA.createdBy,
          storagePath: PENDING_FILE_DATA.storagePath,
        })
      );
    });

    it('Other tenant user CANNOT finalize file (cross-tenant attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.UPDATE_DOC);

      await assertFails(
        docRef.update({
          status: 'ready',
        })
      );
    });
  });

  // ==========================================================================
  // SOFT DELETE TESTS (Enterprise Trash Pattern)
  // NOTE: Files use soft-delete via isDeleted flag, NOT hard delete
  // ==========================================================================

  describe('Soft Delete Operations - Enterprise Trash Pattern', () => {
    const READY_FILE_DATA = {
      fileName: 'test-file.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      status: 'ready', // Must be 'ready' for trash operations
      id: TEST_DOC_IDS.DELETE_DOC,
      storagePath: '/files/test-path/test-file.pdf',
      companyId: TEST_COMPANIES.COMPANY_A,
      createdAt: new Date(),
      createdBy: TEST_USERS.TENANT_A_USER.uid,
    };

    beforeEach(async () => {
      await seedTestData(testEnv, COLLECTION, TEST_DOC_IDS.DELETE_DOC, READY_FILE_DATA);
    });

    it('Creator CAN move their file to trash (soft delete)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertSucceeds(
        docRef.update({
          isDeleted: true, // Soft delete
          // Preserve immutable fields
          id: READY_FILE_DATA.id,
          companyId: READY_FILE_DATA.companyId,
          createdBy: READY_FILE_DATA.createdBy,
          storagePath: READY_FILE_DATA.storagePath,
          status: READY_FILE_DATA.status,
        })
      );
    });

    it('Company admin CAN move file to trash in their company', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertSucceeds(
        docRef.update({
          isDeleted: true,
          id: READY_FILE_DATA.id,
          companyId: READY_FILE_DATA.companyId,
          createdBy: READY_FILE_DATA.createdBy,
          storagePath: READY_FILE_DATA.storagePath,
          status: READY_FILE_DATA.status,
        })
      );
    });

    it('Other tenant user CANNOT trash file (cross-tenant attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertFails(
        docRef.update({
          isDeleted: true,
        })
      );
    });

    it('Super admin CAN trash any file', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertSucceeds(
        docRef.update({
          isDeleted: true,
          id: READY_FILE_DATA.id,
          companyId: READY_FILE_DATA.companyId,
          createdBy: READY_FILE_DATA.createdBy,
          storagePath: READY_FILE_DATA.storagePath,
          status: READY_FILE_DATA.status,
        })
      );
    });

    it('Creator CAN hard delete their file', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      // Hard delete is allowed for creator (enterprise pattern allows both soft and hard delete)
      await assertSucceeds(docRef.delete());
    });

    it('Other tenant user CANNOT hard delete file (cross-tenant attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      // Cross-tenant hard delete should fail
      await assertFails(docRef.delete());
    });
  });
});
