/**
 * @fileoverview **Τα γεγονότα της αντικειμενικής στο κτίριο** (ADR-898 Φ4) — ο κλάδος του `PATCH /api/buildings` για
 * το σώμα `{ buildingId, objectiveValueFacts: <μερική διόρθωση> }`.
 * @related `app/api/properties/[id]/property-objective-value-patch.ts` (το ίδιο πρότυπο για τη μονάδα) ·
 *   `lib/objective-value/building-objective-value-facts.ts` (σχήμα · διόρθωση · κανόνες)
 * @module api/buildings/building-objective-value-patch
 *
 * 🔴 **ΓΙΑΤΙ ΚΛΑΔΟΣ**: η γενική διαδρομή γράφει με `update(body)` **χωρίς σχήμα**, και το Firestore αντικαθιστά
 * **ολόκληρο** το εμφωλευμένο αντικείμενο — μία απάντηση (`{ permitDate }`) θα έσβηνε τον ΣΑΟ και το στάδιο. Εδώ η
 * διόρθωση εφαρμόζεται **μέσα στη συναλλαγή, πάνω στο φρέσκο έγγραφο** (`withVersionCheckOnCurrent`).
 *
 * 🔑 **Μόνο του**: σώμα με τα γεγονότα **και** άλλα πεδία ⇒ 400 (μισή εφαρμογή δύο πράξεων = σιωπηλή ασυνέπεια).
 * 🔑 **Καμία επαναπροβολή**: η αντικειμενική του εργολάβου υπολογίζεται κατά την ανάγνωση· η δημόσια αγγελία δεν
 *   διαβάζει (ακόμη) τα γεγονότα του κτιρίου — δηλωμένο ανοιχτό, ADR-898 §16.
 * ⛔ Δηλώσεις, ποτέ ποσά (ADR-889 §10.2).
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { BUILDING_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import type { AuthContext } from '@/lib/auth';
import { withVersionCheckOnCurrent } from '@/lib/firestore/version-check';
import { marketDayOf } from '@/lib/listings/listing-stats';
import {
  applyBuildingObjectiveValuePatch,
  BUILDING_OBJECTIVE_VALUE_BODY_KEY,
  buildingObjectiveValuePatchSchema,
  buildingObjectiveValuePatchViolations,
  readBuildingObjectiveValueFacts,
  type BuildingObjectiveValuePatch,
} from '@/lib/objective-value/building-objective-value-facts';
import { EntityAuditService } from '@/services/entity-audit.service';

/** Το κλειδί σώματος του κλάδου — δηλώνεται ΜΙΑ φορά στο `lib` (το στέλνει και ο πελάτης)· η διαδρομή ρωτά «υπάρχει;». */
export { BUILDING_OBJECTIVE_VALUE_BODY_KEY };
const FIELD = BUILDING_OBJECTIVE_VALUE_BODY_KEY;

/** Επιτρέπονται δίπλα: η ταυτότητα της διαδρομής και το `_v` (αγνοείται — η διόρθωση συγχωνεύεται, δεν συγκρούεται). */
const COMPANION_KEYS: ReadonlySet<string> = new Set([FIELD, 'buildingId', '_v']);

interface BuildingObjectiveValuePatchInput {
  readonly adminDb: AdminFirestore;
  readonly buildingId: string;
  readonly body: Readonly<Record<string, unknown>>;
  readonly ctx: AuthContext;
}

/** Σχήμα + μοναξιά του κλειδιού → η διόρθωση, ή 400. */
function patchOf(body: Readonly<Record<string, unknown>>): BuildingObjectiveValuePatch {
  if (Object.keys(body).some((key) => !COMPANION_KEYS.has(key))) {
    throw new ApiError(400, `${FIELD} must be sent on its own`);
  }
  const parsed = buildingObjectiveValuePatchSchema.safeParse(body[FIELD]);
  if (!parsed.success) throw new ApiError(400, 'Validation failed');
  return parsed.data;
}

/** Ίχνος (fire-and-forget) — ποιος άλλαξε ποιο γεγονός. */
async function recordAudit(
  input: BuildingObjectiveValuePatchInput,
  before: Readonly<Record<string, unknown>>,
  applied: Readonly<Record<string, unknown>>,
): Promise<void> {
  const changes = await EntityAuditService.diffFieldsWithResolution(before, { ...applied }, BUILDING_TRACKED_FIELDS, {});
  if (changes.length === 0) return;
  EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.BUILDING,
    entityId: input.buildingId,
    entityName: (before.name as string) ?? null,
    action: 'updated',
    changes,
    performedBy: input.ctx.uid,
    performedByName: input.ctx.email ?? null,
    companyId: input.ctx.companyId,
  }).catch(() => { /* fire-and-forget */ });
}

/**
 * Ο κλάδος: σχήμα → κανόνες με ρολόι (422) → συναλλαγή πάνω στο φρέσκο έγγραφο → ίχνος. Η θεματοφυλακή (μισθωτής)
 * έχει κριθεί **ήδη** από τον καλούντα (`loadOwnedBuilding`).
 */
export async function patchBuildingObjectiveValue(input: BuildingObjectiveValuePatchInput): Promise<NextResponse> {
  const { adminDb, buildingId, body, ctx } = input;
  const patch = patchOf(body);
  const violations = buildingObjectiveValuePatchViolations(patch, marketDayOf(Date.now()));
  if (violations.length > 0) return NextResponse.json({ error: 'INVALID_FACTS', violations }, { status: 422 });

  const { newVersion, before, applied } = await withVersionCheckOnCurrent({
    db: adminDb,
    collection: COLLECTIONS.BUILDINGS,
    docId: buildingId,
    userId: ctx.uid,
    derive: (current) => ({ [FIELD]: applyBuildingObjectiveValuePatch(readBuildingObjectiveValueFacts(current[FIELD]), patch) }),
  });

  await recordAudit(input, before, applied);
  return apiSuccess({ buildingId, updated: true, _v: newVersion }, 'Building updated');
}
