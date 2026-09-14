/**
 * @jest-environment node
 *
 * @fileoverview Άγκυρες του **αναγνώστη ΓΕΜΗ** — ADR-841 §7 Α23 (Φ1).
 * @related services/company-registry/gemi-opendata.client.ts · gemi-opendata-parse.ts
 *
 * ⚠️ **Κανένα δίκτυο**: ο μεταφορέας εγχέεται. Τα σώματα ακολουθούν το **πραγματικό** OpenAPI
 * του ΓΕΜΗ (`Company` · `CompanyStatus`), κατεβασμένο ζωντανά 2026-09-14.
 *
 * Ομάδες: **Ε** ετυμηγορία ανά απάντηση · **Λ** ελαχιστοποίηση · **Κ** κατάσταση · **Μ** μνήμη.
 */

import {
  clearRegistryCaches,
  fetchRegistryCompany,
  lookupRegistryCompany,
  type RegistryTransport,
} from '@/services/company-registry/gemi-opendata.client';

const WITH_KEY = { GEMI_OPENDATA_API_KEY: 'test-key' };

/** Ένα `Company` όπως το στέλνει το ΓΕΜΗ — **με** τα πεδία που ΔΕΝ πρέπει να κρατηθούν. */
const COMPANY = {
  arGemi: 123456789000,
  afm: '801832652',
  coNameEl: 'ΠΑΓΩΝΗΣ ΕΝΕΡΓΕΙΑΚΗ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
  coNamesEn: ['PAGONIS ENERGEIAKI KATASKEVASTIKI AE'],
  coTitlesEl: ['ΠΑΓΩΝΗΣ ΕΝΕΡΓΕΙΑΚΗ', ' '],
  coTitlesEn: ['PAGONIS ENERGY'],
  municipality: { id: 4901, descr: 'ΘΕΣΣΑΛΟΝΙΚΗΣ' },
  city: 'ΘΕΣΣΑΛΟΝΙΚΗ',
  street: 'ΣΑΜΟΘΡΑΚΗΣ',
  streetNumber: '16',
  zipCode: '56334',
  legalType: { id: 1, descr: 'ΑΕ' },
  status: { id: 3, descr: 'Ενεργή' },
  isBranch: false,
  autoRegistered: true,
  objective: 'Κατασκευές',
  persons: [{ firstName: 'ΓΕΩΡΓΙΟΣ', lastName: 'ΠΑΓΩΝΗΣ', role: 'Πρόεδρος ΔΣ' }],
  capital: [{ amount: 25000 }],
};

const STATUSES = [
  { id: 3, descr: 'Ενεργή', isActive: true },
  { id: 6, descr: 'Διαγραμμένη', isActive: false },
];

type Reply = { readonly status: number; readonly body?: unknown; readonly raw?: string } | 'network';

interface FakeRegistry {
  readonly transport: RegistryTransport;
  readonly urls: string[];
  readonly apiKeys: (string | null)[];
}

function fakeRegistry(company: Reply, statuses: Reply = { status: 200, body: STATUSES }, env = WITH_KEY): FakeRegistry {
  const urls: string[] = [];
  const apiKeys: (string | null)[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    urls.push(url);
    apiKeys.push(new Headers(init?.headers).get('api_key'));
    const reply = url.endsWith('/metadata/companyStatuses') ? statuses : company;
    if (reply === 'network') throw new TypeError('fetch failed');
    const body = reply.raw ?? (reply.body === undefined ? null : JSON.stringify(reply.body));
    return new Response(body, { status: reply.status });
  };
  return { transport: { fetchImpl: fetchImpl as typeof fetch, env }, urls, apiKeys };
}

const companyCalls = (fake: FakeRegistry) => fake.urls.filter((url) => url.includes('/companies/')).length;

beforeEach(() => {
  clearRegistryCaches();
});

