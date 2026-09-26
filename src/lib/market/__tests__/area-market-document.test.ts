/**
 * ADR-890 Φ1 — το σύνορο ανάγνωσης της σύνοψης: έγγραφο της τρέχουσας εκδοχής ⇒ τύπος· οτιδήποτε άλλο ⇒ `null`
 * (απουσία), ποτέ `undefined` στην οθόνη.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { areaMarketRunFromDocument, areaMarketSnapshotFromDocument } from '@/lib/market/area-market-document';
import { summarizeArea } from '@/lib/market/area-market-summary';

describe('areaMarketSnapshotFromDocument', () => {
  const written = summarizeArea('municipality:0701', '2026-09-26', [listing()]);

  it('ό,τι γράφει ο γραφέας διαβάζεται αυτούσιο (κύκλος JSON όπως η Firestore)', () => {
    expect(areaMarketSnapshotFromDocument(JSON.parse(JSON.stringify(written)))).toEqual(written);
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
