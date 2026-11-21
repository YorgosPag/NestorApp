/**
 * @fileoverview **Η βιτρίνα δηλώνει ΣΕ ΠΟΙΟΝ ΧΩΡΟ ενεργεί** — ADR-841 §7 Α23.14 · ADR-787 §5.3 ζ.
 *
 * 🔬 Μετρημένο ζωντανά 2026-11-21: στον χώρο `dokimastiko-mixaniko-pea`, με λογαριασμό που ανήκει σε **άλλη**
 * εταιρεία, η προεπισκόπηση «Τι θα δει ο κόσμος» έδειξε τη νομική ταυτότητα της **άλλης**. Αιτία: ωμό `fetch` ⇒
 * καμία κεφαλίδα χώρου ⇒ ο server κρίνει την εταιρεία του λογαριασμού. Το ίδιο ίσχυε για δημοσίευση, κάρτα,
 * άδειες, σήμα. Μόνο ο `apiClient` δηλώνει τον χώρο (`buildHeaders` · `REQUESTED_WORKSPACE_HEADER`).
 *
 * Δύο σκέλη: (α) **συμπεριφορά** — η προεπισκόπηση ρωτά μέσω `apiClient` και κρατά τις τέσσερις καταστάσεις της·
 * (β) **κανένα** hook της βιτρίνας δεν ξαναγυρίζει σε ωμό `fetch` (ο κατάλογος είναι οι πόρτες του `/api/agency-profile`).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { renderHook, waitFor } from '@testing-library/react';

import { useShowcaseLegalPreview, SHOWCASE_LEGAL_PREVIEW_ENDPOINT } from '../useShowcaseLegalPreview';

jest.mock('@/lib/api/enterprise-api-client', () => ({
  ...jest.requireActual('@/lib/api/api-client-types'),
  apiClient: { get: jest.fn() },
}));

const { apiClient: mockApiClient } = jest.requireMock<{ apiClient: { get: jest.Mock } }>(
  '@/lib/api/enterprise-api-client',
);
const { ApiClientError } = jest.requireActual<typeof import('@/lib/api/api-client-types')>('@/lib/api/api-client-types');

/** Οι πόρτες του `/api/agency-profile/*` από τον πελάτη — καθεμία πρέπει να δηλώνει χώρο. */
const SHOWCASE_HOOKS = [
  'useAgencyShowcase.ts',
  'useShowcaseCard.ts',
  'useShowcaseLicences.ts',
  'useShowcaseMark.ts',
  'useCompanyContactSource.ts',
  'useEmailConfirmationSend.ts',
  'useShowcaseLegalPreview.ts',
  'useWorkspaceGet.ts',
] as const;

/** Δήλωση χώρου = κλήση `apiClient.*` ή του κοινού `useWorkspaceGet` (που καλεί `apiClient.get`). */
const DECLARES_WORKSPACE = /\bapiClient\.(get|post|put|delete)\s*[<(]|\buseWorkspaceGet\s*[<(]/;

/** Κώδικας χωρίς σχόλια — ώστε μια αναφορά σε `fetch(` μέσα σε σχόλιο να μην κρίνεται. */
function codeOf(file: string): string {
  const source = readFileSync(join(__dirname, '..', file), 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

beforeEach(() => {
  mockApiClient.get.mockReset();
});

describe('Α23.14 — η προεπισκόπηση ρωτά ΜΕΣΩ apiClient (άρα με δήλωση χώρου)', () => {
  it('ζητά το σωστό endpoint, χωρίς αυτόματη επανάληψη, και δείχνει το ωφέλιμο', async () => {
    const preview = { kind: 'ready-marker' };
    mockApiClient.get.mockResolvedValue(preview);
    const { result } = renderHook(() => useShowcaseLegalPreview());
    await waitFor(() => expect(result.current.kind).toBe('ready'));
    expect(mockApiClient.get).toHaveBeenCalledWith(SHOWCASE_LEGAL_PREVIEW_ENDPOINT, { retry: false });
    expect(result.current).toEqual({ kind: 'ready', preview });
  });

  it.each([401, 403])('%i ⇒ forbidden (δεν είσαι διαχειριστής αυτού του χώρου)', async (status) => {
    mockApiClient.get.mockRejectedValue(new ApiClientError('refused', status));
    const { result } = renderHook(() => useShowcaseLegalPreview());
    await waitFor(() => expect(result.current.kind).toBe('forbidden'));
  });

  it('503 ⇒ unavailable — ποτέ forbidden (άγνωστο ≠ άρνηση)', async () => {
    mockApiClient.get.mockRejectedValue(new ApiClientError('down', 503));
    const { result } = renderHook(() => useShowcaseLegalPreview());
    await waitFor(() => expect(result.current.kind).toBe('unavailable'));
  });
});

describe('Α23.14 — καμία πόρτα της βιτρίνας με ωμό fetch', () => {
  it.each(SHOWCASE_HOOKS)('%s περνά από τον apiClient', (file) => {
    const code = codeOf(file);
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).toMatch(DECLARES_WORKSPACE);
  });
});
