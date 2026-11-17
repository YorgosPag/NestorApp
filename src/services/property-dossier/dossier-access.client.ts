'use client';

/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΠΡΟΣ ΤΙΣ ΠΟΡΤΕΣ ΠΡΟΣΒΑΣΗΣ** του φακέλου (ADR-916 Φ-Ε1 Σ4) — θέσεις · πρόσκληση · ακύρωση ·
 *    ανάκληση/ανανέωση/εύρος, και ο αναγνώστης των **ονομασμένων** αρνήσεών τους.
 * @module services/property-dossier/dossier-access.client
 * @related `app/api/property-dossiers/[dossierId]/access/**` (οι πόρτες) · `_shared/access-door.ts` (`DossierAccessError`) ·
 *          `services/conveyance/conveyance-engagement-gateway.ts` (ο αδελφός της μεταβίβασης)
 *
 * 🔑 Το `apiClient` βάζει μόνο του `Idempotency-Key` (ADR-872, CHECK 3.92) και ξετυλίγει το `{ success, data }`.
 * 🔑 Τα σώματα είναι **ακριβώς** τα σχήματα της πόρτας (`DossierInvitationRequest` · `DossierEngagementChangeRequest`) —
 *    ο client δεν γράφει δεύτερο σχήμα· ό,τι δεν δέχεται η πόρτα δεν μεταγλωττίζεται εδώ.
 */

import { apiClient, apiErrorCodeOf } from '@/lib/api/enterprise-api-client';
import type {
  DossierEngagementChangeRequest,
  DossierInvitationRequest,
} from '@/lib/property-dossier/dossier-access-request-schema';
import { DOSSIER_ACCESS_ERRORS, type DossierAccessError, type DossierAccessResponse } from '@/types/dossier-access';

/** Η ρίζα των πορτών του φακέλου — ίδια με τον αδελφό πελάτη `property-dossier.service.ts`. */
function accessBase(dossierId: string): string {
  return `/api/property-dossiers/${encodeURIComponent(dossierId)}/access`;
}

/** Οι θέσεις **και** τα αρχεία του φακέλου (με την καρτέλα τους). */
export function fetchDossierAccess(dossierId: string): Promise<DossierAccessResponse> {
  return apiClient.get(accessBase(dossierId));
}

/** Πρόσκληση — και επαναποστολή στον ίδιο ρόλο (νέο token, η παλιά ακυρώνεται ατομικά). */
export function inviteToDossierRequest(dossierId: string, request: DossierInvitationRequest): Promise<DossierAccessResponse> {
  return apiClient.post(`${accessBase(dossierId)}/invitations`, request);
}

export function cancelDossierInvitationRequest(dossierId: string, invitationId: string): Promise<DossierAccessResponse> {
  return apiClient.post(`${accessBase(dossierId)}/invitations/${encodeURIComponent(invitationId)}/revoke`, {});
}

/** Ανάκληση · ανανέωση · αλλαγή εύρους — **μία** πόρτα, διακριτή ένωση στο σώμα. */
export function changeDossierEngagementRequest(
  dossierId: string,
  engagementId: string,
  change: DossierEngagementChangeRequest,
): Promise<DossierAccessResponse> {
  return apiClient.post(`${accessBase(dossierId)}/${encodeURIComponent(engagementId)}`, change);
}

/** Η ονομασμένη άρνηση μιας πόρτας (το ΕΝΑ λεξιλόγιο `DOSSIER_ACCESS_ERRORS`) — οτιδήποτε άλλο ⇒ `generic`. */
export type DossierAccessRejection = DossierAccessError | 'generic';

export function dossierAccessRejectionOf(error: unknown): DossierAccessRejection {
  return apiErrorCodeOf(error, DOSSIER_ACCESS_ERRORS) ?? 'generic';
}
