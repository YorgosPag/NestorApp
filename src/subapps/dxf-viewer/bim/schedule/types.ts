/**
 * BIM Schedule Export — Core Types (ADR-363 §5 + §6 Phase 8).
 *
 * Pure type layer για schedule generation: row schema, column definitions,
 * filter criteria, export formats. Zero React, zero canvas coupling — used
 * by builder + exporters + UI alike.
 *
 * SSoT:
 *   - `ScheduleRow.cells` is a `Record<string, CellValue>` keyed by column
 *     `key` from the matching `ScheduleColumnDef[]`.
 *   - `ScheduleColumnDef.valueType` drives both formatting (numeric vs text)
 *     and exporter alignment (right-aligned numbers, left-aligned text).
 *   - `FilterCriteria` is composable: any subset of the 4 filter axes
 *     (floor / category / region / selection) can be active simultaneously.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

import type { BoundingBox3D } from '../types/bim-base';
import type { BuildingRef } from '../utils/bim-floor-utils';
import type { OpeningHardwareComponent } from '../family-types/opening-hardware-set';

// ─── Cell + Column primitives ─────────────────────────────────────────────────

/** Schedule cell scalar — exporters serialise as text/number/empty. */
export type ScheduleCellValue = string | number | null;

/**
 * Column value-type discriminator. Drives both numeric formatting
 * (mm→m conversion, area unit suffix) and exporter alignment.
 */
export type ScheduleColumnValueType =
  | 'text'
  | 'number'
  | 'dimension-mm-to-m'   // raw mm → display m with 3 decimals
  | 'dimension-mm-to-cm'  // raw mm → display cm with 1 decimal
  | 'area-m2'             // raw m² → display m² with 2 decimals
  | 'volume-m3'           // raw m³ → display m³ with 3 decimals
  | 'count';              // integer pcs

/** Cell alignment hint για xlsx/PDF exporters. */
export type ScheduleColumnAlign = 'left' | 'right' | 'center';

/**
 * Column definition — describes one column of a schedule. `key` is the
 * `ScheduleRow.cells` lookup key; `i18nKey` resolves to the localized header
 * via dxf-schedule namespace.
 */
export interface ScheduleColumnDef {
  readonly key: string;
  /** Translation key under `dxf-schedule:` namespace. */
  readonly i18nKey: string;
  readonly valueType: ScheduleColumnValueType;
  readonly align: ScheduleColumnAlign;
  /** xlsx/PDF column width hint (chars OR mm — exporter-specific). */
  readonly widthHint?: number;
}

// ─── Row + Schedule ──────────────────────────────────────────────────────────

/**
 * Schedule entity-type discriminator. 7 BIM entity types + 'combined'
 * (one mixed table) + 'door'/'window' (split openings — door has handing
 * columns, window does not).
 */
export type ScheduleEntityType =
  | 'door'
  | 'window'
  | 'hardware'
  | 'wall'
  | 'slab'
  | 'column'
  | 'beam'
  | 'stair'
  | 'slab-opening'
  | 'foundation'
  | 'combined';

/**
 * Single schedule row — one BIM entity flattened to cells per column.
 * `entityId` keeps back-reference for navigation; `floorId` + `buildingId`
 * denormalised for filter axes without re-lookup.
 */
export interface ScheduleRow {
  readonly entityId: string;
  readonly entityType: ScheduleEntityType;
  /** Optional sub-type discriminator (kind) — used by selection-aware UI. */
  readonly entityKind?: string;
  readonly floorId?: string;
  /** ADR-369 §9.2 Q2.4 — denormalised for building-filter axis + group-by. */
  readonly buildingId?: string;
  readonly cells: Readonly<Record<string, ScheduleCellValue>>;
}

/** Complete schedule — column schema + rows. Returned by `buildSchedule()`. */
export interface Schedule {
  readonly entityType: ScheduleEntityType;
  readonly columns: readonly ScheduleColumnDef[];
  readonly rows: readonly ScheduleRow[];
  /** Generation timestamp (epoch ms). */
  readonly generatedAt: number;
}

/**
 * The MINIMUM shape the three exporters (CSV / xlsx / PDF) actually consume: a column
 * schema plus rows of cells. `Schedule` satisfies it structurally, so every existing
 * caller keeps working unchanged.
 *
 * ADR-650 M7 — the Greek survey deliverables (coordinate table, plot metes-and-bounds,
 * earthworks volumes, tolerance check) are tables too, but their rows are NOT BIM
 * entities: there is no `entityId`/`entityType` to give them. Rather than fabricate fake
 * entity ids to squeeze them through the `Schedule` type — or fork a second CSV/xlsx/PDF
 * writer — the exporters were widened to this supertype. One table-export engine, two
 * producers.
 */
export interface ExportableTableRow {
  readonly cells: Readonly<Record<string, ScheduleCellValue>>;
}

export interface ExportableTable {
  readonly columns: readonly ScheduleColumnDef[];
  readonly rows: readonly ExportableTableRow[];
}

/** A titled table — the unit of a multi-table PDF / multi-sheet workbook (ADR-650 M7). */
export interface ExportableTableSection {
  /** Already-localised heading (PDF section title / xlsx worksheet name). */
  readonly title: string;
  readonly table: ExportableTable;
}

