/**
 * 🔒 TENANT ISOLATION UTILITIES
 *
 * Enterprise-grade tenant isolation helpers for multi-tenant data access.
 * Ensures projects/resources belong to authenticated user's company.
 *
 * @module lib/auth/tenant-isolation
 * @version 1.0.0
 * @since 2026-01-17 - AUTHZ Phase 2
 */

// Direct imports to avoid circular dependency with @/lib/auth barrel
import type { AuthContext } from './types';
import { logAuditEvent } from './audit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

/**
 * Typed tenant isolation error (NO string parsing for status codes).
 * @enterprise Replaces brittle `errorMessage.includes('not found')` pattern
 */
export class TenantIsolationError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 403,
    public readonly code: 'NOT_FOUND' | 'FORBIDDEN'
  ) {
    super(message);
    this.name = 'TenantIsolationError';
  }
}

/**
 * Minimal project data required for tenant verification.
 * Avoids widening to full Project type.
 */
export interface TenantProject {
  companyId: string;
  name?: string;
  status?: string;
}

/**
 * Minimal building data required for tenant verification.
 * Avoids widening to full Building type.
 */
export interface TenantBuilding {
  companyId: string;
  name?: string;
  projectId?: string | number;
}

/**
 * 🔒 Require project to belong to authenticated user's tenant.
 *
 * **Security:**
 * - Verifies project exists in Firestore
 * - Validates project.companyId === ctx.companyId
 * - Audits all access denials (404, 403)
 * - Throws on unauthorized access
 *
 * **Usage:**
 * ```typescript
 * const project = await requireProjectInTenant({
 *   ctx,
 *   projectId,
 *   path: '/api/projects/[id]/customers'
 * });
 * // project.companyId guaranteed to match ctx.companyId
 * ```
 *
 * @param params - Tenant isolation parameters
 * @param params.ctx - Authenticated user context
 * @param params.projectId - Project ID to verify
 * @param params.path - API path for audit trail
 * @returns Project data (guaranteed tenant-scoped)
 * @throws Error if project not found or tenant mismatch
 */
export async function requireProjectInTenant(params: {
  ctx: AuthContext;
  projectId: string;
  path: string;
}): Promise<TenantProject> {
  const { ctx, projectId, path } = params;

  if (!getAdminFirestore()) {
    throw new Error('Firebase Admin not initialized');
  }

  // Fetch project document
  const doc = await getAdminFirestore().collection(COLLECTIONS.PROJECTS).doc(projectId).get();

  if (!doc.exists) {
    // Audit the access denial
    await logAuditEvent(ctx, 'access_denied', projectId, 'project', {
      metadata: { path, reason: 'Project not found' },
    });
    throw new TenantIsolationError('Project not found', 404, 'NOT_FOUND');
  }

  const data = doc.data() as TenantProject | undefined;

  // Verify tenant isolation
  if (!data?.companyId || data.companyId !== ctx.companyId) {
    // Audit the tenant isolation violation
    await logAuditEvent(ctx, 'access_denied', projectId, 'project', {
      metadata: { path, reason: 'Tenant isolation violation - companyId mismatch' },
    });
    throw new TenantIsolationError('Access denied', 403, 'FORBIDDEN');
  }

  // Success - return validated project data
  return data;
}

/**
 * 🔒 Require building to belong to authenticated user's tenant.
 *
 * **Security:**
 * - Verifies building exists in Firestore
 * - Validates building.companyId === ctx.companyId
 * - Audits all access denials (404, 403)
 * - Throws on unauthorized access
 *
 * **Usage:**
 * ```typescript
 * const building = await requireBuildingInTenant({
 *   ctx,
 *   buildingId,
 *   path: '/api/buildings/[id]/customers'
 * });
 * // building.companyId guaranteed to match ctx.companyId
 * ```
 *
 * @param params - Tenant isolation parameters
 * @param params.ctx - Authenticated user context
 * @param params.buildingId - Building ID to verify
 * @param params.path - API path for audit trail
 * @returns Building data (guaranteed tenant-scoped)
 * @throws Error if building not found or tenant mismatch
 */
export async function requireBuildingInTenant(params: {
  ctx: AuthContext;
  buildingId: string;
  path: string;
}): Promise<TenantBuilding> {
  const { ctx, buildingId, path } = params;

  if (!getAdminFirestore()) {
    throw new Error('Firebase Admin not initialized');
  }

  // Fetch building document
  const doc = await getAdminFirestore().collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();

  if (!doc.exists) {
    // Audit the access denial
    await logAuditEvent(ctx, 'access_denied', buildingId, 'building', {
      metadata: { path, reason: 'Building not found' },
    });
    throw new TenantIsolationError('Building not found', 404, 'NOT_FOUND');
  }

  const data = doc.data() as TenantBuilding | undefined;

  // Verify tenant isolation
  if (!data?.companyId || data.companyId !== ctx.companyId) {
    // Audit the tenant isolation violation
    await logAuditEvent(ctx, 'access_denied', buildingId, 'building', {
      metadata: { path, reason: 'Tenant isolation violation - companyId mismatch' },
    });
    throw new TenantIsolationError('Access denied', 403, 'FORBIDDEN');
  }

  // Success - return validated building data
  return data;
}
