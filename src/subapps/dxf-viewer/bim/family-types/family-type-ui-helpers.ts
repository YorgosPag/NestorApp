/**
 * BIM Family Types — pure UI helpers (ADR-412 Φ4).
 *
 * Side-effect-free glue between the family-type store / resolution SSoT and the
 * ribbon widgets (Type Selector + Type Properties / override editor). Kept React-
 * free so it is unit-testable and the widgets stay thin (N.7.1).
 *
 *   - `listWallTypes`            — wall-only slice of the loaded catalog.
 *   - `isBuiltInType`            — read-only built-in vs editable user type.
 *   - `resolveTypeDisplayName`   — built-in name = i18n key, user name = literal.
 *   - `getOverriddenParamKeys`   — which type-governed params an instance overrides.
 *   - `resolveWallTypeAssignment`— builds the next/prev `WallTypeAssignment` for
 *     `AssignWallTypeCommand` («type always wins» effective-param resolution).
 *
 * @see ./resolve-effective-params.ts            — effective-param SSoT
 * @see ../../core/commands/entity-commands/AssignWallTypeCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.3 §3.4
 */

import type {
  BimFamilyType,
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
import type { WallTypeAssignment } from '../../core/commands/entity-commands/AssignWallTypeCommand';
import type { SlabTypeAssignment } from '../../core/commands/entity-commands/AssignSlabTypeCommand';
import type { RoofTypeAssignment } from '../../core/commands/entity-commands/AssignRoofTypeCommand';
import type { OpeningTypeAssignment } from '../../core/commands/entity-commands/AssignOpeningTypeCommand';

/** i18n namespace prefix for every family-type label (mirror the locale block). */
const I18N_PREFIX = 'ribbon.commands.bimFamilyType';

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

/** Narrows a category-agnostic family type to a wall type (null when not a wall). */
export function asWallFamilyType(
  type: BimFamilyType | null | undefined,
): BimFamilyType<'wall'> | null {
  return type && type.category === 'wall'
    ? (type as BimFamilyType<'wall'>)
    : null;
}

/** The wall-only slice of the loaded catalog, in catalog order. */
export function listWallTypes(
  types: readonly BimFamilyType[],
): readonly BimFamilyType<'wall'>[] {
  return types
    .map(asWallFamilyType)
    .filter((t): t is BimFamilyType<'wall'> => t !== null);
}

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

/** The type-governed param keys an instance currently overrides (badge source). */
export function getOverriddenParamKeys(
  typeOverrides: Partial<WallTypeParams> | undefined,
): readonly (keyof WallTypeParams)[] {
  if (!typeOverrides) return [];
  return WALL_OVERRIDABLE_KEYS.filter((k) => typeOverrides[k] !== undefined);
}

/**
 * Builds the `next` + `previous` {@link WallTypeAssignment} pair an
 * `AssignWallTypeCommand` needs. Resolves the next EFFECTIVE params from the
 * desired type + overrides («type always wins»); clearing the type
 * (`nextTypeId === undefined`) keeps the wall's current params unchanged
 * (non-destructive detach, ADR-412 Q6).
 *
 * Pure: the live type is supplied via `getType` (the store lookup) so this stays
 * React-free and unit-testable.
 */
export function resolveWallTypeAssignment(
  wall: {
    params: WallParams;
    typeId?: string;
    typeOverrides?: Partial<WallTypeParams>;
  },
  nextTypeId: string | undefined,
  nextTypeOverrides: Partial<WallTypeParams> | undefined,
  getType: (id: string) => BimFamilyType | null,
): { next: WallTypeAssignment; previous: WallTypeAssignment } {
  const previous: WallTypeAssignment = {
    typeId: wall.typeId,
    typeOverrides: wall.typeOverrides,
    params: wall.params,
  };
  const nextType = nextTypeId ? asWallFamilyType(getType(nextTypeId)) : null;
  const nextParams = resolveEffectiveWallParams(
    { params: wall.params, typeId: nextTypeId, typeOverrides: nextTypeOverrides },
    nextType,
  );
  return {
    next: { typeId: nextTypeId, typeOverrides: nextTypeOverrides, params: nextParams },
    previous,
  };
}

/**
 * Normalises a `typeOverrides` patch: returns `undefined` when the patch has no
 * own enumerable keys (so the entity field is cleared rather than persisted as an
 * empty object). Keeps `resolveWallTypeAssignment` callers terse.
 */
export function normaliseOverrides(
  overrides: Partial<WallTypeParams>,
): Partial<WallTypeParams> | undefined {
  return Object.keys(overrides).length === 0 ? undefined : overrides;
}

// ─── Slab helpers (analogue of the wall helpers above) ───────────────────────

/** Narrows a category-agnostic family type to a slab type (null when not a slab). */
export function asSlabFamilyType(
  type: BimFamilyType | null | undefined,
): BimFamilyType<'slab'> | null {
  return type && type.category === 'slab'
    ? (type as BimFamilyType<'slab'>)
    : null;
}

/** The slab-only slice of the loaded catalog, in catalog order. */
export function listSlabTypes(
  types: readonly BimFamilyType[],
): readonly BimFamilyType<'slab'>[] {
  return types
    .map(asSlabFamilyType)
    .filter((t): t is BimFamilyType<'slab'> => t !== null);
}

/** The type-governed param keys a slab instance currently overrides (badge source). */
export function getOverriddenSlabParamKeys(
  typeOverrides: Partial<SlabTypeParams> | undefined,
): readonly (keyof SlabTypeParams)[] {
  if (!typeOverrides) return [];
  return SLAB_OVERRIDABLE_KEYS.filter((k) => typeOverrides[k] !== undefined);
}

/**
 * Builds the `next` + `previous` {@link SlabTypeAssignment} pair an
 * `AssignSlabTypeCommand` needs. Mirror of {@link resolveWallTypeAssignment}.
 */
export function resolveSlabTypeAssignment(
  slab: {
    params: SlabParams;
    typeId?: string;
    typeOverrides?: Partial<SlabTypeParams>;
  },
  nextTypeId: string | undefined,
  nextTypeOverrides: Partial<SlabTypeParams> | undefined,
  getType: (id: string) => BimFamilyType | null,
): { next: SlabTypeAssignment; previous: SlabTypeAssignment } {
  const previous: SlabTypeAssignment = {
    typeId: slab.typeId,
    typeOverrides: slab.typeOverrides,
    params: slab.params,
  };
  const nextType = nextTypeId ? asSlabFamilyType(getType(nextTypeId)) : null;
  const nextParams = resolveEffectiveSlabParams(
    { params: slab.params, typeId: nextTypeId, typeOverrides: nextTypeOverrides },
    nextType,
  );
  return {
    next: { typeId: nextTypeId, typeOverrides: nextTypeOverrides, params: nextParams },
    previous,
  };
}

/** Normalises a slab `typeOverrides` patch — `undefined` when empty. */
export function normaliseSlabOverrides(
  overrides: Partial<SlabTypeParams>,
): Partial<SlabTypeParams> | undefined {
  return Object.keys(overrides).length === 0 ? undefined : overrides;
}

// ─── Roof helpers (analogue of the slab helpers above, ADR-417 §10 #3) ───────

/** Narrows a category-agnostic family type to a roof type (null when not a roof). */
export function asRoofFamilyType(
  type: BimFamilyType | null | undefined,
): BimFamilyType<'roof'> | null {
  return type && type.category === 'roof'
    ? (type as BimFamilyType<'roof'>)
    : null;
}

/** The roof-only slice of the loaded catalog, in catalog order. */
export function listRoofTypes(
  types: readonly BimFamilyType[],
): readonly BimFamilyType<'roof'>[] {
  return types
    .map(asRoofFamilyType)
    .filter((t): t is BimFamilyType<'roof'> => t !== null);
}

/** The type-governed param keys a roof instance currently overrides (badge source). */
export function getOverriddenRoofParamKeys(
  typeOverrides: Partial<RoofTypeParams> | undefined,
): readonly (keyof RoofTypeParams)[] {
  if (!typeOverrides) return [];
  return ROOF_OVERRIDABLE_KEYS.filter((k) => typeOverrides[k] !== undefined);
}

/**
 * Builds the `next` + `previous` {@link RoofTypeAssignment} pair an
 * `AssignRoofTypeCommand` needs. Mirror of {@link resolveSlabTypeAssignment}.
 */
export function resolveRoofTypeAssignment(
  roof: {
    params: RoofParams;
    typeId?: string;
    typeOverrides?: Partial<RoofTypeParams>;
  },
  nextTypeId: string | undefined,
  nextTypeOverrides: Partial<RoofTypeParams> | undefined,
  getType: (id: string) => BimFamilyType | null,
): { next: RoofTypeAssignment; previous: RoofTypeAssignment } {
  const previous: RoofTypeAssignment = {
    typeId: roof.typeId,
    typeOverrides: roof.typeOverrides,
    params: roof.params,
  };
  const nextType = nextTypeId ? asRoofFamilyType(getType(nextTypeId)) : null;
  const nextParams = resolveEffectiveRoofParams(
    { params: roof.params, typeId: nextTypeId, typeOverrides: nextTypeOverrides },
    nextType,
  );
  return {
    next: { typeId: nextTypeId, typeOverrides: nextTypeOverrides, params: nextParams },
    previous,
  };
}

/** Normalises a roof `typeOverrides` patch — `undefined` when empty. */
export function normaliseRoofOverrides(
  overrides: Partial<RoofTypeParams>,
): Partial<RoofTypeParams> | undefined {
  return Object.keys(overrides).length === 0 ? undefined : overrides;
}

// ─── Opening helpers (analogue of the slab helpers above, ADR-421 SLICE C) ───

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

/** Narrows a category-agnostic family type to an opening type (null otherwise). */
export function asOpeningFamilyType(
  type: BimFamilyType | null | undefined,
): BimFamilyType<'opening'> | null {
  return type && type.category === 'opening'
    ? (type as BimFamilyType<'opening'>)
    : null;
}

/** The opening-only slice of the loaded catalog, in catalog order. */
export function listOpeningTypes(
  types: readonly BimFamilyType[],
): readonly BimFamilyType<'opening'>[] {
  return types
    .map(asOpeningFamilyType)
    .filter((t): t is BimFamilyType<'opening'> => t !== null);
}

/** The type-governed param keys an opening instance overrides (badge source). */
export function getOverriddenOpeningParamKeys(
  typeOverrides: Partial<OpeningTypeParams> | undefined,
): readonly (keyof OpeningTypeParams)[] {
  if (!typeOverrides) return [];
  return OPENING_OVERRIDABLE_KEYS.filter((k) => typeOverrides[k] !== undefined);
}

/**
 * Builds the `next` + `previous` {@link OpeningTypeAssignment} pair an
 * `AssignOpeningTypeCommand` needs. Mirror of {@link resolveWallTypeAssignment}.
 * Resolves the next EFFECTIVE params from the desired type + overrides («type
 * always wins»); clearing the type keeps the opening's current params unchanged
 * (non-destructive detach). `operationType` is re-derived by the command.
 */
export function resolveOpeningTypeAssignment(
  opening: {
    params: OpeningParams;
    typeId?: string;
    typeOverrides?: Partial<OpeningTypeParams>;
  },
  nextTypeId: string | undefined,
  nextTypeOverrides: Partial<OpeningTypeParams> | undefined,
  getType: (id: string) => BimFamilyType | null,
): { next: OpeningTypeAssignment; previous: OpeningTypeAssignment } {
  const previous: OpeningTypeAssignment = {
    typeId: opening.typeId,
    typeOverrides: opening.typeOverrides,
    params: opening.params,
  };
  const nextType = nextTypeId ? asOpeningFamilyType(getType(nextTypeId)) : null;
  const nextParams = resolveEffectiveOpeningParams(
    { params: opening.params, typeId: nextTypeId, typeOverrides: nextTypeOverrides },
    nextType,
  );
  return {
    next: { typeId: nextTypeId, typeOverrides: nextTypeOverrides, params: nextParams },
    previous,
  };
}

/** Normalises an opening `typeOverrides` patch — `undefined` when empty. */
export function normaliseOpeningOverrides(
  overrides: Partial<OpeningTypeParams>,
): Partial<OpeningTypeParams> | undefined {
  return Object.keys(overrides).length === 0 ? undefined : overrides;
}
