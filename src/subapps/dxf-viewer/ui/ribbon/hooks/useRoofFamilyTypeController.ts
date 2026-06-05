'use client';

/**
 * ADR-417 §10 #3 — controller for the contextual Roof «Family Type» ribbon
 * widget. Roof analogue of `useSlabFamilyTypeController`.
 *
 * Single owner of the type-assignment / override / duplicate / rename / edit /
 * delete logic so the presentational widget stays thin (N.7.1). Reads the live
 * catalog from `bim-family-type-store`; writes create a private service instance
 * + apply optimistic store updates (mirror the slab idiom).
 *
 * @see ./useSlabFamilyTypeController.ts — the slab sibling
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10 #3
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { useCommandHistory } from '../../../core/commands';
import { AssignRoofTypeCommand } from '../../../core/commands/entity-commands/AssignRoofTypeCommand';
import {
  UpdateRoofFamilyTypeCommand,
  type RoofFamilyTypeMutationDeps,
} from '../../../core/commands/entity-commands/UpdateRoofFamilyTypeCommand';
import {
  createDeleteRoofFamilyTypeCommand,
  type RoofFamilyTypeDeleteDeps,
} from '../../../core/commands/entity-commands/DeleteRoofFamilyTypeCommand';
import { EventBus } from '../../../systems/events/EventBus';
import { recordFamilyTypeChange } from '../../../bim/family-types/bim-family-type-audit-client';
import { findRoofsByTypeId } from '../../../bim/family-types/family-type-side-effects';
import { requestFamilyTypeDelete } from '../../../bim/family-types/bim-family-type-delete-store';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { isRoofEntity } from '../../../types/entities';
import { useBimFamilyTypeStore } from '../../../bim/family-types/bim-family-type-store';
import {
  createBimFamilyTypeService,
  type BimFamilyTypeService,
} from '../../../bim/family-types/bim-family-type-service';
import { cloneTypeToInput } from '../../../bim/family-types/built-in-types';
import {
  asRoofFamilyType,
  getOverriddenRoofParamKeys,
  listRoofTypes,
  normaliseRoofOverrides,
  resolveRoofTypeAssignment,
} from '../../../bim/family-types/family-type-ui-helpers';
import type { RoofEntity } from '../../../bim/types/roof-types';
import type { BimFamilyType, RoofTypeParams } from '../../../bim/types/bim-family-type';

export interface RoofFamilyTypeController {
  readonly roof: RoofEntity | null;
  readonly roofTypes: readonly BimFamilyType<'roof'>[];
  readonly currentType: BimFamilyType<'roof'> | null;
  readonly overriddenKeys: readonly (keyof RoofTypeParams)[];
  readonly canWrite: boolean;
  readonly assignType: (typeId: string | undefined) => void;
  readonly setOverride: <K extends keyof RoofTypeParams>(key: K, value: RoofTypeParams[K]) => void;
  readonly clearOverride: (key: keyof RoofTypeParams) => void;
  readonly resetOverrides: () => void;
  readonly duplicateCurrent: (displayName: string) => Promise<string | null>;
  readonly renameType: (typeId: string, name: string) => Promise<void>;
  readonly countRoofsOfType: (typeId: string) => number;
  readonly updateTypeParams: (typeId: string, nextTypeParams: RoofTypeParams) => void;
  readonly deleteType: (typeId: string) => Promise<void>;
}

export function useRoofFamilyTypeController(): RoofFamilyTypeController {
  const { user } = useAuth();
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();
  const { execute } = useCommandHistory();

  const byId = useBimFamilyTypeStore((s) => s.byId);
  const getType = useBimFamilyTypeStore((s) => s.getType);
  const roofTypes = useMemo(() => listRoofTypes(Array.from(byId.values())), [byId]);

  const service: BimFamilyTypeService | null = useMemo(
    () =>
      user?.companyId && user?.uid
        ? createBimFamilyTypeService({ companyId: user.companyId, userId: user.uid })
        : null,
    [user?.companyId, user?.uid],
  );

  const roof = useMemo<RoofEntity | null>(() => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    const e = scene?.entities.find((x) => x.id === id);
    return e && isRoofEntity(e) ? e : null;
  }, [levelManager, universalSelection, byId]);

  const currentType = useMemo(
    () => (roof?.typeId ? asRoofFamilyType(getType(roof.typeId)) : null),
    [roof?.typeId, getType, byId],
  );

  const overriddenKeys = useMemo(
    () => getOverriddenRoofParamKeys(roof?.typeOverrides),
    [roof?.typeOverrides],
  );

  const dispatchAssignment = useCallback(
    (nextTypeId: string | undefined, nextOverrides: Partial<RoofTypeParams> | undefined) => {
      if (!roof || !levelManager.currentLevelId) return;
      const { next, previous } = resolveRoofTypeAssignment(roof, nextTypeId, nextOverrides, getType);
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      execute(new AssignRoofTypeCommand(roof.id, next, previous, sm));
    },
    [roof, levelManager, getType, execute],
  );

  const assignType = useCallback(
    (typeId: string | undefined) => dispatchAssignment(typeId, undefined),
    [dispatchAssignment],
  );

  const setOverride = useCallback(
    <K extends keyof RoofTypeParams>(key: K, value: RoofTypeParams[K]) => {
      if (!roof?.typeId) return;
      const next = normaliseRoofOverrides({ ...(roof.typeOverrides ?? {}), [key]: value });
      dispatchAssignment(roof.typeId, next);
    },
    [roof, dispatchAssignment],
  );

  const clearOverride = useCallback(
    (key: keyof RoofTypeParams) => {
      if (!roof?.typeId) return;
      const rest: Partial<RoofTypeParams> = { ...(roof.typeOverrides ?? {}) };
      delete rest[key];
      dispatchAssignment(roof.typeId, normaliseRoofOverrides(rest));
    },
    [roof, dispatchAssignment],
  );

  const resetOverrides = useCallback(() => {
    if (!roof?.typeId) return;
    dispatchAssignment(roof.typeId, undefined);
  }, [roof, dispatchAssignment]);

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

  const countRoofsOfType = useCallback(
    (typeId: string): number => {
      if (!levelManager.currentLevelId) return 0;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      return scene ? findRoofsByTypeId(scene, typeId).length : 0;
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
    (typeId: string, nextTypeParams: RoofTypeParams) => {
      if (!service) return;
      const current = asRoofFamilyType(getType(typeId));
      if (!current) return;
      const deps: RoofFamilyTypeMutationDeps = {
        getTypes: () => useBimFamilyTypeStore.getState().getTypes(),
        setTypes: (types) => useBimFamilyTypeStore.getState().setTypes(types),
        persist: (typeParams) => {
          void service.updateType(typeId, { typeParams, category: 'roof' });
        },
        audit: (from, to) =>
          recordFamilyTypeChange(
            'updated',
            { id: typeId, name: current.name, category: 'roof', typeParams: to },
            { prevTypeParams: from },
          ),
        notifyChanged: () => EventBus.emit('bim:family-type-changed', { typeId, category: 'roof' }),
      };
      execute(new UpdateRoofFamilyTypeCommand(typeId, nextTypeParams, current.typeParams, deps));
    },
    [service, getType, execute],
  );

  const deleteType = useCallback(
    async (typeId: string) => {
      if (!service || !levelManager.currentLevelId) return;
      const type = asRoofFamilyType(getType(typeId));
      if (!type) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      const affected = scene ? findRoofsByTypeId(scene, typeId) : [];

      const action = await requestFamilyTypeDelete({ typeId, affectedCount: affected.length });
      if (action !== 'delete-and-detach') return;

      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      const detachCommands = affected.map((r) => {
        const { next, previous } = resolveRoofTypeAssignment(r, undefined, undefined, getType);
        return new AssignRoofTypeCommand(r.id, next, previous, sm);
      });

      const deps: RoofFamilyTypeDeleteDeps = {
        getTypes: () => useBimFamilyTypeStore.getState().getTypes(),
        setTypes: (types) => useBimFamilyTypeStore.getState().setTypes(types),
        removePersist: () => { void service.deleteType(typeId); },
        restorePersist: () => { void service.restoreType(type); },
        auditDeleted: () =>
          recordFamilyTypeChange('deleted', {
            id: type.id, name: type.name, category: 'roof', typeParams: type.typeParams,
          }),
        auditRestored: () =>
          recordFamilyTypeChange('created', {
            id: type.id, name: type.name, category: 'roof', typeParams: type.typeParams,
          }),
      };
      execute(createDeleteRoofFamilyTypeCommand(type, detachCommands, deps));
    },
    [service, getType, levelManager, execute],
  );

  return {
    roof,
    roofTypes,
    currentType,
    overriddenKeys,
    canWrite: !!service,
    assignType,
    setOverride,
    clearOverride,
    resetOverrides,
    duplicateCurrent,
    renameType,
    countRoofsOfType,
    updateTypeParams,
    deleteType,
  };
}
