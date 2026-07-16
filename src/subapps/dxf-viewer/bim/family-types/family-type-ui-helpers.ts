/**
 * BIM Family Types — pure UI helpers (ADR-412 Φ4).
 *
 * Side-effect-free glue between the family-type store / resolution SSoT and the
 * ribbon widgets (Type Selector + Type Properties / override editor). Kept React-
 * free so it is unit-testable and the widgets stay thin (N.7.1).
 *
 * ## Shape (ADR-584)
 *
 * Every category (wall / slab / roof / opening) needs the SAME four helpers, and
 * they differ in exactly three places: the category discriminator, the
 * overridable-key list, and the effective-param resolver. So the bodies live
 * ONCE in {@link makeFamilyTypeHelpers} and each category is a few lines of
 * config plus thin named re-exports — mirroring the sibling
 * `resolve-effective-params.ts` (generic core + named wrappers), which is the
 * established shape in this folder.
 *
 * Adding a 5th category (`stair` already has `StairTypeParams`) = one config
 * block, not another 80-line copy.
 *
 *   - `list{X}Types`               — category-only slice of the loaded catalog.
 *   - `as{X}FamilyType`            — narrows a catalog entry to the category.
 *   - `getOverridden{X}ParamKeys`  — which type-governed params an instance overrides.
 *   - `resolve{X}TypeAssignment`   — builds the next/prev `{X}TypeAssignment` for
 *     `Assign{X}TypeCommand` («type always wins» effective-param resolution).
 *   - `normalise{X}Overrides`      — empty override patch → `undefined`.
 *
 * Category-agnostic by nature (no per-category twin): `isBuiltInType`,
 * `isAutoType`, `resolveTypeDisplayName`.
 *
 * @see ./resolve-effective-params.ts            — effective-param SSoT
 * @see ../../core/commands/entity-commands/AssignWallTypeCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.3 §3.4
 */

import type {
  BimFamilyType,
  BimTypeParamsByCategory,
  OpeningTypeParams,
  RoofTypeParams,
  SlabTypeParams,
  WallTypeParams,
} from '../types/bim-family-type';
import type { WallParams } from '../types/wall-types';
import type { SlabParams } from '../types/slab-types';
import type { RoofParams } from '../types/roof-types';
import type { OpeningParams } from '../types/opening-types';
import {
  resolveEffectiveOpeningParams,
  resolveEffectiveRoofParams,
  resolveEffectiveSlabParams,
  resolveEffectiveWallParams,
} from './resolve-effective-params';
import { AUTO_WALL_TYPE_NAME_KEY } from './auto-wall-type';

/** i18n namespace prefix for every family-type label (mirror the locale block). */
const I18N_PREFIX = 'ribbon.commands.bimFamilyType';

// ─── Overridable-key SSoT (one of the three per-category divergence points) ──

/**
 * Type-governed wall params that the per-instance override editor exposes.
 * `thickness`/`dna` are structural (edited on the TYPE itself in Φ4), so they are
 * deliberately NOT per-instance overridable here. SSoT for the override badges.
 */
export const WALL_OVERRIDABLE_KEYS: readonly (keyof WallTypeParams)[] = [
  'category',
  'material',
] as const;

/**
 * Type-governed slab params that the per-instance override editor exposes.
 * `thickness`/`dna` are structural (edited on the TYPE itself), so they are
 * deliberately NOT per-instance overridable here. SSoT for the override badges.
 */
export const SLAB_OVERRIDABLE_KEYS: readonly (keyof SlabTypeParams)[] = [
  'kind',
  'material',
] as const;

/**
 * Type-governed roof params that the per-instance override editor exposes.
 * `thickness`/`dna` are structural (edited on the TYPE itself), so they are
 * deliberately NOT per-instance overridable. A roof has no sub-kind, so the only
 * overridable type-governed field is `material`. SSoT for the override badges.
 */
export const ROOF_OVERRIDABLE_KEYS: readonly (keyof RoofTypeParams)[] = [
  'material',
] as const;

