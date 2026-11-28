/**
 * ADR-920 §14.12 Β3 — το χοντρό ως πεδίο: διγραμμική ανάγνωση στο ΠΑΓΚΟΣΜΙΟ πλέγμα pixels ενός επιπέδου.
 *
 * Πλακίδια 4 × 4 pixels στο z3, με ύψος = 10 · (παγκόσμια στήλη) + (παγκόσμια γραμμή): γραμμικό, άρα η διγραμμική
 * ανάγνωση πρέπει να το δίνει ακριβώς — και πάνω από το σύνορο δύο πλακιδίων, εκεί όπου το πρωτότυπο του Β0 «έσπαγε».
 */

import type { ArchiveTileAddress } from '@/lib/geo/osm/osm-archive-tile';

import {
  coarseElevationAt,
  coarseFieldOf,
  coarseLevelFor,
  coarseNeighbourhoodOf,
  coarsePrimaryFor,
  coarseTilesNeededFor,
  type CoarseElevationTile,
} from '../coarse-elevation-field';

const Z = 3;
const PX = 4;
const WORLD_PX = 2 ** Z * PX;
const PRIMARY: ArchiveTileAddress = { z: Z, x: 4, y: 2 };
const rampM = (globalColumn: number, globalRow: number): number => 10 * globalColumn + globalRow;

function tileOf(address: ArchiveTileAddress): CoarseElevationTile {
  const heights = Float32Array.from({ length: PX * PX }, (_, i) =>
    rampM(address.x * PX + (i % PX), address.y * PX + Math.floor(i / PX)),
  );
  return { address, heights };
}

/** Το σημείο Mercator που αντιστοιχεί στη θέση (στήλη, γραμμή) του παγκόσμιου πλέγματος — κέντρα σε ακέραιους + ½. */
const at = (globalColumn: number, globalRow: number) => ({ u: (globalColumn + 0.5) / WORLD_PX, v: (globalRow + 0.5) / WORLD_PX });

const FULL = coarseFieldOf(PRIMARY, PX, coarseNeighbourhoodOf(PRIMARY).map(tileOf));

describe('ποιο χοντρό πλακίδιο διαβάζει ένα πλακίδιο εξόδου', () => {
  it('βαθύτερα από το αρχείο: ο πρόγονος στο βάθος του αρχείου· ρηχότερα: το ίδιο το επίπεδο', () => {
    expect(coarseLevelFor(20, 12)).toBe(12);
    expect(coarseLevelFor(7, 12)).toBe(7);
    expect(coarsePrimaryFor({ z: 15, x: 8 * 2301 + 5, y: 8 * 1570 + 7 }, 12)).toEqual({ z: 12, x: 2301, y: 1570 });
    expect(coarsePrimaryFor({ z: 9, x: 280, y: 190 }, 12)).toEqual({ z: 9, x: 280, y: 190 });
  });

  it('η γειτονιά: το ίδιο πρώτο, μετά οι οκτώ γείτονες — και μόνο όσοι υπάρχουν στον κόσμο', () => {
    const around = coarseNeighbourhoodOf(PRIMARY);
    expect(around[0]).toEqual(PRIMARY);
    expect(around).toHaveLength(9);
    expect(new Set(around.map(({ x, y }) => `${x}/${y}`)).size).toBe(9);
    expect(coarseNeighbourhoodOf({ z: Z, x: 0, y: 0 })).toHaveLength(4);
    expect(coarseNeighbourhoodOf({ z: 0, x: 0, y: 0 })).toEqual([{ z: 0, x: 0, y: 0 }]);
  });
});

