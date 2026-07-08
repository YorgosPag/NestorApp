'use client';

/**
 * ADR-412 «type always wins» — wall re-resolution on family-type catalog change.
 *
 * Thin binding of the shared `createTypeReresolutionHook` factory (ADR-603 Φ1)
 * to the pure `reresolveSceneWalls` SSoT. On every `BimFamilyType` store
 * `version` bump (a type edit OR a late type load landing after the wall docs
 * already mapped to scene entities), re-runs resolution over the active scene's
 * typed walls so their cached type-governed params re-flow from the live type.
 * Locally dirty walls are skipped (local edits win); untyped walls are untouched.
 *
 * @see ./create-type-reresolution-hook.ts — shared factory (ADR-603)
 * @see ./wall-persistence-helpers.ts — reresolveSceneWalls (pure SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.4
 */

import { createTypeReresolutionHook } from './create-type-reresolution-hook';
import { reresolveSceneWalls } from './wall-persistence-helpers';

/**
 * Wire family-type re-resolution into the wall scene-sync path.
 *
 * @param levelManager Active level scene accessor (same instance the persistence
 *   hook uses).
 * @param dirtyIdsRef  Wall ids with un-persisted local edits (skipped during
 *   re-resolution so local edits always win).
 */
export const useWallTypeReresolution = createTypeReresolutionHook(reresolveSceneWalls);