describe('Ε — κάθε απάντηση έχει ΜΙΑ ετυμηγορία', () => {
  it('Ε1 — 200 ⇒ found, με το κλειδί στην κεφαλίδα `api_key` και τον κανονικό αριθμό στη διαδρομή', async () => {
    const fake = fakeRegistry({ status: 200, body: COMPANY });
    const verdict = await fetchRegistryCompany('1234 5678 9000', fake.transport);

    expect(verdict.kind).toBe('found');
    if (verdict.kind !== 'found') return;
    expect(verdict.record.registrationNumber).toBe('123456789000');
    expect(verdict.record.legalName).toBe(COMPANY.coNameEl);
    expect(verdict.record.distinctiveTitles).toEqual(['ΠΑΓΩΝΗΣ ΕΝΕΡΓΕΙΑΚΗ']);
    expect(verdict.record.legalForm).toEqual({ id: '1', label: 'ΑΕ' });
    expect(verdict.record.seat).toEqual({
      street: 'ΣΑΜΟΘΡΑΚΗΣ',
      streetNumber: '16',
      postalCode: '56334',
      city: 'ΘΕΣΣΑΛΟΝΙΚΗ',
      municipality: { id: '4901', label: 'ΘΕΣΣΑΛΟΝΙΚΗΣ' },
    });
    expect(fake.urls[0]).toMatch(/\/companies\/123456789000$/);
    expect(fake.apiKeys.every((key) => key === 'test-key')).toBe(true);
  });

  it('Ε2 — 404 και 400 ⇒ absent (ρωτήθηκε καθαρά)', async () => {
    for (const status of [404, 400]) {
      clearRegistryCaches();
      expect(await fetchRegistryCompany('123456789000', fakeRegistry({ status }).transport)).toEqual({ kind: 'absent' });
    }
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rate-limited'],
    [503, 'server'],
    [500, 'server'],
  ])('Ε3 — %i ⇒ unavailable/%s, ΠΟΤΕ absent', async (status, reason) => {
    const verdict = await fetchRegistryCompany('123456789000', fakeRegistry({ status }).transport);
    expect(verdict).toEqual({ kind: 'unavailable', reason });
  });

  it('Ε4 — δίκτυο που πέφτει ⇒ unavailable/network', async () => {
    const verdict = await fetchRegistryCompany('123456789000', fakeRegistry('network').transport);
    expect(verdict).toEqual({ kind: 'unavailable', reason: 'network' });
  });

  it('Ε5 — 🔑 χωρίς κλειδί ⇒ not-configured, και ΚΑΜΙΑ κλήση', async () => {
    const fake = fakeRegistry({ status: 200, body: COMPANY }, undefined, {});
    expect(await fetchRegistryCompany('123456789000', fake.transport)).toEqual({
      kind: 'unavailable',
      reason: 'not-configured',
    });
    expect(fake.urls).toHaveLength(0);
  });

  it('Ε6 — ό,τι δεν είναι αριθμός ΓΕΜΗ ⇒ invalid-number, και ΚΑΜΙΑ κλήση', async () => {
    const fake = fakeRegistry({ status: 200, body: COMPANY });
    expect(await lookupRegistryCompany('ΑΒΓ-12', fake.transport)).toEqual({ kind: 'invalid-number' });
    expect(fake.urls).toHaveLength(0);
  });

  it('Ε7 — 200 με σώμα που δεν περνά τον φρουρό ⇒ malformed-response', async () => {
    for (const reply of [{ status: 200, raw: '<html>' }, { status: 200, body: { arGemi: 123456789000 } }]) {
      clearRegistryCaches();
      const verdict = await fetchRegistryCompany('123456789000', fakeRegistry(reply).transport);
      expect(verdict).toEqual({ kind: 'unavailable', reason: 'malformed-response' });
    }
  });

  it('Ε8 — 🔴 απάντηση για ΑΛΛΟΝ αριθμό ⇒ malformed-response, όχι found', async () => {
    const fake = fakeRegistry({ status: 200, body: { ...COMPANY, arGemi: 999999999000 } });
    const verdict = await fetchRegistryCompany('123456789000', fake.transport);
    expect(verdict).toEqual({ kind: 'unavailable', reason: 'malformed-response' });
  });
});

describe('Λ — ελαχιστοποίηση (GDPR άρθ. 5(1)(γ))', () => {
  it('Λ1 — 🔴 πρόσωπα, ΑΦΜ, κεφάλαιο και σκοπός ΔΕΝ υπάρχουν στο αποτέλεσμα', async () => {
    const verdict = await fetchRegistryCompany('123456789000', fakeRegistry({ status: 200, body: COMPANY }).transport);
    const serialized = JSON.stringify(verdict);
    for (const leak of ['ΓΕΩΡΓΙΟΣ', 'Πρόεδρος', '801832652', 'persons', 'capital', '25000', 'Κατασκευές']) {
      expect(serialized).not.toContain(leak);
    }
  });
});

describe('Κ — ενεργή; τρεις τιμές, ποτέ boolean', () => {
  it('Κ1 — κατάσταση που ο κατάλογος λέει ενεργή ⇒ active', async () => {
    const verdict = await fetchRegistryCompany('123456789000', fakeRegistry({ status: 200, body: COMPANY }).transport);
    expect(verdict.kind === 'found' && verdict.record.status.activity).toBe('active');
  });

  it('Κ2 — κατάσταση που ο κατάλογος λέει ανενεργή ⇒ inactive', async () => {
    const body = { ...COMPANY, status: { id: 6, descr: 'Διαγραμμένη' } };
    const verdict = await fetchRegistryCompany('123456789000', fakeRegistry({ status: 200, body }).transport);
    expect(verdict.kind === 'found' && verdict.record.status.activity).toBe('inactive');
  });

  it('Κ3 — 🔑 ο κατάλογος δεν διαβάστηκε ⇒ unknown, ΟΧΙ inactive', async () => {
    const fake = fakeRegistry({ status: 200, body: COMPANY }, { status: 503 });
    const verdict = await fetchRegistryCompany('123456789000', fake.transport);
    expect(verdict.kind === 'found' && verdict.record.status.activity).toBe('unknown');
  });
});

describe('Μ — μνήμη: γνώση μένει, άγνοια όχι', () => {
  it('Μ1 — found δεύτερη φορά ⇒ καμία δεύτερη ερώτηση', async () => {
    const fake = fakeRegistry({ status: 200, body: COMPANY });
    await lookupRegistryCompany('123456789000', fake.transport);
    await lookupRegistryCompany('000123456789000'.slice(3), fake.transport);
    expect(companyCalls(fake)).toBe(1);
  });

  it('Μ2 — 🔴 unavailable ΔΕΝ αποθηκεύεται: το επόμενο κλικ ξαναρωτά', async () => {
    const fake = fakeRegistry({ status: 503 });
    await lookupRegistryCompany('123456789000', fake.transport);
    await lookupRegistryCompany('123456789000', fake.transport);
    expect(companyCalls(fake)).toBe(2);
  });

  it('Μ3 — ταυτόχρονο διπλό κλικ ⇒ ΜΙΑ ερώτηση', async () => {
    const fake = fakeRegistry({ status: 200, body: COMPANY });
    await Promise.all([
      lookupRegistryCompany('123456789000', fake.transport),
      lookupRegistryCompany('123456789000', fake.transport),
    ]);
    expect(companyCalls(fake)).toBe(1);
  });
});
