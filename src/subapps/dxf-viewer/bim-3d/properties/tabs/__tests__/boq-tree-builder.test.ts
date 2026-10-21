/**
 * ADR-917 Ε2 · Α35 — the 3D BOQ tab: a wall SUMMARY shows Σ of its layers (the one rule of the BOQ tables),
 * never its own price; a column core (`work` parent) keeps its own cost.
 */

import { normalizeBOQItem } from '@/services/measurements/boq-document-normalize';
import { buildBoqTree } from '../boq-tree-builder';

const row = (id: string, extra: Record<string, unknown>) =>
  normalizeBOQItem(id, { title: id, unit: 'm2', estimatedQuantity: 10, categoryCode: 'OIK-3', ...extra });

describe('3D BOQ tree (Α35)', () => {
  it('🔴 a summary with layers costs Σ of its layers (rate ÷ its quantity) — its own price is ignored', () => {
    const tree = buildBoqTree([
      row('w', { isGroupParent: true, groupRole: 'summary', materialUnitCost: 500 }),
      row('l0', { parentBoqItemId: 'w', layerIndex: 0, materialUnitCost: 4 }),
      row('l1', { parentBoqItemId: 'w', layerIndex: 1, materialUnitCost: 6 }),
    ]);
    expect(tree.parent?.totalCost).toBe(100);
    expect(tree.parent?.derived).toEqual({ layerCount: 2, totalCost: 100, unitRate: 10 });
  });

  it('a work parent (column core) keeps its own cost; children are listed apart', () => {
    const tree = buildBoqTree([
      row('c', { isGroupParent: true, groupRole: 'work', materialUnitCost: 50 }),
      row('f', { parentBoqItemId: 'c', materialUnitCost: 2 }),
    ]);
    expect(tree.parent?.totalCost).toBe(500);
    expect(tree.parent?.derived).toBeNull();
  });

  it('a summary with no present layers keeps its own row (Α22) — nothing derived', () => {
    const tree = buildBoqTree([row('w', { isGroupParent: true, groupRole: 'summary', materialUnitCost: 3 })]);
    expect(tree.parent?.derived).toBeNull();
    expect(tree.parent?.totalCost).toBe(30);
  });
});
