/**
 * @fileoverview ADR-840 §7.7 — η σύμβαση «διεύθυνση ⇄ φίλτρα ακινήτων». Τα ονόματα είναι δημόσιο συμβόλαιο:
 * αν κάποιο αλλάξει, αυτά τα tests κοκκινίζουν **πριν** σπάσουν οι κοινοποιημένοι σύνδεσμοι.
 */

import {
  PROPERTIES_VIEW,
  parsePropertyFilters,
  writePropertyFilters,
} from '../property-filters-url';
import { DEFAULT_FILTERS, type FilterState } from '@/types/property-viewer';

const written = (filters: FilterState, start = ''): string => {
  const params = new URLSearchParams(start);
  writePropertyFilters(filters, params);
  return params.toString();
};

describe('property-filters-url', () => {
  it('κενά φίλτρα ⇒ κενή διεύθυνση (ένα URL για την ίδια οθόνη)', () => {
    expect(written(DEFAULT_FILTERS)).toBe('');
    expect(parsePropertyFilters(new URLSearchParams(''))).toEqual(DEFAULT_FILTERS);
  });

  it('round-trip: ό,τι γράφεται διαβάζεται ίδιο', () => {
    const filters: FilterState = {
      ...DEFAULT_FILTERS,
      searchTerm: 'δύο λέξεις ',
      project: ['proj_a', 'proj_b'],
      building: ['bld_1'],
      floor: ['0', '2'],
      propertyType: ['apartment'],
      status: ['listed', 'reserved'],
      operationalStatus: ['ready'],
      features: ['parking'],
      priceRange: { role: 'rent', min: 500, max: 1200 },
      areaRange: { min: 0, max: 95 },
    };
    expect(parsePropertyFilters(new URLSearchParams(written(filters)))).toEqual(filters);
  });

  it('η μονάδα της τιμής ζει στο ΟΝΟΜΑ — τα ίδια ονόματα με τη δημόσια αναζήτηση', () => {
    expect(written({ ...DEFAULT_FILTERS, priceRange: { role: 'sale', max: 250000 } })).toBe('psalemax=250000');
    expect(written({ ...DEFAULT_FILTERS, priceRange: { role: 'nightly', min: 40 } })).toBe('pnightmin=40');
    expect(written({ ...DEFAULT_FILTERS, areaRange: { min: 50, max: undefined } })).toBe('amin=50');
  });

  it('αλλαγή μονάδας σβήνει το εύρος της παλιάς (ποτέ δύο μονάδες στη γραμμή)', () => {
    expect(written({ ...DEFAULT_FILTERS, priceRange: { role: 'rent', max: 900 } }, 'psalemin=100')).toBe('prentmax=900');
  });

  it('μονάδα ΧΩΡΙΣ όρια επιβιώνει (`punit`)· η προεπιλεγμένη δεν γράφεται', () => {
    const params = written({ ...DEFAULT_FILTERS, priceRange: { role: 'rent' } });
    expect(params).toBe('punit=rent');
    expect(parsePropertyFilters(new URLSearchParams(params)).priceRange).toEqual({ role: 'rent' });
    expect(written({ ...DEFAULT_FILTERS, priceRange: { role: 'sale' } })).toBe('');
  });

  it('το `0` είναι τιμή, όχι απουσία', () => {
    expect(parsePropertyFilters(new URLSearchParams('amin=0')).areaRange).toEqual({ min: 0, max: undefined });
  });

  it('σκουπίδια αγνοούνται — ποτέ δεν σκάει η οθόνη', () => {
    const parsed = parsePropertyFilters(new URLSearchParams('amin=abc&psalemax=&punit=yen&project=,,'));
    expect(parsed.areaRange).toEqual({ min: undefined, max: undefined });
    expect(parsed.priceRange).toEqual(DEFAULT_FILTERS.priceRange);
    expect(parsed.project).toEqual([]);
  });

  it('άσχετα κλειδιά (προβολή, επιλογή) μένουν ανέπαφα', () => {
    expect(written({ ...DEFAULT_FILTERS, status: ['listed'] }, 'view=floorplan&selected=p1&q=old'))
      .toBe('view=floorplan&selected=p1&status=listed');
  });

  /**
   * ADR-840 Σ3 — το `status` ήταν ΝΕΚΡΟ: οι πίνακες έδιναν `available` / `ready` / `for-sale`, τιμές που η μηχανή
   * δεν ταίριαζε ποτέ. Τώρα είναι κουβάδες διάθεσης — κλειστό λεξιλόγιο ⇒ άγνωστη τιμή αγνοείται αντί να δίνει
   * άδεια λίστα. Παλιός σύνδεσμος ανοίγει ό,τι έδειχνε, συν όσα έκρυβε λάθος.
   */
  it('κατάσταση: μόνο κουβάδες διάθεσης / λειτουργικές τιμές — οι παλιές νεκρές αγνοούνται', () => {
    const parsed = parsePropertyFilters(new URLSearchParams('status=for-sale,listed,ready&opstatus=ready,listed'));
    expect(parsed.status).toEqual(['listed']);
    expect(parsed.operationalStatus).toEqual(['ready']);
  });

  it('πληρότητα: `missing` ⇄ `coverage`, μόνο οι γνωστές σημαίες, κενό ⇒ καμία', () => {
    const coverage = { missingPhotos: true, missingDocuments: true };
    expect(written({ ...DEFAULT_FILTERS, coverage })).toBe('missing=photos%2Cdocuments');
    expect(parsePropertyFilters(new URLSearchParams('missing=photos,documents,videos')).coverage).toEqual(coverage);
    expect(parsePropertyFilters(new URLSearchParams('missing=videos')).coverage).toBeUndefined();
    expect(written({ ...DEFAULT_FILTERS, coverage: { missingPhotos: false } }, 'missing=photos')).toBe('');
  });

  it('«Καθαρισμός όλων» (DEFAULT_FILTERS) σβήνει ΚΑΙ κατάσταση λειτουργίας ΚΑΙ πληρότητα', () => {
    expect(written({ ...DEFAULT_FILTERS }, 'opstatus=ready&missing=photos&status=listed')).toBe('');
  });

  it('η όψη: τρεις φακοί — πλέγμα (προεπιλογή, δεν γράφεται) · λίστα · κάτοψη', () => {
    expect(PROPERTIES_VIEW.parse(new URLSearchParams('view=list'))).toBe('list');
  });

  it('η προβολή: πλέγμα = προεπιλογή που σβήνει το κλειδί', () => {
    expect(PROPERTIES_VIEW.parse(new URLSearchParams('view=floorplan'))).toBe('floorplan');
    expect(PROPERTIES_VIEW.parse(new URLSearchParams('view=3d'))).toBe('grid');
    const params = new URLSearchParams('view=floorplan&project=a');
    PROPERTIES_VIEW.write('grid', params);
    expect(params.toString()).toBe('project=a');
  });
});
