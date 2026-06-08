/**
 * ADR-422 — Resolver: ποιοι θερμικοί χώροι εξυπηρετούνται από μια πηγή (PURE SSoT).
 *
 * Συνδέει έναν MEP source (λέβητα / αντλία θερμότητας / θερμοσίφωνα) με τους
 * θερμικούς χώρους που περιέχουν τα terminals (καλοριφέρ / ενδοδαπέδια) που
 * ανήκουν στα δίκτυα της πηγής.
 *
 * Αλγόριθμος:
 *   1. `resolveManagedSystems(source)` → MEP δίκτυα που πηγάζουν από την πηγή.
 *   2. Συλλογή entity-ids μελών όλων των δικτύων.
 *   3. Φιλτράρισμα: κρατάμε μόνο terminals (radiator / underfloor).
 *   4. Για κάθε terminal: αντιπροσωπευτικό σημείο (position για radiator,
 *      centroid footprint για underfloor).
 *   5. pointInPolygon(point, space.params.footprint.vertices) → χώρος.
 *   6. Dedupe by space.id → μοναδικοί χώροι.
 *
 * **Fallback rule (ΕΚΤΟΣ αυτής της fn)**: αν `servedSpaces` είναι κενό, ο
 * caller πρέπει να χρησιμοποιήσει `heatLoads.totalW` ως φορτίο για την πηγή.
 * Αυτή η fn επιστρέφει απλώς κενό πίνακα — δεν εφαρμόζει fallback.
 *
 * Idempotent · side-effect free · zero React/store/Firestore.
 *
 * @see ./heating-equipment-sizing (χρησιμοποιεί το άθροισμα που παράγεται εδώ)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

import type { Entity } from '../../types/entities';
import {
  isMepRadiatorEntity,
  isMepUnderfloorEntity,
} from '../../types/entities';
import type { MepSystemEntity } from '../types/mep-system-types';
import type { ThermalSpaceEntity } from '../types/thermal-space-types';
import { resolveManagedSystems } from '../mep-systems/mep-circuit-editor';
import {
  pointInPolygon,
  polygonCentroid,
} from '../geometry/shared/polygon-utils';
import type { SpaceHeatLoadDeriveResult } from './heat-load/derive-space-heat-loads';

// ─── Κύριες συναρτήσεις ───────────────────────────────────────────────────────

/**
 * Επιστρέφει τους μοναδικούς `ThermalSpaceEntity` που περιέχουν τουλάχιστον
 * ένα terminal (καλοριφέρ ή ενδοδαπέδιο) συνδεδεμένο στα δίκτυα της `source`.
 *
 * Terminals χωρίς χώρο (point εκτός κάθε space footprint) αγνοούνται — δεν
 * παράγεται false-positive χώρος.
 *
 * @param source        - Η MEP πηγή (λέβητας / αντλία / θερμοσίφωνας).
 * @param systems       - Όλα τα MepSystemEntity του ορόφου.
 * @param sceneEntities - Όλες οι σκηνικές οντότητες του ορόφου (για lookup).
 * @param spaces        - Όλοι οι θερμικοί χώροι του ορόφου.
 * @returns             Μοναδικοί θερμικοί χώροι (dedupe by id).
 */
export function resolveSourceServedSpaces(
  source: Entity,
  systems: readonly MepSystemEntity[],
  sceneEntities: readonly Entity[],
  spaces: readonly ThermalSpaceEntity[],
): ThermalSpaceEntity[] {
  // Βήμα 1: Δίκτυα που πηγάζουν από την πηγή.
  const managedSystems = resolveManagedSystems([source], systems);
  if (managedSystems.length === 0) return [];

  // Βήμα 2: Συλλογή member entityIds.
  const memberIds = collectMemberEntityIds(managedSystems);
  if (memberIds.size === 0) return [];

  // Βήμα 3: Lookup entities + φιλτράρισμα για terminals.
  const entityById = buildEntityIndex(sceneEntities);
  const terminals = resolveTerminalEntities(memberIds, entityById);
  if (terminals.length === 0) return [];

  // Βήμα 4–6: Αντιπροσωπευτικό σημείο → pointInPolygon → dedupe.
  return matchTerminalsToSpaces(terminals, spaces);
}

