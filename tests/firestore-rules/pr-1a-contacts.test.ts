/**
 * 🔒 PR-1A: Contacts Collection - Tenant Isolation Tests
 *
 * Tests for the contacts collection tenant isolation via companyId field.
 * Contacts are critical CRM data requiring strict tenant isolation.
 *
 * @module tests/firestore-rules/pr-1a-contacts
 * @version 1.0.0
 * @since 2026-01-29 - Security Gate Phase 1 (PR-1A)
 *
 * Test Cases:
 * 1. Cross-tenant DENY: Tenant A cannot read Tenant B contacts
 * 2. Same-tenant ALLOW: Tenant A can read Tenant A contacts
 * 3. Super admin ALLOW: super_admin can read all contacts
 * 4. Anonymous DENY: Unauthenticated users cannot read contacts
 * 5. Create: companyId must match user's company claim
 * 6. Update: companyId is immutable (no re-tenanting)
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
  createTestContact,
} from './setup';
import {
  TENANT_ISOLATED_COLLECTIONS,
  TEST_DOC_IDS,
  TEST_COMPANIES,
} from './constants';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

const COLLECTION = TENANT_ISOLATED_COLLECTIONS.CONTACTS;

describe('PR-1A: Contacts Collection - Tenant Isolation', () => {
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
          id: TEST_DOC_IDS.CONTACT_A1,
          data: createTestContact(TEST_COMPANIES.COMPANY_A, TEST_USERS.TENANT_A_USER.uid),
        },
        {
          id: TEST_DOC_IDS.CONTACT_B1,
          data: createTestContact(TEST_COMPANIES.COMPANY_B, TEST_USERS.TENANT_B_USER.uid),
        },
      ]);
    });

    it('Tenant A user CANNOT read Tenant B contact', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.CONTACT_B1);
    });

    it('Tenant A admin CANNOT read Tenant B contact', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.CONTACT_B1);
    });

    it('Tenant B user CANNOT read Tenant A contact', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.CONTACT_A1);
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
        TEST_DOC_IDS.CONTACT_A1,
        createTestContact(TEST_COMPANIES.COMPANY_A, TEST_USERS.TENANT_A_USER.uid)
      );
    });

    it('Tenant A user CAN read Tenant A contact', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.CONTACT_A1);
    });

    it('Tenant A admin CAN read Tenant A contact', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.CONTACT_A1);
    });

    it('Different user from same tenant CAN read contact (company-wide access)', async () => {
      // Create contact by user A
      await seedTestData(
        testEnv,
        COLLECTION,
        'contact-by-other-user',
        createTestContact(TEST_COMPANIES.COMPANY_A, 'some-other-user-a')
      );

      // User A should be able to read it (same company)
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      await assertReadAllowed(ctx, COLLECTION, 'contact-by-other-user');
    });
  });

  // ==========================================================================
  // SUPER ADMIN BYPASS TESTS
  // ==========================================================================

  describe('Super Admin Cross-Tenant Access', () => {
    beforeEach(async () => {
      await seedMultipleDocuments(testEnv, COLLECTION, [
        {
          id: TEST_DOC_IDS.CONTACT_A1,
          data: createTestContact(TEST_COMPANIES.COMPANY_A, TEST_USERS.TENANT_A_USER.uid),
        },
        {
          id: TEST_DOC_IDS.CONTACT_B1,
          data: createTestContact(TEST_COMPANIES.COMPANY_B, TEST_USERS.TENANT_B_USER.uid),
        },
      ]);
    });

    it('Super admin CAN read Tenant A contact', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.CONTACT_A1);
    });

    it('Super admin CAN read Tenant B contact', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      await assertReadAllowed(ctx, COLLECTION, TEST_DOC_IDS.CONTACT_B1);
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
        TEST_DOC_IDS.CONTACT_A1,
        createTestContact(TEST_COMPANIES.COMPANY_A, TEST_USERS.TENANT_A_USER.uid)
      );
    });

    it('Anonymous user CANNOT read any contact', async () => {
      const ctx = getAnonymousContext(testEnv);
      await assertReadDenied(ctx, COLLECTION, TEST_DOC_IDS.CONTACT_A1);
    });
  });

  // ==========================================================================
  // CREATE TESTS (companyId must match user's company claim)
  // ==========================================================================

  describe('Create Operations - Company Enforcement', () => {
    it('User CAN create contact with their own companyId', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.NEW_DOC);

      const validPayload = createTestContact(
        TEST_COMPANIES.COMPANY_A, // Matches user's company
        TEST_USERS.TENANT_A_USER.uid
      );

      await assertSucceeds(docRef.set(validPayload));
    });

    it('User CANNOT create contact with different companyId (cross-tenant attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.NEW_DOC);

      const maliciousPayload = createTestContact(
        TEST_COMPANIES.COMPANY_B, // WRONG: Trying to create in other tenant
        TEST_USERS.TENANT_A_USER.uid
      );

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
        createTestContact(TEST_COMPANIES.COMPANY_A, TEST_USERS.TENANT_A_USER.uid)
      );
    });

    it('Creator CAN update contact name (allowed field)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.UPDATE_DOC);

      await assertSucceeds(
        docRef.update({
          name: 'Updated Contact Name',
          email: 'updated@example.com',
        })
      );
    });

    it('Creator CANNOT change companyId (re-tenanting attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.UPDATE_DOC);

      await assertFails(
        docRef.update({
          companyId: TEST_COMPANIES.COMPANY_B, // WRONG: Trying to re-tenant
        })
      );
    });

    it('Other tenant user CANNOT update contact (cross-tenant attack)', async () => {
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
        createTestContact(TEST_COMPANIES.COMPANY_A, TEST_USERS.TENANT_A_USER.uid)
      );
    });

    it('Creator CAN delete their contact', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertSucceeds(docRef.delete());
    });

    it('Company admin CAN delete contact from their company', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_A_ADMIN);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertSucceeds(docRef.delete());
    });

    it('Other tenant user CANNOT delete contact (cross-tenant attack)', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.TENANT_B_USER);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertFails(docRef.delete());
    });

    it('Super admin CAN delete any contact', async () => {
      const ctx = getAuthContext(testEnv, TEST_USERS.SUPER_ADMIN);
      const docRef = ctx.firestore().collection(COLLECTION).doc(TEST_DOC_IDS.DELETE_DOC);

      await assertSucceeds(docRef.delete());
    });
  });
});
