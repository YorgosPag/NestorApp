/**
 * GET /api/audit-trail/[entityType]/[entityId]
 *
 * Paginated audit trail for a specific entity.
 * Returns field-level change history (newest first).
 *
 * 🔑 ADR-864 Φ1β — **ΔΥΟ ΒΙΒΛΙΑ, ΜΙΑ ΠΟΡΤΑ.** Ο αναγνώστης ζητά βιβλίο με `?ledger=`:
 *   · απουσία / `company` ⇒ `companyId == ctx.companyId` — **ταυτόσημο** με πριν, μόνο για
 *     δρώντα με οργανισμό (ο πολίτης παίρνει 403 όπως έπαιρνε 401).
 *   · `personal` ⇒ διαμέρισμα `entity_audit_trail_personal`, `userId == ctx.uid` — ο πολίτης
 *     **και** το μέλος εταιρείας διαβάζουν το **δικό τους** προσωπικό βιβλίο. Η τιμή του φίλτρου **δεν** έρχεται ποτέ από το αίτημα
 *     (`lib/audit/audit-ledger-query.ts`).
 *
 * @module api/audit-trail/[entityType]/[entityId]
 * @permission Authenticated users — company ledger: same company · personal ledger: self only
 * @rateLimit STANDARD (60 req/min)
 * @enterprise ADR-195 — Entity Audit Trail · ADR-864 Φ1β — Personal ledger
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { AUDIT_ENTITY_TYPES } from '@/config/audit-entity-collection-map';
import { ApiError, apiErrorHandler, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import {
  AUDIT_LEDGER_COLLECTION,
  AUDIT_LEDGER_PARAM,
  auditLedgerKindFromParam,
} from '@/lib/audit/audit-ledger';
import { auditLedgerFilter } from '@/lib/audit/audit-ledger-query';
import { entityAuditEntriesFromData } from '@/lib/audit/audit-entry-from-document';
import type { ApiErrorResponse } from '@/lib/api/api-error-types';
import type { EntityAuditResponse } from '@/types/audit-trail';

type AdminDb = ReturnType<typeof requireAdminFirestore>;

// ============================================================================
// QUERY
// ============================================================================

interface PageRequest {
  readonly entityType: string;
  readonly entityId: string;
  readonly limit: number;
  readonly startAfter: string | undefined;
  readonly actor: ApiActor;
  readonly ledgerParam: string | null;
}

/**
 * Το ερώτημα μιας σελίδας — το φίλτρο εμβέλειας το αποφασίζει **μόνο** η `auditLedgerFilter`.
 */
async function queryPage(db: AdminDb, page: PageRequest) {
  const kind = auditLedgerKindFromParam(page.ledgerParam);
  if (kind === null) throw new ApiError(400, `Invalid ${AUDIT_LEDGER_PARAM}`);

  const filter = auditLedgerFilter(page.actor, kind);
  if (filter === null) throw new ApiError(403, 'Company ledger requires an organization');

  // tenant-scope-exempt: το διαμέρισμα ΚΑΙ το φίλτρο εμβέλειας (`companyId` στο εταιρικό,
  // `userId` στο προσωπικό) τα αποφασίζουν `AUDIT_LEDGER_COLLECTION` + `auditLedgerFilter`, με
  // τιμή από την ταυτότητα του δρώντος — ποτέ από το αίτημα (ADR-864 Φ1β · ADR-787 Ε-3 §8).
  const collection = COLLECTIONS[AUDIT_LEDGER_COLLECTION[kind]];
  let q = db
    .collection(collection)
    .where(FIELDS.ENTITY_TYPE, '==', page.entityType)
    .where(FIELDS.ENTITY_ID, '==', page.entityId)
    .where(filter.field, '==', filter.value)
    .orderBy('timestamp', 'desc')
    .limit(page.limit + 1); // Fetch one extra to determine hasMore

  if (page.startAfter) {
    const cursorDoc = await db.collection(collection).doc(page.startAfter).get();
    if (cursorDoc.exists) q = q.startAfter(cursorDoc);
  }

  return q.get();
}

async function readAuditPage(request: NextRequest, actor: ApiActor): Promise<EntityAuditResponse> {
  const { entityType, entityId } = extractParamsFromUrl(request.url);

  if (!entityType || !AUDIT_ENTITY_TYPES.has(entityType)) {
    throw new ApiError(400, 'Invalid entity type');
  }
  if (!entityId) {
    throw new ApiError(400, 'Entity ID is required');
  }

  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(Math.max(limitParam, 1), 100); // Clamp 1-100

  const snapshot = await queryPage(requireAdminFirestore(), {
    entityType,
    entityId,
    limit,
    startAfter: url.searchParams.get('startAfter') ?? undefined,
    actor,
    ledgerParam: url.searchParams.get(AUDIT_LEDGER_PARAM),
  });

  const docs = snapshot.docs;
  const hasMore = docs.length > limit;
  const resultDocs = hasMore ? docs.slice(0, limit) : docs;

  return {
    entries: entityAuditEntriesFromData(resultDocs.map((doc) => ({ id: doc.id, data: doc.data() }))),
    hasMore,
    ...(hasMore && resultDocs.length > 0 ? { nextCursor: resultDocs[resultDocs.length - 1].id } : {}),
  };
}

// ============================================================================
// GET — Paginated Audit Trail
// ============================================================================

async function handler(
  request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<ApiSuccessResponse<EntityAuditResponse> | ApiErrorResponse>> {
  try {
    return apiSuccess(await readAuditPage(request, actor), 'Audit trail retrieved');
  } catch (error) {
    // ⚠️ Το `withPersonalOrOrgAuth` δεν χαρτογραφεί σφάλματα (σε αντίθεση με το `withAuth`)
    //    ⇒ η **ίδια** κεντρική χαρτογράφηση, ρητά.
    return apiErrorHandler.handleError(error, request, {
      operation: request.nextUrl.pathname,
      userId: actor.ctx.uid,
      endpoint: request.nextUrl.pathname,
    });
  }
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(handler));

// ============================================================================
// HELPERS
// ============================================================================

function extractParamsFromUrl(url: string): { entityType: string | null; entityId: string | null } {
  const segments = new URL(url).pathname.split('/');
  // /api/audit-trail/[entityType]/[entityId]
  // segments: ['', 'api', 'audit-trail', entityType, entityId]
  const auditTrailIdx = segments.indexOf('audit-trail');
  if (auditTrailIdx === -1 || auditTrailIdx + 2 >= segments.length) {
    return { entityType: null, entityId: null };
  }
  return {
    entityType: segments[auditTrailIdx + 1] || null,
    entityId: segments[auditTrailIdx + 2] || null,
  };
}
