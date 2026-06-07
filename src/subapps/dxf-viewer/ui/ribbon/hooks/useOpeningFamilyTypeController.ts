'use client';

/**
 * ADR-421 SLICE C — controller for the contextual Opening «Family Type» ribbon
 * widgets. The opening analogue of `useWallFamilyTypeController`: single owner of
 * the type-assignment / override / duplicate / rename / edit / delete logic so
 * the presentational widgets (`RibbonOpeningFamilyTypeWidget` selector +
 * `RibbonOpeningTypePropertiesWidget` override editor + `EditOpeningTypeDialog`)
 * stay thin (N.7.1) and share one SSoT for every mutation.
 *
 * Mutations:
 *   - assign / clear type   → `AssignOpeningTypeCommand` (undoable, optimistic),
 *   - set / clear override  → same command (re-resolves effective params),
 *   - duplicate / rename    → `BimFamilyTypeService` + optimistic store update,
 *   - edit type params      → generic `UpdateFamilyTypeCommand` (re-flows to all),
 *   - delete type           → generic `createDeleteFamilyTypeCommand` (warn→detach).
 *
 * @see ./useWallFamilyTypeController.ts — wall sibling this mirrors 1:1
 * @see ../components/RibbonOpeningFamilyTypeWidget.tsx
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { useCommandHistory } from '../../../core/commands';
import { AssignOpeningTypeCommand } from '../../../core/commands/entity-commands/AssignOpeningTypeCommand';
import {
  UpdateFamilyTypeCommand,
  type FamilyTypeMutationDeps,
} from '../../../core/commands/entity-commands/UpdateFamilyTypeCommand';
import {
  createDeleteFamilyTypeCommand,
  type FamilyTypeDeleteDeps,
} from '../../../core/commands/entity-commands/DeleteFamilyTypeCommand';
import { EventBus } from '../../../systems/events/EventBus';
import { recordFamilyTypeChange } from '../../../bim/family-types/bim-family-type-audit-client';
import { findOpeningsByTypeId } from '../../../bim/family-types/family-type-side-effects';
import { requestFamilyTypeDelete } from '../../../bim/family-types/bim-family-type-delete-store';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { isOpeningEntity } from '../../../types/entities';
import { useBimFamilyTypeStore } from '../../../bim/family-types/bim-family-type-store';
import {
  createBimFamilyTypeService,
  type BimFamilyTypeService,
} from '../../../bim/family-types/bim-family-type-service';
import { cloneTypeToInput } from '../../../bim/family-types/built-in-types';
import {
  asOpeningFamilyType,
  getOverriddenOpeningParamKeys,
  listOpeningTypes,
  normaliseOpeningOverrides,
  resolveOpeningTypeAssignment,
} from '../../../bim/family-types/family-type-ui-helpers';
import type { OpeningEntity } from '../../../bim/types/opening-types';
import type { BimFamilyType, OpeningTypeParams } from '../../../bim/types/bim-family-type';

export interface OpeningFamilyTypeController {
  readonly opening: OpeningEntity | null;
  /** Opening-only catalog slice (built-in + user), reactive. */
  readonly openingTypes: readonly BimFamilyType<'opening'>[];
  /** The opening's resolved family type, or `null` when ad-hoc/untyped. */
  readonly currentType: BimFamilyType<'opening'> | null;
  /** Type-governed param keys the instance currently overrides. */
  readonly overriddenKeys: readonly (keyof OpeningTypeParams)[];
  /** Can the user create/edit types (auth ready)? Gates Duplicate/Rename. */
  readonly canWrite: boolean;
  /** Assign a type (or `undefined` to detach to ad-hoc). Clears overrides. */
  readonly assignType: (typeId: string | undefined) => void;
  /** Set a single per-instance override of a type-governed param. */
  readonly setOverride: <K extends keyof OpeningTypeParams>(key: K, value: OpeningTypeParams[K]) => void;
  /** Remove a single per-instance override (revert that param to the type). */
  readonly clearOverride: (key: keyof OpeningTypeParams) => void;
  /** Remove ALL overrides — reset the instance fully to its type. */
  readonly resetOverrides: () => void;
  /** Clone the current type to a new editable user type and assign it. */
  readonly duplicateCurrent: (displayName: string) => Promise<string | null>;
  /** Rename a (user) type. Built-ins are read-only — guard in the UI. */
  readonly renameType: (typeId: string, name: string) => Promise<void>;
  /** How many openings in the CURRENT level scene are linked to `typeId`. */
  readonly countOpeningsOfType: (typeId: string) => number;
  /** Edit a (user) type's `typeParams` — re-flows to every instance. Undoable. */
  readonly updateTypeParams: (typeId: string, nextTypeParams: OpeningTypeParams) => void;
  /** Delete a (user) type: warn → confirm → detach + delete. Single undoable op. */
  readonly deleteType: (typeId: string) => Promise<void>;
}