/**
 * Type-governed opening params the per-instance override editor exposes.
 * `kind` is deliberately NOT per-instance overridable — switching the family
 * means switching the Type (Revit). `fireRating` is a type-only spec. SSoT for
 * the override badges.
 */
export const OPENING_OVERRIDABLE_KEYS: readonly (keyof OpeningTypeParams)[] = [
  'width',
  'height',
  'frameWidth',
  'material',
  'glazingPanes',
] as const;

// ─── Category-agnostic helpers (no per-category variant) ─────────────────────

/** Built-in (read-only, clone-to-edit) vs user (editable) provenance. */
export function isBuiltInType(type: BimFamilyType): boolean {
  return type.origin === 'built-in';
}

/**
 * Auto-generated «Generic - {thickness}» type (ADR-412). Editable like a user
 * type, but its `name` is a stable i18n key (interpolated with `thickness`), not
 * a literal — so it is NOT inline-renamable in the properties widget.
 */
export function isAutoType(type: BimFamilyType): boolean {
  return type.origin === 'auto';
}

/**
 * Display name for a type. Built-in `name` is a stable i18n key
 * (e.g. `'builtin.wall.exterior'`) → translated. An auto type's name is the
 * stable key `'auto.wall.generic'` UNTIL the user renames it: while it is the
 * default key it is translated + interpolated with the `thickness` («Generic
 * {thickness}mm»); once renamed it carries a literal name (Revit «rename the
 * type, it stays the same type») → returned verbatim, exactly like a user type.
 */
export function resolveTypeDisplayName(
  type: BimFamilyType,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (isBuiltInType(type)) return t(`${I18N_PREFIX}.${type.name}`);
  if (isAutoType(type) && type.name === AUTO_WALL_TYPE_NAME_KEY) {
    const thickness =
      type.category === 'wall'
        ? Math.round((type.typeParams as WallTypeParams).thickness)
        : undefined;
    return t(`${I18N_PREFIX}.${type.name}`, thickness !== undefined ? { thickness } : undefined);
  }
  return type.name;
}

/**
 * Normalises a `typeOverrides` patch: returns `undefined` when the patch has no
 * own enumerable keys (so the entity field is cleared rather than persisted as an
 * empty object). Category-agnostic — the per-category exports below are named
 * instantiations of this one function, not copies.
 */
function normaliseTypeOverrides<TP>(overrides: Partial<TP>): Partial<TP> | undefined {
  return Object.keys(overrides).length === 0 ? undefined : overrides;
}

// ─── Generic core (ADR-584: the four bodies, written once) ───────────────────

/** A BIM category that has family-type support. */
type FamilyCategory = keyof BimTypeParamsByCategory;

/** The type-level param payload of a category (`'wall'` → `WallTypeParams`). */
type TypeParamsOf<C extends FamilyCategory> = BimTypeParamsByCategory[C];

/**
 * The shape every `{X}TypeAssignment` has (see `AssignWallTypeCommand.ts` et al).
 * Structural, so an instantiation IS assignable to the named interface — the
 * command contracts stay untouched and no cast is needed.
 */
interface TypeAssignment<P, TP> {
  readonly typeId: string | undefined;
  readonly typeOverrides: Partial<TP> | undefined;
  readonly params: P;
}

/** An instance carrying cached params plus its optional type binding. */
interface TypedInstance<C extends FamilyCategory, P> {
  params: P;
  typeId?: string;
  typeOverrides?: Partial<TypeParamsOf<C>>;
}

/** The four per-category helpers {@link makeFamilyTypeHelpers} produces. */
interface FamilyTypeHelpers<C extends FamilyCategory, P> {
  asFamilyType(type: BimFamilyType | null | undefined): BimFamilyType<C> | null;
  listTypes(types: readonly BimFamilyType[]): readonly BimFamilyType<C>[];
  getOverriddenParamKeys(
    typeOverrides: Partial<TypeParamsOf<C>> | undefined,
  ): readonly (keyof TypeParamsOf<C>)[];
  resolveTypeAssignment(
    instance: TypedInstance<C, P>,
    nextTypeId: string | undefined,
    nextTypeOverrides: Partial<TypeParamsOf<C>> | undefined,
    getType: (id: string) => BimFamilyType | null,
  ): {
    next: TypeAssignment<P, TypeParamsOf<C>>;
    previous: TypeAssignment<P, TypeParamsOf<C>>;
  };
}

