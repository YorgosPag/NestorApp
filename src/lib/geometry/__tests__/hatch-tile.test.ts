/**
 * Το πλακίδιο διαγράμμισης 45°: οι γραμμές περνούν ΕΞΩ από το πλακίδιο (καμία ραφή στις ενώσεις) και το `cross` = `rising` + `falling`.
 */

import { hatchTilePathData } from '../hatch-tile';

const numbersOf = (d: string): number[] => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('hatchTilePathData', () => {
  it('rising: τρεις γραμμές «/», η κεντρική από γωνία σε γωνία, οι ακραίες ξεκινούν ¼ πλευράς έξω', () => {
    const d = hatchTilePathData(8, 'rising');
    expect(d.match(/M/g)).toHaveLength(3);
    expect(d).toContain('M0,8 l8,-8');
    // Οι ακραίες γραμμές ξεκινούν ¼ πλευράς ΕΞΩ (x = −2, x = 6 → ως 10 > 8): τα πλακίδια ενώνονται χωρίς ραφή.
    expect(d.startsWith('M-2,2 l4,-4')).toBe(true);
    expect(d.endsWith('M6,10 l4,-4')).toBe(true);
    expect(numbersOf(d)).toContain(-2);
  });

  it('cross = rising + falling (έξι γραμμές)', () => {
    const cross = hatchTilePathData(8, 'cross');
    expect(cross.startsWith(hatchTilePathData(8, 'rising'))).toBe(true);
    expect(cross.match(/M/g)).toHaveLength(6);
    expect(cross).toContain('M0,0 l8,8');
  });
});
