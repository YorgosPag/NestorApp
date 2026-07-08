'use client';

/**
 * ADR-417 §10 #3 — controller for the contextual Roof «Family Type» ribbon widget.
 *
 * Thin binding of the generic `useFamilyTypeController` core (ADR-604 Φ3) to the
 * roof bindings, re-mapped to the roof-named public API the widget consumes.
 *
 * @see ./create-family-type-controller.ts — shared core (ADR-604)
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10 #3
 */

import { AssignRoofTypeCommand } from '../../../core/commands/entity-commands/AssignRoofTypeCommand';
import { UpdateRoofFamilyTypeCommand } from '../../../core/commands/entity-commands/UpdateRoofFamilyTypeCommand';
import { createDeleteRoofFamilyTypeCommand } from '../../../core/commands/entity-commands/DeleteRoofFamilyTypeCommand';
import { findRoofsByTypeId } from '../../../bim/family-types/family-type-side-effects';
import { isRoofEntity } from '../../../types/entities';
import {
  asRoofFamilyType,
  getOverriddenRoofParamKeys,
  listRoofTypes,
  normaliseRoofOverrides,
  resolveRoofTypeAssignment,
} from '../../../bim/family-types/family-type-ui-helpers';
import type { RoofEntity } from '../../../bim/types/roof-types';
import type { BimFamilyType, RoofTypeParams } from '../../../bim/types/bim-family-type';
import {
  useFamilyTypeController,
  type FamilyTypeControllerConfig,
} from './create-family-type-controller';

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

const ROOF_CONFIG: FamilyTypeControllerConfig<'roof', RoofEntity> = {
  category: 'roof',
  isEntity: isRoofEntity,
  listTypes: listRoofTypes,
  asFamilyType: asRoofFamilyType,
  getOverriddenParamKeys: getOverriddenRoofParamKeys,
  normaliseOverrides: normaliseRoofOverrides,
  findByTypeId: findRoofsByTypeId,
  makeAssignCommand: (entity, typeId, overrides, sceneManager, getType) => {
    const { next, previous } = resolveRoofTypeAssignment(entity, typeId, overrides, getType);
    return new AssignRoofTypeCommand(entity.id, next, previous, sceneManager);
  },
  makeUpdateCommand: (typeId, next, previous, deps) =>
    new UpdateRoofFamilyTypeCommand(typeId, next, previous, deps),
  makeDeleteCommand: (snapshot, detachCommands, deps) =>
    createDeleteRoofFamilyTypeCommand(snapshot, detachCommands, deps),
};

export function useRoofFamilyTypeController(): RoofFamilyTypeController {
  // Spread the shared surface; rename only the roof-named fields (zero glue).
  const { entity, types, countOfType, service: _service, ...rest } = useFamilyTypeController(ROOF_CONFIG);
  return { ...rest, roof: entity, roofTypes: types, countRoofsOfType: countOfType };
}
