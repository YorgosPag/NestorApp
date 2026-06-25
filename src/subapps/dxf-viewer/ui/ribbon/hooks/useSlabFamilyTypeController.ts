'use client';

/**
 * ADR-412 — controller for the contextual Slab «Family Type» ribbon widget.
 * Slab analogue of `useWallFamilyTypeController`.
 *
 * Single owner of the type-assignment / override / duplicate / rename / edit /
 * delete logic so the presentational widget stays thin (N.7.1). Reads the live
 * catalog from `bim-family-type-store`; writes create a private service instance
 * + apply optimistic store updates (mirror the wall idiom).
 *
 * @see ./useWallFamilyTypeController.ts — the wall sibling
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { useCommandHistory } from '../../../core/commands';
import { AssignSlabTypeCommand } from '../../../core/commands/entity-commands/AssignSlabTypeCommand';
import {
  UpdateSlabFamilyTypeCommand,
  type SlabFamilyTypeMutationDeps,
} from '../../../core/commands/entity-commands/UpdateSlabFamilyTypeCommand';
import {
  createDeleteSlabFamilyTypeCommand,
  type SlabFamilyTypeDeleteDeps,
} from '../../../core/commands/entity-commands/DeleteSlabFamilyTypeCommand';
import { EventBus } from '../../../systems/events/EventBus';
import { recordFamilyTypeChange } from '../../../bim/family-types/bim-family-type-audit-client';
import { findSlabsByTypeId } from '../../../bim/family-types/family-type-side-effects';
import { requestFamilyTypeDelete } from '../../../bim/family-types/bim-family-type-delete-store';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { isSlabEntity } from '../../../types/entities';
import { useBimFamilyTypeStore } from '../../../bim/family-types/bim-family-type-store';
import {
  createBimFamilyTypeService,
  type BimFamilyTypeService,
} from '../../../bim/family-types/bim-family-type-service';
import { cloneTypeToInput } from '../../../bim/family-types/built-in-types';
import {
  asSlabFamilyType,
  getOverriddenSlabParamKeys,
  listSlabTypes,
  normaliseSlabOverrides,
  resolveSlabTypeAssignment,
} from '../../../bim/family-types/family-type-ui-helpers';
import type { SlabEntity } from '../../../bim/types/slab-types';
import type { BimFamilyType, SlabTypeParams } from '../../../bim/types/bim-family-type';

export interface SlabFamilyTypeController {
  readonly slab: SlabEntity | null;
  readonly slabTypes: readonly BimFamilyType<'slab'>[];
  readonly currentType: BimFamilyType<'slab'> | null;
  readonly overriddenKeys: readonly (keyof SlabTypeParams)[];
  readonly canWrite: boolean;
  readonly assignType: (typeId: string | undefined) => void;
  readonly setOverride: <K extends keyof SlabTypeParams>(key: K, value: SlabTypeParams[K]) => void;
  readonly clearOverride: (key: keyof SlabTypeParams) => void;
  readonly resetOverrides: () => void;
  readonly duplicateCurrent: (displayName: string) => Promise<string | null>;
  readonly renameType: (typeId: string, name: string) => Promise<void>;
  readonly countSlabsOfType: (typeId: string) => number;
  readonly updateTypeParams: (typeId: string, nextTypeParams: SlabTypeParams) => void;
  readonly deleteType: (typeId: string) => Promise<void>;
}

export function useSlabFamilyTypeController(): SlabFamilyTypeController {
  const { user } = useAuth();
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();
  const { execute } = useCommandHistory();

  const byId = useBimFamilyTypeStore((s) => s.byId);
  const getType = useBimFamilyTypeStore((s) => s.getType);
  const slabTypes = useMemo(() => listSlabTypes(Array.from(byId.values())), [byId]);

  const service: BimFamilyTypeService | null = useMemo(
    () =>
      user?.companyId && user?.uid
        ? createBimFamilyTypeService({ companyId: user.companyId, userId: user.uid })
        : null,
    [user?.companyId, user?.uid],
  );

  const slab = useMemo<SlabEntity | null>(() => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    const e = scene?.entities.find((x) => x.id === id);
    return e && isSlabEntity(e) ? e : null;
  }, [levelManager, universalSelection, byId]);

  const currentType = useMemo(
    () => (slab?.typeId ? asSlabFamilyType(getType(slab.typeId)) : null),
    [slab?.typeId, getType, byId],
  );

  const overriddenKeys = useMemo(
    () => getOverriddenSlabParamKeys(slab?.typeOverrides),
    [slab?.typeOverrides],
  );

  const dispatchAssignment = useCallback(
    (nextTypeId: string | undefined, nextOverrides: Partial<SlabTypeParams> | undefined) => {
      if (!slab || !levelManager.currentLevelId) return;
      const { next, previous } = resolveSlabTypeAssignment(slab, nextTypeId, nextOverrides, getType);
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      execute(new AssignSlabTypeCommand(slab.id, next, previous, sm));
    },
    [slab, levelManager, getType, execute],
  );

  const assignType = useCallback(
    (typeId: string | undefined) => dispatchAssignment(typeId, undefined),
    [dispatchAssignment],
  );

  const setOverride = useCallback(
    <K extends keyof SlabTypeParams>(key: K, value: SlabTypeParams[K]) => {
      if (!slab?.typeId) return;
      const next = normaliseSlabOverrides({ ...(slab.typeOverrides ?? {}), [key]: value });
      dispatchAssignment(slab.typeId, next);
    },
    [slab, dispatchAssignment],
  );

  const clearOverride = useCallback(
    (key: keyof SlabTypeParams) => {
      if (!slab?.typeId) return;
      const rest: Partial<SlabTypeParams> = { ...(slab.typeOverrides ?? {}) };
      delete rest[key];
      dispatchAssignment(slab.typeId, normaliseSlabOverrides(rest));
    },
    [slab, dispatchAssignment],
  );

  const resetOverrides = useCallback(() => {
    if (!slab?.typeId) return;
    dispatchAssignment(slab.typeId, undefined);
  }, [slab, dispatchAssignment]);

  const duplicateCurrent = useCallback(
    async (displayName: string): Promise<string | null> => {
      if (!service || !currentType) return null;
      const created = await service.saveType(cloneTypeToInput(currentType, displayName, 'company'));
      const store = useBimFamilyTypeStore.getState();
      store.setTypes([...store.getTypes(), created]);
      dispatchAssignment(created.id, undefined);
      return created.id;
    },
    [service, currentType, dispatchAssignment],
  );

  const countSlabsOfType = useCallback(
    (typeId: string): number => {
      if (!levelManager.currentLevelId) return 0;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      return scene ? findSlabsByTypeId(scene, typeId).length : 0;
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

  const updateTypeParams = useCallback(
    (typeId: string, nextTypeParams: SlabTypeParams) => {
      if (!service) return;
      const current = asSlabFamilyType(getType(typeId));
      if (!current) return;
      const deps: SlabFamilyTypeMutationDeps = {
        getTypes: () => useBimFamilyTypeStore.getState().getTypes(),
        setTypes: (types) => useBimFamilyTypeStore.getState().setTypes(types),
        persist: (typeParams) => {
          void service.updateType(typeId, { typeParams, category: 'slab' });
        },
        audit: (from, to) =>
          recordFamilyTypeChange(
            'updated',
            { id: typeId, name: current.name, category: 'slab', typeParams: to },
            { prevTypeParams: from },
          ),
        notifyChanged: () => EventBus.emit('bim:family-type-changed', { typeId, category: 'slab' }),
      };
      execute(new UpdateSlabFamilyTypeCommand(typeId, nextTypeParams, current.typeParams, deps));
    },
    [service, getType, execute],
  );

  const deleteType = useCallback(
    async (typeId: string) => {
      if (!service || !levelManager.currentLevelId) return;
      const type = asSlabFamilyType(getType(typeId));
      if (!type) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      const affected = scene ? findSlabsByTypeId(scene, typeId) : [];

      const action = await requestFamilyTypeDelete({ typeId, affectedCount: affected.length });
      if (action !== 'delete-and-detach') return;

      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      const detachCommands = affected.map((s) => {
        const { next, previous } = resolveSlabTypeAssignment(s, undefined, undefined, getType);
        return new AssignSlabTypeCommand(s.id, next, previous, sm);
      });

      const deps: SlabFamilyTypeDeleteDeps = {
        getTypes: () => useBimFamilyTypeStore.getState().getTypes(),
        setTypes: (types) => useBimFamilyTypeStore.getState().setTypes(types),
        removePersist: () => { void service.deleteType(typeId); },
        restorePersist: () => { void service.restoreType(type); },
        auditDeleted: () =>
          recordFamilyTypeChange('deleted', {
            id: type.id, name: type.name, category: 'slab', typeParams: type.typeParams,
          }),
        auditRestored: () =>
          recordFamilyTypeChange('created', {
            id: type.id, name: type.name, category: 'slab', typeParams: type.typeParams,
          }),
      };
      execute(createDeleteSlabFamilyTypeCommand(type, detachCommands, deps));
    },
    [service, getType, levelManager, execute],
  );

  return {
    slab,
    slabTypes,
    currentType,
    overriddenKeys,
    canWrite: !!service,
    assignType,
    setOverride,
    clearOverride,
    resetOverrides,
    duplicateCurrent,
    renameType,
    countSlabsOfType,
    updateTypeParams,
    deleteType,
  };
}
