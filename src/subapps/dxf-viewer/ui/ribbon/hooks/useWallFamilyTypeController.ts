'use client';

/**
 * ADR-412 Φ4 — controller for the contextual Wall «Family Type» ribbon widgets.
 *
 * Single owner of the type-assignment / override / duplicate / rename logic so
 * the two presentational widgets (`RibbonWallFamilyTypeWidget` selector +
 * `RibbonWallTypePropertiesWidget` override editor) stay thin (N.7.1) and share
 * one SSoT for every mutation.
 *
 * Mutations:
 *   - assign / clear type    → `AssignWallTypeCommand` (undoable, optimistic),
 *   - set / clear override   → same command (re-resolves effective params),
 *   - duplicate (clone-to-edit, Q3) / rename → `BimFamilyTypeService` + optimistic
 *     store update (mirror the MEP «optimistic upsertSystem» idiom).
 *
 * Reads the live catalog from `bim-family-type-store` (the host's
 * `useBimFamilyTypes` is the sole loader). Writes create a private service
 * instance — multiple instances are fine (stateless except a 5-min cache), the
 * optimistic store update keeps the UI in sync without a host re-fetch.
 *
 * @see ../components/RibbonWallFamilyTypeWidget.tsx
 * @see ../components/RibbonWallTypePropertiesWidget.tsx
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.7
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { useCommandHistory } from '../../../core/commands';
import { AssignWallTypeCommand } from '../../../core/commands/entity-commands/AssignWallTypeCommand';
import {
  UpdateWallFamilyTypeCommand,
  type FamilyTypeMutationDeps,
} from '../../../core/commands/entity-commands/UpdateWallFamilyTypeCommand';
import {
  createDeleteWallFamilyTypeCommand,
  type FamilyTypeDeleteDeps,
} from '../../../core/commands/entity-commands/DeleteWallFamilyTypeCommand';
import { EventBus } from '../../../systems/events/EventBus';
import { recordFamilyTypeChange } from '../../../bim/family-types/bim-family-type-audit-client';
import { findWallsByTypeId } from '../../../bim/family-types/family-type-side-effects';
import { requestFamilyTypeDelete } from '../../../bim/family-types/bim-family-type-delete-store';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { isWallEntity } from '../../../types/entities';
import { useBimFamilyTypeStore } from '../../../bim/family-types/bim-family-type-store';
import {
  createBimFamilyTypeService,
  type BimFamilyTypeService,
} from '../../../bim/family-types/bim-family-type-service';
import { cloneTypeToInput } from '../../../bim/family-types/built-in-types';
import {
  asWallFamilyType,
  getOverriddenParamKeys,
  listWallTypes,
  normaliseOverrides,
  resolveWallTypeAssignment,
} from '../../../bim/family-types/family-type-ui-helpers';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { BimFamilyType, WallTypeParams } from '../../../bim/types/bim-family-type';

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
   * Returns the new type's id (or `null` when unavailable) so callers can chain
   * a «Duplicate & edit» flow (ADR-412 Φ5).
   */
  readonly duplicateCurrent: (displayName: string) => Promise<string | null>;
  /** Rename a (user) type. Built-ins are read-only — guard in the UI. */
  readonly renameType: (typeId: string, name: string) => Promise<void>;
  /**
   * Edit a (user) type's `typeParams` (thickness / dna / material / category) —
   * re-flows to every instance, all floors. Undoable. Built-ins are read-only
   * (the UI must Duplicate first). ADR-412 Φ5.
   */
  readonly updateTypeParams: (typeId: string, nextTypeParams: WallTypeParams) => void;
  /**
   * Delete a (user) type: warn → confirm → detach current-scene instances
   * (non-destructive, Q6) + delete the type. Single undoable op. Built-ins are
   * read-only (guard in the UI). ADR-412 Φ5.
   */
  readonly deleteType: (typeId: string) => Promise<void>;
}

