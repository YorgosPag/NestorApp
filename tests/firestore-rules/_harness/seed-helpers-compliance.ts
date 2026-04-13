/**
 * Firestore Rules Test Harness — Compliance Document Seeders
 *
 * Seeders for the compliance-domain collections: `obligations`,
 * `obligation_transmittals`, and `obligation_templates`. Extracted into a
 * dedicated module because `seed-helpers.ts` is at the 500-line Google SRP
 * limit (ADR-298 Phase B.6, 2026-04-13).
 *
 * Contract: every seeder defaults `createdBy` to `same_tenant_user.uid` so
 * that `same_tenant_user × update/delete` cells can exercise the
 * `createdBy == request.auth.uid` path without a per-cell seed override.
 * This mirrors the `CrmSeedOptions` pattern used in `seed-helpers.ts`.
 *
 * See ADR-298 §4 Phase B.6.
 *
 * @module tests/firestore-rules/_harness/seed-helpers-compliance
 * @since 2026-04-13 (ADR-298 Phase B.6)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { SeedOptions } from './seed-helpers';

/** Seed options for compliance collections that carry a `createdBy` field. */
export interface ComplianceSeedOptions extends SeedOptions {
  /** uid stored in `createdBy`. Defaults to `same_tenant_user.uid`. */
  readonly createdByUid?: string;
}

/**
 * Seed an `obligations` document.
 *
 * The create rule (firestore.rules:2000) requires
 * `request.resource.data.companyId == getUserCompanyId()` — no additional
 * field validators. The update/delete rules allow via
 * `createdBy == uid || isCompanyAdminOfCompany || isSuperAdminOnly()`.
 *
 * Default `createdBy = same_tenant_user.uid` exercises the `createdBy == uid`
 * update/delete path for same_tenant_user.
 */
export async function seedObligation(
  env: RulesTestEnvironment,
  obligationId: string,
  opts?: ComplianceSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('obligations').doc(obligationId).set({
      title: `Test Obligation ${obligationId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdByUid ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed an `obligation_transmittals` document.
 *
 * Simpler read gate than obligations: `isSuperAdminOnly()` OR direct
 * `companyId` match (no projectId crossdoc, no legacy createdBy fallback).
 * Create / update / delete follow the same crmDirectMatrix shape — no
 * isSuperAdminOnly short-circuit on create, but update/delete allow via
 * isSuperAdminOnly for super_admin.
 *
 * Default `createdBy = same_tenant_user.uid` exercises the `createdBy == uid`
 * update/delete path for same_tenant_user.
 */
export async function seedObligationTransmittal(
  env: RulesTestEnvironment,
  transmittalId: string,
  opts?: ComplianceSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('obligation_transmittals').doc(transmittalId).set({
      title: `Test Transmittal ${transmittalId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdByUid ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed an `obligation_templates` document.
 *
 * Read gate: `isSuperAdminOnly()` OR direct `companyId` match OR legacy
 * `createdBy` fallback (no companyId on doc). Create requires
 * `companyId == getUserCompanyId()` — no isSuperAdminOnly short-circuit.
 * Update/delete allow via `createdBy == uid || isCompanyAdminOfCompany ||
 * isSuperAdminOnly()` — companyId immutable.
 *
 * Default `createdBy = same_tenant_user.uid` exercises the `createdBy == uid`
 * update/delete path for same_tenant_user.
 */
export async function seedObligationTemplate(
  env: RulesTestEnvironment,
  templateId: string,
  opts?: ComplianceSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('obligation_templates').doc(templateId).set({
      title: `Test Template ${templateId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdByUid ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}
