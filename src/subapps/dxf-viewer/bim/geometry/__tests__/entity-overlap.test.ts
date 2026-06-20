/**
 * ADR-398 §ghost coloring — `findEntityOverlap` (generalized footprint hit-test SSoT).
 *
 * Επαληθεύει ότι ο ίδιος point-in-polygon έλεγχος δουλεύει για ΟΠΟΙΟΝΔΗΠΟΤΕ extractor
 * (κολόνα→footprint, δοκάρι→outline) — η γενίκευση που τροφοδοτεί τον `findColumnOverlap`.
 */

import { findEntityOverlap } from '../entity-overlap';
import type { Entity } from '../../../types/entities';

function column(id: string, cx: number, cy: number, half = 200): Entity {
  return {
    id, type: 'column',
    geometry: { footprint: { vertices: [
      { x: cx - half, y: cy - half }, { x: cx + half, y: cy - half },
      { x: cx + half, y: cy + half }, { x: cx - half, y: cy + half },
    ] } },
  } as unknown as Entity;
}

function beam(id: string): Entity {
  return {
    id, type: 'beam',
    geometry: { outline: { vertices: [
      { x: 0, y: -100 }, { x: 10000, y: -100 },
      { x: 10000, y: 100 }, { x: 0, y: 100 },
    ] } },
  } as unknown as Entity;
}

const columnFootprint = (e: Entity): readonly { x: number; y: number }[] | null =>
  e.type === 'column' ? (e as { geometry?: { footprint?: { vertices?: { x: number; y: number }[] } } }).geometry?.footprint?.vertices ?? null : null;

const beamOutline = (e: Entity): readonly { x: number; y: number }[] | null =>
  e.type === 'beam' ? (e as { geometry?: { outline?: { vertices?: { x: number; y: number }[] } } }).geometry?.outline?.vertices ?? null : null;

describe('findEntityOverlap — generalized polygon hit-test', () => {
  it('cursor μέσα σε column footprint (column extractor) → id', () => {
    expect(findEntityOverlap({ x: 8000, y: 0 }, [column('c1', 8000, 0)], columnFootprint)).toBe('c1');
  });

  it('cursor εκτός → null', () => {
    expect(findEntityOverlap({ x: 50000, y: 50000 }, [column('c1', 0, 0)], columnFootprint)).toBeNull();
  });

  it('extractor φιλτράρει τύπο: column extractor αγνοεί δοκάρι → null', () => {
    expect(findEntityOverlap({ x: 4000, y: 0 }, [beam('b1')], columnFootprint)).toBeNull();
  });

  it('cursor μέσα σε beam outline (beam extractor) → id', () => {
    expect(findEntityOverlap({ x: 4000, y: 0 }, [beam('b1')], beamOutline)).toBe('b1');
  });

  it('επιστρέφει το ΠΡΩΤΟ entity που περιέχει το σημείο', () => {
    expect(findEntityOverlap({ x: 0, y: 0 }, [column('c1', 0, 0), column('c2', 0, 0)], columnFootprint)).toBe('c1');
  });
});
