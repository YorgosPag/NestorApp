/**
 * ADR-531 Φ5b.1+ — tests για τους mappers (τοίχος-με-κουφώματα / διάσταση → scene primitives).
 */

import { tekWallToEntities, tekDimToEntities } from '../tek-structural-to-scene';
import type { TekWallRecord, TekDimRecord, TekXMatrix, TekOpeningRecord } from '../tek-import-types';

const mat = (x00: number, x11: number, x20: number, x21: number): TekXMatrix =>
  ({ x00, x01: 0, x10: 0, x11, x20, x21 });

const opening = (x00: number, x20: number, style: number, side: number): TekOpeningRecord => ({
  matrix: mat(x00, -1, x20, 0.73),
  elevationM: 1, topM: 2.2, style, side,
  frameWidthM: 0.15, frameThicknessM: 0.03, jambWidthM: 0.05, jambThicknessM: 0.05,
  ledgeHeightM: 0.03, color: '50A490',
});

const WALL: TekWallRecord = {
  matrix: mat(5.03, 0.25, -8.25, 0.58),
  heightM: 3, elevationM: 0, innerWidthM: 0.09, color: '80BCFC',
  openings: [opening(1.4, -7.86, 1, 3), opening(-1.4, -4.16, 0, 2)],
};

const DIM: TekDimRecord = {
  color: '00FF00', textSizeM: 0.15875, endStyle: 8, refPoints: [],
  segs: [{
    end0: { x: -2.21, y: 6.98 }, end1: { x: -0.11, y: 6.98 },
    gap0: { x: -1.32, y: 6.98 }, gap1: { x: -1.0, y: 6.98 },
    text: '2.10', textMatrix: mat(1, 1, -1.32, 6.39),
  }],
};

describe('tekWallToEntities (ADR-531 Φ5b.1+)', () => {
  const entities = tekWallToEntities(WALL, 'mm');

  it('παράγει τοίχο-με-κουφώματα (12) + 2 παράθυρα × 4 = 20 γραμμές', () => {
    expect(entities).toHaveLength(20);
    expect(entities.every((e) => e.type === 'line')).toBe(true);
  });

  it('χωρίζει χρωματικά τοίχο (#80BCFC ×12) από παράθυρα (#50A490 ×8)', () => {
    const wallLines = entities.filter((e) => e.type === 'line' && e.color === '#80BCFC');
    const winLines = entities.filter((e) => e.type === 'line' && e.color === '#50A490');
    expect(wallLines).toHaveLength(12);
    expect(winLines).toHaveLength(8);
  });

  it('οι παρειές φτάνουν τα άκρα του τοίχου (~5.03m span)', () => {
    const xs = entities.flatMap((e) => (e.type === 'line' ? [e.start.x, e.end.x] : []));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(5000);
  });
});

describe('tekDimToEntities (ADR-531 Φ5b.1+)', () => {
  const entities = tekDimToEntities(DIM, 'mm');

  it('γραμμή (πράσινο ×2) + πλάγιες παύλες (μπορντώ ×2) + κείμενο', () => {
    expect(entities.filter((e) => e.type === 'line' && e.color === '#00FF00')).toHaveLength(2);
    expect(entities.filter((e) => e.type === 'line' && e.color === '#800000')).toHaveLength(2);
    const texts = entities.filter((e) => e.type === 'text');
    expect(texts).toHaveLength(1);
    expect(texts[0].type === 'text' && texts[0].text).toBe('2.10');
  });

  it('το κείμενο έχει ύψος από το <size> (0.15875m → ~159mm)', () => {
    const txt = entities.find((e) => e.type === 'text');
    expect(txt && txt.type === 'text' && txt.height).toBeCloseTo(158.75, 1);
  });
});
