/**
 * ADR-505 §A — `export-entity-scope` SSoT (content filter).
 *
 * Επαληθεύει: σωστό partition DXF-native vs BIM μέσω `isBimEntity` (μία αλήθεια)·
 * `both` = passthrough copy (νέο array, μηδέν mutation)· scope predicates.
 */

import {
  resolveExportEntities,
  scopeIncludesBim,
  scopeIncludesDxfNative,
} from '../export-entity-scope';
import type { Entity } from '../../../types/entities';

function ent(type: string, id: string): Entity {
  return { id, type, layerId: 'lyr_x' } as unknown as Entity;
}

const SCENE: Entity[] = [
  ent('line', 'l1'),
  ent('wall', 'w1'),
  ent('text', 't1'),
  ent('column', 'c1'),
  ent('beam', 'b1'),
  ent('arc', 'a1'),
];

describe('resolveExportEntities — partition by content scope', () => {
  it('dxf-only → only native DXF entities (BIM excluded)', () => {
    const r = resolveExportEntities(SCENE, 'dxf-only');
    expect(r.map((e) => e.id).sort()).toEqual(['a1', 'l1', 't1']);
  });

  it('bim-only → only BIM entities', () => {
    const r = resolveExportEntities(SCENE, 'bim-only');
    expect(r.map((e) => e.id).sort()).toEqual(['b1', 'c1', 'w1']);
  });

  it('both → every entity', () => {
    const r = resolveExportEntities(SCENE, 'both');
    expect(r).toHaveLength(SCENE.length);
  });

  it('both → returns a new array, never the same reference (no mutation)', () => {
    const r = resolveExportEntities(SCENE, 'both');
    expect(r).not.toBe(SCENE);
    r.pop();
    expect(SCENE).toHaveLength(6);
  });

  it('empty scene → empty for every scope', () => {
    expect(resolveExportEntities([], 'dxf-only')).toEqual([]);
    expect(resolveExportEntities([], 'bim-only')).toEqual([]);
    expect(resolveExportEntities([], 'both')).toEqual([]);
  });
});

describe('scope predicates', () => {
  it('scopeIncludesBim', () => {
    expect(scopeIncludesBim('bim-only')).toBe(true);
    expect(scopeIncludesBim('both')).toBe(true);
    expect(scopeIncludesBim('dxf-only')).toBe(false);
  });

  it('scopeIncludesDxfNative', () => {
    expect(scopeIncludesDxfNative('dxf-only')).toBe(true);
    expect(scopeIncludesDxfNative('both')).toBe(true);
    expect(scopeIncludesDxfNative('bim-only')).toBe(false);
  });
});
