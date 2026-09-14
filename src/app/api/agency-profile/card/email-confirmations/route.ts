/**
 * @fileoverview **«ΑΠΟΣΤΟΛΗ ΕΠΙΒΕΒΑΙΩΣΗΣ»** — ο επαγγελματίας ζητά επιβεβαίωση ενός email της κάρτας του (ADR-841 §7 Α21.18).
 * @related services/mandate/showcase-email-confirmation.service.ts · app/api/agency-profile/card/route.ts (η αδελφή)
 * @module app/api/agency-profile/card/email-confirmations/route
 *
 * 🔒 `withAuth` — **`companyId` και `uid` από τα claims, ποτέ από το σώμα**: αλλιώς η πόρτα θα έστελνε email
 * «εκ μέρους» ξένης κάρτας. Η υπηρεσία δέχεται μόνο διεύθυνση που **ήδη** δημοσιεύει αυτό το γραφείο.
 *
 * ⚠️ `withSensitiveRateLimit` ανά καλούντα **και** ποσόστωση ανά **παραλήπτη** μέσα στην υπηρεσία — το πρώτο
 * κόβει τον βρόχο, το δεύτερο τον βομβαρδισμό ξένου γραμματοκιβωτίου από πολλούς λογαριασμούς.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { issueShowcaseEmailConfirmation } from '@/services/mandate/showcase-email-confirmation.service';
import type { ShowcaseEmailConfirmationIssueRefusal } from '@/types/showcase-email-confirmation';

/** Φρουροί πόρου — η πραγματική κρίση («είναι στην κάρτα;») είναι της υπηρεσίας. */
const askSchema = z.object({
  locationId: z.string().min(1).max(128),
  email: z.string().min(1).max(254),
  /** Α21.20 — «διόρθωσα το γραμματοκιβώτιο»: ρητή δήλωση, ποτέ προεπιλογή. */
  acknowledgeReturned: z.boolean().optional(),
});

export type EmailConfirmationIssueResponse =
  | { readonly sent: true; readonly expiresAt: string }
  | { readonly error: 'CONFIRMATION_REFUSED'; readonly reason: ShowcaseEmailConfirmationIssueRefusal }
  | { readonly error: 'CONFIRMATION_FAILED' };

/** 🔑 `recipient-quota` ⇒ 429 — ο πελάτης το δείχνει ως «δοκιμάστε αύριο», όχι ως βλάβη. */
const REFUSAL_STATUS: Record<ShowcaseEmailConfirmationIssueRefusal, number> = {
  'without-showcase': 404,
  'email-not-on-card': 422,
  'recipient-quota': 429,
  'send-failed': 502,
  // Α21.20 — σύγκρουση με γνωστή κατάσταση: η οθόνη ζητά ρητό «διόρθωσα» και ξαναστέλνει.
  'mailbox-returned': 409,
};

async function handler(request: NextRequest, ctx: AuthContext): Promise<NextResponse<EmailConfirmationIssueResponse>> {
  const parsed = await readJsonBody(request, askSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const result = await issueShowcaseEmailConfirmation(getAdminFirestore(), {
    companyId: ctx.companyId,
    locationId: parsed.data.locationId,
    email: parsed.data.email,
    requestedByUid: ctx.uid,
    acknowledgeReturned: parsed.data.acknowledgeReturned === true,
  });
  switch (result.kind) {
    case 'sent':
      return NextResponse.json({ sent: true, expiresAt: result.expiresAt } as const);
    case 'refused':
      return NextResponse.json({ error: 'CONFIRMATION_REFUSED', reason: result.reason } as const, {
        status: REFUSAL_STATUS[result.reason],
      });
    case 'failed':
      return NextResponse.json({ error: 'CONFIRMATION_FAILED' } as const, { status: 503 });
  }
}

export const POST = withSensitiveRateLimit(withAuth<EmailConfirmationIssueResponse>(handler));
