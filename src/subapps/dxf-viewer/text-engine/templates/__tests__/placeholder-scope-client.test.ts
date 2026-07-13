/**
 * ADR-651 Φάση Β — client cache του Firestore-derived scope.
 *
 * Κρίσιμες ιδιότητες (N.7.2): idempotent φόρτωση (ίδιο έργο ⇒ ΕΝΑ request, ακόμη κι όταν
 * το εργαλείο οπλίζεται ξανά), σύγχρονο event-time read για το κλικ, και **graceful
 * degradation**: αποτυχία δικτύου ⇒ κενό scope (η πινακίδα μπαίνει με κενά πεδία), ποτέ throw
 * μέσα στο commit path.
 */

import {
  __resetPlaceholderScopeForTests,
  getPlaceholderScopeSources,
  loadPlaceholderScope,
} from '../resolver/placeholder-scope-client';

const okResponse = (scope: unknown): Response =>
  ({ ok: true, status: 200, json: async () => ({ success: true, scope }) }) as Response;

describe('placeholder-scope-client', () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    __resetPlaceholderScopeForTests();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('φέρνει το scope μία φορά και το σερβίρει σύγχρονα στο κλικ', async () => {
    fetchMock.mockResolvedValue(okResponse({ project: { name: 'Οικία' } }));

    await loadPlaceholderScope('prj_1');

    expect(getPlaceholderScopeSources().project?.name).toBe('Οικία');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ projectId: 'prj_1' });
  });

  it('ίδιο έργο ⇒ κανένα δεύτερο request (idempotent)', async () => {
    fetchMock.mockResolvedValue(okResponse({ project: { name: 'Οικία' } }));

    await loadPlaceholderScope('prj_1');
    await loadPlaceholderScope('prj_1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('παράλληλες κλήσεις για το ίδιο έργο μοιράζονται ΕΝΑ in-flight request', async () => {
    fetchMock.mockResolvedValue(okResponse({ project: { name: 'Οικία' } }));

    await Promise.all([loadPlaceholderScope('prj_1'), loadPlaceholderScope('prj_1')]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('αλλαγή έργου ⇒ νέο fetch (το cache είναι ανά έργο)', async () => {
    fetchMock.mockResolvedValue(okResponse({ project: { name: 'Α' } }));
    await loadPlaceholderScope('prj_1');

    fetchMock.mockResolvedValue(okResponse({ project: { name: 'Β' } }));
    await loadPlaceholderScope('prj_2');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getPlaceholderScopeSources().project?.name).toBe('Β');
  });

  it('αποτυχία δικτύου ⇒ κενό scope, χωρίς throw (η πινακίδα μπαίνει με κενά πεδία)', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(loadPlaceholderScope('prj_1')).resolves.toEqual({});
    expect(getPlaceholderScopeSources()).toEqual({});
  });

  it('HTTP σφάλμα ⇒ κενό scope (δεν διαβάζεται σώμα σφάλματος ως scope)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 } as Response);

    await expect(loadPlaceholderScope()).resolves.toEqual({});
    expect(getPlaceholderScopeSources()).toEqual({});
  });
});
