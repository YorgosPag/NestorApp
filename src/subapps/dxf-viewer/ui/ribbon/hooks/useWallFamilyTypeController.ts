'use client';

/**
 * ADR-412 Φ4 — controller for the contextual Wall «Family Type» ribbon widgets.
 *
 * Thin binding of the generic `useFamilyTypeController` core (ADR-603 Φ3) to the
 * wall bindings, re-mapped to the wall-named public API the widgets, dialog and
 * draw-tool draft panel consume. The wall-only `saveNewType` (draw-tool «save as
 * new type») stays here — it is not part of the shared surface.
 *
 * @see ./create-family-type-controller.ts — shared core (ADR-603)
 * @see ../components/RibbonWallFamilyTypeWidget.tsx
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.7
 */

import { useCallback } from 'react';
import { AssignWallTypeCommand } from '../../../core/commands/entity-commands/AssignWallTypeCommand';
import { UpdateWallFamilyTypeCommand } from '../../../core/commands/entity-commands/UpdateWallFamilyTypeCommand';
import { createDeleteWallFamilyTypeCommand } from '../../../core/commands/entity-commands/DeleteWallFamilyTypeCommand';
import { recordFamilyTypeChange } from '../../../bim/family-types/bim-family-type-audit-client';
import { findWallsByTypeId } from '../../../bim/family-types/family-type-side-effects';
import { isWallEntity } from '../../../types/entities';
import { useBimFamilyTypeStore } from '../../../bim/family-types/bim-family-type-store';
import {
  asWallFamilyType,
  getOverriddenParamKeys,
  listWallTypes,
  normaliseOverrides,
  resolveWallTypeAssignment,
} from '../../../bim/family-types/family-type-ui-helpers';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { BimFamilyType, WallTypeParams } from '../../../bim/types/bim-family-type';
import {
  useFamilyTypeController,
  type FamilyTypeControllerConfig,
} from './create-family-type-controller';

export interface WallFamilyTypeController {
  readonly wall: WallEntity | null;
  /** Wall-only catalog slice (built-in + user), reactive. */
  readonly wallTypes: readonly BimFamilyType<'wall'>[];
  /** The wall's resolved family type, or `null` when ad-hoc/untyped. */
  readonly currentType: BimFamilyType<'wall'> | null;
  /** Type-governed param keys the instance currently overrides. */
  readonly overriddenKeys: readonly (keyof WallTypeParams)[];
  /** Can the user create/edit types (auth ready)? Gates Duplicate/Rename. */
  readonly canWrite: boolean;
  /** Assign a type (or `undefined` to detach to ad-hoc). Clears overrides. */
  readonly assignType: (typeId: string | undefined) => void;
  /** Set a single per-instance override of a type-governed param. */
  readonly setOverride: <K extends keyof WallTypeParams>(key: K, value: WallTypeParams[K]) => void;
  /** Remove a single per-instance override (revert that param to the type). */
  readonly clearOverride: (key: keyof WallTypeParams) => void;
  /** Remove ALL overrides — reset the instance fully to its type. */
  readonly resetOverrides: () => void;
  /**
   * Clone the current type to a new editable user type and assign it (Q3).
   * Returns the new type's id (or `null` when unavailable).
   */
  readonly duplicateCurrent: (displayName: string) => Promise<string | null>;
  /**
   * ADR-363/412 — save a BRAND-NEW user wall type from explicit `typeParams`
   * (not a clone). Used by the draw-tool draft panel «Αποθήκευση ως νέος τύπος».
   * Returns the new id (or `null` when auth not ready).
   */
  readonly saveNewType: (typeParams: WallTypeParams, displayName: string) => Promise<string | null>;
  /** Rename a (user) type. Built-ins are read-only — guard in the UI. */
  readonly renameType: (typeId: string, name: string) => Promise<void>;
  /** How many walls in the CURRENT level scene are linked to `typeId` (ADR-414). */
  readonly countWallsOfType: (typeId: string) => number;
  /** Edit a (user) type's `typeParams` — re-flows to every instance. Undoable. */
  readonly updateTypeParams: (typeId: string, nextTypeParams: WallTypeParams) => void;
  /** Delete a (user) type: warn → confirm → detach + delete. Single undoable op. */
  readonly deleteType: (typeId: string) => Promise<void>;
}

const WALL_CONFIG: FamilyTypeControllerConfig<'wall', WallEntity> = {
  category: 'wall',
  isEntity: isWallEntity,
  listTypes: listWallTypes,
  asFamilyType: asWallFamilyType,
  getOverriddenParamKeys,
  normaliseOverrides,
  findByTypeId: findWallsByTypeId,
  makeAssignCommand: (entity, typeId, overrides, sceneManager, getType) => {
    const { next, previous } = resolveWallTypeAssignment(entity, typeId, overrides, getType);
    return new AssignWallTypeCommand(entity.id, next, previous, sceneManager, entity.kind);
  },
  makeUpdateCommand: (typeId, next, previous, deps) =>
    new UpdateWallFamilyTypeCommand(typeId, next, previous, deps),
  makeDeleteCommand: (snapshot, detachCommands, deps) =>
    createDeleteWallFamilyTypeCommand(snapshot, detachCommands, deps),
};

export function useWallFamilyTypeController(): WallFamilyTypeController {
  const core = useFamilyTypeController(WALL_CONFIG);
  const { service } = core;

  // ADR-363/412 — draw-tool «save as new type»: the composition set before
  // drawing becomes a reusable, persistent type. Wall-only, not in the shared core.
  const saveNewType = useCallback(
    async (typeParams: WallTypeParams, displayName: string): Promise<string | null> => {
      if (!service) return null;
      const created = await service.saveType({
        name: displayName,
        category: 'wall',
        scope: 'company',
        origin: 'user',
        typeParams,
      });
      const store = useBimFamilyTypeStore.getState();
      store.setTypes([...store.getTypes(), created]); // optimistic — catalog now lists it
      void recordFamilyTypeChange('created', {
        id: created.id,
        name: created.name,
        category: 'wall',
        typeParams,
      });
      return created.id;
    },
    [service],
  );

  return {
    wall: core.entity,
    wallTypes: core.types,
    currentType: core.currentType,
    overriddenKeys: core.overriddenKeys,
    canWrite: core.canWrite,
    assignType: core.assignType,
    setOverride: core.setOverride,
    clearOverride: core.clearOverride,
    resetOverrides: core.resetOverrides,
    duplicateCurrent: core.duplicateCurrent,
    saveNewType,
    renameType: core.renameType,
    updateTypeParams: core.updateTypeParams,
    deleteType: core.deleteType,
    countWallsOfType: core.countOfType,
  };
}