/**
 * Αθροίζει το θερμικό φορτίο (W) των δοσμένων χώρων από τον `SpaceHeatLoadDeriveResult`.
 *
 * Χώροι χωρίς αποτέλεσμα στο Map μετράνε ως 0 W (defensive).
 *
 * **Σημείωση fallback**: αν `servedSpaces` είναι κενό, ο caller πρέπει να
 * χρησιμοποιήσει `heatLoads.totalW` (όλο το κτίριο) — αυτή η fn επιστρέφει
 * απλώς 0 W για κενό πίνακα. Η fallback λογική ανήκει στον caller.
 */
export function sumServedHeatLoadW(
  servedSpaces: readonly ThermalSpaceEntity[],
  heatLoads: SpaceHeatLoadDeriveResult,
): number {
  let total = 0;
  for (const space of servedSpaces) {
    total += heatLoads.results.get(space.id)?.totalW ?? 0;
  }
  return total;
}

// ─── Εσωτερικοί βοηθοί (≤40 γραμμές ο καθένας) ──────────────────────────────

/** Συλλέγει τα entityId όλων των members από τα δίκτυα. */
function collectMemberEntityIds(systems: readonly MepSystemEntity[]): Set<string> {
  const ids = new Set<string>();
  for (const sys of systems) {
    for (const m of sys.params.members) {
      ids.add(m.entityId);
    }
  }
  return ids;
}

/** Δημιουργεί index entity-id → Entity για γρήγορο lookup O(1). */
function buildEntityIndex(entities: readonly Entity[]): Map<string, Entity> {
  const idx = new Map<string, Entity>();
  for (const e of entities) {
    idx.set(e.id, e);
  }
  return idx;
}

/**
 * Επιστρέφει μόνο τα terminals (radiator + underfloor) από τα member ids.
 * Μη-terminal members (pipes, fittings) αγνοούνται σιωπηλά.
 */
function resolveTerminalEntities(
  memberIds: ReadonlySet<string>,
  entityById: ReadonlyMap<string, Entity>,
): Entity[] {
  const terminals: Entity[] = [];
  for (const id of memberIds) {
    const entity = entityById.get(id);
    if (entity === undefined) continue;
    if (isMepRadiatorEntity(entity) || isMepUnderfloorEntity(entity)) {
      terminals.push(entity);
    }
  }
  return terminals;
}

/**
 * Για κάθε terminal βρίσκει τον χώρο που το περιέχει και επιστρέφει
 * μοναδικούς χώρους (dedupe by id).
 */
function matchTerminalsToSpaces(
  terminals: readonly Entity[],
  spaces: readonly ThermalSpaceEntity[],
): ThermalSpaceEntity[] {
  const seen = new Set<string>();
  const result: ThermalSpaceEntity[] = [];

  for (const terminal of terminals) {
    const point = resolveTerminalRepresentativePoint(terminal);
    if (point === null) continue;

    const space = findSpaceContainingPoint(point, spaces);
    if (space === null) continue;
    if (seen.has(space.id)) continue;

    seen.add(space.id);
    result.push(space);
  }

  return result;
}

/**
 * Αντιπροσωπευτικό σημείο του terminal για το pointInPolygon test:
 *   - `mep-radiator`   → `params.position` (insertion point)
 *   - `mep-underfloor` → `polygonCentroid(params.footprint.vertices)`
 *
 * Επιστρέφει `null` για οντότητες που δεν είναι terminals (defensive guard).
 */
function resolveTerminalRepresentativePoint(
  terminal: Entity,
): { x: number; y: number } | null {
  if (isMepRadiatorEntity(terminal)) {
    return terminal.params.position;
  }
  if (isMepUnderfloorEntity(terminal)) {
    const verts = terminal.params.footprint.vertices;
    if (verts.length === 0) return null;
    return polygonCentroid(verts);
  }
  return null;
}

/**
 * Βρίσκει τον πρώτο χώρο που περιέχει το `point` (ray-casting).
 * Επιστρέφει `null` αν κανένας χώρος δεν το περιέχει.
 */
function findSpaceContainingPoint(
  point: { x: number; y: number },
  spaces: readonly ThermalSpaceEntity[],
): ThermalSpaceEntity | null {
  for (const space of spaces) {
    const verts = space.params.footprint.vertices;
    if (pointInPolygon(point, verts)) return space;
  }
  return null;
}
