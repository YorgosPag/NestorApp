import { entityToGeometry } from '../overlay-persistence-utils';
import type { Entity } from '../../../types/entities';
import type { DrawingTool } from '../drawing-types';

// Minimal mock factory — only fields checked by entityToGeometry
function mkBase(type: string) {
  return { id: 'e1', type, name: undefined } as Pick<Entity, 'id' | 'name'>;
}

describe('entityToGeometry — tool → geometry mapping matrix', () => {
  it('line tool + line entity → line geometry', () => {
    const entity = { ...mkBase('line'), start: { x: 0, y: 0 }, end: { x: 5, y: 5 } } as Entity;
    const result = entityToGeometry(entity, 'line' as DrawingTool);
    expect(result).toEqual({ type: 'line', start: { x: 0, y: 0 }, end: { x: 5, y: 5 } });
  });

  it('rectangle tool + rectangle entity → closed polygon (4 vertices)', () => {
    const entity = { ...mkBase('rectangle'), x: 0, y: 0, width: 10, height: 5, corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 5 } } as Entity;
    const result = entityToGeometry(entity, 'rectangle' as DrawingTool);
    expect(result?.type).toBe('polygon');
    if (result?.type === 'polygon') {
      expect(result.closed).toBe(true);
      expect(result.vertices).toHaveLength(4);
    }
  });

  it('circle tool + circle entity → circle geometry', () => {
    const entity = { ...mkBase('circle'), center: { x: 5, y: 5 }, radius: 3 } as Entity;
    const result = entityToGeometry(entity, 'circle' as DrawingTool);
    expect(result).toEqual({ type: 'circle', center: { x: 5, y: 5 }, radius: 3 });
  });

  it('arc-3p tool + arc entity → arc geometry with counterclockwise', () => {
    const entity = { ...mkBase('arc'), center: { x: 0, y: 0 }, radius: 5, startAngle: 0, endAngle: Math.PI, counterclockwise: true } as Entity;
    const result = entityToGeometry(entity, 'arc-3p' as DrawingTool);
    expect(result?.type).toBe('arc');
    if (result?.type === 'arc') {
      expect(result.counterclockwise).toBe(true);
    }
  });

  it('polyline tool + polyline entity → open polygon', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }];
    const entity = { ...mkBase('polyline'), vertices } as Entity;
    const result = entityToGeometry(entity, 'polyline' as DrawingTool);
    expect(result?.type).toBe('polygon');
    if (result?.type === 'polygon') {
      expect(result.closed).toBe(false);
    }
  });

  it('polygon tool + polyline entity → closed polygon', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }];
    const entity = { ...mkBase('polyline'), vertices } as Entity;
    const result = entityToGeometry(entity, 'polygon' as DrawingTool);
    expect(result?.type).toBe('polygon');
    if (result?.type === 'polygon') {
      expect(result.closed).toBe(true);
    }
  });

  it('measure-distance tool + line entity → distance measurement', () => {
    const entity = { ...mkBase('line'), start: { x: 0, y: 0 }, end: { x: 3, y: 4 } } as Entity;
    const result = entityToGeometry(entity, 'measure-distance' as DrawingTool);
    expect(result?.type).toBe('measurement');
    if (result?.type === 'measurement') {
      expect(result.mode).toBe('distance');
      expect(result.value).toBeCloseTo(5); // hypot(3,4)
      expect(result.points).toHaveLength(2);
    }
  });

  it('measure-area tool + polyline entity → area measurement', () => {
    // Right triangle 3×4: area = 6
    const vertices = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }];
    const entity = { ...mkBase('polyline'), vertices } as Entity;
    const result = entityToGeometry(entity, 'measure-area' as DrawingTool);
    expect(result?.type).toBe('measurement');
    if (result?.type === 'measurement') {
      expect(result.mode).toBe('area');
      expect(result.value).toBeCloseTo(6);
    }
  });

  it('measure-angle tool + angle-measurement entity → angle measurement', () => {
    const entity = { ...mkBase('angle-measurement'), vertex: { x: 0, y: 0 }, point1: { x: 1, y: 0 }, point2: { x: 0, y: 1 }, angle: 90 } as Entity;
    const result = entityToGeometry(entity, 'measure-angle' as DrawingTool);
    expect(result?.type).toBe('measurement');
    if (result?.type === 'measurement') {
      expect(result.mode).toBe('angle');
      expect(result.value).toBe(90);
      expect(result.points).toHaveLength(3);
    }
  });

  it('returns null for mismatched tool+entity combination', () => {
    const entity = { ...mkBase('line'), start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as Entity;
    const result = entityToGeometry(entity, 'circle' as DrawingTool);
    expect(result).toBeNull();
  });
});
