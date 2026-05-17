/**
 * ADR-362 Phase D3 — dimension-create-chained-builders unit tests.
 *
 * Pure-mapper coverage for the baseline + continued creation builders:
 *   - parent missing → null (preview + commit, both call sites)
 *   - new extOrigin sourced from clicks[0] when available, else cursor in preview
 *   - parentDimensionId stamped onto the produced entity
 *   - defPoints is the single new extOrigin (extOrigin1 + dimLineRef are derived
 *     at render time by chained-builder.ts, not at creation)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { DimensionCreateState } from '../dimension-create-state';
import { initialDimensionCreateState } from '../dimension-create-state';
import {
  buildBaseline,
  buildContinued,
} from '../dimension-create-chained-builders';

const STYLE_ID = 'dimstyle_iso';
const PARENT_ID = 'dim_parent_A';

function makeState(over: Partial<DimensionCreateState>): DimensionCreateState {
  return {
    ...initialDimensionCreateState,
    status: 'collecting',
    mode: 'manual',
    styleId: STYLE_ID,
    ...over,
  };
}

const previewOpts = { id: '__preview__', layerId: '__preview_layer__', includeCursor: true };
const commitOpts = { id: 'dim_real', layerId: 'lyr_x', includeCursor: false };

// ──────────────────────────────────────────────────────────────────────────────
// buildBaseline
// ──────────────────────────────────────────────────────────────────────────────

describe('buildBaseline', () => {
  it('returns null when parentDimensionId is missing', () => {
    const s = makeState({
      currentType: 'baseline',
      clicks: [{ world: { x: 100, y: 0 } }],
    });
    expect(buildBaseline(s, commitOpts)).toBeNull();
  });

  it('preview: cursor fills the new extOrigin when no click yet', () => {
    const cursor: Point2D = { x: 250, y: 0 };
    const s = makeState({
      currentType: 'baseline',
      parentDimensionId: PARENT_ID,
      cursorWorld: cursor,
    });
    const preview = buildBaseline(s, previewOpts);
    expect(preview).not.toBeNull();
    expect(preview!.defPoints).toEqual([cursor]);
    expect(preview!.parentDimensionId).toBe(PARENT_ID);
    expect(preview!.id).toBe('__preview__');
  });

  it('preview: returns null when neither click nor cursor are available', () => {
    const s = makeState({
      currentType: 'baseline',
      parentDimensionId: PARENT_ID,
    });
    expect(buildBaseline(s, previewOpts)).toBeNull();
  });

  it('commit: defPoints = [click 0 world], parentDimensionId stamped', () => {
    const s = makeState({
      currentType: 'baseline',
      parentDimensionId: PARENT_ID,
      clicks: [{ world: { x: 200, y: 0 } }],
      cursorWorld: { x: 999, y: 999 },
    });
    const committed = buildBaseline(s, commitOpts);
    expect(committed).not.toBeNull();
    expect(committed!.dimensionType).toBe('baseline');
    expect(committed!.defPoints).toEqual([{ x: 200, y: 0 }]);
    expect(committed!.parentDimensionId).toBe(PARENT_ID);
    expect(committed!.styleId).toBe(STYLE_ID);
    expect(committed!.layerId).toBe('lyr_x');
  });

  it('commit ignores cursor (commit opts.includeCursor=false)', () => {
    const s = makeState({
      currentType: 'baseline',
      parentDimensionId: PARENT_ID,
      cursorWorld: { x: 999, y: 999 },
    });
    expect(buildBaseline(s, commitOpts)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// buildContinued
// ──────────────────────────────────────────────────────────────────────────────

describe('buildContinued', () => {
  it('returns null when parentDimensionId is missing', () => {
    const s = makeState({
      currentType: 'continued',
      clicks: [{ world: { x: 300, y: 0 } }],
    });
    expect(buildContinued(s, commitOpts)).toBeNull();
  });

  it('preview: cursor fills the new extOrigin when no click yet', () => {
    const cursor: Point2D = { x: 400, y: 0 };
    const s = makeState({
      currentType: 'continued',
      parentDimensionId: PARENT_ID,
      cursorWorld: cursor,
    });
    const preview = buildContinued(s, previewOpts);
    expect(preview!.defPoints).toEqual([cursor]);
    expect(preview!.parentDimensionId).toBe(PARENT_ID);
  });

  it('commit: defPoints = [click 0 world], parentDimensionId stamped', () => {
    const s = makeState({
      currentType: 'continued',
      parentDimensionId: PARENT_ID,
      clicks: [{ world: { x: 350, y: 0 } }],
    });
    const committed = buildContinued(s, commitOpts);
    expect(committed!.dimensionType).toBe('continued');
    expect(committed!.defPoints).toEqual([{ x: 350, y: 0 }]);
    expect(committed!.parentDimensionId).toBe(PARENT_ID);
  });
});
