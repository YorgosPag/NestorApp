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
import { isRoleBypass } from './roles';
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

  // 🏢 ENTERPRISE: Super Admin bypasses tenant isolation (cross-tenant access)
  const isSuperAdmin = isRoleBypass(ctx.globalRole);

  // 🏢 ADR-232: Super admin entities may have companyId: null — allow access
  // Regular users must match companyId exactly
  if (!isSuperAdmin) {
    // If entity has no companyId (super admin created), deny access to regular users
    if (!data?.companyId || data.companyId !== ctx.companyId) {
      await logAuditEvent(ctx, 'access_denied', projectId, 'project', {
        metadata: { path, reason: 'Tenant isolation violation - companyId mismatch' },
      });
      throw new TenantIsolationError('Access denied', 403, 'FORBIDDEN');
    }
  }

  // Success - return validated project data
  return data!;
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

  // 🏢 ENTERPRISE: Super Admin bypasses tenant isolation (cross-tenant access)
  const isSuperAdmin = isRoleBypass(ctx.globalRole);

  // 🏢 ADR-232: Super admin entities may have companyId: null — allow access
  if (!isSuperAdmin) {
    if (!data?.companyId || data.companyId !== ctx.companyId) {
      await logAuditEvent(ctx, 'access_denied', buildingId, 'building', {
        metadata: { path, reason: 'Tenant isolation violation - companyId mismatch' },
      });
      throw new TenantIsolationError('Access denied', 403, 'FORBIDDEN');
    }
  }

  // Success - return validated building data
  return data!;
}

// =============================================================================
// ADR-255 SPEC-255B — Additional Entity Tenant Isolation
// =============================================================================

/** Minimal unit data required for tenant verification. */
export interface TenantUnit {
  companyId: string;
  name?: string;
  buildingId?: string;
}

/** Minimal storage data required for tenant verification. */
export interface TenantStorage {
  companyId: string;
  name?: string;
  buildingId?: string;
}

/** Minimal parking data required for tenant verification. */
export interface TenantParking {
  companyId: string;
  number?: string;
  projectId?: string;
}

/** Minimal opportunity data required for tenant verification. */
export interface TenantOpportunity {
  companyId: string;
  name?: string;
  stage?: string;
}

/**
 * 🔒 Require unit to belong to authenticated user's tenant.
 */
export async function requireUnitInTenant(params: {
  ctx: AuthContext;
  unitId: string;
  path: string;
}): Promise<TenantUnit> {
  const { ctx, unitId, path } = params;

  if (!getAdminFirestore()) {
    throw new Error('Firebase Admin not initialized');
  }

  const doc = await getAdminFirestore().collection(COLLECTIONS.UNITS).doc(unitId).get();

  if (!doc.exists) {
    await logAuditEvent(ctx, 'access_denied', unitId, 'unit', {
      metadata: { path, reason: 'Unit not found' },
    });
    throw new TenantIsolationError('Unit not found', 404, 'NOT_FOUND');
  }

  const data = doc.data() as TenantUnit | undefined;
  const isSuperAdmin = isRoleBypass(ctx.globalRole);

  if (!isSuperAdmin) {
    if (!data?.companyId || data.companyId !== ctx.companyId) {
      await logAuditEvent(ctx, 'access_denied', unitId, 'unit', {
        metadata: { path, reason: 'Tenant isolation violation - companyId mismatch' },
      });
      throw new TenantIsolationError('Access denied', 403, 'FORBIDDEN');
    }
  }

  return data!;
}

/**
 * 🔒 Require storage to belong to authenticated user's tenant.
 */
export async function requireStorageInTenant(params: {
  ctx: AuthContext;
  storageId: string;
  path: string;
}): Promise<TenantStorage> {
  const { ctx, storageId, path } = params;

  if (!getAdminFirestore()) {
    throw new Error('Firebase Admin not initialized');
  }

  const doc = await getAdminFirestore().collection(COLLECTIONS.STORAGE).doc(storageId).get();

  if (!doc.exists) {
    await logAuditEvent(ctx, 'access_denied', storageId, 'storage', {
      metadata: { path, reason: 'Storage not found' },
    });
    throw new TenantIsolationError('Storage not found', 404, 'NOT_FOUND');
  }

  const data = doc.data() as TenantStorage | undefined;
  const isSuperAdmin = isRoleBypass(ctx.globalRole);

  if (!isSuperAdmin) {
    if (!data?.companyId || data.companyId !== ctx.companyId) {
      await logAuditEvent(ctx, 'access_denied', storageId, 'storage', {
        metadata: { path, reason: 'Tenant isolation violation - companyId mismatch' },
      });
      throw new TenantIsolationError('Access denied', 403, 'FORBIDDEN');
    }
  }

  return data!;
}

