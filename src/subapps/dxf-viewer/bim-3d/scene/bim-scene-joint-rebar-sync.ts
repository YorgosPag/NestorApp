/**
 * ADR-473 — Scene-level joint reinforcement sync (post-pass).
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΡΧΗ (fix v1.1):
 * Joint geometry είναι cross-member ΚΑΙ cross-floor (πέδιλο Θεμελίωσης ↔ κολόνα
 * Ισογείου). Δεν μπορεί να ζει μέσα στο `syncFloorEntities` loop (per-floor pass),
 * γιατί κάθε pass βλέπει μόνο ΤΟΝ ΕΝΑ όροφο → ο graph ποτέ δεν βλέπει footing +
 * column μαζί → 0 edges → άδεια render.
 *
 * FIX: καλείται ΜΕΤΑ από τον floor loop (στο `sync` + `syncMultiFloor`), παίρνει
 * ΟΛΑ τα structural entities από ΟΛΟΥΣ τους ορόφους + floorElevationByEntityId
 * ώστε `buildStructuralGraph` να υπολογίσει σωστό absolute Z.
 *
 * Helper `buildStructuralEntitySet` εξάγεται για χρήση στο `BimSceneLayer`.
 *
 * @see ../converters/joint-rebar-3d.ts — geometry builders
 * @see ../../bim/structural/organism/reinforcement-continuity.ts — math SSoT
 */

import * as THREE from 'three';
import type { Entity } from '../../types/entities';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { buildStructuralGraph } from '../../bim/structural/organism/organism-checks';
import { computeOrganismReinforcementContinuity } from '../../bim/structural/organism/reinforcement-continuity';
import { resolveStructuralCode } from '../../bim/structural/codes';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';
import { isReinforcementVisible } from '../../bim/structural/reinforcement/rebar-visibility';
import { buildJointRebarGroup } from '../converters/joint-rebar-3d';

// ─── Entity aggregation helper ────────────────────────────────────────────────

/**
 * Aggregates structural entities from multiple floors with their absolute
 * floor elevations. Called by `BimSceneLayer.sync` and `syncMultiFloor`
 * BEFORE calling `syncJointRebar`.
 *
 * @param entitySets  Per-floor Bim3DEntities arrays (one per sync pass).
 * @param floorElevations  Matching floor elevations in mm (same order).
 */
export function buildStructuralEntitySet(
  entitySets: readonly Bim3DEntities[],
  floorElevations: readonly number[],
): { structural: readonly Entity[]; floorElevationByEntityId: ReadonlyMap<string, number> } {
  const structural: Entity[] = [];
  const floorElevationByEntityId = new Map<string, number>();

  for (let i = 0; i < entitySets.length; i++) {
    const es = entitySets[i];
    const elev = floorElevations[i] ?? 0;
    const members = [
      ...es.columns,
      ...es.beams,
      ...es.foundations,
      ...es.slabs,
    ] as unknown as Entity[];
    for (const e of members) {
      structural.push(e);
      floorElevationByEntityId.set(e.id, elev);
    }
  }

  return { structural, floorElevationByEntityId };
}

// ─── Main sync ────────────────────────────────────────────────────────────────

/**
 * Builds and adds joint reinforcement meshes (dowels / laps / anchorages) to the
 * scene group. Called ONCE after all floor passes complete (not inside the loop).
 *
 * @param structural   All structural entities across all floors (from buildStructuralEntitySet).
 * @param floorElevationByEntityId  Absolute floor elevation per entity (for correct node Z).
 */
export function syncJointRebar(
  group: THREE.Group,
  structural: readonly Entity[],
  floorElevationByEntityId: ReadonlyMap<string, number>,
): void {
  if (!isReinforcementVisible()) return;
  if (structural.length === 0) return;

  const graph = buildStructuralGraph(structural, { floorElevationByEntityId });
  if (graph.edges.length === 0) return;

  const settings = useStructuralSettingsStore.getState();
  const provider = resolveStructuralCode(settings.codeId);

  const continuity = computeOrganismReinforcementContinuity(graph, structural, provider);
  if (continuity.items.length === 0) return;

  const entityById = new Map<string, Entity>(structural.map((e) => [e.id, e]));
  const jrGroup = buildJointRebarGroup(continuity, graph, entityById, provider);
  if (jrGroup) group.add(jrGroup);
}
