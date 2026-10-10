/**
 * Wall typer — the PURE half of auto-type-on-create (Revit «Generic Wall», ADR-412 · ADR-911 Φ3).
 *
 * ─── WHY ────────────────────────────────────────────────────────────────────
 * In Revit a wall never exists without its type: the type is chosen BEFORE the
 * element is placed, so every check runs on the final wall. Here the type used to
 * be stamped by the caller AFTER `computeFillingWalls` had already extended the
 * wall to its neighbours and tested it for overlap — and «type always wins» can
 * change the params (nominal thickness, layer DNA). The preview therefore showed
 * one wall and the commit wrote another.
 *
 * This module makes the stamp a pure function, so it can run INSIDE the build
 * (preview and commit alike). Minting is split from persisting: a typer only
 * *remembers* the types it had to mint; the host decides if and when they reach
 * the store (`useWallAutoTyping`). A proposal that is never approved leaves no
 * orphan type behind.
 *
 * PURE — zero React/DOM/store/network.
 *
 * @see ./auto-wall-type.ts — the policy SSoT this composes
 * @see ./useWallAutoTyping.ts — the host that persists what a typer minted
 * @see ../walls/filling-walls-compute.ts — where the stamp runs
 */

import type { WallCategory, WallEntity } from '../types/wall-types';
import type { BimFamilyType } from '../types/bim-family-type';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { validateWallParams } from '../validators/wall-validator';
import { resolveEffectiveWallParams } from './resolve-effective-params';
import {
  buildAutoWallType,
  findAutoWallType,
  resolveAutoWallTypeIdForSignature,
  resolveAutoWallTypeSignature,
} from './auto-wall-type';

/** Builds a generic auto wall type for a cross-section (the caller owns id + ownership). */
export type AutoWallTypeMint = (category: WallCategory, thicknessMm: number) => BimFamilyType<'wall'>;

export interface WallTyperContext {
  /** The loaded catalog (built-ins + persisted), read once when the typer is created. */
  readonly types: readonly BimFamilyType[];
  /** `null` ⇒ minting is impossible (auth not ready): such walls stay ad-hoc, no throw. */
  readonly mint: AutoWallTypeMint | null;
}

export interface WallTyper {
  /** Stamp one wall with its shared family type. Idempotent: a typed wall is returned as is. */
  readonly typeWall: (wall: WallEntity) => WallEntity;
  /**
   * The types this typer had to mint that `walls` actually reference — what the host
   * must persist. A type minted for a wall that was later rejected is NOT returned.
   */
  readonly mintedFor: (walls: readonly WallEntity[]) => readonly BimFamilyType<'wall'>[];
}

/**
 * One build's worth of typing, as a host hands it out: stamp inside the build, persist
 * what survived. The side-effect half lives in the host (`useWallAutoTyping`).
 */
export interface WallTypingSession {
  /** Stamp a freshly-built wall with its shared family type (pure, no side effect). */
  readonly typeWall: (wall: WallEntity) => WallEntity;
  /** Persist the minted types that `walls` reference. Call once, right before the write. */
  readonly commit: (walls: readonly WallEntity[]) => void;
}

function asWallType(type: BimFamilyType | undefined): BimFamilyType<'wall'> | null {
  return type && type.category === 'wall' ? (type as BimFamilyType<'wall'>) : null;
}

/** «type always wins» — resolve the effective params and recompute what derives from them. */
function stamp(wall: WallEntity, type: BimFamilyType<'wall'>): WallEntity {
  const typeId = type.id;
  const params = resolveEffectiveWallParams({ params: wall.params, typeId }, type);
  if (params === wall.params) return { ...wall, typeId };
  return {
    ...wall,
    typeId,
    params,
    geometry: computeWallGeometry(params, wall.kind),
    validation: validateWallParams(params).bimValidation,
  };
}

/**
 * Create a typer over a catalog snapshot. Find-or-create is idempotent inside one
 * typer: two walls of the same signature share ONE minted type.
 */
export function createWallTyper(ctx: WallTyperContext): WallTyper {
  const minted: BimFamilyType<'wall'>[] = [];

  const resolveType = (category: WallCategory, thickness: number): BimFamilyType<'wall'> | null => {
    // Built-in match (cross-method grouping with default walls). Catalog not seeded
    // yet ⇒ leave the wall ad-hoc rather than mint a duplicate of a built-in.
    const builtInId = resolveAutoWallTypeIdForSignature(category, thickness);
    if (builtInId) return asWallType(ctx.types.find((t) => t.id === builtInId));
    const existing = findAutoWallType([...ctx.types, ...minted], category, thickness);
    if (existing) return existing;
    if (!ctx.mint) return null;
    const built = ctx.mint(category, thickness);
    minted.push(built);
    return built;
  };

  const typeWall = (wall: WallEntity): WallEntity => {
    if (wall.typeId) return wall;
    const { category, thickness } = wall.params;
    if (!category || !(thickness > 0)) return wall;
    const type = resolveType(category, thickness);
    return type ? stamp(wall, type) : wall;
  };

  const mintedFor = (walls: readonly WallEntity[]): readonly BimFamilyType<'wall'>[] => {
    const used = new Set(walls.map((w) => w.typeId));
    return minted.filter((t) => used.has(t.id));
  };

  return { typeWall, mintedFor };
}

/**
 * A typer for HOVER PREVIEWS only: mints throw-away draft types so the previewed
 * geometry equals the committed one, without touching ids, auth or the network.
 * ⚠️ Walls it returns carry a `draft:` type id and must NEVER be written.
 */
export function createPreviewWallTyper(types: readonly BimFamilyType[]): WallTyper {
  return createWallTyper({
    types,
    mint: (category, thicknessMm) =>
      buildAutoWallType(`draft:${resolveAutoWallTypeSignature(category, thicknessMm)}`, category, thicknessMm, '', ''),
  });
}
