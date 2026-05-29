/**
 * BIM Schedule Export — Preset Registry (ADR-363 §6 Phase 8).
 *
 * One preset per `ScheduleEntityType` — defines `columns` + entity→cells
 * `map` function. Builder uses `getPreset(entityType)` to resolve schema +
 * mapper. Presets pull localised handing labels through `handingToGreek` /
 * `handingToDIN` for door schedules (ADR-363 §6 Phase 8 Q4 — dual columns).
 *
 * SSoT:
 *   - Door + window split at preset level (not at column level): door
 *     preset has handing columns, window preset has glazing column.
 *     `sliding-door` / `french-door` route to door preset; `fixed` routes
 *     to window preset.
 *   - Combined preset derives its primary quantity from computed geometry +
 *     the ΑΤΟΕ SSoT (`deriveAtoeQuantity` / `resolveAtoeMapping`), mirroring
 *     the BOQ auto-feed bridge. ADR-395 §4.6 (G5): the legacy `qto` field was
 *     never populated and was removed — geometry is the single source of truth.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 * @see docs/centralized-systems/reference/adrs/ADR-395-bim-quantities-building-measurements.md §4.6
 */

import type { BeamEntity } from '../types/beam-types';
import type { ColumnEntity } from '../types/column-types';
import type {
  OpeningEntity,
  OpeningHanding,
  OpeningKind,
  OpeningSwing,
} from '../types/opening-types';
import type { SlabEntity } from '../types/slab-types';
import type { SlabOpeningEntity } from '../types/slab-opening-types';
import type { StairEntity } from '../types/stair-types';
import type { WallEntity } from '../types/wall-types';
import {
  resolveAtoeMapping,
  resolveStairComponentMapping,
  deriveAtoeQuantity,
  type BimEntityType,
} from '../config/bim-to-atoe-mapping';
import { computeStairBoqQuantities } from '../stairs/stair-boq-quantities';
import type {
  ScheduleCellValue,
  ScheduleColumnDef,
  ScheduleEntityType,
  ScheduleLookups,
  ScheduleRow,
} from './types';
import {
  DOOR_COLUMNS,
  WINDOW_COLUMNS,
  WALL_COLUMNS,
  SLAB_COLUMNS,
  COLUMN_COLUMNS,
  BEAM_COLUMNS,
  STAIR_COLUMNS,
  SLAB_OPENING_COLUMNS,
  COMBINED_COLUMNS,
  MULTI_BUILDING_COLUMNS,
} from './schedule-preset-columns';

export { MULTI_BUILDING_COLUMNS };

// ─── Combined union του builder ─────────────────────────────────────────────

/**
 * Heterogeneous BIM entity union που χειρίζεται ο builder. Stair has its
 * own discriminator path (it's the only entity with `type: 'stair'`).
 */
export type AnyBimEntity =
  | WallEntity
  | OpeningEntity
  | SlabEntity
  | SlabOpeningEntity
  | ColumnEntity
  | BeamEntity
  | StairEntity;

// ─── Handing helpers (ADR-363 §6 Phase 8 Q4) ─────────────────────────────────

/**
 * Greek descriptive handing label. Combines hinge side + swing direction
 * into one human-readable string. Falls back gracefully when fields are
 * undefined (windows / fixed).
 */
export function handingToGreek(
  handing: OpeningHanding | undefined,
  swing: OpeningSwing | undefined,
): string {
  if (handing === undefined) return '';
  const side = handing === 'left' ? 'Αριστερά' : 'Δεξιά';
  if (swing === undefined) return side;
  const dir = swing === 'inward' ? 'Άνοιγμα προς τα μέσα' : 'Άνοιγμα προς τα έξω';
  return `${side} · ${dir}`;
}

/**
 * DIN/ANSI coded handing label. LH/RH × IN/OUT — industry-standard
 * abbreviation for shop drawings + IFC export.
 */
export function handingToDIN(
  handing: OpeningHanding | undefined,
  swing: OpeningSwing | undefined,
): string {
  if (handing === undefined) return '';
  const hand = handing === 'left' ? 'LH' : 'RH';
  if (swing === undefined) return hand;
  const dir = swing === 'inward' ? 'IN' : 'OUT';
  return `${hand}-${dir}`;
}

// ─── Preset shape ────────────────────────────────────────────────────────────

/**
 * One preset = column schema + mapper. Mapper signature is type-erased
 * (`AnyBimEntity`) because the registry stores presets in a heterogeneous
 * map; concrete preset definitions narrow внутрь the mapper body via the
 * `type` discriminator.
 */
export interface SchedulePreset {
  readonly columns: readonly ScheduleColumnDef[];
  readonly map: (entity: AnyBimEntity, lookups: ScheduleLookups) => ScheduleRow['cells'];
}

// ─── Common cell helpers ─────────────────────────────────────────────────────

