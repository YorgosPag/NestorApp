/**
 * Firestore Rules Test Harness — Specialized Collection Seeders (Phase C.7)
 *
 * Arrange-phase seeders for the 11 remaining collections covered in ADR-298
 * Phase C.7 (2026-04-14). Extracted into a dedicated module per the Google
 * SRP 500-line limit.
 *
 * Collections and seed contracts:
 *   - contact_relationships: companyId=SAME_TENANT + createdBy=same_tenant_user.uid
 *   - contact_links:         companyId=SAME_TENANT + createdBy=same_tenant_user.uid
 *   - relationships:         companyId=SAME_TENANT + createdBy=same_tenant_user.uid
 *   - relationship_audit:    minimal doc (no companyId gate — isAuthenticated read)
 *   - employment_records:    companyId=SAME_TENANT + projectId + contactId (update immutability)
 *   - notifications:         userId=same_tenant_user.uid (owner-only access)
 *   - audit_logs (top-level): minimal doc (no companyId gate — isAuthenticated read)
 *   - system_audit_logs:     minimal doc (no companyId gate — isAuthenticated read)
 *   - audit_log:             minimal doc (super_admin-only read)
 *   - search_documents:      tenantId=SAME_TENANT (NOTE: tenantId, not companyId)
 *   - voice_commands:        userId=same_tenant_user.uid (owner-only access)
 *
 * @module tests/firestore-rules/_harness/seed-helpers-specialized
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { SeedOptions } from './seed-helpers';

// ---------------------------------------------------------------------------
// Contact / relationship seeders
// ---------------------------------------------------------------------------

/**
 * Seed a `contact_relationships` document.
 *
 * crmDirectMatrix / contactRelationshipsMatrix contract:
 *   - createdBy=same_tenant_user.uid → owner update/delete path exercised.
 *   - companyId=SAME_TENANT_COMPANY_ID → same-tenant read gate satisfied.
 */
export async function seedContactRelationship(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('contact_relationships').doc(docId).set({
      sourceContactId: `contact-src-${docId}`,
      targetContactId: `contact-tgt-${docId}`,
      relationshipType: 'colleague',
      status: 'active',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed a `contact_links` document.
 *
 * contactRelationshipsMatrix contract:
 *   - createdBy=same_tenant_user.uid → owner update/delete path exercised.
 *   - companyId=SAME_TENANT_COMPANY_ID → same-tenant read gate satisfied.
 */
export async function seedContactLink(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('contact_links').doc(docId).set({
      sourceContactId: `contact-src-${docId}`,
      targetEntityType: 'project',
      targetEntityId: `project-${docId}`,
      status: 'active',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed a `relationships` document.
 *
 * crmDirectMatrix contract:
 *   - companyId=SAME_TENANT_COMPANY_ID (create gate: companyId==getUserCompanyId()).
 *   - createdBy=same_tenant_user.uid (update/delete: createdBy||companyAdmin||superAdmin).
 */
export async function seedRelationship(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('relationships').doc(docId).set({
      entityAId: `entity-a-${docId}`,
      entityBId: `entity-b-${docId}`,
      relationshipType: 'related',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed a `relationship_audit` document.
 *
 * Rule: `allow read: if isAuthenticated()` — no companyId needed.
 * Write: `if false` — Admin SDK only.
 */
export async function seedRelationshipAudit(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('relationship_audit').doc(docId).set({
      relationshipId: `rel-${docId}`,
      action: 'created',
      actorId: 'seed-system',
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Employment records seeder
// ---------------------------------------------------------------------------

/** Stable projectId + contactId for employment_records update immutability checks. */
export const EMPLOYMENT_RECORD_PROJECT_ID = 'project-employment-test' as const;
export const EMPLOYMENT_RECORD_CONTACT_ID = 'contact-employment-test' as const;

/**
 * Seed an `employment_records` document.
 *
 * employmentRecordsMatrix contract:
 *   - companyId=SAME_TENANT_COMPANY_ID → same-tenant read gate.
 *   - projectId/contactId stable → update rule immutability check satisfied.
 *   - apdStatus='pending' (valid enum value).
 */
export async function seedEmploymentRecord(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('employment_records').doc(docId).set({
      projectId: EMPLOYMENT_RECORD_PROJECT_ID,
      contactId: EMPLOYMENT_RECORD_CONTACT_ID,
      month: 4,
      year: 2026,
      totalDaysWorked: 22,
      insuranceClassNumber: 1,
      stampsCount: 25,
      employerContribution: 500,
      employeeContribution: 250,
      totalContribution: 750,
      apdStatus: 'pending',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Notifications seeder
// ---------------------------------------------------------------------------

/**
 * Seed a `notifications` document.
 *
 * notificationsMatrix contract:
 *   - userId=same_tenant_user.uid → owner read/update path exercised.
 *   - No companyId required — rules gate on userId, not tenant.
 */
export async function seedNotification(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('notifications').doc(docId).set({
      userId: PERSONA_CLAIMS.same_tenant_user.uid,
      title: `Test notification ${docId}`,
      message: 'Test message',
      type: 'info',
      delivery: { status: 'delivered' },
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Audit log seeders (global read collections)
// ---------------------------------------------------------------------------

/**
 * Seed a top-level `audit_logs` document.
 *
 * Rule: `allow read: if isAuthenticated()` — no companyId needed.
 * Write: `if false` — Admin SDK only.
 */
export async function seedAuditLog(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('audit_logs').doc(docId).set({
      action: 'test_action',
      actorId: 'seed-system',
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed a `system_audit_logs` document.
 *
 * Rule: `allow read: if isAuthenticated()` — no companyId needed.
 * Write: `if false` — Admin SDK only.
 */
export async function seedSystemAuditLog(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('system_audit_logs').doc(docId).set({
      eventType: 'test_event',
      payload: { test: true },
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed an `audit_log` document (Cloud Functions purge trail).
 *
 * Rule: `allow read: if isSuperAdminOnly()` — super admin only.
 * Write: `if false` — Cloud Functions Admin SDK only.
 */
export async function seedAuditLogEntry(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('audit_log').doc(docId).set({
      operation: 'purge',
      entityId: `entity-${docId}`,
      purgedBy: 'cloud-functions',
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Search documents seeder
// ---------------------------------------------------------------------------

/**
 * Seed a `search_documents` document.
 *
 * searchDocumentsMatrix contract:
 *   - Uses `tenantId` field (NOT `companyId`) — the read gate is
 *     `belongsToCompany(resource.data.tenantId)`.
 *   - Write: `if false` — Admin SDK only.
 */
export async function seedSearchDocument(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('search_documents').doc(docId).set({
      tenantId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      entityType: 'project',
      entityId: `entity-${docId}`,
      searchText: `Test search ${docId}`,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Voice commands seeder
// ---------------------------------------------------------------------------

/**
 * Seed a `voice_commands` document.
 *
 * voiceCommandsMatrix contract:
 *   - userId=same_tenant_user.uid → owner read path exercised.
 *   - Write: `if false` — Admin SDK only.
 */
export async function seedVoiceCommand(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('voice_commands').doc(docId).set({
      userId: PERSONA_CLAIMS.same_tenant_user.uid,
      transcript: 'Test voice command',
      status: 'processing',
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}
