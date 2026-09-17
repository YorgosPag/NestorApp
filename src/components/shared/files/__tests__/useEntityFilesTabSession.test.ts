/**
 * useEntityFilesTabSession — η εταιρεία του καλούντα ΔΕΝ πέφτει σιωπηλά στη συνεδρία.
 *
 * Το super_admin σε ξένο μισθωτή ανεβάζει με `tryResolveCompanyId({ building, user })`.
 * Αν αυτό λείπει, η καρτέλα πρέπει να δείξει placeholder — όχι να γράψει αρχεία στη
 * **δική του** εταιρεία.
 */

import { renderHook } from '@testing-library/react';

jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}));
jest.mock('@/hooks/useCompanyId', () => ({
  useCompanyId: () => ({ companyId: 'session-company' }),
}));
const mockDisplayName = jest.fn((companyId?: string) => (companyId ? `name:${companyId}` : undefined));
jest.mock('@/hooks/useCompanyDisplayName', () => ({
  useCompanyDisplayName: (companyId?: string) => mockDisplayName(companyId),
}));

import { useEntityFilesTabSession } from '../useEntityFilesTabSession';

describe('useEntityFilesTabSession', () => {
  beforeEach(() => mockDisplayName.mockClear());

  it('χωρίς επιλογές: εταιρεία συνεδρίας, χωρίς αίτημα ονόματος', () => {
    const { result } = renderHook(() => useEntityFilesTabSession());
    expect(result.current).toEqual({
      companyId: 'session-company',
      currentUserId: 'user-1',
      companyName: undefined,
    });
    expect(mockDisplayName).toHaveBeenCalledWith(undefined);
  });

  it('ρητή εταιρεία καλούντα κερδίζει τη συνεδρία', () => {
    const { result } = renderHook(() =>
      useEntityFilesTabSession({ companyId: 'tenant-b', withCompanyName: true }),
    );
    expect(result.current.companyId).toBe('tenant-b');
    expect(result.current.companyName).toBe('name:tenant-b');
  });

  it('ρητό undefined ΔΕΝ πέφτει στην εταιρεία της συνεδρίας', () => {
    const { result } = renderHook(() =>
      useEntityFilesTabSession({ companyId: undefined, withCompanyName: true }),
    );
    expect(result.current.companyId).toBeUndefined();
    expect(result.current.companyName).toBeUndefined();
  });
});
