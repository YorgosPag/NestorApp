/**
 * @jest-environment node
 *
 * ADR-889 Φ4 (§11) — «άλλαξε η πηγή;»: το τελευταίο δημοσιευμένο έτος (404 τον Ιανουάριο), η σύγκριση κεφαλίδων ↔
 * καταγεγραμμένης προέλευσης, οι επαναλήψεις του `HEAD`, και η ανάγνωση της προβολής «πριν» (άκυρο ⇒ σφάλμα, ποτέ σιωπή).
 */

import type { SourceProbe } from '../lib/cached-download';
import { probeSource } from '../lib/cached-download';
import { latestPublishedMamaYear, mamaSourceUrl, resolveMamaWindow } from '../lib/market-transactions/mama-download';
import { VALUE_ZONES_SOURCE_URL } from '../lib/value-zones/zone-download';
import { probeMarket, probeZones, type Probe } from '../lib/market-data-refresh/refresh-probe';
import { marketSnapshotOf, zoneSnapshotOf, type MamaInput, type MarketSnapshot, type ZoneSnapshot } from '../lib/market-data-refresh/refresh-snapshot';

const LM = 'Thu, 03 Sep 2026 05:15:52 GMT';

function input(year: number, overrides: Partial<MamaInput> = {}): MamaInput {
  return { year, url: mamaSourceUrl(year), lastModified: LM, bytes: 1000 + year, sha256: `sha-${year}`, rows: 100, ...overrides };
}

function market(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  const inputs = [2022, 2023, 2024, 2025, 2026].map((year) => input(year));
  return { window: { from: 2022, to: 2026 }, asOf: '2026-09-01', inputs, areaCount: 10, priceMap: {}, ...overrides };
}

/** Ψεύτικος διακομιστής: απαντά ό,τι λέει ο πίνακας· ό,τι λείπει = 404. */
function server(table: Record<string, Partial<SourceProbe>>): Probe {
  return async (url) => ({ url, status: 404, lastModified: null, bytes: null, ...table[url] });
}

function servedYears(years: readonly number[], override: Partial<Record<number, Partial<SourceProbe>>> = {}): Record<string, Partial<SourceProbe>> {
  return Object.fromEntries(years.map((year) => [mamaSourceUrl(year), { status: 200, lastModified: LM, bytes: 1000 + year, ...override[year] }]));
}

describe('παράθυρο ετών — το τελευταίο ΔΗΜΟΣΙΕΥΜΕΝΟ έτος', () => {
  it('τον Ιανουάριο το νέο έτος δίνει 404 ⇒ to = έτος − 1 (όχι σπασμένος γεννήτορας)', async () => {
    const probe = server(servedYears([2026]));
    expect(await latestPublishedMamaYear(new Date('2027-01-10'), probe)).toBe(2026);
    expect(await resolveMamaWindow([], new Date('2027-01-10'), probe)).toEqual({ from: 2022, to: 2026 });
  });

  it('δημοσιευμένο ⇒ το έτος του ρολογιού', async () => {
    expect(await resolveMamaWindow([], new Date('2026-09-28'), server(servedYears([2026])))).toEqual({ from: 2022, to: 2026 });
  });

  it('ΜΟΝΟ το 404 σημαίνει «όχι ακόμη» — 403 δεν μασκάρεται', async () => {
    const probe = server({ [mamaSourceUrl(2026)]: { status: 403 } });
    await expect(latestPublishedMamaYear(new Date('2026-09-28'), probe)).rejects.toThrow('403');
  });

  it('ρητά --from/--to νικούν· άκυρο παράθυρο πετά', async () => {
    const never: Probe = () => Promise.reject(new Error('δεν έπρεπε να ρωτηθεί'));
    expect(await resolveMamaWindow(['--from=2019', '--to=2021'], new Date(), never)).toEqual({ from: 2019, to: 2021 });
    await expect(resolveMamaWindow(['--from=2016', '--to=2021'], new Date(), never)).rejects.toThrow('2017');
  });
});

describe('probeMarket', () => {
  const window = { from: 2022, to: 2026 };
  const years = [2022, 2023, 2024, 2025, 2026];

  it('ίδιες κεφαλίδες ⇒ καμία αλλαγή', async () => {
    expect(await probeMarket(market(), window, server(servedYears(years)))).toEqual({ changed: false, reasons: [] });
  });

  it('νέο Last-Modified (αναθεώρηση ΠΑΛΙΟΥ έτους) ⇒ αλλαγή με λόγο', async () => {
    const result = await probeMarket(market(), window, server(servedYears(years, { 2023: { lastModified: 'Mon, 17 Mar 2025 11:18:19 GMT' } })));
    expect(result.changed).toBe(true);
    expect(result.reasons).toEqual([expect.stringContaining('ΜΑΜΑ 2023: Last-Modified')]);
  });

  it('ίδια ημερομηνία, άλλο μέγεθος ⇒ αλλαγή', async () => {
    const result = await probeMarket(market(), window, server(servedYears(years, { 2026: { bytes: 5 } })));
    expect(result.reasons).toEqual([expect.stringContaining('μέγεθος')]);
  });

  it('χωρίς Last-Modified ⇒ «άλλαξε» (κρίνει το sha256 της εξόδου)', async () => {
    const result = await probeMarket(market(), window, server(servedYears(years, { 2025: { lastModified: null } })));
    expect(result.changed).toBe(true);
  });

  it('κύλιση παραθύρου ⇒ αλλαγή, και το νέο έτος δηλώνεται', async () => {
    const result = await probeMarket(market(), { from: 2023, to: 2027 }, server(servedYears([2023, 2024, 2025, 2026, 2027])));
    expect(result.reasons).toEqual(expect.arrayContaining([expect.stringContaining('παράθυρο 2022–2026 → 2023–2027'), expect.stringContaining('ΜΑΜΑ 2027: νέο έτος')]));
  });

  it('έτος του παραθύρου που δεν σερβίρεται ⇒ ΣΦΑΛΜΑ, ποτέ «καμία αλλαγή»', async () => {
    await expect(probeMarket(market(), window, server(servedYears([2022, 2023, 2024, 2026])))).rejects.toThrow('ΜΑΜΑ 2025: HTTP 404');
  });

  it('χωρίς προηγούμενη έξοδο ⇒ αλλαγή', async () => {
    expect((await probeMarket(null, window, server({}))).changed).toBe(true);
  });
});

