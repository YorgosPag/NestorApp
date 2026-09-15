/**
 * @fileoverview **Η οθόνη μαθαίνει την έκβαση της «Υιοθέτησης επωνυμίας ΓΕΜΗ»** — ADR-841 §7 Α23 Φ3.2 Γ2.
 * @related hooks/company/useCompanyRegistryIdentity.ts
 *
 *   Χ1  Υιοθέτηση ⇒ στέλνει ΑΥΤΟΥΣΙΑ ό,τι είδε ο άνθρωπος · η νέα αναφορά γίνεται κατάσταση
 *   Χ2  🔴 409/422 ⇒ ονομασμένη έκβαση + η ΦΡΕΣΚΙΑ αναφορά του σώματος (νέα προεπισκόπηση)
 *   Χ3  🔴 Βλάβη ⇒ `failed`, και η τελευταία γνωστή κρίση ΜΕΝΕΙ
 *   Χ4  🔒 Δεύτερο πάτημα όσο τρέχει ⇒ ΕΝΑ αίτημα
 *   Χ5  Νέα επαλήθευση ⇒ η παλιά έκβαση σβήνει (όχι μπαγιάτικο μήνυμα)
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { API_ROUTES } from '@/config/domain-constants';
import type { RegistryIdentityReport } from '@/types/company-registry';

import { useCompanyRegistryIdentity } from '../useCompanyRegistryIdentity';

const REGISTRY_NAME = 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ';

function report(businessName: string): RegistryIdentityReport {
  return {
    declaration: { entityType: 'ae', businessName, gemiNumber: '123456789000' },
    judgment: { state: 'declared', gap: 'name-mismatch', check: null },
    freshness: { kind: 'not-asked' },
  };
}

const INITIAL = report('Δοκιμαστικό Γραφείο');
const FRESH = report('ΝΕΑ ΠΡΟΕΠΙΣΚΟΠΗΣΗ');
const AFTER_ERASURE = report('ΜΕΤΑ ΤΗ ΔΙΑΓΡΑΦΗ');

/** Ό,τι απαντά η διαδρομή, ανά μέθοδο. */
function reportFor(method: string | undefined): RegistryIdentityReport {
  if (method === 'POST') return FRESH;
  return method === 'DELETE' ? AFTER_ERASURE : INITIAL;
}

function respond(status: number, body: unknown): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as unknown as Response;
}

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
    respond(200, { success: true, data: reportFor(init?.method) }),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
});

async function mounted() {
  const hook = renderHook(() => useCompanyRegistryIdentity());
  await waitFor(() => expect(hook.result.current.state.kind).toBe('ready'));
  return hook;
}

function postsTo(url: string): unknown[][] {
  return fetchMock.mock.calls.filter(([calledUrl, init]) => calledUrl === url && init?.method === 'POST');
}

