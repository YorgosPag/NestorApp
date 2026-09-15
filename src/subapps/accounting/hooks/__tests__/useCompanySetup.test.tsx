/**
 * @fileoverview **Η οθόνη προφίλ στέλνει ΜΟΝΟ ό,τι άλλαξε ο άνθρωπος** — ADR-841 §7 Α23 Φ3.2 Γ3.
 * @related subapps/accounting/hooks/useCompanySetup.ts
 *
 *   Κ1  🔴 Άλλαξε μόνο το τηλέφωνο ⇒ `fields: ["phone"]` (η φόρμα ταξιδεύει ολόκληρη για επικύρωση)
 *   Κ2  🔑 Χωρίς φορτωμένο προφίλ (πρώτη ρύθμιση) ⇒ ΚΑΜΙΑ μάσκα (πλήρης αποθήκευση)
 *   Κ3  🔴 Μετά την αποθήκευση ξαναφορτώνει ⇒ νέα βάση: ίδια φόρμα ξανά ⇒ `fields: []`
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { API_ROUTES } from '@/config/domain-constants';
import type { CompanyProfile, CompanySetupInput } from '@/subapps/accounting/types';

import { useCompanySetup } from '../useCompanySetup';

// ⚠️ ΣΤΑΘΕΡΗ αναφορά χρήστη: ο hook εξαρτά callbacks από το `user` — νέο αντικείμενο ανά render = βρόχος.
const mockUser = { getIdToken: async () => 'token' };
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));

const STORED = {
  entityType: 'sole_proprietor', businessName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ', phone: '2310000000',
  createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
} as unknown as CompanyProfile;

function formOf(profile: CompanyProfile, overrides: Record<string, unknown> = {}): CompanySetupInput {
  const { createdAt: _c, updatedAt: _u, ...rest } = profile;
  return { ...rest, ...overrides } as unknown as CompanySetupInput;
}

function respond(body: unknown): Response {
  return { status: 200, ok: true, json: async () => body } as unknown as Response;
}

const fetchMock = jest.fn();
let loaded: CompanyProfile | null = STORED;

beforeEach(() => {
  loaded = STORED;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
    respond({ success: true, data: init?.method === 'PUT' ? null : loaded }),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
});

function sentBodies(): Record<string, unknown>[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => url === API_ROUTES.ACCOUNTING.SETUP.BASE && init?.method === 'PUT')
    .map(([, init]) => JSON.parse(String(init.body)) as Record<string, unknown>);
}

async function mounted() {
  const hook = renderHook(() => useCompanySetup());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  return hook;
}

describe('useCompanySetup — μάσκα πεδίων (ADR-841 Α23 Γ3)', () => {
  it('🔴 Κ1 — άλλαξε μόνο το τηλέφωνο ⇒ `fields: ["phone"]`, η φόρμα ολόκληρη για επικύρωση', async () => {
    const { result } = await mounted();
    await waitFor(() => expect(result.current.profile).toEqual(STORED));

    await act(async () => {
      await result.current.saveSetup(formOf(STORED, { phone: '2310999999' }));
    });

    expect(sentBodies()).toEqual([
      expect.objectContaining({ businessName: STORED.businessName, phone: '2310999999', fields: ['phone'] }),
    ]);
  });

  it('🔑 Κ2 — χωρίς φορτωμένο προφίλ (πρώτη ρύθμιση) ⇒ ΚΑΜΙΑ μάσκα', async () => {
    loaded = null;
    const { result } = await mounted();

    await act(async () => {
      await result.current.saveSetup(formOf(STORED));
    });

    expect(sentBodies()[0]).not.toHaveProperty('fields');
  });

  it('🔴 Κ3 — μετά την αποθήκευση ξαναφορτώνει ⇒ ΝΕΑ βάση: ίδια φόρμα ξανά ⇒ `fields: []`', async () => {
    const { result } = await mounted();
    await waitFor(() => expect(result.current.profile).toEqual(STORED));
    const edited = formOf(STORED, { phone: '2310999999' });
    loaded = { ...STORED, phone: '2310999999' } as CompanyProfile;

    await act(async () => {
      await result.current.saveSetup(edited);
    });
    await waitFor(() => expect(result.current.profile?.phone).toBe('2310999999'));
    await act(async () => {
      await result.current.saveSetup(edited);
    });

    expect(sentBodies().map((body) => body.fields)).toEqual([['phone'], []]);
  });
});
