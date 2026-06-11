/**
 * ADR-441 Slice 7 — `gridOffsetSignature` change-detection tests.
 *
 * Ο settle-emitter εκπέμπει `bim:grid-guides-settled` ΜΟΝΟ όταν το signature του
 * συνόλου ορατών offsets όντως αλλάζει. Pure-tested εδώ (η React/timer ενορχήστρωση
 * δοκιμάζεται χειροκίνητα στον browser): ίδια offsets → ίδιο sig· move/add/remove/
 * visibility → διαφορετικό· ανεξάρτητο σειράς.
 */

import { gridOffsetSignature } from '../useGridGuideSettleEmitter';
import type { AxisGuideReader } from '../../../bim/foundations/foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';

const guide = (id: string, axis: Guide['axis'], offset: number, visible = true): Guide =>
  ({ id, axis, offset, visible, label: null, style: null, locked: false, createdAt: '', parentId: null, groupId: null } as Guide);

const reader = (guides: readonly Guide[]): AxisGuideReader => ({
  getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis),
});

const X = [guide('x0', 'X', 0), guide('x1', 'X', 4000)];
const Y = [guide('y0', 'Y', 0), guide('y1', 'Y', 8000)];

describe('gridOffsetSignature', () => {
  it('ίδια offsets, διαφορετική σειρά εισόδου → ίδιο signature', () => {
    const a = gridOffsetSignature(reader([...X, ...Y]));
    const b = gridOffsetSignature(reader([X[1], Y[1], X[0], Y[0]]));
    expect(a).toBe(b);
  });

  it('μετακίνηση offset → διαφορετικό signature', () => {
    const before = gridOffsetSignature(reader([...X, ...Y]));
    const after = gridOffsetSignature(reader([guide('x0', 'X', 0), guide('x1', 'X', 5000), ...Y]));
    expect(after).not.toBe(before);
  });

  it('προσθήκη άξονα → διαφορετικό signature', () => {
    const before = gridOffsetSignature(reader([...X, ...Y]));
    const after = gridOffsetSignature(reader([...X, guide('x2', 'X', 8000), ...Y]));
    expect(after).not.toBe(before);
  });

  it('αόρατος άξονας δεν μετράει στο signature', () => {
    const visibleOnly = gridOffsetSignature(reader([...X, ...Y]));
    const withHidden = gridOffsetSignature(reader([...X, guide('x2', 'X', 8000, false), ...Y]));
    expect(withHidden).toBe(visibleOnly);
  });

  it('sub-tolerance διαφορά (<1mm) → ίδιο signature (floating-point-safe)', () => {
    const a = gridOffsetSignature(reader([...X, ...Y]));
    const b = gridOffsetSignature(reader([guide('x0', 'X', 0.0004), guide('x1', 'X', 4000), ...Y]));
    expect(b).toBe(a);
  });
});
