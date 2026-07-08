'use client';

/**
 * ADR-604 Φ3 — generic BIM «Family Type» ribbon controller core (SSoT).
 *
 * The four `use{Wall,Slab,Roof,Opening}FamilyTypeController` hooks were the same
 * ~290-line algorithm (assign / override / reset / duplicate / rename / count /
 * updateTypeParams / deleteType) differing ONLY in a handful of entity-specific
 * bindings: the category literal, the entity type-guard, the family-type UI
 * helpers, and the per-instance / catalog command classes. This hook owns the
 * algorithm once; each entity supplies a narrow `FamilyTypeControllerConfig` and
 * re-exposes the result under its entity-named public API (zero blast radius on
 * the widgets, dialogs and draw-tool consumers).
 *
 * Design = «shared core + per-instance binding» (composition, NOT a god-config):
 * every config field is a narrow injected function, mirroring ADR-594
 * `createBimEntityPersistenceHook`. The catalog side-effect deps (store / persist
 * / audit / EventBus) are built HERE from `category` + `service` — only the
 * command *construction* is injected so each entity keeps its own tested command
 * (per-entity `Update*/Delete*FamilyTypeCommand`); migrating those to the generic
 * `UpdateFamilyTypeCommand` is a separate, deferred ratchet (shared working tree).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-604-generic-family-type-framework.md
 * @see ../../../core/commands/entity-commands/UpdateFamilyTypeCommand.ts
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { useCommandHistory } from '../../../core/commands';
import type { ICommand } from '../../../core/commands/interfaces';
import type { FamilyTypeMutationDeps } from '../../../core/commands/entity-commands/UpdateFamilyTypeCommand';
import type { FamilyTypeDeleteDeps } from '../../../core/commands/entity-commands/DeleteFamilyTypeCommand';
import { EventBus } from '../../../systems/events/EventBus';
import { recordFamilyTypeChange } from '../../../bim/family-types/bim-family-type-audit-client';
import { requestFamilyTypeDelete } from '../../../bim/family-types/bim-family-type-delete-store';
import {
  createLevelSceneManagerAdapter,
  type LevelSceneManagerAdapter,
} from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { useBimFamilyTypeStore } from '../../../bim/family-types/bim-family-type-store';
import {
  createBimFamilyTypeService,
  type BimFamilyTypeService,
} from '../../../bim/family-types/bim-family-type-service';
import { cloneTypeToInput } from '../../../bim/family-types/built-in-types';
import type { Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';
import type { BimFamilyType, BimTypeParamsByCategory } from '../../../bim/types/bim-family-type';

/** Family-type categories that expose a ribbon controller. */
export type FamilyTypeCategory = keyof BimTypeParamsByCategory;

/** Type-governed catalog lookup (the store's stable `getType`). */
type GetType = (id: string) => BimFamilyType | undefined;

/** Minimal shape every family-typed scene entity satisfies. */
export interface FamilyTypedEntity<P> {
  readonly id: string;
  readonly typeId?: string;
  readonly typeOverrides?: Partial<P>;
}

/**
 * The narrow per-entity bindings the generic controller needs. `P` defaults to
 * the category's type-param payload so callers never spell it out.
 */
export interface FamilyTypeControllerConfig<
  C extends FamilyTypeCategory,
  E extends FamilyTypedEntity<BimTypeParamsByCategory[C]>,
  P = BimTypeParamsByCategory[C],
> {
  /** Persisted category literal (`'wall' | 'slab' | 'roof' | 'opening'`). */
  readonly category: C;
  /** Scene entity type-guard (e.g. `isWallEntity`). */
  readonly isEntity: (entity: Entity) => entity is E;
  /** Category slice of the live catalog (built-in + user), e.g. `listWallTypes`. */
  readonly listTypes: (all: readonly BimFamilyType[]) => readonly BimFamilyType<C>[];
  /** Narrow a catalog entry to this category, or `null` (e.g. `asWallFamilyType`). */
  readonly asFamilyType: (type: BimFamilyType | undefined) => BimFamilyType<C> | null;
  /** Param keys the instance currently overrides (e.g. `getOverriddenParamKeys`). */
  readonly getOverriddenParamKeys: (overrides: Partial<P> | undefined) => readonly (keyof P)[];
  /** Drop empty/default overrides to `undefined` (e.g. `normaliseOverrides`). */
  readonly normaliseOverrides: (overrides: Partial<P>) => Partial<P> | undefined;
  /** Current-scene instances linked to a type id (e.g. `findWallsByTypeId`). */
  readonly findByTypeId: (scene: SceneModel, typeId: string) => readonly E[];
  /**
   * Build the undoable per-instance assign/detach command (resolves effective
   * params + constructs `Assign{X}TypeCommand`). Absorbs per-entity quirks such
   * as the wall command's extra `kind` argument.
   */
  readonly makeAssignCommand: (
    entity: E,
    typeId: string | undefined,
    overrides: Partial<P> | undefined,
    sceneManager: LevelSceneManagerAdapter,
    getType: GetType,
  ) => ICommand;
  /** Build the undoable catalog type-edit command (`Update{X}FamilyTypeCommand`). */
  readonly makeUpdateCommand: (
    typeId: string,
    next: P,
    previous: P,
    deps: FamilyTypeMutationDeps<P>,
  ) => ICommand;
  /** Build the single-undo delete-with-detach command (`createDelete{X}…`). */
  readonly makeDeleteCommand: (
    snapshot: BimFamilyType,
    detachCommands: readonly ICommand[],
    deps: FamilyTypeDeleteDeps,
  ) => ICommand;
}

/** The generic controller surface each entity wrapper re-maps to its named API. */
export interface FamilyTypeControllerCore<
  C extends FamilyTypeCategory,
  E,
  P = BimTypeParamsByCategory[C],
> {
  readonly entity: E | null;
  readonly types: readonly BimFamilyType<C>[];
  readonly currentType: BimFamilyType<C> | null;
  readonly overriddenKeys: readonly (keyof P)[];
  readonly canWrite: boolean;
  /** Auth-ready catalog service (null when signed-out). For wrapper extras. */
  readonly service: BimFamilyTypeService | null;
  readonly assignType: (typeId: string | undefined) => void;
  readonly setOverride: <K extends keyof P>(key: K, value: P[K]) => void;
  readonly clearOverride: (key: keyof P) => void;
  readonly resetOverrides: () => void;
  readonly duplicateCurrent: (displayName: string) => Promise<string | null>;
  readonly renameType: (typeId: string, name: string) => Promise<void>;
  readonly countOfType: (typeId: string) => number;
  readonly updateTypeParams: (typeId: string, nextTypeParams: P) => void;
  readonly deleteType: (typeId: string) => Promise<void>;
}

/**
 * Generic controller. Bind it with a per-entity `config` module constant and wrap
 * the result in a `use{Entity}FamilyTypeController` that re-maps `entity`/`types`
 * to the entity-named fields the existing consumers expect.
 */
export function useFamilyTypeController<
  C extends FamilyTypeCategory,
  E extends FamilyTypedEntity<BimTypeParamsByCategory[C]>,
>(config: FamilyTypeControllerConfig<C, E>): FamilyTypeControllerCore<C, E> {
  type P = BimTypeParamsByCategory[C];

  const { user } = useAuth();
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();
  const { execute } = useCommandHistory();

  // Reactive catalog snapshot + stable lookup.
  const byId = useBimFamilyTypeStore((s) => s.byId);
  const getType = useBimFamilyTypeStore((s) => s.getType);
  const types = useMemo(() => config.listTypes(Array.from(byId.values())), [byId, config]);

  const service: BimFamilyTypeService | null = useMemo(
    () =>
      user?.companyId && user?.uid
        ? createBimFamilyTypeService({ companyId: user.companyId, userId: user.uid })
        : null,
    [user?.companyId, user?.uid],
  );

  const entity = useMemo<E | null>(() => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    const e = scene?.entities.find((x) => x.id === id);
    return e && config.isEntity(e) ? e : null;
    // byId is a dep so the resolved type refreshes when the catalog changes.
  }, [levelManager, universalSelection, byId, config]);

  const currentType = useMemo(
    () => (entity?.typeId ? config.asFamilyType(getType(entity.typeId)) : null),
    [entity?.typeId, getType, byId, config],
  );

  const overriddenKeys = useMemo(
    () => config.getOverriddenParamKeys(entity?.typeOverrides),
    [entity?.typeOverrides, config],
  );

  // Single dispatch path — one undo step per assignment/override change.
  const dispatchAssignment = useCallback(
    (nextTypeId: string | undefined, nextOverrides: Partial<P> | undefined) => {
      if (!entity || !levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      execute(config.makeAssignCommand(entity, nextTypeId, nextOverrides, sm, getType));
    },
    [entity, levelManager, getType, execute, config],
  );

  const assignType = useCallback(
    (typeId: string | undefined) => dispatchAssignment(typeId, undefined),
    [dispatchAssignment],
  );

  const setOverride = useCallback(
    <K extends keyof P>(key: K, value: P[K]) => {
      if (!entity?.typeId) return;
      const next = config.normaliseOverrides({
        ...(entity.typeOverrides ?? {}),
        [key]: value,
      } as Partial<P>);
      dispatchAssignment(entity.typeId, next);
    },
    [entity, dispatchAssignment, config],
  );

  const clearOverride = useCallback(
    (key: keyof P) => {
      if (!entity?.typeId) return;
      const rest: Partial<P> = { ...(entity.typeOverrides ?? {}) };
      delete rest[key];
      dispatchAssignment(entity.typeId, config.normaliseOverrides(rest));
    },
    [entity, dispatchAssignment, config],
  );

  const resetOverrides = useCallback(() => {
    if (!entity?.typeId) return;
    dispatchAssignment(entity.typeId, undefined);
  }, [entity, dispatchAssignment]);

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

  const countOfType = useCallback(
    (typeId: string): number => {
      if (!levelManager.currentLevelId) return 0;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      return scene ? config.findByTypeId(scene, typeId).length : 0;
    },
    [levelManager, config],
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

  // ADR-412 Φ5 — edit the type's params as one undoable op. The command applies
  // an optimistic catalog `setTypes` (→ free in-scene re-resolution), persists the
  // doc, audits, and emits `bim:family-type-changed` (→ all-floors BOQ re-feed).
  // Built-in guard is the UI's job.
  const updateTypeParams = useCallback(
    (typeId: string, nextTypeParams: P) => {
      if (!service) return;
      const current = config.asFamilyType(getType(typeId));
      if (!current) return;
      const deps: FamilyTypeMutationDeps<P> = {
        getTypes: () => useBimFamilyTypeStore.getState().getTypes(),
        setTypes: (t) => useBimFamilyTypeStore.getState().setTypes(t),
        persist: (typeParams) => {
          void service.updateType(typeId, { typeParams, category: config.category });
        },
        audit: (from, to) =>
          recordFamilyTypeChange(
            'updated',
            { id: typeId, name: current.name, category: config.category, typeParams: to },
            { prevTypeParams: from },
          ),
        notifyChanged: () =>
          EventBus.emit('bim:family-type-changed', { typeId, category: config.category }),
      };
      execute(config.makeUpdateCommand(typeId, nextTypeParams, current.typeParams, deps));
    },
    [service, getType, execute, config],
  );

  // ADR-412 Φ5 Q6 — warn → confirm → detach current-scene instances + delete.
  // Detach reuses the per-instance assign command (typeId→undefined, params kept);
  // the catalog op removes/restores the type. Single undoable CompoundCommand.
  const deleteType = useCallback(
    async (typeId: string) => {
      if (!service || !levelManager.currentLevelId) return;
      const type = config.asFamilyType(getType(typeId));
      if (!type) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      const affected = scene ? config.findByTypeId(scene, typeId) : [];

      const action = await requestFamilyTypeDelete({ typeId, affectedCount: affected.length });
      if (action !== 'delete-and-detach') return;

      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      const detachCommands = affected.map((e) =>
        config.makeAssignCommand(e, undefined, undefined, sm, getType),
      );

      const deps: FamilyTypeDeleteDeps = {
        getTypes: () => useBimFamilyTypeStore.getState().getTypes(),
        setTypes: (t) => useBimFamilyTypeStore.getState().setTypes(t),
        removePersist: () => {
          void service.deleteType(typeId);
        },
        restorePersist: () => {
          void service.restoreType(type);
        },
        auditDeleted: () =>
          recordFamilyTypeChange('deleted', {
            id: type.id,
            name: type.name,
            category: config.category,
            typeParams: type.typeParams,
          }),
        auditRestored: () =>
          recordFamilyTypeChange('created', {
            id: type.id,
            name: type.name,
            category: config.category,
            typeParams: type.typeParams,
          }),
      };
      execute(config.makeDeleteCommand(type, detachCommands, deps));
    },
    [service, getType, levelManager, execute, config],
  );

  return {
    entity,
    types,
    currentType,
    overriddenKeys,
    canWrite: !!service,
    service,
    assignType,
    setOverride,
    clearOverride,
    resetOverrides,
    duplicateCurrent,
    renameType,
    countOfType,
    updateTypeParams,
    deleteType,
  };
}
