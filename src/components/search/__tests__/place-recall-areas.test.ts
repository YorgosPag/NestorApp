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
  { id: 'municipality:0709', name: 'ΔΗΜΟΣ ΛΑΓΚΑΔΑ', level: 5, parentId: 'regional_unit:07' },
  { id: 'municipal_unit:070906', name: 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΛΑΧΑΝΑ', level: 6, parentId: 'municipality:0709' },
  { id: 'community:07090602', name: 'Τοπική Κοινότητα Καρτερών', level: 7, parentId: 'municipal_unit:070906' },
  { id: 'settlement:0709060202', name: 'Δορκάδα', level: 8, parentId: 'community:07090602' },
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

describe('οικισμοί στη λίστα (ADR-883 §5.10)', () => {
  it('🔑 «Δορκάς» (γραφή ΕΛΣΤΑΤ) βρίσκει τη Δορκάδα ΜΙΑ φορά, με κοινότητα ΚΑΙ δήμο στη δεύτερη γραμμή', () => {
    const areas = buildPlaceRecallOptions('Δορκάς', [], index).filter((option) => option.kind === 'area');
    expect(areas).toHaveLength(1);
    const [dorkada] = areas;
    expect(dorkada.kind === 'area' && dorkada.area.id).toBe('settlement:0709060202');
    expect(dorkada.kind === 'area' && dorkada.within).toBe('Τοπική Κοινότητα Καρτερών · ΔΗΜΟΣ ΛΑΓΚΑΔΑ');
  });

  it('περιοχή που δεν είναι οικισμός κρατά ΜΟΝΟ τον άμεσο γονέα', () => {
    const [community] = buildPlaceRecallOptions('Καρτερών', [], index).filter((option) => option.kind === 'area');
    expect(community.kind === 'area' && community.within).toBe('ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΛΑΧΑΝΑ');
  });
});
