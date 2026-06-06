/**
 * ADR-419 — Floor Finish Material Catalog SSoT.
 *
 * 8 built-in floor finish materials (ξύλο / πλακάκι / laminate / μάρμαρο /
 * τάπητας / εποξειδικό). Καθένα έχει θερμικές ιδιότητες (λ/ρ/cp), χρώμα
 * 2D plan, hatch type, και PBR slug για 3D rendering (ADR-413 registry).
 *
 * Pattern: `wall-material-catalog.ts` (ADR-363 Phase 1D).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md §3
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import type { FloorFinishHatchType, FloorFinishMaterialId } from '../types/floor-finish-types';
import type { PbrTextureSlug } from '../materials/bim-texture-registry';

// ─── Catalog entry ────────────────────────────────────────────────────────────

export interface FloorFinishMaterialDef {
  readonly id: FloorFinishMaterialId;
  /** W/(m·K) — thermal conductivity (ISO 10456). */
  readonly lambda: number;
  /** kg/m³ — bulk density. */
  readonly density: number;
  /** J/(kg·K) — specific heat capacity. */
  readonly specificHeat: number;
  /** CSS hex color for 2D plan fill. */
  readonly color: string;
  /** Hatch pattern family for 2D renderer. */
  readonly hatch: FloorFinishHatchType;
  /** ADR-413 PBR slug — undefined = solid color fallback. */
  readonly pbrSlug?: PbrTextureSlug;
  /** i18n key suffix under `floorFinish.materials.<suffix>`. */
  readonly labelKeySuffix: string;
}

// ─── Catalog data ─────────────────────────────────────────────────────────────

const CATALOG: readonly FloorFinishMaterialDef[] = [
  {
    id: 'floor-wood-oak',
    lambda: 0.18,
    density: 700,
    specificHeat: 1700,
    color: '#C8A97E',
    hatch: 'wood',
    pbrSlug: 'wood',
    labelKeySuffix: 'woodOak',
  },
  {
    id: 'floor-wood-pine',
    lambda: 0.15,
    density: 550,
    specificHeat: 1600,
    color: '#D4B896',
    hatch: 'wood',
    pbrSlug: 'wood',
    labelKeySuffix: 'woodPine',
  },
  {
    id: 'floor-tile-ceramic',
    lambda: 1.00,
    density: 2000,
    specificHeat: 840,
    color: '#E8E0D0',
    hatch: 'tile',
    pbrSlug: 'tile',
    labelKeySuffix: 'tileCeramic',
  },
  {
    id: 'floor-tile-marble',
    lambda: 2.80,
    density: 2700,
    specificHeat: 880,
    color: '#F5F2EE',
    hatch: 'tile',
    pbrSlug: 'stone',
    labelKeySuffix: 'tileMarble',
  },
  {
    id: 'floor-laminate',
    lambda: 0.17,
    density: 900,
    specificHeat: 1500,
    color: '#B8956A',
    hatch: 'wood',
    pbrSlug: 'wood',
    labelKeySuffix: 'laminate',
  },
  {
    id: 'floor-parquet',
    lambda: 0.18,
    density: 700,
    specificHeat: 1700,
    color: '#8B6340',
    hatch: 'wood',
    pbrSlug: 'wood',
    labelKeySuffix: 'parquet',
  },
  {
    id: 'floor-epoxy',
    lambda: 0.23,
    density: 1200,
    specificHeat: 1000,
    color: '#9EB8C8',
    hatch: 'solid',
    labelKeySuffix: 'epoxy',
  },
  {
    id: 'floor-carpet',
    lambda: 0.06,
    density: 200,
    specificHeat: 1300,
    color: '#8B7355',
    hatch: 'dot',
    labelKeySuffix: 'carpet',
  },
];

// ─── Lookup map ───────────────────────────────────────────────────────────────

const CATALOG_MAP: ReadonlyMap<FloorFinishMaterialId, FloorFinishMaterialDef> = new Map(
  CATALOG.map((def) => [def.id, def]),
);

// ─── Public accessors ─────────────────────────────────────────────────────────

/** All built-in floor finish material definitions. */
export function listFloorFinishMaterials(): readonly FloorFinishMaterialDef[] {
  return CATALOG;
}

/** Full definition for a material ID, or `undefined` for unknown IDs. */
export function getFloorFinishMaterial(
  id: string | undefined,
): FloorFinishMaterialDef | undefined {
  if (!id) return undefined;
  return CATALOG_MAP.get(id as FloorFinishMaterialId);
}

/** W/(m·K) — used by IFC serializer + R-value display. */
export function getFloorFinishLambda(id: string | undefined): number | undefined {
  return getFloorFinishMaterial(id)?.lambda;
}

/** 2D plan hatch type — used by FloorFinishRenderer. */
export function getFloorFinishHatchType(
  id: string | undefined,
): FloorFinishHatchType {
  return getFloorFinishMaterial(id)?.hatch ?? 'solid';
}

/** CSS hex color for 2D fill — used by FloorFinishRenderer. */
export function getFloorFinishColor(id: string | undefined): string {
  return getFloorFinishMaterial(id)?.color ?? '#CCCCCC';
}

/** ADR-413 PBR slug for 3D texture — used by floor-finish-to-three.ts. */
export function getFloorFinishPbrSlug(
  id: string | undefined,
): PbrTextureSlug | undefined {
  return getFloorFinishMaterial(id)?.pbrSlug;
}
