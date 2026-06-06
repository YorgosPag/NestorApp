/**
 * BIM Family Types — Contract (SSoT) — ADR-412.
 *
 * A *Family Type* is a named, reusable bundle of **type-level** parameters for a
 * BIM element category (Revit «Type» vs «Instance» distinction). Placing an
 * instance of a type copies the type-level params onto the new entity; editing a
 * type re-flows to its instances (propagation lands in a later phase). This file
 * is the single source of truth for the type-level param subsets and the
 * `BimFamilyType` document shape persisted in Firestore.
 *
 * ─── TYPE vs INSTANCE rationale (ADR-412 Q2) ─────────────────────────────────
 * The split mirrors Revit: a parameter is *type-level* when it is shared by every
 * instance of the type (changing it on the type changes every instance), and
 * *instance-level* when it varies per placement.
 *
 *   - WALL → type-level: `category`, `thickness`, `dna` (layered cross-section),
 *     `material`. Instance-level (NOT here): `start`/`end` (placement geometry),
 *     **`height`** (each wall is tall as its storey/run needs — Q2), `flip`,
 *     bevels/miters, tilt, storey binding, attach FKs.
 *   - STAIR → type-level: everything in `StairParams` EXCEPT the placement params
 *     `basePoint` and `direction` (those are per-instance, set by the active
 *     draw). This is exactly the frozen subset already used by the stair preset
 *     system (`Omit<StairParams,'basePoint'|'direction'>`, see
 *     `stair-presets-service.ts` `SavePresetInput`), so a `StairPresetDoc` and a
 *     stair `BimFamilyType` carry the same payload and stay interchangeable.
 *
 * `height` is deliberately NOT a wall type param: two walls of the same type
 * routinely differ in height, so binding it to the type would force every
 * instance to the same height — wrong (Q2).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 * @see bim/types/wall-types.ts        — full WallParams (instance-level superset)
 * @see bim/types/stair-types.ts       — full StairParams + StairPresetDoc
 * @see bim/stairs/stair-presets-service.ts §SavePresetInput — the existing
 *      `Omit<StairParams,'basePoint'|'direction'>` this StairTypeParams mirrors
 */

import type { Timestamp } from 'firebase/firestore';

import type { WallCategory } from './wall-types';
import type { WallDna } from './wall-dna-types';
import type { SlabKind } from './slab-types';
import type { SlabDna } from './slab-dna-types';
// Type-only import (no runtime cycle) — RoofSoffitMode is defined in roof-types,
// which in turn imports RoofTypeParams from here. TS resolves type-only cycles.
import type { RoofSoffitMode } from './roof-types';
import type { StairTopBinding, StairBaseBinding } from './bim-binding';
import type {
  StairNosingSide,
  StairStructureType,
  StairStringerParams,
  StairRiserType,
  StairMaterials,
  StairPerTreadOverride,
  StairMultiStoryConfig,
  StairVariantParams,
  StairHandrails,
  StairUpDirection,
  StairTreadLabelDisplay,
  StairCodeProfile,
  StairNokSubType,
} from './stair-types';

// ─── Family-type scope & origin ──────────────────────────────────────────────

/**
 * Visibility scope of a family type. Mirrors `StairPresetScope` so the two
 * subsystems share semantics:
 *   - `'user'`    — private to the owner.
 *   - `'company'` — shared across the company (all projects).
 *   - `'project'` — scoped to a single project.
 */
export type BimFamilyTypeScope = 'user' | 'company' | 'project';

/**
 * Provenance of a family type:
 *   - `'built-in'` — seeded/system type (read-only catalog default).
 *   - `'user'`     — created or duplicated by a user.
 *   - `'auto'`     — auto-generated «Generic - {thickness}» type, minted on wall
 *     creation when an arbitrary cross-section has no matching built-in (Revit
 *     «Generic Wall» pattern). Persisted + directly editable (unlike built-ins);
 *     `name` is the i18n key `auto.wall.generic`, interpolated with `thickness`.
 */
export type BimFamilyTypeOrigin = 'built-in' | 'user' | 'auto';

// ─── Type-level param subsets (one per supported category) ───────────────────

/**
 * WALL type-level parameters ONLY (ADR-412 Q2).
 * Excludes all placement/instance params (`start`/`end`/`height`/`flip`/bevels/
 * tilt/storey binding/attach FKs) — those live on the `WallEntity` instance.
 */
