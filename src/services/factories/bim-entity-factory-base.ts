/**
 * BIM Entity Factory Base (ADR-592) — shared factory primitives SSoT
 *
 * Every BIM entity factory (`beam` / `column` / `slab` / `wall` / `roof` /
 * `foundation` / all mep-* / furniture / floorplan-symbol / …) accepted the SAME
 * common override + tenant input fields and closed with the SAME conditional
 * pass-through tail. Those two blocks were copy-pasted byte-identically across
 * 23 factories.
 *
 * This module owns them once (big-player "shared primitive + per-instance
 * binding"). Each factory keeps ONLY its genuinely per-type parts: the `type` /
 * `ifcType` literal, the `generateXId` generator, and the `resolveXParams`
 * defaults/validation. No God-shell — the divergent `building` / `floor`
 * factories (top-level Firestore, non-BIM) do NOT use this base.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-592-bim-entity-factory-base-ssot.md
 */

import { generateIfcGuid } from '@/services/enterprise-id-convenience';
import {
  makeBimValidation,
  type BimEntity,
  type BimValidation,
} from '@/subapps/dxf-viewer/bim/types/bim-base';
import type {
  IfcEntityMixin,
  IfcPropertySet,
} from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

/**
 * Optional `BaseEntity` pass-through fields shared by every BIM entity factory.
 * Each is spread onto the entity only when the caller provides it.
 */
export interface BimEntityCommonFields {
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional sparse IFC Property Sets payload. */
  pset?: IfcPropertySet;
  /** Optional tenant fields — pass-through. */
  companyId?: string;
  projectId?: string;
  buildingId?: string;
  floorplanId?: string;
  floorId?: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Common `CreateXInput` fields shared by every BIM entity factory. Concrete
 * factories extend this and add their own `params` + `geometry`.
 */
export interface CreateBimEntityInputBase extends BimEntityCommonFields {
  /** Required: BaseEntity stable layer id (ADR-358 Phase 9E-6e). */
  layerId: string;
  /** Optional override (test-only). Default = enterprise entity ID. */
  id?: string;
  /** Optional override (test-only). Default = generateIfcGuid(). */
  ifcGuid?: string;
  /** Optional validation block. Default = empty BimValidation. */
  validation?: BimValidation;
}

/**
 * The byte-identical assembly tail: spread each optional `BaseEntity` /
 * tenant field onto the entity only when present. Callers do:
 *
 *   const entity: BeamEntity = {
 *     id: input.id ?? generateBeamId(),
 *     type: 'beam', kind: params.kind, layerId: input.layerId, params,
 *     geometry: input.geometry,
 *     validation: input.validation ?? makeBimValidation(),
 *     ifcGuid: input.ifcGuid ?? generateIfcGuid(),
 *     ifcType: 'IfcBeam',
 *     ...spreadBimEntityCommonFields(input),
 *   };
 */
export function spreadBimEntityCommonFields(input: BimEntityCommonFields): Partial<{
  visible: boolean;
  pset: IfcPropertySet;
  companyId: string;
  projectId: string;
  buildingId: string;
  floorplanId: string;
  floorId: string;
  createdBy: string;
  updatedBy: string;
}> {
  return {
    ...(input.visible !== undefined && { visible: input.visible }),
    ...(input.pset !== undefined && { pset: input.pset }),
    ...(input.companyId !== undefined && { companyId: input.companyId }),
    ...(input.projectId !== undefined && { projectId: input.projectId }),
    ...(input.buildingId !== undefined && { buildingId: input.buildingId }),
    ...(input.floorplanId !== undefined && { floorplanId: input.floorplanId }),
    ...(input.floorId !== undefined && { floorId: input.floorId }),
    ...(input.createdBy !== undefined && { createdBy: input.createdBy }),
    ...(input.updatedBy !== undefined && { updatedBy: input.updatedBy }),
  };
}

// =============================================================================
// ENTITY ASSEMBLER
// =============================================================================

/**
 * The genuinely per-type discriminant + geometry passed to {@link assembleBimEntity}.
 * `params` is already resolved by the caller (per-type defaults / validation).
 */
export interface BimEntityCore<
  TType extends string,
  TKind extends string,
  TParams,
  TGeometry,
  TIfc extends string,
> {
  readonly type: TType;
  readonly kind: TKind;
  readonly layerId: string;
  readonly params: TParams;
  readonly geometry: TGeometry;
  readonly ifcType: TIfc;
  /** Per-type enterprise ID generator (used only when `id` override absent). */
  readonly generateId: () => string;
}

/**
 * Assemble a fully-typed BIM entity from its per-type discriminants + the shared
 * override / tenant input. Owns the byte-identical assembly core once:
 * `id ?? generateId()`, `validation ?? makeBimValidation()`,
 * `ifcGuid ?? generateIfcGuid()`, plus the common-field spread. Callers that
 * carry extra per-type fields (e.g. `typeId`, `hostedOpeningIds`) spread them
 * onto the result.
 */
export function assembleBimEntity<
  TType extends string,
  TKind extends string,
  TParams,
  TGeometry,
  TIfc extends string,
>(
  core: BimEntityCore<TType, TKind, TParams, TGeometry, TIfc>,
  input: CreateBimEntityInputBase,
): BimEntity<TKind, TParams, TGeometry> &
  IfcEntityMixin & { readonly type: TType; readonly ifcType: TIfc } {
  return {
    id: input.id ?? core.generateId(),
    type: core.type,
    kind: core.kind,
    layerId: core.layerId,
    params: core.params,
    geometry: core.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: core.ifcType,
    ...spreadBimEntityCommonFields(input),
  };
}
