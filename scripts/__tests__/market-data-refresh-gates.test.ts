/**
 * @jest-environment node
 *
 * ADR-889 Φ4 (§11) — πριν ↔ μετά, οι πύλες στο όριό τους (±1), και η αναφορά του PR (ντετερμινιστική, λέει την αλήθεια
 * για κάθε πύλη και κάθε παράκαμψη).
 */

import { mamaSourceUrl } from '../lib/market-transactions/mama-download';
import { VALUE_ZONES_SOURCE_URL } from '../lib/value-zones/zone-download';
import { diffMarket, diffZones, type MarketDiff, type MedianMove } from '../lib/market-data-refresh/refresh-diff';
import {
  REFRESH_THRESHOLDS,
  allGatesPass,
  coverageGate,
  determinismGate,
  freshnessGate,
  massShiftGate,
  prGatesPass,
  unassignedZonesGate,
  volumeGate,
  type GateResult,
} from '../lib/market-data-refresh/refresh-gates';
import type { SourceCheck } from '../lib/market-data-refresh/refresh-probe';
import { accessLine, renderRefreshReport } from '../lib/market-data-refresh/refresh-report';
import type { MamaInput, MarketSnapshot, ZonePrice, ZoneSnapshot } from '../lib/market-data-refresh/refresh-snapshot';
import type { PriceMapAreas } from '../../src/lib/market/price-map';

const checked = (reasons: readonly string[]): SourceCheck => ({ reachable: true, decision: { changed: reasons.length > 0, reasons } });

function input(year: number, rows: number, sha = `sha-${year}`): MamaInput {
  return { year, url: mamaSourceUrl(year), lastModified: 'LM', bytes: 1, sha256: sha, rows };
}

function market(priceMap: PriceMapAreas, inputs: MamaInput[] = [input(2026, 1000)], areaCount = 100): MarketSnapshot {
  return { window: { from: 2022, to: 2026 }, asOf: '2026-09-01', inputs, areaCount, priceMap };
}

function zones(entries: Record<string, ZonePrice>, sha = 'z1', areaCount = 10): ZoneSnapshot {
  return { source: { url: VALUE_ZONES_SOURCE_URL, lastModified: 'LM', sha256: sha }, areaCount, zones: new Map(Object.entries(entries)) };
}

function move(ratio: number, n = 40): MedianMove {
  return { areaId: `a${ratio}`, segment: 'apartment', before: 1000, after: 1000 * ratio, nBefore: n, nAfter: n, ratio };
}

function diffWith(moves: MedianMove[]): MarketDiff {
  return { asOf: { before: 'x', after: 'y' }, years: [], areaCount: { before: 1, after: 1 }, moves, cellsAppeared: [], cellsDisappeared: [] };
}

describe('diffMarket', () => {
  it('διάμεσος πριν ΚΑΙ μετά ⇒ κίνηση· κάτω από το κατώφλι ⇒ εμφανίστηκε/χάθηκε', () => {
    const before = market({ a: { apartment: [40, 1000], house: [6, 900] }, b: { apartment: [3] } });
    const after = market({ a: { apartment: [42, 1100], house: [4] }, b: { apartment: [5, 800] } });
    const diff = diffMarket(before, after);
    expect(diff.moves).toEqual([{ areaId: 'a', segment: 'apartment', before: 1000, after: 1100, nBefore: 40, nAfter: 42, ratio: 1.1 }]);
    expect(diff.cellsDisappeared).toEqual([{ areaId: 'a', segment: 'house' }]);
    expect(diff.cellsAppeared).toEqual([{ areaId: 'b', segment: 'apartment' }]);
  });

  it('έτη: ένωση πριν/μετά, ταξινομημένα', () => {
    const diff = diffMarket(market({}, [input(2022, 5)]), market({}, [input(2023, 6)]));
    expect(diff.years.map((y) => [y.year, y.before?.rows ?? null, y.after?.rows ?? null])).toEqual([[2022, 5, null], [2023, null, 6]]);
  });
});

describe('diffZones', () => {
  it('νέα τιμή · νέες · καταργημένες · νέα ημερομηνία ισχύος (= αναπροσαρμογή)', () => {
    const before = zones({ 'a|1|Α': { price: 1000, validFrom: '2022-01-01' }, 'a|2|Β': { price: 900, validFrom: '2022-01-01' } });
    const after = zones({ 'a|1|Α': { price: 1200, validFrom: '2027-01-01' }, 'a|3|Γ': { price: 800, validFrom: '2022-01-01' } }, 'z2');
    const diff = diffZones(before, after);
    expect(diff.priceChanges).toEqual([{ key: 'a|1|Α', before: 1000, after: 1200 }]);
    expect([diff.added, diff.removed, diff.sourceChanged]).toEqual([1, 1, true]);
    expect(diff.newValidFrom).toEqual(['2027-01-01']);
  });
});

