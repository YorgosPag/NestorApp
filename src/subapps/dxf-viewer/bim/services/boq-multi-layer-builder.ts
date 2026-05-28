/**
 * Multi-Layer BOQ Payload Builder (ADR-363 Phase 6.1)
 *
 * Pure factory: από wall με `WallDna.layers.length > 1`, παράγει 1 parent
 * summary item + N child rows (1 per layer). Idempotent — ίδια inputs δίνουν
 * ίδια output IDs + payloads (deterministic ID strategy).
 *
 * Industry pattern: Revit Material Takeoff Schedule, ArchiCAD Interactive
 * Schedule, Allplan Quantity Takeoff Report — όλοι παράγουν per-layer
 * (ή per-component) rows με ξεχωριστή ποσότητα + κατηγορία υλικού.
 *
 * Quantity derivation per-layer:
 *   - quantityKind='area'   → `wallNetArea (m²)` — single-side count
 *   - quantityKind='volume' → `wallNetArea × thickness_mm / 1000 (m³)`
 *
 * Deterministic IDs:
 *   - parent:   `boq_bim_${entityId}`           (ίδιο με single-entry — back-compat)
 *   - children: `boq_bim_${entityId}_layer_${layerId}`
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6.1
 * @see docs/centralized-systems/reference/adrs/SPEC-3D-004D-genarc-geometry-helpers-port-catalog.md §12 Q4
 */

import type { BOQItem } from '@/types/boq';
import { nowISO } from '@/lib/date-local';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import type { WallDna, WallDnaLayer } from '../types/wall-dna-types';
import type { AtoeMappingEntry, BimEntityType } from '../config/bim-to-atoe-mapping';
import {
  resolveMaterialAtoeMapping,
  type MaterialAtoeMapping,
} from '../config/material-to-atoe-mapping';

// ============================================================================
// TYPES
// ============================================================================

export interface MultiLayerBuildContext {
  readonly companyId: string;
  readonly projectId: string;
  readonly buildingId: string;
  /** ADR-395 Phase 1 (G7) — floor link → `linkedFloorId` + `scope: 'floor'`. */
  readonly floorId?: string;
}

export interface MultiLayerBuildInput {
  readonly entityId: string;
  readonly entityType: BimEntityType;
  readonly dna: WallDna;
  /** Net wall area in m² (από WallGeometry.area, openings already subtracted Phase 2+). */
  readonly wallNetArea: number;
  /** Parent summary mapping (πχ wall.exterior → OIK-3.05). */
  readonly parentMapping: AtoeMappingEntry;
  readonly context: MultiLayerBuildContext;
}

export interface BuiltBoqRow {
  readonly id: string;
  /** Sanitized for Firestore setDoc (no undefined). */
  readonly payload: Record<string, unknown>;
}

export interface MultiLayerBuildResult {
  readonly parent: BuiltBoqRow;
  readonly children: readonly BuiltBoqRow[];
}

/** Existing createdAt timestamps per deterministic ID (preservation). */
export type ExistingCreatedAtMap = ReadonlyMap<string, string | null>;

// ============================================================================
// HELPERS
// ============================================================================

export function parentBoqId(entityId: string): string {
  return `boq_bim_${entityId}`;
}

export function layerChildBoqId(entityId: string, layerId: string): string {
  return `boq_bim_${entityId}_layer_${layerId}`;
}

function deriveLayerQuantity(layer: WallDnaLayer, wallNetArea: number, kind: MaterialAtoeMapping['quantityKind']): number {
  if (kind === 'volume') {
    const thicknessM = layer.thickness / 1000;
    return wallNetArea * thicknessM;
  }
  return wallNetArea;
}

function buildBaseRow(
  id: string,
  context: MultiLayerBuildContext,
  entityId: string,
  entityType: BimEntityType,
  existingCreatedAt: string | null,
): Pick<BOQItem,
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
> {
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

// ============================================================================
// BUILDER
// ============================================================================

/**
 * Build parent + per-layer child BOQ payloads για multi-layer wall.
 *
 * Caller filters layers (`dna.layers.length > 1` precondition). Single-layer
 * or no-dna walls πρέπει να χρησιμοποιούν το single-entry path του bridge.
 *
 * @param input  wall identity + dna + computed netArea + parent mapping
 * @param existingCreatedAt  preserve `createdAt` από existing Firestore docs
 *                           (parent id + each child id). Missing entries → now().
 */
export function buildMultiLayerBoqPayloads(
  input: MultiLayerBuildInput,
  existingCreatedAt: ExistingCreatedAtMap,
): MultiLayerBuildResult {
  const { entityId, entityType, dna, wallNetArea, parentMapping, context } = input;

  // ── Parent (group summary) ────────────────────────────────────────────────
  const parentId = parentBoqId(entityId);
  const parentBase = buildBaseRow(parentId, context, entityId, entityType, existingCreatedAt.get(parentId) ?? null);
  const parentItem: BOQItem = {
    ...parentBase,
    categoryCode: parentMapping.categoryCode,
    title: parentMapping.titleEL,
    unit: parentMapping.unit,
    estimatedQuantity: wallNetArea,
    parentBoqItemId: null,
    isGroupParent: true,
    layerIndex: null,
    materialId: null,
  };
  const parent: BuiltBoqRow = {
    id: parentId,
    payload: stripUndefinedDeep(parentItem as unknown as Record<string, unknown>),
  };

  // ── Children (per layer) ──────────────────────────────────────────────────
  const children: BuiltBoqRow[] = [];
  let layerIndex = 0;
  for (const layer of dna.layers) {
    const matMapping = resolveMaterialAtoeMapping(layer.materialId);
    if (!matMapping) {
      // Unknown material (user custom string) — skip this layer's child row
      // silently. Parent still represents total wall. Phase 6.2+ may surface
      // a "legacy/custom" badge via UI; tracked in pending ratchet entry.
      layerIndex += 1;
      continue;
    }
    const childId = layerChildBoqId(entityId, layer.id);
    const childBase = buildBaseRow(childId, context, entityId, entityType, existingCreatedAt.get(childId) ?? null);
    const childItem: BOQItem = {
      ...childBase,
      categoryCode: matMapping.categoryCode,
      title: matMapping.titleEL,
      unit: matMapping.unit,
      estimatedQuantity: deriveLayerQuantity(layer, wallNetArea, matMapping.quantityKind),
      parentBoqItemId: parentId,
      isGroupParent: false,
      layerIndex,
      materialId: layer.materialId,
    };
    children.push({
      id: childId,
      payload: stripUndefinedDeep(childItem as unknown as Record<string, unknown>),
    });
    layerIndex += 1;
  }

  return { parent, children };
}
