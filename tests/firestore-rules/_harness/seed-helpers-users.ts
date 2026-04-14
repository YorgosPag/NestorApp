/**
 * Firestore Rules Test Harness — Users / Companies / Workspaces Seeders
 *
 * Arrange-phase seeders for the ownership-based user and company collections
 * covered in ADR-298 Phase C.6 (2026-04-14). Extracted into a dedicated module
 * per the Google SRP 500-line limit.
 *
 * Patterns:
 *   - companies:               docId = SAME_TENANT_COMPANY_ID (path var is the company ID).
 *   - users:                   docId = same_tenant_user.uid so the uid==userId leg
 *                              is exercised for read/update tests.
 *   - user_2fa_settings:       docId = same_tenant_user.uid (pure isOwner gate).
 *   - user_notification_settings: docId = same_tenant_user.uid (pure isOwner gate).
 *   - workspaces:              companyId field — standard tenant seed.
 *   - teams:                   companyId + createdBy=same_tenant_user.uid (crmDirectMatrix
 *                              contract: creator uid used for update/delete allow).
 *   - security_roles:          global read — minimal doc, no companyId required.
 *   - positions:               global read — minimal doc, no companyId required.
 *
 * @module tests/firestore-rules/_harness/seed-helpers-users
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { SeedOptions } from './seed-helpers';

// ---------------------------------------------------------------------------
// Company seeders
// ---------------------------------------------------------------------------

/**
 * Seed a `companies` document.
 *
 * Rule reads via `getUserCompanyId() == companyId` (path variable, NOT a field).
 * The docId MUST equal SAME_TENANT_COMPANY_ID for same-tenant personas to pass.
 * Write rule is `if false` — no write paths to exercise.
 */
export async function seedCompany(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('companies').doc(docId).set({
      name: `Company ${docId}`,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// User seeders
// ---------------------------------------------------------------------------

/**
 * Seed a `users` document.
 *
 * docId = same_tenant_user.uid ('persona-same-user') so:
 *   - same_tenant_user × read/update → allow (uid == userId)
 *   - same_tenant_admin × read/update → allow (belongsToCompany / isCompanyAdminOfCompany)
 *   - super_admin × read → allow (isSuperAdminOnly)
 *   - super_admin × update → allow (isCompanyAdminOfCompany → isSuperAdminOnly)
 *
 * companyId field required for the `belongsToCompany` and `isCompanyAdminOfCompany`
 * legs in read and update rules (SPEC-259B).
 */
export async function seedUser(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('users').doc(docId).set({
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      displayName: `User ${docId}`,
      email: `${docId}@test.com`,
      globalRole: 'internal_user',
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed a `user_2fa_settings` document.
 *
 * Rule: `allow read, write: if isOwner(userId)` = `request.auth.uid == userId`.
 * docId MUST equal same_tenant_user.uid for the owner read/update/delete path.
 */
export async function seedUser2faSettings(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('user_2fa_settings').doc(docId).set({
      enabled: false,
      backupCodes: [],
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed a `user_notification_settings` document.
 *
 * Rule: `allow read, write: if isOwner(userId)` = `request.auth.uid == userId`.
 * docId MUST equal same_tenant_user.uid for the owner read/update/delete path.
 */
export async function seedUserNotificationSettings(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('user_notification_settings').doc(docId).set({
      emailEnabled: true,
      pushEnabled: false,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Workspace seeders
// ---------------------------------------------------------------------------

/**
 * Seed a `workspaces` document.
 *
 * Rule: `isSuperAdminOnly() || (companyId && belongsToCompany(companyId))`.
 * Write: `if false` — Admin SDK only.
 * Standard tenant seed with companyId field.
 */
export async function seedWorkspace(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('workspaces').doc(docId).set({
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      name: `Workspace ${docId}`,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Team seeders
// ---------------------------------------------------------------------------

/**
 * Seed a `teams` document.
 *
 * crmDirectMatrix contract: createdBy=same_tenant_user.uid so:
 *   - same_tenant_user × update/delete → allow (uid==createdBy)
 *   - same_tenant_admin × update → allow (isCompanyAdminOfCompany)
 *   - super_admin × update/delete → allow (isSuperAdminOnly in update, isCompanyAdminOfCompany in delete)
 *
 * companyId required by create rule: `companyId == getUserCompanyId()`.
 * companyId immutability rule: `request.resource.data.companyId == resource.data.companyId`.
 */
export async function seedTeam(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('teams').doc(docId).set({
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      name: `Team ${docId}`,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Role / position seeders
// ---------------------------------------------------------------------------

/**
 * Seed a `security_roles` document.
 *
 * Rule: `allow read: if isAuthenticated()` — global read, no tenant isolation.
 * Write: `if false` — Admin SDK only.
 */
export async function seedSecurityRole(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('security_roles').doc(docId).set({
      name: `Role ${docId}`,
      permissions: [],
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed a `positions` document.
 *
 * Rule: `allow read: if isAuthenticated()` — global read, no tenant isolation.
 * Write: `if false` — Admin SDK only.
 */
export async function seedPosition(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('positions').doc(docId).set({
      name: `Position ${docId}`,
      description: 'Test position',
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}
