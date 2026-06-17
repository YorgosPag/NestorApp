/**
 * ADR-459 Phase 7 — reconcileFoundationLayout (diff plan vs existing auto footings).
 */

import { reconcileFoundationLayout, type ReconcileColumn } from '../auto-foundation-reconcile';
import type { FoundationLayoutPlan, PlannedFooting } from '../auto-foundation-layout';
import type { FoundationEntity } from '../../types/foundation-types';

/** Minimal planned footing. */
function planned(columnIds: string[], x: number, w: number, rotationDeg = 0): PlannedFooting {
  return {
    columnIds: [...columnIds].sort(),
    position: { x, y: 0 },
    widthMm: w,
    lengthMm: w,
    rotationDeg,
    topElevationMm: -1000,
    axialServiceKn: 0,
    combined: columnIds.length > 1,
  };
}

/** Minimal auto pad FoundationEntity. */
function autoPad(id: string, x: number, w: number, rotation = 0): FoundationEntity {
  return {
    id,
    type: 'foundation',
    params: { kind: 'pad', position: { x, y: 0, z: 0 }, width: w, length: w, rotation, autoDesigned: true },
  } as unknown as FoundationEntity;
}

const plan = (footings: PlannedFooting[]): FoundationLayoutPlan => ({ footings });
const cols = (entries: Array<[string, string | undefined]>): ReconcileColumn[] =>
  entries.map(([id, footingId]) => ({ id, footingId }));

describe('reconcileFoundationLayout', () => {
  it('creates a footing when none exists yet', () => {
    const diff = reconcileFoundationLayout(plan([planned(['c1'], 0, 1000)]), [], cols([['c1', undefined]]), 'mm');
    expect(diff.creates).toHaveLength(1);
    expect(diff.removeFootingIds).toEqual([]);
  });

  it('is idempotent: existing auto footing matching key + geometry → no-op', () => {
    const existing = autoPad('F1', 0, 1000);
    const diff = reconcileFoundationLayout(
      plan([planned(['c1'], 0, 1000)]),
      [existing],
      cols([['c1', 'F1']]),
      'mm',
    );
    expect(diff.creates).toEqual([]);
    expect(diff.removeFootingIds).toEqual([]);
  });

  it('same columns but different geometry → recreate (remove old + create new)', () => {
    const existing = autoPad('F1', 0, 1000);
    const diff = reconcileFoundationLayout(
      plan([planned(['c1'], 0, 2000)]), // grew well beyond tolerance
      [existing],
      cols([['c1', 'F1']]),
      'mm',
    );
    expect(diff.creates).toHaveLength(1);
    expect(diff.removeFootingIds).toEqual(['F1']);
  });

  it('column moved out of group → old combined removed, two isolated created', () => {
    const existing = autoPad('F1', 300, 1500); // combined serving c1+c2
    const diff = reconcileFoundationLayout(
      plan([planned(['c1'], 0, 1000), planned(['c2'], 5000, 1000)]),
      [existing],
      cols([['c1', 'F1'], ['c2', 'F1']]),
      'mm',
    );
    expect(diff.removeFootingIds).toEqual(['F1']);
    expect(diff.creates).toHaveLength(2);
  });

  it('column rotation changed → footing re-derives (same key, rotated geometry)', () => {
    const existing = autoPad('F1', 0, 1000, 0); // πέδιλο rotation 0
    const diff = reconcileFoundationLayout(
      plan([planned(['c1'], 0, 1000, 30)]), // κολώνα περιστράφηκε 30°
      [existing],
      cols([['c1', 'F1']]),
      'mm',
    );
    expect(diff.creates).toHaveLength(1);
    expect(diff.creates[0].rotationDeg).toBe(30);
    expect(diff.removeFootingIds).toEqual(['F1']);
  });

  it('within position tolerance → still matched (small column nudge = no churn)', () => {
    const existing = autoPad('F1', 0, 1000);
    const diff = reconcileFoundationLayout(
      plan([planned(['c1'], 40, 1000)]), // 40mm < 50mm tol
      [existing],
      cols([['c1', 'F1']]),
      'mm',
    );
    expect(diff.creates).toEqual([]);
    expect(diff.removeFootingIds).toEqual([]);
  });
});
