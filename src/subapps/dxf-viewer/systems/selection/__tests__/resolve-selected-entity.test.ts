/**
 * ADR-484 — pure SSoT resolver του primary-selected entity (active scene +
 * cross-level foundation fallback).
 */

import { resolveSelectedEntityFrom } from '../resolve-selected-entity';
import type { Entity } from '../../../types/entities';

const ent = (id: string, type = 'foundation'): Entity =>
  ({ id, type } as unknown as Entity);

describe('resolveSelectedEntityFrom (ADR-484)', () => {
  const sceneEntities = [ent('s1', 'wall'), ent('s2', 'column')];
  const crossLevel = [ent('f1'), ent('f2')];

  it('επιστρέφει null χωρίς επιλογή', () => {
    expect(resolveSelectedEntityFrom(null, sceneEntities, crossLevel)).toBeNull();
  });

  it('βρίσκει entity στο active scene (πρώτη πηγή)', () => {
    expect(resolveSelectedEntityFrom('s2', sceneEntities, crossLevel)?.id).toBe('s2');
  });

  it('fallback στα cross-level footings όταν λείπει από το scene', () => {
    expect(resolveSelectedEntityFrom('f1', sceneEntities, crossLevel)?.id).toBe('f1');
  });

  it('active scene προηγείται του cross-level σε σύγκρουση id (anti-echo shadow)', () => {
    const dup = [ent('dup', 'foundation')];
    const scene = [ent('dup', 'wall')];
    expect(resolveSelectedEntityFrom('dup', scene, dup)?.type).toBe('wall');
  });

  it('null scene → ψάχνει μόνο cross-level', () => {
    expect(resolveSelectedEntityFrom('f2', null, crossLevel)?.id).toBe('f2');
    expect(resolveSelectedEntityFrom('s1', null, crossLevel)).toBeNull();
  });

  it('id εκτός όλων των πηγών → null', () => {
    expect(resolveSelectedEntityFrom('ghost', sceneEntities, crossLevel)).toBeNull();
  });
});
