/**
 * cross-level-organism-scene — pure reconciler του cross-level στατικού οργανισμού
 * (ADR-459 Phase 0).
 *
 * Συνενώνει τα entities του ενεργού ορόφου (κολόνες/δοκάρια) με τα entities του
 * ορόφου Θεμελίωσης (πέδιλα) σε ΕΝΑ entity set + έναν χάρτη `entityId →
 * floorElevationMm`. Ο `buildStructuralGraph` καταναλώνει τον χάρτη ώστε να
 * υπολογίσει τα Z κάθε μέλους σε **απόλυτο** datum-relative frame — άρα η
 * `footing-bearing` ακμή (πέδιλο Θεμελίωσης στηρίζει κολόνα ισογείου) προκύπτει
 * σωστά παρότι τα δύο μέλη ζουν σε διαφορετικές σκηνές/datums.
 *
 * Κάθε σκηνή έχει level-relative Z (datum 0)· ο χάρτης μετατοπίζει κατά το FFL
 * του εκάστοτε ορόφου. Single-level χρήση (κενά foundation entities) → ο χάρτης
 * είναι κενός → ο graph πέφτει στο default 0 → μηδέν regression.
 *
 * Pure module — zero React/DOM/Firestore deps.
 *
 * @see ../../../systems/levels/building-foundation-level.ts — ο foundation target
 * @see structural-graph.ts — buildStructuralGraph(entities, { floorElevationByEntityId })
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 0
 */

import type { Entity } from '../../../types/entities';

/** Είσοδος του cross-level reconciler. */
export interface OrganismSceneInput {
  /** Entities του ενεργού ορόφου (live scene). */
  readonly activeEntities: readonly Entity[];
  /** Datum-relative FFL του ενεργού ορόφου (mm). */
  readonly activeFloorElevationMm: number;
  /** Entities του ορόφου Θεμελίωσης (live ή loaded snapshot). Κενό → single-level. */
  readonly foundationEntities: readonly Entity[];
  /** Datum-relative FFL του ορόφου Θεμελίωσης (mm). */
  readonly foundationFloorElevationMm: number;
}

/** Αποτέλεσμα: merged entities + per-entity absolute floor elevation. */
export interface OrganismScene {
  readonly entities: readonly Entity[];
  readonly floorElevationByEntityId: ReadonlyMap<string, number>;
}

/**
 * Συνένωση ενεργού + foundation entities με χάρτη απόλυτου FFL ανά entity id.
 *
 * Dedup: αν ένα id υπάρχει και στις δύο λίστες (π.χ. ο ενεργός όροφος ΕΙΝΑΙ ο
 * όροφος Θεμελίωσης), το ενεργό κερδίζει — η foundation εγγραφή παραλείπεται ώστε
 * να μη διπλασιαστεί ο κόμβος στον graph.
 */
export function buildOrganismScene(input: OrganismSceneInput): OrganismScene {
  const elevById = new Map<string, number>();
  const entities: Entity[] = [];
  const seen = new Set<string>();

  for (const e of input.activeEntities) {
    seen.add(e.id);
    entities.push(e);
    elevById.set(e.id, input.activeFloorElevationMm);
  }
  for (const e of input.foundationEntities) {
    if (seen.has(e.id)) continue;
    entities.push(e);
    elevById.set(e.id, input.foundationFloorElevationMm);
  }

  return { entities, floorElevationByEntityId: elevById };
}