function safeNumber(value: unknown): ScheduleCellValue {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function safeText(value: unknown): ScheduleCellValue {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function shortId(rawId: string | null | undefined): string {
  if (!rawId) return '';
  return rawId.replace(/^[a-z]+-?[a-z]*_/, '').slice(0, 12);
}

// ─── Door preset (ADR-363 §6 Phase 8 Q3 + Q4) ────────────────────────────────

function mapDoor(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'opening') return {};
  const p = entity.params;
  return {
    mark: safeText(p.mark),
    id: shortId(entity.id),
    floor: lookups.floor(entity.floorId),
    kind: lookups.translateKind ? lookups.translateKind(p.kind) : p.kind,
    width: safeNumber(p.width),
    height: safeNumber(p.height),
    sill: safeNumber(p.sillHeight),
    handingText: handingToGreek(p.handing, p.openDirection),
    handingCode: handingToDIN(p.handing, p.openDirection),
    material: lookups.material(p.material),
    wall: shortId(p.wallId),
  };
}

// ─── Window preset ───────────────────────────────────────────────────────────

function mapWindow(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'opening') return {};
  const p = entity.params;
  return {
    mark: safeText(p.mark),
    id: shortId(entity.id),
    floor: lookups.floor(entity.floorId),
    kind: lookups.translateKind ? lookups.translateKind(p.kind) : p.kind,
    width: safeNumber(p.width),
    height: safeNumber(p.height),
    sill: safeNumber(p.sillHeight),
    glazing: safeNumber(p.glazingPanes),
    material: lookups.material(p.material),
    wall: shortId(p.wallId),
  };
}

// ─── Wall preset ─────────────────────────────────────────────────────────────

function mapWall(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'wall') return {};
  const p = entity.params;
  const g = entity.geometry;
  return {
    id: entity.id,
    buildingName: lookups.building?.(entity.buildingId)?.name ?? null,
    floor: lookups.floor(entity.floorId),
    category: p.category,
    kind: entity.kind,
    length: safeNumber(g.length),
    thickness: safeNumber(p.thickness),
    height: safeNumber(p.height),
    area: safeNumber(g.area),
    volume: safeNumber(g.volume),
    dnaLayers: safeNumber(p.dna?.layers.length),
  };
}

// ─── Slab preset ─────────────────────────────────────────────────────────────

/** Default finishThickness (mm) when Floor.finishThickness is not set. ADR-369 §9 Q4. */
const DEFAULT_FINISH_THICKNESS_MM = 80;

function mapSlab(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'slab') return {};
  const p = entity.params;
  const g = entity.geometry;
  const finishThickness = lookups.floorFinish(entity.floorId) ?? DEFAULT_FINISH_THICKNESS_MM;
  const tosElevation = typeof p.levelElevation === 'number'
    ? p.levelElevation - finishThickness
    : null;
  return {
    id: entity.id,
    buildingName: lookups.building?.(entity.buildingId)?.name ?? null,
    floor: lookups.floor(entity.floorId),
    kind: entity.kind,
    elevation: safeNumber(p.levelElevation),
    tosElevation,
    thickness: safeNumber(p.thickness),
    area: safeNumber(g.area),
    netArea: safeNumber(g.netArea),
    volume: safeNumber(g.volume),
    perimeter: safeNumber(g.perimeter),
    reinforcement: p.reinforcement ?? null,
    material: lookups.material(p.material),
  };
}

// ─── Column preset ───────────────────────────────────────────────────────────

function mapColumn(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'column') return {};
  const p = entity.params;
  const g = entity.geometry;
  return {
    id: entity.id,
    buildingName: lookups.building?.(entity.buildingId)?.name ?? null,
    floor: lookups.floor(entity.floorId),
    kind: entity.kind,
    width: safeNumber(p.width),
    depth: safeNumber(p.depth),
    height: safeNumber(p.height),
    rotation: safeNumber(p.rotation),
    area: safeNumber(g.area),
    volume: safeNumber(g.volume),
    material: lookups.material(p.material),
  };
}

// ─── Beam preset ─────────────────────────────────────────────────────────────

function mapBeam(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'beam') return {};
  const p = entity.params;
  const g = entity.geometry;
  return {
    id: entity.id,
    buildingName: lookups.building?.(entity.buildingId)?.name ?? null,
    floor: lookups.floor(entity.floorId),
    kind: entity.kind,
    length: safeNumber(g.length),
    width: safeNumber(p.width),
    depth: safeNumber(p.depth),
    elevation: safeNumber(p.topElevation),
    area: safeNumber(g.area),
    volume: safeNumber(g.volume),
    supportType: p.supportType ?? null,
    material: lookups.material(p.material),
  };
}

// ─── Stair preset ────────────────────────────────────────────────────────────