describe('probeZones', () => {
  const zones: ZoneSnapshot = { source: { url: VALUE_ZONES_SOURCE_URL, lastModified: LM, sha256: 'z' }, areaCount: 1, zones: new Map() };

  it('ίδιο Last-Modified ⇒ καμία αλλαγή · άλλο ⇒ αλλαγή', async () => {
    expect((await probeZones(zones, server({ [VALUE_ZONES_SOURCE_URL]: { status: 200, lastModified: LM } }))).changed).toBe(false);
    expect((await probeZones(zones, server({ [VALUE_ZONES_SOURCE_URL]: { status: 200, lastModified: 'x' } }))).changed).toBe(true);
  });

  it('πόρος που λείπει ⇒ ΣΦΑΛΜΑ', async () => {
    await expect(probeZones(zones, server({}))).rejects.toThrow('HTTP 404');
  });
});

describe('probeSource — επαναλήψεις', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('σφάλμα δικτύου → ξανά → επιτυχία', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { 'last-modified': LM, 'content-length': '42' } }));
    global.fetch = fetchMock;
    expect(await probeSource('https://x/y', 3, 0)).toEqual({ url: 'https://x/y', status: 200, lastModified: LM, bytes: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ζητά identity· κωδικοποιημένη απάντηση ⇒ μέγεθος άγνωστο (ο gsis.gr έδινε «20 bytes» με gzip)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(null, { status: 200, headers: { 'content-length': '20', 'content-encoding': 'gzip' } }));
    global.fetch = fetchMock;
    expect((await probeSource('https://x/y', 1, 0)).bytes).toBeNull();
    expect(fetchMock.mock.calls[0][1].headers['Accept-Encoding']).toBe('identity');
  });

  it('5xx σε όλες τις προσπάθειες ⇒ πετά («πηγή κάτω» = κόκκινο)', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(probeSource('https://x/y', 2, 0)).rejects.toThrow('HTTP 503');
  });

  it('404 επιστρέφεται (το κρίνει ο καλών), χωρίς επανάληψη', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(null, { status: 404 }));
    global.fetch = fetchMock;
    expect((await probeSource('https://x/y', 3, 0)).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('προβολή «πριν» — άκυρο αρχείο ⇒ σφάλμα', () => {
  const index = { v: 2, asOf: '2026-09-01', window: { from: 2022, to: 2026 }, inputs: [input(2026)], areas: [['a', 'A', 6, 1, 1]] };
  const priceMap = { v: 1, asOf: '2026-09-01', areas: { a: { apartment: [12, 1500] } } };

  it('διαβάζει προέλευση, πλήθος περιοχών, χάρτη τιμών', () => {
    const snapshot = marketSnapshotOf(index, priceMap);
    expect(snapshot.inputs[0].sha256).toBe('sha-2026');
    expect(snapshot.areaCount).toBe(1);
    expect(snapshot.priceMap.a?.apartment).toEqual([12, 1500]);
  });

  it('χαλασμένο inputs / χάρτης ⇒ πετά', () => {
    expect(() => marketSnapshotOf({ ...index, inputs: [{ year: 2026 }] }, priceMap)).toThrow('inputs');
    expect(() => marketSnapshotOf(index, { v: 99 })).toThrow('price-map');
  });

  it('ζώνες: ταυτότητα = περιοχή|id|γράμμα(|δρόμος) — το id μόνο του δεν είναι μοναδικό', () => {
    const zoneIndex = { source: { url: VALUE_ZONES_SOURCE_URL, lastModified: LM, sha256: 'z' }, areas: { a: [0, 0, 1, 1], b: [0, 0, 1, 1] } };
    const zone = { id: 7, name: 'Α', price: 1000, validFrom: '2022-01-01' };
    const snapshot = zoneSnapshotOf(zoneIndex, [
      { id: 'a', zones: [zone], fronts: [{ ...zone, street: 'ΟΔΟΣ' }] },
      { id: 'b', zones: [zone], fronts: [] },
    ]);
    expect([...snapshot.zones.keys()].sort()).toEqual(['a|7|Α', 'a|7|Α|ΟΔΟΣ', 'b|7|Α']);
    expect(() => zoneSnapshotOf(zoneIndex, [{ id: 'a', zones: [{ id: 7 }], fronts: [] }])).toThrow('value-zones/a');
  });
});
