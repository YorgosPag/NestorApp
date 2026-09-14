/**
 * @fileoverview 🏆 **«ΤΙ ΞΕΡΕΙ ΗΔΗ ΤΟ ΣΥΣΤΗΜΑ ΓΙΑ ΤΟ ΠΟΥ ΜΕ ΒΡΙΣΚΟΥΝ;»** — η πηγή της εισαγωγής στην κάρτα
 *   (ADR-841 §7 Α21.19).
 * @related services/mandate/showcase-card-import-source · lib/agency/showcase-card-import
 * @module app/api/agency-profile/card/import-source/route
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ `GET /api/accounting/setup`**: εκείνη η πόρτα επιστρέφει **ολόκληρο** το προφίλ — ΑΦΜ, μετόχους,
 * ΚΑΔ, σειρές τιμολογίων. Εδώ φεύγουν **μόνο** διεύθυνση και κανάλια, ελαχιστοποιημένα **με τύπο**.
 *
 * ⚠️ **Χωριστή πόρτα από την κάρτα, επίτηδες**: αν η πηγή δεν διαβαστεί, η κάρτα **δεν** κλειδώνει — είναι
 * διαφορετική αποτυχία, με διαφορετική συνέπεια (N.12).
 *
 * 🔒 `withAuth` (ταυτότητα από τα claims) + standard rate limit. **Μόνο ανάγνωση.**
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readCompanyContactSource } from '@/services/mandate/showcase-card-import-source';
import type { CompanyContactSourceResponse } from '@/types/showcase-card-import';

async function readHandler(
  _request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<CompanyContactSourceResponse>> {
  const read = await readCompanyContactSource(getAdminFirestore(), ctx.companyId);
  switch (read.kind) {
    case 'present':
      return NextResponse.json({ source: read.source });
    case 'absent':
      return NextResponse.json({ error: 'NO_COMPANY_DATA' } as const, { status: 404 });
    case 'unavailable':
      return NextResponse.json({ error: 'READ_FAILED' } as const, { status: 503 });
  }
}

export const GET = withStandardRateLimit(withAuth<CompanyContactSourceResponse>(readHandler));
