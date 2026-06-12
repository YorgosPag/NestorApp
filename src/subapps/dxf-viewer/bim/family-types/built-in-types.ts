/**
 * BIM Family Types — Built-in (factory) catalog + clone-to-edit helper (ADR-412).
 *
 * ─── ARCHITECTURE (locked, ADR-412 Q3) ──────────────────────────────────────
 * Built-in / "factory" family types are **CODE constants**, NOT persisted to
 * Firestore. Rationale:
 *   - no drift: the code is the single source of truth for built-ins,
 *   - always available: every company sees the same factory catalog with zero
 *     seeding step,
 *   - full SSoT: the wall built-ins derive directly from the wall-DNA SSoT
 *     (`getDefaultDnaForCategory`), so a built-in can never disagree with the
 *     default cross-section it is named after.
 *
 * The client store MERGES these built-ins (per `companyId`) alongside the
 * user/company/project types fetched from Firestore (`BimFamilyTypeService`).
 *
 * "Clone-to-edit" (`cloneTypeToInput`) turns a (read-only) built-in OR any other
 * type into the `SaveTypeInput` the service expects, flipping `origin` to
 * `'user'` and DEEP-COPYING the `typeParams` so the new persisted type is fully
 * independent of the source. The actual `saveType` call is the Phase 4 UI.
 *
 * ─── DETERMINISM (ADR-412) ───────────────────────────────────────────────────
 * Every exported builder is pure + idempotent: the same `companyId` yields
 * byte-identical ids and content on every call. Synthetic ids are fixed strings
 * derived from the category + a stable key. NO time-based or randomised value is
 * read anywhere (no wall-clock time, no random-UUID generation, no enterprise-id
 * generator — those are reserved for the persisted user clones).
 *
 * NAME = STABLE TECHNICAL KEY, never a UI label. The Phase 4 UI maps the key
 * (e.g. `'builtin.wall.exterior'`) to an i18n string; no user-facing strings
 * live here (SOS N.11).
 *
 * @see bim/types/bim-family-type.ts            — BimFamilyType<C> contract
 * @see bim/types/wall-dna-types.ts             — getDefaultDnaForCategory (SSoT)
 * @see bim/family-types/bim-family-type-service.ts §SaveTypeInput
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import { WALL_TYPE_SEEDS, type WallTypeSeed } from '../types/wall-dna-types';
import { getDefaultSlabBuildupForKind } from '../types/slab-dna-types';
import { getRoofBuildupForKey, ROOF_BUILDUP_KEYS, type RoofBuildupKey } from '../types/roof-buildup';
import {
  OPENING_KIND_DEFAULTS,
  DEFAULT_FRAME_WIDTH_MM,
  isGlazedKind,
  type OpeningKind,
} from '../types/opening-types';
import type { SlabKind } from '../types/slab-types';
import type {
  BimFamilyType,
  BimFamilyTypeScope,
  BimTypeParamsByCategory,
  OpeningTypeParams,
  RoofTypeParams,
  SlabTypeParams,
  StairTypeParams,
  WallTypeParams,
} from '../types/bim-family-type';
import type { SaveTypeInput } from './bim-family-type-service';

// ─── Synthetic id prefixes ────────────────────────────────────────────────────

/** Fixed prefix for every built-in family-type id (deterministic, never random). */
const BUILTIN_ID_PREFIX = 'bimftype-builtin';

/**
 * The deterministic synthetic id of a built-in wall family type for a seed `key`
 * (ADR-447). SSoT for the id derivation — the catalog builder ({@link buildWallType})
 * AND the auto-assign policy (`wall-type-auto-assign.ts`) both go through here so
 * the string is declared exactly once (N.0.2). For a category's PRIMARY seed the
 * key equals the category (`'exterior'`), so the id is byte-identical to the
 * pre-ADR-447 single-per-category id → existing persisted walls keep resolving.
 * Variant seeds use suffixed keys (`'exterior-eps'`, `'exterior-20'`).
 */
export function getBuiltInWallTypeId(key: string): string {
  return `${BUILTIN_ID_PREFIX}-wall-${key}`;
}

// ─── Built-in stair seed constants (mm) ──────────────────────────────────────
//
// Mirror the residential defaults baked into `buildDefaultStairParams`
// (`hooks/drawing/stair-completion.ts`). Those constants are module-private and
// scene-unit-scaled at build time; built-in TYPE params are pure mm (no scene
// scaling — types carry storage-canonical mm, scaling happens at placement).

