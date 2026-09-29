/**
 * ADR-890 Φ1 — η σύνοψη ζητούμενων τιμών ανά περιοχή: ποια τιμή μετρά, ποια αποκλείεται και γιατί, πώς
 * σπάει σε κάδους, και σε ποιες περιοχές ανήκει κάθε αγγελία.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { AdminAreaAssignment } from '@/lib/geo/admin-area-of-point';
import {
  areaMarketKeysOf,
  groupListingsByArea,
  observeAsking,
  summarizeArea,
  summarizeOffer,
} from '@/lib/market/area-market-summary';
import { SEGMENT_BREAKDOWN_AXES } from '@/lib/market/market-breakdowns';
import { MARKET_SEGMENTS, SEGMENT_METRIC } from '@/lib/market/market-segments';
import { isReportedStatCell, MARKET_STAT_MIN_SAMPLE } from '@/lib/market/market-statistics';
import type { PublicListing } from '@/types/public-listing';

const THESSALONIKI: AdminAreaAssignment = {
  regionId: 'region:112',
  regionalUnitId: 'regional_unit:07',
  municipalityId: 'municipality:0701',
  municipalUnitId: 'municipal_unit:070101',
  communityId: null,
  nearBoundary: false,
};

const ATHENS: AdminAreaAssignment = {
  ...THESSALONIKI,
  municipalityId: 'municipality:4501',
  municipalUnitId: null,
};

describe('observeAsking — ποια τιμή είναι «ζητούμενη»', () => {
  it('πώληση: askingPrice / εμβαδόν', () => {
    const verdict = observeAsking(listing({ areaSqm: 100 }), 'sale');
    expect(verdict).toEqual({ observed: expect.objectContaining({ segment: 'apartment', unitPrice: 2000 }) });
  });

  it('ΠΟΤΕ τιμή συμβολαίου: finalPrice χωρίς askingPrice ⇒ noPrice', () => {
    const sold = listing({ commercial: { askingPrice: null, finalPrice: 180_000, rentPrice: null, nightlyRate: null } });
    expect(observeAsking(sold, 'sale')).toEqual({ excluded: 'noPrice' });
  });

  it('η αγγελία που δεν προσφέρει ενοίκιο δεν μετρά καθόλου στο ενοίκιο', () => {
    expect(observeAsking(listing(), 'rent')).toBeNull();
  });

  it('πώληση & ενοίκιο: κάθε τιμή κρίνεται με τη ΔΙΚΗ της ζώνη', () => {
    const dual = listing({
      commercialStatus: 'for-sale-and-rent',
      offerKinds: ['sell', 'leaseOut'],
      commercial: { askingPrice: 200_000, finalPrice: null, rentPrice: 800, nightlyRate: null },
    });
    expect(observeAsking(dual, 'rent')).toEqual({ observed: expect.objectContaining({ unitPrice: 8 }) });
  });

  it('αγγελία εκτός αγοράς (κρατημένη) δεν μετρά', () => {
    expect(observeAsking(listing({ commercialStatus: 'reserved' }), 'sale')).toBeNull();
  });

  it('μη αληθοφανής τιμή (τυπογραφικό) ⇒ implausible', () => {
    expect(observeAsking(listing({ commercial: { askingPrice: 2_000_000_000, finalPrice: null, rentPrice: null, nightlyRate: null } }), 'sale'))
      .toEqual({ excluded: 'implausible' });
  });

  it('οικόπεδο 200 €/τ.μ. είναι αληθοφανές (η γη ΔΕΝ κρίνεται ως κατοικία)', () => {
    const plot = listing({ type: 'plot', areaSqm: 500, commercial: { askingPrice: 100_000, finalPrice: null, rentPrice: null, nightlyRate: null } });
    expect(observeAsking(plot, 'sale')).toEqual({ observed: expect.objectContaining({ segment: 'land', unitPrice: 200 }) });
  });

  it('χωρίς εμβαδόν ⇒ noSize · χωρίς τύπο ⇒ noSegment', () => {
    expect(observeAsking(listing({ areaSqm: null }), 'sale')).toEqual({ excluded: 'noSize' });
    expect(observeAsking(listing({ type: null }), 'sale')).toEqual({ excluded: 'noSegment' });
  });
});

describe('summarizeOffer — κατώφλι, λογιστική, κάδοι', () => {
  const five = [60, 70, 90, 100, 130].map((areaSqm, index) =>
    listing({ id: `prop_${index}`, areaSqm, bedrooms: index < 2 ? 1 : null }),
  );

  it(`κάτω από ${MARKET_STAT_MIN_SAMPLE}: μόνο πλήθος, ο αριθμός δεν υπολογίζεται`, () => {
    const summary = summarizeOffer(five.slice(0, 4), 'sale');
    expect(summary.segments.apartment?.unitPrice).toEqual({ n: 4 });
  });

  it('στο κατώφλι: διάμεσος + P25/P75 €/τ.μ.', () => {
    const cell = summarizeOffer(five, 'sale').segments.apartment?.unitPrice;
    expect(cell !== undefined && isReportedStatCell(cell)).toBe(true);
    // 200.000 € / {60, 70, 90, 100, 130} τ.μ. ⇒ ταξινομημένα 1538 · 2000 · 2222 · 2857 · 3333
    expect(cell).toEqual({ n: 5, median: 2222, p25: 2000, p75: 2857 });
  });

  it('η λογιστική κλείνει: listings = counted + Σ excluded', () => {
    const summary = summarizeOffer([...five, listing({ id: 'prop_x', areaSqm: null })], 'sale');
    const excluded = Object.values(summary.excluded).reduce((sum, value) => sum + value, 0);
    expect(summary.listings).toBe(6);
    expect(summary.counted + excluded).toBe(summary.listings);
    expect(summary.excluded.noSize).toBe(1);
  });

  it('κάδοι εμβαδού [κάτω, άνω) και «δεν δήλωσαν» στα υπνοδωμάτια', () => {
    const breakdowns = summarizeOffer(five, 'sale').segments.apartment?.breakdowns;
    expect(Object.keys(breakdowns?.size?.buckets ?? {})).toEqual(['50-79', '80-119', '120-199']);
    expect(breakdowns?.bedrooms).toEqual({ buckets: { 1: { n: 2 } }, undeclared: 3 });
  });

  it('το οικόπεδο δεν αναλύεται σε υπνοδωμάτια, όροφο ή έτος κατασκευής', () => {
    const plot = listing({ type: 'plot', areaSqm: 700 });
    expect(Object.keys(summarizeOffer([plot], 'sale').segments.land?.breakdowns ?? {})).toEqual(['size']);
  });

  it('ADR-890 §12 — έτος κατασκευής: μετρά η δημόσια τιμή (δήλωση Ή δημόσια εγγραφή), χωρίς έτος ⇒ «δεν δήλωσαν»', () => {
    const AT = '2026-09-26T00:00:00.000Z';
    const built = (id: string, value: number | null, source: 'declared' | 'osm' = 'declared') => {
      const constructionYear: PublicListing['constructionYear'] = value === null
        ? null
        : source === 'declared'
          ? { provenance: 'declared', value, at: AT }
          : { provenance: 'public-record', value, at: AT, registry: 'osm', sourceRef: 'pbld_0000001' };
      return listing({ id, constructionYear });
    };
    const yearBuilt = summarizeOffer(
      [built('a', 1975), built('b', 1984, 'osm'), built('c', 1985), built('d', 2024), built('e', null)],
      'sale',
    ).segments.apartment?.breakdowns.yearBuilt;
    expect(yearBuilt).toEqual({
      buckets: { '1960-1984': { n: 2 }, '1985-1999': { n: 1 }, gte2020: { n: 1 } },
      undeclared: 1,
    });
  });

  it('ο άξονας έτους ⇔ τμήμα με κτίσμα — το ΙΔΙΟ κριτήριο με τα συμβόλαια του ΜΑΜΑ (αλλιώς η σύγκριση ανά κάδο σπάει)', () => {
    for (const segment of MARKET_SEGMENTS) {
      expect(SEGMENT_BREAKDOWN_AXES[segment].includes('yearBuilt')).toBe(SEGMENT_METRIC[segment] === 'perSqmBuilding');
    }
  });
});

describe('περιοχές — κάθε βαθμίδα με σελίδα, και οι δήμοι χωρίς Δ.Ε.', () => {
  it('αγγελία με Δ.Ε. μετρά σε ΟΛΕΣ τις βαθμίδες με σελίδα (ADR-890 §16: διάμεσος από τις αγγελίες, όχι από διαμέσους)', () => {
    expect(areaMarketKeysOf(listing({ adminArea: THESSALONIKI }))).toEqual([
      'region:112',
      'regional_unit:07',
      'municipality:0701',
      'municipal_unit:070101',
    ]);
  });

  it('δήμος χωρίς Δ.Ε. (Αθηναίων) δεν έχει κλειδί Δ.Ε.', () => {
    expect(areaMarketKeysOf(listing({ adminArea: ATHENS }))).toEqual(['region:112', 'regional_unit:07', 'municipality:4501']);
  });

  it('χωρίς adminArea ⇒ καμία περιοχή, μετριέται ως unassigned', () => {
    const groups = groupListingsByArea([listing({ adminArea: THESSALONIKI }), listing({ id: 'prop_2' })]);
    expect(groups.unassigned).toBe(1);
    expect(groups.byArea.get('municipality:0701')).toHaveLength(1);
  });

  it('summarizeArea: σχήμα εγγράφου', () => {
    const snapshot = summarizeArea('municipality:0701', '2026-09-26', [listing({ adminArea: THESSALONIKI })]);
    expect(snapshot).toEqual(expect.objectContaining({ schemaVersion: 1, areaId: 'municipality:0701', day: '2026-09-26', listingCount: 1 }));
    expect(snapshot.offers.rent.listings).toBe(0);
  });
});
