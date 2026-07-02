/**
 * ADR-449 — Structural Finish BOQ payloads (σοβάς κολόνας/δοκαριού): pure factory.
 *
 * Mirror του `boq-multi-layer-builder` (wall DNA) αλλά για finish skin:
 *   - parent = ο ΣΤΑΤΙΚΟΣ ΠΥΡΗΝΑΣ (π.χ. κολόνα OIK-2.03 m³ σκυρόδεμα) — αμετάβλητος,
 *     γίνεται `isGroupParent:true` ώστε να κρεμάει τα finish children.
 *   - child **ανά υλικό** (ADR-449 PART B, group-by-material): ένα child ανά distinct
 *     `materialId` που εμφανίζεται στις όψεις (π.χ. Knauf `mat-gypsum-board` OIK-7.05 m² +
 *     παραδοσιακός `mat-plaster-int` OIK-4.01 m²). Το χρώμα (`colorOverride`) ΔΕΝ σπάει BOQ
 *     (Giorgio: επιμέτρηση ανά υλικό· χρώμα = μόνο οπτικό).
 *
 * Τα εμβαδά είναι ΗΔΗ καθαρά (εξαιρούν καλυμμένα από τοίχους κομμάτια) — βγαίνουν
 * από τον `structural-finish-resolver` (per-face `materialId` ενσωματώνει τα PART B
 * overrides). Idempotent deterministic IDs (materialId-keyed).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 * @see boq-multi-layer-builder.ts (wall DNA sibling)
 */

import type { BOQItem } from '@/types/boq';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import type { AtoeMappingEntry, BimEntityType } from '../config/bim-to-atoe-mapping';
import { resolveMaterialAtoeMapping } from '../config/material-to-atoe-mapping';
// ADR-449 PART B — ο τύπος bucket + το grouping ζουν στο finishes layer (pure), ώστε ο scene
// builder να ΜΗΝ εισάγει value από εδώ (αποφυγή κυκλικής εξάρτησης finishes↔services).
import type { FinishMaterialBucket } from '../finishes/structural-finish-area';
import {
  buildBaseRow,
  parentBoqId,
  type BuiltBoqRow,
  type MultiLayerBuildContext,
  type ExistingCreatedAtMap,
} from './boq-multi-layer-builder';

export type { FinishMaterialBucket } from '../finishes/structural-finish-area';

/** Καθαρό derived contribution σοβά (από τον resolver), group-by-material — input στο BOQ. */
export interface FinishBoqContribution {
  /** Ένα bucket ανά distinct υλικό (θετικό εμβαδό), ταξινομημένα κατά `materialId`. */
  readonly byMaterial: readonly FinishMaterialBucket[];
}

/** m² → canonical slug ασφαλές για document id (materialId είναι ήδη slug, π.χ. 'mat-plaster-int'). */
function materialIdSlug(materialId: string): string {
  return materialId.replace(/[^a-zA-Z0-9_-]/g, '_');
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

/** Deterministic finish child id ανά **υλικό** (ADR-449 PART B group-by-material). */
export function finishChildBoqId(entityId: string, materialId: string): string {
  return `boq_bim_${entityId}_finish_${materialIdSlug(materialId)}`;
}

/** Όλα τα υποψήφια child ids μιας συνεισφοράς (για fetch/detach guard στο bridge). */
export function finishChildBoqIds(entityId: string, finish: FinishBoqContribution): string[] {
  return finish.byMaterial.map((b) => finishChildBoqId(entityId, b.materialId));
}

/** True όταν το στοιχείο έχει έστω μία εκτεθειμένη παρειά σοβά (→ multi-layer path). */
export function hasFinishContribution(c: FinishBoqContribution | undefined): c is FinishBoqContribution {
  return !!c && c.byMaterial.length > 0;
}

function buildFinishChild(
  entityId: string,
  entityType: BimEntityType,
  parentId: string,
  bucket: FinishMaterialBucket,
  layerIndex: number,
  context: MultiLayerBuildContext,
  existingCreatedAt: ExistingCreatedAtMap,
): BuiltBoqRow | null {
  if (bucket.areaM2 <= 0) return null;
  const mapping = resolveMaterialAtoeMapping(bucket.materialId);
  if (!mapping) return null; // άγνωστο υλικό → skip (parent παραμένει)
  const childId = finishChildBoqId(entityId, bucket.materialId);
  const base = buildBaseRow(childId, context, entityId, entityType, existingCreatedAt.get(childId) ?? null);
  const item: BOQItem = {
    ...base,
    categoryCode: mapping.categoryCode,
    title: mapping.titleEL,
    unit: mapping.unit,
    estimatedQuantity: bucket.areaM2,
    parentBoqItemId: parentId,
    isGroupParent: false,
    layerIndex,
    materialId: bucket.materialId,
  };
  return { id: childId, payload: stripUndefinedDeep(item as unknown as Record<string, unknown>) };
}

/**
 * Build parent (στατικός πυρήνας) + finish children **ανά υλικό** (group-by-material).
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
  finish.byMaterial.forEach((bucket, i) => {
    const child = buildFinishChild(entityId, entityType, parentId, bucket, i, context, existingCreatedAt);
    if (child) children.push(child);
  });

  return { parent, children };
}
