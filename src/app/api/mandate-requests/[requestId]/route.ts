import 'server-only';

/**
 * @fileoverview **ΕΝΑ ΑΙΤΗΜΑ — «ΔΕΙΞ' ΤΟ ΜΟΥ» ΚΑΙ «ΑΠΟΦΑΣΙΖΩ»** (ADR-827 §9.21).
 * @related services/mandate/mandate-inbox.service.ts · mandate-decision.service.ts
 * @module app/api/mandate-requests/[requestId]/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΜΙΑ ΔΙΕΥΘΥΝΣΗ, ΔΥΟ ΡΗΜΑΤΑ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΟΙΚΟΝΟΜΙΑ ΑΡΧΕΙΩΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η διεύθυνση **είναι** *«αυτό το αίτημα»*: το `GET` το ανοίγει, το `PATCH` το κρίνει.
 * Δύο διευθύνσεις θα σήμαιναν δύο τόποι που πρέπει να συμφωνούν για το **ποιος** το
 * κατέχει — και η απάντηση ζει ήδη σε **μία** γραμμή, το `ctx.companyId`. Ίδιο ιδίωμα
 * με το `/api/owner-properties/brokered`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ `GET` ΓΡΑΦΕΙ — ΚΑΙ ΓΙΑΤΙ ΠΑΡΑΜΕΝΕΙ ΙΔΕΜΠΟΤΕΝΤ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το άνοιγμα σφραγίζει το `seenAt`. Ένα `GET` με παρενέργεια είναι, κατά κανόνα, κακή
 * ιδέα — εδώ όμως η παρενέργεια είναι **write-once**: γράφει **μόνο** όταν το πεδίο
 * είναι `null`, άρα η δεύτερη, δέκατη και εκατοστή κλήση **δεν αλλάζουν τίποτα**. Η
 * ιδεμποτησία του ρήματος διατηρείται με την αυστηρή έννοια του HTTP.
 *
 * 🔑 **Και η σφραγίδα ζει εκεί που ΟΝΤΩΣ ανοίγει άνθρωπος**, ακριβώς όπως το
 * `markMandateViewed` της Φάσης Α: *«η σφραγίδα ζει εκεί που όντως αποδίδεται σελίδα»*.
 * Κρυμμένη μέσα στη λίστα, θα σφράγιζε **και τα είκοσι** αιτήματα επειδή κάποιος
 * κοίταξε την οθόνη — και το *«πόσο γρήγορα απαντά αυτό το γραφείο;»* θα ήταν ψέμα.
 *
 * ⚠️ **ΚΑΙ ΤΑ ΔΥΟ ΡΗΜΑΤΑ ΕΧΟΥΝ ΤΟΝ ΙΔΙΟ ΦΡΟΥΡΟ** (`withAuth` + `gateBrokerage`): η
 * ανάγνωση **είναι** αποκάλυψη προσωπικών δεδομένων τρίτου. Η πράξη κλειστή και η
 * επιφάνεια ανοιχτή είναι το μετρημένο λάθος της 2026-08-28.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { gateBrokerage, type BrokerageDeniedResponse } from '@/lib/auth/brokerage-gate';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  withSensitiveRateLimit,
  withStandardRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { readAgencyRequest } from '@/services/mandate/mandate-inbox.service';
import {
  decideMandateRequest,
  type MandateDecisionOutcome,
} from '@/services/mandate/mandate-decision.service';
import type { MandateDecisionRefusal } from '@/services/mandate/mandate-decision-vocabulary';
import {
  MANDATE_REQUEST_DECISIONS,
  type MandateRequestDecision,
  type MandateRequestForAgency,
} from '@/types/mandate-request';
import type { MandateInvariant } from '@/types/owner-property-mandate';

type RouteContext = { params: Promise<{ requestId: string }> };

type RequestResponse =
  | { readonly request: MandateRequestForAgency }
  | {
      readonly decided: MandateRequestDecision;
      readonly clientContactId: string | null;
    }
  | {
      readonly error: 'DECISION_REFUSED';
      readonly reason: MandateDecisionRefusal;
      readonly violations?: readonly MandateInvariant[];
    }
  | { readonly error: 'REQUEST_ABSENT' }
  | { readonly error: 'LISTING_WITHDRAWN' }
  | { readonly error: 'MALFORMED_BODY' }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με άρνηση (N.12). */
  | { readonly error: 'REQUEST_UNVERIFIED' }
  | { readonly error: 'WRITE_FAILED' }
  | BrokerageDeniedResponse;

