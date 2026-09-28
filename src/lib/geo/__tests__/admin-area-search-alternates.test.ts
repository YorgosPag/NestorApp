/**
 * @fileoverview Άγκυρα: η αναζήτηση περιοχών βρίσκει τον τόπο και με την ΠΑΛΙΑ γραφή — ADR-893 §7.
 *
 * Ο άνθρωπος που ξέρει τη «Δ.Ε. Διστύων» από παλιό έγγραφο πρέπει να φτάσει στη «Δημοτική Ενότητα
 * Δυστίων» — **μία** φορά στη λίστα, και μονοσήμαντα με Enter (όχι «διφορούμενο» με τον εαυτό της).
 */

import { readAdminAreaIndex } from '../admin-area-index-file';
import { buildAdminAreaIndex, resolveTypedAdminArea, searchAdminAreas } from '../admin-area-search';

const index = buildAdminAreaIndex(
  readAdminAreaIndex({
    data: [
      ['municipality:2906', 'Δήμος Κύμης - Αλιβερίου', 5, null],
      ['municipal_unit:290603', 'Δημοτική Ενότητα Δυστίων', 6, 'municipality:2906', ['Δημοτική Ενότητα ΔΙΣΤΥΩΝ']],
      ['municipal_unit:290601', 'Δημοτική Ενότητα Ταμυνέων', 6, 'municipality:2906'],
    ],
  }),
);

describe('ADR-893 §7 — εναλλακτικά ονόματα στην αναζήτηση περιοχών', () => {
  it('το ευρετήριο διαβάζει το πέμπτο στοιχείο — και αρνείται άκυρο', () => {
    const areas = readAdminAreaIndex({ data: [['a:1', 'Α', 6, null, ['Β']], ['a:2', 'Γ', 6, null, []], ['a:3', 'Δ', 6, null, [7]]] });
    expect(areas.get('a:1')?.alternateNames).toEqual(['Β']);
    expect(areas.has('a:2')).toBe(false);
    expect(areas.has('a:3')).toBe(false);
  });

  it('η παλιά γραφή βρίσκει τον τόπο — ΜΙΑ φορά, με το ΣΗΜΕΡΙΝΟ του όνομα', () => {
    const found = searchAdminAreas(index, 'Διστύων');
    expect(found.map((area) => area.id)).toEqual(['municipal_unit:290603']);
    expect(found[0].name).toBe('Δημοτική Ενότητα Δυστίων');
  });

  it('η νέα γραφή εξακολουθεί να τον βρίσκει', () => {
    expect(searchAdminAreas(index, 'Δυστίων').map((area) => area.id)).toEqual(['municipal_unit:290603']);
  });

  it('Enter στην παλιά γραφή ⇒ ο τόπος, όχι «διφορούμενο» με τον εαυτό του', () => {
    expect(resolveTypedAdminArea(index, 'Διστύων')).toMatchObject({ kind: 'area', area: { id: 'municipal_unit:290603' } });
  });
});
