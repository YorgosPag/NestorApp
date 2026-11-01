/**
 * @jest-environment node
 *
 * @fileoverview Άγκυρες της **αναζήτησης ΓΕΜΗ με ΑΦΜ** — ADR-923 §5.13 Ε1β.
 * @related services/company-registry/gemi-opendata.client.ts · gemi-opendata-parse.ts
 *
 * ⚠️ Κανένα δίκτυο, ΑΦΜ και αριθμοί συνθετικοί. Το σχήμα ακολουθεί το OpenAPI του ΓΕΜΗ (2026-11-01), όχι ζωντανή κλήση.
 */

import {
  lookupRegistryNumbersByTaxId,
  type RegistryTransport,
} from '@/services/company-registry/gemi-opendata.client';
import { parseGemiTaxSearch } from '@/services/company-registry/gemi-opendata-parse';

const mockWarn = jest.fn();

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: (...args: unknown[]) => mockWarn(...args), info: jest.fn(), error: jest.fn() }),
}));

const TAX_ID = '123456783';
const WITH_KEY = { GEMI_OPENDATA_API_KEY: 'test-key' };

function transportFor(reply: Response | Error, env = WITH_KEY): { transport: RegistryTransport; calls: () => string[] } {
  const urls: string[] = [];
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    urls.push(String(input));
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return { transport: { fetchImpl: fetchImpl as typeof fetch, env }, calls: () => urls };
}

const found = (results: unknown[], totalCount = results.length): Response =>
  new Response(JSON.stringify({ searchMetadata: { totalCount, resultsOffset: 0, resultsSize: '200' }, searchResults: results }), { status: 200 });

beforeEach(() => mockWarn.mockClear());

describe('parseGemiTaxSearch', () => {
  it('κρατά μόνο αριθμούς ΓΕΜΗ, κανένα άλλο πεδίο', () => {
    const payload = { searchMetadata: { totalCount: 2 }, searchResults: [{ arGemi: 123456789000, afm: TAX_ID, coNameEl: 'Α' }, { arGemi: '999999999000', afm: TAX_ID }] };
    expect(parseGemiTaxSearch(payload)).toEqual(['123456789000', '999999999000']);
  });

  it('κενή απάντηση είναι κενή λίστα, όχι άρνηση', () => {
    expect(parseGemiTaxSearch({ searchMetadata: { totalCount: 0 }, searchResults: [] })).toEqual([]);
  });

  it('περικομμένη απάντηση απορρίπτεται, αλλιώς θα έβγαινε ψευδές mismatched', () => {
    expect(parseGemiTaxSearch({ searchMetadata: { totalCount: 201 }, searchResults: [{ arGemi: 123456789000 }] })).toBeNull();
  });

  it('αποτέλεσμα χωρίς αριθμό απορρίπτει όλη την απάντηση', () => {
    expect(parseGemiTaxSearch({ searchMetadata: { totalCount: 1 }, searchResults: [{ afm: TAX_ID }] })).toBeNull();
  });

  it.each([[null], [[]], [{ searchResults: [] }], [{ searchMetadata: { totalCount: 0 } }]])('άκυρο σχήμα %#', (payload) => {
    expect(parseGemiTaxSearch(payload)).toBeNull();
  });
});

describe('lookupRegistryNumbersByTaxId', () => {
  it('ρωτά με afm και το μέγιστο resultsSize', async () => {
    const { transport, calls } = transportFor(found([{ arGemi: 123456789000 }]));
    await expect(lookupRegistryNumbersByTaxId(TAX_ID, transport)).resolves.toEqual({ kind: 'results', registrationNumbers: ['123456789000'] });
    expect(calls()).toHaveLength(1);
    expect(calls()[0]).toContain(`/companies?afm=${TAX_ID}&resultsSize=200`);
  });

  it.each([['123456789'], ['12345678'], ['000000000'], ['']])('άκυρο ΑΦΜ %s: καμία κλήση', async (taxId) => {
    const { transport, calls } = transportFor(found([]));
    await expect(lookupRegistryNumbersByTaxId(taxId, transport)).resolves.toEqual({ kind: 'invalid-tax-id' });
    expect(calls()).toHaveLength(0);
  });

  it('χωρίς κλειδί δεν ρωτά', async () => {
    const { transport, calls } = transportFor(found([]), {} as typeof WITH_KEY);
    await expect(lookupRegistryNumbersByTaxId(TAX_ID, transport)).resolves.toEqual({ kind: 'unavailable', reason: 'not-configured' });
    expect(calls()).toHaveLength(0);
  });

  it.each([
    [404, 'server'],
    [400, 'server'],
    [401, 'unauthorized'],
    [429, 'rate-limited'],
  ])('το %i δεν γίνεται ποτέ «δεν υπάρχει»', async (status, reason) => {
    const { transport } = transportFor(new Response(null, { status }));
    await expect(lookupRegistryNumbersByTaxId(TAX_ID, transport)).resolves.toEqual({ kind: 'unavailable', reason });
  });

  it('περικομμένο σώμα δίνει malformed-response', async () => {
    const { transport } = transportFor(found([{ arGemi: 123456789000 }], 300));
    await expect(lookupRegistryNumbersByTaxId(TAX_ID, transport)).resolves.toEqual({ kind: 'unavailable', reason: 'malformed-response' });
  });

  it('σφάλμα δικτύου που κουβαλά τη διεύθυνση δεν φτάνει στο log', async () => {
    const { transport } = transportFor(new TypeError(`fetch failed for /companies?afm=${TAX_ID}`));
    await expect(lookupRegistryNumbersByTaxId(TAX_ID, transport)).resolves.toEqual({ kind: 'unavailable', reason: 'network' });
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockWarn.mock.calls)).not.toContain(TAX_ID);
  });
});
