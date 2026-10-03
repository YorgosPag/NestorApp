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
import type { CaseEngagementAnswer, CredentialDeclarationInput } from '@/lib/conveyance/declared-credential';
import type { CaseFileMode } from '@/lib/conveyance/case-activity';
import type { CaseActivityItem, CaseProfessionalSlot, EngagedCaseView, MyCaseCard } from '@/types/conveyance-case';
import { isEngagementVerdict, type ConsentBasis, type EngagementVerdict } from '@/types/engagement';
import { isEngagementInvitationRefusal, type EngagementInvitationRefusal } from '@/types/engagement-invitation';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

// =============================================================================
// ΟΙΚΟΔΕΣΠΟΤΗΣ
// =============================================================================

export function fetchCaseProfessionalSlots(caseId: string): Promise<{ readonly slots: readonly CaseProfessionalSlot[] }> {
  return apiClient.get(API_ROUTES.CONVEYANCE_CASES.ENGAGEMENTS(caseId));
}

/** Η έκβαση της **αποστολής** του email πρόσκλησης (ADR-901 Φ3) — `null` ⇒ ήταν πρόταση σε λογαριασμό. */
export const INVITATION_DELIVERIES = ['accepted', 'unaddressable', 'failed'] as const;
export type InvitationDelivery = (typeof INVITATION_DELIVERIES)[number];

export interface CaseOfferResponse {
  readonly slots: readonly CaseProfessionalSlot[];
  readonly invited: InvitationDelivery | null;
}

/** Πρόταση σε λογαριασμό **ή** πρόσκληση με email — και επαναποστολή (ίδια πράξη, ADR-853 §8 απόκλιση 1). */
export function offerCaseEngagementRequest(
  caseId: string,
  role: LegalProfessionalRole,
  attestedBasis: ConsentBasis | null,
): Promise<CaseOfferResponse> {
  return apiClient.post(API_ROUTES.CONVEYANCE_CASES.ENGAGEMENTS(caseId), { role, attestedBasis });
}

export function revokeCaseInvitationRequest(caseId: string, role: LegalProfessionalRole): Promise<{ readonly slots: readonly CaseProfessionalSlot[] }> {
  return apiClient.post(API_ROUTES.CONVEYANCE_CASES.INVITATION_REVOKE(caseId, role), {});
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

/** «Αναλαμβάνω» (με δήλωση ιδιότητας, Ε-4) / «Δεν αναλαμβάνω». */
export function respondToEngagementRequest(engagementId: string, answer: CaseEngagementAnswer): Promise<{ readonly card: MyCaseCard }> {
  return apiClient.post(API_ROUTES.ENGAGEMENTS.RESPOND(engagementId), answer);
}

export function fetchEngagedCase(engagementId: string): Promise<{ readonly view: EngagedCaseView }> {
  return apiClient.get(API_ROUTES.ENGAGEMENTS.CASE(engagementId));
}

/** Ο σύνδεσμος 15′ προς ένα τεκμήριο της υπόθεσης — ο server γράφει το ίχνος (`document_accessed`). */
export interface CaseFileLink {
  readonly url: string;
  readonly expiresAt: number;
  readonly fileName: string;
  readonly contentType: string;
}

export function openEngagedCaseFile(engagementId: string, fileId: string, mode: CaseFileMode): Promise<CaseFileLink> {
  return apiClient.post(API_ROUTES.ENGAGEMENTS.CASE_FILE(engagementId, fileId), { mode });
}

export function fetchEngagedCaseActivity(engagementId: string): Promise<{ readonly items: readonly CaseActivityItem[] }> {
  return apiClient.get(API_ROUTES.ENGAGEMENTS.CASE_ACTIVITY(engagementId));
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

// =============================================================================
// ΠΡΟΣΚΛΗΣΗ ΜΕ EMAIL — ο επαγγελματίας (ADR-901 Φ3)
// =============================================================================

export type CaseInvitationRedeemResult =
  | { readonly kind: 'accepted'; readonly engagementId: string }
  | { readonly kind: 'declined' }
  | { readonly kind: 'refused'; readonly reason: EngagementInvitationRefusal }
  | { readonly kind: 'failed' };

/** Η απάντηση από την οθόνη `/case-invite/[token]` — **ποτέ** δεν πετά· κάθε αποτυχία είναι ονομασμένη. */
export async function redeemCaseInvitationFromScreen(
  token: string,
  answer: { readonly action: 'accept'; readonly credential: CredentialDeclarationInput } | { readonly action: 'decline' },
): Promise<CaseInvitationRedeemResult> {
  try {
    const body = await apiClient.post<{ status: 'accepted'; engagementId: string } | { status: 'declined' }>(
      API_ROUTES.ENGAGEMENTS.INVITATION_REDEEM, { token, ...answer },
    );
    return body.status === 'accepted' ? { kind: 'accepted', engagementId: body.engagementId } : { kind: 'declined' };
  } catch (cause: unknown) {
    const body = apiErrorBodyOf(cause);
    const reason = body?.error === 'LINK_REFUSED' ? body.reason : null;
    return isEngagementInvitationRefusal(reason) ? { kind: 'refused', reason } : { kind: 'failed' };
  }
}

/** Η ετυμηγορία όταν η **δική μου** συμμετοχή δεν δίνει πρόσβαση τώρα (403 της σελίδας υπόθεσης). */
export function deniedVerdictOf(error: unknown): EngagementVerdict | null {
  const body = apiErrorBodyOf(error);
  if (body?.error !== 'ENGAGEMENT_NOT_ACTIVE') return null;
  return isEngagementVerdict(body.verdict) ? body.verdict : null;
}
