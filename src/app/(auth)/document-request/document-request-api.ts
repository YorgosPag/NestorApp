/**
 * @fileoverview ADR-915 §28 — ο client της σελίδας `/document-request`: όψη και απάντηση με `Authorization: Bearer`.
 * @related server/issuance-invitations/issuance-link-door.ts (η πόρτα) · app/(auth)/vendor/quote/vendor-portal-api.ts (το πρότυπο)
 * @module app/(auth)/document-request/document-request-api
 *
 * 🔒 Το διαπιστευτήριο ταξιδεύει **μόνο** σε κεφαλίδα — ποτέ σε διαδρομή ή query (access logs · `Referer`).
 * 🔑 Η απάντηση φέρει **ένα** `Idempotency-Key` ανά πάτημα: επανάληψη δικτύου ⇒ η ίδια απάντηση, ποτέ δεύτερη πράξη.
 */

import { IDEMPOTENCY_KEY_HEADER } from '@/lib/api/idempotency/idempotency-contract';
import type { IssuanceLinkAnswerBody } from '@/lib/document-validity/issuance-request';
import { isOneOf } from '@/lib/type-guards';
import { generateIdempotencyKey } from '@/services/enterprise-id.service';
import { CORE_INVITATION_REFUSALS } from '@/types/invitation-core';
import { ISSUANCE_LINK_REFUSALS, type IssuanceLinkView } from '@/types/issuance-invitation';

const VIEW_API = '/api/issuance-link';
const ANSWER_API = '/api/issuance-link/answer';

/** Κάθε αποτυχία που μπορεί να ονομάσει η σελίδα — ίδιοι κωδικοί με την πόρτα (`issuance-link-door.ts`). */
export const DOCUMENT_REQUEST_FAILURES = [
  ...CORE_INVITATION_REFUSALS, ...ISSUANCE_LINK_REFUSALS, 'missing-link', 'unavailable', 'server-error',
] as const;
export type DocumentRequestFailure = (typeof DOCUMENT_REQUEST_FAILURES)[number];

export type ApiOutcome<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly failure: DocumentRequestFailure };

async function outcomeOf<T>(response: Response): Promise<ApiOutcome<T>> {
  const json: unknown = await response.json().catch(() => null);
  const record = json !== null && typeof json === 'object' ? (json as { data?: T; error?: unknown }) : {};
  if (response.ok && record.data !== undefined) return { ok: true, data: record.data };
  return { ok: false, failure: isOneOf(DOCUMENT_REQUEST_FAILURES, record.error) ? record.error : 'server-error' };
}

async function guarded<T>(request: () => Promise<Response>): Promise<ApiOutcome<T>> {
  try {
    return await outcomeOf<T>(await request());
  } catch {
    return { ok: false, failure: 'server-error' };
  }
}

/** Η όψη — καμία πράξη (GET). */
export function fetchDocumentRequest(token: string): Promise<ApiOutcome<IssuanceLinkView>> {
  return guarded(() => fetch(VIEW_API, { method: 'GET', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }));
}

/** Η απάντηση — POST με ένα κλειδί ιδεμποτίας ανά πάτημα. */
export function answerDocumentRequest(token: string, body: IssuanceLinkAnswerBody): Promise<ApiOutcome<{ readonly answer: IssuanceLinkAnswerBody['answer'] }>> {
  return guarded(() => fetch(ANSWER_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json', [IDEMPOTENCY_KEY_HEADER]: generateIdempotencyKey() },
    body: JSON.stringify(body),
    cache: 'no-store',
  }));
}
