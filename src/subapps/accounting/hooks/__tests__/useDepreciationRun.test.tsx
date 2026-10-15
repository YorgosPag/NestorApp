/**
 * useDepreciationRun (ADR-ACC-010 §2.1.1 Φάση 5) — η ροή της οθόνης τέλους χρήσης.
 *
 *   Υ1  κλειστό παράθυρο (`null`) ⇒ καμία ανάγνωση
 *   Υ2  καταχώριση ⇒ POST με τη χρήση, ανανέωση μητρώου + προεπισκόπησης
 *   Υ3  άρνηση ⇒ ο ΚΩΔΙΚΟΣ μένει ορατός ΚΑΙ μετά την ανανέωση (το σφάλμα που βρέθηκε: το `reload` τον έσβηνε)
 *   Υ4  αναίρεση ⇒ η δική της διαδρομή
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { API_ROUTES } from '@/config/domain-constants';
import { ApiClientError } from '@/lib/api/api-client-types';
import type { DepreciationPreview } from '@/subapps/accounting/types';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) },
}));

import { useDepreciationRun } from '../useDepreciationRun';

const PREVIEW = {
  fiscalYear: 2025, lines: [], totalTarget: 1200, totalBooked: 0, totalDelta: 1200, blocker: null, hasBooked: false,
} as unknown as DepreciationPreview;

beforeEach(() => {
  mockGet.mockReset().mockResolvedValue(PREVIEW);
  mockPost.mockReset();
});

it('Υ1 — κλειστό παράθυρο ⇒ καμία ανάγνωση', () => {
  renderHook(() => useDepreciationRun(null));
  expect(mockGet).not.toHaveBeenCalled();
});

it('Υ2 — καταχώριση: POST με τη χρήση, ανανέωση μητρώου και προεπισκόπησης', async () => {
  const onPosted = jest.fn();
  mockPost.mockResolvedValue({ fiscalYear: 2025, bookedDelta: 1200 });
  const { result } = renderHook(() => useDepreciationRun(2025, onPosted));
  await waitFor(() => expect(result.current.preview).toEqual(PREVIEW));

  await act(() => result.current.book());

  expect(mockPost).toHaveBeenCalledWith(API_ROUTES.ACCOUNTING.DEPRECIATION_RUN, { fiscalYear: 2025 });
  expect(onPosted).toHaveBeenCalledTimes(1);
  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(result.current.lastResult).toEqual({ fiscalYear: 2025, bookedDelta: 1200 });
});

it('Υ3 — άρνηση: ο κωδικός μένει ορατός και μετά την ανανέωση· καμία ανανέωση μητρώου', async () => {
  const onPosted = jest.fn();
  mockPost.mockRejectedValue(new ApiClientError('closed', 409, 'PERIOD_NOT_OPEN'));
  const { result } = renderHook(() => useDepreciationRun(2025, onPosted));
  await waitFor(() => expect(result.current.preview).not.toBeNull());

  await act(() => result.current.book());

  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(result.current.errorCode).toBe('PERIOD_NOT_OPEN');
  expect(onPosted).not.toHaveBeenCalled();
});

it('Υ4 — αναίρεση: η δική της διαδρομή', async () => {
  mockPost.mockResolvedValue({ fiscalYear: 2025, bookedDelta: -1200 });
  const { result } = renderHook(() => useDepreciationRun(2025));
  await waitFor(() => expect(result.current.preview).not.toBeNull());

  await act(() => result.current.reverse());

  expect(mockPost).toHaveBeenCalledWith(API_ROUTES.ACCOUNTING.DEPRECIATION_REVERSAL, { fiscalYear: 2025 });
});