/**
 * **Η απόφαση, όπως έρχεται από το δίκτυο** — το **κλειστό σύνολο των τριών**.
 *
 * 🔑 **`z.enum` πάνω στη ΣΤΑΘΕΡΑ, όχι σε χειρόγραφη λίστα**: μια τέταρτη απόφαση στο
 * {@link MANDATE_REQUEST_DECISIONS} γίνεται δεκτή **αυτόματα**, και μια που αφαιρείται
 * παύει **αυτόματα**. Δύο λίστες θα απέκλιναν την πρώτη φορά που κάποιος άλλαζε τη μία.
 */
const decisionSchema = z.object({
  decision: z.enum(MANDATE_REQUEST_DECISIONS),
});

/** Ό,τι απέδειξε ο φρουρός: **ποιο** αίτημα, για **ποιο** γραφείο. */
interface GatedRequest {
  readonly requestId: string;
  readonly companyId: string;
}

/** Ένας χειριστής που τρέχει **μόνο** αφού ο φρουρός πει ναι. */
type GatedHandler = (
  request: NextRequest,
  gate: GatedRequest,
  ctx: AuthContext,
) => Promise<NextResponse<RequestResponse>>;

/**
 * **Ο ΕΝΑΣ ΦΡΟΥΡΟΣ ΤΩΝ ΔΥΟ ΡΗΜΑΤΩΝ** — περιτύλιγμα, όχι συνάρτηση που καλείται δύο φορές.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΡΑΦΤΗΚΕ ΠΡΩΤΑ ΩΣ ΑΠΛΗ ΣΥΝΑΡΤΗΣΗ, ΚΑΙ ΤΟ **CHECK 3.28** ΤΟ ΑΠΕΡΡΙΨΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πρώτη γραφή είχε `guard(ctx, routeContext)` και **δύο** χειριστές που ξεκινούσαν με
 * την ίδια τετράδα παραμέτρων και τις ίδιες δύο γραμμές ελέγχου. Το jscpd μέτρησε
 * **9 γραμμές / 50 tokens** κλώνο **μέσα στο ίδιο αρχείο** — και είχε δίκιο: ο κοινός
 * κώδικας ήταν *«καλέστε αυτό, και μετά ελέγξτε το»*, δηλαδή **σύμβαση σε σχόλιο**.
 *
 * 🔑 **Το περιτύλιγμα το κάνει ΔΟΜΙΚΟ**: ο χειριστής δέχεται {@link GatedRequest} —
 * **ήδη ελεγμένο** — και **δεν έχει τρόπο** να τρέξει χωρίς φρουρό. Ίδιο ιδίωμα με το
 * `withAuth` που το τυλίγει από πάνω: ο φρουρός δεν είναι βήμα που κάποιος θυμάται,
 * είναι **η υπογραφή**.
 *
 * ⚠️ **Ο φρουρός τρέχει ΠΡΙΝ διαβαστεί το σώμα**, και είναι δύο πράγματα μαζί: δεν
 * κάνουμε δουλειά για αιτούντα που δεν επιτρέπεται, και **δεν του λέμε αν το JSON του
 * ήταν έγκυρο** — άρνηση που περιγράφει το σώμα είναι κανάλι πληροφορίας προς κάποιον
 * που δεν έπρεπε καν να φτάσει εδώ.
 */
function withRequestGate(handler: GatedHandler) {
  return async (
    request: NextRequest,
    ctx: AuthContext,
    _cache: unknown,
    routeContext?: RouteContext,
  ): Promise<NextResponse<RequestResponse>> => {
    const authority = await gateBrokerage(getAdminFirestore(), ctx.companyId);
    if (authority instanceof NextResponse) return authority;

    const params = await routeContext?.params;
    const requestId = params?.requestId?.trim() ?? '';
    if (requestId === '') {
      return NextResponse.json({ error: 'MALFORMED_BODY' } as const, { status: 400 });
    }

    return handler(request, { requestId, companyId: ctx.companyId ?? '' }, ctx);
  };
}

// =============================================================================
// GET — «δείξ' το μου», και σφράγισε ότι το είδα
// =============================================================================

