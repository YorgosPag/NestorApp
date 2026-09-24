/**
 * =============================================================================
 * Η ΠΟΡΤΑ ΤΟΥ ΣΥΝΔΕΣΜΟΥ ΠΡΟΜΗΘΕΥΤΗ — ΕΝΑ σύνορο για κάθε δημόσιο API της πύλης (ADR-876 §5)
 * =============================================================================
 *
 * Ο προμηθευτής δεν έχει λογαριασμό· **είναι** ο σύνδεσμός του. Κάθε δημόσιο API της πύλης
 * (`GET/POST /api/vendor/quote` · `/decline` · `/renew`) περνά από εδώ, με τη σειρά:
 *
 *   1. **Διαπιστευτήριο από `Authorization: Bearer`** (SSoT `extractBearerToken`) — **ποτέ** από
 *      τη διαδρομή. Ζούσε στο `/api/vendor/quote/<token>`, άρα σε κάθε access log (Σ8).
 *   2. **Υπογραφή χωρίς βάση** (`parseVendorLink`) — πλαστό = μηδέν ανάγνωση (ADR-327 §11) —
 *      που δίνει και τον **principal** της ιδεμποτίας.
 *   3. **Σύνορο ιδεμποτίας** (CHECK 3.92). Principal = `vendor-link:<credentialId>` και **όχι**
 *      `anon`: το αποτύπωμα του αιτήματος δεν περιέχει την κεφαλίδα `Authorization`, οπότε με
 *      `anon` δύο διαφορετικοί σύνδεσμοι με ίδιο κλειδί και ίδιο σώμα θα έπαιρναν ο ένας την
 *      αποθηκευμένη απάντηση του άλλου.
 *   4. **Ο ΕΝΑΣ αναλυτής** (`resolveVendorInvite`) με τον σκοπό της πράξης.
 *
 * ⚠️ **Δηλωμένο όριο**: το σύνορο ιδεμποτίας εφαρμόζεται μόνο σε σώμα JSON (`with-idempotency`).
 * Η υποβολή προσφοράς είναι multipart ⇒ περνά χωρίς κλειδί. Είναι ασφαλής εκ κατασκευής ως προς
 * τα **δεδομένα** (η δεύτερη αποστολή βρίσκει την πρόσκληση `submitted` και γίνεται επεξεργασία της
 * **ίδιας** προσφοράς, με ίδιο `quoteId`)· όχι ως προς την ειδοποίηση του PM (ADR-876 §5).
 *
 * @module server/vendor-portal/vendor-link-door
 * @enterprise ADR-876 §5 · ADR-872 · ADR-327 §11
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { runIdempotently } from '@/lib/api/idempotency/with-idempotency';
import type { IdempotencyPolicy } from '@/lib/api/idempotency/idempotency-contract';
import { extractBearerToken } from '@/lib/auth/token-credentials';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { parseVendorLink } from '@/services/vendor-portal/vendor-invite-credential';
import {
  resolveVendorInvite,
  type VendorInvitePurpose,
  type VendorInviteRefusal,
  type VendorInviteResolution,
} from '@/subapps/procurement/services/vendor-invite-resolver';

const logger = createModuleLogger('VENDOR_LINK_DOOR');

/** Ο σύνδεσμος λείπει εντελώς — ο client δεν έστειλε `Authorization`. */
export const MISSING_VENDOR_LINK = 'missing_link' as const;

/** Κάθε άρνηση → κωδικός HTTP. Εξαντλητικό: νέα άρνηση χωρίς γραμμή εδώ δεν μεταγλωττίζεται. */
const REFUSAL_STATUS: Record<VendorInviteRefusal, number> = {
  invalid_link: 400,
  server_config_error: 500,
  link_not_found: 404,
  link_revoked: 410,
  link_expired: 410,
  invite_revoked: 410,
  invite_declined: 410,
  already_submitted: 409,
  edit_window_closed: 410,
};

export function vendorPortalError(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

export function vendorRefusalResponse(reason: VendorInviteRefusal): NextResponse {
  return vendorPortalError(reason, REFUSAL_STATUS[reason]);
}

/** Η προεπιλεγμένη απάντηση της πόρτας σε άρνηση — ΜΙΑ, για κάθε δημόσιο API της πύλης. */
export function vendorDoorRefusal(reason: VendorInviteRefusal | typeof MISSING_VENDOR_LINK): NextResponse {
  return reason === MISSING_VENDOR_LINK ? vendorPortalError(reason, 401) : vendorRefusalResponse(reason);
}

export type OpenVendorInvite = Extract<VendorInviteResolution, { ok: true }>;

export interface VendorLinkDoorOptions {
  readonly purpose: VendorInvitePurpose;
  /** Μόνο με **απόδειξη** στον handler (CHECK 3.92 Κ1: `why` ≥ 15). */
  readonly idempotency?: IdempotencyPolicy;
  /**
   * Πώς απαντά η πόρτα σε άρνηση. Προεπιλογή: ονομασμένος κωδικός. Η αυτοεξυπηρέτηση λήξης
   * απαντά **ουδέτερα** σε όλα — καμία απαρίθμηση προσκλήσεων.
   */
  readonly onRefusal?: (reason: VendorInviteRefusal | typeof MISSING_VENDOR_LINK) => NextResponse;
}

export type VendorLinkHandler = (request: NextRequest, opened: OpenVendorInvite) => Promise<NextResponse>;

/** **Η πόρτα.** Επιστρέφει handler έτοιμο για `withHeavyRateLimit`. */
export function withVendorLinkDoor(
  options: VendorLinkDoorOptions,
  handler: VendorLinkHandler,
): (request: NextRequest) => Promise<NextResponse> {
  const refuse = options.onRefusal ?? vendorDoorRefusal;

  return async (request) => {
    const token = extractBearerToken(request);
    if (!token) return refuse(MISSING_VENDOR_LINK);
    const parsed = await parseVendorLink(token);
    if (!parsed.ok) return refuse(parsed.reason);

    return runIdempotently(request, `vendor-link:${parsed.credentialId}`, options.idempotency, async () => {
      try {
        const resolution = await resolveVendorInvite(token, options.purpose);
        if (!resolution.ok) return { response: refuse(resolution.reason), thrown: false };
        return { response: await handler(request, resolution), thrown: false };
      } catch (err) {
        logger.error('Vendor portal request failed', {
          purpose: options.purpose,
          error: getErrorMessage(err, 'unknown'),
        });
        return { response: vendorPortalError('server_error', 500), thrown: true };
      }
    });
  };
}
