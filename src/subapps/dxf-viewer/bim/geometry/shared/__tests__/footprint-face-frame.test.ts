/**
 * footprint-face-frame — κοινό bbox/face SSoT (column-face-snap + member-column-face-snap).
 */

import {
  footprintBounds,
  distanceToFootprintBounds,
  pickDominantFace,
} from '../footprint-face-frame';

const square = [
  { x: -100, y: -100 }, { x: 100, y: -100 },
  { x: 100, y: 100 }, { x: -100, y: 100 },
];

describe('footprintBounds', () => {
  it('world-aligned extents τετραγώνου', () => {
    expect(footprintBounds(square)).toEqual({ minX: -100, maxX: 100, minY: -100, maxY: 100 });
  });
  it('< 3 κορυφές → null', () => {
    expect(footprintBounds([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull();
  });
});

describe('distanceToFootprintBounds', () => {
  const b = { minX: -100, maxX: 100, minY: -100, maxY: 100 };
  it('εντός → 0', () => {
    expect(distanceToFootprintBounds({ x: 0, y: 0 }, b)).toBe(0);
  });
  it('έξω κατά X → οριζόντια απόσταση', () => {
    expect(distanceToFootprintBounds({ x: 150, y: 0 }, b)).toBe(50);
  });
  it('διαγώνια έξω → ευκλείδεια', () => {
    expect(distanceToFootprintBounds({ x: 130, y: 140 }, b)).toBeCloseTo(50, 6); // √(30²+40²)
  });
});

describe('pickDominantFace', () => {
  const b = { minX: -100, maxX: 100, minY: -100, maxY: 100 };
  it('ανατολικά → E', () => expect(pickDominantFace({ x: 150, y: 0 }, b)).toBe('E'));
  it('δυτικά → W', () => expect(pickDominantFace({ x: -150, y: 0 }, b)).toBe('W'));
  it('βόρεια → N', () => expect(pickDominantFace({ x: 0, y: 150 }, b)).toBe('N'));
  it('νότια → S', () => expect(pickDominantFace({ x: 0, y: -150 }, b)).toBe('S'));
  it('ισοπαλία |ex|≥|ey| → προτεραιότητα E/W', () => {
    expect(pickDominantFace({ x: 150, y: 150 }, b)).toBe('E');
  });
});
