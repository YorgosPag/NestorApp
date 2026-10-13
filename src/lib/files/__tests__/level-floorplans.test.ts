/**
 * ADR-236 / ADR-914 §2.20 — ΕΝΑΣ κανόνας «ποιες κατόψεις ανήκουν σε αυτό το επίπεδο».
 */

import { floorplansOfLevel } from '../level-floorplans';

const lower = { id: 'f_lower', levelFloorId: 'flr_1' };
const upper = { id: 'f_upper', levelFloorId: 'flr_2' };
const untagged = { id: 'f_old' };
const files = [lower, upper, untagged];

describe('floorplansOfLevel', () => {
  it('δείχνει μόνο τις κατόψεις του επιπέδου — όχι του άλλου ορόφου', () => {
    expect(floorplansOfLevel(files, 'flr_2', false)).toEqual([upper]);
  });

  it('αρχείο χωρίς επίπεδο ανήκει μόνο όπου το δηλώνει ο καλών', () => {
    expect(floorplansOfLevel(files, 'flr_1', true)).toEqual([lower, untagged]);
    expect(floorplansOfLevel(files, 'flr_2', true)).toEqual([upper, untagged]);
  });

  it('χωρίς επίπεδο (μονοεπίπεδο ακίνητο) ⇒ όλες', () => {
    expect(floorplansOfLevel(files, undefined, false)).toEqual(files);
    expect(floorplansOfLevel(files, null, false)).toEqual(files);
  });
});