export interface WallTypeParams {
  readonly category: WallCategory;
  /** mm. Cross-section depth. Equals `dna.totalThickness` when `dna` present. */
  readonly thickness: number;
  /** Layered composition. Undefined = bare structural wall (no plaster). */
  readonly dna?: WallDna;
  /** Material key for wall-level hatch. Ignored when `dna` is present. */
  readonly material?: string;
}

/**
 * SLAB type-level parameters ONLY (composite Floor/Slab Types, slab analogue of
 * {@link WallTypeParams}). Excludes every placement/instance param (`outline`/
 * `levelElevation`/`heightOffsetFromLevel`/`geometryType`/`slope`/storey
 * linkage) — those live on the `SlabEntity` instance. The build-up (`dna`) lives
 * on the TYPE (Revit «Floor → Edit Type → Structure»); `thickness` equals
 * `dna.totalThickness` when a `dna` is present (SSoT, no double-entry).
 *
 * `kind` is the slab analogue of wall `category` — it selects the per-kind
 * default build-up (floor/ceiling/roof/ground/foundation) and drives the
 * one-built-in-per-kind catalog.
 */
export interface SlabTypeParams {
  readonly kind: SlabKind;
  /** mm. Cross-section depth. Equals `dna.totalThickness` when `dna` present. */
  readonly thickness: number;
  /** Layered composition (top→bottom). Undefined = bare single-material slab. */
  readonly dna?: SlabDna;
  /** Material key for slab-level hatch. Ignored when `dna` is present. */
  readonly material?: string;
}

/**
 * ROOF type-level parameters ONLY (ADR-417 Q8 — Roof Types). Roof analogue of
 * {@link SlabTypeParams}: the layered build-up (`dna`) + derived `thickness`
 * live on the TYPE («Μπετονένιο δώμα» / «Κεραμοσκεπή»); the footprint, per-edge
 * slopes, slope unit and base elevation are per-instance (they live on the
 * `RoofEntity`). A roof has no sub-kind, so there is no `kind`/`category`
 * discriminator here — the two built-ins differ by their `dna` (build-up key).
 */
export interface RoofTypeParams {
  /** mm. Cross-section depth. Equals `dna.totalThickness` when `dna` present. */
  readonly thickness: number;
  /** Layered composition (top→bottom). Undefined = bare single-material roof. */
  readonly dna?: SlabDna;
  /** Material key for roof-level hatch. Ignored when `dna` is present. */
  readonly material?: string;
  // ─── Eave detailing (ADR-417 Φ2b — Revit «Type»-level fascia/soffit) ─────────
  // The horizontal overhang is per-instance (per footprint edge), but the fascia
  // board + soffit lining materials/dimensions are a Roof Type appearance, exactly
  // like the layered build-up. They flow onto the placed `RoofParams` via
  // `resolveEffectiveParams` («type always wins»).
  /** Material key for the fascia board (μετωπίδα). Default `mat-wood`. */
  readonly fasciaMaterial?: string;
  /** Material key for the soffit lining (υποκάτω επένδυση). Default `mat-wood`. */
  readonly soffitMaterial?: string;
  /** mm. Visible height of the vertical fascia board. Default 200. */
  readonly fasciaHeightMm?: number;
  /** Soffit geometry — 'horizontal' (Revit default) | 'sloped'. */
  readonly soffitMode?: RoofSoffitMode;
  // ─── Tile appearance (ADR-417 #5 — Revit Material Appearance W×H + rotation) ──
  // Physical dimensions of ONE roof tile, in METERS. Undefined → square at the
  // material's natural tile size. The 3D UV is ALWAYS slope-aligned (water-flow
  // direction) regardless of these — they only size/rotate the tile pattern.
  /** m. Tile length DOWN the slope. */
  readonly tileLengthM?: number;
  /** m. Tile width ACROSS the slope (along the ridge). */
  readonly tileWidthM?: number;
  /** Rotate the tile texture 90° (swap U↔V). */
  readonly tileRotate90?: boolean;
}

