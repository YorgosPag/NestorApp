/**
 * Τα αιτήματα της πύλης προμηθευτή προς το API — **ΕΝΑ** σημείο (ADR-876 §5).
 *
 * 🔑 Το διαπιστευτήριο ταξιδεύει **μόνο** σε `Authorization: Bearer`, ποτέ στη διαδρομή: ζούσε
 * στο `/api/vendor/quote/<token>` (×3 fetch), δηλαδή σε κάθε access log. **Κάθε** πράξη — JSON **και**
 * multipart (υποβολή προσφοράς) — κουβαλά `Idempotency-Key` (CHECK 3.92), ώστε μια επανάληψη μετά από
 * χαμένη απάντηση να αναπαράγεται αντί να ξαναεκτελείται.
 *
 * 🔴 Ως τις 2026-10-28 η υποβολή έφευγε **χωρίς** κλειδί: σε ζωντανή δοκιμή μία υποβολή (ένα POST στο
 * δίκτυο του browser) έγραψε **δύο** φορές — δημιουργία + «επεξεργασία» 110″ μετά, με νέα ids γραμμών,
 * ψεύτικη γραμμή `portal_edited` και δεύτερη ειδοποίηση PM (ADR-327 changelog 2026-10-28).
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

/** Οι κεφαλίδες μιας **πράξης**: σύνδεσμος + ένα `Idempotency-Key` ανά πράξη — ΕΝΑ σημείο για JSON και multipart. */
function actionHeaders(token: string): Record<string, string> {
  return { ...authorization(token), [IDEMPOTENCY_KEY_HEADER]: generateIdempotencyKey() };
}

/** Αίτημα με σώμα `FormData` (υποβολή προσφοράς — πράξη, με κλειδί) ή χωρίς σώμα (ανάγνωση). */
export function vendorPortalFetch(token: string, init: { method: 'GET' } | { method: 'POST'; body: FormData }) {
  const headers = init.method === 'GET' ? authorization(token) : actionHeaders(token);
  return fetch(VENDOR_PORTAL_API, { ...init, headers, cache: 'no-store' });
}

/** Πράξη με σώμα JSON — πάντα με `Idempotency-Key`, ένα ανά πράξη. */
export function vendorPortalAction(token: string, endpoint: Exclude<VendorPortalEndpoint, ''>, body: unknown) {
  return fetch(`${VENDOR_PORTAL_API}${endpoint}`, {
    method: 'POST',
    headers: { ...actionHeaders(token), 'content-type': 'application/json' },
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
