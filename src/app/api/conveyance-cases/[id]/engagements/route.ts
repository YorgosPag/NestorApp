/**
 * ADR-901 Φ2 · ADR-862 Φ1 — Οι θέσεις επαγγελματιών μιας υπόθεσης μεταβίβασης (ο ΟΙΚΟΔΕΣΠΟΤΗΣ).
 *
 * GET  /api/conveyance-cases/{id}/engagements  → οι τρεις θέσεις (ορισμός · λογαριασμός · συμμετοχή)
 * POST /api/conveyance-cases/{id}/engagements { role, attestedBasis? } → **πρόταση** πρόσβασης
 *      - ιδεμποτής: ίδιος άνθρωπος, ίδια θέση ⇒ 200 χωρίς νέα εγγραφή · νέα ⇒ 201
 *      - ADR-901 Φ3: επαγγελματίας **χωρίς λογαριασμό** ⇒ **πρόσκληση με email** (201, `invited` = έκβαση αποστολής)·
 *        ξανά POST = **επαναποστολή** (νέο token/λήξη, η παλιά ανακαλείται). Όριο ρυθμού **SENSITIVE**: στέλνει email.
 *      - ονομασμένες αρνήσεις ⇒ 409/422 με `rejection` (ποτέ σιωπή: «χρειάζεται πρόσκληση» ≠ «δεν ορίστηκε»)
 *
 * Δικαιώματα: `legal:conveyance:view` (GET) · `legal:conveyance:manage` (POST), με το έργο του ακινήτου.
 * Ξένη υπόθεση ≡ ανύπαρκτη (404, ADR-742).
 *
 * @module api/conveyance-cases/[id]/engagements
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { ATTESTABLE_BASES } from '@/lib/conveyance/engagement-consent';
import { LEGAL_ENGAGEMENT_ROLES } from '@/types/engagement';
import { readOwnedConveyanceCase } from '@/services/conveyance/conveyance-case.service';
import {
  listCaseProfessionalSlots,
  offerCaseEngagement,
  type CaseOfferRejection,
} from '@/services/conveyance/conveyance-engagement-host.service';
import {
  actorOf,
  authorizeForProperty,
  CONVEYANCE_MANAGE,
  CONVEYANCE_VIEW,
  failureToApiError,
} from '../../_shared/conveyance-route-support';

const PATH = '/api/conveyance-cases/[id]/engagements';

type Segment = { params: Promise<{ id: string }> };

const offerSchema = z.object({
  role: z.enum(LEGAL_ENGAGEMENT_ROLES),
  attestedBasis: z.enum(ATTESTABLE_BASES).nullable().optional(),
});

/** Η μία μετάφραση άρνησης → HTTP: «κατάσταση που εμποδίζει» = 409 · «λείπει στοιχείο του αιτήματος» = 422. */
const REJECTION_STATUS: Readonly<Record<CaseOfferRejection, 409 | 422>> = {
  'case-closed': 409,
  'no-project': 409,
  'not-appointed': 409,
  'no-email': 409,
  'slot-occupied': 409,
  'role-conflict': 409,
  unreadable: 409,
  'consent-basis-required': 422,
};

async function loadAuthorized(ctx: AuthContext, cache: PermissionCache, id: string, permission: typeof CONVEYANCE_VIEW) {
  const record = await readOwnedConveyanceCase(requireAdminFirestore(), actorOf(ctx), id);
  if (!record) throw failureToApiError({ kind: 'case_not_found' });
  await authorizeForProperty({ ctx, cache, propertyId: record.subject.propertyId, permission, path: PATH });
  return record;
}

export const GET = withStandardRateLimit(
  withAuth(async (_request: NextRequest, ctx: AuthContext, cache: PermissionCache, segmentData?: Segment) => {
    const { id } = await segmentData!.params;
    const record = await loadAuthorized(ctx, cache, id, CONVEYANCE_VIEW);
    return apiSuccess({ slots: await listCaseProfessionalSlots(requireAdminFirestore(), record) });
  }),
);

export const POST = withSensitiveRateLimit(
  withAuth(async (request: NextRequest, ctx: AuthContext, cache: PermissionCache, segmentData?: Segment) => {
    const { id } = await segmentData!.params;
    const parsed = safeParseBody(offerSchema, await request.json());
    if (parsed.error) return parsed.error;
    const record = await loadAuthorized(ctx, cache, id, CONVEYANCE_MANAGE);

    const outcome = await offerCaseEngagement(requireAdminFirestore(), actorOf(ctx), record, {
      role: parsed.data.role,
      attestedBasis: parsed.data.attestedBasis ?? null,
      nowMs: Date.now(),
    });
    if (!outcome.ok) {
      // Ίδιο σχήμα άρνησης με τα `/api/engagements/*`: ο πελάτης διαβάζει τον λόγο από το `error`.
      return NextResponse.json({ success: false, error: outcome.rejection }, { status: REJECTION_STATUS[outcome.rejection] });
    }
    return apiSuccess({ slots: outcome.slots, invited: outcome.invited }, undefined, undefined, outcome.created ? 201 : 200);
  }),
);
