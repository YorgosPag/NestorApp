import type { Point2D } from '../rendering/types/Types';
import type { Entity } from './entities';
import { generateLayerId } from '@/services/enterprise-id-convenience';
// ADR-362 Round 5 — SceneModel carries the DXF-parsed DIMSTYLE table so the
// runtime DIMSTYLE registry can be seeded on import (canonical type lives next
// to the parser since it owns the DXF I/O contract).
import type { DimStyleEntry } from '../utils/dxf-parser-types';

/**
 * DXF group 370 lineweight catalog — 24 ISO values (mm) + 3 special enums.
 * Special: -3 = Default, -2 = ByLayer, -1 = ByBlock.
 */
export type LineweightMm =
  | 0 | 0.05 | 0.09 | 0.13 | 0.15 | 0.18 | 0.20 | 0.25
  | 0.30 | 0.35 | 0.40 | 0.50 | 0.53 | 0.60 | 0.70 | 0.80
  | 0.90 | 1.00 | 1.06 | 1.20 | 1.40 | 1.58 | 2.00 | 2.11
  | -3 | -2 | -1;

/** Source of a layer's creation — internal provenance, not DXF. */
export type SceneLayerSource = 'dxf-import' | 'user-created' | 'system-default';

/** AEC discipline taxonomy — ADR-358 §5.3.quinquies (Q7). AIA prefix per category. */
export type AecLayerCategory =
  | 'architectural' | 'structural' | 'electrical' | 'mechanical'
  | 'plumbing' | 'fire' | 'civil' | 'telecom' | 'interior' | 'general';

/**
 * Q16 SCAFFOLD — VP overridable layer properties.
 * Subset of `SceneLayer` props that VPLAYER can override per-viewport.
 * Active wiring deferred; type only used for round-trip preservation in DXF I/O.
 */
export interface VpLayerProps {
  visible?: boolean;
  frozen?: boolean;
  colorAci?: number;
  colorTrueColor?: number | null;
  linetype?: string;
  lineweight?: LineweightMm;
  transparency?: number;
}

/**
 * SceneLayer — ADR-358 §5.1 (FULL Enterprise + GOL + SSoT)
 *
 * Phase 1 shape: 12 base fields + Q15 `bimCategory` scaffold + Q16 `vpOverrides` scaffold.
 */
export interface SceneLayer {
  /** Stable identifier — `lyr_<UUID-v4>` from enterprise-id.service. */
  readonly id: string;
  name: string;
  color: string;
  colorAci?: number;
  colorTrueColor?: number | null;
  linetype?: string;
  lineweight?: LineweightMm;
  transparency?: number;
  visible: boolean;
  frozen?: boolean;
  locked: boolean;
  plottable?: boolean;
  description?: string;
  source?: SceneLayerSource;
  createdAt?: string;
  category?: AecLayerCategory;
  tags?: ReadonlyArray<string>;
  /** Q15 SCAFFOLD — Future BIM mode placeholder. Ratchet blocks active use. */
  readonly bimCategory?: string | null;
  /** Q16 SCAFFOLD — Future per-viewport overrides. Ratchet blocks active use. */
  readonly vpOverrides?: Record<string, Partial<VpLayerProps>> | null;
}

/**
 * SSoT factory for `SceneLayer` (ADR-358 §5.1).
 * All boundary I/O (DXF import, UI create, system seed) MUST go through here.
 */
export function createSceneLayer(input: {
  name: string;
  color?: string;
  visible?: boolean;
  locked?: boolean;
  id?: string;
  colorAci?: number;
  colorTrueColor?: number | null;
  linetype?: string;
  lineweight?: LineweightMm;
  transparency?: number;
  frozen?: boolean;
  plottable?: boolean;
  description?: string;
  source?: SceneLayerSource;
  createdAt?: string;
  category?: AecLayerCategory;
  tags?: ReadonlyArray<string>;
  /** Q15 SCAFFOLD round-trip — DXF I/O sites only. */
  bimCategory?: string | null;
  /** Q16 SCAFFOLD round-trip — DXF I/O sites only. */
  vpOverrides?: Record<string, Partial<VpLayerProps>> | null;
}): SceneLayer {
  return {
    id: input.id ?? generateLayerId(),
    name: input.name,
    color: input.color ?? '#ffffff',
    colorAci: input.colorAci ?? 7,
    colorTrueColor: input.colorTrueColor ?? null,
    linetype: input.linetype ?? 'Continuous',
    lineweight: input.lineweight ?? -3,
    transparency: input.transparency ?? 0,
    visible: input.visible ?? true,
    frozen: input.frozen ?? false,
    locked: input.locked ?? false,
    plottable: input.plottable ?? true,
    description: input.description,
    source: input.source ?? 'user-created',
    createdAt: input.createdAt,
    category: input.category ?? 'general',
    tags: input.tags ?? [],
    bimCategory: input.bimCategory ?? null,
    vpOverrides: input.vpOverrides ?? null,
  };
}

export interface SceneBounds {
  min: Point2D;
  max: Point2D;
}

/**
 * Stable layer identifier — `lyr_<UUID-v4>`.
 * ADR-358 Phase 9E: SceneModel.layersById is keyed by this type.
 */
export type LayerId = string;

/**
 * ADR-362 Round 5 — DIMSTYLE table imported from the DXF source. Keys are
 * DIMSTYLE names (`'Standard'`, etc.) — same as what the entity code 3
 * reference inside a DIMENSION points at.
 *
 * Re-exports `DimStyleEntry` from the parser-types SSoT to avoid duplicating
 * the 40+ field schema. Consumers (`dim-style-importer`) translate this raw
 * shape into the runtime `DimStyle` registry entries.
 */
export type ImportedSceneDimStyle = DimStyleEntry;
export type SceneDimStyleMap = Record<string, ImportedSceneDimStyle>;

export interface SceneModel {
  entities: Entity[];
  /** ADR-358 Phase 9E-6e: id-keyed layer map. */
  layersById: Record<LayerId, SceneLayer>;
  bounds: SceneBounds;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  /**
   * ADR-362 Round 5 — DIMSTYLE table carried from the source DXF. Populated by
   * `dxf-scene-builder.buildScene()` when the file's TABLES section contains
   * DIMSTYLE entries. Consumed by `dim-style-importer` to seed the runtime
   * `DimStyleRegistry` so newly-created Ribbon dims pick up the file's styles
   * instead of falling back to the ISO_129 built-in (wrong sizes when the
   * source authored its dims at a non-default DIMTXT).
   *
   * Optional: legacy/empty DXFs simply omit it, leaving the registry's
   * built-in defaults active.
   */
  dimStyles?: SceneDimStyleMap;
  version?: string;
}

export interface DxfImportResult {
  success: boolean;
  scene?: SceneModel;
  error?: string;
  warnings?: string[];
  stats: {
    entityCount: number;
    layerCount: number;
    parseTimeMs: number;
  };
}
