/**
 * @fileoverview **Απόρριψη και επαναφορά προτάσεων κοινόχρηστου χώρου** (ADR-931 §6.2 · Β2) — ο ΕΝΑΣ κλάδος του
 * `PATCH /api/buildings` που γράφει το `Building.dismissedCommonSpaceSuggestions`, με δύο πράξεις:
 * `{ buildingId, dismissCommonSpaceSuggestion: '<κλειδί>' }` · `{ buildingId, restoreCommonSpaceSuggestions: [...] | 'all' }`.
 * @related `lib/common-spaces/common-space-suggestion-dismissals.ts` (σχήμα · ανάγνωση · ιδεμποτικές πράξεις) ·
 *   `building-objective-value-patch.ts` (το ίδιο πρότυπο κλάδου)
 * @module api/buildings/building-common-space-suggestion-dismissals
 *
 * 🔑 **Πάνω στο ΦΡΕΣΚΟ έγγραφο, μέσα σε συναλλαγή** (`withVersionCheckOnCurrent`): δύο καρτέλες δεν σβήνουν η μία την
 *   άλλη (όπως θα έκανε ένα `update({ λίστα })` από τον πελάτη).
 * 🔑 **Ποιος/πότε από τον server**, ποτέ από το σώμα: `ctx.uid` + ώρα του server.
 * 🔑 **Μόνη της**: σώμα με την πράξη **και** άλλα πεδία (ή και τις δύο πράξεις) ⇒ 400. Η γενική διαδρομή αρνείται το
 *   πεδίο (λευκή λίστα `building-write-fields`), άρα αυτός είναι ο **ένας** γραφέας του.
 * 🔑 **Ιδεμποτικές**: ξανά το ίδιο ⇒ ίδια λίστα (το ιστορικό δεν γράφει γραμμή χωρίς διαφορά). Όριο
 *   `MAX_DISMISSED_COMMON_SPACE_SUGGESTIONS` ⇒ 422, ποτέ σιωπηλή απόρριψη παλιότερης.
 * 🔑 Η απάντηση φέρει την **τελική** λίστα — ο πελάτης την εκπέμπει ως έχει (καμία δεύτερη, πελατειακή εκδοχή της ώρας).
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import type { AuthContext } from '@/lib/auth';
import {
  DISMISS_COMMON_SPACE_SUGGESTION_BODY_KEY,
  DISMISSED_COMMON_SPACE_SUGGESTIONS_FIELD,
  MAX_DISMISSED_COMMON_SPACE_SUGGESTIONS,
  parseCommonSpaceSuggestionRestore,
  readDismissedCommonSpaceSuggestions,
  RESTORE_COMMON_SPACE_SUGGESTIONS_BODY_KEY,
  withDismissedCommonSpaceSuggestion,
  withoutDismissedCommonSpaceSuggestions,
  type DismissedCommonSpaceSuggestion,
} from '@/lib/common-spaces/common-space-suggestion-dismissals';
import { isCommonSpaceSuggestionKey } from '@/lib/common-spaces/common-space-suggestions';
import { nowISO } from '@/lib/date-local';
import { withVersionCheckOnCurrent } from '@/lib/firestore/version-check';
import { recordEntityUpdate } from '@/services/audit/record-entity-update';

const FIELD = DISMISSED_COMMON_SPACE_SUGGESTIONS_FIELD;

type Dismissals = readonly DismissedCommonSpaceSuggestion[];

interface SuggestionDismissalsInput {
  readonly adminDb: AdminFirestore;
  readonly buildingId: string;
  readonly body: Readonly<Record<string, unknown>>;
  readonly ctx: AuthContext;
}

/** Το σώμα κουβαλά πράξη απόρριψης/επαναφοράς; — ο δρομολογητής ρωτά **εδώ**, όχι με δικά του κλειδιά. */
export function isCommonSpaceSuggestionDismissalsBody(body: Readonly<Record<string, unknown>>): boolean {
  return DISMISS_COMMON_SPACE_SUGGESTION_BODY_KEY in body || RESTORE_COMMON_SPACE_SUGGESTIONS_BODY_KEY in body;
}

/** Μοναξιά της πράξης: μόνο αυτή + η ταυτότητα της διαδρομής + `_v` (αγνοείται — συγχώνευση, όχι σύγκρουση). */
function assertAlone(body: Readonly<Record<string, unknown>>, bodyKey: string): void {
  const companions: ReadonlySet<string> = new Set([bodyKey, 'buildingId', '_v']);
  if (Object.keys(body).some((key) => !companions.has(key))) {
    throw new ApiError(400, `${bodyKey} must be sent on its own`);
  }
}

/** Η πράξη του σώματος ως «φρέσκια λίστα → νέα λίστα», ή 400. */
function operationOf(body: Readonly<Record<string, unknown>>, ctx: AuthContext): (current: Dismissals) => Dismissals {
  if (DISMISS_COMMON_SPACE_SUGGESTION_BODY_KEY in body) {
    assertAlone(body, DISMISS_COMMON_SPACE_SUGGESTION_BODY_KEY);
    const key = body[DISMISS_COMMON_SPACE_SUGGESTION_BODY_KEY];
    if (!isCommonSpaceSuggestionKey(key)) throw new ApiError(400, 'Validation failed');
    const record: DismissedCommonSpaceSuggestion = { key, dismissedBy: ctx.uid, dismissedAt: nowISO() };
    return (current) => withDismissedCommonSpaceSuggestion(current, record);
  }
  assertAlone(body, RESTORE_COMMON_SPACE_SUGGESTIONS_BODY_KEY);
  const restore = parseCommonSpaceSuggestionRestore(body[RESTORE_COMMON_SPACE_SUGGESTIONS_BODY_KEY]);
  if (restore === null) throw new ApiError(400, 'Validation failed');
  return (current) => withoutDismissedCommonSpaceSuggestions(current, restore);
}

/**
 * Ο κλάδος: σχήμα → συναλλαγή πάνω στο φρέσκο έγγραφο → ίχνος. Η θεματοφυλακή (μισθωτής) έχει κριθεί **ήδη** από τον
 * καλούντα (`loadOwnedBuilding`).
 */
export async function applyBuildingCommonSpaceSuggestionDismissals(input: SuggestionDismissalsInput): Promise<NextResponse> {
  const { adminDb, buildingId, body, ctx } = input;
  const operation = operationOf(body, ctx);

  let finalList: Dismissals = [];
  const { newVersion, before, applied } = await withVersionCheckOnCurrent({
    db: adminDb,
    collection: COLLECTIONS.BUILDINGS,
    docId: buildingId,
    userId: ctx.uid,
    derive: (current) => {
      finalList = operation(readDismissedCommonSpaceSuggestions(current[FIELD]));
      if (finalList.length > MAX_DISMISSED_COMMON_SPACE_SUGGESTIONS) {
        throw new ApiError(422, 'Too many dismissed common space suggestions', 'DISMISSED_LIMIT');
      }
      return { [FIELD]: finalList };
    },
  });

  // Ίχνος — ποιος απέρριψε/επανέφερε ποια πρόταση. Ο **ίδιος** γραφέας με τη γενική διαδρομή του PATCH.
  await recordEntityUpdate({ entityType: ENTITY_TYPES.BUILDING, entityId: buildingId, before, written: applied, ctx });
  return apiSuccess({ buildingId, updated: true, _v: newVersion, [FIELD]: finalList }, 'Building updated');
}
