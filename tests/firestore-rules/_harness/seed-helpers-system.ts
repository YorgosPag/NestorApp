/**
 * Firestore Rules Test Harness — System-Global Document Seeders
 *
 * Arrange-phase seeders for the system-global collections covered in
 * ADR-298 Phase C.5 (2026-04-13). Extracted into a dedicated module per the
 * Google SRP 500-line limit.
 *
 * Patterns:
 *   - Global (no companyId): config, email_domain_policies,
 *     country_security_policies, bot_configs, system, counters
 *   - Tenant-scoped (with companyId): navigation_companies, appointments,
 *     analytics, communications, tasks
 *
 * Tasks seeders must include all `isValidTaskData()` required fields:
 *   title, type, assignedTo, status, priority.
 *
 * @module tests/firestore-rules/_harness/seed-helpers-system
 * @since 2026-04-13 (ADR-298 Phase C.5)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { SeedOptions } from './seed-helpers';

// ---------------------------------------------------------------------------
// Global config seeders (no companyId — readable by all authenticated users)
// ---------------------------------------------------------------------------

export async function seedConfig(
  env: RulesTestEnvironment,
  docId: string,
  opts?: Pick<SeedOptions, 'overrides'>,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('config').doc(docId).set({
      key: docId,
      value: 'test-config-value',
      updatedAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedEmailDomainPolicy(
  env: RulesTestEnvironment,
  docId: string,
  opts?: Pick<SeedOptions, 'overrides'>,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('email_domain_policies').doc(docId).set({
      domain: 'test.example.com',
      policy: 'allow',
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedCountrySecurityPolicy(
  env: RulesTestEnvironment,
  docId: string,
  opts?: Pick<SeedOptions, 'overrides'>,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('country_security_policies').doc(docId).set({
      countryCode: 'GR',
      riskLevel: 'low',
      allowSignup: true,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedBotConfig(
  env: RulesTestEnvironment,
  docId: string,
  opts?: Pick<SeedOptions, 'overrides'>,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('bot_configs').doc(docId).set({
      botType: 'telegram',
      active: true,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedSystem(
  env: RulesTestEnvironment,
  docId: string,
  opts?: Pick<SeedOptions, 'overrides'>,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('system').doc(docId).set({
      type: 'settings',
      updatedAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedCounter(
  env: RulesTestEnvironment,
  docId: string,
  opts?: Pick<SeedOptions, 'overrides'>,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('counters').doc(docId).set({
      count: 0,
      prefix: 'PRJ',
      updatedAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Tenant-scoped seeders (server-written, adminWriteOnlyMatrix)
// ---------------------------------------------------------------------------

export async function seedNavigationCompany(
  env: RulesTestEnvironment,
  docId: string,
  opts?: Pick<SeedOptions, 'companyId' | 'overrides'>,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('navigation_companies').doc(docId).set({
      name: `Company ${docId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedAppointment(
  env: RulesTestEnvironment,
  docId: string,
  opts?: Pick<SeedOptions, 'companyId' | 'overrides'>,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('appointments').doc(docId).set({
      title: `Appointment ${docId}`,
      scheduledAt: new Date(),
      status: 'pending',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// CRM pattern seeders (crmDirectMatrix — createdBy=same_tenant_user.uid)
// ---------------------------------------------------------------------------

export async function seedAnalytics(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('analytics').doc(docId).set({
      event: 'page_view',
      source: 'email',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedCommunication(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('communications').doc(docId).set({
      type: 'email',
      subject: `Communication ${docId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Tasks seeder — must satisfy isValidTaskData() required fields
// ---------------------------------------------------------------------------

export async function seedTask(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    const uid = opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid;
    await ctx.firestore().collection('tasks').doc(docId).set({
      title: `Task ${docId}`,
      type: 'call',
      assignedTo: uid,   // same uid = satisfies both createdBy and assignedTo paths on update/delete
      status: 'pending',
      priority: 'medium',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}
