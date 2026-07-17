/**
 * BIM Schedule Export — Preset Registry (ADR-363 §6 Phase 8).
 *
 * One preset per `ScheduleEntityType` — pairs a column schema with the
 * entity→cells mapper from `schedule-preset-mappers.ts`. Builder uses
 * `getPreset(entityType)` to resolve schema + mapper; `openingKindToScheduleType`
 * routes an opening `kind` to its door/window preset.
 *
 * SSoT:
 *   - Door + window split at preset level (not at column level): door
 *     preset has handing columns, window preset has glazing column.
 *     `sliding-door` / `french-door` route to door preset; `fixed` routes
 *     to window preset.
 *   - The mapping logic (per-type `mapXxx` + shared cell helpers) lives in
 *     `schedule-preset-mappers.ts`; this file is wiring only, keeping both
 *     under the 500-line SRP ceiling (N.7.1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 * @see docs/centralized-systems/reference/adrs/ADR-395-bim-quantities-building-measurements.md §4.6
 */

import type { OpeningKind } from '../types/opening-types';
import type { ScheduleEntityType } from './types';
import {
  DOOR_COLUMNS,
  WINDOW_COLUMNS,
  HARDWARE_COLUMNS,
  WALL_COLUMNS,
  SLAB_COLUMNS,
  COLUMN_COLUMNS,
  BEAM_COLUMNS,
  STAIR_COLUMNS,
  SLAB_OPENING_COLUMNS,
  FOUNDATION_COLUMNS,
  COMBINED_COLUMNS,
  MULTI_BUILDING_COLUMNS,
} from './schedule-preset-columns';
import {
  mapDoor,
  mapWindow,
  mapHardware,
  mapWall,
  mapSlab,
  mapColumn,
  mapBeam,
  mapStair,
  mapSlabOpening,
  mapFoundation,
  mapCombined,
  handingToGreek,
  handingToDIN,
  type AnyBimEntity,
  type SchedulePreset,
} from './schedule-preset-mappers';

// ─── Public re-exports (backward-compatible surface) ─────────────────────────

export { MULTI_BUILDING_COLUMNS, handingToGreek, handingToDIN };
export type { AnyBimEntity, SchedulePreset };

// ─── Registry ────────────────────────────────────────────────────────────────

const PRESET_REGISTRY: Readonly<Record<ScheduleEntityType, SchedulePreset>> = {
  'door':         { columns: DOOR_COLUMNS,         map: mapDoor },
  'window':       { columns: WINDOW_COLUMNS,       map: mapWindow },
  'hardware':     { columns: HARDWARE_COLUMNS,     map: mapHardware },
  'wall':         { columns: WALL_COLUMNS,         map: mapWall },
  'slab':         { columns: SLAB_COLUMNS,         map: mapSlab },
  'column':       { columns: COLUMN_COLUMNS,       map: mapColumn },
  'beam':         { columns: BEAM_COLUMNS,         map: mapBeam },
  'stair':        { columns: STAIR_COLUMNS,        map: mapStair },
  'slab-opening': { columns: SLAB_OPENING_COLUMNS, map: mapSlabOpening },
  'foundation':   { columns: FOUNDATION_COLUMNS,   map: mapFoundation },
  'combined':     { columns: COMBINED_COLUMNS,     map: mapCombined },
};

/** Resolve preset by entity-type discriminator. */
export function getPreset(entityType: ScheduleEntityType): SchedulePreset {
  return PRESET_REGISTRY[entityType];
}

// ─── Door / window opening-kind routing helpers ──────────────────────────────

/**
 * Maps an opening `kind` discriminator to the schedule entity-type that
 * should consume it. Doors (door / sliding-door / french-door) → 'door'
 * preset (handing columns). Windows + fixed → 'window' preset (glazing
 * column).
 */
export function openingKindToScheduleType(kind: OpeningKind): 'door' | 'window' {
  switch (kind) {
    case 'door':
    case 'double-door':
    case 'sliding-door':
    case 'double-sliding-door':
    case 'pocket-door':
    case 'bifold-door':
    case 'overhead-door':
    case 'revolving-door':
    case 'french-door':
      return 'door';
    case 'window':
    case 'fixed':
    case 'double-hung-window':
    case 'sliding-window':
    case 'awning-window':
    case 'hopper-window':
    case 'tilt-turn-window':
    case 'bay-window':
      return 'window';
  }
}
