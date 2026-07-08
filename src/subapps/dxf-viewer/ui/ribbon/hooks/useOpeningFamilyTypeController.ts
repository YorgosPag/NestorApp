'use client';

/**
 * ADR-421 SLICE C — controller for the contextual Opening «Family Type» ribbon
 * widget.
 *
 * Thin binding of the generic `useFamilyTypeController` core (ADR-604 Φ3) to the
 * opening bindings, re-mapped to the opening-named public API the widget consumes.
 * The opening variant already used the category-agnostic `UpdateFamilyTypeCommand`
 * / `createDeleteFamilyTypeCommand` — kept as-is via the injected command factories.
 *
 * @see ./create-family-type-controller.ts — shared core (ADR-604)
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md
 */

import { AssignOpeningTypeCommand } from '../../../core/commands/entity-commands/AssignOpeningTypeCommand';
import { UpdateFamilyTypeCommand } from '../../../core/commands/entity-commands/UpdateFamilyTypeCommand';
import { createDeleteFamilyTypeCommand } from '../../../core/commands/entity-commands/DeleteFamilyTypeCommand';
import { findOpeningsByTypeId } from '../../../bim/family-types/family-type-side-effects';
import { isOpeningEntity } from '../../../types/entities';
import {
  asOpeningFamilyType,
  getOverriddenOpeningParamKeys,
  listOpeningTypes,
  normaliseOpeningOverrides,
  resolveOpeningTypeAssignment,
} from '../../../bim/family-types/family-type-ui-helpers';
import type { OpeningEntity } from '../../../bim/types/opening-types';
import type { BimFamilyType, OpeningTypeParams } from '../../../bim/types/bim-family-type';
import {
  useFamilyTypeController,
  type FamilyTypeControllerConfig,
} from './create-family-type-controller';

export interface OpeningFamilyTypeController {
  readonly opening: OpeningEntity | null;
  readonly openingTypes: readonly BimFamilyType<'opening'>[];
  readonly currentType: BimFamilyType<'opening'> | null;
  readonly overriddenKeys: readonly (keyof OpeningTypeParams)[];
  readonly canWrite: boolean;
  readonly assignType: (typeId: string | undefined) => void;
  readonly setOverride: <K extends keyof OpeningTypeParams>(key: K, value: OpeningTypeParams[K]) => void;
  readonly clearOverride: (key: keyof OpeningTypeParams) => void;
  readonly resetOverrides: () => void;
  readonly duplicateCurrent: (displayName: string) => Promise<string | null>;
  readonly renameType: (typeId: string, name: string) => Promise<void>;
  readonly countOpeningsOfType: (typeId: string) => number;
  readonly updateTypeParams: (typeId: string, nextTypeParams: OpeningTypeParams) => void;
  readonly deleteType: (typeId: string) => Promise<void>;
}

const OPENING_CONFIG: FamilyTypeControllerConfig<'opening', OpeningEntity> = {
  category: 'opening',
  isEntity: isOpeningEntity,
  listTypes: listOpeningTypes,
  asFamilyType: asOpeningFamilyType,
  getOverriddenParamKeys: getOverriddenOpeningParamKeys,
  normaliseOverrides: normaliseOpeningOverrides,
  findByTypeId: findOpeningsByTypeId,
  makeAssignCommand: (entity, typeId, overrides, sceneManager, getType) => {
    const { next, previous } = resolveOpeningTypeAssignment(entity, typeId, overrides, getType);
    return new AssignOpeningTypeCommand(entity.id, next, previous, sceneManager);
  },
  makeUpdateCommand: (typeId, next, previous, deps) =>
    new UpdateFamilyTypeCommand<OpeningTypeParams>(typeId, next, previous, deps),
  makeDeleteCommand: (snapshot, detachCommands, deps) =>
    createDeleteFamilyTypeCommand('DeleteOpeningFamilyType', snapshot, detachCommands, deps),
};

export function useOpeningFamilyTypeController(): OpeningFamilyTypeController {
  // Spread the shared surface; rename only the opening-named fields (zero glue).
  const { entity, types, countOfType, service: _service, ...rest } = useFamilyTypeController(OPENING_CONFIG);
  return { ...rest, opening: entity, openingTypes: types, countOpeningsOfType: countOfType };
}