describe('coarseElevationAt', () => {
  it('στο κέντρο ενός pixel είναι το ίδιο το pixel', () => {
    const { u, v } = at(PRIMARY.x * PX + 2, PRIMARY.y * PX + 1);
    expect(coarseElevationAt(FULL, u, v)).toBeCloseTo(rampM(PRIMARY.x * PX + 2, PRIMARY.y * PX + 1), 6);
  });

  it('ανάμεσα σε τέσσερα pixels είναι η διγραμμική τους μείξη', () => {
    const { u, v } = at(PRIMARY.x * PX + 1.25, PRIMARY.y * PX + 2.6);
    expect(coarseElevationAt(FULL, u, v)).toBeCloseTo(rampM(PRIMARY.x * PX + 1.25, PRIMARY.y * PX + 2.6), 6);
  });

  it('διαβάζει πάνω από το σύνορο: στη λωρίδα του μισού pixel συνεχίζει στον γείτονα, και προς τις τέσσερις πλευρές', () => {
    const left = PRIMARY.x * PX;
    const top = PRIMARY.y * PX;
    for (const [column, row] of [[left + 3.8, top + 1.5], [left - 0.3, top + 1.5], [left + 1.5, top + 3.9], [left + 1.5, top - 0.4], [left + 3.7, top + 3.7]]) {
      const { u, v } = at(column, row);
      expect(coarseElevationAt(FULL, u, v)).toBeCloseTo(rampM(column, row), 6);
    }
  });

  it('γείτονας που λείπει πραγματικά: το pixel της ακμής του ίδιου του πλακιδίου — ποτέ μηδέν, ποτέ κενό', () => {
    const alone = coarseFieldOf(PRIMARY, PX, [tileOf(PRIMARY)]);
    const lastColumn = PRIMARY.x * PX + 3;
    const row = PRIMARY.y * PX + 1;
    const { u, v } = at(lastColumn + 0.4, row);
    expect(coarseElevationAt(alone, u, v)).toBeCloseTo(rampM(lastColumn, row), 6);
  });

  it('χωρίς το πλακίδιο του σημείου δεν υπάρχει απάντηση', () => {
    const neighboursOnly = coarseFieldOf(PRIMARY, PX, coarseNeighbourhoodOf(PRIMARY).slice(1).map(tileOf));
    const { u, v } = at(PRIMARY.x * PX + 2, PRIMARY.y * PX + 2);
    expect(coarseElevationAt(neighboursOnly, u, v)).toBeNull();
  });

  it('πλακίδια άλλου επιπέδου, άλλου μεγέθους ή εκτός γειτονιάς δεν μπαίνουν στο πεδίο', () => {
    const field = coarseFieldOf(PRIMARY, PX, [
      { address: { z: Z + 1, x: PRIMARY.x, y: PRIMARY.y }, heights: new Float32Array(PX * PX) },
      { address: PRIMARY, heights: new Float32Array(PX * PX * 4) },
      tileOf({ z: Z, x: PRIMARY.x + 2, y: PRIMARY.y }),
    ]);
    expect(field.blocks.every((block) => block === null)).toBe(true);
  });
});

describe('ποια χοντρά πλακίδια διαβάζει ΠΡΑΓΜΑΤΙΚΑ ένα πλακίδιο εξόδου (Β4)', () => {
  const key = ({ z, x, y }: ArchiveTileAddress): string => `${z}/${x}/${y}`;
  const needed = (tile: ArchiveTileAddress): string[] => coarseTilesNeededFor(tile, PX, Z, PX).map(key);

  it('στο βάθος του αρχείου ή ρηχότερα: μόνο το ίδιο το πλακίδιο — τα κέντρα των pixels συμπίπτουν', () => {
    expect(needed(PRIMARY)).toEqual([key(PRIMARY)]);
    expect(coarseTilesNeededFor({ z: 2, x: 1, y: 1 }, PX, Z, PX).map(key)).toEqual(['2/1/1']);
  });

  it('βαθύτερα, μακριά από την άκρη του προγόνου: μόνο ο πρόγονος', () => {
    expect(needed({ z: Z + 2, x: 17, y: 9 })).toEqual([key(PRIMARY)]);
  });

  it('βαθύτερα, πάνω στην άκρη: και ο γείτονας από εκείνη την πλευρά· στη γωνία και ο διαγώνιος', () => {
    expect(needed({ z: Z + 2, x: 16, y: 9 }).sort()).toEqual(['3/3/2', '3/4/2']);
    expect(needed({ z: Z + 2, x: 16, y: 8 }).sort()).toEqual(['3/3/1', '3/3/2', '3/4/1', '3/4/2']);
  });

  it('ο πρόγονος είναι πάντα πρώτος, και στην άκρη του κόσμου δεν ζητείται πλακίδιο που δεν υπάρχει', () => {
    expect(needed({ z: Z + 2, x: 16, y: 8 })[0]).toBe(key(PRIMARY));
    expect(needed({ z: Z + 2, x: 0, y: 0 })).toEqual(['3/0/0']);
  });

  it.each([
    { z: Z, x: 4, y: 2 },
    { z: Z + 2, x: 16, y: 8 },
    { z: Z + 2, x: 19, y: 11 },
    { z: Z + 2, x: 17, y: 9 },
  ])('ίδια ανάγνωση, bit προς bit, με όλη τη γειτονιά — πλακίδιο %o', (tile) => {
    const field = coarseFieldOf(PRIMARY, PX, coarseTilesNeededFor(tile, PX, Z, PX).map(tileOf));
    const n = 2 ** tile.z;
    for (let row = 0; row < PX; row++) {
      for (let column = 0; column < PX; column++) {
        const u = (tile.x + (column + 0.5) / PX) / n;
        const v = (tile.y + (row + 0.5) / PX) / n;
        expect(coarseElevationAt(field, u, v)).toBe(coarseElevationAt(FULL, u, v));
      }
    }
  });
});
