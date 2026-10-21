/**
 * Builds a display tree of BOQ rows for a BIM entity from raw Firestore BOQItem records.
 * ADR-366 C.4.Q3. Mirrors ADR-363 Phase 6 parent/children expandable tree.
 *
 * Parent row: isGroupParent === true OR the single BOQ item for simple (non-DNA) entities.
 * Children rows: items where parentBoqItemId === parent.id (multi-layer DNA layers).
 * ADR-917 Ε2: a SUMMARY parent with layers shows Σ of its layers (`deriveSummaryCost`, the ONE rule of the
 * BOQ tables too) — never its own price, which the Λ7 core leaves out of every sum.
 */

import type { BOQItem } from '@/types/boq';
import { computeItemCost } from '@/services/measurements/cost-engine';
import { deriveSummaryCost, type DerivedSummaryCost } from '@/services/measurements/boq-cost-groups';
import { isSummaryBoqLine } from '@/services/measurements/boq-line-role';

export interface BoqDisplayRow {
  readonly id: string;
  readonly title: string;
  readonly unit: string;
  readonly quantity: number;
  readonly materialUnitCost: number;
  readonly laborUnitCost: number;
  readonly totalCost: number;
  readonly layerIndex: number | null;
  readonly isParent: boolean;
  /** Present ⇔ a summary parent replaced by its layers: `totalCost` IS `derived.totalCost` */
  readonly derived: DerivedSummaryCost | null;
}

export interface BoqTree {
  readonly parent: BoqDisplayRow | null;
  readonly children: readonly BoqDisplayRow[];
}

function toDisplayRow(item: BOQItem, isParent: boolean): BoqDisplayRow {
  const quantity = item.actualQuantity ?? item.estimatedQuantity;
  return {
    id: item.id,
    title: item.title,
    unit: item.unit,
    quantity,
    materialUnitCost: item.materialUnitCost,
    laborUnitCost: item.laborUnitCost,
    // ADR-917 Δ1 — ο ΕΝΑΣ τύπος κόστους (εδώ ήταν αντίγραφο χωρίς το όριο φύρας του cost-engine)
    totalCost: computeItemCost({ ...item, estimatedQuantity: quantity }).totalCost,
    layerIndex: item.layerIndex ?? null,
    isParent,
    derived: null,
  };
}

/** A summary with layers costs what its layers cost; any other parent keeps its own row (Λ7 · Ε2). */
function parentRow(parent: BOQItem, children: readonly BoqDisplayRow[]): BoqDisplayRow {
  const row = toDisplayRow(parent, true);
  if (children.length === 0 || !isSummaryBoqLine(parent)) return row;
  const derived = deriveSummaryCost(row.quantity, children.map((child) => child.totalCost));
  return { ...row, totalCost: derived.totalCost, derived };
}

export function buildBoqTree(items: readonly BOQItem[]): BoqTree {
  if (items.length === 0) return { parent: null, children: [] };

  const parent = items.find((i) => i.isGroupParent) ?? items.find((i) => !i.parentBoqItemId);
  if (!parent) return { parent: null, children: [] };

  const children = items
    .filter((i) => i.parentBoqItemId === parent.id)
    .sort((a, b) => (a.layerIndex ?? 0) - (b.layerIndex ?? 0))
    .map((i) => toDisplayRow(i, false));

  return { parent: parentRow(parent, children), children };
}
