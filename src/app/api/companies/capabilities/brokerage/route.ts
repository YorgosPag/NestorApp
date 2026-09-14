/**
 * =============================================================================
 * POST /api/companies/capabilities/brokerage — Ο ΙΔΡΥΤΗΣ ΔΗΛΩΝΕΙ ΜΕΣΙΤΕΙΑ
 * =============================================================================
 *
 * **Δήλωση → `pending`.** Η δυνατότητα **ΔΕΝ δουλεύει** μέχρι να εγκρίνει
 * υπερδιαχειριστής (`/api/admin/organization-capabilities/brokerage`).
 *
 * 🔴 **ΑΠΟΡΡΙΦΘΗΚΕ ΡΗΤΑ το «μόνο δήλωση, χωρίς έγκριση»** (ADR-824 §5.3): ο **Ν.
 * 4072/2012** κάνει τη μεσιτεία **χωρίς εγγραφή παράνομη**, και πλατφόρμα που
 * ενεργοποιεί ρυθμιζόμενη δραστηριότητα με **αυτοδήλωση** αναλαμβάνει το ρίσκο η ίδια.
 *
 * ⚠️ **Ο οργανισμός ΔΕΝ έρχεται από το σώμα** — γράφεται από το `ctx.companyId`, όπως
 * ακριβώς στην πόρτα του μεσίτη. Ένα πεδίο `companyId` εδώ θα σήμαινε ότι κάθε
 * συνδεδεμένος δηλώνει μεσιτεία **για ξένο γραφείο**.
 *
 * 🔑 **ΟΥΤΕ Ο ΑΡΙΘΜΟΣ ΓΕΜΗ έρχεται από το σώμα** (ADR-841 §7 Α23): ζει **μία** φορά, στο
 * προφίλ της εταιρείας (ADR-439), και η δήλωση τον **διαβάζει** — πρότυπο Stripe
 * `company.registration_number`. Ως τις 2026-09-14 γραφόταν εδώ ελεύθερα, και το ζωντανό
 * γραφείο είχε **άλλον** αριθμό στη δήλωση (`123456789000`) και **κενό** στο προφίλ.
 *
 * 🔒 `withAuth` + `ADMINISTRATIVE_ROLES` *(**παραγόμενο** από την ικανότητα
 * `admin_access`, ποτέ χειρόγραφη λίστα ονομάτων — ADR-801 §2.11)* + sensitive rate limit.
 *
 * @module api/companies/capabilities/brokerage
 * @see ADR-824 §5.3 · ADR-841 §7 Α23
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { readCompanyRegistryDeclaration } from '@/services/company/company-legal-identity';
import { declareBrokerage } from '@/services/company/organization-capability.service';

/**
 * Τα στοιχεία που **ο νόμος** απαιτεί (Ν. 4072/2012, άρθρα 197-204) **και μόνο ο άνθρωπος ξέρει**.
 *
 * ⚠️ **Δεν επαληθεύονται αυτόματα σήμερα, και είναι δηλωμένο κενό** (ADR-824 §5.3). Ο αριθμός
 * ΓΕΜΗ έχει πλέον δική του επαλήθευση από το μητρώο (ADR-841 §7 Α23), μέσα από το προφίλ.
 */
const declarationSchema = z.object({
  chamberRegistryNumber: z.string().trim().min(1).max(64),
  legalRepresentativeName: z.string().trim().min(1).max(200),
});

/** Ο αριθμός ΓΕΜΗ του προφίλ — ή η **ονομασμένη** άρνηση όταν λείπει/δεν διαβάστηκε. */
async function registrationNumberOf(companyId: string): Promise<string | NextResponse> {
  const registry = await readCompanyRegistryDeclaration(companyId);
  // **503**, όχι 422: το προφίλ ίσως έχει αριθμό — απλώς δεν διαβάστηκε.
  if (registry.kind === 'unavailable') {
    return NextResponse.json({ error: 'PROFILE_UNAVAILABLE' }, { status: 503 });
  }
  const gemiNumber = registry.kind === 'present' ? registry.declaration.gemiNumber : null;
  if (gemiNumber === null || canonicalGemiNumber(gemiNumber) === null) {
    return NextResponse.json({ error: 'PROFILE_REGISTRATION_MISSING' }, { status: 422 });
  }
  return gemiNumber;
}

async function handler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse> {
  const parsed = await readJsonBody(request, declarationSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const companyId = ctx.companyId?.trim() ?? '';
  if (companyId === '') {
    // 🔴 fail-closed, πρότυπο `extractCustomClaims`: *«κενή συμβολοσειρά = απουσία»*.
    return NextResponse.json({ error: 'NO_ORGANIZATION' }, { status: 403 });
  }

  const gemiNumber = await registrationNumberOf(companyId);
  if (gemiNumber instanceof NextResponse) return gemiNumber;

  const result = await declareBrokerage(getAdminFirestore(), companyId, {
    gemiNumber,
    ...parsed.data,
    declaredAt: nowISO(),
    declaredByUserId: ctx.uid,
  });

  // ⚠️ **Κλειστό σύνολο, χωρίς `default`** — πέμπτη κατάσταση της μετάβασης δεν
  //    μεταγλωττίζεται μέχρι κάποιος να αποφασίσει τι σημαίνει για το δίκτυο.
  switch (result.kind) {
    case 'applied':
      return NextResponse.json({ status: result.status });
    case 'illegal-transition':
      // **409**, όχι 422: το αίτημα ήταν έγκυρο — η **κατάσταση** δεν το δέχεται.
      return NextResponse.json(
        { error: 'ILLEGAL_TRANSITION', from: result.from },
        { status: 409 },
      );
    case 'absent':
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    case 'failed':
      return NextResponse.json({ error: 'WRITE_FAILED' }, { status: 500 });
  }
}

export const POST = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handler(request, ctx),
    { requiredGlobalRoles: ADMINISTRATIVE_ROLES },
  ),
);