/**
 * STAIR type-level parameters — explicitly the subset of `StairParams` shared
 * across instances, i.e. everything EXCEPT the placement params `basePoint` and
 * `direction`. Kept field-for-field assignable to/from
 * `Omit<StairParams,'basePoint'|'direction'>` (the existing stair-preset payload)
 * so types and presets interoperate. All linear measurements in mm.
 *
 * NOTE: spelled out explicitly (not `Omit<…>`) per ADR-412 for downstream
 * clarity; keep in sync with `StairParams` in `stair-types.ts`.
 */
export interface StairTypeParams {
  readonly rise: number; // mm
  readonly tread: number; // mm (excl. nosing)
  readonly nosing: number; // mm
  readonly nosingSide: StairNosingSide;
  readonly width: number; // mm
  readonly stepCount: number;

  readonly totalRise: number; // mm
  readonly totalRun: number; // mm
  readonly pitch: number; // deg

  readonly multiStoryConfig?: StairMultiStoryConfig;

  readonly structureType: StairStructureType;
  readonly stringerParams?: StairStringerParams;

  /** mm. Equivalent RC waist-slab thickness (ADR-395 G1), BOQ-only. */
  readonly waistThickness?: number;

  readonly riserType: StairRiserType;
  readonly materials?: StairMaterials;
  readonly perTreadOverrides?: Readonly<Record<number, StairPerTreadOverride>>;
  readonly antiskidNosing: boolean;
  readonly adaContrastStrip: boolean;

  /** mm. Cut-plane height override (Q21). */
  readonly cutPlaneHeight?: number;

  readonly variant: StairVariantParams;

  readonly walklineOffset: number; // mm (default 300)
  readonly handrails: StairHandrails;
  readonly upDirection: StairUpDirection;

  readonly treadNumberStart: number; // G21 default 1
  readonly treadLabelDisplay: StairTreadLabelDisplay;
  readonly treadLabelEveryN?: number;
  readonly treadLabelRestartPerFlight: boolean;
  /** mm. Tread label text height (scene-unit scaled). */
  readonly treadLabelHeight?: number;

  /** Occupancy load override (Q27, can inherit). */
  readonly occupancyLoad?: number;

  readonly codeProfile: StairCodeProfile;
  readonly nokSubType?: StairNokSubType;

  // ─── ADR-369 — Storey linkage (type-level defaults) ─────────────────────────
  /** Storey FK (alias for floorId). */
  readonly storeyId?: string;
  /** mm. Elevation offset from storey reference. Default 0. */
  readonly offsetFromStorey?: number;

  // ─── ADR-401 Phase G — Attach-to-structural (top/base) ──────────────────────
  readonly topBinding?: StairTopBinding;
  readonly baseBinding?: StairBaseBinding;
  /** Host FK ids when `topBinding === 'attached'` (≥1, validated). */
  readonly attachTopToIds?: readonly string[];
  /** Host FK ids when `baseBinding === 'attached'` (≥1, validated). */
  readonly attachBaseToIds?: readonly string[];
}

// ─── Category → type-param map ───────────────────────────────────────────────

/**
 * Maps a family-type category to its type-level param payload. Extend this map
 * when a new BIM category gains family-type support (column/beam/etc.).
 */
export interface BimTypeParamsByCategory {
  readonly wall: WallTypeParams;
  readonly slab: SlabTypeParams;
  readonly stair: StairTypeParams;
  readonly roof: RoofTypeParams;
}

// ─── Family type document (persisted, Firestore) ─────────────────────────────

/**
 * A named, reusable type definition for a BIM element category. Persisted with
 * an enterprise ID (`setDoc`). `typeParams` is narrowed to the category's
 * payload via the `C` discriminator. Tenant fields follow the BIM entity
 * convention (`Timestamp | null` for created/updated).
 */
export interface BimFamilyType<
  C extends keyof BimTypeParamsByCategory = keyof BimTypeParamsByCategory,
> {
  readonly id: string;
  readonly category: C;
  readonly name: string;
  readonly scope: BimFamilyTypeScope;
  readonly origin: BimFamilyTypeOrigin;
  readonly typeParams: BimTypeParamsByCategory[C];
  readonly companyId: string;
  readonly ownerId: string;
  readonly projectId?: string;
  readonly createdAt?: Timestamp | null;
  readonly createdBy?: string;
  readonly updatedAt?: Timestamp | null;
  readonly updatedBy?: string;
}
