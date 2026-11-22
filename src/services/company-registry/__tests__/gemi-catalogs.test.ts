/**
 * @jest-environment node
 *
 * @fileoverview Άγκυρες της **πόρτας καταλόγων ΓΕΜΗ** (`fetchRegistryCatalogs` · `parseGemiCatalog`) — ADR-948 §8 Βήμα 3.
 *
 * ⚠️ **Κανένα δίκτυο**: ο μεταφορέας εγχέεται. 🔴 Τα σενάρια που φυλάνε: γραμμή που χάνεται σιωπηλά και διαβάζεται
 * «ο κωδικός αφαιρέθηκε» · αποτυχία που διαβάζεται «κενός κατάλογος» · κλήση χωρίς κλειδί.
 */

import { fetchRegistryCatalogs, type RegistryTransport } from '@/services/company-registry/gemi-opendata.client';
import { parseGemiCatalog } from '@/services/company-registry/gemi-opendata-parse';

const LEGAL_TYPES = [
  { id: 1, descr: 'ΑΕ', descrEn: 'SA', lastUpdated: '2020-01-01' },
  { id: 2, descr: 'ΕΠΕ', descrEn: 'Ltd' },
];
const STATUSES = [{ id: 3, descr: 'Ενεργή', descrEn: 'Active', isActive: true }];

function catalogsTransport(replies: Readonly<Record<string, number | 'network'>> = {}, env: Record<string, string> = { GEMI_OPENDATA_API_KEY: 'k' }) {
  const urls: string[] = [];
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    urls.push(url);
    const isLegal = url.endsWith('/metadata/legalTypes');
    const reply = replies[isLegal ? 'legalTypes' : 'statuses'] ?? 200;
    if (reply === 'network') throw new TypeError('fetch failed');
    return new Response(JSON.stringify(isLegal ? LEGAL_TYPES : STATUSES), { status: reply });
  };
  const transport: RegistryTransport = { fetchImpl: fetchImpl as typeof fetch, env };
  return { transport, urls };
}

describe('Α — αναλυτής καταλόγου', () => {
  it('Α1 — γραμμές με κωδικό ως κείμενο, αγγλική περιγραφή, isActive μόνο όπου υπάρχει', () => {
    expect(parseGemiCatalog([...LEGAL_TYPES, ...STATUSES])).toEqual([
      { id: '1', descr: 'ΑΕ', descrEn: 'SA', isActive: null },
      { id: '2', descr: 'ΕΠΕ', descrEn: 'Ltd', isActive: null },
      { id: '3', descr: 'Ενεργή', descrEn: 'Active', isActive: true },
    ]);
  });

  it.each([
    ['μία άκυρη γραμμή', [...LEGAL_TYPES, { id: 9 }]],
    ['άδειος πίνακας', []],
    ['όχι πίνακας', { items: LEGAL_TYPES }],
  ])('Α2 — %s ⇒ null για ΟΛΟ τον κατάλογο', (_label, payload) => {
    expect(parseGemiCatalog(payload)).toBeNull();
  });
});

describe('Β — η πόρτα', () => {
  it('Β1 — δύο κλήσεις, ολόκληροι κατάλογοι', async () => {
    const { transport, urls } = catalogsTransport();
    const verdict = await fetchRegistryCatalogs(transport);
    expect(verdict.kind).toBe('found');
    if (verdict.kind !== 'found') return;
    expect(verdict.legalTypes.map((entry) => entry.id)).toEqual(['1', '2']);
    expect(verdict.statuses).toEqual([{ id: '3', descr: 'Ενεργή', descrEn: 'Active', isActive: true }]);
    expect(urls).toHaveLength(2);
  });

  it('Β2 — χωρίς κλειδί ⇒ not-configured, καμία κλήση', async () => {
    const { transport, urls } = catalogsTransport({}, {});
    expect(await fetchRegistryCatalogs(transport)).toEqual({ kind: 'unavailable', reason: 'not-configured' });
    expect(urls).toHaveLength(0);
  });

  it.each([
    [{ legalTypes: 429 }, 'rate-limited', 1],
    [{ legalTypes: 401 }, 'unauthorized', 1],
    [{ statuses: 'network' as const }, 'network', 2],
  ])('Β3 — αποτυχία %j ⇒ %s, ποτέ «κενός κατάλογος»', async (replies, reason, calls) => {
    const { transport, urls } = catalogsTransport(replies);
    expect(await fetchRegistryCatalogs(transport)).toEqual({ kind: 'unavailable', reason });
    expect(urls).toHaveLength(calls);
  });
});
