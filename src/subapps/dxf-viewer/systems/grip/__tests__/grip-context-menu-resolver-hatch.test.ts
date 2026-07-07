/**
 * ADR-507 (Giorgio 2026-07-07) — resolveContextMenuSections hatch-ops coverage.
 *
 * Verifies the right-click grip menu injects a `hatch-ops` section keyed by the
 * `hatchGripKind`: Remove Vertex on a boundary vertex grip, Add Vertex on an
 * edge-midpoint grip, and nothing extra for a non-hatch grip.
 */

import { resolveContextMenuSections } from '../grip-context-menu-resolver';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';
import type { Entity } from '../../../types/entities';

const ENTITY = { id: 'h1', type: 'hatch' } as unknown as Entity;

function grip(kind?: string): UnifiedGripInfo {
  return { entityId: 'h1', ...(kind ? { hatchGripKind: kind } : {}) } as unknown as UnifiedGripInfo;
}

function hatchOps(g: UnifiedGripInfo) {
  return resolveContextMenuSections(ENTITY, g).find((s) => s.id === 'hatch-ops');
}

describe('resolveContextMenuSections — hatch-ops', () => {
  it('vertex grip → hatch-ops with Remove Vertex', () => {
    const section = hatchOps(grip('hatch-vertex-0-2'));
    expect(section).toBeDefined();
    expect(section!.items.map((i) => i.id)).toEqual(['hatch-ops:removeVertex']);
    expect(section!.titleKey).toBe('gripContextMenu.section.hatchOps');
  });

  it('edge-midpoint grip → hatch-ops with Add Vertex', () => {
    const section = hatchOps(grip('hatch-edge-midpoint-1-0'));
    expect(section).toBeDefined();
    expect(section!.items.map((i) => i.id)).toEqual(['hatch-ops:addVertex']);
  });

  it('gradient / no-hatch grip → no hatch-ops section', () => {
    expect(hatchOps(grip('hatch-gradient-origin'))).toBeUndefined();
    expect(hatchOps(grip())).toBeUndefined();
  });

  it('the section is inserted before the terminal (Exit) section', () => {
    const ids = resolveContextMenuSections(ENTITY, grip('hatch-vertex-0-0')).map((s) => s.id);
    expect(ids).toEqual(['modes', 'extras', 'hatch-ops', 'terminal']);
  });
});
