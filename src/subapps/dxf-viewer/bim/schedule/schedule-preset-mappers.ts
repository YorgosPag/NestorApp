/**
 * BIM Schedule Export — Preset Mappers (ADR-363 §6 Phase 8).
 *
 * The entity→cells mapping layer behind the preset registry. One `mapXxx`
 * per `ScheduleEntityType`; `schedule-presets.ts` pairs each with its column
 * schema in `PRESET_REGISTRY`. Split out of `schedule-presets.ts` to keep both
 * files under the 500-line SRP ceiling (N.7.1) — this file owns the mapping
 * logic, the registry file owns wiring + routing.
 *
 * SSoT:
 *   - Every per-type mapper opens with the shared identity header
 *     (`mapIdentityCells` / `mapBuildingHeaderCells`) — no per-mapper header
 *     clone (N.18 / jscpd, ADR-583).
 *   - Door + window share ONE preamble via `makeOpeningMapper`; each appends
 *     only its unique cells.
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
  OpeningParams,
  OpeningSwing,
} from '../types/opening-types';
import type { SlabEntity } from '../types/slab-types';
import type { SlabOpeningEntity } from '../types/slab-opening-types';
import type { StairEntity } from '../types/stair-types';
import type { WallEntity } from '../types/wall-types';
import type { FoundationEntity } from '../types/foundation-types';
import {
  resolveAtoeMapping,
  resolveStairComponentMapping,
  resolveFoundationMapping,
  deriveAtoeQuantity,
  type BimEntityType,
  type AtoeMappingEntry,
} from '../config/bim-to-atoe-mapping';
import { computeStairBoqQuantities } from '../stairs/stair-boq-quantities';
import { concreteWeightKg, DEFAULT_CONCRETE_GRADE } from '../structural/concrete-grades';
import {
  computeColumnReinforcementQuantities,
  formatLongitudinalLabel,
  formatStirrupsLabel,
} from '../structural/reinforcement/column-reinforcement-compute';
// ADR-463 — βάρος χάλυβα θεμελίωσης στο BOQ (mirror της κολώνας).
import { computeFootingReinforcementQuantities } from '../structural/reinforcement/footing-reinforcement-compute';
import { buildFootingSectionContext } from '../structural/section-context';
import { resolveOpeningMaterial } from '../family-types/resolve-opening-material';
import type { ResolvedOpeningMaterials } from '../family-types/resolve-opening-material';
import type {
  ScheduleColumnDef,
  ScheduleLookups,
  ScheduleRow,
} from './types';
import {
  safeNumber,
  safeText,
  shortId,
  mapIdentityCells,
  mapBuildingHeaderCells,
} from './schedule-cell-helpers';

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
  | StairEntity
  | FoundationEntity;

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

// ─── Opening common cells (shared door + window preamble) ────────────────────

/**
 * Cells identical across door + window presets — the shared preamble PLUS the
 * two per-part material surfaces both openings expose (frame κάσα + hardware
 * χειρολαβή) and the host wall. Extracted so the two mappers below don't carry
 * a byte-identical sibling clone (N.18 / jscpd). `mats` is passed in (resolved
 * once by the caller) so the fold runs a single time per opening.
 */
function mapOpeningCommonCells(
  entity: OpeningEntity,
  lookups: ScheduleLookups,
  mats: ResolvedOpeningMaterials,
): ScheduleRow['cells'] {
  const p = entity.params;
  return {
    mark: safeText(p.mark),
    id: shortId(entity.id),
    floor: lookups.floor(entity.floorId),
    kind: lookups.translateKind ? lookups.translateKind(p.kind) : p.kind,
    width: safeNumber(p.width),
    height: safeNumber(p.height),
    sill: safeNumber(p.sillHeight),
    frameMaterial: lookups.material(mats.frame),
    hardwareMaterial: lookups.material(mats.hardware),
    wall: shortId(p.wallId),
  };
}

// ─── Door + window presets (ADR-363 §6 Phase 8 Q3 + Q4) ──────────────────────

/** Per-preset extra cells appended after the shared opening common cells. */
type OpeningExtraCells = (
  p: OpeningParams,
  mats: ResolvedOpeningMaterials,
  lookups: ScheduleLookups,
) => ScheduleRow['cells'];

/**
 * Both opening presets share an identical preamble — opening guard, single
 * `resolveOpeningMaterial` fold, then the common cells — differing ONLY in the
 * handful of cells each appends (door: handing + leaf; window: glazing +
 * glass). Factored through one builder so that preamble lives in a single
 * place instead of a byte-identical sibling clone (N.18 / jscpd, ADR-583).
 */
