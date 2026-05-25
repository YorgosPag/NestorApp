/**
 * ADR-375 — Object Styles tests.
 */
import { describe, it, expect } from '@jest/globals';
import { DEFAULT_OBJECT_STYLES, type BimCategory } from '../bim-object-styles';
import { PEN_COUNT } from '../bim-pen-table';

const CATEGORIES: BimCategory[] = [
  'wall', 'column', 'beam', 'slab', 'opening', 'slab-opening',
  'stair', 'roof', 'ceiling', 'dimension', 'hatch', 'grip',
];

describe('DEFAULT_OBJECT_STYLES', () => {
  it('has an entry for every BimCategory', () => {
    for (const cat of CATEGORIES) {
      expect(DEFAULT_OBJECT_STYLES[cat]).toBeDefined();
    }
  });

  it('all projectionPen values are within 1-16', () => {
    for (const cat of CATEGORIES) {
      const p = DEFAULT_OBJECT_STYLES[cat].projectionPen;
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThanOrEqual(PEN_COUNT);
    }
  });

  it('all cutPen values are within 1-16', () => {
    for (const cat of CATEGORIES) {
      const c = DEFAULT_OBJECT_STYLES[cat].cutPen;
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(PEN_COUNT);
    }
  });

  it('cutPen >= projectionPen (cut lines are heavier)', () => {
    for (const cat of CATEGORIES) {
      const style = DEFAULT_OBJECT_STYLES[cat];
      expect(style.cutPen).toBeGreaterThanOrEqual(style.projectionPen);
    }
  });

  it('column cutPen (9) > wall cutPen (7) — structural hierarchy', () => {
    expect(DEFAULT_OBJECT_STYLES.column.cutPen).toBeGreaterThan(DEFAULT_OBJECT_STYLES.wall.cutPen);
  });

  it('wall cutPen > beam cutPen > opening cutPen — hierarchy', () => {
    expect(DEFAULT_OBJECT_STYLES.wall.cutPen).toBeGreaterThan(DEFAULT_OBJECT_STYLES.beam.cutPen);
    expect(DEFAULT_OBJECT_STYLES.beam.cutPen).toBeGreaterThan(DEFAULT_OBJECT_STYLES.opening.cutPen);
  });
});
