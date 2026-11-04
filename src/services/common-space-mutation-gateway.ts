'use client';

/**
 * Κοινόχρηστος χώρος — η ΜΙΑ πόρτα μεταλλάξεων του πελάτη (ADR-931).
 *
 * Όλες οι γραφές περνούν από το `/api/common-spaces` (Admin SDK · ο κανόνας `common_spaces`
 * αρνείται κάθε client write). Ο `apiClient` κουβαλά `Idempotency-Key` ανά πράξη (ADR-872),
 * άρα μια αυτόματη επανάληψη μετά από `5xx` δεν γεννά δεύτερο χώρο.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { CommonSpaceCategory, CommonSpaceLegalNature } from '@/constants/common-space-categories';
import type { OperationalStatus } from '@/constants/operational-statuses';

/** Ό,τι γράφει η φόρμα — ίδιο σχήμα για δημιουργία και ενημέρωση (`null` = «σβήσε»). */
export interface CommonSpaceDraftPayload {
  readonly name: string;
  readonly category: CommonSpaceCategory;
  readonly legalNature: CommonSpaceLegalNature;
  readonly exclusiveUsePropertyIds: readonly string[];
  readonly floorId: string | null;
  readonly area: number | null;
  readonly code: string | null;
  readonly notes: string | null;
  readonly operationalStatus?: OperationalStatus | null;
}

export interface CommonSpaceCreateResult {
  readonly commonSpaceId: string;
}

export interface CommonSpaceUpdateResult {
  readonly id: string;
  readonly _v?: number;
}

/** Δημιουργία: τα κενά (`null`) **παραλείπονται** — η γέννηση δεν «σβήνει» τίποτα. */
function createBody(buildingId: string, draft: CommonSpaceDraftPayload): Record<string, unknown> {
  const body: Record<string, unknown> = { buildingId };
  for (const [key, value] of Object.entries(draft)) {
    if (value !== null && value !== undefined) body[key] = value;
  }
  return body;
}

export function createCommonSpace(buildingId: string, draft: CommonSpaceDraftPayload): Promise<CommonSpaceCreateResult> {
  return apiClient.post<CommonSpaceCreateResult>(API_ROUTES.COMMON_SPACES.LIST, createBody(buildingId, draft));
}

export function updateCommonSpace(
  id: string,
  draft: CommonSpaceDraftPayload,
  expectedVersion?: number,
): Promise<CommonSpaceUpdateResult> {
  return apiClient.patch<CommonSpaceUpdateResult>(API_ROUTES.COMMON_SPACES.BY_ID(id), { ...draft, _v: expectedVersion });
}

export function deleteCommonSpace(id: string): Promise<unknown> {
  return apiClient.delete<unknown>(API_ROUTES.COMMON_SPACES.BY_ID(id));
}
