/**
 * =============================================================================
 * Κοινόχρηστος χώρος ↔ περιγράμματα κάτοψης — ο ΕΝΑΣ γραφέας του `drawnArea` (server, ADR-931 §6 Β1)
 * =============================================================================
 *
 * Δύο ευθύνες, και οι δύο στο σύνορο του `floorplan-overlays` API:
 *
 * 1. **Φρουρός σύνδεσης** (`assertCommonSpaceLinkable`): περίγραμμα δένει **μόνο** με κοινόχρηστο του ίδιου πελάτη
 *    (ξένο ≡ ανύπαρκτο ⇒ 404, ADR-742), ζωντανό, του **ίδιου κτιρίου** με την κάτοψη, και —αν είναι χώρος ορόφου—
 *    του ίδιου ορόφου (`isCommonSpaceOnPlan`, η ΙΔΙΑ κρίση με τον επιλογέα του DXF viewer).
 *
 * 2. **Παράγωγο εμβαδόν** (`syncCommonSpaceDrawnAreas`): σε κάθε δημιουργία/αλλαγή/διαγραφή περιγράμματος, για κάθε
 *    χώρο που αγγίχτηκε (πριν **και** μετά — αποσύνδεση και μεταφορά μετράνε), το `drawnArea` ξαναϋπολογίζεται **από
 *    την πηγή**: όλα τα περιγράμματα `common_space` που δένουν τον χώρο, μέσα σε **συναλλαγή**. Ιδεμποτικό και
 *    χωρίς δέλτα ⇒ δύο ταυτόχρονες αλλαγές συγκλίνουν (η καθεμία ξαναμετρά ό,τι έχει δεσμευτεί).
 *    - `_v` ανεβαίνει **μόνο** όταν αλλάζει το `area` (δεμένο στο σχέδιο): φόρμα με παλιά τιμή παίρνει 409 αντί να
 *      πατήσει το σχέδιο. Σκέτο `drawnArea` δεν το επεξεργάζεται άνθρωπος ⇒ καμία ψευδής σύγκρουση.
 *    - Ίχνος στο ιστορικό του χώρου (ADR-195) μέσω του ΙΔΙΟΥ `spaceAuditEntry` με το PATCH.
 *
 * @module lib/common-spaces/common-space-drawn-area.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import type { AuthContext } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from '@/lib/firebaseAdmin';
import { requireCommonSpaceInTenant } from '@/lib/auth/tenant-isolation';
import { isRetired } from '@/lib/firestore/trashed-status';
import { versionedWrite } from '@/lib/firestore/version-check';
import { withMergePatchDeletes } from '@/lib/firestore/merge-patch-deletes';
import { spaceAuditEntry } from '@/lib/api/space-entity-write';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { derivedAreaPatch, drawnAreaOfGeometries } from '@/lib/common-spaces/common-space-area';
import { isCommonSpaceOnPlan } from '@/lib/common-spaces/common-space-plan';
import { linkedEntityIdOf, type OverlayLinked, type OverlayRole } from '@/types/floorplan-overlays';

const logger = createModuleLogger('CommonSpaceDrawnArea');

const COMMON_SPACE_LINK_KEY = 'commonSpaceId' satisfies keyof OverlayLinked;
const NOT_ON_PLAN_MESSAGE = 'Common space must belong to the building (and floor) of this floor plan';

/** Το περίγραμμα όπως το ξέρει ο handler — πριν ή μετά τη γραφή. */
export interface OverlayLinkState {
  readonly role: OverlayRole | undefined;
  readonly linked: OverlayLinked | undefined;
}

/** Ο κοινόχρηστος που δένει αυτή η κατάσταση περιγράμματος, αν δένει. */
export function linkedCommonSpaceOf(state: OverlayLinkState | null): string | undefined {
  return state?.role === 'common_space' ? linkedEntityIdOf('common_space', state.linked) : undefined;
}

/** Οι χώροι που πρέπει να ξαναμετρηθούν: όποιος έδενε **πριν** και όποιος δένει **μετά** (χωρίς διπλότυπα). */
export function affectedCommonSpaces(before: OverlayLinkState | null, after: OverlayLinkState | null): string[] {
  const ids = new Set<string>();
  for (const id of [linkedCommonSpaceOf(before), linkedCommonSpaceOf(after)]) {
    if (id !== undefined) ids.add(id);
  }
  return [...ids];
}

// =============================================================================
// ΦΡΟΥΡΟΣ ΣΥΝΔΕΣΗΣ
// =============================================================================

/**
 * Ρίχνει αν το περίγραμμα του `floorId` δεν επιτρέπεται να δέσει με αυτόν τον χώρο. Καλείται **μόνο** όταν η σύνδεση
 * είναι νέα ή αλλάζει (επαναποθήκευση γεωμετρίας ήδη δεμένου περιγράμματος δεν ξαναρωτά).
 */
