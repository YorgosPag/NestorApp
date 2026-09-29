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

import { attributionSegmentsFromHtml, mapAttribution, mergeAttributions, sameAttribution } from '../map-attribution';

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

describe('mapAttribution — η ΜΙΑ ανάγνωση από φορτωμένο χάρτη (ADR-891 §8)', () => {
  const fakeMap = (sources: Record<string, string | undefined>) => ({
    getStyle: () => ({ sources }),
    getSource: (id: string) => (id in sources ? { attribution: sources[id] } : undefined),
  });

  it('διαβάζει την απόδοση ΚΑΘΕ πηγής του στυλ, χωρίς διπλότυπα', () => {
    expect(mapAttribution(fakeMap({ a: OSM, b: OSM }))).toEqual(attributionSegmentsFromHtml(OSM));
  });

  it('πηγή χωρίς απόδοση (π.χ. GeoJSON του χρήστη) δεν προσθέτει τίποτα', () => {
    expect(mapAttribution(fakeMap({ shape: undefined }))).toEqual([]);
  });

  it('🔴 στυλ ΣΕ ΦΟΡΤΩΣΗ (`getStyle()` = undefined, `styledata` πριν από το `load`) ⇒ null, ποτέ εξαίρεση (ADR-890 §16)', () => {
    const loading = { getStyle: () => undefined, getSource: () => undefined };
    expect(mapAttribution(loading)).toBeNull();
  });
});

describe('sameAttribution', () => {
  it('ίδιο κείμενο και σύνδεσμοι ⇒ ίδια (καμία επαναζωγράφιση ανά πλακίδιο)', () => {
    expect(sameAttribution(attributionSegmentsFromHtml(OSM), attributionSegmentsFromHtml(OSM))).toBe(true);
  });

  it('άλλος σύνδεσμος ⇒ διαφορετική', () => {
    expect(sameAttribution([{ text: 'A', href: 'https://a.example/' }], [{ text: 'A', href: 'https://b.example/' }])).toBe(false);
  });
});
