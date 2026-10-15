/**
 * ADR-915 Φ4γ — η κατάσταση του μητρώου: πύλη ταυτότητας · ανανέωση στο `freshUntil` στο ΠΑΡΑΣΚΗΝΙΟ · μονοτονική
 * αποδοχή. Συνθετικά δεδομένα μόνο.
 *
 * 🔑 Ο ελεγκτής ανανέωσης (`useServerViewSignal`) έχει τις δικές του άγκυρες· εδώ αγκυρώνεται **η καλωδίωση**: ότι του
 *    δίνεται το `freshUntil` της απόκρισης, και ότι ό,τι φέρνει το παρασκήνιο μπαίνει **χωρίς** «φορτώνει».
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useDocumentRegistry } from '../useDocumentRegistry';
import type { RegistryLoad } from '@/services/document-registry/document-registry.client';
import type { ServerViewSignalInput } from '@/services/realtime/hooks/use-server-view-signal';
import { fixtureResponse } from '@/lib/document-validity/__tests__/registry-fixture';

let auth: { user: { uid: string } | null; loading: boolean } = { user: { uid: 'synthetic-user' }, loading: false };
jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => auth }));

const fetchRegistry = jest.fn<Promise<RegistryLoad>, []>();
jest.mock('@/services/document-registry/document-registry.client', () => ({
  fetchDocumentRegistry: () => fetchRegistry(),
}));

let signal: ServerViewSignalInput | null = null;
jest.mock('@/services/realtime/hooks/use-server-view-signal', () => ({
  useServerViewSignal: (input: ServerViewSignalInput) => {
    signal = input;
    return { release: () => undefined };
  },
}));

const today = fixtureResponse();
const tomorrow = fixtureResponse({ asOf: '2026-10-16', freshUntil: '2026-10-16T21:00:00.000Z' });
const yesterday = fixtureResponse({ asOf: '2026-10-14', freshUntil: '2026-10-14T21:00:00.000Z' });
const ready = (registry: typeof today): RegistryLoad => ({ kind: 'ready', registry });

/** Ό,τι θα έκανε ο ελεγκτής στο `freshUntil` / στην ορατότητα / στην επανασύνδεση. */
async function backgroundRefresh(): Promise<void> {
  await act(async () => {
    await signal?.fetch();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  signal = null;
  auth = { user: { uid: 'synthetic-user' }, loading: false };
});

it('όσο λύνεται η ταυτότητα: «φορτώνει» και ΚΑΜΙΑ ανάγνωση', () => {
  auth = { user: null, loading: true };
  const { result } = renderHook(() => useDocumentRegistry());
  expect(result.current.view).toEqual({ state: 'loading' });
  expect(fetchRegistry).not.toHaveBeenCalled();
});

it('κανείς συνδεδεμένος ⇒ αποτυχία, όχι αιώνιο «φορτώνει»', () => {
  auth = { user: null, loading: false };
  const { result } = renderHook(() => useDocumentRegistry());
  expect(result.current.view).toEqual({ state: 'failed' });
});

it('η ανανέωση ρωτά ΑΚΡΙΒΩΣ στο `freshUntil` της απόκρισης (πριν φορτώσει: καμία)', async () => {
  fetchRegistry.mockResolvedValueOnce(ready(today));
  const { result } = renderHook(() => useDocumentRegistry());
  expect(signal?.freshness).toBe('pending');
  await waitFor(() => expect(result.current.view.state).toBe('ready'));
  expect(signal?.source).toBeNull();
  expect(signal?.freshness).toEqual({ revision: 0, freshUntil: today.freshUntil });
});

it('νέα «σήμερα» από το παρασκήνιο ⇒ μπαίνει χωρίς «φορτώνει», και το επόμενο ρολόι πάει στο νέο `freshUntil`', async () => {
  fetchRegistry.mockResolvedValueOnce(ready(today)).mockResolvedValueOnce(ready(tomorrow));
  const { result } = renderHook(() => useDocumentRegistry());
  await waitFor(() => expect(result.current.view.state).toBe('ready'));
  await backgroundRefresh();
  expect(result.current.view).toEqual({ state: 'ready', registry: tomorrow });
  expect(signal?.freshness).toEqual({ revision: 0, freshUntil: tomorrow.freshUntil });
});

it('μονοτονική: παλαιότερη «σήμερα» (καθυστερημένη απάντηση) ΑΠΟΡΡΙΠΤΕΤΑΙ', async () => {
  fetchRegistry.mockResolvedValueOnce(ready(today)).mockResolvedValueOnce(ready(yesterday));
  const { result } = renderHook(() => useDocumentRegistry());
  await waitFor(() => expect(result.current.view.state).toBe('ready'));
  await backgroundRefresh();
  expect(result.current.view).toEqual({ state: 'ready', registry: today });
});

it('αποτυχημένη ανανέωση ΚΡΑΤΑ τα δεδομένα (και το `asOf` τους μένει ορατό)', async () => {
  fetchRegistry.mockResolvedValueOnce(ready(today)).mockResolvedValueOnce({ kind: 'failed', message: 'synthetic' });
  const { result } = renderHook(() => useDocumentRegistry());
  await waitFor(() => expect(result.current.view.state).toBe('ready'));
  await backgroundRefresh();
  expect(result.current.view).toEqual({ state: 'ready', registry: today });
});

it('αποτυχία της ΠΡΩΤΗΣ φόρτωσης ⇒ `failed`· το `reload` ξαναρωτά', async () => {
  fetchRegistry.mockResolvedValueOnce({ kind: 'failed', message: 'synthetic' }).mockResolvedValueOnce(ready(today));
  const { result } = renderHook(() => useDocumentRegistry());
  await waitFor(() => expect(result.current.view.state).toBe('failed'));
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.view.state).toBe('ready'));
  expect(fetchRegistry).toHaveBeenCalledTimes(2);
});
