import { CATALOG_LIMITS } from '../../vocabulary/catalog-limits';
import { rebaseSubtree, subtreeHeight, validateCategoryPlacement, type CategoryNode } from '../category-tree';

// hvac ─┬─ split ── wall
//       └─ fancoil
// solar
const TREE: CategoryNode[] = [
  { id: 'hvac', parentId: null, ancestorIds: [] },
  { id: 'split', parentId: 'hvac', ancestorIds: ['hvac'] },
  { id: 'wall', parentId: 'split', ancestorIds: ['hvac', 'split'] },
  { id: 'fancoil', parentId: 'hvac', ancestorIds: ['hvac'] },
  { id: 'solar', parentId: null, ancestorIds: [] },
];
const node = (id: string) => TREE.find((candidate) => candidate.id === id) as CategoryNode;
const codes = (issues: ReturnType<typeof validateCategoryPlacement>) => issues.map((issue) => issue.code);

describe('validateCategoryPlacement', () => {
  it('allows a new root and a new child of an existing node', () => {
    expect(validateCategoryPlacement(null, null, TREE)).toEqual([]);
    expect(validateCategoryPlacement(null, 'wall', TREE)).toEqual([]);
  });

  it('rejects an unknown parent', () => {
    expect(codes(validateCategoryPlacement(null, 'ghost', TREE))).toEqual(['categoryParentUnknown']);
  });

  it('rejects moving a node under itself or under its own descendant', () => {
    expect(codes(validateCategoryPlacement(node('hvac'), 'hvac', TREE))).toEqual(['categoryCycle']);
    expect(codes(validateCategoryPlacement(node('hvac'), 'wall', TREE))).toEqual(['categoryCycle']);
  });

  it('counts the height of the moved subtree against the depth limit', () => {
    const chain: CategoryNode[] = Array.from({ length: CATALOG_LIMITS.maxCategoryDepth + 1 }, (_, depth) => ({
      id: `c${depth}`,
      parentId: depth === 0 ? null : `c${depth - 1}`,
      ancestorIds: Array.from({ length: depth }, (__, index) => `c${index}`),
    }));
    const all = [...chain, ...TREE];
    expect(subtreeHeight(node('hvac'), all)).toBe(2);
    const deepest = chain[chain.length - 3].id;
    expect(codes(validateCategoryPlacement(node('hvac'), deepest, all))).toEqual(['categoryDepthExceeded']);
  });
});

describe('rebaseSubtree', () => {
  it('rewrites the ancestors of the moved node and every descendant', () => {
    const result = rebaseSubtree(node('split'), node('solar'), TREE);
    expect(Object.fromEntries(result)).toEqual({ split: ['solar'], wall: ['solar', 'split'] });
  });

  it('moves a subtree to the root', () => {
    const result = rebaseSubtree(node('split'), null, TREE);
    expect(Object.fromEntries(result)).toEqual({ split: [], wall: ['split'] });
  });
});
