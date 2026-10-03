/**
 * ADR-901 Φ4 §5.4 · §5.9 — ο επαγγελματίας **ανοίγει/κατεβάζει** ένα τεκμήριο της υπόθεσης.
 *
 * POST /api/engagements/{engagementId}/files/{fileId} { mode: 'view' | 'download' }
 *   → `{ url, expiresAt, fileName, contentType }` (σύνδεσμος 15′)
 *   - **POST, όχι GET**: το άνοιγμα **γράφει** ίχνος (`document_accessed`). Το σύνορο ιδεμποτίας (ADR-872) κάνει
 *     την αυτόματη επανάληψη να επιστρέφει την **ίδια** απάντηση, χωρίς δεύτερο ίχνος
 *   - αρχείο εκτός των ορατών γραμμών του ρόλου ⇒ 404, ίδιο με ανύπαρκτο (Α19)
 *   - δική μου συμμετοχή χωρίς πρόσβαση τώρα ⇒ 403 με **ονομασμένο** λόγο · «δεν μπόρεσα» ⇒ 503
 *
 * @module api/engagements/[engagementId]/files/[fileId]
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { CASE_FILE_MODES } from '@/lib/conveyance/case-activity';
import { openCaseFile, type CaseFileOpening } from '@/services/conveyance/conveyance-case-file-access.service';

type Segment = { params: Promise<{ engagementId: string; fileId: string }> };

const bodySchema = z.object({ mode: z.enum(CASE_FILE_MODES) });

/** Η μία μετάφραση άρνησης → HTTP. */
const STATUS: Readonly<Record<Exclude<Extract<CaseFileOpening, { ok: false }>['rejection'], 'denied'>, number>> = {
  'not-found': 404,
  unknown: 503,
  failed: 503,
};

async function handler(request: NextRequest, actor: ApiActor, segmentData?: Segment) {
  const params = await segmentData!.params;
  const parsed = safeParseBody(bodySchema, await request.json());
  if (parsed.error) return parsed.error;
  const outcome = await openCaseFile(requireAdminFirestore(), {
    uid: actor.ctx.uid,
    email: actor.ctx.email ?? null,
    engagementId: decodeRouteParam(params.engagementId),
    fileId: decodeRouteParam(params.fileId),
    mode: parsed.data.mode,
    nowMs: Date.now(),
  });
  if (outcome.ok) {
    return apiSuccess({ url: outcome.url, expiresAt: outcome.expiresAt, fileName: outcome.fileName, contentType: outcome.contentType });
  }
  if (outcome.rejection === 'denied') {
    return NextResponse.json({ success: false, error: 'ENGAGEMENT_NOT_ACTIVE', verdict: outcome.verdict }, { status: 403 });
  }
  return NextResponse.json({ success: false, error: outcome.rejection }, { status: STATUS[outcome.rejection] });
}

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
