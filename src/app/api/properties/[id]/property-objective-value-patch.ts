/**
 * @fileoverview **Οι δηλώσεις της αντικειμενικής σε ακίνητο γραφείου** (ADR-898 Φ3β-3) — ο κλάδος του
 * `PATCH /api/properties/[id]` για το σώμα `{ objectiveValueDeclarations: <μερική διόρθωση> }`.
 * @related `services/owner-property/owner-property-declarations.service.ts` (ο ίδιος κανόνας για τον ιδιώτη) ·
 *   `lib/objective-value/objective-value-declarations.ts` (σχήμα · διόρθωση · κανόνες) · `services/market/zone-front-verdict.ts`
 * @module api/properties/[id]/property-objective-value-patch
 *
 * 🔴 **ΓΙΑΤΙ ΚΛΑΔΟΣ ΚΑΙ ΟΧΙ ΑΛΛΟ ΕΝΑ ΚΛΕΙΔΙ ΤΟΥ `.passthrough()`**: η γενική διαδρομή γράφει με `update(body)`, και το
 * Firestore αντικαθιστά **ολόκληρο** το εμφωλευμένο αντικείμενο. Μία απάντηση (`{ frontage }`) θα έσβηνε όλες τις άλλες.
 * Εδώ η διόρθωση εφαρμόζεται **μέσα στη συναλλαγή, πάνω στο φρέσκο έγγραφο** (`withVersionCheckOnCurrent`) — δύο
 * απαντήσεις μέσα σε λίγα ms επιβιώνουν και οι δύο, ίδια εγγύηση με τον ιδιώτη.
 *
 * 🔑 **Μόνο του**: σώμα με τις δηλώσεις **και** άλλα πεδία ⇒ 400. Μισή εφαρμογή δύο πράξεων σε δύο διαδρομές εγγραφής
 * θα ήταν σιωπηλή ασυνέπεια.
 * 🔑 **Ίδιο δικαίωμα απόκρυψης** με τον ιδιώτη (ADR-898 §12 — μάθημα της αγωγής κατά της Zillow).
 * 🔑 **Κλείδωμα συναλλαγής** (ADR-249): πριν **και** μέσα στη συναλλαγή — η κατάσταση μπορεί να άλλαξε στο μεταξύ.
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { PROPERTY_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { AuthContext } from '@/lib/auth';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { nowISO } from '@/lib/date-local';
import { validatePropertyFieldLocking } from '@/lib/firestore/property-field-locking';
import { withVersionCheckOnCurrent } from '@/lib/firestore/version-check';
import { marketDayOf } from '@/lib/listings/listing-stats';
import {
  applyObjectiveValuePatch,
  objectiveValueDeclarationsPatchSchema,
  objectiveValuePatchViolations,
  readObjectiveValueDeclarations,
  type ObjectiveValueDeclarationsPatch,
} from '@/lib/objective-value/objective-value-declarations';
import { EntityAuditService } from '@/services/entity-audit.service';
import { resolveListingPosition } from '@/services/listings/public-listing-position';
import { collectPlaceKnowledge } from '@/services/listings/publish-public-listing';
import { zoneFrontVerdict } from '@/services/market/zone-front-verdict';

import { republishPublicProjection, type ListingProperty } from './property-publish-projection';

/** Το κλειδί σώματος του κλάδου — η ΜΙΑ δήλωση του ονόματος (η διαδρομή ρωτά «υπάρχει;»). */
export const OBJECTIVE_VALUE_BODY_KEY = 'objectiveValueDeclarations';
const FIELD = OBJECTIVE_VALUE_BODY_KEY;

/** Επιτρέπεται να συνοδεύει τις δηλώσεις: μόνο το `_v` (το αγνοούμε — η διόρθωση δεν συγκρούεται, συγχωνεύεται). */
const COMPANION_KEYS: ReadonlySet<string> = new Set([FIELD, '_v']);

interface ObjectiveValuePatchInput {
  readonly adminDb: AdminFirestore;
  readonly id: string;
  readonly existing: Readonly<Record<string, unknown>>;
  readonly body: Readonly<Record<string, unknown>>;
  readonly ctx: AuthContext;
}