// ─── Filter criteria (4 composable axes) ─────────────────────────────────────

/**
 * Filter criteria — composable 5 axes. `undefined` axis = no filter on that
 * dimension. Empty array for a defined axis = match-nothing (intentional —
 * "show no floors" excludes everything).
 */
export interface ScheduleFilterCriteria {
  /** Allowed floorIds. Undefined = all floors. */
  readonly floorIds?: readonly string[];
  /** ADR-369 §9.2 Q2.4 — allowed buildingIds. Undefined = all buildings. */
  readonly buildingIds?: readonly string[];
  /**
   * Allowed material IDs OR entity kinds. Schedule-builder applies it
   * heterogeneously: matches first `params.material` then `kind` so both
   * "ξύλο" (material) και "πόρτα" (kind) work transparently.
   */
  readonly categories?: readonly string[];
  /** World-coord bounding box (mm). Entity bbox must intersect to pass. */
  readonly region?: BoundingBox3D;
  /** Active selection IDs. Used by `'selection-only'` mode. */
  readonly selectionIds?: readonly string[];
}

// ─── Export format ───────────────────────────────────────────────────────────

/** Export output format. */
export type ScheduleExportFormat = 'csv' | 'xlsx' | 'pdf';

/**
 * Export options passed to format-specific exporters. `filename` is sans
 * extension — exporter appends. `title` shows as PDF heading / xlsx sheet
 * name / CSV title row.
 */
export interface ScheduleExportOptions {
  readonly filename: string;
  readonly title: string;
  /**
   * Right-to-left text in PDF (ignored by CSV/xlsx). Defaults false.
   * Reserved για future hebrew/arabic support; Greek is LTR.
   */
  readonly rtl?: boolean;
  /**
   * PDF page-footer prefix. Defaults to `'BIM Schedule'` (the original behaviour); the
   * survey deliverables (ADR-650 M7) pass their own so a topographic diagram does not
   * carry a BIM footer.
   */
  readonly footerLabel?: string;
}

// ─── Lookup adapters (decouple from Firestore + locale layers) ───────────────

/**
 * Floor-label resolver. Caller wires this from `useFloors()` /
 * project-org service. Returns localized floor label (π.χ. "Ισόγειο",
 * "1ος όροφος"). Unknown floorId → fallback to id.
 */
export type FloorLabelLookup = (floorId: string | undefined) => string;

/**
 * Material-label resolver. Caller wires from material catalog service.
 * Unknown materialId → fallback to id (or empty if undefined).
 */
export type MaterialLabelLookup = (materialId: string | undefined) => string;

/**
 * Floor finish-thickness resolver (ADR-369 §9 Q4 — ToS derivation).
 * Returns `Floor.finishThickness` in mm, or `undefined` if floor not found.
 * Callers should provide `undefined` when no floors are loaded yet.
 */
export type FloorFinishLookup = (floorId: string | undefined) => number | undefined;

/**
 * Building resolver (ADR-369 §9.2 Q2.4 — BOQ group-by-building).
 * Returns the `BuildingRef` for a given buildingId, or `undefined` when not found.
 * Optional — omit in single-building contexts; cells will have null buildingName.
 */
export type BuildingLookup = (buildingId: string | undefined) => BuildingRef | undefined;

/** Bundle of lookups passed to builder + presets. */
export interface ScheduleLookups {
  readonly floor: FloorLabelLookup;
  readonly material: MaterialLabelLookup;
  /** ADR-369 §9 Q4 — resolves floor finishThickness (mm) for ToS calculation. */
  readonly floorFinish: FloorFinishLookup;
  /** ADR-369 §9.2 Q2.4 — resolves building name for BOQ group-by-building. Optional. */
  readonly building?: BuildingLookup;
  /** ADR-376 C.3 — Translates raw kind enum (opening/wall/column/…) to display label. Optional. */
  readonly translateKind?: (kind: string) => string;
  /** ADR-674 Φ Β — translates a hardware component enum to its localised name (hardware schedule breakdown). Optional. */
  readonly translateHardwareComponent?: (component: OpeningHardwareComponent) => string;
  /** ADR-363 §6 Phase 8 — translates raw entity `type` (wall/opening/…) to a singular Greek label. Optional. */
  readonly translateType?: (type: string) => string;
}

// ─── Schedule config (what to build) ─────────────────────────────────────────

/**
 * Build configuration. `entityType` selects which preset to apply (or
 * 'combined' for a unified mini-table). `filters` are applied AFTER mapping.
 * `columnsOverride` lets the UI hide columns ή reorder (Phase 8+ — Phase 1
 * uses preset defaults). `groupByBuilding` sorts rows by buildingId for
 * multi-building BOQ views (ADR-369 §9.2 Q2.4).
 */
export interface ScheduleConfig {
  readonly entityType: ScheduleEntityType;
  readonly filters: ScheduleFilterCriteria;
  readonly columnsOverride?: readonly ScheduleColumnDef[];
  /** ADR-369 §9.2 Q2.4 — when true, rows sorted by buildingId for grouped display. */
  readonly groupByBuilding?: boolean;
}
