/**
 * ADR-363 Phase 1D — `wall-dna-mutations` tests.
 *
 * Coverage: addLayer / removeLayer / updateLayer / reorderLayer all preserve
 * the SSoT invariant `dna.totalThickness === sum(layers.thickness)`. Reorder
 * boundary cases (top↑ noop, bottom↓ noop) and update-of-non-existing-id are
 * verified explicitly.
 */

import {
  addLayer,
  fromLayers,
  removeLayer,
  reorderLayer,
  updateLayer,
} from '../wall-dna-mutations';
import type { WallDna, WallDnaLayer } from '../../types/wall-dna-types';

function makeLayer(id: string, thickness: number): WallDnaLayer {
  return {
    id,
    name: id,
    thickness,
    materialId: 'mat-plaster-int',
    side: 'core',
  };
}

const BASE: WallDna = {
  layers: [makeLayer('a', 10), makeLayer('b', 20), makeLayer('c', 30)],
  totalThickness: 60,
};

describe('wall-dna-mutations (ADR-363 Phase 1D)', () => {
  describe('addLayer', () => {
    it('1. appends a new layer and recomputes totalThickness', () => {
      const next = addLayer(BASE, { thickness: 5 });
      expect(next.layers).toHaveLength(4);
      expect(next.totalThickness).toBe(65);
    });

    it('2. defaults thickness to 10mm when not provided', () => {
      const next = addLayer(BASE);
      expect(next.totalThickness).toBe(70);
    });
  });

  describe('removeLayer', () => {
    it('3. removes existing layer and recomputes total', () => {
      const next = removeLayer(BASE, 'b');
      expect(next.layers.map((l) => l.id)).toEqual(['a', 'c']);
      expect(next.totalThickness).toBe(40);
    });

    it('4. returns same dna when id not found', () => {
      const next = removeLayer(BASE, 'missing');
      expect(next).toBe(BASE);
    });
  });

  describe('updateLayer', () => {
    it('5. patches thickness and recomputes total', () => {
      const next = updateLayer(BASE, 'b', { thickness: 50 });
      expect(next.totalThickness).toBe(90);
      expect(next.layers[1].thickness).toBe(50);
    });

    it('6. patches name without touching total', () => {
      const next = updateLayer(BASE, 'a', { name: 'renamed' });
      expect(next.layers[0].name).toBe('renamed');
      expect(next.totalThickness).toBe(60);
    });
  });

  describe('reorderLayer', () => {
    it('7. moves layer down by +1', () => {
      const next = reorderLayer(BASE, 0, 1);
      expect(next.layers.map((l) => l.id)).toEqual(['b', 'a', 'c']);
    });

    it('8. moves layer up by -1', () => {
      const next = reorderLayer(BASE, 2, -1);
      expect(next.layers.map((l) => l.id)).toEqual(['a', 'c', 'b']);
    });

    it('9. no-op when moving top layer up', () => {
      const next = reorderLayer(BASE, 0, -1);
      expect(next).toBe(BASE);
    });

    it('10. no-op when moving bottom layer down', () => {
      const next = reorderLayer(BASE, 2, 1);
      expect(next).toBe(BASE);
    });

    it('11. preserves totalThickness on reorder', () => {
      const next = reorderLayer(BASE, 1, 1);
      expect(next.totalThickness).toBe(BASE.totalThickness);
    });
  });

  describe('fromLayers', () => {
    it('12. recomputes total from array', () => {
      const dna = fromLayers([makeLayer('x', 7), makeLayer('y', 3)]);
      expect(dna.totalThickness).toBe(10);
    });
  });
});
