/**
 * @fileoverview **Η ΓΕΝΝΗΣΗ ΤΟΥ ΟΡΟΦΟΥ** — όροφος, κρίση μοναδικότητας και επανατοποθέτηση ειδικών σταθμών σε ΜΙΑ
 * συναλλαγή, κάτω από το κλειδί της στοίβας.
 * @module api/floors/floor-birth
 * @see ./floor-stack-authority — το σύνορο · @see app/api/projects/list/project-birth — το ίδιο πρότυπο για το έργο
 *
 * 🔴 **Η βλάβη που κλείνει**: «έλεγξε αν ο αριθμός είναι ελεύθερος» και «γράψε τον όροφο» ήταν δύο βήματα. Δύο κλικ
 * (δύο κλειδιά ιδεμποτίας) περνούσαν και τα δύο ⇒ δύο «Ισόγειο» στο ίδιο κτίριο.
 *
 * 🏆 **Πέρα από τους μεγάλους**: στη Revit/ArchiCAD η στοίβα είναι ένα αρχείο, ενός χρήστη. Εδώ η γέννηση είναι
 * ατομική απέναντι σε ταυτόχρονους χρήστες — και η θεμελίωση κατεβαίνει **στην ίδια συναλλαγή** που γεννιέται το
 * υπόγειο: δεν υπάρχει ούτε στιγμή όπου η ειδική στάθμη κάθεται σφηνωμένη μέσα στη στοίβα.
 *
 * ⚠️ Το ιστορικό (ADR-195) γράφεται **μετά** το commit: η γραμμή γέννησης μέσα στο `createEntity`, οι παράγωγες
 * (επανατοποθέτηση) εδώ. Μια συναλλαγή ξανατρέχει σε σύγκρουση — ίχνος μέσα της θα έφευγε πολλές φορές.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import type { AuthContext } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import type { EntityCommitWrite, EntityCreationParams } from '@/lib/firestore/entity-creation.types';
import { sameElevationPeersOf } from '@/lib/floor/floor-stack-integrity';
import { createModuleLogger } from '@/lib/telemetry';
import { buildFloorCascadeActor } from './_shared/floor-cascade-audit';
import { toFloorStackRow } from './_shared/floor-stack-rows';
import { assertFloorSlotFree } from './floor-slot';
import { requireFloorStackOwner, withFloorStack, type FloorStackOwner } from './floor-stack-authority';
import {
  planSpecialLevelPlacement,
  recordSpecialLevelPlacements,
  writeSpecialLevelPlacements,
  type SpecialLevelPlacement,
} from './floor-stack-reconcile.service';

const logger = createModuleLogger('FloorBirth');

export interface FloorBirthRequest {
  readonly db: Firestore;
  readonly ctx: AuthContext;
  readonly buildingId: string;
  /** Τα πεδία του ορόφου, **έτοιμα** — ο handler έχει ήδη εφαρμόσει το σχήμα. */
  readonly fields: Record<string, unknown>;
  readonly auditFieldResolvers?: EntityCreationParams['auditFieldResolvers'];
}

export interface FloorBirthResult {
  readonly floorId: string;
  /** Άλλοι μετρούμενοι όροφοι στο **ίδιο υψόμετρο** — προειδοποίηση, όχι άρνηση (η Revit το επιτρέπει). */
  readonly sameElevationFloorIds: readonly string[];
}

/** Ό,τι αποφάσισε η συναλλαγή της γέννησης — για το ίχνος και την απάντηση. */
interface BirthOutcome {
  readonly owner: FloorStackOwner;
  readonly placements: readonly SpecialLevelPlacement[];
  readonly sameElevationFloorIds: readonly string[];
}

/**
 * **Η ΜΙΑ γέννηση ορόφου** — η μόνη εγγραφή νέου `floors/{id}` (CHECK 3.102 Κ1).
 *
 * @throws {ApiError} 409 `FLOOR_NUMBER_TAKEN` · `FLOOR_KIND_TAKEN` · `FLOOR_NAME_TAKEN` — τίποτα δεν γράφεται
 * @throws {ApiError} 422 `FLOOR_OWNER_MISSING` — το κτίριο δεν έχει ενοικιαστή
 */
export async function writeFloorBirth(request: FloorBirthRequest): Promise<FloorBirthResult> {
  const { ctx, buildingId, fields } = request;
  let outcome: BirthOutcome | null = null;

  const created = await createEntity('floor', {
    auth: ctx,
    parentId: buildingId,
    entitySpecificFields: fields,
    apiPath: '/api/floors (POST)',
    auditFieldResolvers: request.auditFieldResolvers,
    // Η τελευταία εκτέλεση είναι αυτή που γράφτηκε (η συναλλαγή ξανατρέχει σε σύγκρουση).
    commit: async (write) => { outcome = await commitBirth(write, ctx.uid); },
  });

  const settled = outcome as BirthOutcome | null;
  if (settled === null) return { floorId: created.id, sameElevationFloorIds: [] };
  await recordPlacements(settled, created.id, request);
  return { floorId: created.id, sameElevationFloorIds: settled.sameElevationFloorIds };
}

/** Η συναλλαγή: κρίση → όροφος → επανατοποθέτηση ειδικών σταθμών → σφράγιση κλειδιού. */
function commitBirth(write: EntityCommitWrite, userId: string): Promise<BirthOutcome> {
  const { db, ref, entityId, doc } = write;
  // Ο κάτοχος είναι αυτός που **γράφεται στο έγγραφο** (ο ενοικιαστής του κτιρίου) — όχι ο καλών.
  const owner = requireFloorStackOwner(doc);
  const born = toFloorStackRow(entityId, doc);

  return withFloorStack(db, owner, userId, (transaction, stack) => {
    assertFloorSlotFree(stack.rows, born, owner.buildingId);
    const rows = [...stack.rows, born];
    const placements = planSpecialLevelPlacement(rows);
    // Αν η ίδια η νέα στάθμη χρειάζεται μετακίνηση (π.χ. θεμελίωση), γεννιέται **ήδη** στη θέση της.
    const own = placements.find((placement) => placement.row.id === entityId);
    transaction.create(ref, own ? { ...doc, number: own.number, elevation: own.elevation } : { ...doc });
    writeSpecialLevelPlacements(transaction, stack.refById, placements.filter((placement) => placement !== own), userId);
    return { owner, placements, sameElevationFloorIds: sameElevationPeersOf(rows, entityId) };
  });
}

/** ADR-195 — οι παράγωγες γραμμές της επανατοποθέτησης. Αποτυχία εδώ ⇒ ο όροφος **υπάρχει ήδη**· δεν ρίχνει. */
async function recordPlacements(outcome: BirthOutcome, floorId: string, request: FloorBirthRequest): Promise<void> {
  if (outcome.placements.length === 0) return;
  try {
    // Αιτία = ο όροφος που μόλις γεννήθηκε· η γραμμή γέννησης γράφτηκε μέσα στο `createEntity`.
    const actor = await buildFloorCascadeActor({
      ctx: request.ctx,
      entityType: ENTITY_TYPES.FLOOR,
      entityId: floorId,
      entityName: typeof request.fields.name === 'string' ? request.fields.name : null,
      auditId: null,
    });
    await recordSpecialLevelPlacements(outcome.placements, outcome.owner.companyId, actor);
  } catch (error) {
    logger.warn('[Floors/Create] Special-level placement audit failed (floor created, levels placed)', {
      buildingId: request.buildingId, floorId, error: getErrorMessage(error),
    });
  }
}