function makeOpeningMapper(extra: OpeningExtraCells): SchedulePreset['map'] {
  return (entity, lookups) => {
    if (entity.type !== 'opening') return {};
    const mats = resolveOpeningMaterial(entity.params);
    return { ...mapOpeningCommonCells(entity, lookups, mats), ...extra(entity.params, mats, lookups) };
  };
}

export const mapDoor = makeOpeningMapper((p, mats, lookups) => ({
  handingText: handingToGreek(p.handing, p.openDirection),
  handingCode: handingToDIN(p.handing, p.openDirection),
  leafMaterial: lookups.material(mats.leaf),
}));

export const mapWindow = makeOpeningMapper((p, mats, lookups) => ({
  glazing: safeNumber(p.glazingPanes),
  glassMaterial: lookups.material(mats.glass),
}));

// ─── Wall preset ─────────────────────────────────────────────────────────────

export function mapWall(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'wall') return {};
  const p = entity.params;
  const g = entity.geometry;
  return {
    ...mapBuildingHeaderCells(entity, lookups),
    category: p.category,
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

export function mapSlab(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'slab') return {};
  const p = entity.params;
  const g = entity.geometry;
  const finishThickness = lookups.floorFinish(entity.floorId) ?? DEFAULT_FINISH_THICKNESS_MM;
  const tosElevation = typeof p.levelElevation === 'number'
    ? p.levelElevation - finishThickness
    : null;
  return {
    ...mapBuildingHeaderCells(entity, lookups),
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

export function mapColumn(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'column') return {};
  const p = entity.params;
  const g = entity.geometry;
  // ADR-456 — Στατικά: βάρος σκυροδέματος (όγκος × ρ) + παράγωγος οπλισμός.
  const reinforcement = p.reinforcement
    ? computeColumnReinforcementQuantities(
        { widthMm: p.width, depthMm: p.depth, heightMm: p.height, grossAreaMm2: g.area * 1e6 },
        p.reinforcement,
      )
    : null;
  return {
    ...mapBuildingHeaderCells(entity, lookups),
    width: safeNumber(p.width),
    depth: safeNumber(p.depth),
    height: safeNumber(p.height),
    rotation: safeNumber(p.rotation),
    area: safeNumber(g.area),
    volume: safeNumber(g.volume),
    concreteGrade: p.concreteGrade ?? DEFAULT_CONCRETE_GRADE,
    concreteWeight: safeNumber(concreteWeightKg(g.volume)),
    longitudinalRebar: p.reinforcement ? formatLongitudinalLabel(p.reinforcement) : null,
    stirrups: p.reinforcement ? formatStirrupsLabel(p.reinforcement) : null,
    steelWeight: reinforcement ? safeNumber(reinforcement.totalSteelWeightKg) : null,
    material: lookups.material(p.material),
  };
}

// ─── Beam preset ─────────────────────────────────────────────────────────────

export function mapBeam(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'beam') return {};
  const p = entity.params;
  const g = entity.geometry;
  return {
    ...mapBuildingHeaderCells(entity, lookups),
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

export function mapStair(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'stair') return {};
  const p = entity.params;
  return {
    ...mapIdentityCells(entity, lookups),
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

export function mapSlabOpening(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'slab-opening') return {};
  const p = entity.params;
  const g = entity.geometry;
  return {
    ...mapIdentityCells(entity, lookups),
    area: safeNumber(g.area),
    perimeter: safeNumber(g.perimeter),
    fireRating: safeNumber(p.fireRating),
    elevation: safeNumber(p.elevationOverride),
    material: lookups.material(p.material),
    slabId: safeText(p.slabId),
  };
}

// ─── Foundation preset (ADR-441 — pad / strip / tie-beam) ────────────────────

/**
 * Foundation row. Pad έχει width+length· strip/tie-beam μόνο width. `area`/`volume`
 * = NET (de-duplicated) όταν τα entities έχουν περάσει από `applyFoundationGridNet`
 * (grid strips), αλλιώς gross — βλ. `hooks/data/foundation-boq-feed.ts` (ADR-441 Slice 4).
 */
export function mapFoundation(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  if (entity.type !== 'foundation') return {};
  const p = entity.params;
  const g = entity.geometry;
  // ADR-463 — παράγωγο βάρος χάλυβα οπλισμού (ίδιο compute SSoT με panel/detail-sheet).
  const reinforcement = p.reinforcement
    ? computeFootingReinforcementQuantities(buildFootingSectionContext(entity), p.reinforcement)
    : null;
  return {
    ...mapBuildingHeaderCells(entity, lookups),
    width: safeNumber(p.width),
    length: safeNumber('length' in p ? p.length : null),
    thickness: safeNumber(p.thicknessMm),
    elevation: safeNumber(p.topElevationMm),
    area: safeNumber(g.area),
    volume: safeNumber(g.volume),
    steelWeight: reinforcement ? safeNumber(reinforcement.totalSteelWeightKg) : null,
    material: lookups.material(p.material),
  };
}

// ─── Combined preset (cross-type geometry-derived roll-up) ───────────────────

/** Entity types covered by the kind-dispatched ΑΤΟΕ table (stair + foundation handled separately). */
const COMBINED_ATOE_TYPES: ReadonlySet<string> = new Set(['wall', 'opening', 'slab', 'column', 'beam', 'railing']);

interface CombinedPrimaryQuantity {
  readonly quantity: number;
  readonly unit: string | null;
  readonly atoeCategory: string | null;
}

/**
 * Fold an ΑΤΟΕ mapping + the entity's computed geometry into the combined
 * preset's primary quantity. Shared by the foundation branch (own resolver)
 * and the generic entity-type branch so the "no mapping → zero, else derive"
 * tail isn't duplicated (N.18 / jscpd).
 */
function atoeQuantityFromMapping(
  mapping: AtoeMappingEntry | null,
  entity: AnyBimEntity,
): CombinedPrimaryQuantity {
  if (!mapping) return { quantity: 0, unit: null, atoeCategory: null };
  const geometry = entity.geometry as { area?: number; volume?: number; lengthM?: number } | undefined;
  return { quantity: deriveAtoeQuantity(mapping.unit, geometry), unit: mapping.unit, atoeCategory: mapping.categoryCode };
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
  // ADR-441 — foundation: ΑΤΟΕ εκτός του BimEntityType table (δικό της resolver).
  // Όγκος (m³) = NET geometry (μέσω applyFoundationGridNet για grid strips).
  if (entity.type === 'foundation') {
    return atoeQuantityFromMapping(resolveFoundationMapping(entity.kind), entity);
  }
  if (!COMBINED_ATOE_TYPES.has(entity.type)) {
    return { quantity: 0, unit: null, atoeCategory: null };
  }
  const hasParams =
    'params' in entity && entity.params !== null && typeof entity.params === 'object';
  const category =
    hasParams && 'category' in entity.params
      ? (entity.params as { category?: string }).category
      : undefined;
  // ADR-363 Φ2 — beam steel discriminator.
  const sectionKind =
    hasParams && 'sectionKind' in entity.params
      ? (entity.params as { sectionKind?: string }).sectionKind
      : undefined;
  const mapping = resolveAtoeMapping(entity.type as BimEntityType, entity.kind, category, sectionKind);
  return atoeQuantityFromMapping(mapping, entity);
}

/**
 * Material summary for an opening row in the heterogeneous `combined` table.
 * The combined roll-up keeps ONE material column (walls/columns/slabs have no
 * leaf/glass/hardware), so per-part openings are summarised: the distinct
 * labels of the two solid surfaces — κάσα (frame) + φύλλο (leaf) — joined by
 * " / ". This surfaces the per-part story ("Ξύλο / Αλουμίνιο") without the
 * default glass/metal noise that would appear on every row, and — critically —
 * reads through `resolveOpeningMaterial` so a per-part opening (whose legacy
 * single `material` field is empty) no longer shows a blank cell. Detailed
 * per-part breakdown lives in the dedicated door/window schedules.
 */
function openingCombinedMaterial(params: OpeningParams, lookups: ScheduleLookups): string {
  const mats = resolveOpeningMaterial(params);
  const distinct = Array.from(
    new Set([lookups.material(mats.frame), lookups.material(mats.leaf)]),
  ).filter(Boolean);
  return distinct.join(' / ');
}

/** Legacy single-material label for a non-opening combined row. */
function legacyCombinedMaterial(entity: AnyBimEntity, lookups: ScheduleLookups): string {
  const material =
    'params' in entity && entity.params !== null && typeof entity.params === 'object' && 'material' in entity.params
      ? (entity.params as { material?: string }).material
      : undefined;
  return lookups.material(material);
}

export function mapCombined(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  const primary = combinedPrimary(entity);
  const material = entity.type === 'opening'
    ? openingCombinedMaterial(entity.params, lookups)
    : legacyCombinedMaterial(entity, lookups);
  return {
    ...mapBuildingHeaderCells(entity, lookups),
    type: lookups.translateType ? lookups.translateType(entity.type) : entity.type,
    primaryQuantity: safeNumber(primary.quantity),
    primaryUnit: primary.unit,
    atoeCategory: primary.atoeCategory,
    material,
  };
}
