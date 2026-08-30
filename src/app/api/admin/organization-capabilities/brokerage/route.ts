/**
 * =============================================================================
 * /api/admin/organization-capabilities/brokerage — Η ΠΟΡΤΑ ΤΟΥ ΡΥΘΜΙΣΤΗ
 * =============================================================================
 *
 * **`GET`** *«ποιους να κρίνω;»* · **`POST`** *«κρίνω»*.
 *
 * 🔑 **ΔΥΟ ΡΗΜΑΤΑ, ΕΝΑΣ ΘΕΜΑΤΟΦΥΛΑΚΑΣ — και δεν είναι οικονομία αρχείων.** Η απαρίθμηση και
 * η απόφαση μοιράζονται **τον ίδιο φρουρό** (`BYPASS_ROLES`) και **το ίδιο λεξιλόγιο
 * καταστάσεων**. Χωριστές διαδρομές θα ήταν δύο σημεία που απαντούν *«ποιος επιτρέπεται εδώ;»*
 * — δηλαδή δύο σημεία που μπορούν να αποκλίνουν, με το επικίνδυνο σκέλος να είναι **αυτό που
 * ξεχνιέται**.
 *
 * ⚠️ Το `GET` **προϋπήρχε ως κενό**: υπήρχε ολόκληρη μηχανή απόφασης και **καμία** διαδρομή
 * που να λέει ποιος περιμένει. Ο υπερδιαχειριστής μπορούσε να αποφασίσει μόνο για `companyId`
 * που ήξερε ήδη **απ' έξω** (ADR-824 §12.13).
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
import { readCapabilityApplicants } from '@/services/company/organization-capability.reader';
import {
  approveBrokerage,
  revokeBrokerage,
  type CapabilityTransitionResult,
} from '@/services/company/organization-capability.service';
import {
  isCapabilityStatus,
  type OrganizationCapability,
} from '@/types/organization-capability';
import { applyAgencyRevocation } from '@/services/mandate/agency-listings-sweep.service';

/**
 * ⚠️ **Η ανάκληση ΑΠΑΙΤΕΙ λόγο, η έγκριση όχι** — και δεν είναι ασυμμετρία από
 * αμέλεια: το `revoked` οφείλει να απαντά *«γιατί μου το πήρατε;»*, ενώ το «σε
 * ενέκρινα» δεν γεννά ερώτηση. Διακριτή ένωση, ώστε ο λόγος να **μην μπορεί** να
 * λείψει από τη μία περίπτωση.
 */
/**
 * Η ικανότητα που κατέχει **αυτή** η διαδρομή.
 *
 * ⚠️ Γραμμένη **μία** φορά και τυποποιημένη ως `OrganizationCapability`: αν κάποτε
 * μετονομαστεί στο κλειστό σύνολο, εδώ **δεν μεταγλωττίζεται** αντί να ψάχνει σιωπηλά
 * εταιρείες που δεν υπάρχουν.
 */
const CAPABILITY: OrganizationCapability = 'brokerage_listings';

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

/**
 * **Η ΑΠΑΡΙΘΜΗΣΗ** — `GET ?status=pending` *(προεπιλογή: `pending`)*.
 *
 * 🔑 **Η κατάσταση κρίνεται από τον ΕΝΑ κριτή κλειστού συνόλου** (`isCapabilityStatus`), τον
 * ίδιο που ήδη φυλάει ό,τι έρχεται απ' έξω στην οθόνη της άρνησης (§12.11). Ένα δεύτερο
 * `z.enum([...])` εδώ θα ήταν **δεύτερη απογραφή** των τεσσάρων καταστάσεων — και θα πάλιωνε
 * ακριβώς τη μέρα που προστεθεί πέμπτη.
 *
 * ⛔ **Το `unrequested` απορρίπτεται ΡΗΤΑ, με 400 και όνομα.** Δεν είναι γραμμένη τιμή αλλά
 * **προεπιλογή για την απουσία εγγραφής**: ένα ερώτημα ισότητας πάνω σε πεδίο που δεν υπάρχει
 * γυρίζει **κενό**, δηλαδή θα απαντούσε *«κανείς»* για το σύνολο που περιέχει **σχεδόν
 * όλους**. Σιωπηλή άδεια λίστα είναι χειρότερη από σφάλμα: **μοιάζει με απάντηση**.
 */
async function listHandler(request: NextRequest): Promise<NextResponse> {
  const requested = request.nextUrl.searchParams.get('status') ?? 'pending';

  if (!isCapabilityStatus(requested)) {
    return NextResponse.json({ error: 'UNKNOWN_STATUS' }, { status: 400 });
  }

  const page = await readCapabilityApplicants(getAdminFirestore(), CAPABILITY, requested);

  if (page === null) {
    return NextResponse.json({ error: 'STATUS_NOT_ENUMERABLE', status: requested }, { status: 400 });
  }

  return NextResponse.json(page);
}

export const GET = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) =>
      listHandler(request),
    { requiredGlobalRoles: BYPASS_ROLES },
  ),
);

export const POST = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handler(request, ctx),
    { requiredGlobalRoles: BYPASS_ROLES },
  ),
);
