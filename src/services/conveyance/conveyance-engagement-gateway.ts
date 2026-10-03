/**
 * ADR-901 Φ2 — η πόρτα του client προς τις **συμμετοχές** (οικοδεσπότης + επαγγελματίας), και ο αναγνώστης
 * των **ονομασμένων** αρνήσεών τους. Δίπλα-δίπλα, όπως `first-contact.client` + `first-contact-failure-readers`.
 *
 * Το `apiClient` βάζει μόνο του `Idempotency-Key` (ADR-872) και ξετυλίγει το `{ success, data }`.
 * Το σώμα αποτυχίας το διαβάζει **μόνο** το `apiErrorBodyOf` (SSoT) — ο διακριτής `error` ελέγχεται πρώτος
 * απέναντι σε **κλειστό** σύνολο (μάθημα ADR-844), ποτέ ελεύθερο κείμενο στην οθόνη.
 *
 * @module services/conveyance/conveyance-engagement-gateway
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import type { CaseProfessionalSlot, EngagedCaseView, MyCaseCard } from '@/types/conveyance-case';
import { isEngagementVerdict, type ConsentBasis, type EngagementVerdict } from '@/types/engagement';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

// =============================================================================
// ΟΙΚΟΔΕΣΠΟΤΗΣ
// =============================================================================

export function fetchCaseProfessionalSlots(caseId: string): Promise<{ readonly slots: readonly CaseProfessionalSlot[] }> {
  return apiClient.get(API_ROUTES.CONVEYANCE_CASES.ENGAGEMENTS(caseId));
}

export function offerCaseEngagementRequest(
  caseId: string,
  role: LegalProfessionalRole,
  attestedBasis: ConsentBasis | null,
): Promise<{ readonly slots: readonly CaseProfessionalSlot[] }> {
  return apiClient.post(API_ROUTES.CONVEYANCE_CASES.ENGAGEMENTS(caseId), { role, attestedBasis });
}

export function revokeCaseEngagementRequest(caseId: string, engagementId: string): Promise<{ readonly slots: readonly CaseProfessionalSlot[] }> {
  return apiClient.post(API_ROUTES.CONVEYANCE_CASES.ENGAGEMENT_REVOKE(caseId, engagementId), {});
}

// =============================================================================
// ΕΠΑΓΓΕΛΜΑΤΙΑΣ
// =============================================================================

export function fetchMyCases(): Promise<{ readonly cards: readonly MyCaseCard[] }> {
  return apiClient.get(API_ROUTES.ENGAGEMENTS.MINE);
}

export function respondToEngagementRequest(engagementId: string, decision: 'accept' | 'decline'): Promise<{ readonly card: MyCaseCard }> {
  return apiClient.post(API_ROUTES.ENGAGEMENTS.RESPOND(engagementId), { decision });
}

export function fetchEngagedCase(engagementId: string): Promise<{ readonly view: EngagedCaseView }> {
  return apiClient.get(API_ROUTES.ENGAGEMENTS.CASE(engagementId));
}

// =============================================================================
// ΟΙ ΑΡΝΗΣΕΙΣ — κλειστά σύνολα (ένα ανά πόρτα)
// =============================================================================

/** Οι λόγοι που η **πρόταση** δεν έγινε — ο καθένας στέλνει τον άνθρωπο σε άλλη ενέργεια. */
export const OFFER_REJECTIONS = [
  'case-closed',
  'no-project',
  'not-appointed',
  'no-email',
  'needs-invitation',
  'consent-basis-required',
  'slot-occupied',
  'role-conflict',
  'unreadable',
] as const;
export type OfferRejection = (typeof OFFER_REJECTIONS)[number];

/** Οι λόγοι που η **απάντηση** του επαγγελματία δεν έγινε. */
export const RESPOND_REJECTIONS = ['not-found', 'unknown', 'offer-expired', 'not-allowed'] as const;
export type RespondRejection = (typeof RESPOND_REJECTIONS)[number];

function namedError<T extends string>(error: unknown, allowed: readonly T[]): T | null {
  const value = apiErrorBodyOf(error)?.error;
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function offerRejectionOf(error: unknown): OfferRejection | null {
  return namedError(error, OFFER_REJECTIONS);
}

export function respondRejectionOf(error: unknown): RespondRejection | null {
  return namedError(error, RESPOND_REJECTIONS);
}

/** Η ετυμηγορία όταν η **δική μου** συμμετοχή δεν δίνει πρόσβαση τώρα (403 της σελίδας υπόθεσης). */
export function deniedVerdictOf(error: unknown): EngagementVerdict | null {
  const body = apiErrorBodyOf(error);
  if (body?.error !== 'ENGAGEMENT_NOT_ACTIVE') return null;
  return isEngagementVerdict(body.verdict) ? body.verdict : null;
}
