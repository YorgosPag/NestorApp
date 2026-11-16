/**
 * @fileoverview `GET /api/document-registry/issuance-assignments/document-requests` — **«Έγγραφα που ζήτησε ο μηχανικός»**
 *   στο πάνελ της ανάθεσης του γραφείου (ADR-942 Φ1).
 * @related services/document-registry/issuance-document-request-panel.server.ts (η ΜΙΑ συναρμολόγηση, ίδια με του μηχανικού)
 *
 * GET ?propertyId&documentKind → `{ panel, upload: { entityType, entityId } }`
 *   - ο θεατής είναι ο **οικοδεσπότης** (χώρος): βλέπει ό,τι του ζητήθηκε (Α31) και τι υπάρχει ήδη στον φάκελο
 *   - `upload` = το δοχείο του **κατόχου** (Ε2) — εκεί και μόνο εκεί ανεβάζει η οθόνη
 *   - ανάθεση ξένη/ανύπαρκτη, είδος χωρίς κατάλογο ή ακίνητο που δεν κατέχει πια το γραφείο ⇒ 404 · «δεν ξέρω» ⇒ 503
 *
 * Δικαίωμα: όποιος βλέπει το μητρώο (ίδιο με το `GET /api/document-registry`) — το ανέβασμα κρίνεται από τον αγωγό αρχείων.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { issuanceAssignmentIdOf } from '@/services/document-registry/issuance-assignment-schema';
import { issuanceRequestPanelWithContainer } from '@/services/document-registry/issuance-document-request-panel.server';
import { readHostedIssuanceAssignment } from '@/services/document-registry/issuance-engagement-host-adapter';

const query = z.object({
  propertyId: z.string().trim().min(1).max(128),
  documentKind: z.enum(DOCUMENT_KINDS),
});

async function documentRequestsHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) throw new ApiError(400, 'Invalid query', 'VALIDATION_ERROR');
  const db = getAdminFirestore();
  const { propertyId, documentKind } = parsed.data;
  const assignment = await readHostedIssuanceAssignment(db, ctx.companyId, issuanceAssignmentIdOf(ctx.companyId, propertyId, documentKind));
  if (!assignment) throw new ApiError(404, 'Issuance assignment not found', 'NOT_FOUND');
  const result = await issuanceRequestPanelWithContainer(db, { assignment, viewer: { role: 'host', uid: ctx.uid }, nowMs: Date.now() });
  if (result === 'unknown') throw new ApiError(503, 'Document requests could not be read', 'UNAVAILABLE');
  if (result === null) throw new ApiError(404, 'No document requests for this assignment', 'NOT_FOUND');
  return apiSuccess({ panel: result.panel, upload: { entityType: result.container.entityType, entityId: result.container.entityId } });
}

export const GET = withStandardRateLimit(withAuth(documentRequestsHandler));
