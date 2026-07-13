/**
 * ADR-650 Milestone 2 — Import-wizard domain types (points in → TopoPointStore).
 *
 * Big-player pattern (Civil 3D «Format Manager» / point-file formats): a survey file is
 * a TABLE of untyped cells; a MAPPING declares which column plays which role; a UNIT
 * declares the scale. Parsing (file → table) and interpretation (table → points) are two
 * separate, independently testable steps — exactly why Civil 3D can import any instrument's
 * export without a bespoke parser per vendor.
 *
 *   file (CSV/TXT/Excel)  →  RawTable  →  [ColumnMapping + TopoUnit]  →  TopoPoint[]
 *   file (DXF)            →────────────────────────────────────────────↗  (own extractor)
 *
 * ⚠️ SURVEY CONVENTION (the #1 import bug): in PNEZD/PENZD-style formats, **N = Northing = Y**
 * and **E = Easting = X**. They are NOT in X,Y order. Encoded once in `topo-order-presets`.
 *
 * There is NO logic in this file (types only — exempt from the 500-line rule).
 */

/** What a spreadsheet/CSV column means. `ignore` = column carries no survey meaning. */
export type ColumnRole = 'x' | 'y' | 'z' | 'code' | 'pointId' | 'ignore';

/**
 * Column index → role. Index is the 0-based position in `RawTable.rows[i]`.
 * A role may appear at most once; `x`, `y` and `z` are required for a usable import.
 */
export type ColumnMapping = readonly ColumnRole[];

/** Planimetric + vertical unit of the SOURCE file (canonical storage is mm — ADR-462). */
export type TopoUnit = 'm' | 'mm' | 'ft';

/** Source unit → canonical mm multiplier (ADR-462). US survey foot is not distinguished. */
export const TOPO_UNIT_SCALE_TO_MM: Readonly<Record<TopoUnit, number>> = {
  m: 1000,
  mm: 1,
  ft: 304.8,
};

/**
 * A parsed, still-untyped file: optional header labels + the data rows. Produced by
 * `topo-delimited-reader` (CSV/TXT) and `topo-excel-reader` (XLSX) alike, so the mapper
 * downstream never learns which file format it came from.
 */
export interface RawTable {
  /** Column labels when the file had a header row; empty when it did not. */
  readonly headers: readonly string[];
  /** Data rows (header row excluded). Ragged rows are allowed — the mapper skips them. */
  readonly rows: readonly (readonly string[])[];
  /** The delimiter that was detected (informational; empty for spreadsheet sources). */
  readonly delimiter?: string;
}

/** A named column order (e.g. PNEZD) the surveyor can pick instead of mapping by hand. */
export interface OrderPreset {
  /** Stable id — also the i18n key suffix under `topography.import.preset.*`. */
  readonly id: string;
  /** The literal field order, e.g. `['pointId','y','x','z','code']` for PNEZD. */
  readonly mapping: ColumnMapping;
}

/** Outcome of interpreting a `RawTable` through a `ColumnMapping`. */
export interface MappedPointsResult {
  readonly points: readonly import('./topo-types').TopoPoint[];
  /** 1-based row numbers (within `rows`) that yielded no finite X/Y/Z. */
  readonly skipped: readonly number[];
}
