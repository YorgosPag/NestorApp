/**
 * Χρονογραμμή εκδόσεων και διαφορά εκδόσεων με φράχτη (ADR-923 §5.11 · §18).
 *
 * @module subapps/catalog/pricing/__tests__/price-versions
 */

import {
  VERSION_1,
  VERSION_1_LINES,
  VERSION_2,
  VERSION_2_LINES,
} from '../../__tests__/fixtures/mfp-price-list.fixture';
import type { PriceListLineDefinition } from '../../types/price-list';
import { diffPriceVersions } from '../diff-price-versions';
import { judgeVersionPublication, publishedTimeline, versionAt, type PriceVersionRef } from '../version-timeline';

const draft3: PriceVersionRef = { id: 'cplv_gen_3', number: 3, status: 'draft', validFrom: '2027-01-01T00:00:00.000Z' };

describe('χρονογραμμή', () => {
  it('το validTo παράγεται από την επόμενη δημοσιευμένη — κανένα αποθηκευμένο', () => {
    const timeline = publishedTimeline([VERSION_2, draft3, VERSION_1]);
    expect(timeline.map((entry) => [entry.version.id, entry.window])).toEqual([
      [VERSION_1.id, { fromMs: Date.parse(VERSION_1.validFrom ?? ''), untilMs: Date.parse(VERSION_2.validFrom ?? '') }],
      [VERSION_2.id, { fromMs: Date.parse(VERSION_2.validFrom ?? ''), untilMs: null }],
    ]);
  });

  it('η αλλαγή γίνεται ακριβώς στο validFrom της επόμενης', () => {
    const switchAt = Date.parse(VERSION_2.validFrom ?? '');
    expect(versionAt([VERSION_1, VERSION_2], switchAt - 1)?.id).toBe(VERSION_1.id);
    expect(versionAt([VERSION_1, VERSION_2], switchAt)?.id).toBe(VERSION_2.id);
  });
});

describe('judgeVersionPublication', () => {
  const versions = [VERSION_1, VERSION_2, draft3];

  it('πρόχειρη με validFrom μετά την τελευταία δημοσιευμένη ⇒ δημοσιεύεται (και μελλοντικά)', () => {
    expect(judgeVersionPublication(draft3, versions)).toBeNull();
  });

  it('αρνείται μη πρόχειρη, χωρίς ημερομηνία, ή με ημερομηνία που θα έκανε προηγούμενη έκδοση να μην ισχύσει ποτέ', () => {
    expect(judgeVersionPublication(VERSION_2, versions)).toBe('versionNotDraft');
    expect(judgeVersionPublication({ ...draft3, validFrom: null }, versions)).toBe('versionValidFromRequired');
    expect(judgeVersionPublication({ ...draft3, validFrom: VERSION_2.validFrom }, versions)).toBe('versionValidFromNotAfterPrevious');
    expect(judgeVersionPublication({ ...draft3, validFrom: '2026-03-01T00:00:00.000Z' }, versions)).toBe(
      'versionValidFromNotAfterPrevious',
    );
  });
});

describe('diffPriceVersions', () => {
  it('έκδοση 1 → 2 (+8%): 8 αλλαγές, καμία πάνω από τον φράχτη', () => {
    const diff = diffPriceVersions(VERSION_1_LINES, VERSION_2_LINES);
    expect(diff.changes).toHaveLength(8);
    expect(diff.changes.every((change) => change.kind === 'changed' && change.unitPriceChangeBp === 800)).toBe(true);
    expect(diff.fenced).toBe(0);
  });

  const line = (variantId: string, netPrice: number, priceQuantity: 1 | 10 | 100 = 1): PriceListLineDefinition => ({
    versionId: 'v',
    subject: { kind: 'variant', variantId },
    netPrice,
    priceQuantity,
    unitCode: 'pcs',
    discountGroupId: null,
    breakdown: null,
  });

  it('το χαμένο μηδενικό του ERP (×10) κρατείται από τον φράχτη· το ίδιο και τιμή από μηδέν', () => {
    const diff = diffPriceVersions([line('a', 1000), line('b', 0)], [line('a', 10000), line('b', 500)]);
    expect(diff.changes.map((change) => [change.subjectKey, change.unitPriceChangeBp, change.exceedsFence])).toEqual([
      ['variant:a', 90000, true],
      ['variant:b', null, true],
    ]);
    expect(diff.fenced).toBe(2);
  });

  it('συγκρίνει τιμή ανά μονάδα: 84 € «ανά 100» → 0,90 € «ανά 1» = +7,14%, όχι −98,9%', () => {
    const diff = diffPriceVersions([line('cable', 8400, 100)], [line('cable', 90, 1)]);
    expect(diff.changes[0]).toMatchObject({ unitPriceChangeBp: 714, exceedsFence: false });
  });

  it('νέα / αφαιρεμένη / αμετάβλητη γραμμή', () => {
    const diff = diffPriceVersions([line('same', 100), line('gone', 100)], [line('same', 100), line('new', 100)]);
    expect(diff.changes.map((change) => [change.kind, change.subjectKey])).toEqual([
      ['removed', 'variant:gone'],
      ['added', 'variant:new'],
    ]);
    expect(diff.unchanged).toBe(1);
  });

  it('συμμετρική στρογγύλευση: −20% και +25% στο όριο του φράχτη', () => {
    const down = diffPriceVersions([line('a', 1000)], [line('a', 800)]).changes[0];
    expect(down).toMatchObject({ unitPriceChangeBp: -2000, exceedsFence: false });
    const up = diffPriceVersions([line('a', 1000)], [line('a', 1250)]).changes[0];
    expect(up).toMatchObject({ unitPriceChangeBp: 2500, exceedsFence: true });
  });
});