/**
 * 🔒 Require parking space to belong to authenticated user's tenant.
 */
export async function requireParkingInTenant(params: {
  ctx: AuthContext;
  parkingId: string;
  path: string;
}): Promise<TenantParking> {
  const { ctx, parkingId, path } = params;

  if (!getAdminFirestore()) {
    throw new Error('Firebase Admin not initialized');
  }

  const doc = await getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES).doc(parkingId).get();

  if (!doc.exists) {
    await logAuditEvent(ctx, 'access_denied', parkingId, 'parking', {
      metadata: { path, reason: 'Parking space not found' },
    });
    throw new TenantIsolationError('Parking space not found', 404, 'NOT_FOUND');
  }

  const data = doc.data() as TenantParking | undefined;
  const isSuperAdmin = isRoleBypass(ctx.globalRole);

  if (!isSuperAdmin) {
    if (!data?.companyId || data.companyId !== ctx.companyId) {
      await logAuditEvent(ctx, 'access_denied', parkingId, 'parking', {
        metadata: { path, reason: 'Tenant isolation violation - companyId mismatch' },
      });
      throw new TenantIsolationError('Access denied', 403, 'FORBIDDEN');
    }
  }

  return data!;
}

/**
 * 🔒 Require opportunity to belong to authenticated user's tenant.
 */
export async function requireOpportunityInTenant(params: {
  ctx: AuthContext;
  opportunityId: string;
  path: string;
}): Promise<TenantOpportunity> {
  const { ctx, opportunityId, path } = params;

  if (!getAdminFirestore()) {
    throw new Error('Firebase Admin not initialized');
  }

  const doc = await getAdminFirestore().collection(COLLECTIONS.OPPORTUNITIES).doc(opportunityId).get();

  if (!doc.exists) {
    await logAuditEvent(ctx, 'access_denied', opportunityId, 'opportunity', {
      metadata: { path, reason: 'Opportunity not found' },
    });
    throw new TenantIsolationError('Opportunity not found', 404, 'NOT_FOUND');
  }

  const data = doc.data() as TenantOpportunity | undefined;
  const isSuperAdmin = isRoleBypass(ctx.globalRole);

  if (!isSuperAdmin) {
    if (!data?.companyId || data.companyId !== ctx.companyId) {
      await logAuditEvent(ctx, 'access_denied', opportunityId, 'opportunity', {
        metadata: { path, reason: 'Tenant isolation violation - companyId mismatch' },
      });
      throw new TenantIsolationError('Access denied', 403, 'FORBIDDEN');
    }
  }

  return data!;
}

// =============================================================================
// BATCH TENANT FILTER — for pre-fetched Firestore snapshots
// =============================================================================

/**
 * 🔒 Filter already-fetched Firestore snapshots by tenant ownership.
 *
 * Use this when you've already batch-fetched documents via `getAll()` and need
 * to apply tenant isolation without re-reading each document individually.
 *
 * Unlike `require*InTenant()`, this does NOT throw — it silently excludes
 * documents that don't belong to the tenant (treating them as "not found").
 * Super admins bypass the filter.
 *
 * Audit logging: denied IDs are batch-logged in a single audit event
 * (consistent with `require*InTenant()` which logs each denial individually).
 *
 * @param snapshots  Pre-fetched Firestore document snapshots
 * @param ctx        Authenticated user context
 * @param path       API path for audit trail (e.g. '/api/spaces/batch-resolve')
 * @returns Object with `allowed` (tenant-matching docs) and `denied` (IDs that failed tenant check)
 */
export async function filterSnapshotsByTenant(
  snapshots: ReadonlyArray<FirebaseFirestore.DocumentSnapshot>,
  ctx: AuthContext,
  path: string,
): Promise<{ allowed: FirebaseFirestore.DocumentSnapshot[]; denied: string[] }> {
  const isSuperAdmin = isRoleBypass(ctx.globalRole);
  const allowed: FirebaseFirestore.DocumentSnapshot[] = [];
  const denied: string[] = [];

  for (const snap of snapshots) {
    if (!snap.exists) continue;
    if (isSuperAdmin) {
      allowed.push(snap);
      continue;
    }
    const data = snap.data();
    if (data?.companyId && data.companyId === ctx.companyId) {
      allowed.push(snap);
    } else {
      denied.push(snap.id);
    }
  }

  // Audit log denied access attempts (batch — one event for all denials)
  if (denied.length > 0) {
    await logAuditEvent(ctx, 'access_denied', denied.join(','), 'unit', {
      metadata: {
        path,
        reason: `Tenant isolation violation - ${denied.length} document(s) denied: ${denied.join(', ')}`,
      },
    });
  }

  return { allowed, denied };
}
