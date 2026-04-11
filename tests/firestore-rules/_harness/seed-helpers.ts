/**
 * Firestore Rules Test Harness — Document Seeders
 *
 * Factory helpers that seed arrange-phase documents via the security-rules-
 * disabled context. Every seeder takes the same tenant companyId so that
 * tests assert against known data.
 *
 * For `tenant_crossdoc` patterns (e.g. buildings → projects), seeders take
 * upstream document ids so parent docs can be seeded first; see
 * ADR-298 §1.5 pitfall (α).
 *
 * See ADR-298 §3.1.
 *
 * @module tests/firestore-rules/_harness/seed-helpers
 * @since 2026-04-11 (ADR-298 Phase A)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';

export interface SeedOptions {
  /** Override the companyId for cross-tenant test fixtures. */
  readonly companyId?: string;
  /** Override createdBy — defaults to a synthetic system uid. */
  readonly createdBy?: string;
  /** Extra fields merged on top of the factory defaults. */
  readonly overrides?: Record<string, unknown>;
}

const DEFAULT_CREATED_BY = 'seed-system';

function baseDoc(opts: SeedOptions | undefined): Record<string, unknown> {
  return {
    companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
    createdBy: opts?.createdBy ?? DEFAULT_CREATED_BY,
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Single-document seeders
// ---------------------------------------------------------------------------

export async function seedProject(
  env: RulesTestEnvironment,
  projectId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('projects').doc(projectId).set({
      name: `Test Project ${projectId}`,
      status: 'planning',
      company: 'Test Company',
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

export async function seedBuilding(
  env: RulesTestEnvironment,
  buildingId: string,
  projectId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('buildings').doc(buildingId).set({
      name: `Test Building ${buildingId}`,
      projectId,
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

export async function seedContact(
  env: RulesTestEnvironment,
  contactId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('contacts').doc(contactId).set({
      name: `Test Contact ${contactId}`,
      email: 'seed@example.com',
      phone: '+30 210 0000000',
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

export async function seedFile(
  env: RulesTestEnvironment,
  fileId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('files').doc(fileId).set({
      fileName: `seed-${fileId}.pdf`,
      mimeType: 'application/pdf',
      size: 1024,
      status: 'ready',
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

export async function seedMessage(
  env: RulesTestEnvironment,
  messageId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('messages').doc(messageId).set({
      channel: 'email',
      direction: 'inbound',
      status: 'received',
      subject: 'Seed message',
      body: 'Seeded by tests',
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

export async function seedEntityAuditTrail(
  env: RulesTestEnvironment,
  auditId: string,
  opts?: SeedOptions & { entityType?: string; entityId?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('entity_audit_trail').doc(auditId).set({
      entityType: opts?.entityType ?? 'contact',
      entityId: opts?.entityId ?? 'seeded-entity',
      action: 'created',
      timestamp: new Date(),
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Legacy-fallback seeders (no companyId — tests the `|| no companyId` leg)
// ---------------------------------------------------------------------------

export async function seedLegacyBuilding(
  env: RulesTestEnvironment,
  buildingId: string,
  projectId: string,
  createdBy: string,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('buildings').doc(buildingId).set({
      name: 'Legacy Building',
      projectId,
      createdBy,
      createdAt: new Date(),
      // NOTE: no companyId — exercises the legacy fallback rule leg
    });
  });
}
