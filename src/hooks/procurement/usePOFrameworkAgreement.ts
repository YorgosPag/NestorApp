'use client';

/**
 * usePOFrameworkAgreement — ADR-330 Phase 5.5
 *
 * Resolves an active Framework Agreement for the given supplier+project,
 * then computes the applicable discount against the PO gross total.
 * Re-evaluates reactively when supplier, project, or total changes.
 *
 * @module hooks/procurement/usePOFrameworkAgreement
 */

import { useMemo } from 'react';
import { useFrameworkAgreements } from './useFrameworkAgreements';
import {
  resolveActiveFa,
  computeFaDiscount,
  type FADiscountResult,
} from '@/subapps/procurement/utils/framework-agreement-discount';
import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';

export interface UsePOFrameworkAgreementResult extends FADiscountResult {
  activeFa: FrameworkAgreement | null;
  loading: boolean;
}

export function usePOFrameworkAgreement(
  supplierId: string,
  projectId: string,
  grossTotal: number,
): UsePOFrameworkAgreementResult {
  const { agreements, loading } = useFrameworkAgreements();

  const activeFa = useMemo(
    () => resolveActiveFa(agreements, supplierId, projectId),
    [agreements, supplierId, projectId],
  );

  const discount = useMemo<FADiscountResult>(() => {
    if (!activeFa || grossTotal <= 0) {
      return { discountPercent: 0, discountAmount: 0, netTotal: grossTotal };
    }
    return computeFaDiscount(activeFa, grossTotal);
  }, [activeFa, grossTotal]);

  return { activeFa, loading, ...discount };
}
