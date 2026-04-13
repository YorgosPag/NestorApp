/**
 * Project Mutation Service — Update & Delete business logic
 *
 * Extracted from route.ts to comply with API route 300-line limit.
 * Contains: handleUpdateProject, handleDeleteProject
 *
 * @module api/projects/[projectId]/project-mutations.service
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { AuthContext } from '@/lib/auth';
import { logAuditEvent } from '@/lib/auth';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';
import { createModuleLogger } from '@/lib/telemetry';
import { softDelete } from '@/lib/firestore/soft-delete-engine';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { getErrorMessage } from '@/lib/error-utils';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { PROJECT_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { ProjectUpdateSchema, CACHE_KEY_PREFIX } from './project-mutations.types';
import type {
  ProjectUpdateResponse,
  ProjectDeleteResponse,
} from './project-mutations.types';

const logger = createModuleLogger('ProjectRoute');

export async function handleUpdateProject(
  request: NextRequest,
  ctx: AuthContext,
  projectId: string
): Promise<ReturnType<typeof apiSuccess<ProjectUpdateResponse>>> {
  const startTime = Date.now();

  logger.info('[Projects/Update] User updating project', { email: ctx.email, projectId });

  // 1. Parse request body (SPEC-256A: extract _v for version check)
  const parsed = safeParseBody(ProjectUpdateSchema, await request.json());
  if (parsed.error) throw new ApiError(400, 'Validation failed');
  const { _v: expectedVersion, ...body } = parsed.data;

  if (!body || Object.keys(body).length === 0) {
    throw new ApiError(400, 'No update fields provided');
  }

  // 2. Get project document and verify ownership (tenant isolation)
  const projectRef = getAdminFirestore().collection(COLLECTIONS.PROJECTS).doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    logger.info('[Projects/Update] Project not found', { projectId });
    throw new ApiError(404, 'Project not found');
  }

  const projectData = projectDoc.data();

  // 3. Validate tenant isolation
  const isSuperAdmin = isRoleBypass(ctx.globalRole);
  if (!isSuperAdmin) {
    if (!projectData?.companyId || projectData.companyId !== ctx.companyId) {
      logger.warn('[Projects/Update] TENANT ISOLATION VIOLATION', { uid: ctx.uid, userCompanyId: ctx.companyId, projectId, projectCompanyId: projectData?.companyId });
      throw new ApiError(403, 'Access denied - Project not found');
    }
  } else if (projectData?.companyId !== ctx.companyId) {
    logger.info('[SUPER_ADMIN] Cross-tenant project update', { email: ctx.email, projectId, projectCompanyId: projectData?.companyId });
  }

  // 4. Build update payload (companyId is IMMUTABLE — ADR-232)
  const { companyId: _immutableCompanyId, ...safeBody } = body;
  const cleanData = stripUndefinedDeep({ ...safeBody } as Record<string, unknown>);

  logger.info('[Projects/Update] Updating fields', { fieldsCount: Object.keys(cleanData).length });

  // 5. SPEC-256A: Version-checked write
  const versionResult = await withVersionCheck({
    db: getAdminFirestore(),
    collection: COLLECTIONS.PROJECTS,
    docId: projectId,
    expectedVersion,
    updates: cleanData,
    userId: ctx.uid,
  });

  const duration = Date.now() - startTime;
  logger.info('[Projects/Update] Project updated successfully', { projectId, durationMs: duration });

  // 6. Invalidate caches
  const cache = EnterpriseAPICache.getInstance();
  cache.delete(`${CACHE_KEY_PREFIX}:${ctx.companyId}`);
  cache.delete(`${CACHE_KEY_PREFIX}:all`);

  // 7. ADR-239: Centralized linking
  if ('linkedCompanyId' in body) {
    linkEntity('project:linkedCompanyId', {
      auth: ctx,
      entityId: projectId,
      newLinkValue: (body.linkedCompanyId as string) ?? null,
      existingDoc: (projectData ?? {}) as Record<string, unknown>,
      apiPath: '/api/projects/[projectId] (PATCH)',
    }).catch((err) => {
      logger.warn('[Projects/Update] linkEntity failed (non-blocking)', { projectId, error: getErrorMessage(err) });
    });
  }

  // 8. ADR-195 — Entity audit trail (powers per-project History tab).
  // Canonical no-op filter: `diffFields` compares against PROJECT_TRACKED_FIELDS
  // whitelist and drops fields that haven't actually changed, so form autosaves
  // that PATCH the full payload don't produce ghost "— → —" entries.
  const projectCompanyId = (projectData?.companyId as string | undefined) ?? ctx.companyId;
  const auditChanges = EntityAuditService.diffFields(
    (projectData ?? {}) as Record<string, unknown>,
    cleanData,
    PROJECT_TRACKED_FIELDS,
  );

  if (auditChanges.length > 0) {
    await EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.PROJECT,
      entityId: projectId,
      entityName: (projectData?.name as string | undefined) ?? projectId,
      action: 'updated',
      changes: auditChanges,
      performedBy: ctx.uid,
      performedByName: ctx.email,
      companyId: projectCompanyId,
    });
  }

  // 9. Legacy audit log
  await logAuditEvent(ctx, 'data_updated', 'projects', 'api', {
    newValue: {
      type: 'status',
      value: { projectId, projectName: projectData?.name, fieldsUpdated: Object.keys(cleanData), duration },
    },
    metadata: { reason: 'Project updated' },
  });

  return apiSuccess<ProjectUpdateResponse>(
    { projectId, updated: true, _v: versionResult.newVersion },
    `Project updated successfully in ${duration}ms`
  );
}

export async function handleDeleteProject(
  _request: NextRequest,
  ctx: AuthContext,
  projectId: string
): Promise<ReturnType<typeof apiSuccess<ProjectDeleteResponse>>> {
  const startTime = Date.now();
  const db = getAdminFirestore();

  logger.info('[Projects/Delete] User deleting project (bottom-up BLOCK guard)', { email: ctx.email, projectId });

  // 1. Get project and verify ownership
  const projectRef = db.collection(COLLECTIONS.PROJECTS).doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new ApiError(404, 'Project not found');
  }

  const projectData = projectDoc.data();

  // 2. Tenant isolation
  const isSuperAdmin = isRoleBypass(ctx.globalRole);
  if (!isSuperAdmin && projectData?.companyId !== ctx.companyId) {
    logger.warn('[Projects/Delete] TENANT ISOLATION VIOLATION', { uid: ctx.uid, userCompanyId: ctx.companyId, projectId, projectCompanyId: projectData?.companyId });
    throw new ApiError(403, 'Access denied - Project not found');
  }

  // 3. ADR-281: Soft-delete — move to trash (status='deleted')
  //    Super admin bypasses engine-level tenant check (route-level guard above already validated)
  await softDelete(db, 'project', projectId, ctx.uid, ctx.companyId, ctx.email ?? undefined, isSuperAdmin);

  const duration = Date.now() - startTime;
  logger.info('[Projects/Delete] Project moved to trash', { projectId, durationMs: duration });

  // 4. Invalidate caches
  const cache = EnterpriseAPICache.getInstance();
  cache.delete(`${CACHE_KEY_PREFIX}:${ctx.companyId}`);
  cache.delete(`${CACHE_KEY_PREFIX}:all`);

  // 5. ADR-195 — Entity audit trail (soft-delete is recorded as `deleted` action)
  const deleteCompanyId = (projectData?.companyId as string | undefined) ?? ctx.companyId;
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.PROJECT,
    entityId: projectId,
    entityName: (projectData?.name as string | undefined) ?? projectId,
    action: 'deleted',
    changes: [
      {
        field: 'status',
        oldValue: (projectData?.status as string | undefined) ?? null,
        newValue: 'deleted',
        label: 'Κατάσταση',
      },
    ],
    performedBy: ctx.uid,
    performedByName: ctx.email,
    companyId: deleteCompanyId,
  });

  // 6. Legacy audit log
  await logAuditEvent(ctx, 'data_deleted', 'projects', 'api', {
    newValue: {
      type: 'status',
      value: { projectId, projectName: projectData?.name, deleteType: 'soft', duration },
    },
    metadata: { reason: 'Project moved to trash via API' },
  });

  return apiSuccess<ProjectDeleteResponse>(
    { projectId, deleted: true },
    `Project moved to trash in ${duration}ms`
  );
}

export { ConflictError };
