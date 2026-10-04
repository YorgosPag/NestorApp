/**
 * Project Mutation Service — Update & Delete business logic
 *
 * Extracted from route.ts to comply with API route 300-line limit.
 * Contains: handleUpdateProject, handleDeleteProject
 *
 * @module api/projects/[projectId]/project-mutations.service
 */

import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { AuthContext } from '@/lib/auth';
import { logAuditEvent } from '@/lib/auth';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { softDelete } from '@/lib/firestore/soft-delete-engine';
import { checkDeletionDependencies } from '@/lib/firestore/deletion-guard';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { getErrorMessage } from '@/lib/error-utils';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import { EntityAuditService, resolveUserDisplayName } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { PROJECT_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { loadOwnedProject } from '../_shared/project-owned-doc';
import { invalidateProjectCaches } from '../_shared/project-cache';
import { ProjectUpdateSchema } from './project-mutations.types';
import { republishProjectListings } from '@/services/listings/address-place-writeback';
import { resolveAddressesForWrite } from '../_shared/project-address-write';
import type {
  ProjectUpdateResponse,
  ProjectDeleteResponse,
} from './project-mutations.types';
import type { ProjectAddress } from '@/types/project/addresses';

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
  //    ADR-742 §7sexies — φόρτωση + «υπάρχει;» + «δικό μου;» σε **μία** κλήση. Ήταν
  //    χειρόγραφο αντίγραφο της αλυσίδας, και γι' αυτό **έχασε** τον έλεγχο ταυτότητας
  //    που δεν μπορεί να υπάρξει (`__new__` ⇒ `INVALID_ARGUMENT` ⇒ 500, 2026-10-04).
  const { data: projectData } = await loadOwnedProject({ projectId, caller: ctx, action: 'update' });

  // 3β. **Η ΘΕΣΗ ΠΡΙΝ ΤΗ ΓΡΑΦΗ** (ADR-777 Α5) — δες `resolveAddressesForWrite`.
  const positionAdvisories = await resolveAddressesForWrite(body as Record<string, unknown>, projectData);

  // 4. Build update payload (companyId is IMMUTABLE — ADR-232)
  const { companyId: _immutableCompanyId, ...safeBody } = body;
  const cleanData = stripUndefinedDeep({ ...safeBody } as Record<string, unknown>);
  cleanData._lastModifiedAt = FieldValue.serverTimestamp();
  cleanData._lastModifiedBy = ctx.uid;
  cleanData._lastModifiedByName = await resolveUserDisplayName(ctx.uid, ctx.email ?? null);

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
  invalidateProjectCaches(ctx.companyId);

  // 6β. **Ο ΚΡΙΚΟΣ ΠΟΥ ΕΛΕΙΠΕ** (ADR-777 Α1): η θέση ζει στο **έργο**, οπότε μια
  // διόρθωση διεύθυνσης αλλάζει τον χάρτη για **κάθε** αγγελία του. Χωρίς αυτό, όλες
  // έμεναν με την παλιά θέση — **σιωπηλά**, ακριβώς όπως προειδοποιεί το σχόλιο του
  // `republishListingsForProject`, που μέχρι σήμερα **δεν το καλούσε κανείς**.
  if ('addresses' in body) {
    await republishProjectListings(getAdminFirestore(), projectId);
  }

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
  // ADR-195 enterprise policy: `linkedCompanyId` is a foreign key. Keep the
  // canonical contact id in the change value and resolve the company name into
  // `*Label` (id-in-value + name-in-label) so the History tab shows the company
  // name instead of the raw `comp_…` id, mirroring the create path.
  const auditChanges = await EntityAuditService.diffFieldsWithResolution(
    (projectData ?? {}) as Record<string, unknown>,
    cleanData,
    PROJECT_TRACKED_FIELDS,
    {
      linkedCompanyId: async (id) => {
        if (!id || typeof id !== 'string') return null;
        const snap = await getAdminFirestore().collection(COLLECTIONS.CONTACTS).doc(id).get();
        if (!snap.exists) return null;
        const name = snap.data()?.companyName;
        return typeof name === 'string' && name.trim() ? name.trim() : null;
      },
    },
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

  // ADR-029 Phase D: search_documents written by Cloud Function onProjectWrite.

  // ADR-332 D27 Βήμα Β (Β5): επιστρέφεται ό,τι ΓΡΑΦΤΗΚΕ — ο πελάτης το υιοθετεί.
  const writtenAddresses = Array.isArray(cleanData.addresses)
    ? { addresses: cleanData.addresses as ProjectAddress[] }
    : {};

  return apiSuccess<ProjectUpdateResponse>(
    {
      projectId,
      updated: true,
      _v: versionResult.newVersion,
      ...writtenAddresses,
      ...(positionAdvisories.length > 0 ? { positionAdvisories: [...positionAdvisories] } : {}),
    },
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
  //    ADR-742 §7sexies — ο ένας φορτωτής (ίδιο εργοστάσιο για «δεν υπάρχει» και «όχι δικό σου»).
  const { data: projectData } = await loadOwnedProject({ projectId, caller: ctx, action: 'delete', db });

  // Ξεχωριστή ερώτηση από την ιδιοκτησία: **προνόμιο**, όχι κυριότητα. Ρυθμίζει
  // τον έλεγχο εξαρτήσεων και τον φύλακα tenant της μηχανής διαγραφής — γι' αυτό
  // μένει ρητή εδώ αντί να παραχθεί από την ετυμηγορία του φύλακα.
  const isSuperAdmin = isRoleBypass(ctx.globalRole);

  // 3. Server-side dependency check (defense-in-depth: client guard may be bypassed via direct API calls)
  //    Super admin may skip this check (administrative override).
  if (!isSuperAdmin) {
    const depCheck = await checkDeletionDependencies(db, 'project', projectId, ctx.companyId);
    if (!depCheck.allowed) {
      const depList = depCheck.dependencies
        .map((d) => d.count > 0 ? `${d.label} (${d.count})` : d.label)
        .join(', ');
      logger.warn('[Projects/Delete] Blocked — active dependencies exist', { projectId, dependencies: depList });
      throw new ApiError(
        409,
        `Η διαγραφή αποκλείεται. Εξαρτήσεις: ${depList}. Διαγράψτε τες πρώτα.`,
        'HAS_DEPENDENCIES'
      );
    }
  }

  // 4. ADR-281: Soft-delete — move to trash (status='deleted')
  //    Super admin bypasses engine-level tenant check (route-level guard above already validated)
  await softDelete(db, 'project', projectId, ctx.uid, ctx.companyId, ctx.email ?? undefined, isSuperAdmin);

  const duration = Date.now() - startTime;
  logger.info('[Projects/Delete] Project moved to trash', { projectId, durationMs: duration });

  // 5. Invalidate caches
  invalidateProjectCaches(ctx.companyId);

  // 6. Legacy auth audit log (soft-delete engine handles entity audit — ADR-281 SSoT)
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
