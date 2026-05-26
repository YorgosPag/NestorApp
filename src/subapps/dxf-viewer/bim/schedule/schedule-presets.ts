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
 *   - Combined preset uses BimQuantityTakeoff (qto) so it works across all
 *     entity types uniformly.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
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
import type {
  ScheduleCellValue,
  ScheduleColumnDef,
  ScheduleEntityType,
  ScheduleLookups,
  ScheduleRow,
} from './types';

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

// ─── Door preset (ADR-363 §6 Phase 8 Q3 + Q4) ────────────────────────────────

const DOOR_COLUMNS: readonly ScheduleColumnDef[] = [
  { key: 'mark',         i18nKey: 'col.mark',         valueType: 'text',              align: 'left'   },
  { key: 'id',           i18nKey: 'col.id',           valueType: 'text',              align: 'left'   },
  { key: 'floor',        i18nKey: 'col.floor',        valueType: 'text',              align: 'left'   },
  { key: 'kind',         i18nKey: 'col.kind',         valueType: 'text',              align: 'left'   },
  { key: 'width',        i18nKey: 'col.width',        valueType: 'dimension-mm-to-m', align: 'right'  },
  { key: 'height',       i18nKey: 'col.height',       valueType: 'dimension-mm-to-m', align: 'right'  },
  { key: 'sill',         i18nKey: 'col.sill',         valueType: 'dimension-mm-to-m', align: 'right'  },
  { key: 'handingText',  i18nKey: 'col.handingText',  valueType: 'text',              align: 'left'   },
  { key: 'handingCode',  i18nKey: 'col.handingCode',  valueType: 'text',              align: 'center' },
  { key: 'material',     i18nKey: 'col.material',     valueType: 'text',              align: 'left'   },
  { key: 'wall',         i18nKey: 'col.wall',         valueType: 'text',              align: 'left'   },
];

function mapDoor(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'opening') return {};
  const p = entity.params;
  return {
    mark: safeText(p.mark),
    id: entity.id,
    floor: lookups.floor(entity.floorId),
    kind: p.kind,
    width: safeNumber(p.width),
    height: safeNumber(p.height),
    sill: safeNumber(p.sillHeight),
    handingText: handingToGreek(p.handing, p.openDirection),
    handingCode: handingToDIN(p.handing, p.openDirection),
    material: lookups.material(p.material),
    wall: safeText(p.wallId),
  };
}

// ─── Window preset ───────────────────────────────────────────────────────────

const WINDOW_COLUMNS: readonly ScheduleColumnDef[] = [
  { key: 'mark',      i18nKey: 'col.mark',      valueType: 'text',              align: 'left'  },
  { key: 'id',        i18nKey: 'col.id',        valueType: 'text',              align: 'left'  },
  { key: 'floor',     i18nKey: 'col.floor',     valueType: 'text',              align: 'left'  },
  { key: 'kind',      i18nKey: 'col.kind',      valueType: 'text',              align: 'left'  },
  { key: 'width',     i18nKey: 'col.width',     valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'height',    i18nKey: 'col.height',    valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'sill',      i18nKey: 'col.sill',      valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'glazing',   i18nKey: 'col.glazing',   valueType: 'count',             align: 'right' },
  { key: 'material',  i18nKey: 'col.material',  valueType: 'text',              align: 'left'  },
  { key: 'wall',      i18nKey: 'col.wall',      valueType: 'text',              align: 'left'  },
];

function mapWindow(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'opening') return {};
  const p = entity.params;
  return {
    mark: safeText(p.mark),
    id: entity.id,
    floor: lookups.floor(entity.floorId),
    kind: p.kind,
    width: safeNumber(p.width),
    height: safeNumber(p.height),
    sill: safeNumber(p.sillHeight),
    glazing: safeNumber(p.glazingPanes),
    material: lookups.material(p.material),
    wall: safeText(p.wallId),
  };
}

// ─── Wall preset ─────────────────────────────────────────────────────────────

const WALL_COLUMNS: readonly ScheduleColumnDef[] = [
  { key: 'id',           i18nKey: 'col.id',           valueType: 'text', align: 'left' },
  { key: 'buildingName', i18nKey: 'col.buildingName', valueType: 'text', align: 'left' },
  { key: 'floor',        i18nKey: 'col.floor',        valueType: 'text', align: 'left' },
  { key: 'category',     i18nKey: 'col.category',     valueType: 'text', align: 'left' },
  { key: 'kind',       i18nKey: 'col.kind',       valueType: 'text',              align: 'left'  },
  { key: 'length',     i18nKey: 'col.length',     valueType: 'number',            align: 'right' },
  { key: 'thickness',  i18nKey: 'col.thickness',  valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'height',     i18nKey: 'col.height',     valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'area',       i18nKey: 'col.area',       valueType: 'area-m2',           align: 'right' },
  { key: 'volume',     i18nKey: 'col.volume',     valueType: 'volume-m3',         align: 'right' },
  { key: 'dnaLayers',  i18nKey: 'col.dnaLayers',  valueType: 'count',             align: 'right' },
];

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

