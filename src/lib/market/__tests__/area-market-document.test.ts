/**
 * ADR-890 Φ1 — το σύνορο ανάγνωσης της σύνοψης: έγγραφο της τρέχουσας εκδοχής ⇒ τύπος· οτιδήποτε άλλο ⇒ `null`
 * (απουσία), ποτέ `undefined` στην οθόνη.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import {
  areaMarketRunFromDocument,
  areaMarketSeriesFromDocument,
  areaMarketSeriesPointsFromDocument,
  areaMarketSnapshotFromDocument,
} from '@/lib/market/area-market-document';
import { nextAreaMarketSeries } from '@/lib/market/area-market-series';
import { summarizeArea } from '@/lib/market/area-market-summary';

describe('areaMarketSnapshotFromDocument', () => {
  const written = summarizeArea('municipality:0701', '2026-09-26', [listing()]);

  it('ό,τι γράφει ο γραφέας διαβάζεται αυτούσιο (κύκλος JSON όπως η Firestore)', () => {
    expect(areaMarketSnapshotFromDocument(JSON.parse(JSON.stringify(written)))).toEqual(written);
  });

  it('ADR-890 §12.1 — έγγραφο γραμμένο ΠΡΙΝ από τον άξονα έτους (χωρίς `yearBuilt`) διαβάζεται αυτούσιο, όχι ως απουσία', () => {
    const apartment = written.offers.sale.segments.apartment;
    if (apartment === undefined) throw new Error('λείπει το τμήμα');
    const { yearBuilt: _new, ...legacyBreakdowns } = apartment.breakdowns;
    const legacy = {
      ...written,
      offers: { ...written.offers, sale: { ...written.offers.sale, segments: { apartment: { ...apartment, breakdowns: legacyBreakdowns } } } },
    };
    const read = areaMarketSnapshotFromDocument(JSON.parse(JSON.stringify(legacy)));
    expect(read).toEqual(legacy);
    expect(read?.offers.sale.segments.apartment?.breakdowns.yearBuilt).toBeUndefined();
  });

  it.each([
    ['άλλη εκδοχή σχήματος', { ...written, schemaVersion: 2 }],
    ['χωρίς offers.rent', { ...written, offers: { sale: written.offers.sale } }],
    ['χωρίς areaId', { ...written, areaId: undefined }],
    ['όχι αντικείμενο', 'x'],
    ['null', null],
  ])('%s ⇒ null', (_label, raw) => {
    expect(areaMarketSnapshotFromDocument(raw)).toBeNull();
  });
});

describe('areaMarketRunFromDocument', () => {
  const run = { schemaVersion: 1, day: '2026-09-26', areas: 3, listings: 12, unassigned: 11, truncated: false, completedAt: '2026-09-26T00:25:00.000Z' };

  it('έγκυρο σημάδι ⇒ αυτούσιο', () => {
    expect(areaMarketRunFromDocument(run)).toEqual(run);
  });

  it('χωρίς truncated ⇒ null', () => {
    const { truncated: _omit, ...partial } = run;
    expect(areaMarketRunFromDocument(partial)).toBeNull();
  });
});

describe('areaMarketSeriesFromDocument / areaMarketSeriesPointsFromDocument (ADR-890 §13)', () => {
  const written = nextAreaMarketSeries(null, 'municipality:0701', '2026-09-28', [listing({ id: 'prop_1' })]);
  const stored = JSON.parse(JSON.stringify(written));

  it('ό,τι γράφει ο γραφέας διαβάζεται αυτούσιο· η σελίδα παίρνει μόνο τα σημεία', () => {
    expect(areaMarketSeriesFromDocument(stored)).toEqual(written);
    expect(areaMarketSeriesPointsFromDocument(stored)).toEqual(written.points);
  });

  it('η προβολή της σελίδας (χωρίς βιβλίο, fieldMask) δίνει σημεία — αλλά ΔΕΝ περνά για τον γραφέα', () => {
    const { book: _book, ...pageView } = stored;
    expect(areaMarketSeriesPointsFromDocument(pageView)).toEqual(written.points);
    expect(areaMarketSeriesFromDocument(pageView)).toBeNull();
  });

  it('άλλη εκδοχή σχήματος ⇒ null (απουσία, όχι βλάβη)', () => {
    expect(areaMarketSeriesPointsFromDocument({ ...stored, schemaVersion: 2 })).toBeNull();
  });
});
