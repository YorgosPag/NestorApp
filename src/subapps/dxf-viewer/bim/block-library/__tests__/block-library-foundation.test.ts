/**
 * Block Library — foundation specs (Milestone 1).
 * capture (import scene → distinct defs) + place (def → BlockEntity).
 */

import type { Entity } from '../../../types/entities';
import { captureBlockDefsFromScene } from '../capture-blocks-from-scene';
import { buildBlockEntityFromDef } from '../place-block-from-library';
import type { InSessionBlockDef } from '../block-library-types';

/** Minimal line member σε BLOCK-LOCAL space. */
function line(id: string, x2: number): Entity {
  return {
    id,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: x2, y: 0 },
    layerId: '0',
  } as unknown as Entity;
}

/** Minimal BlockEntity για τη σκηνή. */
function block(name: string, members: Entity[]): Entity {
  return {
    id: `blk_${name}`,
    type: 'block',
    name,
    layerId: '0',
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    entities: members,
    visible: true,
  } as unknown as Entity;
}

describe('captureBlockDefsFromScene', () => {
  it('μαζεύει distinct named blocks (πρώτο instance κερδίζει)', () => {
    const scene: Entity[] = [
      block('CHAIR', [line('a', 10)]),
      block('CHAIR', [line('b', 20)]), // duplicate name → αγνοείται
      block('WC', [line('c', 30)]),
      line('loose', 5), // non-block → αγνοείται
    ];
    const defs = captureBlockDefsFromScene(scene);
    expect(defs.map((d) => d.name)).toEqual(['CHAIR', 'WC']);
    // πρώτο instance κερδίζει
    expect(defs[0].localMembers).toHaveLength(1);
    expect((defs[0].localMembers[0] as { id: string }).id).toBe('a');
  });

  it('παραλείπει anonymous decorations (*D) και άδεια blocks', () => {
    const scene: Entity[] = [
      block('*D0', [line('d', 10)]), // dimension decoration → skip
      block('EMPTY', []), // χωρίς μέλη → skip
      block('SOFA', [line('e', 40)]),
    ];
    const defs = captureBlockDefsFromScene(scene);
    expect(defs.map((d) => d.name)).toEqual(['SOFA']);
  });
});

describe('buildBlockEntityFromDef', () => {
  const def: InSessionBlockDef = {
    name: 'CHAIR',
    localMembers: [line('m1', 10), line('m2', 20)],
    boundsMm: null,
  };

  it('χτίζει BlockEntity με σωστό placement transform', () => {
    const entity = buildBlockEntityFromDef(def, {
      position: { x: 100, y: 50 },
      scale: { x: 2, y: 2 },
      rotation: 90,
      layerId: 'FURN',
    });
    expect(entity.type).toBe('block');
    expect(entity.name).toBe('CHAIR');
    expect(entity.position).toEqual({ x: 100, y: 50 });
    expect(entity.scale).toEqual({ x: 2, y: 2 });
    expect(entity.rotation).toBe(90);
    expect(entity.layerId).toBe('FURN');
    expect(entity.entities).toHaveLength(2);
  });

  it('εφαρμόζει defaults (scale 1, rotation 0, layer 0)', () => {
    const entity = buildBlockEntityFromDef(def, { position: { x: 0, y: 0 } });
    expect(entity.scale).toEqual({ x: 1, y: 1 });
    expect(entity.rotation).toBe(0);
    expect(entity.layerId).toBe('0');
  });

  it('αναγεννά member ids και κλωνοποιεί (χωρίς mutation του def)', () => {
    const a = buildBlockEntityFromDef(def, { position: { x: 0, y: 0 } });
    const b = buildBlockEntityFromDef(def, { position: { x: 5, y: 5 } });

    const aIds = a.entities.map((m) => m.id);
    const bIds = b.entities.map((m) => m.id);
    // φρέσκα, μοναδικά ids ανά instance
    expect(new Set([...aIds, ...bIds]).size).toBe(4);
    expect(aIds).not.toContain('m1');

    // local γεωμετρία διατηρείται (deepClone, όχι reference)
    expect((a.entities[0] as { end: { x: number } }).end.x).toBe(10);
    expect(a.entities[0]).not.toBe(def.localMembers[0]);
    // ο ορισμός δεν πειράχτηκε
    expect((def.localMembers[0] as { id: string }).id).toBe('m1');
  });
});
