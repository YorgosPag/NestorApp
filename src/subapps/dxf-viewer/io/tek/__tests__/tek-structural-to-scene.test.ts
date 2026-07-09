/**
 * ADR-531 Φ5b.1+ — tests για τον mapper τοίχος-με-κουφώματα → scene primitives.
 * (Οι διαστάσεις → native `DimensionEntity` δοκιμάζονται στο `tek-dim-to-dimension.test.ts`.)
 */

import { tekWallToEntities } from '../tek-structural-to-scene';
import type { TekWallRecord, TekXMatrix, TekOpeningRecord } from '../tek-import-types';

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

describe('tekWallToEntities (ADR-531 Φ5b.1++)', () => {
  const entities = tekWallToEntities(WALL, 'mm');

  it('παράγει τοίχο-με-κουφώματα (12) + πόρτα (13) + παράθυρο (7) = 32 γραμμές', () => {
    expect(entities).toHaveLength(32);
    expect(entities.every((e) => e.type === 'line')).toBe(true);
  });

  it('χωρίζει χρωματικά τοίχο (#80BCFC ×12) από ανοίγματα (#50A490 ×20)', () => {
    const wallLines = entities.filter((e) => e.type === 'line' && e.color === '#80BCFC');
    const openLines = entities.filter((e) => e.type === 'line' && e.color === '#50A490');
    expect(wallLines).toHaveLength(12);
    expect(openLines).toHaveLength(20); // πόρτα 13 + παράθυρο 7
  });

  it('οι παρειές φτάνουν τα άκρα του τοίχου (~5.03m span)', () => {
    const xs = entities.flatMap((e) => (e.type === 'line' ? [e.start.x, e.end.x] : []));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(5000);
  });
});
