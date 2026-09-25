/**
 * @fileoverview Άγκυρα του ορίου στη διεύθυνση (ADR-883) — `area=` πάει και έρχεται, η αναφορά
 * επιλύεται **μόνο** με το όριο της ίδιας περιοχής, και ο κριτής δεν παίρνει ποτέ ανεπίλυτη.
 */

import {
  EMPTY_LISTING_FILTERS,
  isUnresolvedRegion,
  parseListingFilters,
  resolveListingSearch,
  searchRegionId,
  serializeListingFilters,
} from '../listing-filters';
import { RESERVED_SEARCH_PARAMS } from '@/lib/criteria/listing-criteria-url';
import { listingAreaKey, countIsExactFor } from '../listing-geo-query';
import type { GeoRegion } from '@/types/geo/coordinates';

const REGION: GeoRegion = {
  adminId: 'municipality:0708',
  rings: [[{ lat: 40.66, lng: 22.9 }, { lat: 40.66, lng: 22.92 }, { lat: 40.68, lng: 22.92 }]],
  bbox: { south: 40.66, west: 22.9, north: 40.68, east: 22.92 },
  toleranceM: 25,
};

describe('η περιοχή στη διεύθυνση', () => {
  it('`area=` διαβάζεται ως ΑΝΕΠΙΛΥΤΗ αναφορά', () => {
    const search = parseListingFilters(new URLSearchParams('area=municipality:0708'));
    expect(search.near).toEqual({ adminId: 'municipality:0708' });
    expect(isUnresolvedRegion(search.near!)).toBe(true);
  });

  it('🔒 επιλυμένη ή όχι, γράφεται ως ΤΑΥΤΟΤΗΤΑ — ποτέ πολύγωνα, ποτέ και δεύτερο σχήμα', () => {
    for (const near of [{ adminId: 'municipality:0708' }, REGION]) {
      const params = serializeListingFilters({ ...EMPTY_LISTING_FILTERS, near });
      expect(params.toString()).toBe('area=municipality%3A0708');
    }
  });

  it('στρογγυλό ταξίδι: parse(serialize(x)) κρατά την περιοχή', () => {
    const params = serializeListingFilters({ ...EMPTY_LISTING_FILTERS, near: REGION });
    expect(searchRegionId(parseListingFilters(params).near)).toBe('municipality:0708');
  });

  it('🔒 αυθαίρετο κείμενο στο `area` αγνοείται — δεν ζητάμε αρχείο με όνομα από τη διεύθυνση', () => {
    for (const raw of ['../../etc/passwd', 'municipality:0708/../x', '<script>', '']) {
      expect(parseListingFilters(new URLSearchParams({ area: raw })).near).toBeNull();
    }
  });

  it('η περιοχή προηγείται του ορθογωνίου σε χειρόγραφη διεύθυνση', () => {
    const search = parseListingFilters(new URLSearchParams('area=municipality:0708&box=37,23,38,24'));
    expect(searchRegionId(search.near)).toBe('municipality:0708');
  });

  it('το `area` είναι δεσμευμένο — κανένα κριτήριο δεν μπορεί να το πάρει', () => {
    expect(RESERVED_SEARCH_PARAMS).toContain('area');
  });
});

describe('resolveListingSearch', () => {
  const search = parseListingFilters(new URLSearchParams('area=municipality:0708'));

  it('χωρίς όριο ⇒ null (ο καλών ΠΕΡΙΜΕΝΕΙ, δεν κρίνει με τίποτα)', () => {
    expect(resolveListingSearch(search, null)).toBeNull();
  });

  it('🔒 όριο ΑΛΛΗΣ περιοχής ⇒ null — ποτέ λάθος σύνορο', () => {
    expect(resolveListingSearch(search, { ...REGION, adminId: 'municipality:0101' })).toBeNull();
  });

  it('όριο της ίδιας ⇒ το όριο στη θέση της αναφοράς', () => {
    expect(resolveListingSearch(search, REGION)?.near).toBe(REGION);
  });

  it('χωρίς περιοχή ⇒ περνά αυτούσιο, όποιο κι αν είναι το όριο', () => {
    const plain = parseListingFilters(new URLSearchParams('box=37,23,38,24'));
    expect(resolveListingSearch(plain, null)?.near).toEqual(plain.near);
  });
});

describe('η ανάγνωση Firestore για όριο', () => {
  it('κλειδί = η ταυτότητα της περιοχής (ίδιος δήμος, ίδια ανάγνωση)', () => {
    expect(listingAreaKey(REGION)).toBe('region:municipality:0708');
  });

  it('η καταμέτρηση του ορθογωνίου ΔΕΝ είναι ακριβής για όριο', () => {
    expect(countIsExactFor(REGION)).toBe(false);
  });
});