describe('πύλες — στο όριο', () => {
  it('Ε2 κάλυψη: 99% περνά, 98,99% όχι', () => {
    const totals = { rows: 10_000, resolved: 9_900, withheld: 0, unmatched: 100, comparable: 0, areas: 1 };
    expect(coverageGate(totals).ok).toBe(true);
    expect(coverageGate({ ...totals, resolved: 9_899 }).ok).toBe(false);
  });

  it('Ε3 ντετερμινισμός: ένα αρχείο που διαφέρει ⇒ κόκκινο', () => {
    expect(determinismGate([], 10).ok).toBe(true);
    expect(determinismGate(['data/x.json'], 10)).toMatchObject({ ok: false, detail: expect.stringContaining('data/x.json') });
  });

  it('Ε4 ζώνη χωρίς περιοχή ⇒ κόκκινο', () => {
    expect(unassignedZonesGate({ areas: 1, zones: 1, fronts: 0, unassigned: 0, collapsed: 0 }).ok).toBe(true);
    expect(unassignedZonesGate({ areas: 1, zones: 1, fronts: 0, unassigned: 1, collapsed: 0 }).ok).toBe(false);
  });

  it('Ε5 όγκος: −2% περνά, −2,01% όχι· `accept_drop` περνά ΜΕ σημαία', () => {
    const at = (rows: number) => diffMarket(market({}, [input(2025, 10_000)]), market({}, [input(2025, rows)]));
    expect(volumeGate(at(9_800), null, false).ok).toBe(true);
    const dropped = volumeGate(at(9_799), null, false);
    expect(dropped).toMatchObject({ ok: false, detail: expect.stringContaining('γραμμές 2025') });
    expect(volumeGate(at(9_799), null, true)).toMatchObject({ ok: true, overridden: true });
  });

  it('Ε5 όγκος: πλήθος ζωνών', () => {
    const before = zones(Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, { price: 1, validFrom: 'd' }])));
    const after = zones(Object.fromEntries(Array.from({ length: 97 }, (_, i) => [`k${i}`, { price: 1, validFrom: 'd' }])));
    expect(volumeGate(null, diffZones(before, after), false).ok).toBe(false);
  });

  it('Ε6 μαζική μετατόπιση: 20% των κελιών > ±15% περνά, 21% όχι', () => {
    const cells = (shifted: number) => [...Array.from({ length: shifted }, () => move(1.2)), ...Array.from({ length: 100 - shifted }, () => move(1.05))];
    expect(massShiftGate(diffWith(cells(20))).ok).toBe(true);
    expect(massShiftGate(diffWith(cells(21))).ok).toBe(false);
  });

  it('Ε6: κελιά με n < 30 δεν μετρούν· λίγα επιλέξιμα ⇒ η πύλη σωπαίνει ΡΗΤΑ', () => {
    const noisy = Array.from({ length: 100 }, () => move(2, REFRESH_THRESHOLDS.massShiftMinSample - 1));
    expect(massShiftGate(diffWith(noisy))).toMatchObject({ ok: true, detail: expect.stringContaining('σωπαίνει') });
  });
});

