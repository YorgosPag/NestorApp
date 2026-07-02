/**
 * ADR-449 — live finish-skin (σοβάς) preview entity builder.
 * Verifies the merged-silhouette source is the FULL scene with only the dragged wall
 * + its mitered neighbours swapped for their preview versions (by id).
 */
import {
  buildFinishSkinPreviewEntities,
  buildFinishSkinPreviewEntitiesFromSwaps,
  isStructuralFinishMember,
} from '../grip-ghost-preview-draw-helpers';

interface E { readonly id: string; readonly pos: string }
const e = (id: string, pos: string): E => ({ id, pos });

describe('buildFinishSkinPreviewEntities (ADR-449 live σοβάς preview)', () => {
  it('replaces the dragged wall by id, keeps everything else', () => {
    const scene = [e('w1', 'old'), e('w2', 'stationary'), e('c1', 'col')];
    const ghost = e('w1', 'preview');
    const out = buildFinishSkinPreviewEntities(scene, ghost, []);
    expect(out).toEqual([e('w1', 'preview'), e('w2', 'stationary'), e('c1', 'col')]);
    // stationary entities keep their reference identity (no needless churn)
    expect(out[1]).toBe(scene[1]);
    expect(out[2]).toBe(scene[2]);
  });

  it('replaces mitered neighbours too (fresh join at the new corner)', () => {
    const scene = [e('w1', 'old'), e('w2', 'old-miter'), e('w3', 'far')];
    const ghost = e('w1', 'preview');
    const neighbour = e('w2', 'fresh-miter');
    const out = buildFinishSkinPreviewEntities(scene, ghost, [neighbour]);
    expect(out).toEqual([e('w1', 'preview'), e('w2', 'fresh-miter'), e('w3', 'far')]);
  });

  it('keeps the full scene so the silhouette classifier/union sees stationary walls', () => {
    const scene = [e('w1', 'old'), e('w2', 's'), e('w3', 's'), e('w4', 's')];
    const out = buildFinishSkinPreviewEntities(scene, e('w1', 'preview'), []);
    expect(out).toHaveLength(4);
    expect(out.map((x) => x.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
  });

  it('is a no-op mapping when the ghost id is absent (defensive)', () => {
    const scene = [e('a', '1'), e('b', '2')];
    const out = buildFinishSkinPreviewEntities(scene, e('zzz', 'x'), []);
    expect(out).toEqual(scene);
  });
});

describe('buildFinishSkinPreviewEntitiesFromSwaps (ADR-449 MULTI-member move σοβάς)', () => {
  it('swaps EVERY dragged member at once (single unified silhouette source)', () => {
    const scene = [e('w1', 'old'), e('w2', 'old'), e('w3', 'stationary'), e('c1', 'col')];
    const swaps = new Map<string, E>([
      ['w1', e('w1', 'moved')],
      ['w2', e('w2', 'moved')],
    ]);
    const out = buildFinishSkinPreviewEntitiesFromSwaps(scene, swaps);
    expect(out).toEqual([e('w1', 'moved'), e('w2', 'moved'), e('w3', 'stationary'), e('c1', 'col')]);
    // stationary entities keep reference identity (no needless churn)
    expect(out[2]).toBe(scene[2]);
    expect(out[3]).toBe(scene[3]);
  });

  it('keeps the full scene when swaps is empty (no structural member moved)', () => {
    const scene = [e('a', '1'), e('b', '2')];
    const out = buildFinishSkinPreviewEntitiesFromSwaps(scene, new Map());
    expect(out).toEqual(scene);
    expect(out[0]).toBe(scene[0]);
  });

  it('is the SSoT the single-member builder delegates to (same result)', () => {
    const scene = [e('w1', 'old'), e('w2', 'old-miter'), e('w3', 'far')];
    const viaSingle = buildFinishSkinPreviewEntities(scene, e('w1', 'preview'), [e('w2', 'fresh-miter')]);
    const viaSwaps = buildFinishSkinPreviewEntitiesFromSwaps(
      scene,
      new Map<string, E>([['w1', e('w1', 'preview')], ['w2', e('w2', 'fresh-miter')]]),
    );
    expect(viaSwaps).toEqual(viaSingle);
  });
});

describe('isStructuralFinishMember (ADR-449 σοβά preview gate)', () => {
  it('is true only for finish-skin-bearing structural members', () => {
    expect(isStructuralFinishMember('wall')).toBe(true);
    expect(isStructuralFinishMember('column')).toBe(true);
    expect(isStructuralFinishMember('beam')).toBe(true);
  });

  it('is false for non-structural types and undefined', () => {
    expect(isStructuralFinishMember('line')).toBe(false);
    expect(isStructuralFinishMember('hatch')).toBe(false);
    expect(isStructuralFinishMember(undefined)).toBe(false);
  });
});
