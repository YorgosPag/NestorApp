import { NextResponse } from 'next/server';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import type { AuthContext } from '@/lib/auth';
import { requireBuildingInTenant, requireProjectInTenant, TenantIsolationError } from '@/lib/auth/tenant-isolation';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { isRoleBypass } from '@/lib/auth/roles';
import { normalizeProjectIdForQuery } from '@/utils/firestore-helpers';
import type { FloorDocument, FloorsListResponse } from './floors.types';

export interface FloorsListParams {
  buildingId: string | null;
  projectId: string | null;
  queryCompanyId: string | null;
}

export function resolveFloorsListParams(requestUrl: string): FloorsListParams {
  const { searchParams } = new URL(requestUrl);
  return {
    buildingId: searchParams.get('buildingId'),
    projectId: searchParams.get('projectId'),
    queryCompanyId: searchParams.get('companyId'),
  };
}

export function resolveTenantCompanyId(ctx: AuthContext, queryCompanyId: string | null): string {
  return isRoleBypass(ctx.globalRole) && queryCompanyId
    ? queryCompanyId
    : ctx.companyId;
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
  const isSuperAdmin = isRoleBypass(ctx.globalRole);
  const baseCollection = getAdminFirestore().collection(COLLECTIONS.FLOORS);
  let floorsQuery: FirebaseFirestore.Query = baseCollection;

  if (params.buildingId && !isSuperAdmin) {
    const tenantResult = await verifyBuildingScope(ctx, params.buildingId);
    if (tenantResult) {
      return tenantResult;
    }
    return floorsQuery.where(FIELDS.BUILDING_ID, '==', params.buildingId);
  }

  if (params.projectId && !isSuperAdmin) {
    const tenantResult = await verifyProjectScope(ctx, params.projectId);
    if (tenantResult) {
      return tenantResult;
    }
    return floorsQuery.where(FIELDS.PROJECT_ID, '==', normalizeProjectIdForQuery(params.projectId));
  }

  if (isSuperAdmin) {
    if (params.queryCompanyId) {
      floorsQuery = floorsQuery.where(FIELDS.COMPANY_ID, '==', params.queryCompanyId);
    }
    if (params.buildingId) {
      return floorsQuery.where(FIELDS.BUILDING_ID, '==', params.buildingId);
    }
    if (params.projectId) {
      return floorsQuery.where(FIELDS.PROJECT_ID, '==', normalizeProjectIdForQuery(params.projectId));
    }
    return floorsQuery;
  }

  return floorsQuery.where(FIELDS.COMPANY_ID, '==', ctx.companyId);
}

function toFloorNumber(value: number | string | undefined): number {
  return typeof value === 'number' ? value : parseInt(String(value), 10) || 0;
}

async function verifyBuildingScope(
  ctx: AuthContext,
  buildingId: string
): Promise<NextResponse<FloorsListResponse> | null> {
  try {
    await requireBuildingInTenant({
      ctx,
      buildingId,
      path: '/api/floors',
    });
    return null;
  } catch (error) {
    if (error instanceof TenantIsolationError) {
      return NextResponse.json({
        success: false,
        error: error.code === 'NOT_FOUND' ? 'Building not found' : 'Access denied',
        details: error.message,
      }, { status: error.status });
    }
    throw error;
  }
}

async function verifyProjectScope(
  ctx: AuthContext,
  projectId: string
): Promise<NextResponse<FloorsListResponse> | null> {
  try {
    await requireProjectInTenant({
      ctx,
      projectId,
      path: '/api/floors',
    });
    return null;
  } catch (error) {
    if (error instanceof TenantIsolationError) {
      return NextResponse.json({
        success: false,
        error: error.code === 'NOT_FOUND' ? 'Project not found' : 'Access denied',
        details: error.message,
      }, { status: error.status });
    }
    throw error;
  }
}