const STAIR_RISE_MM = 175;
const STAIR_TREAD_MM = 280;
const STAIR_NOSING_MM = 20;
const STAIR_RESIDENTIAL_WIDTH_MM = 1200;
const STAIR_RESIDENTIAL_STEP_COUNT = 12;
const STAIR_WALKLINE_OFFSET_MM = 600;
const STAIR_HANDRAIL_HEIGHT_MM = 900;
const STAIR_TREAD_LABEL_HEIGHT_MM = 80;
const STAIR_NARROW_WIDTH_MM = 900;

const RAD_TO_DEG = 180 / Math.PI;

// ─── Wall built-ins ───────────────────────────────────────────────────────────

function buildWallType(
  seed: WallTypeSeed,
  companyId: string,
): BimFamilyType<'wall'> {
  const typeParams: WallTypeParams = {
    category: seed.category,
    thickness: seed.dna.totalThickness,
    dna: seed.dna,
  };
  return {
    id: getBuiltInWallTypeId(seed.key),
    category: 'wall',
    name: `builtin.wall.${seed.key}`,
    scope: 'company',
    origin: 'built-in',
    typeParams,
    companyId,
    ownerId: 'system',
  };
}

/**
 * The factory wall family types — ADR-447 Revit «Basic Wall» catalog: multiple
 * types per category (exterior 25cm / 25cm+θερμοπρόσοψη / 20cm + interior/partition/
 * parapet/fence). Each derives its `thickness` + `dna` from the `WALL_TYPE_SEEDS`
 * SSoT, so a built-in can never drift from the cross-section it is named after.
 */
export function getBuiltInWallTypes(
  companyId: string,
): readonly BimFamilyType<'wall'>[] {
  return WALL_TYPE_SEEDS.map((seed) => buildWallType(seed, companyId));
}

// ─── Slab built-ins ───────────────────────────────────────────────────────────

/**
 * All slab kinds in a fixed order — drives the one-built-in-per-kind catalog
 * deterministically (slab analogue of {@link WALL_CATEGORIES}).
 */
const SLAB_KINDS: readonly SlabKind[] = [
  'floor',
  'ceiling',
  'roof',
  'ground',
  'foundation',
] as const;

/**
 * The deterministic synthetic id of the built-in slab family type for a kind.
 * SSoT for the id derivation — the catalog builder ({@link buildSlabType}) AND
 * the auto-assign policy (`slab-type-auto-assign.ts`) both go through here so
 * the string is declared exactly once (N.0.2).
 */
export function getBuiltInSlabTypeId(kind: SlabKind): string {
  return `${BUILTIN_ID_PREFIX}-slab-${kind}`;
}

function buildSlabType(
  kind: SlabKind,
  companyId: string,
): BimFamilyType<'slab'> {
  const dna = getDefaultSlabBuildupForKind(kind);
  const typeParams: SlabTypeParams = {
    kind,
    thickness: dna.totalThickness,
    dna,
  };
  return {
    id: getBuiltInSlabTypeId(kind),
    category: 'slab',
    name: `builtin.slab.${kind}`,
    scope: 'company',
    origin: 'built-in',
    typeParams,
    companyId,
    ownerId: 'system',
  };
}

/**
 * The factory slab family types — exactly one per {@link SlabKind} (5). Each
 * derives its `thickness` + `dna` from the slab-DNA SSoT
 * (`getDefaultSlabBuildupForKind`), so the built-in can never drift from the
 * default build-up it is named after.
 */
export function getBuiltInSlabTypes(
  companyId: string,
): readonly BimFamilyType<'slab'>[] {
  return SLAB_KINDS.map((kind) => buildSlabType(kind, companyId));
}

// ─── Roof built-ins (ADR-417 Q8) ─────────────────────────────────────────────

/**
 * The deterministic synthetic id of the built-in roof family type for a build-up
 * key. SSoT for the id derivation — the catalog builder ({@link buildRoofType})
 * AND the auto-assign policy (`roof-type-auto-assign.ts`) both go through here so
 * the string is declared exactly once (N.0.2).
 */
export function getBuiltInRoofTypeId(key: RoofBuildupKey): string {
  return `${BUILTIN_ID_PREFIX}-roof-${key}`;
}

