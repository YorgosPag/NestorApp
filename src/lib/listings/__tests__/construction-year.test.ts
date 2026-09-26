/**
 * ADR-890 Φ0 — το έτος κατασκευής της αγγελίας: ποια πηγή νικά, τι είναι αληθοφανές.
 */

import type { Attested } from '@/lib/location/location-provenance';
import {
  CONSTRUCTION_YEAR_BOUNDS,
  constructionYearUpdate,
  isPlausibleConstructionYear,
  maxConstructionYear,
  readConstructionYearInput,
  resolveListingConstructionYear,
} from '../construction-year';

const AT = '2026-09-26T10:00:00.000Z';
const OSM: Attested<number> = { value: 1965, source: 'osm', attestedAt: '2026-08-11T00:00:00.000Z' };
const record = (fact: Attested<number>) => ({ fact, placeId: 'pbld_0000001' });

describe('αληθοφάνεια — μία σταθερά για φόρμα και προβολή', () => {
  it('δέχεται ιστορικά κτίρια και off-plan έως +5 χρόνια', () => {
    expect(isPlausibleConstructionYear(1650, 2026)).toBe(true);
    expect(isPlausibleConstructionYear(2031, 2026)).toBe(true);
    expect(maxConstructionYear(2026)).toBe(2026 + CONSTRUCTION_YEAR_BOUNDS.maxYearsAhead);
  });

  it('πιάνει λάθη πληκτρολόγησης και μη ακέραια — ποτέ «διόρθωση»', () => {
    for (const bad of [197, 19, 2032, 1978.5, '1978', null, undefined, Number.NaN]) {
      expect(isPlausibleConstructionYear(bad, 2026)).toBe(false);
    }
  });
});

describe('ποια πηγή νικά (RESO `YearBuilt` + `YearBuiltSource`)', () => {
  it('κανείς δεν ξέρει ⇒ null', () => {
    expect(resolveListingConstructionYear({ declared: null, publicRecord: null }, AT)).toBeNull();
  });

  it('δήλωση στο κτίριο ⇒ `declared`, με τη στιγμή της προβολής', () => {
    expect(resolveListingConstructionYear({ declared: 1978, publicRecord: null }, AT)).toEqual({
      provenance: 'declared',
      value: 1978,
      at: AT,
    });
  });

  it('μόνο δημόσια εγγραφή ⇒ `public-record` με μητρώο και δείκτη εγγραφής', () => {
    expect(resolveListingConstructionYear({ declared: null, publicRecord: record(OSM) }, AT)).toEqual({
      provenance: 'public-record',
      value: 1965,
      at: OSM.attestedAt,
      registry: 'osm',
      sourceRef: 'pbld_0000001',
    });
  });

  it('🔑 διαφωνία ⇒ νικά η δήλωση του αγγελιοδότη (η δημόσια εγγραφή ΔΕΝ τη σβήνει)', () => {
    const resolved = resolveListingConstructionYear({ declared: 1978, publicRecord: record(OSM) }, AT);
    expect(resolved?.provenance).toBe('declared');
    expect(resolved?.value).toBe(1978);
  });

  it('μη αληθοφανής δήλωση ⇒ πέφτει στη δημόσια εγγραφή, όχι σε «διορθωμένη» τιμή', () => {
    const resolved = resolveListingConstructionYear({ declared: 197, publicRecord: record(OSM) }, AT);
    expect(resolved?.provenance).toBe('public-record');
    expect(resolved?.value).toBe(1965);
  });

  it('⛔ δήλωση ΑΛΛΟΥ χρήστη στο επίπεδο Α ΔΕΝ είναι δημόσια εγγραφή', () => {
    const claim: Attested<number> = { ...OSM, source: 'declared' };
    expect(resolveListingConstructionYear({ declared: null, publicRecord: record(claim) }, AT)).toBeNull();
  });

  it('χειρονομία θέσης (`manual`) δεν είναι μητρώο', () => {
    const gesture: Attested<number> = { ...OSM, source: 'manual' };
    expect(resolveListingConstructionYear({ declared: null, publicRecord: record(gesture) }, AT)).toBeNull();
  });
});

describe('φόρμα κτιρίου — κείμενο πεδίου → αλλαγή εγγράφου (ΜΙΑ κρίση, αυτόματη + ρητή αποθήκευση)', () => {
  it('κενό ⇒ `null` («δεν ξέρουμε», ρητά)', () => {
    expect(constructionYearUpdate('  ', 2026)).toEqual({ constructionYear: null });
  });

  it('έγκυρο ⇒ αριθμός', () => {
    expect(constructionYearUpdate(' 1978 ', 2026)).toEqual({ constructionYear: 1978 });
  });

  it('🔴 μισογραμμένο ή άκυρο ⇒ ΔΕΝ αγγίζεται το πεδίο (η αυτόματη αποθήκευση δεν γράφει «19»)', () => {
    for (const raw of ['19', '197', '1978.5', '1e3', '-1978', 'abc', '2099']) {
      expect(constructionYearUpdate(raw, 2026)).toEqual({});
      expect(readConstructionYearInput(raw, 2026).kind).toBe('invalid');
    }
  });
});
