/**
 * Opening Factory (ADR-369 §9 Q8) — Phase A5
 *
 * Pure factory function για δημιουργία `OpeningEntity` με IfcEntityMixin
 * auto-population (ifcGuid + ifcType inferred από kind).
 * Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`       : enterprise opening ID (prefix 'opening')
 *   - `ifcGuid`  : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`  : inferred από kind:
 *       door / sliding-door / french-door → 'IfcDoor'
 *       window / fixed                    → 'IfcWindow'
 *   - `validation`: empty `BimValidation` shell
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q8
 */

import { generateOpeningId } from '@/services/enterprise-id-convenience';
import type {
  OpeningEntity,
  OpeningGeometry,
  OpeningKind,
  OpeningParams,
} from '@/subapps/dxf-viewer/bim/types/opening-types';
import type { OpeningTypeParams } from '@/subapps/dxf-viewer/bim/types/bim-family-type';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';
import { resolveOperationType } from '@/subapps/dxf-viewer/bim/types/opening-operation-types';
import { isWindowKind } from '@/subapps/dxf-viewer/bim/types/opening-types';

export interface CreateOpeningInput extends CreateBimEntityInputBase {
  /** Required: param block. */
  params: OpeningParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: OpeningGeometry;
  /** ADR-421 SLICE C — optional Family/Type link (FK → BimFamilyType.id). */
  typeId?: string;
  /** ADR-421 SLICE C — optional per-instance overrides of type-level params. */
  typeOverrides?: Partial<OpeningTypeParams>;
}

/**
 * Maps OpeningKind to IFC4 class via the `isWindowKind` SSoT
 * (`opening-types.ts`). All window families (window/fixed/double-hung/sliding/
 * awning/hopper/tilt-turn/bay) → IfcWindow· all door families (incl. glazed
 * french-door) → IfcDoor.
 */
export function inferOpeningIfcType(kind: OpeningKind): 'IfcDoor' | 'IfcWindow' {
  return isWindowKind(kind) ? 'IfcWindow' : 'IfcDoor';
}

/**
 * Παράγει νέο `OpeningEntity` με IfcEntityMixin auto-fill.
 *
 * @example
 * createOpening({ params: { kind:'door', wallId:'wall_x', offsetFromStart:500,
 *   width:900, height:2100, sillHeight:0 }, geometry, layerId:'lyr_x' });
 * // → ifcType='IfcDoor', ifcGuid=22-char UUID
 *
 * createOpening({ params: { kind:'window', ... }, geometry, layerId:'lyr_x' });
 * // → ifcType='IfcWindow'
 */
export function createOpening(input: CreateOpeningInput): OpeningEntity {
  // ADR-421 §A2 — auto-fill explicit IFC operation (idempotent· respects caller).
  const params: OpeningParams = {
    ...input.params,
    operationType:
      input.params.operationType ??
      resolveOperationType(input.params.kind, input.params.handing),
  };
  return {
    ...assembleBimEntity(
      {
        type: 'opening',
        kind: params.kind,
        layerId: input.layerId,
        params,
        geometry: input.geometry,
        ifcType: inferOpeningIfcType(input.params.kind),
        generateId: generateOpeningId,
      },
      input,
    ),
    ...(input.typeId !== undefined && { typeId: input.typeId }),
    ...(input.typeOverrides !== undefined && { typeOverrides: input.typeOverrides }),
  };
}

// Re-export for caller convenience (test ergonomics).
export type { OpeningKind };
