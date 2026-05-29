/**
 * BIM Schedule Export — Preset Column Schemas (ADR-363 §6 Phase 8).
 *
 * Pure column-definition tables for the schedule preset registry. Split out
 * of `schedule-presets.ts` (SRP / N.7.1 file-size) — this module owns the
 * `ScheduleColumnDef[]` schema, `schedule-presets.ts` owns the entity→cell
 * mappers + registry that consume them.
 *
 * @see ./schedule-presets.ts
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

import type { ScheduleColumnDef } from './types';

// ─── Door preset (ADR-363 §6 Phase 8 Q3 + Q4) ────────────────────────────────

export const DOOR_COLUMNS: readonly ScheduleColumnDef[] = [
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

// ─── Window preset ───────────────────────────────────────────────────────────

export const WINDOW_COLUMNS: readonly ScheduleColumnDef[] = [
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

// ─── Wall preset ─────────────────────────────────────────────────────────────

export const WALL_COLUMNS: readonly ScheduleColumnDef[] = [
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

// ─── Slab preset ─────────────────────────────────────────────────────────────

export const SLAB_COLUMNS: readonly ScheduleColumnDef[] = [
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

// ─── Column preset ───────────────────────────────────────────────────────────

export const COLUMN_COLUMNS: readonly ScheduleColumnDef[] = [
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

// ─── Beam preset ─────────────────────────────────────────────────────────────

export const BEAM_COLUMNS: readonly ScheduleColumnDef[] = [
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

// ─── Stair preset ────────────────────────────────────────────────────────────

export const STAIR_COLUMNS: readonly ScheduleColumnDef[] = [
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

// ─── Slab-opening preset ─────────────────────────────────────────────────────

export const SLAB_OPENING_COLUMNS: readonly ScheduleColumnDef[] = [
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

// ─── Combined preset (cross-type geometry-derived roll-up) ───────────────────

export const COMBINED_COLUMNS: readonly ScheduleColumnDef[] = [
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
