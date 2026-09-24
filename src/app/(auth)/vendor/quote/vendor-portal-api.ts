/**
 * Τα αιτήματα της πύλης προμηθευτή προς το API — **ΕΝΑ** σημείο (ADR-876 §5).
 *
 * 🔑 Το διαπιστευτήριο ταξιδεύει **μόνο** σε `Authorization: Bearer`, ποτέ στη διαδρομή: ζούσε
 * στο `/api/vendor/quote/<token>` (×3 fetch), δηλαδή σε κάθε access log. Οι πράξεις με σώμα JSON
 * κουβαλούν `Idempotency-Key` (CHECK 3.92), ώστε μια επανάληψη μετά από χαμένη απάντηση να
 * αναπαράγεται αντί να ξαναεκτελείται.
 *
 * @module app/(auth)/vendor/quote/vendor-portal-api
 */

import { IDEMPOTENCY_KEY_HEADER } from '@/lib/api/idempotency/idempotency-contract';
import { generateIdempotencyKey } from '@/services/enterprise-id.service';
import {
  asVendorInviteRefusal,
  type VendorInviteRefusal,
} from '@/subapps/procurement/types/vendor-invite-credential';

const VENDOR_PORTAL_API = '/api/vendor/quote';

export type VendorPortalEndpoint = '' | '/decline' | '/renew';

/** Ό,τι δεν είναι άρνηση του αναλυτή: λείπει ο σύνδεσμος, ή σφάλμα διακομιστή/δικτύου. */
export type VendorPortalFailure = VendorInviteRefusal | 'missing_link' | 'server_error';

function authorization(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Αίτημα με σώμα `FormData` (υποβολή προσφοράς) ή χωρίς σώμα (ανάγνωση). */
export function vendorPortalFetch(token: string, init: { method: 'GET' } | { method: 'POST'; body: FormData }) {
  return fetch(VENDOR_PORTAL_API, { ...init, headers: authorization(token), cache: 'no-store' });
}

/** Πράξη με σώμα JSON — πάντα με `Idempotency-Key`, ένα ανά πράξη. */
export function vendorPortalAction(token: string, endpoint: Exclude<VendorPortalEndpoint, ''>, body: unknown) {
  return fetch(`${VENDOR_PORTAL_API}${endpoint}`, {
    method: 'POST',
    headers: {
      ...authorization(token),
      'content-type': 'application/json',
      [IDEMPOTENCY_KEY_HEADER]: generateIdempotencyKey(),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

/** Ο κωδικός σφάλματος μιας αποτυχημένης απάντησης → ονομασμένη αποτυχία. */
export async function vendorPortalFailureOf(response: Response): Promise<VendorPortalFailure> {
  const json: unknown = await response.json().catch(() => null);
  const code = json && typeof json === 'object' ? (json as { error?: unknown }).error : null;
  if (code === 'missing_link') return 'missing_link';
  return asVendorInviteRefusal(code) ?? 'server_error';
}
