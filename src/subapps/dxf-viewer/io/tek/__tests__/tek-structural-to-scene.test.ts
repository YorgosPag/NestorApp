/**
 * ADR-531 Φ5b.1 — tests για τους 2Δ mappers (τοίχος/κούφωμα/διάσταση → scene primitives).
 */

import { tekWallToEntities, tekDimToEntities } from '../tek-structural-to-scene';
import type { TekWallRecord, TekDimRecord, TekXMatrix } from '../tek-import-types';

const mat = (x00: number, x11: number, x20: number, x21: number): TekXMatrix =>
  ({ x00, x01: 0, x10: 0, x11, x20, x21 });

const WALL: TekWallRecord = {
  matrix: mat(5.03, 0.25, -8.25, 0.58),
  heightM: 3, elevationM: 0, innerWidthM: 0.09, color: '80BCFC',
  openings: [
    { matrix: mat(1.4, -1, -7.86, 0.73), elevationM: 1, topM: 2.2, style: 1, color: '50A490' },
    { matrix: mat(-1.4, -1, -4.16, 0.73), elevationM: 1, topM: 2.2, style: 0, color: '50A490' },
  ],
};

const DIM: TekDimRecord = {
  color: '00FF00',
  textSizeM: 0.15875,
  segs: [{
    end0: { x: -2.21, y: 6.98 }, end1: { x: -0.11, y: 6.98 },
    gap0: { x: -1.32, y: 6.98 }, gap1: { x: -1.0, y: 6.98 },
    text: '2.10', textMatrix: mat(1, 1, -1.32, 6.39),
  }],
};

describe('tekWallToEntities (ADR-531 Φ5b.1)', () => {
  const entities = tekWallToEntities(WALL, 'mm');

  it('παράγει footprint (4) + 2 κουφώματα × 3 = 10 γραμμές', () => {
    expect(entities).toHaveLength(10);
    expect(entities.every((e) => e.type === 'line')).toBe(true);
  });

  it('το footprint έχει μήκος ~5.03m (→ ~5030mm)', () => {
    const xs = entities.flatMap((e) => (e.type === 'line' ? [e.start.x, e.end.x] : []));
    const span = Math.max(...xs) - Math.min(...xs);
    expect(span).toBeGreaterThan(5000);
    expect(xs.every((x) => Number.isFinite(x))).toBe(true);
  });

  it('χρησιμοποιεί το χρώμα τοίχου/ανοίγματος (#-prefixed)', () => {
    expect(entities[0].type === 'line' && entities[0].color).toBe('#80BCFC');
    const opening = entities.find((e) => e.type === 'line' && e.color === '#50A490');
    expect(opening).toBeDefined();
  });
});

describe('tekDimToEntities (ADR-531 Φ5b.1)', () => {
  const entities = tekDimToEntities(DIM, 'mm');

  it('παράγει 2 γραμμές (με κενό) + 1 κείμενο τιμής', () => {
    expect(entities.filter((e) => e.type === 'line')).toHaveLength(2);
    const texts = entities.filter((e) => e.type === 'text');
    expect(texts).toHaveLength(1);
    expect(texts[0].type === 'text' && texts[0].text).toBe('2.10');
  });

  it('το κείμενο έχει ύψος από το <size> (0.15875m → ~159mm)', () => {
    const txt = entities.find((e) => e.type === 'text');
    expect(txt && txt.type === 'text' && txt.height).toBeCloseTo(158.75, 1);
  });
});
