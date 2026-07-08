'use client';

/**
 * ADR-412 — controller for the contextual Slab «Family Type» ribbon widget.
 *
 * Thin binding of the generic `useFamilyTypeController` core (ADR-603 Φ3) to the
 * slab bindings, re-mapped to the slab-named public API the widget consumes.
 *
 * @see ./create-family-type-controller.ts — shared core (ADR-603)
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import { AssignSlabTypeCommand } from '../../../core/commands/entity-commands/AssignSlabTypeCommand';
import { UpdateSlabFamilyTypeCommand } from '../../../core/commands/entity-commands/UpdateSlabFamilyTypeCommand';
import { createDeleteSlabFamilyTypeCommand } from '../../../core/commands/entity-commands/DeleteSlabFamilyTypeCommand';
import { findSlabsByTypeId } from '../../../bim/family-types/family-type-side-effects';
import { isSlabEntity } from '../../../types/entities';
import {
  asSlabFamilyType,
  getOverriddenSlabParamKeys,
  listSlabTypes,
  normaliseSlabOverrides,
  resolveSlabTypeAssignment,
} from '../../../bim/family-types/family-type-ui-helpers';
import type { SlabEntity } from '../../../bim/types/slab-types';
import type { BimFamilyType, SlabTypeParams } from '../../../bim/types/bim-family-type';
import {
  useFamilyTypeController,
  type FamilyTypeControllerConfig,
} from './create-family-type-controller';

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

const SLAB_CONFIG: FamilyTypeControllerConfig<'slab', SlabEntity> = {
  category: 'slab',
  isEntity: isSlabEntity,
  listTypes: listSlabTypes,
  asFamilyType: asSlabFamilyType,
  getOverriddenParamKeys: getOverriddenSlabParamKeys,
  normaliseOverrides: normaliseSlabOverrides,
  findByTypeId: findSlabsByTypeId,
  makeAssignCommand: (entity, typeId, overrides, sceneManager, getType) => {
    const { next, previous } = resolveSlabTypeAssignment(entity, typeId, overrides, getType);
    return new AssignSlabTypeCommand(entity.id, next, previous, sceneManager);
  },
  makeUpdateCommand: (typeId, next, previous, deps) =>
    new UpdateSlabFamilyTypeCommand(typeId, next, previous, deps),
  makeDeleteCommand: (snapshot, detachCommands, deps) =>
    createDeleteSlabFamilyTypeCommand(snapshot, detachCommands, deps),
};

export function useSlabFamilyTypeController(): SlabFamilyTypeController {
  const core = useFamilyTypeController(SLAB_CONFIG);
  return {
    slab: core.entity,
    slabTypes: core.types,
    currentType: core.currentType,
    overriddenKeys: core.overriddenKeys,
    canWrite: core.canWrite,
    assignType: core.assignType,
    setOverride: core.setOverride,
    clearOverride: core.clearOverride,
    resetOverrides: core.resetOverrides,
    duplicateCurrent: core.duplicateCurrent,
    renameType: core.renameType,
    updateTypeParams: core.updateTypeParams,
    deleteType: core.deleteType,
    countSlabsOfType: core.countOfType,
  };
}