function buildRoofType(
  key: RoofBuildupKey,
  companyId: string,
): BimFamilyType<'roof'> {
  const dna = getRoofBuildupForKey(key);
  const typeParams: RoofTypeParams = {
    thickness: dna.totalThickness,
    dna,
  };
  return {
    id: getBuiltInRoofTypeId(key),
    category: 'roof',
    name: `builtin.roof.${key}`,
    scope: 'company',
    origin: 'built-in',
    typeParams,
    companyId,
    ownerId: 'system',
  };
}

/**
 * The factory roof family types — «Μπετονένιο δώμα» (concrete) + «Κεραμοσκεπή»
 * (tiled). Each derives its `thickness` + `dna` from the roof-build-up SSoT
 * (`getRoofBuildupForKey`), so the built-in can never drift.
 */
export function getBuiltInRoofTypes(
  companyId: string,
): readonly BimFamilyType<'roof'>[] {
  return ROOF_BUILDUP_KEYS.map((key) => buildRoofType(key, companyId));
}

// ─── Opening built-ins (ADR-421 SLICE C) ─────────────────────────────────────

/**
 * All opening kinds in a fixed order — drives the one-built-in-per-kind catalog
 * deterministically (opening analogue of {@link WALL_CATEGORIES}/{@link SLAB_KINDS}).
 * Sourced from `OPENING_KIND_DEFAULTS` keys so it can never drift from the kind
 * catalog (ADR-421 SLICE B). Doors first, then windows.
 */
const OPENING_KINDS: readonly OpeningKind[] = [
  'door',
  'double-door',
  'sliding-door',
  'double-sliding-door',
  'pocket-door',
  'bifold-door',
  'overhead-door',
  'revolving-door',
  'french-door',
  'window',
  'fixed',
  'double-hung-window',
  'sliding-window',
  'awning-window',
  'hopper-window',
  'tilt-turn-window',
  'bay-window',
] as const;

/**
 * The deterministic synthetic id of the built-in opening family type for a kind.
 * SSoT for the id derivation — the catalog builder ({@link buildOpeningType}) AND
 * the auto-type policy (`auto-opening-type.ts`, used at opening creation + load)
 * both go through here so the string is declared exactly once (N.0.2).
 */
export function getBuiltInOpeningTypeId(kind: OpeningKind): string {
  return `${BUILTIN_ID_PREFIX}-opening-${kind}`;
}

function buildOpeningType(
  kind: OpeningKind,
  companyId: string,
): BimFamilyType<'opening'> {
  const defaults = OPENING_KIND_DEFAULTS[kind];
  const typeParams: OpeningTypeParams = {
    kind,
    width: defaults.width,
    height: defaults.height,
    frameWidth: DEFAULT_FRAME_WIDTH_MM,
    // Glazed kinds (windows + french-door) default to double glazing.
    ...(isGlazedKind(kind) && { glazingPanes: 2 as const }),
  };
  return {
    id: getBuiltInOpeningTypeId(kind),
    category: 'opening',
    name: `builtin.opening.${kind}`,
    scope: 'company',
    origin: 'built-in',
    typeParams,
    companyId,
    ownerId: 'system',
  };
}

/**
 * The factory opening family types — exactly one per {@link OpeningKind} (17).
 * Each derives its nominal `width`/`height` from the `OPENING_KIND_DEFAULTS`
 * SSoT, so the built-in can never drift from the kind default it is named after.
 * Auto-type linkage (`auto-opening-type.ts`) attaches a freshly-drawn opening to
 * the matching built-in when its dimensions equal the kind default (Revit
 * «Generic» pattern); custom dimensions stay ad-hoc (legacy fast-path).
 */
export function getBuiltInOpeningTypes(
  companyId: string,
): readonly BimFamilyType<'opening'>[] {
  return OPENING_KINDS.map((kind) => buildOpeningType(kind, companyId));
}

// ─── Stair built-ins ──────────────────────────────────────────────────────────

interface StairBuiltInSeed {
  /** Stable key suffix for the id + name (e.g. `'residential'`). */
  readonly key: string;
  readonly width: number;
  readonly stepCount: number;
}

const STAIR_SEEDS: readonly StairBuiltInSeed[] = [
  { key: 'residential', width: STAIR_RESIDENTIAL_WIDTH_MM, stepCount: STAIR_RESIDENTIAL_STEP_COUNT },
  { key: 'narrow', width: STAIR_NARROW_WIDTH_MM, stepCount: STAIR_RESIDENTIAL_STEP_COUNT },
] as const;

