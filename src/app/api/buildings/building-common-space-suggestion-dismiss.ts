/**
 * @fileoverview **Μόνιμη απόρριψη πρότασης κοινόχρηστου χώρου** (ADR-931 §6.2 · Β2) — ο κλάδος του `PATCH /api/buildings`
 * για το σώμα `{ buildingId, dismissCommonSpaceSuggestion: '<κλειδί>' }`.
 * @related `lib/common-spaces/common-space-suggestions.ts` (κλειδί · ανάγνωση · ιδεμποτική προσθήκη) ·
 *   `building-objective-value-patch.ts` (το ίδιο πρότυπο κλάδου)
 * @module api/buildings/building-common-space-suggestion-dismiss
 *
 * 🔑 **Προσθήκη πάνω στο ΦΡΕΣΚΟ έγγραφο, μέσα σε συναλλαγή** (`withVersionCheckOnCurrent`): δύο απορρίψεις από δύο
 *   καρτέλες δεν σβήνουν η μία την άλλη (όπως θα έκανε ένα `update({ λίστα })` από τον πελάτη).
 * 🔑 **Μόνο του**: σώμα με την απόρριψη **και** άλλα πεδία ⇒ 400. Η γενική διαδρομή αρνείται το πεδίο (λευκή λίστα
 *   `building-write-fields`), άρα αυτός είναι ο **ένας** γραφέας του.
 * 🔑 **Ιδεμποτικό**: ξανά το ίδιο κλειδί ⇒ ίδια λίστα. Όριο `MAX_DISMISSED_COMMON_SPACE_SUGGESTIONS` ⇒ 422, ποτέ
 *   σιωπηλή απόρριψη παλιότερης.
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
  isCommonSpaceSuggestionKey,
  MAX_DISMISSED_COMMON_SPACE_SUGGESTIONS,
  readDismissedCommonSpaceSuggestions,
  withDismissedCommonSpaceSuggestion,
} from '@/lib/common-spaces/common-space-suggestions';
import { withVersionCheckOnCurrent } from '@/lib/firestore/version-check';
import { recordEntityUpdate } from '@/services/audit/record-entity-update';

export { DISMISS_COMMON_SPACE_SUGGESTION_BODY_KEY };
const BODY_KEY = DISMISS_COMMON_SPACE_SUGGESTION_BODY_KEY;
const FIELD = DISMISSED_COMMON_SPACE_SUGGESTIONS_FIELD;

/** Επιτρέπονται δίπλα: η ταυτότητα της διαδρομής και το `_v` (αγνοείται — η προσθήκη συγχωνεύεται, δεν συγκρούεται). */
const COMPANION_KEYS: ReadonlySet<string> = new Set([BODY_KEY, 'buildingId', '_v']);

interface DismissInput {
  readonly adminDb: AdminFirestore;
  readonly buildingId: string;
  readonly body: Readonly<Record<string, unknown>>;
  readonly ctx: AuthContext;
}

/** Μοναξιά του κλειδιού + μορφή → το κλειδί, ή 400. */
function keyOf(body: Readonly<Record<string, unknown>>): string {
  if (Object.keys(body).some((key) => !COMPANION_KEYS.has(key))) {
    throw new ApiError(400, `${BODY_KEY} must be sent on its own`);
  }
  const key = body[BODY_KEY];
  if (!isCommonSpaceSuggestionKey(key)) throw new ApiError(400, 'Validation failed');
  return key;
}

/** Η νέα λίστα πάνω στο φρέσκο έγγραφο, ή 422 όταν θα ξεπερνούσε το όριο. */
function deriveDismissed(current: Readonly<Record<string, unknown>>, key: string): Record<string, unknown> {
  const next = withDismissedCommonSpaceSuggestion(readDismissedCommonSpaceSuggestions(current[FIELD]), key);
  if (next.length > MAX_DISMISSED_COMMON_SPACE_SUGGESTIONS) {
    throw new ApiError(422, 'Too many dismissed common space suggestions', 'DISMISSED_LIMIT');
  }
  return { [FIELD]: next };
}

/**
 * Ο κλάδος: σχήμα → συναλλαγή πάνω στο φρέσκο έγγραφο → ίχνος. Η θεματοφυλακή (μισθωτής) έχει κριθεί **ήδη** από τον
 * καλούντα (`loadOwnedBuilding`).
 */
export async function dismissBuildingCommonSpaceSuggestion(input: DismissInput): Promise<NextResponse> {
  const { adminDb, buildingId, body, ctx } = input;
  const key = keyOf(body);

  const { newVersion, before, applied } = await withVersionCheckOnCurrent({
    db: adminDb,
    collection: COLLECTIONS.BUILDINGS,
    docId: buildingId,
    userId: ctx.uid,
    derive: (current) => deriveDismissed(current, key),
  });

  // Ίχνος — ποιος απέρριψε ποια πρόταση. Ο **ίδιος** γραφέας με τη γενική διαδρομή του PATCH.
  await recordEntityUpdate({ entityType: ENTITY_TYPES.BUILDING, entityId: buildingId, before, written: applied, ctx });
  return apiSuccess({ buildingId, updated: true, _v: newVersion }, 'Building updated');
}
