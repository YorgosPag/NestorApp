/**
 * =============================================================================
 * POST /api/admin/ai-inbox/communications/[communicationId]/triage
 * =============================================================================
 *
 * Έγκριση / απόρριψη εισερχόμενου μηνύματος από την κονσόλα AI Inbox.
 *
 * 🔴 **ΑΝΤΙΚΑΘΙΣΤΑ ΤΙΣ SERVER ACTIONS `approveCommunication` / `rejectCommunication`**
 *    (ADR-868). Εκείνες ήταν δημόσια endpoints που δέχονταν `adminUid` + `companyId`
 *    **από τον πελάτη**, χωρίς να επαληθεύουν ταυτότητα — η σελίδα φύλαγε, το endpoint όχι.
 *
 * 🔑 **ΤΙ ΣΤΕΛΝΕΙ Ο ΠΕΛΑΤΗΣ: ΜΟΝΟ ΤΟ id ΚΑΙ ΤΗΝ ΑΠΟΦΑΣΗ.** Ταυτότητα, ρόλος, εταιρεία και
 *    MFA βγαίνουν από το `withAuth` (`ADMIN_SURFACE_AUTH` — η ίδια πολιτική με τη σελίδα).
 *    Το id είναι *επιλογέας*, όχι εξουσιοδότηση (OWASP Multi-Tenant: «Treat client-supplied
 *    tenant identifiers as selectors only»): η ιδιοκτησία κρίνεται πάνω στο **έγγραφο**.
 *
 * 🔒 **Ξένο μήνυμα ⇒ 404 ίδιο με το «δεν υπάρχει»** (`concealCrossTenant`, ADR-742): ο
 *    κανονικός διαχειριστής δεν μπορεί να χαρτογραφήσει ids άλλης εταιρείας. Μόνο ο bypass
 *    ρόλος, που έχει ήδη καθολική ορατότητα, παίρνει την ειλικρινή άρνηση (403).
 *
 * @route POST /api/admin/ai-inbox/communications/[communicationId]/triage
 * @security withAuth + ADMIN_SURFACE_AUTH (ρόλος διαχειριστή + MFA)
 * @rateLimit SENSITIVE — ρητός wrapper **σε αυτό το αρχείο**, όχι μέσα σε εργοστάσιο (CHECK 3.78:
 *            ο αναγνώστης του route.ts πρέπει να βλέπει ποιο όριο ισχύει)
 * @see ADR-868 · ADR-214 · ADR-742
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { ok, notFound, httpError } from '@/lib/api/define-route';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { concealCrossTenant } from '@/lib/auth/tenant-ownership';
import { ADMIN_SURFACE_AUTH } from '@/server/admin/admin-guards';
import {
  approveCommunication,
  rejectCommunication,
  type ActionErrorCode,
} from '@/services/communications-triage-actions';

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Το σώμα είναι **μόνο** η απόφαση. Το `.strict()` απορρίπτει με 400 κάθε πεδίο
 * ταυτότητας που θα έστελνε παλιός πελάτης (`adminUid`, `companyId`) — δεν
 * «αγνοείται» σιωπηλά, λέγεται ότι δεν ανήκει στο συμβόλαιο.
 */
const TriageDecisionSchema = z
  .object({ decision: z.enum(['approve', 'reject']) })
  .strict();

type TriageSegment = { params: Promise<{ communicationId: string }> };

// =============================================================================
// FAILURE → HTTP (ένα σημείο, και για τις δύο αποφάσεις)
// =============================================================================

const NOT_FOUND_MESSAGE = 'Communication not found';

function failTriage(code: ActionErrorCode, errorId: string, callerGlobalRole: string): never {
  switch (code) {
    case 'not_found':
      return notFound(NOT_FOUND_MESSAGE);
    case 'tenant_mismatch':
      // Η μεταμφίεση παράγεται από τον ΙΔΙΟ κατασκευαστή με το γνήσιο «δεν βρέθηκε» —
      // αλλιώς το κείμενο θα γινόταν το ίδιο μαντείο ύπαρξης (tenant-ownership.ts).
      return concealCrossTenant(callerGlobalRole, {
        reveal: () => httpError(403, 'Communication is outside your company', { errorId }),
        conceal: () => notFound(NOT_FOUND_MESSAGE),
      });
    case 'invalid_context':
      // Απρόσιτο πίσω από το `withAuth` (το `AuthContext` εγγυάται uid + εταιρεία) —
      // ζώνη ασφαλείας αν αλλάξει ποτέ ο ανάντη φύλακας.
      return httpError(403, 'Invalid caller context', { errorId });
    case 'unknown':
      return httpError(500, 'Triage failed', { errorId });
  }
}

// =============================================================================
// POST
// =============================================================================

/**
 * ⚠️ Το `params` λύνεται **μετά** τον φρουρό (`withAuth`): ο ανώνυμος καλών δεν μαθαίνει
 *    τίποτα για το id. Μη-JSON σώμα ⇒ `null` ⇒ 400 από το σχήμα, όχι 500.
 */
async function handleTriage(
  request: NextRequest,
  auth: AuthContext,
  _cache: PermissionCache,
  segment?: TriageSegment,
): Promise<NextResponse> {
  const communicationId = segment ? (await segment.params).communicationId : '';
  const parsed = safeParseBody(TriageDecisionSchema, await request.json().catch(() => null));
  if (parsed.error) return parsed.error;

  if (parsed.data.decision === 'approve') {
    const result = await approveCommunication(communicationId, auth);
    if (!result.ok) return failTriage(result.code, result.errorId, auth.globalRole);
    return ok({ taskId: result.taskId });
  }

  const result = await rejectCommunication(communicationId, auth);
  if (!result.ok) return failTriage(result.code, result.errorId, auth.globalRole);
  return ok();
}

export const POST = withSensitiveRateLimit<TriageSegment>(
  withAuth<unknown, TriageSegment>(handleTriage, ADMIN_SURFACE_AUTH),
);
