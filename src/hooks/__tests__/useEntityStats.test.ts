/**
 * 🧪 useEntityStats — a value that does not exist must not be counted as zero.
 *
 * Guards ADR-777 Φ4 (Α5/Α6). `averageValue` used to divide by `items.length`,
 * so every item with no recorded price pulled the average down as though it
 * were free — the same defect Φ5 fixed on the public dashboard, living here in
 * the generic hook that five entity-stats wrappers share.
 *
 * `getValue` returning `null` is the contract: the item leaves both the sum and
 * the denominator, and the two counts say how much of the set was measured.
 */

import { renderHook } from '@testing-library/react';
import { useEntityStats } from '../useEntityStats';

interface Unit {
  area?: number;
  price: number | null;
}

const getArea = (u: Unit): number => u.area ?? 0;
const getValue = (u: Unit): number | null => u.price;

/** Two priced units and one that nobody priced. */
const MIXED: Unit[] = [
  { area: 50, price: 100_000 },
  { area: 50, price: 200_000 },
  { area: 50, price: null },
];

function statsOf(items: Unit[]) {
  return renderHook(() => useEntityStats(items, { getArea, getValue })).result.current;
}

describe('useEntityStats — value accounting', () => {
  it('sums only the items that have a value', () => {
    expect(statsOf(MIXED).totalValue).toBe(300_000);
  });

  it('divides the average by the VALUED items, not by all of them', () => {
    // The regression: 300.000/3 = 100.000 — an average no unit is offered at.
    expect(statsOf(MIXED).averageValue).toBe(150_000);
  });

  it('reports both counts, so the total can be read honestly', () => {
    const stats = statsOf(MIXED);
    expect(stats.valuedCount).toBe(2);
    expect(stats.unvaluedCount).toBe(1);
    expect(stats.valuedCount + stats.unvaluedCount).toBe(stats.total);
  });

  it('still divides AREA by every item — area is not the same question', () => {
    // Only the money question distinguishes "absent" from "zero"; the area
    // accessor keeps its original total/length contract.
    expect(statsOf(MIXED).averageArea).toBe(50);
  });

  it('reports zero — not NaN — when nothing in the set has a value', () => {
    const stats = statsOf([{ price: null }, { price: null }]);
    expect(stats.totalValue).toBe(0);
    expect(stats.averageValue).toBe(0);
    expect(stats.valuedCount).toBe(0);
    expect(stats.unvaluedCount).toBe(2);
  });

  it('leaves an empty collection at zero on every field', () => {
    const stats = statsOf([]);
    expect(stats).toMatchObject({
      total: 0,
      totalValue: 0,
      averageValue: 0,
      valuedCount: 0,
      unvaluedCount: 0,
    });
  });

  it('counts nothing as unvalued when no getValue was supplied', () => {
    // A caller that asks no money question must not be told that every one of
    // its items is missing a price.
    const stats = renderHook(() => useEntityStats(MIXED, { getArea })).result.current;
    expect(stats.valuedCount).toBe(0);
    expect(stats.unvaluedCount).toBe(0);
  });

  it('keeps a plain numeric getValue behaving exactly as before', () => {
    // useProjectsStats / useBuildingStats sum a budget, where 0 is a real
    // amount and not an absence. Their contract must not have moved.
    const budgets = [{ price: 0 }, { price: 100 }] as Unit[];
    const stats = renderHook(
      () => useEntityStats(budgets, { getValue: (u: Unit) => u.price ?? 0 }),
    ).result.current;
    expect(stats.totalValue).toBe(100);
    expect(stats.averageValue).toBe(50);
    expect(stats.valuedCount).toBe(2);
  });
});
