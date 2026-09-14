/**
 * @fileoverview 🏆 **Η ΚΑΡΤΑ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ** — ανάγνωση και αποθήκευση, ως δική της πράξη
 *   (ADR-841 §7 Α21.16).
 * @related services/mandate/showcase-card-custody · app/api/agency-profile/card/card-request
 * @module app/api/agency-profile/card/route
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ `GET` — ΕΝΩ Η ΒΙΤΡΙΝΑ ΔΕΝ ΕΧΕΙ**: η βιτρίνα διαβάζεται απευθείας (`read: if
 * true`)· τα κανάλια της κάρτας **όχι** (`deny_all`). Ο ιδιοκτήτης χρειάζεται τα δικά του τηλέφωνα
 * για να τα επεξεργαστεί, και αυτή είναι η **μόνη** πόρτα που του τα δίνει — με ταυτότητα από τα
 * claims, ποτέ από το σώμα.
 *
 * 🔒 `withAuth` + standard rate limit. **Κανένας `gateShowcase`** — ίδιο σκεπτικό με το σήμα: η
 * κάρτα είναι *«πού με βρίσκεις»*, όχι ρυθμιζόμενη πράξη· φρουρός ικανότητας θα ζητούσε από τον
 * υδραυλικό άδεια μεσιτείας για να δημοσιεύσει το τηλέφωνό του.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  readOwnedShowcaseCard,
  saveShowcaseCard,
} from '@/services/mandate/showcase-card-custody';
import { cardSchema, verifyLocations, type ShowcaseCardResponse } from './card-request';

/** **«Δείξε μου την κάρτα μου.»** */
async function readHandler(
  _request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ShowcaseCardResponse>> {
  const read = await readOwnedShowcaseCard(getAdminFirestore(), ctx.companyId);
  switch (read.kind) {
    case 'owned':
      return NextResponse.json({ locations: read.locations });
    case 'without-showcase':
      return NextResponse.json({ error: 'SHOWCASE_NOT_PUBLISHED' } as const, { status: 404 });
    // 🔴 **Δεν μάθαμε** — ποτέ «δεν έχεις κάρτα»: η οθόνη θα πρότεινε να τη γράψεις από την αρχή.
    case 'failed':
      return NextResponse.json({ error: 'READ_FAILED' } as const, { status: 503 });
  }
}

/** **«Αυτή είναι η κάρτα μου.»** — ολόκληρη. */
async function saveHandler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ShowcaseCardResponse>> {
  const adminDb = getAdminFirestore();

  const parsed = await readJsonBody(request, cardSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const verified = await verifyLocations(adminDb, parsed.data);
  if ('rejected' in verified) return verified.rejected;

  const result = await saveShowcaseCard(adminDb, ctx.companyId, verified.declared);
  switch (result.kind) {
    case 'saved':
      return NextResponse.json({ locations: result.locations });
    case 'rejected':
      return NextResponse.json({ error: 'INVALID_CARD', reason: result.reason } as const, { status: 422 });
    case 'failed':
      return NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 500 });
  }
}

export const GET = withStandardRateLimit(withAuth<ShowcaseCardResponse>(readHandler));
export const PUT = withStandardRateLimit(withAuth<ShowcaseCardResponse>(saveHandler));
