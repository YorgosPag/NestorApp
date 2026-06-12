/**
 * ADR-441 Slice GEN-SLAB — slab (area) hosting strategy tests.
 *
 * Area hosting: η πλάκα φατνώματος κρέμεται σε 4 άξονες (start/end x/y). Καλύπτει:
 * reconcile re-derive ορθογωνίου όταν κουνηθεί άξονας, only-changed null όταν δεν
 * άλλαξε, outline ring από το geometry, και ότι μη-δεμένη πλάκα → null.
 */

import { slabHostingStrategy } from '../slab-hosting-strategy';
import type { GuideOffsetLookup } from '../derive-slots';
import type { GuideBinding } from '../guide-binding-types';
import { completeSlabFromPolygonClicks } from '../../../hooks/drawing/slab-completion';
import type { SlabEntity, SlabParams } from '../../types/slab-types';

const lookup = (offsets: Record<string, number>): GuideOffsetLookup => (id) => offsets[id];

// Φάτνωμα-πλάκα: ορθογώνιο [0,4000]×[0,4000], δεμένο σε 4 άξονες.
const bindings: GuideBinding[] = [
  { guideId: 'xL', slot: 'start-x' },
  { guideId: 'xR', slot: 'end-x' },
  { guideId: 'yB', slot: 'start-y' },
  { guideId: 'yT', slot: 'end-y' },
];

const hostedSlab = (): SlabEntity => {
  const verts = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }];
  const built = completeSlabFromPolygonClicks(verts, '0', { kind: 'floor' }, 'mm');
  if (!built.ok) throw new Error('slab build failed');
  return { ...built.entity, guideBindings: bindings };
};

describe('slabHostingStrategy', () => {
  it('reconcile → το ορθογώνιο ακολουθεί τον δεξιό X-άξονα', () => {
    const update = slabHostingStrategy.reconcile(hostedSlab(), lookup({ xL: 0, xR: 6000, yB: 0, yT: 4000 }));
    expect(update).not.toBeNull();
    const nextParams = update!.nextParams as SlabParams;
    const xs = nextParams.outline.vertices.map((v) => v.x);
    expect(Math.max(...xs)).toBe(6000); // δεξιά ακμή ακολούθησε
    expect(Math.min(...xs)).toBe(0);
    expect(update!.type).toBe('slab');
  });

  it('only-changed: null όταν οι 4 άξονες ταυτίζονται με το τρέχον ορθογώνιο', () => {
    expect(slabHostingStrategy.reconcile(hostedSlab(), lookup({ xL: 0, xR: 4000, yB: 0, yT: 4000 }))).toBeNull();
  });

  it('λείπει άξονας → null (δεν μπορεί να ξαναχτιστεί η επιφάνεια)', () => {
    expect(slabHostingStrategy.reconcile(hostedSlab(), lookup({ xL: 0, xR: 6000, yB: 0 }))).toBeNull();
  });

  it('πλάκα χωρίς bindings → null', () => {
    const verts = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }];
    const built = completeSlabFromPolygonClicks(verts, '0', { kind: 'floor' }, 'mm');
    if (!built.ok) throw new Error('build failed');
    expect(slabHostingStrategy.reconcile(built.entity, lookup({}))).toBeNull();
  });

  it('outline → κλειστό ring (≥4 κορυφές)', () => {
    const update = slabHostingStrategy.reconcile(hostedSlab(), lookup({ xL: 0, xR: 6000, yB: 0, yT: 4000 }))!;
    expect(slabHostingStrategy.outline(update.nextGeometry).length).toBeGreaterThanOrEqual(4);
  });
});
