/**
 * @jest-environment jsdom
 *
 * @fileoverview 🗺️ **ΑΓΚΥΡΑ — η απόδοση του παρόχου φτάνει στην οθόνη ως κείμενο + ΑΣΦΑΛΕΙΣ σύνδεσμοι.**
 * @related lib/maps/map-attribution.ts · ADR-777 §8.70 Φ2
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | `href` περνά χωρίς έλεγχο σχήματος | `javascript:` φτάνει στο DOM ⇒ 🔴 |
 * | οι σύνδεσμοι ξεντύνονται σε κείμενο | η λέξη «OpenStreetMap» χάνει τον σύνδεσμο (OSMF) ⇒ 🔴 |
 */

import { attributionSegmentsFromHtml, mergeAttributions } from '../map-attribution';

const OSM = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

describe('attributionSegmentsFromHtml', () => {
  it('🔑 η λέξη «OpenStreetMap» μένει σύνδεσμος', () => {
    expect(attributionSegmentsFromHtml(OSM)).toEqual([
      { text: '© ' },
      { text: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
      { text: ' contributors' },
    ]);
  });

  it('απλό κείμενο ⇒ ένα κομμάτι', () => {
    expect(attributionSegmentsFromHtml('© OpenStreetMap contributors')).toEqual([{ text: '© OpenStreetMap contributors' }]);
  });

  it('🔴 `javascript:` href ⇒ μόνο κείμενο', () => {
    expect(attributionSegmentsFromHtml('<a href="javascript:alert(1)">x</a>')).toEqual([{ text: 'x' }]);
  });

  it('άλλες ετικέτες ξεντύνονται — κανένα `<script>` δεν εκτελείται ποτέ', () => {
    expect(attributionSegmentsFromHtml('<b>CARTO</b>')).toEqual([{ text: 'CARTO' }]);
  });

  it('κενό ⇒ κενός πίνακας', () => {
    expect(attributionSegmentsFromHtml('   ')).toEqual([]);
  });
});

describe('mergeAttributions', () => {
  it('ίδια απόδοση από δύο πηγές ⇒ μία φορά', () => {
    expect(mergeAttributions([OSM, OSM, ''])).toEqual(attributionSegmentsFromHtml(OSM));
  });

  it('δύο πάροχοι ⇒ χωρίζονται με κενό', () => {
    expect(mergeAttributions(['A', 'B'])).toEqual([{ text: 'A' }, { text: ' ' }, { text: 'B' }]);
  });
});
