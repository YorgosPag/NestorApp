/**
 * 🔒 Φύλακες tenant για τους ΧΩΡΟΥΣ ΚΤΙΡΙΟΥ — αποθήκη · θέση στάθμευσης · κοινόχρηστος (ADR-931).
 *
 * Δηλώσεις πάνω στον ένα `requireDocInTenant` (ADR-742). Ξαναεξάγονται από το
 * `@/lib/auth/tenant-isolation`, που μένει η κανονική διαδρομή εισαγωγής.
 *
 * @module lib/auth/tenant-isolation-spaces
 */

import type { AuthContext } from './types';
import { COLLECTIONS } from '@/config/firestore-collections';
import { requireDocInTenant } from './tenant-isolation-core';

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

/** Minimal common-space data required for tenant verification (ADR-931). */
export interface TenantCommonSpace {
  companyId: string;
  name?: string;
  buildingId?: string;
}

/**
 * 🔒 Require storage to belong to authenticated user's tenant.
 */
export async function requireStorageInTenant(params: {
  ctx: AuthContext;
  storageId: string;
  path: string;
}): Promise<TenantStorage> {
  return requireDocInTenant<TenantStorage>({
    ctx: params.ctx,
    id: params.storageId,
    path: params.path,
    collection: COLLECTIONS.STORAGE,
    targetType: 'storage',
    notFoundMessage: 'Storage not found',
  });
}

/**
 * 🔒 Require parking space to belong to authenticated user's tenant.
 */
export async function requireParkingInTenant(params: {
  ctx: AuthContext;
  parkingId: string;
  path: string;
}): Promise<TenantParking> {
  return requireDocInTenant<TenantParking>({
    ctx: params.ctx,
    id: params.parkingId,
    path: params.path,
    collection: COLLECTIONS.PARKING_SPACES,
    targetType: 'parking',
    notFoundMessage: 'Parking space not found',
  });
}

/**
 * 🔒 Require common space to belong to authenticated user's tenant (ADR-931).
 */
export async function requireCommonSpaceInTenant(params: {
  ctx: AuthContext;
  commonSpaceId: string;
  path: string;
}): Promise<TenantCommonSpace> {
  return requireDocInTenant<TenantCommonSpace>({
    ctx: params.ctx,
    id: params.commonSpaceId,
    path: params.path,
    collection: COLLECTIONS.COMMON_SPACES,
    targetType: 'api',
    notFoundMessage: 'Common space not found',
  });
}
