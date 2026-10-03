/**
 * ADR-901 Φ1 — κοινά των routes της υπόθεσης μεταβίβασης: εξουσιοδότηση ανά ακίνητο και
 * μετάφραση αποτυχίας υπηρεσίας → HTTP. **Ένα** σημείο, ώστε GET/POST/PATCH να μη διαφωνούν.
 *
 * Η εξουσιοδότηση ελέγχεται **μετά** τον έλεγχο μισθωτή και **με το έργο του ακινήτου**:
 * ο `project_manager` είναι ρόλος έργου και κρίνεται μόνο με `projectId`.
 *
 * @module api/conveyance-cases/_shared/conveyance-route-support
 */

import 'server-only';

import type { AuthContext, PermissionCache } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/permissions';
import type { PermissionId } from '@/lib/auth/types';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import type { Firestore } from 'firebase-admin/firestore';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { readOwnedConveyanceCase } from '@/services/conveyance/conveyance-case.service';
import type { ConveyanceActor, ConveyanceFailure } from '@/services/conveyance/conveyance-case.service';
import type { ConveyanceCase } from '@/types/conveyance-case';

export const CONVEYANCE_VIEW: PermissionId = 'legal:conveyance:view';
export const CONVEYANCE_MANAGE: PermissionId = 'legal:conveyance:manage';

/** Μισθωτής + δικαίωμα για το συγκεκριμένο ακίνητο — αλλιώς ρίχνει (404 ξένου μισθωτή / 403). */
export async function authorizeForProperty(params: {
  readonly ctx: AuthContext;
  readonly cache: PermissionCache;
  readonly propertyId: string;
  readonly permission: PermissionId;
  readonly path: string;
}): Promise<void> {
  const property = await requirePropertyInTenantScope({ ctx: params.ctx, propertyId: params.propertyId, path: params.path });
  const options = property.projectId ? { projectId: property.projectId } : {};
  if (!(await hasPermission(params.ctx, params.permission, options, params.cache))) {
    throw new ApiError(403, 'Insufficient permissions', 'FORBIDDEN');
  }
}

export function actorOf(ctx: AuthContext): ConveyanceActor {
  return { uid: ctx.uid, email: ctx.email ?? null, companyId: ctx.companyId };
}

/**
 * Η υπόθεση **του χώρου**, εξουσιοδοτημένη για το ακίνητό της — αλλιώς ρίχνει (404 ανύπαρκτη/ξένη · 403).
 * Η **μία** σειρά «ανάγνωση με κάτοχο → δικαίωμα με το έργο του ακινήτου» για τα routes του οικοδεσπότη (Φ4.4/Φ4.5).
 */
export async function readAuthorizedCase(params: {
  readonly ctx: AuthContext;
  readonly cache: PermissionCache;
  readonly caseId: string;
  readonly permission: PermissionId;
  readonly path: string;
}): Promise<{ readonly db: Firestore; readonly actor: ConveyanceActor; readonly record: ConveyanceCase }> {
  const db = requireAdminFirestore();
  const actor = actorOf(params.ctx);
  const record = await readOwnedConveyanceCase(db, actor, params.caseId);
  if (!record) throw failureToApiError({ kind: 'case_not_found' });
  const { ctx, cache, permission, path } = params;
  await authorizeForProperty({ ctx, cache, propertyId: record.subject.propertyId, permission, path });
  return { db, actor, record };
}

/** Η μία μετάφραση αποτυχίας → HTTP. */
export function failureToApiError(failure: ConveyanceFailure): ApiError {
  switch (failure.kind) {
    case 'property_not_found': return new ApiError(404, 'Property not found', 'NOT_FOUND');
    case 'case_not_found': return new ApiError(404, 'Conveyance case not found', 'NOT_FOUND');
    case 'corrupt_case': return new ApiError(500, 'Conveyance case has an invalid shape', 'INTERNAL_ERROR');
    case 'version_conflict': return new ApiError(409, 'Conveyance case changed — reload and retry', 'CONFLICT');
    case 'rejected':
      return failure.rejection === 'not_editable'
        ? new ApiError(409, 'Conveyance case is read-only', 'CONFLICT')
        : new ApiError(422, `Command rejected: ${failure.rejection}`, 'VALIDATION_ERROR');
  }
}
