/**
 * ============================================================================
 * UNIFIED EXPORT SYSTEM — Core Types (SSoT)
 * ============================================================================
 *
 * Type contract for the DXF Viewer unified export pipeline (DXF / IFC4 / PDF).
 * Mirrors the `print/` engine layering (ADR-453): pure core → format adapters →
 * service facade → UI. These types are pure data (no React, no I/O).
 *
 * ADR-505 — Unified Export System.
 */

import type { Entity, SceneModel } from '../types/entities';
import type { DxfVersion, DxfUnit } from '../types/dxf-export.types';
import type { Level } from '../systems/levels/config';

// ============================================================================
// SCOPE ENUMS (the three user-facing axes)
// ============================================================================

/** Target file format. */
export type ExportFormat = 'dxf' | 'ifc' | 'pdf';

/**
 * Content filter — which kinds of entities go into the file.
 * `dxf-only`  → only native DXF entities (line/arc/text/…); BIM excluded.
 * `bim-only`  → only BIM entities (wall/column/beam/slab/…).
 * `both`      → everything.
 * SSoT predicate: `isBimEntity()` (see `core/export-entity-scope.ts`).
 */
export type ExportEntityScope = 'dxf-only' | 'bim-only' | 'both';

/**
 * Floor coverage.
 * `active`      → only the currently active level → one file.
 * `all-zip`     → every occupied level → one file each, packaged in a `.zip`.
 * `all-single`  → every occupied level merged into one file, separated by a
 *                 per-floor layer prefix (e.g. `FL01_`).
 */
export type ExportFloorScope = 'active' | 'all-zip' | 'all-single';

/**
 * DXF geometry granularity per target CAD:
 *   'polyline' → polylines/footprints stay single POLYLINE objects (AutoCAD).
 *   'lines'    → exploded to LINE segments (Τέκτονας/FESPA basic parser).
 */
export type DxfLineMode = 'polyline' | 'lines';

// ============================================================================
// REQUEST (built by the dialog, consumed by the service facade)
// ============================================================================

export interface ExportRequest {
  readonly format: ExportFormat;
  readonly entityScope: ExportEntityScope;
  readonly floorScope: ExportFloorScope;

  /** DXF-specific — only meaningful when `format === 'dxf'`. */
  readonly dxfVersion?: DxfVersion;
  readonly dxfUnit?: DxfUnit;
  /** DXF geometry mode (POLYLINE vs exploded LINEs). */
  readonly dxfLineMode?: DxfLineMode;
}

// ============================================================================
// DEPS (live data gathered by the Host at submit time — never subscribed
// inside the dialog, ADR-040)
// ============================================================================

/** A single level paired with its loaded scene. */
export interface ExportLevelScene {
  readonly level: Level;
  readonly scene: SceneModel;
}

export interface ExportDeps {
  /** Every level that currently has a loaded scene (active + others). */
  readonly levelScenes: readonly ExportLevelScene[];
  /** Id of the active level (used by `floorScope === 'active'`). */
  readonly activeLevelId: string | null;
  /** For filename + IFC/PDF title blocks. */
  readonly projectName: string;
  /** ISO date (YYYY-MM-DD) — for filename + title block. */
  readonly dateStr: string;
}

// ============================================================================
// RESULT
// ============================================================================

export interface ExportResult {
  /** Final filename handed to the browser download (incl. extension). */
  readonly filename: string;
  /** Number of source files packaged (1 for single, N for zip). */
  readonly fileCount: number;
  /** Non-fatal messages (e.g. BIM types with no decomposition yet). */
  readonly warnings: readonly string[];
}

/** A produced file before packaging/download. */
export interface ExportArtifact {
  readonly filename: string;
  readonly blob: Blob;
}

// ============================================================================
// DXF PRIMITIVE DECOMPOSITION (output of `bim-to-dxf-primitives.ts`)
// ============================================================================

/** Native-DXF entities ready for the ezdxf request + any skip warnings. */
export interface DxfFlattenResult {
  readonly entities: Entity[];
  readonly warnings: string[];
}