export async function assertCommonSpaceLinkable(
  db: Firestore,
  ctx: AuthContext,
  commonSpaceId: string,
  floorId: string,
  path: string,
): Promise<void> {
  // 404 για ξένο ≡ ανύπαρκτο (κανένα μαντείο ύπαρξης).
  await requireCommonSpaceInTenant({ ctx, commonSpaceId, path });
  const [spaceSnap, floorSnap] = await db.getAll(
    db.collection(COLLECTIONS.COMMON_SPACES).doc(commonSpaceId),
    db.collection(COLLECTIONS.FLOORS).doc(floorId),
  );
  const space = spaceSnap.data();
  if (space === undefined || isRetired(space)) throw new ApiError(404, 'Common space not found');
  const floorBuildingId = floorSnap.data()?.buildingId;
  const sameBuilding = typeof floorBuildingId === 'string' && floorBuildingId === space.buildingId;
  if (!sameBuilding || !isCommonSpaceOnPlan(space, floorId)) throw new ApiError(422, NOT_ON_PLAN_MESSAGE);
}

// =============================================================================
// ΠΑΡΑΓΩΓΟ ΕΜΒΑΔΟΝ
// =============================================================================

interface SyncOutcome {
  readonly existing: Readonly<Record<string, unknown>>;
  readonly applied: Readonly<Record<string, unknown>>;
}

/** Μία συναλλαγή ανά χώρο: διάβασε χώρο + περιγράμματα, μέτρησε, γράψε μόνο ό,τι άλλαξε. */
async function syncOne(db: Firestore, ctx: AuthContext, commonSpaceId: string): Promise<SyncOutcome | null> {
  const spaceRef = db.collection(COLLECTIONS.COMMON_SPACES).doc(commonSpaceId);
  return db.runTransaction(async (tx) => {
    const spaceSnap = await tx.get(spaceRef);
    const existing = spaceSnap.data();
    if (existing === undefined || typeof existing.companyId !== 'string') return null;

    // firestore-index-exempt: δύο ισότητες και καμία ταξινόμηση — το Firestore συγχωνεύει τους αυτόματους δείκτες ενός πεδίου.
    const overlays = await tx.get(
      db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS)
        .where('companyId', '==', existing.companyId)
        .where(`linked.${COMMON_SPACE_LINK_KEY}`, '==', commonSpaceId),
    );
    const geometries = overlays.docs
      .map((doc) => doc.data())
      .filter((data) => data.role === 'common_space')
      .map((data) => data.geometry);

    const patch = derivedAreaPatch(existing, drawnAreaOfGeometries(geometries));
    if (Object.keys(patch).length === 0) return null;

    // Κάθε πεδίο του `derivedAreaPatch` είναι παράγωγο εμβαδόν: `null` ⇒ «δεν υπάρχει πια» ⇒ διαγραφή (ADR-249 §7.8).
    const applied = withMergePatchDeletes(patch);
    const write = 'area' in patch
      ? versionedWrite(existing, applied, ctx.uid).data
      : { ...applied, updatedAt: FieldValue.serverTimestamp() };
    tx.update(spaceRef, write);
    return { existing, applied: patch };
  });
}

function recordAudit(ctx: AuthContext, commonSpaceId: string, outcome: SyncOutcome): void {
  const entry = spaceAuditEntry('common_space', outcome.existing, outcome.applied);
  if (!entry) return;
  EntityAuditService.recordChange({
    entityType: 'common_space',
    entityId: commonSpaceId,
    entityName: typeof outcome.existing.name === 'string' ? outcome.existing.name : null,
    action: entry.action,
    changes: [...entry.changes],
    performedBy: ctx.uid,
    performedByName: ctx.email ?? null,
    companyId: ctx.companyId,
  }).catch((err) => {
    logger.warn('entity audit failed (non-blocking)', { commonSpaceId, error: getErrorMessage(err) });
  });
}

/**
 * Ξαναμετρά το `drawnArea` κάθε χώρου που αγγίχτηκε. **Δεν πετά ποτέ**: το περίγραμμα έχει ήδη γραφτεί, και ένα
 * παράγωγο που αποτυγχάνει διορθώνεται στην επόμενη αλλαγή (ξαναμετρά από την πηγή) — δεν ακυρώνει τη γραφή.
 */
export async function syncCommonSpaceDrawnAreas(
  db: Firestore,
  ctx: AuthContext,
  commonSpaceIds: readonly string[],
): Promise<void> {
  for (const commonSpaceId of commonSpaceIds) {
    try {
      const outcome = await syncOne(db, ctx, commonSpaceId);
      if (outcome) recordAudit(ctx, commonSpaceId, outcome);
    } catch (err) {
      logger.error('drawn area sync failed', { commonSpaceId, error: getErrorMessage(err) });
    }
  }
}