const SLAB_COLUMNS: readonly ScheduleColumnDef[] = [
  { key: 'id',             i18nKey: 'col.id',             valueType: 'text',              align: 'left'  },
  { key: 'buildingName',   i18nKey: 'col.buildingName',   valueType: 'text',              align: 'left'  },
  { key: 'floor',          i18nKey: 'col.floor',          valueType: 'text',              align: 'left'  },
  { key: 'kind',           i18nKey: 'col.kind',           valueType: 'text',              align: 'left'  },
  { key: 'elevation',      i18nKey: 'col.elevation',      valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'tosElevation',   i18nKey: 'col.tosElevation',   valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'thickness',      i18nKey: 'col.thickness',      valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'area',           i18nKey: 'col.area',           valueType: 'area-m2',           align: 'right' },
  { key: 'netArea',        i18nKey: 'col.netArea',        valueType: 'area-m2',           align: 'right' },
  { key: 'volume',         i18nKey: 'col.volume',         valueType: 'volume-m3',         align: 'right' },
  { key: 'perimeter',      i18nKey: 'col.perimeter',      valueType: 'number',            align: 'right' },
  { key: 'reinforcement',  i18nKey: 'col.reinforcement',  valueType: 'text',              align: 'left'  },
  { key: 'material',       i18nKey: 'col.material',       valueType: 'text',              align: 'left'  },
];

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

const COLUMN_COLUMNS: readonly ScheduleColumnDef[] = [
  { key: 'id',           i18nKey: 'col.id',           valueType: 'text', align: 'left' },
  { key: 'buildingName', i18nKey: 'col.buildingName', valueType: 'text', align: 'left' },
  { key: 'floor',        i18nKey: 'col.floor',        valueType: 'text', align: 'left' },
  { key: 'kind',      i18nKey: 'col.kind',      valueType: 'text',              align: 'left'  },
  { key: 'width',     i18nKey: 'col.width',     valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'depth',     i18nKey: 'col.depth',     valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'height',    i18nKey: 'col.height',    valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'rotation',  i18nKey: 'col.rotation',  valueType: 'number',            align: 'right' },
  { key: 'area',      i18nKey: 'col.area',      valueType: 'area-m2',           align: 'right' },
  { key: 'volume',    i18nKey: 'col.volume',    valueType: 'volume-m3',         align: 'right' },
  { key: 'material',  i18nKey: 'col.material',  valueType: 'text',              align: 'left'  },
];

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

const BEAM_COLUMNS: readonly ScheduleColumnDef[] = [
  { key: 'id',           i18nKey: 'col.id',           valueType: 'text', align: 'left' },
  { key: 'buildingName', i18nKey: 'col.buildingName', valueType: 'text', align: 'left' },
  { key: 'floor',        i18nKey: 'col.floor',        valueType: 'text', align: 'left' },
  { key: 'kind',         i18nKey: 'col.kind',         valueType: 'text',              align: 'left'  },
  { key: 'length',       i18nKey: 'col.length',       valueType: 'number',            align: 'right' },
  { key: 'width',        i18nKey: 'col.width',        valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'depth',        i18nKey: 'col.depth',        valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'elevation',    i18nKey: 'col.elevation',    valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'area',         i18nKey: 'col.area',         valueType: 'area-m2',           align: 'right' },
  { key: 'volume',       i18nKey: 'col.volume',       valueType: 'volume-m3',         align: 'right' },
  { key: 'supportType',  i18nKey: 'col.supportType',  valueType: 'text',              align: 'left'  },
  { key: 'material',     i18nKey: 'col.material',     valueType: 'text',              align: 'left'  },
];

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

