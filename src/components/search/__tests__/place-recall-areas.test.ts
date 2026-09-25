/**
 * @fileoverview ADR-883 — οι διοικητικές περιοχές στη λίστα ανάκλησης τόπου: μόνο με κείμενο,
 * μετά το ιστορικό, με τον γονέα για να ξεχωρίζουν οι ομώνυμες.
 */

import { buildAdminAreaIndex } from '@/lib/geo/admin-area-search';
import type { AdminArea } from '@/lib/geo/admin-area-index-file';
import { buildPlaceRecallOptions, placeRecallOptionKey } from '../place-recall/place-recall-options';

const AREAS: AdminArea[] = [
  { id: 'regional_unit:07', name: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ', level: 4, parentId: null },
  { id: 'municipality:0708', name: 'ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ - ΕΥΟΣΜΟΥ', level: 5, parentId: 'regional_unit:07' },
];
const index = buildAdminAreaIndex(new Map(AREAS.map((area) => [area.id, area])));
const RECENT = [{ label: 'Εύοσμος', center: { lat: 40.67, lng: 22.91 }, savedAt: 1 }];

describe('buildPlaceRecallOptions + περιοχές', () => {
  it('με κείμενο: πρώτα το ιστορικό, μετά οι περιοχές — με τον γονέα ως δεύτερη γραμμή', () => {
    const options = buildPlaceRecallOptions('Εύοσμ', RECENT, index);
    expect(options.map((option) => option.kind)).toEqual(['recent', 'area']);
    const area = options[1];
    expect(area.kind === 'area' && area.within).toBe('ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ');
    expect(placeRecallOptionKey(area)).toBe('area:municipality:0708');
  });

  it('χωρίς κείμενο: ΚΑΜΙΑ περιοχή (θα ήταν χιλιάδες)', () => {
    expect(buildPlaceRecallOptions('', RECENT, index).some((option) => option.kind === 'area')).toBe(false);
  });

  it('ευρετήριο που δεν φόρτωσε ακόμη (`null`) ⇒ μόνο το ιστορικό, ποτέ σφάλμα', () => {
    expect(buildPlaceRecallOptions('Εύοσμ', RECENT, null).map((option) => option.kind)).toEqual(['recent']);
  });
});
