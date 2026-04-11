/**
 * 🏗️ PROJECT CREATE HANDLER (POST /api/projects/list)
 *
 * Extracted from route.ts to keep the list route within Google SRP size
 * limits (API ≤300 lines). Contains the POST handler for creating a
 * single project via Admin SDK with ADR-284 Layer 0 policy enforcement.
 *
 * @module api/projects/list/project-create.handler
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';
import { FieldValue } from 'firebase-admin/firestore';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { generateProjectId, generateNavigationId } from '@/services/enterprise-id.service';
import { projectCodeService, type FirestoreDatabase } from '@/services/project-code.service';
import { isRoleBypass } from '@/lib/auth/roles';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import {
  assertProjectCreatePolicy,
  assertLinkedCompanyExists,
  ProjectMutationPolicyError,
} from '@/services/projects/project-mutation-policy';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';

const logger = createModuleLogger('ProjectsCreateRoute');

const CACHE_KEY_PREFIX = 'api:projects:list';

interface ProjectCreatePayload {
  name: string;
  title?: string;
  description?: string;
  status?: string;
  companyId: string;
  company?: string;
  address?: string;
  city?: string;
  /** 🏢 ADR-232: Business entity link */
  linkedCompanyId?: string | null;
}

interface ProjectCreateResponse {
  projectId: string;
  project: ProjectCreatePayload & { id: string };
}

/**
 * 🎯 ENTERPRISE: Create new project via Admin SDK
 *
 * 🔒 SECURITY: Firestore rules block client-side writes (allow write: if false)
 *              This endpoint uses Admin SDK to bypass rules with proper auth
 * @permission projects:projects:create
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const POST = withHighRateLimit(
  withAuth<ApiSuccessResponse<ProjectCreateResponse>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        // 🏢 ENTERPRISE: Parse request body (with diagnostics)
        const rawText = await req.text();
        if (!rawText) {
          logger.warn('[Projects] Empty request body received', {
            contentType: req.headers.get('content-type'),
            contentLength: req.headers.get('content-length'),
            method: req.method,
          });
          throw new ApiError(400, 'Empty request body — expected JSON payload', 'EMPTY_BODY');
        }
        let body: ProjectCreatePayload;
        try {
          body = JSON.parse(rawText) as ProjectCreatePayload;
        } catch {
          logger.warn('[Projects] Malformed JSON body', {
            preview: rawText.slice(0, 120),
            contentType: req.headers.get('content-type'),
          });
          throw new ApiError(400, 'Malformed JSON in request body', 'MALFORMED_JSON');
        }

        // 🏢 ADR-284 §3.0: Layer 0 — Project Creation Policy
        // Enforce name + linkedCompanyId BEFORE any Firestore writes.
        assertProjectCreatePolicy(body as unknown as Record<string, unknown>);

        // 🏢 ENTERPRISE: ALL users (including super_admin) get companyId
        // Super admin inherits from linkedCompanyId (the company entity this project belongs to)
        const isSuperAdmin = isRoleBypass(ctx.globalRole);
        const resolvedCompanyId = isSuperAdmin
          ? (body.linkedCompanyId ?? ctx.companyId)
          : ctx.companyId;

        // 🏢 ADR-284 §3.0: Verify linkedCompanyId points to an existing company contact.
        // Reuses the same fetch to resolve the display name for the audit trail
        // (ADR-195 — audit entries store human-readable snapshots, not raw IDs).
        const adminDb = getAdminFirestore();
        const { companyName: linkedCompanyName } = await assertLinkedCompanyExists(
          adminDb,
          body.linkedCompanyId as string,
        );

        const sanitizedData = {
          ...body,
          companyId: resolvedCompanyId,
          linkedCompanyId: body.linkedCompanyId ?? null,
          progress: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: ctx.uid,
        };

        // 🏢 ENTERPRISE: Remove undefined fields (Firestore doesn't accept undefined)
        const cleanData = Object.fromEntries(
          Object.entries(sanitizedData).filter(([, value]) => value !== undefined)
        );

        logger.info('[Projects] Creating new project for tenant', { companyId: ctx.companyId });

        // 🏗️ ADR-210: Enterprise ID + sequential projectCode (PRJ-001, PRJ-002, ...)
        const projectId = generateProjectId();
        // Admin SDK Firestore is structurally compatible with FirestoreDatabase at runtime
        const { code: projectCode } = await projectCodeService.generateNextCode(adminDb as unknown as FirestoreDatabase);

        await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).set({
          ...cleanData,
          projectCode,
        });

        logger.info('[Projects] Project created', { projectId, projectCode });

        // 📜 ADR-195: Entity audit trail (powers the project History tab)
        await EntityAuditService.recordChange({
          entityType: ENTITY_TYPES.PROJECT,
          entityId: projectId,
          entityName: body.name,
          action: 'created',
          changes: [
            { field: 'name', oldValue: null, newValue: body.name, label: 'Όνομα' },
            { field: 'projectCode', oldValue: null, newValue: projectCode, label: 'Κωδικός Έργου' },
            {
              field: 'linkedCompanyId',
              oldValue: null,
              newValue: linkedCompanyName,
              label: 'Συνδεδεμένη Εταιρεία',
            },
          ],
          performedBy: ctx.uid,
          performedByName: ctx.email,
          companyId: resolvedCompanyId,
        });

        // 📊 Audit log
        await logAuditEvent(ctx, 'data_created', 'projects', 'api', {
          newValue: {
            type: 'project_create',
            value: {
              projectId,
              projectCode,
              projectName: body.name,
            },
          },
          metadata: { reason: 'Project created' },
        });

        // 🏢 AUTO-REGISTER: Ensure company exists in navigation_companies
        // Skip for super admin (companyId is null)
        if (!isSuperAdmin && ctx.companyId) {
          const navQuery = await adminDb
            .collection(COLLECTIONS.NAVIGATION)
            .where(FIELDS.CONTACT_ID, '==', ctx.companyId)
            .limit(1)
            .get();

          if (navQuery.empty) {
            const navId = generateNavigationId();
            await adminDb.collection(COLLECTIONS.NAVIGATION).doc(navId).set({
              contactId: ctx.companyId,
              addedAt: FieldValue.serverTimestamp(),
              addedBy: ctx.uid,
              source: 'auto_project_create',
            });
            logger.info('[Projects] Auto-registered company in navigation', { companyId: ctx.companyId, navId });
          }
        }

        // 🔄 Invalidate cache for this tenant
        const cache = EnterpriseAPICache.getInstance();
        cache.delete(`${CACHE_KEY_PREFIX}:${ctx.companyId}`);
        cache.delete(`${CACHE_KEY_PREFIX}:all`);

        return apiSuccess<ProjectCreateResponse>(
          {
            projectId,
            project: { ...body, id: projectId }
          },
          'Project created successfully'
        );

      } catch (error) {
        // 🏢 ADR-284: Policy violations → 400 Bad Request (with stable code)
        if (error instanceof ProjectMutationPolicyError) {
          logger.warn('[Projects] Policy violation on create', { error: error.message, code: error.code });
          throw new ApiError(400, error.message, error.code);
        }
        logger.error('[Projects] Error creating project', { error });
        throw new ApiError(500, getErrorMessage(error, 'Failed to create project'));
      }
    },
    { permissions: 'projects:projects:create' }
  )
);
