'use client';

import {
  createBuilding,
  deleteBuilding,
  updateBuilding,
  getBuildingCodesByProject,
  type BuildingCreatePayload,
  type BuildingUpdatePayload,
  type BuildingUpdateClientResult,
} from '@/components/building-management/building-services';
import { API_ROUTES } from '@/config/domain-constants';
import { suggestNextBuildingCode } from '@/config/entity-code-config';
import { apiClient } from '@/lib/api/enterprise-api-client';
import {
  DISMISS_COMMON_SPACE_SUGGESTION_BODY_KEY,
  DISMISSED_COMMON_SPACE_SUGGESTIONS_FIELD,
  readDismissedCommonSpaceSuggestions,
  RESTORE_COMMON_SPACE_SUGGESTIONS_BODY_KEY,
  type CommonSpaceSuggestionRestore,
} from '@/lib/common-spaces/common-space-suggestion-dismissals';
import {
  applyBuildingObjectiveValuePatch,
  BUILDING_OBJECTIVE_VALUE_BODY_KEY,
  type BuildingObjectiveValueFacts,
  type BuildingObjectiveValuePatch,
} from '@/lib/objective-value/building-objective-value-facts';
import type { ObjectiveValueWriteOutcome } from '@/lib/objective-value/objective-value-improve-subject';
import { objectiveValueWriteFailureOf } from '@/lib/objective-value/objective-value-write-failure';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime/RealtimeService';

const logger = createModuleLogger('BuildingMutationGateway');

interface GuardedBuildingUpdateInput {
  readonly buildingId: string;
  readonly updates: BuildingUpdatePayload & { _v?: number };
}

interface GuardedBuildingDeleteInput {
  readonly buildingId: string;
}

/**
 * ADR-233 §3.4: Wraps createBuildingWithPolicy with a single automatic retry
 * when the server rejects the code as duplicate (race condition / stale cache).
 * On conflict, re-fetches fresh codes for the project and picks the next slot.
 */
export async function createBuildingWithCodeRetry(
  payload: BuildingCreatePayload,
): Promise<{ success: boolean; buildingId?: string; error?: string; errorCode?: string }> {
  let result = await createBuilding(payload);

  if (!result.success && result.errorCode === 'POLICY_DUPLICATE_CODE' && payload.projectId) {
    logger.warn('Building code conflict — retrying with fresh code', { staleCode: payload.code });
    const freshCodes = await getBuildingCodesByProject(String(payload.projectId));
    const freshCode = suggestNextBuildingCode(freshCodes);
    result = await createBuilding({ ...payload, code: freshCode });
  }

  return result;
}

export async function updateBuildingWithPolicy({
  buildingId,
  updates,
}: GuardedBuildingUpdateInput): Promise<BuildingUpdateClientResult> {
  return updateBuilding(buildingId, updates);
}

export async function deleteBuildingWithPolicy({
  buildingId,
}: GuardedBuildingDeleteInput): Promise<{ success: boolean; error?: string }> {
  return deleteBuilding(buildingId);
}

/**
 * **Ένα γεγονός της αντικειμενικής του κτιρίου** (ADR-898 Φ4β) — μερική διόρθωση που ο server εφαρμόζει σε συναλλαγή
 * πάνω στο φρέσκο έγγραφο (`building-objective-value-patch.ts`). Το σώμα στέλνεται **μόνο του**: ο κλάδος αρνείται
 * μείξη με άλλα πεδία.
 *
 * 🔑 Το `BUILDING_UPDATED` φέρει την **ολόκληρη** μετά-κατάσταση, υπολογισμένη με την **ίδια** συνάρτηση με τον server
 *   (`applyBuildingObjectiveValuePatch`) — ποτέ μισό αντικείμενο που ένας ακροατής θα συγχώνευε λάθος.
 * ⚠️ Δεν πετά ποτέ: η ουρά της οθόνης θέλει **αποτέλεσμα** (`saved` · `rejected` με λόγο · `failed` = ξαναδοκίμασε).
 */
export async function updateBuildingObjectiveValueFactsWithPolicy({
  buildingId,
  current,
  patch,
}: {
  readonly buildingId: string;
  readonly current: BuildingObjectiveValueFacts;
  readonly patch: BuildingObjectiveValuePatch;
}): Promise<ObjectiveValueWriteOutcome> {
  try {
    await apiClient.patch(API_ROUTES.BUILDINGS.LIST, { buildingId, [BUILDING_OBJECTIVE_VALUE_BODY_KEY]: patch });
  } catch (cause) {
    logger.warn('Building objective-value facts were not saved', { data: { buildingId }, error: cause instanceof Error ? cause.message : String(cause) });
    return objectiveValueWriteFailureOf(cause);
  }
  RealtimeService.dispatch('BUILDING_UPDATED', {
    buildingId,
    updates: { objectiveValueFacts: applyBuildingObjectiveValuePatch(current, patch) },
    timestamp: Date.now(),
  });
  return { kind: 'saved' };
}

/**
 * Μία πράξη πάνω στις απορρίψεις κοινοχρήστων (ADR-931 §6.2) — ο server την εφαρμόζει σε συναλλαγή πάνω στο φρέσκο
 * έγγραφο (`building-common-space-suggestion-dismissals.ts`), με ιστορικό, και επιστρέφει την **τελική** λίστα.
 *
 * 🔑 Το `BUILDING_UPDATED` φέρει **αυτή** τη λίστα — με το ποιος/πότε του server, όχι πελατειακή εκδοχή της ώρας.
 * ⚠️ Πετά σε αποτυχία: ο καλών έχει ήδη αλλάξει την οθόνη αισιόδοξα και πρέπει να την επαναφέρει.
 */
async function patchCommonSpaceSuggestionDismissals(buildingId: string, body: Record<string, unknown>): Promise<void> {
  const result = await apiClient.patch<Record<string, unknown>>(API_ROUTES.BUILDINGS.LIST, { buildingId, ...body });
  RealtimeService.dispatch('BUILDING_UPDATED', {
    buildingId,
    updates: { dismissedCommonSpaceSuggestions: readDismissedCommonSpaceSuggestions(result?.[DISMISSED_COMMON_SPACE_SUGGESTIONS_FIELD]) },
    timestamp: Date.now(),
  });
}

/** **Μόνιμη απόρριψη μιας πρότασης κοινόχρηστου** — ποιος/πότε τα γράφει ο server. */
export function dismissCommonSpaceSuggestionWithPolicy({ buildingId, key }: {
  readonly buildingId: string;
  readonly key: string;
}): Promise<void> {
  return patchCommonSpaceSuggestionDismissals(buildingId, { [DISMISS_COMMON_SPACE_SUGGESTION_BODY_KEY]: key });
}

/** **Επαναφορά** απορριφθεισών προτάσεων κοινοχρήστων — συγκεκριμένα κλειδιά, ή `'all'`. */
export function restoreCommonSpaceSuggestionsWithPolicy({ buildingId, restore }: {
  readonly buildingId: string;
  readonly restore: CommonSpaceSuggestionRestore;
}): Promise<void> {
  return patchCommonSpaceSuggestionDismissals(buildingId, { [RESTORE_COMMON_SPACE_SUGGESTIONS_BODY_KEY]: restore });
}
