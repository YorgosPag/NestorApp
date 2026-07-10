/**
 * @module bim/services/boq-base-row
 * @description SSoT for the ~30 default fields shared by every BIM-generated BOQ row.
 *
 * `BimToBoqBridge`, `boq-multi-layer-builder`, `structural-finish-boq`,
 * `envelope-boq-sync`, `opening-boq-grouper` and `stair-boq-sync` each stamped
 * the identical constant block onto every row they emit — company/project/building
 * + floor scope, the `null` link fields, the zero costs, `source: 'bim-auto'`,
 * `status: 'draft'`, `qaStatus: 'pending'`, timestamps, `sourceType`/`sourceEntity*`.
 * This owns that block once; callers spread it and add only the varying fields
 * (category / title / unit / quantity / grouping).
 *
 * @see ../config/bim-to-atoe-mapping.ts (BimEntityType)
 * @see @/types/boq (BOQItem)
 */

import type { BOQItem } from '@/types/boq';
import { nowISO } from '@/lib/date-local';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import type { AtoeMappingEntry } from '../config/bim-to-atoe-mapping';

/**
 * The entity-type discriminant stamped on a BOQ row's `sourceEntityType`. Wider
 * than `BimEntityType` — a few sources (`envelope`) are not first-class BIM
 * entities but still emit rows.
 */
export type BoqSourceEntityType = BOQItem['sourceEntityType'];

/**
 * Minimal context the base row reads. Both `MultiLayerBuildContext` and
 * `BimBoqContext` structurally satisfy it (company/project/building + optional
 * floor link).
 */
export interface BoqBaseRowContext {
  readonly companyId: string;
  readonly projectId: string;
  readonly buildingId: string;
  /** ADR-395 Phase 1 (G7) — floor link → `linkedFloorId` + `scope: 'floor'`. */
  readonly floorId?: string;
}

/**
 * A built BOQ row ready for `setDoc` (id + Firestore-sanitized payload). The SSoT
 * home for the shape shared by the multi-layer / finish group builders.
 */
export interface BuiltBoqRow {
  readonly id: string;
  /** Sanitized for Firestore setDoc (no undefined). */
  readonly payload: Record<string, unknown>;
}

/** The subset of `BOQItem` fields the base row fills (constant defaults + context/source). */
export type BoqBaseRow = Pick<BOQItem,
  'id' | 'companyId' | 'projectId' | 'buildingId' | 'scope' |
  'linkedFloorId' | 'linkedUnitId' | 'linkedUnitIds' |
  'costAllocationMethod' | 'customAllocations' |
  'subCategoryCode' | 'description' |
  'actualQuantity' | 'wasteFactor' | 'wastePolicy' |
  'materialUnitCost' | 'laborUnitCost' | 'equipmentUnitCost' | 'priceAuthority' |
  'linkedPhaseId' | 'linkedTaskId' | 'linkedInvoiceId' | 'linkedContractorId' |
  'source' | 'measurementMethod' | 'status' | 'qaStatus' |
  'notes' | 'createdBy' | 'approvedBy' |
  'createdAt' | 'updatedAt' |
  'sourceType' | 'sourceEntityId' | 'sourceEntityType' | 'detached'
>;

/**
 * Build the base BOQ row (all default fields plus category/quantity/grouping).
 * The SSoT for the ~40 default fields (N.0.2 — avoids the duplicated block).
 */
export function buildBoqBaseRow(
  id: string,
  context: BoqBaseRowContext,
  entityId: string,
  entityType: BoqSourceEntityType,
  existingCreatedAt: string | null,
): BoqBaseRow {
  const now = nowISO();
  return {
    id,
    companyId: context.companyId,
    projectId: context.projectId,
    buildingId: context.buildingId,
    scope: context.floorId ? 'floor' : 'building',
    linkedFloorId: context.floorId ?? null,
    linkedUnitId: null,
    linkedUnitIds: null,
    costAllocationMethod: 'by_area',
    customAllocations: null,
    subCategoryCode: null,
    description: null,
    actualQuantity: null,
    wasteFactor: 0,
    wastePolicy: 'inherited',
    materialUnitCost: 0,
    laborUnitCost: 0,
    equipmentUnitCost: 0,
    priceAuthority: 'master',
    linkedPhaseId: null,
    linkedTaskId: null,
    linkedInvoiceId: null,
    linkedContractorId: null,
    source: 'bim-auto',
    measurementMethod: 'bim',
    status: 'draft',
    qaStatus: 'pending',
    notes: null,
    createdBy: null,
    approvedBy: null,
    createdAt: existingCreatedAt ?? now,
    updatedAt: now,
    sourceType: 'bim-auto',
    sourceEntityId: entityId,
    sourceEntityType: entityType,
    detached: null,
  };
}

/**
 * Build a full single-entity BOQ row: the base defaults + the ATOE mapping
 * (category / title / unit) + the measured quantity, with no grouping/material
 * link. Firestore-sanitized (`stripUndefinedDeep`). The shared shape for every
 * "one BIM entity → one BOQ row" sync (bridge single-entry, stair, envelope, …).
 */
export function buildSingleEntityBoqRow(
  id: string,
  context: BoqBaseRowContext,
  entityId: string,
  entityType: BoqSourceEntityType,
  mapping: AtoeMappingEntry,
  quantity: number,
  existingCreatedAt: string | null,
): Record<string, unknown> {
  const base = buildBoqBaseRow(id, context, entityId, entityType, existingCreatedAt);
  const payload: BOQItem = {
    ...base,
    categoryCode: mapping.categoryCode,
    title: mapping.titleEL,
    unit: mapping.unit,
    estimatedQuantity: quantity,
    parentBoqItemId: null,
    isGroupParent: null,
    layerIndex: null,
    materialId: null,
  };
  return stripUndefinedDeep(payload as unknown as Record<string, unknown>);
}

/**
 * Build the **group-parent** summary row (`isGroupParent: true`, no material/layer
 * link) shared by the multi-layer wall builder and the structural-finish builder.
 * The parent carries the whole-entity quantity; children are appended by the caller.
 */
export function buildGroupParentBoqRow(
  parentId: string,
  context: BoqBaseRowContext,
  entityId: string,
  entityType: BoqSourceEntityType,
  mapping: AtoeMappingEntry,
  quantity: number,
  existingCreatedAt: string | null,
): BuiltBoqRow {
  const base = buildBoqBaseRow(parentId, context, entityId, entityType, existingCreatedAt);
  const parentItem: BOQItem = {
    ...base,
    categoryCode: mapping.categoryCode,
    title: mapping.titleEL,
    unit: mapping.unit,
    estimatedQuantity: quantity,
    parentBoqItemId: null,
    isGroupParent: true,
    layerIndex: null,
    materialId: null,
  };
  return {
    id: parentId,
    payload: stripUndefinedDeep(parentItem as unknown as Record<string, unknown>),
  };
}