export function useWallFamilyTypeController(): WallFamilyTypeController {
  const { user } = useAuth();
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();
  const { execute } = useCommandHistory();

  // Reactive catalog snapshot + stable lookup.
  const byId = useBimFamilyTypeStore((s) => s.byId);
  const getType = useBimFamilyTypeStore((s) => s.getType);
  const wallTypes = useMemo(() => listWallTypes(Array.from(byId.values())), [byId]);

  const service: BimFamilyTypeService | null = useMemo(
    () =>
      user?.companyId && user?.uid
        ? createBimFamilyTypeService({ companyId: user.companyId, userId: user.uid })
        : null,
    [user?.companyId, user?.uid],
  );

  const wall = useMemo<WallEntity | null>(() => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    const e = scene?.entities.find((x) => x.id === id);
    return e && isWallEntity(e) ? e : null;
    // byId is a dep so the resolved type refreshes when the catalog changes.
  }, [levelManager, universalSelection, byId]);

  const currentType = useMemo(
    () => (wall?.typeId ? asWallFamilyType(getType(wall.typeId)) : null),
    [wall?.typeId, getType, byId],
  );

  const overriddenKeys = useMemo(
    () => getOverriddenParamKeys(wall?.typeOverrides),
    [wall?.typeOverrides],
  );

  // Single dispatch path — resolves effective params and commits one undo step.
  const dispatchAssignment = useCallback(
    (nextTypeId: string | undefined, nextOverrides: Partial<WallTypeParams> | undefined) => {
      if (!wall || !levelManager.currentLevelId) return;
      const { next, previous } = resolveWallTypeAssignment(wall, nextTypeId, nextOverrides, getType);
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      execute(new AssignWallTypeCommand(wall.id, next, previous, sm, wall.kind));
    },
    [wall, levelManager, getType, execute],
  );

  const assignType = useCallback(
    (typeId: string | undefined) => dispatchAssignment(typeId, undefined),
    [dispatchAssignment],
  );

  const setOverride = useCallback(
    <K extends keyof WallTypeParams>(key: K, value: WallTypeParams[K]) => {
      if (!wall?.typeId) return;
      const next = normaliseOverrides({ ...(wall.typeOverrides ?? {}), [key]: value });
      dispatchAssignment(wall.typeId, next);
    },
    [wall, dispatchAssignment],
  );

  const clearOverride = useCallback(
    (key: keyof WallTypeParams) => {
      if (!wall?.typeId) return;
      const rest: Partial<WallTypeParams> = { ...(wall.typeOverrides ?? {}) };
      delete rest[key];
      dispatchAssignment(wall.typeId, normaliseOverrides(rest));
    },
    [wall, dispatchAssignment],
  );

  const resetOverrides = useCallback(() => {
    if (!wall?.typeId) return;
    dispatchAssignment(wall.typeId, undefined);
  }, [wall, dispatchAssignment]);

  const duplicateCurrent = useCallback(
    async (displayName: string): Promise<string | null> => {
      if (!service || !currentType) return null;
      const created = await service.saveType(cloneTypeToInput(currentType, displayName, 'company'));
      const store = useBimFamilyTypeStore.getState();
      store.setTypes([...store.getTypes(), created]); // optimistic — store now resolves the new id
      dispatchAssignment(created.id, undefined);
      return created.id;
    },
    [service, currentType, dispatchAssignment],
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
  // an optimistic catalog `setTypes` (→ free in-scene re-resolution), persists
  // the doc, audits, and emits `bim:family-type-changed` (→ all-floors BOQ
  // re-feed in the persistence host). Built-in guard is the UI's job.
  const updateTypeParams = useCallback(
    (typeId: string, nextTypeParams: WallTypeParams) => {
      if (!service) return;
      const current = asWallFamilyType(getType(typeId));
      if (!current) return;
      const deps: FamilyTypeMutationDeps = {
        getTypes: () => useBimFamilyTypeStore.getState().getTypes(),
        setTypes: (types) => useBimFamilyTypeStore.getState().setTypes(types),
        persist: (typeParams) => {
          void service.updateType(typeId, { typeParams, category: 'wall' });
        },
        audit: (from, to) =>
          recordFamilyTypeChange(
            'updated',
            { id: typeId, name: current.name, category: 'wall', typeParams: to },
            { prevTypeParams: from },
          ),
        notifyChanged: () => EventBus.emit('bim:family-type-changed', { typeId, category: 'wall' }),
      };
      execute(new UpdateWallFamilyTypeCommand(typeId, nextTypeParams, current.typeParams, deps));
    },
    [service, getType, execute],
  );

  // ADR-412 Φ5 Q6 — warn → confirm → detach current-scene instances + delete.
  // Detach reuses AssignWallTypeCommand (typeId→undefined, params kept); the
  // catalog op removes/restores the type. Single undoable CompoundCommand.
  const deleteType = useCallback(
    async (typeId: string) => {
      if (!service || !levelManager.currentLevelId) return;
      const type = asWallFamilyType(getType(typeId));
      if (!type) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      const affected = scene ? findWallsByTypeId(scene, typeId) : [];

      const action = await requestFamilyTypeDelete({ typeId, affectedCount: affected.length });
      if (action !== 'delete-and-detach') return;

      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      const detachCommands = affected.map((w) => {
        const { next, previous } = resolveWallTypeAssignment(w, undefined, undefined, getType);
        return new AssignWallTypeCommand(w.id, next, previous, sm, w.kind);
      });

      const deps: FamilyTypeDeleteDeps = {
        getTypes: () => useBimFamilyTypeStore.getState().getTypes(),
        setTypes: (types) => useBimFamilyTypeStore.getState().setTypes(types),
        removePersist: () => { void service.deleteType(typeId); },
        restorePersist: () => { void service.restoreType(type); },
        auditDeleted: () =>
          recordFamilyTypeChange('deleted', {
            id: type.id, name: type.name, category: 'wall', typeParams: type.typeParams,
          }),
        auditRestored: () =>
          recordFamilyTypeChange('created', {
            id: type.id, name: type.name, category: 'wall', typeParams: type.typeParams,
          }),
      };
      execute(createDeleteWallFamilyTypeCommand(type, detachCommands, deps));
    },
    [service, getType, levelManager, execute],
  );

  return {
    wall,
    wallTypes,
    currentType,
    overriddenKeys,
    canWrite: !!service,
    assignType,
    setOverride,
    clearOverride,
    resetOverrides,
    duplicateCurrent,
    renameType,
    updateTypeParams,
    deleteType,
  };
}
