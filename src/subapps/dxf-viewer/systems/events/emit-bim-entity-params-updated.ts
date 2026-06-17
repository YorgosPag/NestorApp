/**
 * emit-bim-entity-params-updated.ts — kind→event SSoT for «a BIM member's params
 * changed» (ADR-459 Φ7 Boy-scout extraction, CLAUDE.md N.0.2).
 *
 * Before this module the `bim:<kind>-params-updated` announcement was emitted
 * INLINE per kind across 8 commit sites (2D parametric grip commits, footprint /
 * centred-box / polygon / heating-host grip commits, ribbon bridges). Each new
 * surface that mutates a member's geometry had to remember the right event name
 * AND the right payload key (`wallId` vs `columnId` vs `segmentId`…). The 3D gizmo
 * commit (`bim3d-edit-interaction-handlers`) forgot it entirely → rotate/resize of
 * a column did NOT re-trigger the auto-foundation designer (the bug this fixes).
 *
 * This is the ONE place that maps an entity `type` → its params-updated event +
 * payload key. Every surface (2D grip, 3D gizmo, ribbon) calls this helper so the
 * announcement is identical regardless of where the edit originated (Revit-grade:
 * one geometry change, announced once). Reactors (auto-foundation design,
 * structural organism, per-entity persistence) listen to these events uniformly.
 *
 * Each entry is a fully type-checked closure — `EventBus.emit` validates the event
 * name against its payload at compile time, so there is no `any` and no payload-key
 * drift. `stair` is intentionally absent (no `bim:stair-params-updated` event in
 * the map) → the helper returns `false` for it, a safe no-op.
 *
 * @see ./drawing-event-map-bim.ts — the BimEventMap these events belong to
 * @see ../../hooks/grips/grip-parametric-commits.ts — 2D grip commit callers
 * @see ../../bim-3d/animation/bim3d-edit-command-builders.ts — 3D gizmo caller
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 7
 */

import { EventBus } from './EventBus';

/**
 * type → emitter closure. Each closure emits the canonical `*-params-updated`
 * event with that kind's payload key. Keyed by the scene-entity `type`
 * discriminant. `satisfies` keeps every closure type-checked against
 * `EventBus.emit` while preserving the literal key set.
 */
const PARAMS_UPDATED_EMITTERS = {
  wall: (id: string) => EventBus.emit('bim:wall-params-updated', { wallId: id }),
  opening: (id: string) => EventBus.emit('bim:opening-params-updated', { openingId: id }),
  beam: (id: string) => EventBus.emit('bim:beam-params-updated', { beamId: id }),
  column: (id: string) => EventBus.emit('bim:column-params-updated', { columnId: id }),
  foundation: (id: string) => EventBus.emit('bim:foundation-params-updated', { foundationId: id }),
  slab: (id: string) => EventBus.emit('bim:slab-params-updated', { slabId: id }),
  roof: (id: string) => EventBus.emit('bim:roof-params-updated', { roofId: id }),
  'slab-opening': (id: string) => EventBus.emit('bim:slab-opening-params-updated', { slabOpeningId: id }),
  'floor-finish': (id: string) => EventBus.emit('bim:floor-finish-params-updated', { floorFinishId: id }),
  'thermal-space': (id: string) => EventBus.emit('bim:thermal-space-params-updated', { thermalSpaceId: id }),
  'space-separator': (id: string) => EventBus.emit('bim:space-separator-params-updated', { spaceSeparatorId: id }),
  railing: (id: string) => EventBus.emit('bim:railing-params-updated', { railingId: id }),
  furniture: (id: string) => EventBus.emit('bim:furniture-params-updated', { furnitureId: id }),
  'mep-segment': (id: string) => EventBus.emit('bim:mep-segment-params-updated', { segmentId: id }),
  'mep-fixture': (id: string) => EventBus.emit('bim:mep-fixture-params-updated', { fixtureId: id }),
  'electrical-panel': (id: string) => EventBus.emit('bim:electrical-panel-params-updated', { panelId: id }),
  'mep-manifold': (id: string) => EventBus.emit('bim:mep-manifold-params-updated', { manifoldId: id }),
  'mep-radiator': (id: string) => EventBus.emit('bim:mep-radiator-params-updated', { radiatorId: id }),
  'mep-boiler': (id: string) => EventBus.emit('bim:mep-boiler-params-updated', { boilerId: id }),
  'mep-water-heater': (id: string) => EventBus.emit('bim:mep-water-heater-params-updated', { waterHeaterId: id }),
  'mep-underfloor': (id: string) => EventBus.emit('bim:mep-underfloor-params-updated', { underfloorId: id }),
} satisfies Record<string, (id: string) => void>;

/** Entity `type` values this helper can announce (the params-updated event keys). */
export type ParamsUpdatedEntityType = keyof typeof PARAMS_UPDATED_EMITTERS;

/**
 * Announce that a BIM member's params/geometry changed, regardless of the surface
 * that edited it. Returns `true` when an event was emitted, `false` for a type with
 * no params-updated event (e.g. `stair`) — a safe no-op the caller can ignore.
 */
export function emitBimEntityParamsUpdated(entityType: string, entityId: string): boolean {
  const emit = (PARAMS_UPDATED_EMITTERS as Record<string, ((id: string) => void) | undefined>)[entityType];
  if (!emit) return false;
  emit(entityId);
  return true;
}