function buildStairTypeParams(seed: StairBuiltInSeed): StairTypeParams {
  const rise = STAIR_RISE_MM;
  const tread = STAIR_TREAD_MM;
  return {
    rise,
    tread,
    nosing: STAIR_NOSING_MM,
    nosingSide: 'front',
    width: seed.width,
    stepCount: seed.stepCount,
    totalRise: rise * seed.stepCount,
    totalRun: tread * (seed.stepCount - 1),
    pitch: Math.atan2(rise, tread) * RAD_TO_DEG,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant: { kind: 'straight' },
    walklineOffset: STAIR_WALKLINE_OFFSET_MM,
    handrails: {
      inner: true,
      outer: true,
      height: STAIR_HANDRAIL_HEIGHT_MM,
    },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'all',
    treadLabelRestartPerFlight: false,
    treadLabelHeight: STAIR_TREAD_LABEL_HEIGHT_MM,
    codeProfile: 'nok',
    nokSubType: 'main',
  };
}

function buildStairType(
  seed: StairBuiltInSeed,
  companyId: string,
): BimFamilyType<'stair'> {
  return {
    id: `${BUILTIN_ID_PREFIX}-stair-${seed.key}`,
    category: 'stair',
    name: `builtin.stair.${seed.key}`,
    scope: 'company',
    origin: 'built-in',
    typeParams: buildStairTypeParams(seed),
    companyId,
    ownerId: 'system',
  };
}

/**
 * The factory stair family types: a standard Greek residential straight run and
 * a narrow variant. Seeded from the residential defaults of
 * `buildDefaultStairParams` (rise 175 / tread 280, ΝΟΚ profile).
 */
export function getBuiltInStairTypes(
  companyId: string,
): readonly BimFamilyType<'stair'>[] {
  return STAIR_SEEDS.map((seed) => buildStairType(seed, companyId));
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

/**
 * Every built-in family type (wall + stair), in a deterministic order. This is
 * what the client store merges alongside the Firestore-fetched user/company/
 * project types.
 */
export function getAllBuiltInTypes(
  companyId: string,
): readonly BimFamilyType[] {
  return [
    ...getBuiltInWallTypes(companyId),
    ...getBuiltInSlabTypes(companyId),
    ...getBuiltInRoofTypes(companyId),
    ...getBuiltInOpeningTypes(companyId),
    ...getBuiltInStairTypes(companyId),
  ];
}

// ─── Clone-to-edit ─────────────────────────────────────────────────────────────

/**
 * Deep-clones a `typeParams` payload so the produced `SaveTypeInput` is fully
 * independent of the source type (mutating the input must not touch the source —
 * including nested `dna` layers / stair `variant` / `handrails`).
 *
 * `typeParams` are storage-canonical POJOs (numbers / strings / booleans +
 * nested arrays + plain objects, exactly what round-trips through Firestore), so
 * a `JSON` round-trip is a safe, environment-portable deep copy (no reliance on
 * the `structuredClone` global, which is absent in some test runtimes).
 */
function deepCloneTypeParams<C extends keyof BimTypeParamsByCategory>(
  params: BimTypeParamsByCategory[C],
): BimTypeParamsByCategory[C] {
  return JSON.parse(JSON.stringify(params)) as BimTypeParamsByCategory[C];
}

/**
 * Produces the {@link SaveTypeInput} that `BimFamilyTypeService.saveType`
 * expects from a `source` family type (typically a read-only built-in, but any
 * type works). The result:
 *   - flips `origin` to `'user'` (the clone is always a user creation),
 *   - DEEP-COPIES `typeParams` so the new type is independent of the source,
 *   - carries the caller-supplied `name` and `scope` (default `'company'`).
 *
 * Pure: does NOT touch Firestore. The actual persist is the Phase 4 UI calling
 * `service.saveType(cloneTypeToInput(...))`.
 */
export function cloneTypeToInput<C extends keyof BimTypeParamsByCategory>(
  source: BimFamilyType<C>,
  name: string,
  scope: BimFamilyTypeScope = 'company',
): SaveTypeInput<C> {
  return {
    name,
    category: source.category,
    scope,
    origin: 'user',
    typeParams: deepCloneTypeParams<C>(source.typeParams),
  };
}