/**
 * Builds the family-type UI helpers for ONE category. The three arguments are the
 * only things that differ between wall / slab / roof / opening.
 *
 * `C` also derives the type-param payload via {@link BimTypeParamsByCategory}, so
 * the compiler rejects a mismatched pairing (e.g. `'slab'` with
 * {@link WALL_OVERRIDABLE_KEYS}) — an error the hand-copied blocks could not catch.
 *
 * @typeParam C Family-type category discriminator (`'wall'`, `'slab'`, …).
 * @typeParam P Instance param payload (e.g. `WallParams`).
 * @param category        The discriminator this instance narrows on.
 * @param overridableKeys Type-governed keys the override editor exposes.
 * @param resolveEffective The category's «type always wins» resolver.
 */
function makeFamilyTypeHelpers<C extends FamilyCategory, P>(
  category: C,
  overridableKeys: readonly (keyof TypeParamsOf<C>)[],
  resolveEffective: (
    instance: TypedInstance<C, P>,
    type: BimFamilyType<C> | null,
  ) => P,
): FamilyTypeHelpers<C, P> {
  const asFamilyType = (
    type: BimFamilyType | null | undefined,
  ): BimFamilyType<C> | null =>
    // `category` is a generic value, so TS cannot narrow the union by comparison;
    // the assertion is guarded by the very check above it (as in the pre-ADR-584
    // hand-written `type as BimFamilyType<'wall'>`).
    type && type.category === category ? (type as BimFamilyType<C>) : null;

  return {
    asFamilyType,

    listTypes: (types) =>
      types
        .map(asFamilyType)
        .filter((t): t is BimFamilyType<C> => t !== null),

    getOverriddenParamKeys: (typeOverrides) =>
      typeOverrides
        ? overridableKeys.filter((k) => typeOverrides[k] !== undefined)
        : [],

    resolveTypeAssignment: (instance, nextTypeId, nextTypeOverrides, getType) => {
      const previous: TypeAssignment<P, TypeParamsOf<C>> = {
        typeId: instance.typeId,
        typeOverrides: instance.typeOverrides,
        params: instance.params,
      };
      const nextType = nextTypeId ? asFamilyType(getType(nextTypeId)) : null;
      const nextParams = resolveEffective(
        { params: instance.params, typeId: nextTypeId, typeOverrides: nextTypeOverrides },
        nextType,
      );
      return {
        next: { typeId: nextTypeId, typeOverrides: nextTypeOverrides, params: nextParams },
        previous,
      };
    },
  };
}

// ─── Per-category instantiations (public API — signatures unchanged) ─────────
//
// The exported names are deliberately ASYMMETRIC: wall carries no infix
// (`getOverriddenParamKeys` / `normaliseOverrides`) while the other three do.
// That is the pre-existing contract of 14 consumer files — renaming would be an
// API break for zero gain, so the names stay exactly as they were.

// ─── Wall ────────────────────────────────────────────────────────────────────

const wallHelpers = makeFamilyTypeHelpers<'wall', WallParams>(
  'wall',
  WALL_OVERRIDABLE_KEYS,
  resolveEffectiveWallParams,
);

/** Narrows a category-agnostic family type to a wall type (null when not a wall). */
export const asWallFamilyType = wallHelpers.asFamilyType;

/** The wall-only slice of the loaded catalog, in catalog order. */
export const listWallTypes = wallHelpers.listTypes;

/** The type-governed param keys an instance currently overrides (badge source). */
export const getOverriddenParamKeys = wallHelpers.getOverriddenParamKeys;

/**
 * Builds the `next` + `previous` `WallTypeAssignment` pair an
 * `AssignWallTypeCommand` needs. Resolves the next EFFECTIVE params from the
 * desired type + overrides («type always wins»); clearing the type
 * (`nextTypeId === undefined`) keeps the wall's current params unchanged
 * (non-destructive detach, ADR-412 Q6).
 *
 * Pure: the live type is supplied via `getType` (the store lookup) so this stays
 * React-free and unit-testable.
 */
