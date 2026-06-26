/**
 * ADR-534 — commitCeilingSlabsFromStructure: idempotent create. Πλαίσιο δοκαριών → 1 ενιαία πλάκα·
 * 2η κλήση (πλάκα στη σκηνή) → 0 νέες (up-to-date).
 */

import type { SceneModel } from '../../../types/scene';
import type { ICommand } from '../../../core/commands/interfaces';
import { commitCeilingSlabsFromStructure } from '../ceiling-slab-commit';
import { buildCeilingSlabsFromStructure } from '../ceiling-slab-from-structure';
import type { Entity } from '../../../types/entities';
import type { BeamParams } from '../../types/beam-types';

const M = 1000, TOP = 3000, W = 250;

function beam(id: string, sx: number, sy: number, ex: number, ey: number) {
  const params: BeamParams = {
    kind: 'straight', startPoint: { x: sx, y: sy, z: 0 }, endPoint: { x: ex, y: ey, z: 0 },
    width: W, depth: 400, topElevation: TOP, sceneUnits: 'mm',
  };
  return { id, type: 'beam' as const, params };
}

// Καθαρό πλαίσιο 4 δοκαριών → 1 ενιαία πλάκα.
function frameEntities() {
  return [
    beam('s', 0, 0, 12 * M, 0), beam('e', 12 * M, 0, 12 * M, 12 * M),
    beam('n', 12 * M, 12 * M, 0, 12 * M), beam('w', 0, 12 * M, 0, 0),
  ];
}

function makeDeps(entities: readonly unknown[]) {
  const scene = { entities } as unknown as SceneModel;
  const commands: ICommand[] = [];
  return {
    getLevelScene: () => scene,
    setLevelScene: () => {},
    levelId: 'lvl',
    sceneUnits: 'mm' as const,
    executeCommand: (c: ICommand) => commands.push(c),
    commands,
  };
}

describe('ADR-534 commitCeilingSlabsFromStructure — idempotency', () => {
  it('1η κλήση (πλαίσιο δοκαριών) → 1 ενιαία πλάκα', () => {
    const deps = makeDeps(frameEntities());
    const r = commitCeilingSlabsFromStructure(deps);
    expect(r.ok).toBe(true);
    expect(r.created).toBe(1);
    expect(r.skipped).toBe(0);
    expect(deps.commands.length).toBe(1);
  });

  it('2η κλήση (πλάκα ήδη στη σκηνή) → 0 νέες, up-to-date', () => {
    const base = frameEntities();
    const built = buildCeilingSlabsFromStructure(base as unknown as Entity[], {}, 'lvl', 'mm');
    const deps = makeDeps([...base, ...built.slabs]);
    const r = commitCeilingSlabsFromStructure(deps);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('up-to-date');
    expect(r.created).toBe(0);
    expect(r.skipped).toBe(1);
    expect(deps.commands.length).toBe(0);
  });

  it('κανένα δομικό μέλος → no-bays', () => {
    const r = commitCeilingSlabsFromStructure(makeDeps([]));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-bays');
  });
});