describe('useCompanyRegistryIdentity — υιοθέτηση επωνυμίας (ADR-841 Α23)', () => {
  it('🔑 Χ1 — στέλνει ΑΥΤΟΥΣΙΑ την επωνυμία της προεπισκόπησης · η νέα αναφορά γίνεται κατάσταση', async () => {
    const { result } = await mounted();

    await act(() => result.current.adoptLegalName(REGISTRY_NAME));

    const [[, init]] = postsTo(API_ROUTES.COMPANIES.REGISTRY_LEGAL_NAME) as [[string, RequestInit]];
    expect(JSON.parse(String(init.body))).toEqual({ expectedLegalName: REGISTRY_NAME });
    expect(result.current.adoption).toBe('adopted');
    expect(result.current.state).toEqual({ kind: 'ready', report: FRESH });
    expect(result.current.adopting).toBe(false);
  });

  it.each([
    [409, 'registry-changed'],
    [422, 'not-adoptable'],
  ])('🔴 Χ2 — %i ⇒ `%s` + η ΦΡΕΣΚΙΑ αναφορά του σώματος', async (status, adoption) => {
    const { result } = await mounted();
    fetchMock.mockResolvedValueOnce(respond(status, { error: 'X', data: FRESH }));

    await act(() => result.current.adoptLegalName(REGISTRY_NAME));

    expect(result.current.adoption).toBe(adoption);
    expect(result.current.state).toEqual({ kind: 'ready', report: FRESH });
  });

  it.each([
    ['δίκτυο', () => Promise.reject(new Error('offline'))],
    ['500', () => Promise.resolve(respond(500, { error: 'INTERNAL' }))],
  ])('🔴 Χ3 — βλάβη (%s) ⇒ `failed`, η τελευταία γνωστή κρίση ΜΕΝΕΙ', async (_label, failure) => {
    const { result } = await mounted();
    fetchMock.mockImplementationOnce(failure);

    await act(() => result.current.adoptLegalName(REGISTRY_NAME));

    expect(result.current.adoption).toBe('failed');
    expect(result.current.state).toEqual({ kind: 'ready', report: INITIAL });
  });

  it('🔒 Χ4 — δεύτερο πάτημα όσο τρέχει ⇒ ΕΝΑ αίτημα', async () => {
    const { result } = await mounted();
    let release: (value: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (release = resolve)));

    await act(async () => {
      const first = result.current.adoptLegalName(REGISTRY_NAME);
      void result.current.adoptLegalName(REGISTRY_NAME);
      release(respond(200, { success: true, data: FRESH }));
      await first;
    });

    expect(postsTo(API_ROUTES.COMPANIES.REGISTRY_LEGAL_NAME)).toHaveLength(1);
  });

  it('🔑 Χ5 — νέα «Επαλήθευση» ⇒ η παλιά έκβαση υιοθέτησης σβήνει', async () => {
    const { result } = await mounted();
    fetchMock.mockResolvedValueOnce(respond(409, { error: 'REGISTRY_CHANGED', data: FRESH }));
    await act(() => result.current.adoptLegalName(REGISTRY_NAME));
    expect(result.current.adoption).toBe('registry-changed');

    await act(() => result.current.verify());

    expect(result.current.adoption).toBe('none');
    expect(postsTo(API_ROUTES.COMPANIES.REGISTRY_VERIFICATION)).toHaveLength(1);
  });
});

describe('useCompanyRegistryIdentity — διαγραφή αντιγράφου ΓΕΜΗ (ADR-841 Α23.12)', () => {
  const deletes = () =>
    fetchMock.mock.calls.filter(([url, init]) => url === API_ROUTES.COMPANIES.REGISTRY_VERIFICATION && init?.method === 'DELETE');

  it('🔴 Χ6 — `eraseCopy` ⇒ DELETE στη διαδρομή ΓΕΜΗ · η τρέχουσα κρίση γίνεται κατάσταση · έκβαση `erased`', async () => {
    const { result } = await mounted();

    await act(() => result.current.eraseCopy());

    expect(deletes()).toHaveLength(1);
    expect(result.current.state).toEqual({ kind: 'ready', report: AFTER_ERASURE });
    expect(result.current.erasure).toBe('erased');
    expect(result.current.erasing).toBe(false);
  });

  it('🔴 Χ7 — βλάβη ⇒ `failed` (ΠΟΤΕ σιωπηλά), και η τελευταία γνωστή κρίση ΜΕΝΕΙ', async () => {
    const { result } = await mounted();
    fetchMock.mockResolvedValueOnce(respond(500, { error: 'INTERNAL' }));

    await act(() => result.current.eraseCopy());

    expect(result.current.erasure).toBe('failed');
    expect(result.current.state).toEqual({ kind: 'ready', report: INITIAL });
  });

  it('🔑 Χ8 — νέα «Επαλήθευση» ⇒ το μήνυμα διαγραφής σβήνει (όχι «διαγράφηκαν» δίπλα σε νέο αντίγραφο)', async () => {
    const { result } = await mounted();
    await act(() => result.current.eraseCopy());
    expect(result.current.erasure).toBe('erased');

    await act(() => result.current.verify());

    expect(result.current.erasure).toBe('none');
  });
});