describe('αναφορά PR', () => {
  const before = market({ a: { apartment: [40, 1000] } }, [input(2026, 1000, 'old')]);
  const after = market({ a: { apartment: [40, 1100] } }, [input(2026, 1100, 'new')]);
  const report = () =>
    renderRefreshReport({
      market: { check: checked(['ΜΑΜΑ 2026: Last-Modified x → y']), diff: diffMarket(before, after) },
      zones: { check: checked([]), diff: null },
      gates: [determinismGate([], 3), volumeGate(null, null, false)],
    });

  it('ντετερμινιστική: ίδια είσοδος ⇒ ίδιο κείμενο', () => {
    expect(report()).toBe(report());
  });

  it('λέει πηγή, λόγο, κίνηση, πύλες, CC-BY και ότι ΔΕΝ συγχωνεύεται αυτόματα', () => {
    const text = report();
    expect(text).toContain('✅ Όλες οι πύλες πέρασαν');
    expect(text).toContain('ΜΑΜΑ 2026: Last-Modified x → y');
    expect(text).toContain('**+10.0%**');
    expect(text).toContain('🆕');
    expect(text).toContain('CC-BY-4.0');
    expect(text).toContain('Δεν** συγχωνεύεται αυτόματα');
    expect(text).toContain('Ζώνες αντικειμενικών αξιών\n\nΧωρίς αλλαγή');
  });

  it('κόκκινη πύλη ⇒ «κανένα PR»· παράκαμψη ⇒ δηλώνεται', () => {
    const failed = renderRefreshReport({
      market: { check: checked([]), diff: null },
      zones: { check: checked([]), diff: null },
      gates: [determinismGate(['x'], 1), { id: 'E5', title: 't', ok: true, detail: 'd', overridden: true }],
    });
    expect(failed).toContain('❌ Πύλη απέτυχε');
    expect(failed).toContain('παράκαμψη με ανθρώπινη απόφαση');
    expect(allGatesPass([determinismGate(['x'], 1)])).toBe(false);
  });

  const mamaDown = (status: number | null): SourceCheck => ({ reachable: false, reason: `ΜΑΜΑ 2026: απρόσμενο HTTP ${status ?? '—'}`, status });
  const reportFor = (market: SourceCheck, gates: GateResult[] = []): string =>
    renderRefreshReport({ market: { check: market, diff: null }, zones: { check: checked(['ζώνες: Last-Modified a → b']), diff: null }, gates });

  it('ΑΔΗΛΩΤΗ αποτυχία (500) ⇒ ρητό 🔴 στην κορυφή ΚΑΙ στην ενότητα· η άλλη πηγή αναφέρεται κανονικά', () => {
    const text = reportFor(mamaDown(500));
    expect(text).toContain('🔴 **Απρόσιτη πηγή**: Συμβόλαια (ΜΑΜΑ) — το run είναι κόκκινο');
    expect(text).toContain('## Συμβόλαια (ΜΑΜΑ)\n\n🔴 **Απρόσιτη πηγή** — ΜΑΜΑ 2026: απρόσμενο HTTP 500');
    expect(text).not.toContain('Συμβόλαια (ΜΑΜΑ)\n\nΧωρίς αλλαγή');
    expect(text.indexOf('🔴')).toBeLessThan(text.indexOf('## Πύλες'));
  });

  it('ΔΗΛΩΜΕΝΗ γεωφραγή (403) ⇒ ⚠️ με το τεκμήριο και τον δρόμο (runbook), ΚΑΝΕΝΑ 🔴', () => {
    const text = reportFor(mamaDown(403));
    expect(text).toContain('⚠️ **Δηλωμένος περιορισμός πρόσβασης**: Συμβόλαια (ΜΑΜΑ)');
    expect(text).toContain('⚠️ **Γνωστός περιορισμός πρόσβασης** (γεωφραγή, μόνο από GR');
    expect(text).toContain('§11.8');
    expect(text).not.toContain('🔴');
  });

  it('η δηλωμένη πηγή ΑΠΑΝΤΗΣΕ ⇒ ⚠️ «αφαίρεσε τη δήλωση»· ακριβώς μία γραμμή πρόσβασης ανά περίπτωση', () => {
    const text = reportFor(checked([]));
    expect(text).toContain('αφαίρεσε τη δήλωση');
    expect(accessLine('zones', checked([]))).toBeNull();
  });

  it('Ε8 κόκκινη χωρίς άλλη αποτυχία ⇒ «μπαγιάτικα», ΟΧΙ «κανένα PR»· ⚠️ φρεσκάδας ⇒ ⚠️ στον πίνακα', () => {
    const stale = freshnessGate('2026-07-01', new Date('2026-09-29'));
    const text = reportFor(checked([]), [determinismGate([], 1), stale]);
    expect(text).toContain('**μπαγιάτικα** (Ε8)');
    expect(text).not.toContain('κανένα PR**');
    expect(prGatesPass([determinismGate([], 1), stale])).toBe(true);
    expect(allGatesPass([determinismGate([], 1), stale])).toBe(false);
    expect(reportFor(checked([]), [freshnessGate('2026-08-15', new Date('2026-09-29'))])).toContain('| ⚠️ | E8 |');
  });
});

describe('Ε8 — φρεσκάδα (dbt source freshness)', () => {
  const now = new Date('2026-09-29T03:00:00Z');
  const t = REFRESH_THRESHOLDS;

  it(`όρια ±1: ≤ ${t.freshnessWarnAfterDays} ✅ · ${t.freshnessWarnAfterDays + 1} ⚠️ · ${t.freshnessErrorAfterDays} ⚠️ · ${t.freshnessErrorAfterDays + 1} ❌`, () => {
    const at = (days: number) => freshnessGate(new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10), now);
    expect(at(t.freshnessWarnAfterDays)).toMatchObject({ ok: true });
    expect(at(t.freshnessWarnAfterDays).warning).toBeUndefined();
    expect(at(t.freshnessWarnAfterDays + 1)).toMatchObject({ ok: true, warning: true });
    expect(at(t.freshnessErrorAfterDays)).toMatchObject({ ok: true, warning: true });
    expect(at(t.freshnessErrorAfterDays + 1)).toMatchObject({ ok: false });
  });

  it('το μετρημένο σήμερα (asOf 2026-09-01) περνά καθαρά', () => {
    expect(freshnessGate('2026-09-01', now)).toMatchObject({ ok: true, detail: expect.stringContaining('28 ημέρες') });
  });

  it('άκυρο / απόν asOf ⇒ ❌, ποτέ σιωπηλό «περνά»', () => {
    expect(freshnessGate(null, now).ok).toBe(false);
    expect(freshnessGate('2026-02-30', now).ok).toBe(false);
  });
});
