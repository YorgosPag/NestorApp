/**
 * ADR-441 Slice COL — column hosting strategy tests.
 *
 * Σημειακό hosting κολώνας: center-x/center-y bindings → το position ακολουθεί τον άξονα.
 * Καλύπτει: reconcile re-derive (position+geometry), only-changed null, outline footprint.
 */

import { columnHostingStrategy } from '../column-hosting-strategy';
import type { GuideOffsetLookup } from '../derive-slots';
import type { GuideBinding } from '../guide-binding-types';
import { buildColumnEntity, buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import { computeColumnGeometry } from '../../geometry/column-geometry';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';

const lookup = (offsets: Record<string, number>): GuideOffsetLookup => (id) => offsets[id];

const bindings: GuideBinding[] = [
  { guideId: 'cx', slot: 'center-x' },
  { guideId: 'cy', slot: 'center-y' },
];

const hostedColumn = (): ColumnEntity => {
  const params = buildDefaultColumnParams({ x: 1000, y: 2000 }, 'rectangular', {}, 'mm');
  const built = buildColumnEntity(params, '0', 'mm');
  if (!built.ok) throw new Error('column build failed');
  return { ...built.entity, guideBindings: bindings };
};

describe('columnHostingStrategy', () => {
  it('reconcile → re-derived position + geometry όταν κουνηθεί η τομή', () => {
    const update = columnHostingStrategy.reconcile(hostedColumn(), lookup({ cx: 3000, cy: 5000 }));
    expect(update).not.toBeNull();
    const nextParams = update!.nextParams as ColumnParams;
    expect(nextParams.position.x).toBe(3000);
    expect(nextParams.position.y).toBe(5000);
    expect(update!.type).toBe('column');
    expect(update!.nextGeometry).toEqual(computeColumnGeometry(nextParams));
  });

  it('only-changed: null όταν η τομή ταυτίζεται με το position', () => {
    expect(columnHostingStrategy.reconcile(hostedColumn(), lookup({ cx: 1000, cy: 2000 }))).toBeNull();
  });

  it('outline → footprint vertices (world coords)', () => {
    const update = columnHostingStrategy.reconcile(hostedColumn(), lookup({ cx: 3000, cy: 5000 }))!;
    const outline = columnHostingStrategy.outline(update.nextGeometry);
    expect(outline.length).toBeGreaterThanOrEqual(4);
  });

  it('αγνοεί entity που δεν είναι κολώνα', () => {
    const notColumn = { id: 'x', type: 'wall', guideBindings: bindings } as unknown as ColumnEntity;
    expect(columnHostingStrategy.reconcile(notColumn, lookup({ cx: 3000 }))).toBeNull();
  });
});