export function useOpeningFamilyTypeController(): OpeningFamilyTypeController {
  const { user } = useAuth();
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();
  const { execute } = useCommandHistory();

  // Reactive catalog snapshot + stable lookup.
  const byId = useBimFamilyTypeStore((s) => s.byId);
  const getType = useBimFamilyTypeStore((s) => s.getType);
  const openingTypes = useMemo(() => listOpeningTypes(Array.from(byId.values())), [byId]);

  const service: BimFamilyTypeService | null = useMemo(
    () =>
      user?.companyId && user?.uid
        ? createBimFamilyTypeService({ companyId: user.companyId, userId: user.uid })
        : null,
    [user?.companyId, user?.uid],
  );

  const opening = useMemo<OpeningEntity | null>(() => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    const e = scene?.entities.find((x) => x.id === id);
    return e && isOpeningEntity(e) ? e : null;
    // byId is a dep so the resolved type refreshes when the catalog changes.
  }, [levelManager, universalSelection, byId]);

  const currentType = useMemo(
    () => (opening?.typeId ? asOpeningFamilyType(getType(opening.typeId)) : null),
    [opening?.typeId, getType, byId],
  );

  const overriddenKeys = useMemo(
    () => getOverriddenOpeningParamKeys(opening?.typeOverrides),
    [opening?.typeOverrides],
  );

  // Single dispatch path — resolves effective params and commits one undo step.
  const dispatchAssignment = useCallback(
    (nextTypeId: string | undefined, nextOverrides: Partial<OpeningTypeParams> | undefined) => {
      if (!opening || !levelManager.currentLevelId) return;
      const { next, previous } = resolveOpeningTypeAssignment(opening, nextTypeId, nextOverrides, getType);
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      execute(new AssignOpeningTypeCommand(opening.id, next, previous, sm));
    },
    [opening, levelManager, getType, execute],
  );

  const assignType = useCallback(
    (typeId: string | undefined) => dispatchAssignment(typeId, undefined),
    [dispatchAssignment],
  );

  const setOverride = useCallback(
    <K extends keyof OpeningTypeParams>(key: K, value: OpeningTypeParams[K]) => {
      if (!opening?.typeId) return;
      const next = normaliseOpeningOverrides({ ...(opening.typeOverrides ?? {}), [key]: value });
      dispatchAssignment(opening.typeId, next);
    },
    [opening, dispatchAssignment],
  );

  const clearOverride = useCallback(
    (key: keyof OpeningTypeParams) => {
      if (!opening?.typeId) return;
      const rest: Partial<OpeningTypeParams> = { ...(opening.typeOverrides ?? {}) };
      delete rest[key];
      dispatchAssignment(opening.typeId, normaliseOpeningOverrides(rest));
    },
    [opening, dispatchAssignment],
  );

  const resetOverrides = useCallback(() => {
    if (!opening?.typeId) return;
    dispatchAssignment(opening.typeId, undefined);
  }, [opening, dispatchAssignment]);

  const duplicateCurrent = useCallback(
    async (displayName: string): Promise<string | null> => {
      if (!service || !currentType) return null;
      const created = await service.saveType(cloneTypeToInput(currentType, displayName, 'company'));
      const store = useBimFamilyTypeStore.getState();
      store.setTypes([...store.getTypes(), created]); // optimistic — store resolves the new id
      dispatchAssignment(created.id, undefined);
      return created.id;
    },
    [service, currentType, dispatchAssignment],
  );

  const countOpeningsOfType = useCallback(
    (typeId: string): number => {
      if (!levelManager.currentLevelId) return 0;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      return scene ? findOpeningsByTypeId(scene, typeId).length : 0;
    },
    [levelManager],
  );

  const renameType = useCallback(
    async (typeId: string, name: string) => {
      if (!service) return;
      await service.updateType(typeId, { name });
      const store = useBimFamilyTypeStore.getState();
      store.setTypes(store.getTypes().map((t) => (t.id === typeId ? { ...t, name } : t)));
    },
    [service],
  );

  // ADR-421 SLICE C — edit the type's params as one undoable op (generic command).
  // Optimistic catalog `setTypes` (→ free in-scene re-resolution) + persist +
  // audit + `bim:family-type-changed` emit (→ all-floors BOQ re-feed). Built-in
  // guard is the UI's job.
  const updateTypeParams = useCallback(
    (typeId: string, nextTypeParams: OpeningTypeParams) => {
      if (!service) return;
      const current = asOpeningFamilyType(getType(typeId));
      if (!current) return;
      const deps: FamilyTypeMutationDeps<OpeningTypeParams> = {
        getTypes: () => useBimFamilyTypeStore.getState().getTypes(),
        setTypes: (types) => useBimFamilyTypeStore.getState().setTypes(types),
        persist: (typeParams) => {
          void service.updateType(typeId, { typeParams, category: 'opening' });
        },
        audit: (from, to) =>
          recordFamilyTypeChange(
            'updated',
            { id: typeId, name: current.name, category: 'opening', typeParams: to },
            { prevTypeParams: from },
          ),
        notifyChanged: () => EventBus.emit('bim:family-type-changed', { typeId, category: 'opening' }),
      };
      execute(new UpdateFamilyTypeCommand<OpeningTypeParams>(typeId, nextTypeParams, current.typeParams, deps));
    },
    [service, getType, execute],
  );

  // ADR-421 SLICE C — warn → confirm → detach current-scene instances + delete.
  // Detach reuses AssignOpeningTypeCommand (typeId→undefined, params kept).
  const deleteType = useCallback(
    async (typeId: string) => {
      if (!service || !levelManager.currentLevelId) return;
      const type = asOpeningFamilyType(getType(typeId));
      if (!type) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      const affected = scene ? findOpeningsByTypeId(scene, typeId) : [];

      const action = await requestFamilyTypeDelete({ typeId, affectedCount: affected.length });
      if (action !== 'delete-and-detach') return;

      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      const detachCommands = affected.map((o) => {
        const { next, previous } = resolveOpeningTypeAssignment(o, undefined, undefined, getType);
        return new AssignOpeningTypeCommand(o.id, next, previous, sm);
      });

      const deps: FamilyTypeDeleteDeps = {
        getTypes: () => useBimFamilyTypeStore.getState().getTypes(),
        setTypes: (types) => useBimFamilyTypeStore.getState().setTypes(types),
        removePersist: () => { void service.deleteType(typeId); },
        restorePersist: () => { void service.restoreType(type); },
        auditDeleted: () =>
          recordFamilyTypeChange('deleted', {
            id: type.id, name: type.name, category: 'opening', typeParams: type.typeParams,
          }),
        auditRestored: () =>
          recordFamilyTypeChange('created', {
            id: type.id, name: type.name, category: 'opening', typeParams: type.typeParams,
          }),
      };
      execute(createDeleteFamilyTypeCommand('DeleteOpeningFamilyType', type, detachCommands, deps));
    },
    [service, getType, levelManager, execute],
  );

  return {
    opening,
    openingTypes,
    currentType,
    overriddenKeys,
    canWrite: !!service,
    assignType,
    setOverride,
    clearOverride,
    resetOverrides,
    duplicateCurrent,
    renameType,
    countOpeningsOfType,
    updateTypeParams,
    deleteType,
  };
}
