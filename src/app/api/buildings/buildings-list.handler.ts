/**
 * 🏢 GET /api/buildings — building list handler.
 *
 * Extracted from `route.ts` for SRP (same pattern as `building-update.handler.ts`,
 * ADR-281). `route.ts` re-exports `GET` from here, so the public route surface is
 * unchanged.
 *
 * @permission buildings:buildings:view
 */

import type { NextRequest } from 'next/server';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import {
  resolveTenantScopeFromUrl,
  resolveTenantListScopeFromUrl,
  tenantScopeLabel,
} from '@/lib/auth/tenant-scope';
import { tenantScopedCollection } from '@/lib/firestore/tenant-scoped-query';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeProjectIdForQuery } from '@/utils/firestore-helpers';
import { compareInstantsDesc } from '@/lib/date-local';

const logger = createModuleLogger('BuildingsRoute');

/** Building document with optional createdAt for sorting */
export interface BuildingDocument {
  id: string;
  createdAt?: string | Date | { seconds: number; nanoseconds: number };
  [key: string]: unknown;
}

/**
 * Which question the returned list actually answers (ADR-707).
 * - `project`      — buildings whose `projectId` matches the request. The default.
 * - `company-fallback` — the project matched nothing and the caller explicitly asked
 *                    (`?fallback=company`) for the whole company's buildings instead.
 * - `tenant`       — no `projectId` was given; the tenant browse list (ADR-232/702).
 */
export type BuildingsListScope = 'project' | 'company-fallback' | 'tenant';

/** 🏢 ENTERPRISE: Response data type (for apiSuccess wrapper) */
export interface BuildingsResponseData {
  buildings: BuildingDocument[];
  count: number;
  projectId?: string;
  /**
   * ADR-707: the two list semantics are no longer indistinguishable. A caller that
   * renders "the buildings of this project" can assert `scope === 'project'` instead
   * of trusting that the server meant the same thing it did.
   */
  scope: BuildingsListScope;
}

interface ResolvedList {
  snapshot: Awaited<ReturnType<Query<DocumentData>['get']>>;
  scope: BuildingsListScope;
}

/**
 * Run the list query and report which question it ended up answering.
 *
 * 🔒 ADR-707: `?projectId=X` means "buildings OF project X" — nothing else. The
 * company-wide fallback used to fire automatically whenever the project matched
 * nothing, so an empty project silently answered with another project's buildings.
 * It is now OPT-IN (`?fallback=company`) and no caller opts in; the escape hatch
 * survives only for legacy data whose buildings carry no `projectId` at all.
 */
async function resolveBuildingList(request: NextRequest, ctx: AuthContext): Promise<ResolvedList> {
  const adminDb = getAdminFirestore();
  if (!adminDb) {
    logger.error('Firebase Admin not initialized');
    throw new Error('Database unavailable: Firebase Admin not initialized');
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const allowCompanyFallback = searchParams.get('fallback') === 'company';

  // 🔒 ADR-702: browse doctrine — a super admin who named no company sees the
  // whole estate (`all-tenants`); everyone else sees their own, request ignored.
  const listScope = resolveTenantListScopeFromUrl(request.url, ctx);
  // 🔒 ADR-702: the project fallback below deliberately uses the *strict company*
  // doctrine instead. "Pick a building for this project" with no project match
  // should offer one company's buildings — never every tenant's.
  const fallbackScope = resolveTenantScopeFromUrl(request.url, ctx);

  if (!projectId) {
    logger.info('[Buildings] Loading all buildings for tenant', { companyId: tenantScopeLabel(listScope) });
    // 🏢 ADR-232: super admin without a named company → every tenant's buildings.
    // ADR-702: previously this branch dropped `?companyId=` on the floor while
    // /api/properties and /api/floors honoured it — same rule, two behaviours.
    return { snapshot: await tenantScopedCollection(COLLECTIONS.BUILDINGS, listScope).get(), scope: 'tenant' };
  }

  logger.info('[Buildings] Loading for project', { projectId, companyId: fallbackScope.companyId, isSuperAdmin: listScope.isSuperAdmin });
  // 🏢 ADR-209: Single query with normalized projectId (handles string/number mismatch)
  const snapshot = await adminDb.collection(COLLECTIONS.BUILDINGS)
    .where(FIELDS.PROJECT_ID, '==', normalizeProjectIdForQuery(projectId))
    .get();

  // Without `?fallback=company` an empty project answers empty, which is the truth.
  if (snapshot.empty && allowCompanyFallback && fallbackScope.companyId) {
    logger.warn('[Buildings] Project matched nothing — caller opted into company-wide fallback', { projectId, companyId: fallbackScope.companyId });
    return {
      snapshot: await tenantScopedCollection(COLLECTIONS.BUILDINGS, fallbackScope).get(),
      scope: 'company-fallback',
    };
  }

  return { snapshot, scope: 'project' };
}

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<BuildingsResponseData>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const { searchParams } = new URL(request.url);
      const projectId = searchParams.get('projectId') || undefined;
      // ADR-233 §3.4: codesOnly=true → return ALL buildings (incl. soft-deleted)
      // with only {id, code} fields so the client can skip reserved codes when
      // suggesting the next building code. Codes are permanent identifiers —
      // they must not be reissued even after a building is moved to trash.
      const codesOnly = searchParams.get('codesOnly') === 'true';

      const { snapshot, scope } = await resolveBuildingList(request, ctx);

      if (codesOnly) {
        const codes = snapshot.docs.map(doc => ({
          id: doc.id,
          code: (doc.data().code as string | undefined) ?? '',
        }));
        logger.info('[Buildings] codesOnly query', { count: codes.length, projectId, scope });
        return apiSuccess<BuildingsResponseData>(
          { buildings: codes as BuildingDocument[], count: codes.length, projectId, scope },
          `Loaded ${codes.length} building codes`
        );
      }

      // 🏢 ENTERPRISE: Ensure Firestore document ID is preserved
      // ADR-281: Exclude soft-deleted records from normal list
      const buildings: BuildingDocument[] = snapshot.docs
        .filter(doc => doc.data().status !== 'deleted')
        .map(doc => ({
          ...doc.data(),
          id: doc.id,  // ✅ Firestore document ID (always last to prevent override)
        })) as BuildingDocument[];
      // 🔄 ENTERPRISE: Server-side sort by createdAt (desc order)
      buildings.sort((a, b) => compareInstantsDesc(a.createdAt, b.createdAt));
      logger.info('[Buildings] Found buildings', { count: buildings.length, projectId, scope });

      return apiSuccess<BuildingsResponseData>(
        { buildings, count: buildings.length, projectId, scope },
        `Loaded ${buildings.length} buildings`
      );
    },
    { permissions: 'buildings:buildings:view' }
  )
);
