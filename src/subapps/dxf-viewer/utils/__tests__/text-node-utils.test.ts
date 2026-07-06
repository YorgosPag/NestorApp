/**
 * ADR-557 Φ-attachment — scaleTextNodeRunHeights (durable text-height write).
 *
 * A text-grip resize must scale the textNode run heights (the SSoT `resolveTextHeight`
 * reads FIRST) — a flat `height` write alone is shadowed. Covers proportional scaling,
 * multi-run preservation, height-less/stack runs, and no-op ratios.
 */

import type { DxfTextNode } from '../../text-engine/types';
import { scaleTextNodeRunHeights } from '../text-node-utils';

const node = (runs: Array<Record<string, unknown>>): DxfTextNode =>
  ({ paragraphs: [{ runs }], attachment: 'TL' }) as unknown as DxfTextNode;

const runHeights = (n: DxfTextNode): Array<number | undefined> =>
  (n.paragraphs[0].runs as Array<{ style?: { height?: number } }>).map((r) => r.style?.height);

describe('scaleTextNodeRunHeights', () => {
  it('scales every run height by the ratio (proportional)', () => {
    const out = scaleTextNodeRunHeights(node([{ text: 'A', style: { height: 100 } }]), 2.5);
    expect(runHeights(out)).toEqual([250]);
  });

  it('preserves RELATIVE heights across multiple runs', () => {
    const out = scaleTextNodeRunHeights(
      node([{ text: 'A', style: { height: 100 } }, { text: 'b', style: { height: 50 } }]),
      1.5,
    );
    expect(runHeights(out)).toEqual([150, 75]);
  });

  it('leaves height-less runs and TextStack items untouched', () => {
    const out = scaleTextNodeRunHeights(
      node([{ text: 'A', style: {} }, { top: [], bottom: [] }]),
      2,
    );
    expect(runHeights(out)).toEqual([undefined, undefined]);
  });

  it('is a no-op (same reference) for ratio 1 or non-positive', () => {
    const n = node([{ text: 'A', style: { height: 100 } }]);
    expect(scaleTextNodeRunHeights(n, 1)).toBe(n);
    expect(scaleTextNodeRunHeights(n, 0)).toBe(n);
    expect(scaleTextNodeRunHeights(n, -3)).toBe(n);
  });

  it('does not mutate the input node (returns a fresh clone)', () => {
    const n = node([{ text: 'A', style: { height: 100 } }]);
    scaleTextNodeRunHeights(n, 3);
    expect(runHeights(n)).toEqual([100]);
  });
});
