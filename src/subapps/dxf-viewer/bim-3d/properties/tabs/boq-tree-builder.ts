/**
 * Builds a display tree of BOQ rows for a BIM entity from raw Firestore BOQItem records.
 * ADR-366 C.4.Q3. Mirrors ADR-363 Phase 6 parent/children expandable tree.
 *
 * Parent row: isGroupParent === true OR the single BOQ item for simple (non-DNA) entities.
 * Children rows: items where parentBoqItemId === parent.id (multi-layer DNA layers).
 */

import type { BOQItem } from '@/types/boq';

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
}

export interface BoqTree {
  readonly parent: BoqDisplayRow | null;
  readonly children: readonly BoqDisplayRow[];
}

function toDisplayRow(item: BOQItem, isParent: boolean): BoqDisplayRow {
  const quantity = item.actualQuantity ?? item.estimatedQuantity;
  const unitCost = item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost;
  return {
    id: item.id,
    title: item.title,
    unit: item.unit,
    quantity,
    materialUnitCost: item.materialUnitCost,
    laborUnitCost: item.laborUnitCost,
    totalCost: unitCost * quantity * (1 + item.wasteFactor),
    layerIndex: item.layerIndex ?? null,
    isParent,
  };
}

export function buildBoqTree(items: readonly BOQItem[]): BoqTree {
  if (items.length === 0) return { parent: null, children: [] };

  const parent = items.find((i) => i.isGroupParent) ?? items.find((i) => !i.parentBoqItemId);
  if (!parent) return { parent: null, children: [] };

  const children = items
    .filter((i) => i.parentBoqItemId === parent.id)
    .sort((a, b) => (a.layerIndex ?? 0) - (b.layerIndex ?? 0))
    .map((i) => toDisplayRow(i, false));

  return { parent: toDisplayRow(parent, true), children };
}