function mapStair(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'stair') return {};
  const p = entity.params;
  return {
    id: entity.id,
    floor: lookups.floor(entity.floorId),
    kind: entity.kind,
    stepCount: safeNumber(p.stepCount),
    rise: safeNumber(p.rise),
    tread: safeNumber(p.tread),
    width: safeNumber(p.width),
    totalRise: safeNumber(p.totalRise),
    totalRun: safeNumber(p.totalRun),
    pitch: safeNumber(p.pitch),
    structureType: p.structureType,
  };
}

// ─── Slab-opening preset ─────────────────────────────────────────────────────

function mapSlabOpening(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'slab-opening') return {};
  const p = entity.params;
  const g = entity.geometry;
  return {
    id: entity.id,
    floor: lookups.floor(entity.floorId),
    kind: entity.kind,
    area: safeNumber(g.area),
    perimeter: safeNumber(g.perimeter),
    fireRating: safeNumber(p.fireRating),
    elevation: safeNumber(p.elevationOverride),
    material: lookups.material(p.material),
    slabId: safeText(p.slabId),
  };
}

// ─── Combined preset (cross-type geometry-derived roll-up) ───────────────────

/** Entity types covered by the kind-dispatched ΑΤΟΕ table (stair + slab-opening excluded). */
const COMBINED_ATOE_TYPES: ReadonlySet<string> = new Set(['wall', 'opening', 'slab', 'column', 'beam']);

interface CombinedPrimaryQuantity {
  readonly quantity: number;
  readonly unit: string | null;
  readonly atoeCategory: string | null;
}

/**
 * ADR-395 §4.6 (G5) — derive the combined preset's primary quantity from
 * computed geometry + the ΑΤΟΕ SSoT, NOT from the removed `qto` field.
 * Mirrors `BimToBoqBridge` for walls/openings/slabs/columns/beams and, for
 * stairs, the geometry-derived `computeStairBoqQuantities` (concrete volume,
 * falling back to tread cladding area on non-concrete structure types).
 * Slab-openings are subtractive → no positive BOQ quantity.
 */
function combinedPrimary(entity: AnyBimEntity): CombinedPrimaryQuantity {
  if (entity.type === 'stair') {
    const q = computeStairBoqQuantities(entity.params);
    if (q.concreteVolumeM3 > 0) {
      return { quantity: q.concreteVolumeM3, unit: 'm3', atoeCategory: resolveStairComponentMapping('concrete').categoryCode };
    }
    return { quantity: q.treadCladdingAreaM2, unit: 'm2', atoeCategory: resolveStairComponentMapping('cladding').categoryCode };
  }
  if (!COMBINED_ATOE_TYPES.has(entity.type)) {
    return { quantity: 0, unit: null, atoeCategory: null };
  }
  const category =
    'params' in entity && entity.params !== null && typeof entity.params === 'object' && 'category' in entity.params
      ? (entity.params as { category?: string }).category
      : undefined;
  const mapping = resolveAtoeMapping(entity.type as BimEntityType, entity.kind, category);
  if (!mapping) return { quantity: 0, unit: null, atoeCategory: null };
  const geometry = entity.geometry as { area?: number; volume?: number } | undefined;
  return { quantity: deriveAtoeQuantity(mapping.unit, geometry), unit: mapping.unit, atoeCategory: mapping.categoryCode };
}

function mapCombined(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  const primary = combinedPrimary(entity);
  const material =
    'params' in entity && entity.params !== null && typeof entity.params === 'object' && 'material' in entity.params
      ? (entity.params as { material?: string }).material
      : undefined;
  return {
    id: entity.id,
    buildingName: lookups.building?.(entity.buildingId)?.name ?? null,
    type: entity.type,
    kind: entity.kind,
    floor: lookups.floor(entity.floorId),
    primaryQuantity: safeNumber(primary.quantity),
    primaryUnit: primary.unit,
    atoeCategory: primary.atoeCategory,
    material: lookups.material(material),
  };
}

// ─── Registry ────────────────────────────────────────────────────────────────

const PRESET_REGISTRY: Readonly<Record<ScheduleEntityType, SchedulePreset>> = {
  'door':         { columns: DOOR_COLUMNS,         map: mapDoor },
  'window':       { columns: WINDOW_COLUMNS,       map: mapWindow },
  'wall':         { columns: WALL_COLUMNS,         map: mapWall },
  'slab':         { columns: SLAB_COLUMNS,         map: mapSlab },
  'column':       { columns: COLUMN_COLUMNS,       map: mapColumn },
  'beam':         { columns: BEAM_COLUMNS,         map: mapBeam },
  'stair':        { columns: STAIR_COLUMNS,        map: mapStair },
  'slab-opening': { columns: SLAB_OPENING_COLUMNS, map: mapSlabOpening },
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
    case 'sliding-door':
    case 'french-door':
      return 'door';
    case 'window':
    case 'fixed':
      return 'window';
  }
}
