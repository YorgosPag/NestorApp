/**
 * Firestore Rules Test Harness — BoQ / Commissions / Ownership Seeders
 *
 * Arrange-phase seeders for the BoQ, brokerage, commission, and ownership
 * collections covered in ADR-298 Phase C.4 (2026-04-14). Extracted into a
 * dedicated module per the Google SRP 500-line limit.
 *
 * Patterns:
 *   - boq_items:            companyId + status='draft' + required fields (buildingId,
 *                           projectId, categoryCode, title, unit, estimatedQuantity).
 *                           createdBy=same_tenant_user.uid (not used for delete gate
 *                           but included for consistency).
 *   - boq_categories:       companyId + categoryCode (read-only; no write path).
 *   - brokerage_agreements: companyId + createdBy=same_tenant_user.uid so the
 *                           `createdBy==uid` update/delete leg is exercised.
 *   - commission_records:   companyId + createdBy=same_tenant_user.uid so the
 *                           `createdBy==uid` update leg is exercised (delete=super only).
 *   - ownership_tables:     companyId only (update gate uses belongsToCompany, not createdBy).
 *
 * @module tests/firestore-rules/_harness/seed-helpers-boq
 * @since 2026-04-14 (ADR-298 Phase C.4)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { SeedOptions } from './seed-helpers';

// ---------------------------------------------------------------------------
// BoQ seeders
// ---------------------------------------------------------------------------

/**
 * Seed a `boq_items` document.
 *
 * Required fields (enforced by the create rule):
 *   companyId, projectId, buildingId, categoryCode, title, unit, status, estimatedQuantity
 *
 * status='draft' ensures the delete gate (`status in ['draft', 'submitted']`) passes.
 * Update rule requires buildingId/projectId/companyId to be immutable — the test
 * update payload must echo these values or omit them (Firestore update() merges,
 * so unchanged fields remain in request.resource.data).
 */
export async function seedBoqItem(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('boq_items').doc(docId).set({
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      projectId: 'test-project',
      buildingId: 'test-building',
      categoryCode: 'STRUCT-001',
      title: `BoQ Item ${docId}`,
      unit: 'm2',
      status: 'draft',
      estimatedQuantity: 100,
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed a `boq_categories` document.
 *
 * Read-only collection (write = if false). Used only to exercise read paths.
 */
export async function seedBoqCategory(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('boq_categories').doc(docId).set({
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      categoryCode: `CAT-${docId}`,
      name: `BOQ Category ${docId}`,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Commissions seeders
// ---------------------------------------------------------------------------

/**
 * Seed a `brokerage_agreements` document.
 *
 * Required fields (create rule): projectId, agentContactId, createdBy, companyId.
 * createdBy=same_tenant_user.uid exercises:
 *   - same_tenant_user × update/delete → allow (uid==createdBy)
 *   - same_tenant_admin × delete → deny (not creator, not super)
 */
export async function seedBrokerageAgreement(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('brokerage_agreements').doc(docId).set({
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      projectId: 'test-project',
      agentContactId: 'test-agent',
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed a `commission_records` document.
 *
 * Required fields (create rule): projectId, agentContactId, createdBy, companyId.
 * createdBy=same_tenant_user.uid exercises the `uid==createdBy` update leg.
 * Delete is super-only — createdBy plays no role in the delete gate.
 */
export async function seedCommissionRecord(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('commission_records').doc(docId).set({
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      projectId: 'test-project',
      agentContactId: 'test-agent',
      createdBy: opts?.createdBy ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Ownership seeders
// ---------------------------------------------------------------------------

/**
 * Seed an `ownership_tables` document.
 *
 * Update gate: `belongsToCompany(companyId)` — no createdBy contract needed.
 * Delete gate: `isSuperAdminOnly()` — only super_admin may delete.
 */
export async function seedOwnershipTable(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('ownership_tables').doc(docId).set({
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      buildingId: 'test-building',
      name: `Ownership Table ${docId}`,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}
