/**
 * =============================================================================
 * POST /api/admin/organization-capabilities/brokerage — Η ΡΥΘΜΙΣΤΙΚΗ ΑΠΟΦΑΣΗ
 * =============================================================================
 *
 * `approve` ⇒ `pending → active` · `revoke` ⇒ `pending|active → revoked`.
 *
 * 🔴 **ΚΑΙ ΟΙ ΔΥΟ ΣΑΡΩΝΟΥΝ ΤΙΣ ΗΔΗ ΔΗΜΟΣΙΕΥΜΕΝΕΣ ΑΓΓΕΛΙΕΣ.** Χωρίς τη σάρωση, ο
 * φρουρός θα φύλαγε **μόνο το μέλλον**: ένα γραφείο που έχασε την άδειά του θα
 * κρατούσε στον δημόσιο χάρτη **όσες πρόλαβε** (ADR-824 §8 Κ6).
 *
 * ⚠️ **Η σειρά είναι συμβόλαιο: πρώτα η απόφαση, μετά το παράγωγο.** Αν σάρωνε πρώτα,
 * μια αστοχία στη γραφή της κατάστασης θα άφηνε αγγελίες αποσυρμένες από απόφαση που
 * **δεν καταγράφηκε ποτέ** — και κανείς δεν θα μπορούσε να τις επαναφέρει.
 *
 * 🔒 `withAuth` + `BYPASS_ROLES` *(**παραγόμενο**, ποτέ χειρόγραφη λίστα)* + sensitive
 * rate limit. Ο ρόλος κρίνεται στο **σύνορο** από τον ΕΝΑ κριτή (ADR-801 · CHECK 3.68)
 * — η υπηρεσία από κάτω κρίνει **μόνο** τη νομιμότητα της μετάβασης.
 *
 * @module api/admin/organization-capabilities/brokerage
 * @see ADR-824 §5.3 · §8 Κ6
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { BYPASS_ROLES } from '@/lib/auth/roles';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  approveBrokerage,
  revokeBrokerage,
  type CapabilityTransitionResult,
} from '@/services/company/organization-capability.service';
import { applyAgencyRevocation } from '@/services/mandate/agency-listings-sweep.service';

/**
 * ⚠️ **Η ανάκληση ΑΠΑΙΤΕΙ λόγο, η έγκριση όχι** — και δεν είναι ασυμμετρία από
 * αμέλεια: το `revoked` οφείλει να απαντά *«γιατί μου το πήρατε;»*, ενώ το «σε
 * ενέκρινα» δεν γεννά ερώτηση. Διακριτή ένωση, ώστε ο λόγος να **μην μπορεί** να
 * λείψει από τη μία περίπτωση.
 */
const decisionSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve'), companyId: z.string().trim().min(1).max(128) }),
  z.object({
    decision: z.literal('revoke'),
    companyId: z.string().trim().min(1).max(128),
    reason: z.string().trim().min(1).max(500),
  }),
]);

function respond(result: CapabilityTransitionResult, swept: number | null): NextResponse {
  // ⚠️ Κλειστό σύνολο, χωρίς `default`.
  switch (result.kind) {
    case 'applied':
      return NextResponse.json({ status: result.status, listingsSwept: swept });
    case 'illegal-transition':
      return NextResponse.json({ error: 'ILLEGAL_TRANSITION', from: result.from }, { status: 409 });
    case 'absent':
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    case 'failed':
      return NextResponse.json({ error: 'WRITE_FAILED' }, { status: 500 });
  }
}

async function handler(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const parsed = await readJsonBody(request, decisionSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const adminDb = getAdminFirestore();
  const { companyId } = parsed.data;

  const result =
    parsed.data.decision === 'approve'
      ? await approveBrokerage(adminDb, companyId, ctx.uid)
      : await revokeBrokerage(adminDb, companyId, ctx.uid, parsed.data.reason);

  if (result.kind !== 'applied') return respond(result, null);

  // 🔴 **Η ΣΑΡΩΣΗ — και στις ΔΥΟ κατευθύνσεις.** Η ανάκληση αποσύρει· η επανέγκριση
  //    **επαναφέρει** χωρίς ο ιδιοκτήτης να κάνει τίποτα. Ίδια πράξη, άλλη τιμή.
  const sweep = await applyAgencyRevocation(
    adminDb,
    companyId,
    parsed.data.decision === 'approve' ? null : nowISO(),
  );

  return respond(result, sweep.swept);
}

export const POST = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handler(request, ctx),
    { requiredGlobalRoles: BYPASS_ROLES },
  ),
);
