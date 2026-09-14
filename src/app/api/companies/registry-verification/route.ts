/**
 * =============================================================================
 * GET + POST /api/companies/registry-verification — Η ΝΟΜΙΚΗ ΤΑΥΤΟΤΗΤΑ ΑΠΕΝΑΝΤΙ ΣΤΟ ΓΕΜΗ
 * =============================================================================
 *
 * **GET** — η κρίση από τα **αποθηκευμένα** (προφίλ ⇄ τελευταία απάντηση μητρώου). Καμία κλήση ΓΕΜΗ.
 * **POST** — η **πράξη** «Επαλήθευση από ΓΕΜΗ»: ρωτά το μητρώο για τον αριθμό του προφίλ.
 *
 * ⚠️ **Ο οργανισμός ΔΕΝ έρχεται από το σώμα** — από το `ctx.companyId`, όπως η δήλωση μεσιτείας.
 * Και **ο αριθμός ΔΕΝ έρχεται από το σώμα**: ζει στο προφίλ (ADR-439)· ένα πεδίο εδώ θα ήταν
 * δεύτερη αλήθεια, και θα επέτρεπε επαλήθευση **ξένου** αριθμού.
 *
 * 🔒 `ADMINISTRATIVE_ROLES`: η απάντηση περιέχει την **έδρα** από το μητρώο (σε ατομική, συχνά η
 * κατοικία).
 *
 * ⏱️ **Η βαθμίδα ρυθμού δηλώνεται ΕΔΩ, ρητά** (CHECK 3.78): `standard` για την ανάγνωση,
 * `sensitive` για την πράξη — κάθε POST καταναλώνει όριο του κλειδιού ΓΕΜΗ.
 *
 * @module api/companies/registry-verification
 * @see ADR-841 §7 Α23
 */

import 'server-only';

import { after, NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { reconcileShowcaseLegalIdentity } from '@/services/company/company-rename.service';
import {
  readRegistryIdentityReport,
  verifyRegistryIdentity,
  type RegistryReportOutcome,
} from '@/services/company-registry/company-registry-verification.service';

type ReportAction = (companyId: string) => Promise<RegistryReportOutcome>;

function respond(outcome: RegistryReportOutcome): NextResponse {
  // **503**, όχι 404: το προφίλ ίσως υπάρχει — απλώς δεν διαβάστηκε.
  if (outcome.kind === 'profile-unavailable') {
    return NextResponse.json({ error: 'PROFILE_UNAVAILABLE' }, { status: 503 });
  }
  return NextResponse.json({ success: true, data: outcome.report });
}

/** Η **μία** πόρτα και για τις δύο πράξεις: οργανισμός από το `ctx`, ρόλος διαχειριστή. */
function administered(action: ReportAction) {
  return withAuth(
    async (_request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      // 🔴 fail-closed, πρότυπο `extractCustomClaims`: *«κενή συμβολοσειρά = απουσία»*.
      const companyId = ctx.companyId?.trim() ?? '';
      if (companyId === '') return NextResponse.json({ error: 'NO_ORGANIZATION' }, { status: 403 });
      return respond(await action(companyId));
    },
    { requiredGlobalRoles: ADMINISTRATIVE_ROLES },
  );
}

export const GET = withStandardRateLimit(
  administered((companyId) => readRegistryIdentityReport(getAdminFirestore(), companyId)),
);

/**
 * 🔑 ADR-841 §7 Α23 — **η πράξη κατέχει τη συνέπειά της** (Α1.6): νέα απάντηση του μητρώου αλλάζει
 * είσοδο της νομικής ταυτότητας της βιτρίνας (σήμα · επωνυμία · τίτλος · δήμος). Μόνο όταν **ρωτήθηκε**
 * το μητρώο — ένα `unavailable` δεν έμαθε τίποτα νέο. `after`: ο άνθρωπος βλέπει την κρίση αμέσως.
 */
export const POST = withSensitiveRateLimit(
  administered(async (companyId) => {
    const adminDb = getAdminFirestore();
    const outcome = await verifyRegistryIdentity(adminDb, companyId);
    if (outcome.kind === 'report' && outcome.report.freshness.kind === 'asked') {
      after(() => reconcileShowcaseLegalIdentity(adminDb, companyId));
    }
    return outcome;
  }),
);
