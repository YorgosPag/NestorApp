import { NextResponse } from 'next/server';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import type { AuthContext } from '@/lib/auth';
import { requireBuildingInTenant, requireProjectInTenant, TenantIsolationError } from '@/lib/auth/tenant-isolation';
import { isRoleBypass } from '@/lib/auth/roles';
import {
  resolveTenantListScopeFromUrl,
  resolveTenantScopeFromUrl,
  type TenantListScope,
  type TenantScope,
} from '@/lib/auth/tenant-scope';
import { tenantScopedCollection } from '@/lib/firestore/tenant-scoped-query';
import { tenantIsolationResponse } from '@/lib/api/tenant-scope-http';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { normalizeProjectIdForQuery } from '@/utils/firestore-helpers';
import type { FloorDocument, FloorsListResponse } from './floors.types';

/** Audit path recorded by the ownership guards for this endpoint. */
const FLOORS_PATH = '/api/floors';

export interface FloorsListParams {
  buildingId: string | null;
  projectId: string | null;
  /**
   * 🔒 ADR-702: resolved once, here — the route never re-derives who may read
   * whose floors. Carried in the params object so `buildFloorsQuery` cannot be
   * called without it.
   */
  scope: TenantListScope;
  /**
   * Scope for the `hasFloorplan` enrichment query only — deliberately the
   * *strict company* doctrine, never `all-tenants`.
   *
   * That lookup filters `files` by `companyId + entityType + purpose + entityId`,
   * and only that field combination is indexed. Dropping `companyId` on the
   * all-tenants browse path would need a new composite index deployed before it
   * could run at all, so the pre-ADR-702 behaviour is preserved verbatim: a
   * super admin browsing every tenant gets `hasFloorplan` computed against their
   * own company. Known gap, recorded in ADR-702 §7 — not introduced here.
   */
  floorplanLookupScope: TenantScope;
}

export function resolveFloorsListParams(requestUrl: string, ctx: AuthContext): FloorsListParams {
  const { searchParams } = new URL(requestUrl);
  return {
    buildingId: searchParams.get('buildingId'),
    projectId: searchParams.get('projectId'),
    scope: resolveTenantListScopeFromUrl(requestUrl, ctx),
    floorplanLookupScope: resolveTenantScopeFromUrl(requestUrl, ctx),
  };
}

export function sortFloors(floors: FloorDocument[], params: FloorsListParams): FloorDocument[] {
  if (params.buildingId) {
    floors.sort((a, b) => toFloorNumber(a.number) - toFloorNumber(b.number));
    return floors;
  }

  if (params.projectId) {
    floors.sort((a, b) => {
      if (a.buildingId !== b.buildingId) {
        return a.buildingId.localeCompare(b.buildingId);
      }
      return toFloorNumber(a.number) - toFloorNumber(b.number);
    });
  }

  return floors;
}

export async function buildFloorsQuery(
  ctx: AuthContext,
  params: FloorsListParams
): Promise<FirebaseFirestore.Query | NextResponse<FloorsListResponse>> {
  const { scope } = params;

  // Parent-scoped reads by a normal user: isolation is the ownership check on
  // the parent, NOT a companyId filter — a floor may carry a different
  // companyId than the building/project it hangs off.
  if (params.buildingId && !scope.isSuperAdmin) {
    const buildingId = params.buildingId;
    const refusal = await guardParentScope(
      () => requireBuildingInTenant({ ctx, buildingId, path: FLOORS_PATH }),
      'Building not found',
    );
    return refusal ?? floorsCollection().where(FIELDS.BUILDING_ID, '==', buildingId);
  }

  if (params.projectId && !scope.isSuperAdmin) {
    const projectId = params.projectId;
    const refusal = await guardParentScope(
      () => requireProjectInTenant({ ctx, projectId, path: FLOORS_PATH }),
      'Project not found',
    );
    return refusal ?? floorsCollection().where(FIELDS.PROJECT_ID, '==', normalizeProjectIdForQuery(projectId));
  }

  const floorsQuery = tenantScopedCollection(COLLECTIONS.FLOORS, scope);

  if (params.buildingId) {
    return floorsQuery.where(FIELDS.BUILDING_ID, '==', params.buildingId);
  }
  if (params.projectId) {
    return floorsQuery.where(FIELDS.PROJECT_ID, '==', normalizeProjectIdForQuery(params.projectId));
  }
  return floorsQuery;
}

function floorsCollection(): FirebaseFirestore.Query {
  return getAdminFirestore().collection(COLLECTIONS.FLOORS);
}

function toFloorNumber(value: number | string | undefined): number {
  return typeof value === 'number' ? value : parseInt(String(value), 10) || 0;
}

/** A floor the caller is entitled to act on, loaded once. */
export interface LoadedFloor {
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
}

/**
 * Load a floor and confirm the caller may act on it.
 *
 * ADR-702 — the update and delete handlers each carried their own copy of
 * *read document → 404 if missing → 403 unless mine*, and both spelled the
 * privileged escape as `ctx.globalRole !== 'super_admin'`: a raw string, not
 * `isRoleBypass`. Any second bypass role would have been refused access to its
 * own tenant's floors by code that looked correct. One copy now, asking the
 * roles SSoT.
 *
 * The document is returned rather than re-fetched, so this costs no extra read.
 *
 * @returns the loaded floor, or the response to send instead
 */
export async function loadFloorInTenant(
  db: FirebaseFirestore.Firestore,
  floorId: string,
  ctx: AuthContext,
): Promise<LoadedFloor | NextResponse> {
  const ref = db.collection(COLLECTIONS.FLOORS).doc(floorId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return NextResponse.json({ success: false, error: 'Floor not found' }, { status: 404 });
  }

  const data = snapshot.data() ?? {};
  if (data.companyId !== ctx.companyId && !isRoleBypass(ctx.globalRole)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  return { ref, data };
}

/**
 * Run a parent-ownership guard, converting its refusal into a response.
 *
 * One function for both parents: building and project differed only in which
 * guard ran and which noun the 404 used, and writing that twice is how the two
 * copies drift apart.
 *
 * @returns `null` when the caller owns the parent, a refusal response otherwise
 */
async function guardParentScope(
  verify: () => Promise<unknown>,
  notFoundMessage: string,
): Promise<NextResponse<FloorsListResponse> | null> {
  try {
    await verify();
    return null;
  } catch (error) {
    if (error instanceof TenantIsolationError) {
      return tenantIsolationResponse(error, notFoundMessage);
    }
    throw error;
  }
}