/** Σχήμα + μοναξιά του κλειδιού → η διόρθωση, ή 400. */
function patchOf(body: Readonly<Record<string, unknown>>): ObjectiveValueDeclarationsPatch {
  if (Object.keys(body).some((key) => !COMPANION_KEYS.has(key))) {
    throw new ApiError(400, `${FIELD} must be sent on its own`);
  }
  const parsed = objectiveValueDeclarationsPatchSchema.safeParse(body[FIELD]);
  if (!parsed.success) throw new ApiError(400, 'Validation failed');
  return parsed.data;
}

/** Οι αρνήσεις πριν από τη συναλλαγή: κανόνες με ρολόι (422) · μέτωπο (422 / 503). `null` = προχώρα. */
async function refusalOf(
  adminDb: AdminFirestore,
  existing: Readonly<Record<string, unknown>>,
  patch: ObjectiveValueDeclarationsPatch,
): Promise<NextResponse | null> {
  const violations = objectiveValuePatchViolations(patch, marketDayOf(Date.now()));
  if (violations.length > 0) return NextResponse.json({ error: 'INVALID_DECLARATIONS', violations }, { status: 422 });
  const property = existing as ListingProperty;
  // Η θέση που ΘΑ ΔΗΜΟΣΙΕΥΤΕΙ — ίδια γνώση τόπου με τον γραφέα της προβολής (κτίριο → έργο).
  const verdict = await zoneFrontVerdict(patch, async () => {
    const at = nowISO();
    return resolveListingPosition(await collectPlaceKnowledge(adminDb, property, at), property.locationDisclosure);
  });
  if (verdict === 'zone-unverified') return NextResponse.json({ error: 'ZONE_UNVERIFIED' }, { status: 503 });
  if (verdict === 'not-candidate') {
    return NextResponse.json({ error: 'INVALID_DECLARATIONS', violations: ['zoneFrontNotCandidate'] }, { status: 422 });
  }
  return null;
}

/** Ίχνος (fire-and-forget, όπως η γενική διαδρομή) — ποιος άλλαξε ποια απάντηση. */
async function recordAudit(input: ObjectiveValuePatchInput, before: Readonly<Record<string, unknown>>, applied: Readonly<Record<string, unknown>>) {
  const changes = await EntityAuditService.diffFieldsWithResolution(before, { ...applied }, PROPERTY_TRACKED_FIELDS, {});
  if (changes.length === 0) return;
  EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: input.id,
    entityName: (before.name as string) ?? null,
    action: 'updated',
    changes,
    performedBy: input.ctx.uid,
    performedByName: input.ctx.email ?? null,
    companyId: input.ctx.companyId,
  }).catch(() => { /* fire-and-forget */ });
}

/** Ο κλάδος: έλεγχος → συναλλαγή πάνω στο φρέσκο έγγραφο → ίχνος → επαναπροβολή. */
export async function patchPropertyObjectiveValue(input: ObjectiveValuePatchInput): Promise<NextResponse> {
  const { adminDb, id, existing, body, ctx } = input;
  const patch = patchOf(body);
  validatePropertyFieldLocking(existing.commercialStatus as string | undefined, [FIELD]);
  const refusal = await refusalOf(adminDb, existing, patch);
  if (refusal !== null) return refusal;

  const { newVersion, before, applied } = await withVersionCheckOnCurrent({
    db: adminDb,
    collection: COLLECTIONS.PROPERTIES,
    docId: id,
    userId: ctx.uid,
    derive: (current) => {
      validatePropertyFieldLocking(current.commercialStatus as string | undefined, [FIELD]);
      return { [FIELD]: applyObjectiveValuePatch(readObjectiveValueDeclarations(current[FIELD]), patch) };
    },
  });

  await recordAudit(input, before, applied);
  // Η δημόσια προβολή — awaited, ποτέ δεν πετά (ίδιο με τη γενική διαδρομή).
  await republishPublicProjection(adminDb, id, { ...before, ...applied } as ListingProperty);
  return apiSuccess({ id, _v: newVersion }, 'Property updated');
}
