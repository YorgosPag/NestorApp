/**
 * **Ένα** περιτύλιγμα για κάθε route του `/api/rfqs/[id]/invites/[inviteId]/…` (ADR-876 §5).
 *
 * Κάθε route εδώ κάνει το ίδιο: παράμετροι διαδρομής → `withAuth` → πράξη του service →
 * `{ success, data }` ή μεταφρασμένο σφάλμα. Γραμμένο τέσσερις φορές θα ήταν τέσσερις ευκαιρίες
 * να ξεχαστεί το `[id]` (το RFQ της διαδρομής, που τα παλιά routes αγνοούσαν) ή η μετάφραση
 * `not_found`/`not_live`.
 *
 * Σφάλματα: `not_found` ⇒ 404 (και για ξένο μισθωτή ή άλλο RFQ — ποτέ «υπάρχει αλλά όχι δικό σου») ·
 * `not_live` ⇒ 409 (υποβλήθηκε, αρνήθηκε ή ανακλήθηκε) · οτιδήποτε άλλο ⇒ 400 με μήνυμα.
 *
 * @module api/rfqs/[id]/invites/[inviteId]/invite-route
 * @enterprise ADR-876 §5
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import { VendorInviteStateError } from '@/subapps/procurement/services/vendor-invite-service';

/** Οι παράμετροι κάθε route κάτω από `[inviteId]`· βαθύτερα routes τις επεκτείνουν (π.χ. `credentialId`). */
export interface InviteRouteParams {
  readonly id: string;
  readonly inviteId: string;
}

function inviteRouteError(error: unknown): NextResponse {
  if (error instanceof VendorInviteStateError) {
    return NextResponse.json(
      { success: false, error: error.code },
      { status: error.code === 'not_found' ? 404 : 409 },
    );
  }
  return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 400 });
}

/**
 * Πράξη πρόσκλησης → handler route. Η `run` επιστρέφει είτε τα δεδομένα της απάντησης, είτε
 * έτοιμη `NextResponse` (π.χ. σφάλμα επικύρωσης σώματος).
 */
export function inviteRoute<P extends InviteRouteParams = InviteRouteParams>(
  run: (request: NextRequest, ctx: AuthContext, params: P) => Promise<unknown>,
) {
  return async (request: NextRequest, segmentData?: { params: Promise<P> }): Promise<NextResponse> => {
    const params = await segmentData!.params;
    const handler = withAuth(async (req: NextRequest, ctx: AuthContext): Promise<NextResponse> => {
      try {
        const data = await run(req, ctx, params);
        return data instanceof NextResponse ? data : NextResponse.json({ success: true, data: data ?? null });
      } catch (error) {
        return inviteRouteError(error);
      }
    });
    return handler(request);
  };
}
