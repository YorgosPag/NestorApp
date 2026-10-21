/**
 * @jest-environment jsdom
 */

/**
 * ADR-917 Ε2 · Α33/Α35 — in the BOQ editor a wall summary's price is DERIVED: the inputs are replaced by Σ of
 * its layers (rate = Σ ÷ quantity), an edit NEVER sends the price fields, and the table row shows Σ of the
 * layers instead of the summary's own price.
 */

import { render, renderHook, screen } from '@testing-library/react';
import { normalizeBOQItem } from '@/services/measurements/boq-document-normalize';
import { createInitialState, buildBOQUpdatePayload } from '../useBOQEditorState';
import { BOQDerivedCostFieldset, useSummaryPriceLock } from '../BOQDerivedCostFieldset';
import { BOQFloorGroup } from '../BOQFloorGroup';
import { derivedSummaryCosts } from '@/services/measurements/boq-cost-groups';
import { formatCurrency } from '@/lib/intl-utils';

const t = (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key);
const colors = { text: { muted: 'muted' } } as never;

const summary = normalizeBOQItem('boq_bim_w1', {
  title: 'Τοίχος', unit: 'm2', estimatedQuantity: 20, materialUnitCost: 99, isGroupParent: true, groupRole: 'summary', categoryCode: 'OIK-3',
});
const layer = (id: string, cost: number) => normalizeBOQItem(id, {
  title: id, unit: 'm2', estimatedQuantity: 20, materialUnitCost: cost, parentBoqItemId: 'boq_bim_w1', categoryCode: 'OIK-4',
});
const building = [summary, layer('plaster', 5), layer('brick', 10)];

describe('summary price lock (Ε2)', () => {
  it('🔴 a summary is locked and derives Σ = 300, rate 15 €/m², from its two layers', () => {
    const { result } = renderHook(() => useSummaryPriceLock(summary, building));
    expect(result.current.locked).toBe(true);
    expect(result.current.derived).toEqual({ layerCount: 2, totalCost: 300, unitRate: 15 });
    expect(result.current.layers.map((item) => item.id)).toEqual(['plaster', 'brick']);
  });

  it('a layer and a plain line are not locked', () => {
    expect(renderHook(() => useSummaryPriceLock(building[1], building)).result.current.locked).toBe(false);
    expect(renderHook(() => useSummaryPriceLock(null, building)).result.current.locked).toBe(false);
  });

  it('🔴 a locked edit sends NO price field (the stored derived value is not the form\'s)', () => {
    const form = createInitialState(summary, 'OIK-3');
    const numbers = { numericEstimated: 20, numericWaste: 0, materialCost: 99, laborCost: 0, equipmentCost: 0 };
    const locked = buildBOQUpdatePayload(form, numbers, true);
    expect(locked).not.toHaveProperty('materialUnitCost');
    expect(locked).not.toHaveProperty('laborUnitCost');
    expect(locked).not.toHaveProperty('equipmentUnitCost');
    expect(buildBOQUpdatePayload(form, numbers, false).materialUnitCost).toBe(99);
  });

  it('the fieldset shows the derived total and every layer — no price input', () => {
    const { container } = render(
      <BOQDerivedCostFieldset summary={summary} derived={{ layerCount: 2, totalCost: 300, unitRate: 15 }} layers={building.slice(1)} colors={colors} t={t} />,
    );
    expect(container.querySelector('input')).toBeNull();
    expect(screen.getByText('plaster')).toBeTruthy();
    expect(screen.getByText('brick')).toBeTruthy();
  });

  it('no present layers ⇒ the human is told how to bring them back; still no input', () => {
    const { container } = render(<BOQDerivedCostFieldset summary={summary} derived={null} layers={[]} colors={colors} t={t} />);
    expect(screen.getByText('tabs.measurements.editor.derived.noLayers')).toBeTruthy();
    expect(container.querySelector('input')).toBeNull();
  });
});

describe('BOQ table row of a summary (Α35)', () => {
  it('🔴 shows Σ of its layers (300), never its own price (99 × 20 = 1.980)', () => {
    render(
      <BOQFloorGroup
        items={building}
        derivedCosts={derivedSummaryCosts(building)}
        categories={[]}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onStatusChange={jest.fn()}
        t={t}
      />,
    );
    expect(screen.getByText('tabs.measurements.table.derivedFromLayers|{"count":2}')).toBeTruthy();
    expect(screen.getAllByText(formatCurrency(300)).length).toBeGreaterThan(0);
    expect(screen.queryByText(formatCurrency(1980))).toBeNull();
  });
});
