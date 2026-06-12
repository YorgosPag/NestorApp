/**
 * ADR-449 — Structural Finish BOQ payloads (σοβάς κολόνας/δοκαριού): pure factory.
 *
 * Mirror του `boq-multi-layer-builder` (wall DNA) αλλά για finish skin:
 *   - parent = ο ΣΤΑΤΙΚΟΣ ΠΥΡΗΝΑΣ (π.χ. κολόνα OIK-2.03 m³ σκυρόδεμα) — αμετάβλητος,
 *     γίνεται `isGroupParent:true` ώστε να κρεμάει τα finish children.
 *   - child interior = εσωτ. σοβάς (Knauf, OIK-4.01 m²) — αν `interiorAreaM2 > 0`.
 *   - child exterior = εξωτ. σοβάς (OIK-4.03 m²) — αν `exteriorAreaM2 > 0`.
 *
 * Τα εμβαδά είναι ΗΔΗ καθαρά (εξαιρούν καλυμμένα από τοίχους κομμάτια) — βγαίνουν
 * από τον `structural-finish-resolver`. Idempotent deterministic IDs.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 * @see boq-multi-layer-builder.ts (wall DNA sibling)
 */

import type { BOQItem } from '@/types/boq';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import type { AtoeMappingEntry, BimEntityType } from '../config/bim-to-atoe-mapping';
import { resolveMaterialAtoeMapping } from '../config/material-to-atoe-mapping';
import {
  buildBaseRow,
  parentBoqId,
  type BuiltBoqRow,
  type MultiLayerBuildContext,
  type ExistingCreatedAtMap,
} from './boq-multi-layer-builder';

/** Καθαρό derived contribution σοβά (από τον resolver) — input στο BOQ builder. */
export interface FinishBoqContribution {
  readonly interiorAreaM2: number;
  readonly exteriorAreaM2: number;
  readonly interiorMaterialId: string;
  readonly exteriorMaterialId: string;
}

interface FinishBoqBuildInput {
  readonly entityId: string;
  readonly entityType: BimEntityType;
  /** ΑΤΟΕ mapping του ΠΥΡΗΝΑ (π.χ. column → OIK-2.03 m³). */
  readonly coreMapping: AtoeMappingEntry;
  /** Ποσότητα πυρήνα (m³ όγκος σκυροδέματος) — αμετάβλητη από τον σοβά. */
  readonly coreQuantity: number;
  readonly finish: FinishBoqContribution;
  readonly context: MultiLayerBuildContext;
}

interface FinishBoqBuildResult {
  readonly parent: BuiltBoqRow;
  readonly children: readonly BuiltBoqRow[];
}

/** Deterministic finish child id (interior→`_finish_int`, exterior→`_finish_ext`). */
export function finishChildBoqId(entityId: string, kind: 'interior' | 'exterior'): string {
  return `boq_bim_${entityId}_finish_${kind === 'interior' ? 'int' : 'ext'}`;
}

/** True όταν το στοιχείο έχει έστω μία εκτεθειμένη παρειά σοβά (→ multi-layer path). */
export function hasFinishContribution(c: FinishBoqContribution | undefined): c is FinishBoqContribution {
  return !!c && (c.interiorAreaM2 > 0 || c.exteriorAreaM2 > 0);
}

function buildFinishChild(
  entityId: string,
  entityType: BimEntityType,
  parentId: string,
  kind: 'interior' | 'exterior',
  areaM2: number,
  materialId: string,
  layerIndex: number,
  context: MultiLayerBuildContext,
  existingCreatedAt: ExistingCreatedAtMap,
): BuiltBoqRow | null {
  if (areaM2 <= 0) return null;
  const mapping = resolveMaterialAtoeMapping(materialId);
  if (!mapping) return null; // άγνωστο υλικό → skip (parent παραμένει)
  const childId = finishChildBoqId(entityId, kind);
  const base = buildBaseRow(childId, context, entityId, entityType, existingCreatedAt.get(childId) ?? null);
  const item: BOQItem = {
    ...base,
    categoryCode: mapping.categoryCode,
    title: mapping.titleEL,
    unit: mapping.unit,
    estimatedQuantity: areaM2,
    parentBoqItemId: parentId,
    isGroupParent: false,
    layerIndex,
    materialId,
  };
  return { id: childId, payload: stripUndefinedDeep(item as unknown as Record<string, unknown>) };
}

/**
 * Build parent (στατικός πυρήνας) + finish children (interior/exterior σοβάς).
 * Caller filters με `hasFinishContribution()` πριν καλέσει.
 */
export function buildFinishBoqPayloads(
  input: FinishBoqBuildInput,
  existingCreatedAt: ExistingCreatedAtMap,
): FinishBoqBuildResult {
  const { entityId, entityType, coreMapping, coreQuantity, finish, context } = input;

  const parentId = parentBoqId(entityId);
  const parentBase = buildBaseRow(parentId, context, entityId, entityType, existingCreatedAt.get(parentId) ?? null);
  const parentItem: BOQItem = {
    ...parentBase,
    categoryCode: coreMapping.categoryCode,
    title: coreMapping.titleEL,
    unit: coreMapping.unit,
    estimatedQuantity: coreQuantity,
    parentBoqItemId: null,
    isGroupParent: true,
    layerIndex: null,
    materialId: null,
  };
  const parent: BuiltBoqRow = {
    id: parentId,
    payload: stripUndefinedDeep(parentItem as unknown as Record<string, unknown>),
  };

  const children: BuiltBoqRow[] = [];
  const interior = buildFinishChild(entityId, entityType, parentId, 'interior', finish.interiorAreaM2, finish.interiorMaterialId, 0, context, existingCreatedAt);
  if (interior) children.push(interior);
  const exterior = buildFinishChild(entityId, entityType, parentId, 'exterior', finish.exteriorAreaM2, finish.exteriorMaterialId, 1, context, existingCreatedAt);
  if (exterior) children.push(exterior);

  return { parent, children };
}
