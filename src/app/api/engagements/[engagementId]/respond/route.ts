/**
 * ADR-901 Φ2 · ADR-862 Φ1 — «Αναλαμβάνω» / «Δεν αναλαμβάνω» (ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ).
 *
 * POST /api/engagements/{engagementId}/respond { decision: 'accept', credential } | { decision: 'decline' } → `{ card }`
 *   - **η αποδοχή φέρει τη δήλωση ιδιότητας** (ADR-901 Ε-4 · Φ4) — ίδιο σχήμα με την πρόσκληση με email
 *   - **μόνο** ο ίδιος (η συμμετοχή ψάχνεται **ανάμεσα στις δικές του** — ξένη ≡ ανύπαρκτη, 404)
 *   - **μόνο** σε πρόταση· ληγμένη πρόταση ⇒ 409 `offer-expired` (ποτέ σιωπηλή αποδοχή)
 *   - ιδεμποτές: δεύτερο «Αναλαμβάνω» ⇒ 200 χωρίς εγγραφή (+ το σύνορο `Idempotency-Key`)
 *   - **ADR-901 §15 (Γ1)**: η αποδοχή γράφει «για λογαριασμό ποιου γραφείου» — το κρίνει ο **διακομιστής**
 *     (`actingRequest` = αίτημα, όχι άδεια): 2+ γραφεία χωρίς επιλογή ⇒ 409 · ξένο γραφείο ⇒ 403 · άγνωστο ⇒ 503
 *
 * @module api/engagements/[engagementId]/respond
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ACTING_WORKSPACE_REQUEST_SCHEMA } from '@/lib/auth/acting-workspace';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { activeWorkspaceOf } from '@/lib/auth/workspace-membership';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { CREDENTIAL_DECLARATION_SCHEMA } from '@/lib/conveyance/declared-credential';
import { respondToCaseEngagement, type RespondOutcome } from '@/services/conveyance/conveyance-engagement-access.service';

type Segment = { params: Promise<{ engagementId: string }> };

/** Η αποδοχή **χωρίς** δήλωση ιδιότητας δεν περνά το σύνορο (Ε-4) — το ίδιο σχήμα με την πρόσκληση. */
const respondSchema = z.discriminatedUnion('decision', [
  // §15 Γ1 — το πολύ ΕΝΑ αίτημα χώρου («για λογαριασμό ποιου γραφείου»)· το κρίνει ο διακομιστής, όχι το σχήμα.
  z.object({ decision: z.literal('accept'), credential: CREDENTIAL_DECLARATION_SCHEMA, actingRequest: ACTING_WORKSPACE_REQUEST_SCHEMA.optional() }),
  z.object({ decision: z.literal('decline') }),
]);

/** Η μία μετάφραση άρνησης → HTTP. */
const STATUS: Readonly<Record<Extract<RespondOutcome, { ok: false }>['rejection'], number>> = {
  'not-found': 404,
  unknown: 503,
  'offer-expired': 409,
  'not-allowed': 409,
  // 2+ γραφεία χωρίς επιλογή: το αίτημα ήταν κατανοητό, λείπει μια απόφαση του ανθρώπου.
  'acting-choice-required': 409,
  // Γραφείο όπου δεν ανήκει · «προσωπικά» ενώ έχει γραφείο (Α1γ).
  'acting-refused': 403,
};

async function handler(request: NextRequest, actor: ApiActor, segmentData?: Segment) {
  const { engagementId } = await segmentData!.params;
  const parsed = safeParseBody(respondSchema, await request.json());
  if (parsed.error) return parsed.error;
  const outcome = await respondToCaseEngagement(
    requireAdminFirestore(),
    { uid: actor.ctx.uid, email: actor.ctx.email ?? null, active: activeWorkspaceOf(actor) },
    engagementId,
    parsed.data,
    Date.now(),
  );
  if (!outcome.ok) {
    return NextResponse.json({ success: false, error: outcome.rejection }, { status: STATUS[outcome.rejection] });
  }
  return apiSuccess({ card: outcome.card });
}

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
