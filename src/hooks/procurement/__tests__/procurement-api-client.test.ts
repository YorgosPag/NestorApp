/**
 * ADR-923 §5.11 «3γ» Βήμα 2 — τα hooks προμηθειών μιλούν μέσω `apiClient`, όχι με ωμό `fetch`.
 * Ό,τι κρίνεται: η μέθοδος και η διαδρομή από το `API_ROUTES`, και ότι το σφάλμα φτάνει **ως έχει**
 * (με `errorCode`), γιατί από αυτό εξαρτάται η μετάφραση στη φόρμα.
 */

import { act, renderHook } from '@testing-library/react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import { useFrameworkAgreements } from '../useFrameworkAgreements';
import { useMaterials } from '../useMaterials';
import { useSupplierComparison, useSupplierMetrics } from '../useSupplierMetrics';
import type { CreateMaterialDTO } from '@/subapps/procurement/types/material';
import type { CreateFrameworkAgreementDTO } from '@/subapps/procurement/types/framework-agreement';

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: true }) }));
jest.mock('@/hooks/useCompanyId', () => ({ useCompanyId: () => ({ companyId: 'co1' }) }));
jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { subscribe: jest.fn(() => () => undefined) },
}));

const client = jest.mocked(apiClient);
const material = {} as CreateMaterialDTO;
const agreement = {} as CreateFrameworkAgreementDTO;

beforeEach(() => {
  jest.clearAllMocks();
  client.get.mockResolvedValue({ metrics: null, priceTrend: null });
  client.post.mockResolvedValue({ id: 'x' });
  client.patch.mockResolvedValue({ id: 'x' });
  client.delete.mockResolvedValue(undefined);
});

describe('useMaterials', () => {
  it('create / update / delete go through the API_ROUTES paths', async () => {
    const { result } = renderHook(() => useMaterials());
    await act(async () => {
      await result.current.createMaterial(material);
      await result.current.updateMaterial('m1', material);
      await result.current.deleteMaterial('m1');
    });
    expect(client.post).toHaveBeenCalledWith('/api/procurement/materials', material);
    expect(client.patch).toHaveBeenCalledWith('/api/procurement/materials/m1', material);
    expect(client.delete).toHaveBeenCalledWith('/api/procurement/materials/m1');
  });

  it('the refusal arrives with its errorCode intact', async () => {
    const refusal = new ApiClientError('dup', 409, 'MATERIAL_CODE_TAKEN');
    client.post.mockRejectedValue(refusal);
    const { result } = renderHook(() => useMaterials());
    await expect(result.current.createMaterial(material)).rejects.toBe(refusal);
  });
});

describe('useFrameworkAgreements', () => {
  it('create / update / delete go through the API_ROUTES paths', async () => {
    const { result } = renderHook(() => useFrameworkAgreements());
    await act(async () => {
      await result.current.createAgreement(agreement);
      await result.current.updateAgreement('a1', agreement);
      await result.current.deleteAgreement('a1');
    });
    expect(client.post).toHaveBeenCalledWith('/api/procurement/agreements', agreement);
    expect(client.patch).toHaveBeenCalledWith('/api/procurement/agreements/a1', agreement);
    expect(client.delete).toHaveBeenCalledWith('/api/procurement/agreements/a1');
  });

  it('the refusal arrives with its errorCode intact', async () => {
    const refusal = new ApiClientError('tie', 400, 'FRAMEWORK_AGREEMENT_AMBIGUOUS');
    client.post.mockRejectedValue(refusal);
    const { result } = renderHook(() => useFrameworkAgreements());
    await expect(result.current.createAgreement(agreement)).rejects.toBe(refusal);
  });
});

describe('useSupplierMetrics', () => {
  it('the category travels as a query parameter only when there is one', async () => {
    renderHook(() => useSupplierMetrics('s1', 'OIK-1'));
    renderHook(() => useSupplierMetrics('s2'));
    await act(async () => { await Promise.resolve(); });
    expect(client.get).toHaveBeenCalledWith('/api/procurement/supplier-metrics', {
      params: { supplierId: 's1', categoryCode: 'OIK-1' },
    });
    expect(client.get).toHaveBeenCalledWith('/api/procurement/supplier-metrics', { params: { supplierId: 's2' } });
  });

  it('the comparison reads its own route', async () => {
    renderHook(() => useSupplierComparison());
    await act(async () => { await Promise.resolve(); });
    expect(client.get).toHaveBeenCalledWith('/api/procurement/supplier-metrics/comparison');
  });
});