const openHandler: GatedHandler = async (_request, gate) => {
  const load = await readAgencyRequest(
    getAdminFirestore(),
    gate.requestId,
    gate.companyId,
    nowISO(),
  );

  // ⚠️ Κλειστό σύνολο, **χωρίς `default`**: πέμπτη έκβαση του αναγνώστη **δεν
  //    μεταγλωττίζεται** μέχρι κάποιος να πει τι σημαίνει για το δίκτυο.
  switch (load.kind) {
    case 'ready':
      return NextResponse.json({ request: load.request });
    case 'absent':
      // **404, ποτέ 403.** Ένα 403 θα **επιβεβαίωνε την ύπαρξη** αιτήματος ανάθεσης
      // προς ανταγωνιστή — απαρίθμηση ένα ερώτημα τη φορά (ADR-787 Ε-5 §4 #1).
      return NextResponse.json({ error: 'REQUEST_ABSENT' } as const, { status: 404 });
    case 'listing-withdrawn':
      // **409, όχι 404**: το αίτημα **υπάρχει**· αυτό που έφυγε είναι το αντικείμενό
      // του. Δύο διαφορετικά μηνύματα προς τον μεσίτη, δύο διαφορετικές ενέργειες.
      return NextResponse.json({ error: 'LISTING_WITHDRAWN' } as const, { status: 409 });
    case 'unavailable':
      return NextResponse.json({ error: 'REQUEST_UNVERIFIED' } as const, { status: 503 });
  }
};

// =============================================================================
// PATCH — «αποφασίζω»
// =============================================================================

const decideHandler: GatedHandler = async (request, gate, ctx) => {
  const parsed = await readJsonBody(request, decisionSchema);
  if ('rejected' in parsed) return parsed.rejected;

  return respond(
    await decideMandateRequest(getAdminFirestore(), {
      requestId: gate.requestId,
      // 🔴 **ΑΠΟΚΛΕΙΣΤΙΚΑ από την απόδειξη.** Δεν υπάρχει πεδίο στο σώμα να ζητήσει
      //    άλλο γραφείο — άρα η κατάχρηση δεν απαγορεύεται, είναι **ανέκφραστη**.
      agencyCompanyId: gate.companyId,
      deciderUid: ctx.uid,
      decision: parsed.data.decision,
      // ⚠️ Το ρολόι διαβάζεται **εδώ, στο σύνορο**, και περνά ως τιμή. Κάθε συνάρτηση
      //    πιο μέσα είναι καθαρή — γι' αυτό τα άκρα της λήξης είναι δοκιμάσιμα.
      nowISO: nowISO(),
    }),
  );
};

/**
 * **Έκβαση → HTTP**, κάθε λόγος ρητά και **χωρίς `default`**.
 *
 * ⚠️ **422 για ΚΑΘΕ άρνηση, ποτέ 404/403.** Το αίτημα ήταν **κατανοητό**· η πράξη δεν
 * επιτρέπεται από την **κατάσταση του κόσμου**. Και ο ονομαστικός λόγος ταξιδεύει,
 * ώστε η οθόνη να δείξει **ποια** θεραπεία — «κάποιος πρόλαβε» και «λείπει το ΑΦΜ του
 * ιδιοκτήτη» είναι δύο εντελώς διαφορετικά επόμενα βήματα.
 */
function respond(outcome: MandateDecisionOutcome): NextResponse<RequestResponse> {
  switch (outcome.kind) {
    case 'decided':
      return NextResponse.json({
        decided: outcome.decision,
        clientContactId: outcome.clientContactId,
      });
    case 'refused':
      return NextResponse.json(
        {
          error: 'DECISION_REFUSED',
          reason: outcome.reason,
          violations: outcome.violations,
        } as const,
        { status: 422 },
      );
    case 'unavailable':
      // 🔴 **503, ΠΟΤΕ 422.** *«Δεν μάθαμε»* ≠ *«δεν επιτρέπεται»*: ένα 422 εδώ θα
      //    έλεγε στον μεσίτη ότι το αίτημα **δεν υπάρχει** ή ότι ο πελάτης του δεν
      //    έχει ΑΦΜ — και θα το πίστευε.
      return NextResponse.json({ error: 'REQUEST_UNVERIFIED' } as const, { status: 503 });
    case 'failed':
      return NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 500 });
  }
}

export const GET = withStandardRateLimit(
  withAuth<RequestResponse, RouteContext>(withRequestGate(openHandler)),
);

/**
 * ⚠️ **`withSensitiveRateLimit` και όχι το τυπικό**: κάθε αποδοχή **γεννά προσωπικά
 * δεδομένα** και δεσμεύει περιουσία τρίτου. Δεν είναι ανάγνωση καταλόγου.
 */
export const PATCH = withSensitiveRateLimit(
  withAuth<RequestResponse, RouteContext>(withRequestGate(decideHandler)),
);