const STAIR_COLUMNS: readonly ScheduleColumnDef[] = [
  { key: 'id',              i18nKey: 'col.id',              valueType: 'text',              align: 'left'  },
  { key: 'floor',           i18nKey: 'col.floor',           valueType: 'text',              align: 'left'  },
  { key: 'kind',            i18nKey: 'col.kind',            valueType: 'text',              align: 'left'  },
  { key: 'stepCount',       i18nKey: 'col.stepCount',       valueType: 'count',             align: 'right' },
  { key: 'rise',            i18nKey: 'col.rise',            valueType: 'dimension-mm-to-cm', align: 'right' },
  { key: 'tread',           i18nKey: 'col.tread',           valueType: 'dimension-mm-to-cm', align: 'right' },
  { key: 'width',           i18nKey: 'col.width',           valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'totalRise',       i18nKey: 'col.totalRise',       valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'totalRun',        i18nKey: 'col.totalRun',        valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'pitch',           i18nKey: 'col.pitch',           valueType: 'number',            align: 'right' },
  { key: 'structureType',   i18nKey: 'col.structureType',   valueType: 'text',              align: 'left'  },
];

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

const SLAB_OPENING_COLUMNS: readonly ScheduleColumnDef[] = [
  { key: 'id',          i18nKey: 'col.id',          valueType: 'text',              align: 'left'  },
  { key: 'floor',       i18nKey: 'col.floor',       valueType: 'text',              align: 'left'  },
  { key: 'kind',        i18nKey: 'col.kind',        valueType: 'text',              align: 'left'  },
  { key: 'area',        i18nKey: 'col.area',        valueType: 'area-m2',           align: 'right' },
  { key: 'perimeter',   i18nKey: 'col.perimeter',   valueType: 'number',            align: 'right' },
  { key: 'fireRating',  i18nKey: 'col.fireRating',  valueType: 'count',             align: 'right' },
  { key: 'elevation',   i18nKey: 'col.elevation',   valueType: 'dimension-mm-to-m', align: 'right' },
  { key: 'material',    i18nKey: 'col.material',    valueType: 'text',              align: 'left'  },
  { key: 'slabId',      i18nKey: 'col.slabId',      valueType: 'text',              align: 'left'  },
];

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

// ─── Combined preset (cross-type qto roll-up) ────────────────────────────────

const COMBINED_COLUMNS: readonly ScheduleColumnDef[] = [
  { key: 'id',                i18nKey: 'col.id',                valueType: 'text',   align: 'left'   },
  { key: 'buildingName',      i18nKey: 'col.buildingName',      valueType: 'text',   align: 'left'   },
  { key: 'type',              i18nKey: 'col.type',              valueType: 'text',   align: 'left'   },
  { key: 'kind',              i18nKey: 'col.kind',              valueType: 'text',   align: 'left'   },
  { key: 'floor',             i18nKey: 'col.floor',             valueType: 'text',   align: 'left'   },
  { key: 'primaryQuantity',   i18nKey: 'col.primaryQuantity',   valueType: 'number', align: 'right' },
  { key: 'primaryUnit',       i18nKey: 'col.primaryUnit',       valueType: 'text',   align: 'center'},
  { key: 'atoeCategory',      i18nKey: 'col.atoeCategory',      valueType: 'text',   align: 'left'  },
  { key: 'material',          i18nKey: 'col.material',          valueType: 'text',   align: 'left'  },
];

function mapCombined(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  const qto = 'qto' in entity ? entity.qto : undefined;
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
    primaryQuantity: safeNumber(qto?.primaryQuantity),
    primaryUnit: qto?.primaryUnit ?? null,
    atoeCategory: qto?.atoeCategory ?? null,
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

/**
 * Column set for per-building BOQ summary (ADR-369 §9.2 Q2.4).
 * Use as `ScheduleConfig.columnsOverride` when `groupByBuilding = true` to
 * promote buildingName to the leading column and drop entity-specific fields.
 */
export const MULTI_BUILDING_COLUMNS: readonly ScheduleColumnDef[] = [
  { key: 'buildingName',    i18nKey: 'col.buildingName',    valueType: 'text',   align: 'left'   },
  { key: 'type',            i18nKey: 'col.type',            valueType: 'text',   align: 'left'   },
  { key: 'kind',            i18nKey: 'col.kind',            valueType: 'text',   align: 'left'   },
  { key: 'floor',           i18nKey: 'col.floor',           valueType: 'text',   align: 'left'   },
  { key: 'primaryQuantity', i18nKey: 'col.primaryQuantity', valueType: 'number', align: 'right'  },
  { key: 'primaryUnit',     i18nKey: 'col.primaryUnit',     valueType: 'text',   align: 'center' },
  { key: 'atoeCategory',    i18nKey: 'col.atoeCategory',    valueType: 'text',   align: 'left'   },
  { key: 'material',        i18nKey: 'col.material',        valueType: 'text',   align: 'left'   },
];

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