export const resolveWallTypeAssignment = wallHelpers.resolveTypeAssignment;

/** Normalises a wall `typeOverrides` patch — `undefined` when empty. */
export const normaliseOverrides = normaliseTypeOverrides<WallTypeParams>;

// ─── Slab ────────────────────────────────────────────────────────────────────

const slabHelpers = makeFamilyTypeHelpers<'slab', SlabParams>(
  'slab',
  SLAB_OVERRIDABLE_KEYS,
  resolveEffectiveSlabParams,
);

/** Narrows a category-agnostic family type to a slab type (null when not a slab). */
export const asSlabFamilyType = slabHelpers.asFamilyType;

/** The slab-only slice of the loaded catalog, in catalog order. */
export const listSlabTypes = slabHelpers.listTypes;

/** The type-governed param keys a slab instance currently overrides (badge source). */
export const getOverriddenSlabParamKeys = slabHelpers.getOverriddenParamKeys;

/**
 * Builds the `next` + `previous` `SlabTypeAssignment` pair an
 * `AssignSlabTypeCommand` needs. Mirror of {@link resolveWallTypeAssignment}.
 */
export const resolveSlabTypeAssignment = slabHelpers.resolveTypeAssignment;

/** Normalises a slab `typeOverrides` patch — `undefined` when empty. */
export const normaliseSlabOverrides = normaliseTypeOverrides<SlabTypeParams>;

// ─── Roof (ADR-417 §10 #3) ───────────────────────────────────────────────────

const roofHelpers = makeFamilyTypeHelpers<'roof', RoofParams>(
  'roof',
  ROOF_OVERRIDABLE_KEYS,
  resolveEffectiveRoofParams,
);

/** Narrows a category-agnostic family type to a roof type (null when not a roof). */
export const asRoofFamilyType = roofHelpers.asFamilyType;

/** The roof-only slice of the loaded catalog, in catalog order. */
export const listRoofTypes = roofHelpers.listTypes;

/** The type-governed param keys a roof instance currently overrides (badge source). */
export const getOverriddenRoofParamKeys = roofHelpers.getOverriddenParamKeys;

/**
 * Builds the `next` + `previous` `RoofTypeAssignment` pair an
 * `AssignRoofTypeCommand` needs. Mirror of {@link resolveWallTypeAssignment}.
 */
export const resolveRoofTypeAssignment = roofHelpers.resolveTypeAssignment;

/** Normalises a roof `typeOverrides` patch — `undefined` when empty. */
export const normaliseRoofOverrides = normaliseTypeOverrides<RoofTypeParams>;

// ─── Opening (ADR-421 SLICE C) ───────────────────────────────────────────────

const openingHelpers = makeFamilyTypeHelpers<'opening', OpeningParams>(
  'opening',
  OPENING_OVERRIDABLE_KEYS,
  resolveEffectiveOpeningParams,
);

/** Narrows a category-agnostic family type to an opening type (null otherwise). */
export const asOpeningFamilyType = openingHelpers.asFamilyType;

/** The opening-only slice of the loaded catalog, in catalog order. */
export const listOpeningTypes = openingHelpers.listTypes;

/** The type-governed param keys an opening instance overrides (badge source). */
export const getOverriddenOpeningParamKeys = openingHelpers.getOverriddenParamKeys;

/**
 * Builds the `next` + `previous` `OpeningTypeAssignment` pair an
 * `AssignOpeningTypeCommand` needs. Mirror of {@link resolveWallTypeAssignment}.
 * Resolves the next EFFECTIVE params from the desired type + overrides («type
 * always wins»); clearing the type keeps the opening's current params unchanged
 * (non-destructive detach). `operationType` is re-derived by the command.
 */
export const resolveOpeningTypeAssignment = openingHelpers.resolveTypeAssignment;

/** Normalises an opening `typeOverrides` patch — `undefined` when empty. */
export const normaliseOpeningOverrides = normaliseTypeOverrides<OpeningTypeParams>;
